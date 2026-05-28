import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import { emitStreamEvent, registerStream, unregisterStream } from "../services/realtimeHub.js";
import {
  buildConversationKey,
  buildMessagePreview,
  deleteStoredMedia,
  normalizeMediaPayload,
  sanitizeMessageForViewer,
  uploadMediaFile,
} from "../services/mediaCleanup.js";

const getUserIdFromRequest = (req) => {
  const auth = typeof req.auth === "function" ? req.auth() : req.auth;
  return auth?.userId || null;
};

const getUploadedFile = (req) =>
  req.file ||
  req.files?.media?.[0] ||
  req.files?.image?.[0] ||
  req.files?.attachment?.[0] ||
  (Array.isArray(req.files) ? req.files[0] : null);

const serializeMessage = (message, viewerId = null) => {
  const sanitized = sanitizeMessageForViewer(message, viewerId);
  if (!sanitized) return null;

  return {
    ...sanitized,
    media: normalizeMediaPayload(sanitized.media),
    attachments: normalizeMediaPayload(sanitized.attachments || []),
  };
};

const loadMessageWithUsers = async (messageId) =>
  Message.findById(messageId)
    .populate("from_user_id to_user_id reply_to_message_id forwarded_from_message_id")
    .lean();

export const sseController = (req, res) => {
  const { userId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders?.();

  registerStream("messages", userId, res);
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  req.on("close", () => {
    unregisterStream("messages", userId);
  });
};

export const sendMessage = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { to_user_id, text = "" } = req.body;
    const file = getUploadedFile(req);

    if (!userId || !to_user_id) {
      return res.status(400).json({ success: false, message: "Missing message recipient" });
    }

    const conversationKey = buildConversationKey(userId, to_user_id);
    const media = file ? await uploadMediaFile(file) : null;
    const messageType = media?.kind || "text";

    const connection = await User.exists({
      _id: userId,
      connections: to_user_id,
    });

    if (!connection) {
      return res.status(403).json({
        success: false,
        message: "You can only message connected users",
      });
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      conversation_key: conversationKey,
      text: text.trim(),
      message_type: messageType,
      media,
      attachments: media ? [media] : [],
    });

    const hydratedMessage = await loadMessageWithUsers(message._id);
    const payload = serializeMessage(hydratedMessage);

    if (payload) {
      emitStreamEvent("messages", to_user_id, {
        type: "message",
        action: "created",
        message: payload,
      });
      emitStreamEvent("messages", userId, {
        type: "message",
        action: "created",
        message: payload,
      });
    }

    const actor = await User.findById(userId).select("full_name username profile_picture").lean();

    if (String(userId) !== String(to_user_id)) {
      await createNotification({
        recipientId: to_user_id,
        actorId: userId,
        type: "message",
        entityType: "message",
        entityId: message._id.toString(),
        title: actor?.full_name || actor?.username || "New message",
        body: buildMessagePreview(hydratedMessage, to_user_id) || "Sent you a message",
        href: `/messages/${userId}`,
        avatarUrl: actor?.profile_picture || null,
        meta: { messageId: message._id.toString() },
        dedupeKey: `message:${message._id.toString()}`,
      });
    }

    return res.json({ success: true, message: payload });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { to_user_id } = req.body;

    if (!userId || !to_user_id) {
      return res.status(400).json({ success: false, message: "Missing chat partner" });
    }

    const conversationKey = buildConversationKey(userId, to_user_id);
    const messages = await Message.find({
      $and: [
        {
          $or: [
            { conversation_key: conversationKey },
            { from_user_id: userId, to_user_id },
            { from_user_id: to_user_id, to_user_id: userId },
          ],
        },
        {
          hidden_for_user_ids: { $ne: userId },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("from_user_id to_user_id reply_to_message_id forwarded_from_message_id");

    await Message.updateMany(
      { from_user_id: to_user_id, to_user_id: userId },
      { seen: true },
    );

    const payload = messages
      .map((message) => serializeMessage(message, userId))
      .filter(Boolean);

    return res.json({ success: true, messages: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserRecentMessages = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const user = await User.findById(userId).select("connections").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const recentMessages = await Message.find({
      to_user_id: userId,
      from_user_id: { $in: user.connections || [] },
      hidden_for_user_ids: { $ne: userId },
    })
      .populate("from_user_id to_user_id")
      .sort({ createdAt: -1 })
      .lean();

    const groupedMessages = recentMessages.reduce((accumulator, message) => {
      const senderId = message.from_user_id?._id?.toString?.() || message.from_user_id?.toString?.();
      if (!senderId) return accumulator;

      const existing = accumulator[senderId];
      if (!existing || new Date(message.createdAt) > new Date(existing.createdAt)) {
        accumulator[senderId] = {
          ...message,
          preview: buildMessagePreview(message, userId),
        };
      }

      return accumulator;
    }, {});

    return res.json({
      success: true,
      messages: Object.values(groupedMessages)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .filter((message) => Boolean(message.preview)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { messageId } = req.params;
    const message = await Message.findById(messageId).lean();
    if (!message) {
      return res.json({ success: true, message: "Message already deleted", messageId });
    }

    if (String(message.from_user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Only the sender can unsend this message" });
    }

    const mediaTargets = [message.media, ...(Array.isArray(message.attachments) ? message.attachments : [])].filter(Boolean);
    const cleanupResults = await Promise.allSettled(mediaTargets.map((media) => deleteStoredMedia(media)));

    const mediaCleanup = {
      attempted: mediaTargets.length,
      deletedCount: cleanupResults.filter((result) => result.status === "fulfilled").length,
      failed: cleanupResults
        .map((result, index) => ({ result, media: mediaTargets[index] }))
        .filter(({ result }) => result.status === "rejected")
        .map(({ media, result }) => ({
          media,
          error: result.reason?.message || "Failed to delete media",
        })),
    };

    const relatedNotifications = await Notification.find({
      entityType: "message",
      entityId: message._id.toString(),
    })
      .select("_id recipientId")
      .lean();

    if (relatedNotifications.length > 0) {
      await Notification.deleteMany({
        entityType: "message",
        entityId: message._id.toString(),
      });

      relatedNotifications.forEach((notification) => {
        emitStreamEvent("notifications", notification.recipientId, {
          type: "notification_deleted",
          id: notification._id.toString(),
        });
      });
    }

    await Message.updateMany(
      { reply_to_message_id: message._id },
      { $set: { reply_to_message_id: null } },
    );
    await Message.updateMany(
      { forwarded_from_message_id: message._id },
      { $set: { forwarded_from_message_id: null } },
    );

    await Message.deleteOne({ _id: message._id, from_user_id: userId });

    const payload = {
      type: "message",
      action: "deleted",
      messageId: message._id.toString(),
      conversationKey: message.conversation_key,
    };

    emitStreamEvent("messages", message.from_user_id, payload);
    emitStreamEvent("messages", message.to_user_id, payload);

    return res.json({
      success: true,
      message: "Message deleted",
      messageId: message._id.toString(),
      mediaCleanup,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMessageMedia = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (String(message.from_user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Only the sender can delete media" });
    }

    if (!message.media && (!Array.isArray(message.attachments) || message.attachments.length === 0)) {
      return res.json({ success: true, message: "No media to delete" });
    }

    await Promise.allSettled([
      deleteStoredMedia(message.media),
      ...((message.attachments || []).map((attachment) => deleteStoredMedia(attachment))),
    ]);

    message.media = null;
    message.attachments = [];
    message.media_deleted_at = new Date();
    if (!message.text) {
      message.message_type = "text";
    }
    await message.save();

    const hydrated = await loadMessageWithUsers(messageId);
    const payload = serializeMessage(hydrated);

    emitStreamEvent("messages", message.from_user_id, {
      type: "message",
      action: "media_deleted",
      message: payload,
    });
    emitStreamEvent("messages", message.to_user_id, {
      type: "message",
      action: "media_deleted",
      message: payload,
    });

    return res.json({ success: true, message: "Media deleted", message: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
