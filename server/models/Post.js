import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    user: {type: String, ref: "User", required: true},
    content: {type: String, default: ""},
    image_urls: [{type: String, default: []}],
    post_type: {type: String, enum: ['text', 'image', 'text_with_image'], required: true},
    likes_count: [{type: String, ref: "User", default: []}],
}, {timestamps: true, minimize: false})

postSchema.index({ user: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

export default Post;
