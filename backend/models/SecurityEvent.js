import mongoose from "mongoose";

const securityEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipHash: {
      type: String,
      default: null,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

securityEventSchema.index({ userId: 1, createdAt: -1 });
securityEventSchema.index({ severity: 1, isResolved: 1 });

const SecurityEvent = mongoose.model("SecurityEvent", securityEventSchema);
export default SecurityEvent;
