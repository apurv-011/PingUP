import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { buildConversationKey } from "./mediaCleanup.js";
import { emitStreamEvent } from "./realtimeHub.js";

const normalizeUserDoc = (user) =>
  user
    ? {
        _id: user._id?.toString?.() || String(user._id),
        full_name: user.full_name,
        username: user.username,
        profile_picture: user.profile_picture,
        bio: user.bio,
      }
    : null;

export const removeConnectionCleanup = async ({
  userId,
  targetUserId,
  mode = process.env.CHAT_REMOVAL_MODE || "readonly",
}) => {
  const conversationKey = buildConversationKey(userId, targetUserId);

  const runCleanup = async (session = null) => {
    const connection = await Connection.findOne({
      $or: [
        { from_user_id: userId, to_user_id: targetUserId },
        { from_user_id: targetUserId, to_user_id: userId },
      ],
      status: "accepted",
    }).session(session || null);

    if (!connection) {
      return { success: false, message: "Connection not found" };
    }

    await User.updateOne({ _id: userId }, { $pull: { connections: targetUserId } }, { session });
    await User.updateOne({ _id: targetUserId }, { $pull: { connections: userId } }, { session });

    await Connection.deleteMany(
      {
        $or: [
          { from_user_id: userId, to_user_id: targetUserId },
          { from_user_id: targetUserId, to_user_id: userId },
        ],
      },
      { session },
    );

    await Notification.deleteMany(
      {
        $and: [
          {
            $or: [
              { recipientId: userId, actorId: targetUserId, entityType: "connection" },
              { recipientId: targetUserId, actorId: userId, entityType: "connection" },
            ],
          },
          {
            $or: [
              { entityId: connection._id.toString() },
              { "meta.connectionId": connection._id.toString() },
            ],
          },
        ],
      },
      { session },
    );

    let deletedMessages = 0;

    if (mode === "delete") {
      const deletionResult = await Message.deleteMany(
        {
          $or: [
            { conversation_key: conversationKey },
            { from_user_id: userId, to_user_id: targetUserId },
            { from_user_id: targetUserId, to_user_id: userId },
          ],
        },
        { session },
      );

      deletedMessages = deletionResult.deletedCount || 0;
    }

    const leftUser = await User.findById(userId).select("full_name username profile_picture bio").lean();
    const rightUser = await User.findById(targetUserId)
      .select("full_name username profile_picture bio")
      .lean();

    const payload = {
      type: "connection_removed",
      conversationKey,
      targetUserId,
      user: normalizeUserDoc(rightUser),
      actor: normalizeUserDoc(leftUser),
      mode,
      deletedMessages,
    };

    return {
      success: true,
      message: mode === "delete" ? "Connection removed and chat deleted" : "Connection removed",
      deletedMessages,
      mode,
      targetUser: normalizeUserDoc(rightUser),
      payload,
    };
  };

  try {
    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        result = await runCleanup(session);
      });
    } finally {
      await session.endSession();
    }

    if (result?.success) {
      emitStreamEvent("connections", userId, result.payload);
      emitStreamEvent("connections", targetUserId, result.payload);
      emitStreamEvent("messages", userId, {
        type: "conversation_removed",
        conversationKey,
        targetUserId,
        mode,
      });
      emitStreamEvent("messages", targetUserId, {
        type: "conversation_removed",
        conversationKey,
        targetUserId: userId,
        mode,
      });
    }

    return result;
  } catch (error) {
    const fallbackResult = await runCleanup(null);
    if (fallbackResult?.success) {
      emitStreamEvent("connections", userId, fallbackResult.payload);
      emitStreamEvent("connections", targetUserId, fallbackResult.payload);
      emitStreamEvent("messages", userId, {
        type: "conversation_removed",
        conversationKey,
        targetUserId,
        mode,
      });
      emitStreamEvent("messages", targetUserId, {
        type: "conversation_removed",
        conversationKey,
        targetUserId: userId,
        mode,
      });
    }

    return fallbackResult;
  }
};
