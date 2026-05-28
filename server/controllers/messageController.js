import fs from "fs";
import imagekit from "../config/imagekit.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import { emitStreamEvent, registerStream, unregisterStream } from "../services/realtimeHub.js";

const getUserIdFromRequest = (req) => {
  const auth = typeof req.auth === "function" ? req.auth() : req.auth;
  return auth?.userId || null;
};

export const sseController = (req, res) => {
  const { userId } = req.params;
  console.log("New client connected : ", userId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  registerStream("messages", userId, res);

  res.write("log: Connected to SSE stream\n\n");

  req.on("close", () => {
    unregisterStream("messages", userId);
    console.log("Client disconnected");
  });
};

export const sendMessage = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { to_user_id, text } = req.body;

    const image = req.file;

    let media_url = "";

    let message_type = image ? "image" : "text";

    if (message_type === "image") {
      const fileBuffer = fs.readFileSync(image.path);
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: image.originalname,
      });
      media_url = imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: "auto" },
          { format: "webp" },
          { width: "1280" },
        ],
      });
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text,
      message_type,
      media_url,
    });

    res.json({ success: true, message });

    const [messageWithUserData, actor] = await Promise.all([
      Message.findById(message._id).populate("from_user_id to_user_id"),
      User.findById(userId).select("full_name username profile_picture"),
    ]);

    if (String(userId) !== String(to_user_id)) {
      await createNotification({
        recipientId: to_user_id,
        actorId: userId,
        type: "message",
        entityType: "message",
        entityId: message._id.toString(),
        title: actor?.full_name || actor?.username || "New message",
        body: text ? text.slice(0, 80) : "Sent you a message",
        href: `/messages/${userId}`,
        avatarUrl: actor?.profile_picture || null,
        meta: { messageId: message._id.toString() },
        dedupeKey: `message:${message._id.toString()}`,
      });
    }

    if (messageWithUserData) {
      emitStreamEvent("messages", to_user_id, messageWithUserData);
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { to_user_id } = req.body;

    const messages = await Message.find({
      $or: [
        { from_user_id: userId, to_user_id },
        { from_user_id: to_user_id, to_user_id: userId },
      ],
    }).sort({ createdAt: -1 });

    await Message.updateMany(
      { from_user_id: to_user_id, to_user_id: userId },
      { seen: true },
    );

    res.json({ success: true, messages });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const getUserRecentMessages = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    const messages = await Message.find({ to_user_id: userId })
      .populate("from_user_id to_user_id")
      .sort({ createdAt: -1 });

    res.json({ success: true, messages });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
