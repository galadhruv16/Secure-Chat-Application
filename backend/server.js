import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/database.js";
import { errorHandler } from "./middleware/auth.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import userRoutes from "./routes/userRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Track active socket connections
const activeUsers = new Map(); // userId -> socketId

// Socket.io event handlers
io.on("connection", (socket) => {
  console.log(`✓ User connected: ${socket.id}`);

  // User joins with their ID
  socket.on("user-join", (userId) => {
    activeUsers.set(userId, socket.id);
    socket.join(userId); // Join room named after userId
    io.emit("users-online", Array.from(activeUsers.keys()));
    console.log(`✓ User ${userId} joined`);
  });

  // Real-time message event
  socket.on("send-message", (data) => {
    const { senderId, receiverId, text, messageId } = data;

    // Emit to sender's room too (for their own UI updates if needed)
    io.to(senderId).emit("receive-message", {
      messageId,
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      isSender: true,
    });

    // Send to receiver's room
    io.to(receiverId).emit("receive-message", {
      messageId,
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      isSender: false,
    });

    console.log(`✓ Message: ${senderId} -> ${receiverId}`);
  });

  // Typing indicator
  socket.on("typing", (data) => {
    const { senderId, receiverId } = data;
    io.to(receiverId).emit("user-typing", { senderId });
  });

  socket.on("stop-typing", (data) => {
    const { senderId, receiverId } = data;
    io.to(receiverId).emit("user-stop-typing", { senderId });
  });

  // User disconnects
  socket.on("disconnect", () => {
    let disconnectedUserId = null;
    for (const [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        activeUsers.delete(userId);
        break;
      }
    }
    io.emit("users-online", Array.from(activeUsers.keys()));
    console.log(`✗ User disconnected: ${disconnectedUserId} (${socket.id})`);
  });
});

// Connect to database
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// Error handler
app.use(errorHandler);

// Not found handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Socket.io ready for real-time communication`);
});
