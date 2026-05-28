import express from "express";
import { upload } from "../config/multer.js";
import { protect } from "../middleware/auth.js";
import { addPost, deletePost, getFeedPosts, likePost, streamPosts } from "../controllers/postController.js";

const postRouter = express.Router();

postRouter.post("/add", upload.array("images", 4), protect, addPost);
postRouter.get("/feed", protect, getFeedPosts);
postRouter.get("/stream/:userId", streamPosts);
postRouter.post("/like", protect, likePost);
postRouter.delete("/:postId", protect, deletePost);

export default postRouter;
