import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, default: null },
    fileId: { type: String, default: null, index: true },
    filePath: { type: String, default: null },
    provider: { type: String, default: "imagekit" },
    mimeType: { type: String, default: null },
    originalName: { type: String, default: null },
    size: { type: Number, default: null },
    kind: {
      type: String,
      enum: ["image", "video", "audio", "document"],
      default: "image",
    },
  },
  { _id: false, minimize: false },
);

const messageSchema = new mongoose.Schema(
  {
    from_user_id: { type: String, ref: "User", required: true, index: true },
    to_user_id: { type: String, ref: "User", required: true, index: true },
    conversation_key: { type: String, required: true, index: true },
    text: { type: String, trim: true, default: "" },
    message_type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "deleted"],
      default: "text",
      index: true,
    },
    media: { type: mediaSchema, default: null },
    attachments: { type: [mediaSchema], default: [] },
    reply_to_message_id: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    forwarded_from_message_id: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    client_message_id: { type: String, default: null, index: true },
    hidden_for_user_ids: [{ type: String, ref: "User", index: true }],
    deleted_for_everyone: { type: Boolean, default: false, index: true },
    deleted_by_user_id: { type: String, ref: "User", default: null },
    deleted_at: { type: Date, default: null },
    media_deleted_at: { type: Date, default: null },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false },
);

messageSchema.index({ conversation_key: 1, createdAt: -1 });
messageSchema.index({ to_user_id: 1, seen: 1, createdAt: -1 });
messageSchema.index({ from_user_id: 1, deleted_for_everyone: 1, createdAt: -1 });
messageSchema.index({ from_user_id: 1, client_message_id: 1 }, { unique: true, sparse: true });

const Message = mongoose.model("Message", messageSchema);

export default Message;
