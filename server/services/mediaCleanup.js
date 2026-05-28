import fs from "fs/promises";
import imagekit from "../config/imagekit.js";

const IMAGEKIT_HOST = "ik.imagekit.io";

export const buildConversationKey = (firstUserId, secondUserId) =>
  [String(firstUserId), String(secondUserId)].sort().join(":");

export const resolveMediaKind = (mimeType = "") => {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
};

export const deleteLocalFile = async (filePath) => {
  if (!filePath) return false;

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

export const uploadMediaFile = async (file) => {
  if (!file) return null;

  try {
    const fileBuffer = await fs.readFile(file.path);
    const uploadResponse = await imagekit.upload({
      file: fileBuffer,
      fileName: file.originalname,
    });

    const mediaKind = resolveMediaKind(file.mimetype || "");
    const mediaUrl = imagekit.url({
      path: uploadResponse.filePath,
      transformation:
        mediaKind === "image"
          ? [
              { quality: "auto" },
              { format: "webp" },
              { width: "1280" },
            ]
          : [],
    });

    return {
      url: mediaUrl,
      fileId: uploadResponse.fileId,
      filePath: uploadResponse.filePath,
      provider: "imagekit",
      mimeType: file.mimetype || null,
      originalName: file.originalname || null,
      size: file.size || null,
      kind: mediaKind,
    };
  } finally {
    await deleteLocalFile(file.path);
  }
};

export const normalizeMediaPayload = (media) => {
  if (!media) return null;

  if (Array.isArray(media)) {
    return media.map((item) => normalizeMediaPayload(item)).filter(Boolean);
  }

  return {
    url: media.url || media.media_url || null,
    fileId: media.fileId || media.file_id || null,
    filePath: media.filePath || media.file_path || null,
    provider: media.provider || "imagekit",
    mimeType: media.mimeType || media.mime_type || null,
    originalName: media.originalName || media.original_name || null,
    size: media.size ?? null,
    kind: media.kind || media.message_type || "image",
  };
};

export const extractImageKitFileIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== IMAGEKIT_HOST) return null;

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const fileName = pathParts[pathParts.length - 1];
    if (!fileName) return null;

    return decodeURIComponent(fileName);
  } catch {
    return null;
  }
};

export const deleteStoredMedia = async (media) => {
  if (!media) return false;

  const normalized = normalizeMediaPayload(media);
  const tasks = [];

  if (normalized?.fileId) {
    tasks.push(imagekit.files.delete(normalized.fileId));
  }

  if (normalized?.filePath && normalized.provider !== "imagekit") {
    tasks.push(deleteLocalFile(normalized.filePath));
  }

  if (tasks.length === 0) return false;

  await Promise.allSettled(tasks);
  return true;
};

export const sanitizeMessageForViewer = (message, viewerId) => {
  if (!message) return null;

  const plain = typeof message.toObject === "function" ? message.toObject() : { ...message };
  const hiddenFor = (plain.hidden_for_user_ids || []).map(String);
  const isHiddenForViewer = viewerId && hiddenFor.includes(String(viewerId));

  if (isHiddenForViewer || plain.deleted_for_everyone) {
    return null;
  }

  const media = normalizeMediaPayload(plain.media);
  const attachments = normalizeMediaPayload(plain.attachments || []);

  return {
    ...plain,
    media,
    media_url: media?.url || plain.media_url || null,
    attachments,
  };
};

export const buildMessagePreview = (message, viewerId = null) => {
  const sanitized = sanitizeMessageForViewer(message, viewerId);
  if (!sanitized) return null;

  if (sanitized.message_type && sanitized.message_type !== "text" && sanitized.media?.url) {
    return sanitized.text || "Media";
  }

  return sanitized.text || "Media";
};
