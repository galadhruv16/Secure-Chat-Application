import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: [true, "Message cannot be empty"],
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },

    // ── E2EE fields ────────────────────────────────────────────
    // When isEncrypted=true, `text` contains the Base64 ciphertext
    encryptedAESKey: {
      type: String,
      default: null,
    },
    senderEncryptedAESKey: {
      type: String,
      default: null,
    },
    e2eeIV: {
      type: String,
      default: null,
    },
    encryptionAlgorithm: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },

    // ── Message integrity fields (new) ─────────────────────────
    contentHash: {
      type: String,
      default: null,
    },
    integrityTag: {
      type: String,
      default: null,
    },
    integrityAlgorithm: {
      type: String,
      default: "HMAC-SHA256",
    },
    nonce: {
      type: String,
      default: null,
    },
    // Exact ISO timestamp used during canonical hash/sign generation
    securityTimestamp: {
      type: String,
      default: null,
    },

    // ── Digital signature fields (new) ─────────────────────────
    signature: {
      type: String,
      default: null,
    },
    signatureAlgorithm: {
      type: String,
      default: "RSA-SHA256",
    },
    publicKeyVersion: {
      type: Number,
      default: null,
    },

    // ── Verification status (new) ──────────────────────────────
    verificationStatus: {
      type: String,
      enum: ["verified", "failed", "pending", "unsigned"],
      default: "pending",
    },
    verificationCheckedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Index for faster queries
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
