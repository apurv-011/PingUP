import express from "express";
import cors from "cors";
import { createServer } from "http";
import "dotenv/config";
import connectDB from "./config/db.js";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import { clerkMiddleware } from '@clerk/express'
import userRouter from "./routes/userRoutes.js";
import postRouter from "./routes/postRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import { Server } from "socket.io";
import { attachRealtimeSocketServer } from "./services/realtimeHub.js";

const app = express();
await connectDB()

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(",").map((origin) => origin.trim()).filter(Boolean) || true,
  credentials: true,
}));
app.use(clerkMiddleware())

app.get("/", (req, res) => {
  res.send("Server is running...");
});

app.use('/api/inngest', serve({client: inngest, functions}))
app.use('/api/user', userRouter)
app.use('/api/post', postRouter)
app.use('/api/story', storyRouter)
app.use('/api/message', messageRouter)
app.use('/api/notifications', notificationRouter)

const PORT = process.env.PORT || 4000;
const httpServer = createServer(app);

const io =
  process.env.VERCEL !== "1"
    ? new Server(httpServer, {
        cors: {
          origin: process.env.FRONTEND_URL?.split(",").map((origin) => origin.trim()).filter(Boolean) || true,
          credentials: true,
        },
        transports: ["websocket", "polling"],
      })
    : null;

if (io) {
  attachRealtimeSocketServer(io);
}

if (process.env.VERCEL !== "1") {
  httpServer.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
  });
}

export default app;
