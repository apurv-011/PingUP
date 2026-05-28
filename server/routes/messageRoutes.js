import express from "express";
import {
  deleteMessage,
  deleteMessageMedia,
  getChatMessages,
  getUserRecentMessages,
  sendMessage,
  sseController,
} from "../controllers/messageController.js";
import { upload } from "../config/multer.js";
import { protect } from "../middleware/auth.js";

const messageRouter = express.Router();

messageRouter.get("/recent", protect, getUserRecentMessages);
messageRouter.post("/send", upload.single("media"), protect, sendMessage);
messageRouter.post("/get", protect, getChatMessages);
messageRouter.delete("/:messageId", protect, deleteMessage);
messageRouter.delete("/:messageId/media", protect, deleteMessageMedia);
messageRouter.get("/:userId", sseController);


export default messageRouter;
