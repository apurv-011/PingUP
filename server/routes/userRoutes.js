import express from "express";
import { acceptConnectionRequest, discoverUsers, followUser, getUserConnections, getUserData, getUserProfiles, removeConnection, sendConnectionRequest, unfollowUser, updateUserData } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../config/multer.js";
import { registerStream, unregisterStream } from "../services/realtimeHub.js";

const userRouter = express.Router();

userRouter.get('/data', protect, getUserData)
userRouter.post('/update', upload.fields([{name: 'profile', maxCount: 1}, {name: 'cover', maxCount: 1}]), protect, updateUserData)
userRouter.post('/discover', protect, discoverUsers)
userRouter.post('/follow', protect, followUser)
userRouter.post('/unfollow', protect, unfollowUser)
userRouter.post('/connect', protect, sendConnectionRequest)
userRouter.post('/accept', protect, acceptConnectionRequest)
userRouter.post('/remove-connection', protect, removeConnection)
userRouter.get('/connections', protect, getUserConnections)
userRouter.post('/profiles', protect, getUserProfiles)
userRouter.get('/stream/:userId', (req, res) => {
    const { userId } = req.params

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    registerStream("connections", userId, res);
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    req.on("close", () => {
        unregisterStream("connections", userId);
    });
})


export default userRouter;
