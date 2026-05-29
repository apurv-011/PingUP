import { verifyToken } from "@clerk/backend";
import User from "../models/User.js";
import { buildConversationKey } from "./mediaCleanup.js";
import { getMessageActor, persistChatMessage } from "./messageService.js";

const streams = {
  messages: new Map(),
  notifications: new Map(),
  posts: new Map(),
  connections: new Map(),
};

let socketServer = null;
const socketUsers = new Map();

const getSocketUserId = async (socket) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
  const fallbackUserId = socket.handshake.auth?.userId || null;

  if (token && process.env.CLERK_SECRET_KEY) {
    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        authorizedParties: process.env.FRONTEND_URL?.split(",").map((value) => value.trim()).filter(Boolean),
      });

      return verified?.sub || null;
    } catch (error) {
      console.error("Socket auth verification failed:", error.message);
    }
  }

  if (process.env.NODE_ENV !== "production" && fallbackUserId) {
    return fallbackUserId;
  }

  return null;
};

const joinUserRooms = (socket, userId) => {
  const roomSuffixes = ["messages", "notifications", "posts", "connections"];
  roomSuffixes.forEach((channel) => socket.join(`${channel}:${userId}`));
  socket.join(`user:${userId}`);
};

const emitToSocketRoom = (channel, userId, event, payload) => {
  if (!socketServer) return false;
  socketServer.to(`${channel}:${userId}`).emit(event, payload);
  socketServer.to(`user:${userId}`).emit(event, payload);
  return true;
};

const trackSocketForUser = (userId, socketId) => {
  const sockets = socketUsers.get(userId) || new Set();
  sockets.add(socketId);
  socketUsers.set(userId, sockets);
  return sockets.size;
};

const untrackSocketForUser = (userId, socketId) => {
  const sockets = socketUsers.get(userId);
  if (!sockets) return 0;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    socketUsers.delete(userId);
    return 0;
  }

  socketUsers.set(userId, sockets);
  return sockets.size;
};

const emitPresenceToConnections = async (userId, event, payload) => {
  try {
    const user = await User.findById(userId).select("connections").lean();
    const connections = Array.isArray(user?.connections) ? user.connections : [];

    connections.forEach((connectionId) => {
      if (!socketServer) return;
      socketServer.to(`connections:${connectionId}`).emit(event, payload);
      socketServer.to(`user:${connectionId}`).emit(event, payload);
    });
  } catch (error) {
    console.error("Presence broadcast failed:", error.message);
  }
};

export const registerStream = (channel, userId, res) => {
  const channelStreams = streams[channel];
  if (!channelStreams) return;

  const existing = channelStreams.get(userId);
  if (existing && existing !== res) {
    try {
      existing.end();
    } catch {
      // ignore
    }
  }

  channelStreams.set(userId, res);
};

export const unregisterStream = (channel, userId) => {
  streams[channel]?.delete(userId);
};

