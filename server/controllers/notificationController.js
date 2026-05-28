import Notification from "../models/Notification.js";
import { normalizeNotification } from "../services/notificationService.js";
import { emitStreamEvent, registerStream, unregisterStream } from "../services/realtimeHub.js";

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

    res.json({ success: true, notification: normalizeNotification(notification) });
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

    await Notification.updateMany(
      { recipientId: userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );

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

    emitStreamEvent("notifications", userId, {
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
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const deleteResult = await Notification.deleteMany({ recipientId: userId });

    emitStreamEvent("notifications", userId, {
      type: "notifications_cleared",
      deletedCount: deleteResult.deletedCount || 0,
      unreadCount: 0,
    });

    return res.json({
      success: true,
      deletedCount: deleteResult.deletedCount || 0,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
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
