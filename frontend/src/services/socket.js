import io from "socket.io-client";

let socket = null;

export const initSocket = () => {
  if (socket) return socket;

  socket = io("http://localhost:5000", {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("✓ Connected to Socket.io server");
  });

  socket.on("disconnect", () => {
    console.log("✗ Disconnected from Socket.io server");
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  return socket;
};

export const getSocket = () => socket;

export const joinRoom = (userId) => {
  if (socket && socket.connected) {
    socket.emit("user-join", userId);
    console.log(`✓ User ${userId} joined socket room`);
  } else {
    console.warn("Socket not connected, will try joining when ready");
    // Try again after a short delay if socket isn't connected yet
    setTimeout(() => {
      if (socket && socket.connected) {
        socket.emit("user-join", userId);
        console.log(`✓ User ${userId} joined socket room (retry)`);
      }
    }, 500);
  }
};

export const sendMessageSocket = (senderId, receiverId, text, messageId) => {
  if (socket) {
    socket.emit("send-message", {
      senderId,
      receiverId,
      text,
      messageId,
    });
  }
};

export const emitTyping = (senderId, receiverId) => {
  if (socket) {
    socket.emit("typing", { senderId, receiverId });
  }
};

export const emitStopTyping = (senderId, receiverId) => {
  if (socket) {
    socket.emit("stop-typing", { senderId, receiverId });
  }
};

export const onReceiveMessage = (callback) => {
  if (socket) {
    socket.on("receive-message", callback);
  }
};

export const onUserTyping = (callback) => {
  if (socket) {
    socket.on("user-typing", callback);
  }
};

export const onUserStopTyping = (callback) => {
  if (socket) {
    socket.on("user-stop-typing", callback);
  }
};

export const onUsersOnline = (callback) => {
  if (socket) {
    socket.on("users-online", callback);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
