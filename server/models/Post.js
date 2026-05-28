import mongoose from 'mongoose';

const postMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileId: { type: String, default: null, index: true },
    filePath: { type: String, default: null },
    provider: { type: String, default: "imagekit" },
    mimeType: { type: String, default: null },
    originalName: { type: String, default: null },
    size: { type: Number, default: null },
  },
  { _id: false, minimize: false },
);

const postSchema = new mongoose.Schema({
    user: {type: String, ref: "User", required: true},
    content: {type: String, default: ""},
    image_urls: [{type: String, default: []}],
    image_assets: { type: [postMediaSchema], default: [] },
    post_type: {type: String, enum: ['text', 'image', 'text_with_image'], required: true},
    likes_count: [{type: String, ref: "User", default: []}],
}, {timestamps: true, minimize: false})

postSchema.index({ user: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

export default Post;
