import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    tokenFamily: {
      type: String,
      required: true,
      index: true,
    },
    ipHash: {
      type: String,
      default: null,
    },
    userAgentHash: {
      type: String,
      default: null,
    },
    deviceFingerprintHash: {
      type: String,
      default: null,
    },
    userAgentRaw: {
      type: String,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokeReason: {
      type: String,
      default: null,
    },
    isSuspicious: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Only return non-revoked, non-expired sessions by default
sessionSchema.methods.isActive = function () {
  return !this.revokedAt && this.expiresAt > new Date();
};

// TTL index to auto-delete expired sessions after 30 days
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Session = mongoose.model("Session", sessionSchema);
export default Session;
