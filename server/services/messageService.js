import Message from "../models/Message.js";
import User from "../models/User.js";
import {
  buildConversationKey,
  buildMessagePreview,
  normalizeMediaPayload,
  sanitizeMessageForViewer,
  uploadMediaFile,
} from "./mediaCleanup.js";

const USER_SELECT = "full_name username profile_picture";

const populateMessageUsers = (query) =>
  query
    .populate({ path: "from_user_id", select: USER_SELECT })
    .populate({ path: "to_user_id", select: USER_SELECT })
    .populate({ path: "reply_to_message_id", select: "text message_type media from_user_id to_user_id createdAt" })
    .populate({ path: "forwarded_from_message_id", select: "text message_type media from_user_id to_user_id createdAt" });

export const loadMessageWithUsers = async (messageId) =>
  populateMessageUsers(Message.findById(messageId)).lean();

export const serializeMessage = (message, viewerId = null) => {
  const sanitized = sanitizeMessageForViewer(message, viewerId);
  if (!sanitized) return null;

  return {
    ...sanitized,
    media: normalizeMediaPayload(sanitized.media),
    attachments: normalizeMediaPayload(sanitized.attachments || []),
  };
};

export const getMessageActor = (userId) =>
  User.findById(userId).select(USER_SELECT).lean();

export const assertMessagingConnection = async (senderId, recipientId) => {
  const connection = await User.exists({
    _id: senderId,
    connections: recipientId,
  });

  return Boolean(connection);
};

export const persistChatMessage = async ({
  senderId,
  recipientId,
  text = "",
  file = null,
  clientMessageId = null,
}) => {
  const cleanText = String(text || "").trim();
  const hasText = Boolean(cleanText);
  const hasFile = Boolean(file);

  if (!senderId || !recipientId) {
    throw new Error("Missing message recipient");
  }

  if (!(await assertMessagingConnection(senderId, recipientId))) {
    throw new Error("You can only message connected users");
  }

  if (!hasText && !hasFile) {
    throw new Error("Please enter a message or attach media");
  }

  const media = hasFile ? await uploadMediaFile(file) : null;
  const conversationKey = buildConversationKey(senderId, recipientId);
  const messageType = media?.kind || "text";

  let message;
  try {
    message = await Message.create({
      from_user_id: senderId,
      to_user_id: recipientId,
      conversation_key: conversationKey,
      text: cleanText,
      message_type: messageType,
      media,
      attachments: media ? [media] : [],
      client_message_id: clientMessageId || null,
    });
  } catch (error) {
    if (error?.code === 11000 && clientMessageId) {
      message = await Message.findOne({
        from_user_id: senderId,
        client_message_id: clientMessageId,
      });
    } else {
      throw error;
    }
  }

  const hydratedMessage = await loadMessageWithUsers(message._id);
  const payload = serializeMessage(hydratedMessage);

  return {
    message,
    hydratedMessage,
    payload,
    conversationKey,
    clientMessageId: clientMessageId || null,
    preview: buildMessagePreview(hydratedMessage, recipientId) || "Sent you a message",
  };
};
