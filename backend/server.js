import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import connectDB from "./config/database.js";
import { errorHandler } from "./middleware/auth.js";
import { securityContext } from "./middleware/securityContext.js";
import { securityMonitor, auditFailedAccess } from "./middleware/securityMonitor.js";
import { socketAuthMiddleware, validateSocketSession } from "./middleware/socketAuth.js";
import { generalLimiter } from "./middleware/rateLimit.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import securityRoutes from "./routes/securityRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

// Middleware
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true, // Required for cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware applied globally
app.use(securityContext);
app.use(auditFailedAccess);
app.use(generalLimiter);

// Socket.io setup with CORS credentials
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Track active socket connections
const activeUsers = new Map(); // userId -> socketId

// Apply socket authentication middleware
io.use(socketAuthMiddleware);

// Socket.io event handlers
io.on("connection", (socket) => {
  // User identity comes from verified token, not client payload
  const userId = socket.userId;
  console.log(`✓ Authenticated user connected: ${userId} (${socket.id})`);

  // Auto-join room using verified userId
  activeUsers.set(userId, socket.id);
  socket.join(userId);
  io.emit("users-online", Array.from(activeUsers.keys()));
  console.log(`✓ User ${userId} joined room`);

  // Also support explicit join for backward compatibility
  socket.on("user-join", () => {
    // userId already bound from token — ignore client-provided userId
    activeUsers.set(userId, socket.id);
    socket.join(userId);
    io.emit("users-online", Array.from(activeUsers.keys()));
  });

  // Real-time message event — senderId comes from verified token
  socket.on("send-message", async (data) => {
    const {
      receiverId,
      text,
      messageId,
      createdAt,
      isEncrypted,
      encryptedAESKey,
      senderEncryptedAESKey,
      e2eeIV,
      encryptionAlgorithm,
      verificationStatus,
      verificationResult,
    } = data;
    // SECURITY: sender identity comes from socket.userId (verified token),
    // not from client-provided senderId
    const senderId = userId;

    // Emit to sender's room
    io.to(senderId).emit("receive-message", {
      messageId,
      senderId,
      receiverId,
      text,
      timestamp: createdAt || new Date(),
      isEncrypted: !!isEncrypted,
      encryptedAESKey,
      senderEncryptedAESKey,
      e2eeIV,
      encryptionAlgorithm,
      verificationStatus,
      verificationResult,
      isSender: true,
    });

    // Send to receiver's room
    io.to(receiverId).emit("receive-message", {
      messageId,
      senderId,
      receiverId,
      text,
      timestamp: createdAt || new Date(),
      isEncrypted: !!isEncrypted,
      encryptedAESKey,
      senderEncryptedAESKey,
      e2eeIV,
      encryptionAlgorithm,
      verificationStatus,
      verificationResult,
      isSender: false,
    });

    console.log(`✓ Message: ${senderId} -> ${receiverId}`);
  });

  // Typing indicator
  socket.on("typing", (data) => {
    const { receiverId } = data;
    io.to(receiverId).emit("user-typing", { senderId: userId });
  });

  socket.on("stop-typing", (data) => {
    const { receiverId } = data;
    io.to(receiverId).emit("user-stop-typing", { senderId: userId });
  });

  // Handle session-revoked event: force disconnect
  socket.on("check-session", async () => {
    const isValid = await validateSocketSession(socket);
    if (!isValid) {
      socket.emit("session-revoked", {
        message: "Your session has been revoked. Please login again.",
      });
      socket.disconnect(true);
    }
  });

  // User disconnects
  socket.on("disconnect", () => {
    activeUsers.delete(userId);
    io.emit("users-online", Array.from(activeUsers.keys()));
    console.log(`✗ User disconnected: ${userId} (${socket.id})`);
  });
});

// Expose io instance for forced logout from controllers
app.set("io", io);
app.set("activeUsers", activeUsers);

/**
 * Force logout a user by emitting session-revoked event.
 * Can be called from session/security controllers.
 */
export function forceLogoutUser(userId) {
  const socketId = activeUsers.get(userId);
  if (socketId) {
    io.to(userId).emit("session-revoked", {
      message: "Your session has been revoked by a security action.",
    });
  }
}

// Connect to database
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/security", securityRoutes);

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
  console.log(`✓ Socket.io ready with authenticated connections`);
  console.log(`✓ Security middleware active`);
});
