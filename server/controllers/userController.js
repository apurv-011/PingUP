import imagekit from "../config/imagekit.js";
import { inngest } from "../inngest/index.js";
import Connection from "../models/Connection.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import fs from "fs";
import { createNotification } from "../services/notificationService.js";

const getUserIdFromRequest = (req) => {
  const auth = typeof req.auth === "function" ? req.auth() : req.auth;
  return auth?.userId || null;
};

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Get user data using userId
export const getUserData = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
};

// Update user data
export const updateUserData = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    let { username, bio, location, full_name } = req.body;

    const tempUser = await User.findById(userId);

    !username && (username = tempUser.username);

    if (tempUser.username !== username) {
      const user = await User.findOne({ username });
      if (user) {
        username = tempUser.username;
      }
    }

    const updatedData = {
      username,
      bio,
      location,
      full_name,
    };

    const profile = req.files.profile && req.files.profile[0];
    const cover = req.files.cover && req.files.cover[0];

    if (profile) {
      const buffer = fs.readFileSync(profile.path);
      const response = await imagekit.upload({
        file: buffer,
        fileName: profile.originalname,
      });

      const url = imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: "auto" },
          { format: "webp" },
          { width: "512" },
        ],
      });

      updatedData.profile_picture = url;
    }

    if (cover) {
      const buffer = fs.readFileSync(cover.path);
      const response = await imagekit.upload({
        file: buffer,
        fileName: cover.originalname,
      });

      const url = imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: "auto" },
          { format: "webp" },
          { width: "1280" },
        ],
      });

      updatedData.cover_photo = url;
    }

    const user = await User.findByIdAndUpdate(userId, updatedData, {
      returnDocument: 'after',
    });

    res.json({ success: true, user, message: "Profile Updated Successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
};

// Find users using username, email, location, name
export const discoverUsers = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { input } = req.body;
    const safeInput = escapeRegExp(input || "");

    const allUsers = await User.find({
      $or: [
        { username: new RegExp(safeInput, "i") },
        { email: new RegExp(safeInput, "i") },
        { full_name: new RegExp(safeInput, "i") },
        { location: new RegExp(safeInput, "i") },
      ],
    });

    const filteredUsers = allUsers.filter((user) => user._id !== userId);

    res.json({ success: true, users: filteredUsers });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
};

// Follow user
export const followUser = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.following.includes(id)) {
      return res.json({
        success: false,
        message: "You are already following this user",
      });
    }

    await User.updateOne({ _id: userId }, { $addToSet: { following: id } });

    await User.updateOne({ _id: id }, { $addToSet: { followers: userId } });

    const actor = await User.findById(userId).select("full_name username profile_picture");
    if (String(id) !== String(userId)) {
      await createNotification({
        recipientId: id,
        actorId: userId,
        type: "follow",
        entityType: "user",
        entityId: userId,
        title: `${actor?.full_name || actor?.username || "Someone"} started following you`,
        body: `@${actor?.username || "user"} is now following you`,
        href: `/profile/${userId}`,
        avatarUrl: actor?.profile_picture || null,
        meta: { followerId: userId },
        dedupeKey: `follow:${userId}:${id}`,
      });
    }

    res.json({ success: true, message: "Now you are following this user" });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
};

// Unfollow user
export const unfollowUser = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.body;

    await User.updateOne({ _id: userId }, { $pull: { following: id } });
    await User.updateOne({ _id: id }, { $pull: { followers: userId } });

    res.json({ success: true, message: "You are no longer following this user" });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
};  

// Send Connection request
export const sendConnectionRequest = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req)
    const { id } = req.body;

    const last24hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const connectionRequests = await Connection.find({from_user_id: userId, createdAt: {$gt: last24hours}})
    if(connectionRequests.length >= 20) {
      return res.json({ success: false, message: "You have sent more than 20 connection requests in last 24 hours"})
    }

    const connection = await Connection.findOne({
      $or: [
        {from_user_id: userId, to_user_id: id},
        {from_user_id: id, to_user_id: userId},
      ]
    })

    if(!connection) {
      const newConnection =  await Connection.create({
        from_user_id: userId,
        to_user_id: id
      })

      await inngest.send({
        name: 'app/connection-request',
        data: {connectionId: newConnection._id}
      })

      const actor = await User.findById(userId).select("full_name username profile_picture");
      await createNotification({
        recipientId: id,
        actorId: userId,
        type: "connection",
        entityType: "connection",
        entityId: newConnection._id.toString(),
        title: `${actor?.full_name || actor?.username || "Someone"} sent you a connection request`,
        body: `@${actor?.username || "user"} wants to connect`,
        href: "/connections",
        avatarUrl: actor?.profile_picture || null,
        meta: { connectionId: newConnection._id.toString() },
        dedupeKey: `connection:${newConnection._id.toString()}`,
      });

      return res.json({ success: true, message: "Connection request sent successfully"})
    } else if(connection && connection.status === 'accepted') {
      return res.json({ success: false, message: "You are already connected with this user"})
    }

    return res.json({ success: false, message: "Connection request pending"})


  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
}

// Get user connection 
export const getUserConnections = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req)
    const user = await User.findById(userId).populate('connections followers following')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Clerk user may not be synced yet.",
      })
    }

    const connections = user.connections
    const followers = user.followers
    const following = user.following

    const pendingConnections = (await Connection.find({to_user_id: userId,status: 'pending'}).populate('from_user_id')).map(connection => connection.from_user_id)

    res.json({success: true, connections, followers, following, pendingConnections})

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
}

// Accept Connection request
export const acceptConnectionRequest = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req)
    const { id } = req.body;

    const connection = await Connection.findOne({from_user_id: id, to_user_id: userId})

    if(!connection) {
      return res.json({success: false, message: "Connection not found"})
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.connections.push(id);
    await user.save()

    const toUser = await User.findById(id);
    toUser.connections.push(userId);
    await toUser.save()


    connection.status = 'accepted'
    await connection.save()

    const actor = await User.findById(userId).select("full_name username profile_picture");
    await createNotification({
      recipientId: id,
      actorId: userId,
      type: "connection",
      entityType: "connection",
      entityId: connection._id.toString(),
      title: `${actor?.full_name || actor?.username || "Someone"} accepted your request`,
      body: `You are now connected with @${actor?.username || "user"}`,
      href: `/profile/${userId}`,
      avatarUrl: actor?.profile_picture || null,
      meta: { connectionId: connection._id.toString(), status: "accepted" },
      dedupeKey: `connection-accepted:${connection._id.toString()}`,
    });

    res.json({ success: true, message: "Connection accepted successfully"})


  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "User not found" });
  }
}

// Get user profiles
export const getUserProfiles = async (req, res) => {
  try {
    const { profileId, page = 1, limit = 20 } = req.body;
    const currentPage = Math.max(1, Number(page));
    const pageSize = Math.min(50, Math.max(1, Number(limit)));
    const skip = (currentPage - 1) * pageSize;
    const profile = await User.findById(profileId)

    if(!profile) {
      return res.json({success: false, message: "Profile not found"})
    }

    const [posts, totalPosts] = await Promise.all([
      Post.find({ user: profileId })
        .populate("user")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Post.countDocuments({ user: profileId }),
    ]);

    res.json({
      success: true,
      profile,
      posts,
      page: currentPage,
      limit: pageSize,
      hasMore: skip + posts.length < totalPosts,
    })

  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}



