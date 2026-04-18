import mongoose from "mongoose";
import bcryptjs from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // ── Security fields (new) ──────────────────────────────────
    // Asymmetric signing keys for message attribution
    signingPublicKey: {
      type: String,
      default: null,
    },
    signingPrivateKey: {
      type: String,
      select: false, // Never expose private key in queries by default
      default: null,
    },
    publicKeyVersion: {
      type: Number,
      default: 0,
    },

    // E2EE encryption public key (JWK format stored as JSON string)
    // Private key NEVER leaves the client browser
    encryptionPublicKey: {
      type: String,
      default: null,
    },

    // Account lockout
    failedLoginCount: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    // Last known access metadata (hashed for privacy)
    lastLoginIpHash: {
      type: String,
      default: null,
    },
    lastUserAgentHash: {
      type: String,
      default: null,
    },

    // Security preferences
    securityPreferences: {
      notifyOnNewDevice: { type: Boolean, default: true },
      notifyOnSuspiciousActivity: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

// Hash password before saving - bcrypt stays for passwords
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcryptjs.genSalt(10);
  this.password = await bcryptjs.hash(this.password, salt);
});

// Method to compare passwords using bcrypt
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

// Check if account is currently locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

const User = mongoose.model("User", userSchema);
export default User;
