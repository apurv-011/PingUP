import fs from "fs/promises";
import imagekit from "../config/imagekit.js";

const normalizePostMedia = (mediaItem) => {
  if (!mediaItem) return null;

  if (typeof mediaItem === "string") {
    return {
      url: mediaItem,
      fileId: null,
      filePath: null,
      provider: "imagekit",
    };
  }

  return {
    url: mediaItem.url || null,
    fileId: mediaItem.fileId || mediaItem.file_id || null,
    filePath: mediaItem.filePath || mediaItem.file_path || null,
    provider: mediaItem.provider || "imagekit",
  };
};

export const normalizePostMediaList = (mediaList = []) =>
  mediaList.map((item) => normalizePostMedia(item)).filter(Boolean);

export const uploadPostMedia = async (files = []) => {
  if (!files.length) return [];

  return Promise.all(
    files.map(async (file) => {
      try {
        const fileBuffer = await fs.readFile(file.path);
        const uploadResponse = await imagekit.upload({
          file: fileBuffer,
          fileName: file.originalname,
          folder: "posts",
        });

        return {
          url: uploadResponse.url,
          fileId: uploadResponse.fileId,
          filePath: uploadResponse.filePath,
          provider: "imagekit",
          originalName: file.originalname || null,
          mimeType: file.mimetype || null,
          size: file.size || null,
        };
      } finally {
        await fs.unlink(file.path).catch((error) => {
          if (error?.code !== "ENOENT") {
            throw error;
          }
        });
      }
    }),
  );
};

export const deletePostMedia = async (post) => {
  const assets = normalizePostMediaList([...(post?.image_assets || []), ...(post?.image_urls || [])]);
  const deletableAssets = assets.filter((asset) => asset?.fileId || (asset?.filePath && asset.provider !== "imagekit"));

  if (deletableAssets.length === 0) {
    return { deletedCount: 0, failed: [] };
  }

  const results = await Promise.allSettled(
    deletableAssets.map(async (asset) => {
      if (asset.fileId) {
        await imagekit.files.delete(asset.fileId);
        return true;
      }

      if (asset.filePath && asset.provider !== "imagekit") {
        await fs.unlink(asset.filePath);
        return true;
      }

      return false;
    }),
  );

  const failed = results
    .map((result, index) => ({ result, asset: deletableAssets[index] }))
    .filter(({ result }) => result.status === "rejected")
    .map(({ asset, result }) => ({ asset, error: result.reason?.message || "Failed to delete asset" }));

  return {
    deletedCount: deletableAssets.length - failed.length,
    failed,
  };
};

