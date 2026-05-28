import express from "express";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  streamNotifications,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const notificationRouter = express.Router();

notificationRouter.get("/", protect, getNotifications);
notificationRouter.get("/stream", protect, streamNotifications);
notificationRouter.get("/stream/:userId", streamNotifications);
notificationRouter.patch("/:id/read", protect, markNotificationRead);
notificationRouter.patch("/read-all", protect, markAllNotificationsRead);

export default notificationRouter;
