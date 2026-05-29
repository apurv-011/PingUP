import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { normalizeNotification } from "../services/notificationService.js";
import { emitNotificationEvent, registerStream, unregisterStream } from "../services/realtimeHub.js";

const getUserIdFromRequest = (req) => {
  const auth = typeof req.auth === "function" ? req.auth() : req.auth;
  return auth?.userId || null;
};

export const getNotifications = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipientId: userId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Notification.countDocuments({ recipientId: userId, read: false }),
    ]);

    res.json({
      success: true,
      notifications: notifications.map(normalizeNotification),
      unreadCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    const normalized = normalizeNotification(notification);
    emitNotificationEvent(userId, {
      type: "notification_read",
      notification: normalized,
      unreadCount: await Notification.countDocuments({ recipientId: userId, read: false }),
    });

    res.json({ success: true, notification: normalized });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const updateResult = await Notification.updateMany(
      { recipientId: userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );

    emitNotificationEvent(userId, {
      type: "notification_read",
      unreadCount: 0,
      readAll: true,
      modifiedCount: updateResult.modifiedCount || 0,
    });

    res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({ _id: id, recipientId: userId });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    emitNotificationEvent(userId, {
      type: "notification_deleted",
      id,
      unreadCount: await Notification.countDocuments({ recipientId: userId, read: false }),
    });

    return res.json({ success: true, id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const clearNotifications = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    let deletedCount = 0;
    try {
      await session.withTransaction(async () => {
        const deleteResult = await Notification.deleteMany({ recipientId: userId }, { session });
        deletedCount = deleteResult.deletedCount || 0;
      });
    } catch (transactionError) {
      console.warn("Notification clear transaction fallback:", transactionError.message);
      const deleteResult = await Notification.deleteMany({ recipientId: userId });
      deletedCount = deleteResult.deletedCount || 0;
    }

    emitNotificationEvent(userId, {
      type: "notifications_cleared",
      deletedCount,
      unreadCount: 0,
    });

    return res.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

export const streamNotifications = (req, res) => {
  const userId = getUserIdFromRequest(req) || req.params.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  registerStream("notifications", userId, res);
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  req.on("close", () => {
    unregisterStream("notifications", userId);
  });
};
