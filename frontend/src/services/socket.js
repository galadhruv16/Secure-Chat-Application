/**
 * Socket.IO service with proper listener management.
 * - Authenticated handshake using access token
 * - Proper .off() before .on() to prevent listener accumulation
 * - Session-revoked forced logout
 */

import io from "socket.io-client";
import { getAccessToken, setAccessToken, clearAuthState } from "./authSession";

let socket = null;
let refreshInProgress = false;

const SOCKET_URL = "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const isAuthConnectError = (message = "") => {
  const normalized = message.toLowerCase();
  return normalized.includes("token expired")
    || normalized.includes("authentication failed")
    || normalized.includes("authentication required");
};

const refreshSocketAccessToken = async () => {
  if (refreshInProgress) return false;
  refreshInProgress = true;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Refresh failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data?.accessToken) {
      throw new Error("Refresh response missing access token");
    }

    setAccessToken(data.accessToken);
    return true;
  } catch (error) {
    console.error("Socket token refresh failed:", error.message);
    return false;
  } finally {
    refreshInProgress = false;
  }
};

export const initSocket = () => {
  const token = getAccessToken();
  if (!token) return null;

  // Reuse existing socket when possible, but force reconnect if it is stale.
  if (socket) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    // Resolve token at each (re)connect so socket uses the latest rotated token.
    auth: (cb) => {
      cb({ token: getAccessToken() });
    },
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log("✓ Connected to Socket.io server (authenticated)");
  });

  socket.on("disconnect", () => {
    console.log("✗ Disconnected from Socket.io server");
  });

  socket.on("connect_error", async (error) => {
    console.error("Socket connection error:", error.message);

    // If reconnect fails due to auth token expiry, refresh once and reconnect.
    if (isAuthConnectError(error.message)) {
      const refreshed = await refreshSocketAccessToken();
      if (refreshed && socket && !socket.connected) {
        socket.connect();
        return;
      }

      clearAuthState();
      window.location.href = "/login?reason=session-revoked";
    }
  });

  // Handle forced logout from server (session revoked)
  socket.on("session-revoked", (data) => {
    console.warn("Session revoked:", data.message);
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    clearAuthState();
    window.location.href = "/login?reason=session-revoked";
  });

  return socket;
};

export const getSocket = () => socket;

export const joinRoom = (userId) => {
  if (!socket) return;
  if (socket.connected) {
    socket.emit("user-join", userId);
  } else {
    socket.once("connect", () => {
      socket.emit("user-join", userId);
    });
  }
};

export const sendMessageSocket = (payload) => {
  if (socket?.connected) {
    socket.emit("send-message", payload);
  }
};

export const emitTyping = (senderId, receiverId) => {
  if (socket?.connected) {
    socket.emit("typing", { senderId, receiverId });
  }
};

export const emitStopTyping = (senderId, receiverId) => {
  if (socket?.connected) {
    socket.emit("stop-typing", { senderId, receiverId });
  }
};

/**
 * Register a listener for receive-message events.
 * Properly removes old listener before adding new one to prevent accumulation.
 */
export const onReceiveMessage = (callback) => {
  if (!socket) {
    initSocket();
  }
  if (!socket) return;
  socket.off("receive-message"); // Remove ALL previous listeners
  socket.on("receive-message", callback);
};

export const onUserTyping = (callback) => {
  if (!socket) {
    initSocket();
  }
  if (!socket) return;
  socket.off("user-typing");
  socket.on("user-typing", callback);
};

export const onUserStopTyping = (callback) => {
  if (!socket) {
    initSocket();
  }
  if (!socket) return;
  socket.off("user-stop-typing");
  socket.on("user-stop-typing", callback);
};

export const onUsersOnline = (callback) => {
  if (!socket) {
    initSocket();
  }
  if (!socket) return;
  socket.off("users-online");
  socket.on("users-online", callback);
};

/**
 * Remove all custom event listeners (cleanup on unmount).
 */
export const removeAllListeners = () => {
  if (!socket) return;
  socket.off("receive-message");
  socket.off("user-typing");
  socket.off("user-stop-typing");
  socket.off("users-online");
};

export const reconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return initSocket();
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
