import fs from "fs";
import imagekit from "../config/imagekit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";

const getUserIdFromRequest = (req) => {
  const auth = typeof req.auth === "function" ? req.auth() : req.auth;
  return auth?.userId || null;
};

const getPagination = (req) => {
  const page = Math.max(1, Number(req.query?.page || req.body?.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query?.limit || req.body?.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
};

const uploadPostMedia = async (files = []) => {
  if (!files.length) return [];

  return Promise.all(
    files.map(async (file) => {
      const fileBuffer = fs.readFileSync(file.path);
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: file.originalname,
        folder: "posts",
      });

      return imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: "auto" },
          { format: "webp" },
          { width: "1280" },
        ],
      });
    }),
  );
};

// add post
export const addPost = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { content = "", post_type } = req.body;
    const images = Array.isArray(req.files) ? req.files : [];

    const image_urls = await uploadPostMedia(images);
    const resolvedPostType =
      post_type || (image_urls.length ? (content ? "text_with_image" : "image") : "text");

    if (!content.trim() && !image_urls.length) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one image or some text",
      });
    }

    const post = await Post.create({
      user: userId,
      content,
      image_urls,
      post_type: resolvedPostType,
    });

    const hydratedPost = await Post.findById(post._id).populate("user");

    res.json({ success: true, message: "Post created successfully", post: hydratedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get posts
export const getFeedPosts = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { page, limit, skip } = getPagination(req);

    const user = await User.findById(userId).select("connections following");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userIds = [...new Set([userId, ...(user.connections || []), ...(user.following || [])])];
    const [posts, total] = await Promise.all([
      Post.find({ user: { $in: userIds } })
        .populate("user")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ user: { $in: userIds } }),
    ]);

    res.json({
      success: true,
      posts,
      page,
      limit,
      hasMore: skip + posts.length < total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Like post
export const likePost = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { postId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const alreadyLiked = post.likes_count?.includes(userId);
    const actor = await User.findById(userId).select("full_name username profile_picture");

    if (alreadyLiked) {
      await Post.updateOne({ _id: postId }, { $pull: { likes_count: userId } });
      return res.json({ success: true, message: "Post unliked" });
    }

    await Post.updateOne({ _id: postId }, { $addToSet: { likes_count: userId } });

    if (String(post.user) !== String(userId)) {
      await createNotification({
        recipientId: post.user,
        actorId: userId,
        type: "like",
        entityType: "post",
        entityId: post._id.toString(),
        title: `${actor?.full_name || actor?.username || "Someone"} liked your post`,
        body: post.content?.slice(0, 90) || "Your post received a like",
        href: `/profile/${post.user}`,
        avatarUrl: actor?.profile_picture || null,
        meta: { postId: post._id.toString() },
        dedupeKey: `like:${post._id.toString()}:${userId}`,
      });
    }

    res.json({ success: true, message: "Post liked" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
