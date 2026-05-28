import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: String, ref: "User", required: true, index: true },
    actorId: { type: String, ref: "User", default: null, index: true },
    type: {
      type: String,
      enum: ["message", "like", "comment", "follow", "connection", "system"],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["message", "post", "comment", "user", "connection", "story", "system"],
      required: true,
      index: true,
    },
    entityId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    href: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, dedupeKey: 1 }, { unique: true });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
