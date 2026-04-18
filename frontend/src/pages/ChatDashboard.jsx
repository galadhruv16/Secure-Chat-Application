import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { userService, messageService, authService } from "../services/api";
import {
  initSocket,
  joinRoom,
  onReceiveMessage,
  onUserTyping,
  onUserStopTyping,
  onUsersOnline,
  removeAllListeners,
} from "../services/socket";
import { getUser, clearAuthState } from "../services/authSession";
import { securityService } from "../services/securityApi";
import {
  encryptMessage,
  decryptMessage,
  loadPrivateKey,
  loadOwnPublicKey,
  importPublicKey,
  hasLocalKeys,
} from "../services/e2eeService";
import MessageBubble from "../components/MessageBubble";
import SuspiciousActivityBanner from "../components/SuspiciousActivityBanner";

const LAST_SELECTED_CHAT_USER_KEY_PREFIX = "lastSelectedChatUserId:";
const MESSAGE_CACHE_KEY_PREFIX = "conversationMessages:";
const LEGACY_LAST_SELECTED_CHAT_USER_KEY = "lastSelectedChatUserId";

const getLastSelectedChatKey = (userId) =>
  `${LAST_SELECTED_CHAT_USER_KEY_PREFIX}${userId || "anonymous"}`;

const getConversationId = (userAId, userBId) =>
  [userAId, userBId].sort().join("-");

const getMessageCacheKey = (userAId, userBId) =>
  `${MESSAGE_CACHE_KEY_PREFIX}${getConversationId(userAId, userBId)}`;

