import Notification from "../models/Notification.js";
import { emitStreamEvent } from "./realtimeHub.js";

export const normalizeNotification = (notification) => {
  if (!notification) return null;

  return {
    id: notification._id?.toString?.() || notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body || "",
    href: notification.href || null,
    avatarUrl: notification.avatarUrl || null,
    createdAt: notification.createdAt,
    read: Boolean(notification.read),
    meta: notification.meta || {},
    actorId: notification.actorId || null,
    entityType: notification.entityType,
    entityId: notification.entityId || null,
    dedupeKey: notification.dedupeKey,
  };
};

export const createNotification = async (input) => {
  const {
    recipientId,
    actorId = null,
    type,
    entityType,
    entityId = null,
    title,
    body = "",
    href = null,
    avatarUrl = null,
    meta = {},
    dedupeKey,
  } = input;

  if (!recipientId || !type || !entityType || !title || !dedupeKey) {
    return null;
  }

  const existing = await Notification.findOne({ recipientId, dedupeKey });
  if (existing) {
    return normalizeNotification(existing);
  }

  try {
    const notification = await Notification.create({
      recipientId,
      actorId,
      type,
      entityType,
      entityId,
      title,
      body,
      href,
      avatarUrl,
      meta,
      dedupeKey,
    });

    const normalized = normalizeNotification(notification);
    emitStreamEvent("notifications", recipientId, {
      type: "notification",
      notification: normalized,
    });

    return normalized;
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Notification.findOne({ recipientId, dedupeKey });
      return normalizeNotification(duplicate);
    }

    throw error;
  }
};