export const emitStreamEvent = (channel, userId, payload) => {
  const stream = streams[channel]?.get(userId);
  if (stream) {
    stream.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  return emitToSocketRoom(channel, userId, "realtime-event", {
    channel,
    payload,
  });
};

export const emitStreamEventToMany = (channel, userIds, payload) => {
  if (!Array.isArray(userIds)) return false;

  return userIds.some((userId) => emitStreamEvent(channel, userId, payload));
};

export const emitMessageEvent = (userId, payload) => {
  const action = payload?.action || "updated";
  const eventName =
    action === "created"
      ? "receive-message"
      : action === "deleted"
        ? "message-deleted"
        : action === "media_deleted"
          ? "message-media-updated"
          : "message-updated";

  emitStreamEvent("messages", userId, payload);
  return emitToSocketRoom("messages", userId, eventName, payload);
};

export const emitNotificationEvent = (userId, payload) => {
  const type = payload?.type || "notification";
  const eventName =
    type === "notification_deleted"
      ? "notification-deleted"
      : type === "notifications_cleared"
        ? "notifications-cleared"
        : type === "notification_read"
          ? "notification-read"
          : "new-notification";

  emitStreamEvent("notifications", userId, payload);
  return emitToSocketRoom("notifications", userId, eventName, payload);
};

export const emitPresenceEvent = (userId, payload) => emitStreamEvent("connections", userId, payload);

export const attachRealtimeSocketServer = (io) => {
  socketServer = io;

  io.on("connection", async (socket) => {
    const userId = await getSocketUserId(socket);

    if (!userId) {
      socket.emit("socket-error", { message: "Not authenticated" });
      socket.disconnect(true);
      return;
    }

    socket.data.userId = userId;
    joinUserRooms(socket, userId);

    const connectionCount = trackSocketForUser(userId, socket.id);
    socket.emit("socket-connected", {
      userId,
      connectionCount,
      online: true,
    });

    socket.to(`user:${userId}`).emit("user-online", { userId, online: true });
    await emitPresenceToConnections(userId, "user-online", { userId, online: true });

    socket.on("join-conversation", ({ partnerId, conversationKey }) => {
      const key = conversationKey || (partnerId ? buildConversationKey(userId, partnerId) : null);
      if (!key) return;
      socket.join(`conversation:${key}`);
      socket.emit("conversation-joined", { conversationKey: key });
    });

    socket.on("leave-conversation", ({ partnerId, conversationKey }) => {
      const key = conversationKey || (partnerId ? buildConversationKey(userId, partnerId) : null);
      if (!key) return;
      socket.leave(`conversation:${key}`);
      socket.emit("conversation-left", { conversationKey: key });
    });

    socket.on("typing", ({ partnerId, conversationKey, isTyping }) => {
      const key = conversationKey || (partnerId ? buildConversationKey(userId, partnerId) : null);
      if (!key) return;
      socket.to(`conversation:${key}`).emit("typing", {
        userId,
        conversationKey: key,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("send-message", async (payload = {}, ack) => {
      try {
        const recipientId = payload.to_user_id || payload.toUserId;
        const text = payload.text || "";
        const clientMessageId = payload.client_message_id || payload.clientMessageId || null;

        const result = await persistChatMessage({
          senderId: userId,
          recipientId,
          text,
          clientMessageId,
        });

        const actor = await getMessageActor(userId);
        const responseMessage = {
          ...result.payload,
          client_message_id: result.clientMessageId,
          clientMessageId: result.clientMessageId,
        };

        emitMessageEvent(userId, {
          type: "message",
          action: "created",
          message: responseMessage,
        });
        emitMessageEvent(recipientId, {
          type: "message",
          action: "created",
          message: responseMessage,
        });

        if (String(userId) !== String(recipientId)) {
          import("./notificationService.js").then(({ createNotification }) => {
            createNotification({
              recipientId,
              actorId: userId,
              type: "message",
              entityType: "message",
              entityId: result.message._id.toString(),
              title: actor?.full_name || actor?.username || "New message",
              body: result.preview,
              href: `/messages/${userId}`,
              avatarUrl: actor?.profile_picture || null,
              meta: { messageId: result.message._id.toString() },
              dedupeKey: `message:${result.message._id.toString()}`,
            }).catch((error) => {
              console.error("Socket message notification failed:", error.message);
            });
          });
        }

        if (typeof ack === "function") {
          ack({
            success: true,
            message: responseMessage,
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("disconnect", async () => {
      const remainingConnections = untrackSocketForUser(userId, socket.id);
      if (remainingConnections === 0) {
        socket.to(`user:${userId}`).emit("user-offline", { userId, online: false });
        await emitPresenceToConnections(userId, "user-offline", { userId, online: false });
      }
    });
  });
};

export const getSocketServer = () => socketServer;
export const getConnectedSocketCount = (userId) => socketUsers.get(userId)?.size || 0;
export const getOnlineUserIds = () => Array.from(socketUsers.keys());
export const streamChannels = streams;