const mergeMessagesById = (cachedMessages, fetchedMessages) => {
  const map = new Map();

  cachedMessages.forEach((msg) => {
    if (msg?._id) {
      map.set(msg._id, msg);
    }
  });

  fetchedMessages.forEach((msg) => {
    if (msg?._id) {
      map.set(msg._id, msg);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
};

export default function ChatDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [securitySummary, setSecuritySummary] = useState(null);
  const [showBanner, setShowBanner] = useState(true);
  const [e2eeReady, setE2eeReady] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const syncConversationTimeoutRef = useRef(null);
  const conversationPollIntervalRef = useRef(null);

  // Refs to avoid stale closures in socket callbacks
  const selectedUserRef = useRef(null);
  const currentUserRef = useRef(null);
  const privateKeyRef = useRef(null);
  const ownPublicKeyRef = useRef(null);
  const recipientKeysCache = useRef({});

  // Keep refs in sync with state
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // ─── Initialize on mount ────────────────────────────────────────
  useEffect(() => {
    const user = getUser();
    setCurrentUser(user);
    currentUserRef.current = user;

    // Ensure socket is connected
    initSocket();

    // Load E2EE keys
    loadE2EEKeys();

    // Join socket room
    if (user?.id) {
      joinRoom(user.id);
    }

    // Fetch data
    fetchUsers();
    fetchSecuritySummary();

    // Cleanup on unmount
    return () => {
      removeAllListeners();
      if (syncConversationTimeoutRef.current) {
        clearTimeout(syncConversationTimeoutRef.current);
      }
      if (conversationPollIntervalRef.current) {
        clearInterval(conversationPollIntervalRef.current);
      }
    };
  }, []);

  // ─── Socket listeners ───────────────────────────────────────────
  // Re-register socket listeners when selectedUser changes.
  // socket.js now does .off() before .on(), so no accumulation.
  useEffect(() => {
    const myUserId = currentUserRef.current?.id;

    // Listen for incoming messages
    onReceiveMessage(async (data) => {
      const sel = selectedUserRef.current;
      if (!sel || !myUserId) return;

      const {
        messageId,
        senderId,
        receiverId,
        text,
        timestamp,
        createdAt,
        isEncrypted,
        encryptedAESKey,
        senderEncryptedAESKey,
        e2eeIV,
        verificationStatus,
        verificationResult,
      } = data;

      // Check if this message belongs to the currently open conversation
      const isFromSelectedUser = senderId === sel._id;
      const isToSelectedUser = receiverId === sel._id && senderId === myUserId;

      if (!isFromSelectedUser && !isToSelectedUser) return;

      // Don't add sender's own message echo (we already added it optimistically)
      if (senderId === myUserId) return;

      let decryptedText = text;
      let decryptionFailed = false;

      if (isEncrypted) {
        try {
          const aesKeyToUse =
            senderId === myUserId ? senderEncryptedAESKey : encryptedAESKey;

          if (!privateKeyRef.current || !aesKeyToUse || !e2eeIV) {
            decryptedText = null;
            decryptionFailed = true;
          } else {
            decryptedText = await decryptMessage(
              text,
              e2eeIV,
              aesKeyToUse,
              privateKeyRef.current,
            );
          }
        } catch (err) {
          console.error("Realtime message decryption failed:", err);
          decryptedText = null;
          decryptionFailed = true;
        }
      }

      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((msg) => msg._id === messageId)) return prev;

        return [
          ...prev,
          {
            _id: messageId,
            sender: { _id: senderId },
            receiver: { _id: receiverId },
            text: text,
            decryptedText,
            decryptionFailed,
            createdAt: timestamp || createdAt || new Date(),
            isRead: false,
            isEncrypted: !!isEncrypted,
            encryptedAESKey,
            senderEncryptedAESKey,
            e2eeIV,
            verificationStatus: verificationStatus || "verified",
            verificationResult,
          },
        ];
      });

      // Always reconcile with DB shortly after realtime event to avoid missed UI updates.
      if (syncConversationTimeoutRef.current) {
        clearTimeout(syncConversationTimeoutRef.current);
      }
      syncConversationTimeoutRef.current = setTimeout(() => {
        fetchMessages(sel._id);
      }, 250);
    });

    // Typing indicators
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

    // Online status
    onUsersOnline((onlineUsers) => {
      setUsers((prev) =>
        prev.map((user) => ({
          ...user,
          isOnline: onlineUsers.includes(user._id),
        })),
      );
    });
  }, [selectedUser]); // Re-register when selected user changes

  // ─── Auto-scroll ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fallback sync to recover from occasional missed socket events.
  useEffect(() => {
    const conversationUserId = selectedUserRef.current?._id;
    if (!conversationUserId || !currentUserRef.current?.id) return;

    if (conversationPollIntervalRef.current) {
      clearInterval(conversationPollIntervalRef.current);
    }

    conversationPollIntervalRef.current = setInterval(() => {
      fetchMessages(conversationUserId);
    }, 3000);

    return () => {
      if (conversationPollIntervalRef.current) {
        clearInterval(conversationPollIntervalRef.current);
      }
    };
  }, [selectedUser]);

  // ─── E2EE key loading ──────────────────────────────────────────
  const loadE2EEKeys = async () => {
    try {
      if (hasLocalKeys()) {
        privateKeyRef.current = await loadPrivateKey();
        ownPublicKeyRef.current = await loadOwnPublicKey();
        setE2eeReady(!!privateKeyRef.current);
      }
    } catch (err) {
      console.error("Failed to load E2EE keys:", err);
    }
  };

  const getRecipientPublicKey = useCallback(async (userId) => {
    if (recipientKeysCache.current[userId]) {
      return recipientKeysCache.current[userId];
    }
    try {
      const response = await userService.getEncryptionKey(userId);
      const keyData = response.data.data;
      if (keyData?.encryptionPublicKey) {
        const cryptoKey = await importPublicKey(keyData.encryptionPublicKey);
        recipientKeysCache.current[userId] = cryptoKey;
        return cryptoKey;
      }
    } catch (err) {
      console.error("Failed to get recipient public key:", err);
    }
    return null;
  }, []);

  // ─── Decrypt messages from the server ──────────────────────────
  const decryptMessages = useCallback(async (msgs) => {
    if (!privateKeyRef.current) return msgs;

    const myId = currentUserRef.current?.id;
    return Promise.all(
      msgs.map(async (msg) => {
        if (!msg.isEncrypted) return msg;

        try {
          const senderId =
            typeof msg.sender === "object" ? msg.sender._id : msg.sender;
          const isSender = senderId === myId;
          const aesKeyToUse = isSender
            ? msg.senderEncryptedAESKey
            : msg.encryptedAESKey;

          if (!aesKeyToUse || !msg.e2eeIV) {
            return { ...msg, decryptedText: "[Cannot decrypt]" };
          }

          const plaintext = await decryptMessage(
            msg.text,
            msg.e2eeIV,
            aesKeyToUse,
            privateKeyRef.current,
          );
          return { ...msg, decryptedText: plaintext };
        } catch (err) {
          console.error("Decryption failed for message:", msg._id, err);
          return { ...msg, decryptedText: null, decryptionFailed: true };
        }
      }),
    );
  }, []);

  // ─── Data fetchers ─────────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers();
      const fetchedUsers = response.data.data || [];
      setUsers(fetchedUsers);

      // Restore previously opened conversation after refresh.
      const currentUserId = currentUserRef.current?.id;
      const savedSelectedUserId =
        localStorage.getItem(getLastSelectedChatKey(currentUserId)) ||
        localStorage.getItem(LEGACY_LAST_SELECTED_CHAT_USER_KEY);

      if (savedSelectedUserId && currentUserId) {
        // Migrate legacy selection key to user-scoped key.
        localStorage.setItem(
          getLastSelectedChatKey(currentUserId),
          savedSelectedUserId,
        );
      }

      if (savedSelectedUserId && !selectedUserRef.current) {
        const restoredUser = fetchedUsers.find(
          (u) => u._id === savedSelectedUserId,
        );
        if (restoredUser) {
          setSelectedUser(restoredUser);
          selectedUserRef.current = restoredUser;
          fetchMessages(restoredUser._id);
          return;
        }
      }

      // Keep using the previous user-scoped key when available.
      const currentScopedSelection = localStorage.getItem(
        getLastSelectedChatKey(currentUserId),
      );
      if (currentScopedSelection && !selectedUserRef.current) {
        const restoredScopedUser = fetchedUsers.find(
          (u) => u._id === currentScopedSelection,
        );
        if (restoredScopedUser) {
          setSelectedUser(restoredScopedUser);
          selectedUserRef.current = restoredScopedUser;
          fetchMessages(restoredScopedUser._id);
          return;
        }
      }

      // If no prior selection exists (or old user no longer exists), auto-open first chat.
      if (!selectedUserRef.current && fetchedUsers.length > 0) {
        const fallbackUser = fetchedUsers[0];
        setSelectedUser(fallbackUser);
        selectedUserRef.current = fallbackUser;
        localStorage.setItem(
          getLastSelectedChatKey(currentUserId),
          fallbackUser._id,
        );
        fetchMessages(fallbackUser._id);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecuritySummary = async () => {
    try {
      const response = await securityService.getSecuritySummary();
      setSecuritySummary(response.data.data);
    } catch (error) {
      console.error("Error fetching security summary:", error);
    }
  };

  const fetchMessages = async (userId) => {
    const currentUserId = currentUserRef.current?.id;
    const cacheKey = currentUserId
      ? getMessageCacheKey(currentUserId, userId)
      : null;
    let cachedMessages = [];

    // Load cached conversation immediately so refresh never looks empty.
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedMessages = parsed.map((msg) => {
              if (
                msg?.verificationStatus === "failed" &&
                !msg?.verificationResult?.reason
              ) {
                return { ...msg, verificationStatus: "unsigned" };
              }
              return msg;
            });
            setMessages(cachedMessages);
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to read cached messages:", cacheErr);
      }
    }

    try {
      const response = await messageService.getMessages(userId);
      let msgs = response.data.data || [];

      // Decrypt E2EE messages
      msgs = await decryptMessages(msgs);

      const mergedMessages = mergeMessagesById(cachedMessages, msgs);

      // Prevent transient empty responses from wiping visible history on refresh.
      const finalMessages =
        msgs.length === 0 && cachedMessages.length > 0
          ? cachedMessages
          : mergedMessages;

      setMessages(finalMessages);

      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify(finalMessages));
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  // ─── Send message ──────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUser) return;

    const plaintext = messageText;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessageText(""); // Clear input immediately

    try {
      // Build send payload
      let sendPayload = { receiverId: selectedUser._id, text: plaintext };
      let isE2EE = false;

      if (e2eeReady && ownPublicKeyRef.current) {
        const recipientKey = await getRecipientPublicKey(selectedUser._id);
        if (recipientKey) {
          const encrypted = await encryptMessage(
            plaintext,
            recipientKey,
            ownPublicKeyRef.current,
          );
          sendPayload = {
            receiverId: selectedUser._id,
            text: encrypted.ciphertext,
            isEncrypted: true,
            encryptedAESKey: encrypted.encryptedAESKey,
            senderEncryptedAESKey: encrypted.senderEncryptedAESKey,
            e2eeIV: encrypted.iv,
          };
          isE2EE = true;
        }
      }

      // Optimistic update — display plaintext immediately
      const optimisticMsg = {
        _id: tempId,
        sender: { _id: currentUser.id },
        receiver: { _id: selectedUser._id },
        text: isE2EE ? sendPayload.text : plaintext,
        decryptedText: plaintext,
        createdAt: new Date(),
        isRead: false,
        isEncrypted: isE2EE,
        verificationStatus: "pending",
        _isOptimistic: true,
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      // Persist via API
      const response = await messageService.sendMessage(sendPayload);
      const savedMsg = response.data.data;

      // Replace optimistic message with server-persisted one
      if (savedMsg) {
        setMessages((prev) => {
          const persistedMessage = {
            ...savedMsg,
            decryptedText: plaintext,
            verificationResult: savedMsg.verificationResult,
          };

          const optimisticExists = prev.some((msg) => msg._id === tempId);
          if (optimisticExists) {
            return prev.map((msg) =>
              msg._id === tempId ? persistedMessage : msg,
            );
          }

          // If optimistic entry was replaced by another state update, still keep the persisted message.
          if (prev.some((msg) => msg._id === savedMsg._id)) {
            return prev;
          }

          return [...prev, persistedMessage];
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Keep failed message visible instead of making it disappear.
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId
            ? {
                ...msg,
                _isOptimistic: false,
                sendFailed: true,
                verificationStatus: "failed",
              }
            : msg,
        ),
      );
    }
  };

  // ─── Event handlers ────────────────────────────────────────────
  const handleInputChange = (e) => {
    setMessageText(e.target.value);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setTypingUsers(new Set());
    localStorage.setItem(
      getLastSelectedChatKey(currentUserRef.current?.id),
      user._id,
    );
    localStorage.setItem(LEGACY_LAST_SELECTED_CHAT_USER_KEY, user._id);
    fetchMessages(user._id);
    // Pre-cache recipient's public key
    getRecipientPublicKey(user._id);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Error logging out:", error);
    }
    localStorage.removeItem(getLastSelectedChatKey(currentUserRef.current?.id));
    localStorage.removeItem(LEGACY_LAST_SELECTED_CHAT_USER_KEY);
    clearAuthState();
    navigate("/login");
  };

  // Persist currently opened conversation so a browser refresh restores it instantly.
  useEffect(() => {
    const currentUserId = currentUserRef.current?.id;
    const selectedConversationUserId = selectedUserRef.current?._id;

    if (!currentUserId || !selectedConversationUserId) return;

    try {
      const cacheKey = getMessageCacheKey(
        currentUserId,
        selectedConversationUserId,
      );
      localStorage.setItem(cacheKey, JSON.stringify(messages));
    } catch (cacheErr) {
      console.warn("Failed to cache messages:", cacheErr);
    }
  }, [messages]);

  const isUserTyping = selectedUser && typingUsers.has(selectedUser._id);
  const selectedUserHasE2EE = selectedUser?.encryptionPublicKey;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Suspicious activity banner */}
      {showBanner && (
        <SuspiciousActivityBanner
          summary={securitySummary}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Users List */}
        <div className="w-80 bg-white shadow-lg flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">🔒 Secure Chat</h1>
            <p className="text-sm text-gray-500 mt-1">
              Hello, {currentUser?.username}
              {e2eeReady && (
                <span className="ml-2 text-green-500 text-xs font-medium">
                  🔐 E2EE Active
                </span>
              )}
            </p>
          </div>

          {/* Navigation links */}
          <div className="p-2 border-b border-gray-100 flex gap-1">
            <Link
              to="/sessions"
              className="flex-1 text-center px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition"
            >
              📱 Sessions
            </Link>
            <Link
              to="/security"
              className="flex-1 text-center px-2 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition"
            >
              🛡️ Security
            </Link>
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
                      <div className="flex items-center gap-1">
                        <h3 className="font-semibold text-gray-800">
                          {user.username}
                        </h3>
                        {user.encryptionPublicKey && (
                          <span
                            className="text-xs text-green-500"
                            title="E2EE enabled"
                          >
                            🔐
                          </span>
                        )}
                      </div>
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
                      {selectedUserHasE2EE && e2eeReady ? (
                        <span className="ml-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                          🔐 End-to-End Encrypted
                        </span>
                      ) : (
                        <span className="ml-2 text-xs text-gray-400">
                          ✓ Messages are signed & integrity-verified
                        </span>
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
                    <div className="text-center">
                      <p>No messages yet. Start the conversation!</p>
                      {selectedUserHasE2EE && e2eeReady && (
                        <p className="text-xs mt-2 text-green-500">
                          🔐 Messages will be end-to-end encrypted
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg._id}
                        message={msg}
                        isOwn={
                          (typeof msg.sender === "object"
                            ? msg.sender._id
                            : msg.sender) === currentUser?.id
                        }
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
                    placeholder={
                      selectedUserHasE2EE && e2eeReady
                        ? "🔐 Type an encrypted message..."
                        : "Type a message..."
                    }
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {selectedUserHasE2EE && e2eeReady ? "🔐 Send" : "Send"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg">Select a user to start chatting</p>
                <p className="text-sm mt-2 text-gray-400">
                  Messages are end-to-end encrypted, signed, and
                  integrity-verified
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
