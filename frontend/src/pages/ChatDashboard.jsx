import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { userService, messageService, authService } from "../services/api";
import {
  joinRoom,
  sendMessageSocket,
  onReceiveMessage,
  onUserTyping,
  onUserStopTyping,
  onUsersOnline,
} from "../services/socket";
import MessageBubble from "../components/MessageBubble";

export default function ChatDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Initialize on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setCurrentUser(user);
    console.log("Current user:", user);

    // Join socket room with user ID after a brief delay to ensure connection
    if (user?.id) {
      const timer = setTimeout(() => {
        joinRoom(user.id);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Separate effect to fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  // Listen for real-time messages
  useEffect(() => {
    onReceiveMessage((data) => {
      // Add received messages only if from the selected user (not sender's own optimistic update)
      if (selectedUser && data.senderId === selectedUser._id) {
        setMessages((prev) => {
          // Check if message already exists to avoid duplicates
          const messageExists = prev.some((msg) => msg._id === data.messageId);
          if (messageExists) return prev;

          return [
            ...prev,
            {
              _id: data.messageId,
              sender: { _id: data.senderId },
              receiver: { _id: data.receiverId },
              text: data.text,
              createdAt: data.timestamp,
              isRead: false,
            },
          ];
        });
      }
    });

    onUserTyping((data) => {
      setTypingUsers((prev) => new Set([...prev, data.senderId]));
    });

    onUserStopTyping((data) => {
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(data.senderId);
        return updated;
      });
    });

    onUsersOnline((onlineUsers) => {
      setUsers((prev) =>
        prev.map((user) => ({
          ...user,
          isOnline: onlineUsers.includes(user._id),
        })),
      );
    });
  }, [selectedUser]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log("Fetching users...");
      const response = await userService.getAllUsers();
      console.log("Users fetched:", response.data.data);
      setUsers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert(
        "Error loading users: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await messageService.getMessages(userId);
      setMessages(response.data.data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUser) return;

    const messageId = Date.now().toString();
    const text = messageText;

    try {
      // Send through socket for real-time delivery
      sendMessageSocket(currentUser.id, selectedUser._id, text, messageId);

      // Immediately add to sender's UI (optimistic update)
      const newMessage = {
        _id: messageId,
        sender: { _id: currentUser.id },
        receiver: { _id: selectedUser._id },
        text: text,
        createdAt: new Date(),
        isRead: false,
      };
      setMessages((prev) => [...prev, newMessage]);

      // Also save to database
      await messageService.sendMessage({
        receiverId: selectedUser._id,
        text: text,
      });

      setMessageText("");
      setTypingUsers(new Set()); // Clear typing indicator

      // Fetch fresh messages to sync with database
      setTimeout(() => {
        fetchMessages(selectedUser._id);
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleInputChange = (e) => {
    setMessageText(e.target.value);

    // Emit typing event
    if (selectedUser && currentUser) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Emit typing (implementation would go here)
      // emitTyping(currentUser.id, selectedUser._id);

      // Set timeout to stop typing after 1 second of no input
      typingTimeoutRef.current = setTimeout(() => {
        // emitStopTyping(currentUser.id, selectedUser._id);
      }, 1000);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setTypingUsers(new Set());
    setMessages([]); // Clear messages while loading
    fetchMessages(user._id);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const isUserTyping = selectedUser && typingUsers.has(selectedUser._id);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Users List */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">Secure Chat</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hello, {currentUser?.username}
          </p>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No users available
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user._id}
                onClick={() => handleSelectUser(user)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition ${
                  selectedUser?._id === user._id
                    ? "bg-blue-50 border-l-4 border-blue-500"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">
                      {user.username}
                    </h3>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ml-2 ${
                      user.isOnline ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 text-white font-semibold py-2 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedUser.username}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedUser.isOnline ? (
                      <span className="text-green-600 font-semibold">
                        🟢 Online
                      </span>
                    ) : (
                      "Offline"
                    )}
                  </p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full ${
                    selectedUser.isOnline ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg._id}
                      message={msg}
                      isOwn={msg.sender._id === currentUser?.id}
                    />
                  ))}
                  {isUserTyping && (
                    <div className="flex items-center space-x-2 text-gray-500">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                      </div>
                      <span className="text-sm">
                        {selectedUser?.username} is typing...
                      </span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-6 border-t border-gray-200"
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a user to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
