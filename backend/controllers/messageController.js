/**
 * Message controller - with E2EE and message security.
 * Supports both encrypted (E2EE) and plaintext messages.
 * When E2EE: the `text` field stores ciphertext; server computes HMAC on ciphertext.
 * The server NEVER sees plaintext for E2EE messages.
 */

import Message from "../models/Message.js";
import User from "../models/User.js";
import { prepareMessageSecurity, verifyMessage } from "../services/messageSecurityService.js";
import { appendAuditLog } from "../services/auditService.js";
import { AUDIT_EVENTS } from "../config/security.js";

export const sendMessage = async (req, res) => {
  try {
    const {
      receiverId,
      text,
      // E2EE fields (optional — only present for encrypted messages)
      isEncrypted,
      encryptedAESKey,
      senderEncryptedAESKey,
      e2eeIV,
    } = req.body;
    // Use authenticated user identity — never trust client-provided senderId
    const senderId = req.user.id;

    if (!receiverId || !text) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID and message text are required",
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    // Preserve deterministic conversationId
    const conversationId = [senderId, receiverId].sort().join("-");

    // Prepare message security fields (content hash, HMAC, signature)
    // For E2EE messages, this computes HMAC on the ciphertext (integrity of stored data)
    const securityFields = await prepareMessageSecurity({
      senderId,
      receiverId,
      conversationId,
      text, // This is ciphertext if E2EE, plaintext otherwise
    });

    const messageData = {
      sender: senderId,
      receiver: receiverId,
      conversationId,
      text,
      ...securityFields,
    };

    // Add E2EE fields if message is encrypted
    if (isEncrypted) {
      messageData.isEncrypted = true;
      messageData.encryptedAESKey = encryptedAESKey;
      messageData.senderEncryptedAESKey = senderEncryptedAESKey;
      messageData.e2eeIV = e2eeIV;
      messageData.encryptionAlgorithm = 'RSA-OAEP+AES-256-GCM';
    }

    const message = await Message.create(messageData);

    await message.populate("sender", "username email");

    // Realtime delivery should happen from backend after persistence succeeds.
    // This guarantees receiver delivery even if sender socket is briefly unstable.
    const io = req.app.get("io");
    if (io) {
      const realtimePayload = {
        messageId: message._id.toString(),
        senderId: senderId.toString(),
        receiverId: receiverId.toString(),
        text: message.text,
        createdAt: message.createdAt,
        timestamp: message.createdAt,
        isEncrypted: !!message.isEncrypted,
        encryptedAESKey: message.encryptedAESKey,
        senderEncryptedAESKey: message.senderEncryptedAESKey,
        e2eeIV: message.e2eeIV,
        encryptionAlgorithm: message.encryptionAlgorithm,
        verificationStatus: message.verificationStatus,
        verificationResult: message.verificationResult,
      };

      // Emit to sender and receiver rooms.
      io.to(senderId.toString()).emit("receive-message", realtimePayload);
      io.to(receiverId.toString()).emit("receive-message", realtimePayload);
      console.log(
        `✓ API persisted + emitted: ${senderId.toString()} -> ${receiverId.toString()} (${message._id.toString()})`,
      );
    }

    // Audit message send
    await appendAuditLog({
      eventType: AUDIT_EVENTS.MESSAGE_SENT,
      actorUserId: senderId,
      targetUserId: receiverId,
      messageId: message._id,
      ipHash: req.securityContext?.ipHash,
      metadata: {
        conversationId,
        hasSignature: !!securityFields.signature,
        integrityAlgorithm: securityFields.integrityAlgorithm,
        isE2EE: !!isEncrypted,
      },
      riskScore: 0,
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const conversationId = [currentUserId, userId].sort().join("-");

    const messages = await Message.find({ conversationId })
      .populate("sender", "username email")
      .populate("receiver", "username email")
      .sort({ createdAt: 1 });

    // Verify integrity and signature for each message
    const verifiedMessages = await Promise.all(
      messages.map(async (msg) => {
        const msgObj = msg.toObject();
        try {
          const verification = await verifyMessage(msg);
          msgObj.verificationResult = verification;

          // Update verification status in DB if it changed
          if (msg.verificationStatus !== verification.status) {
            await Message.findByIdAndUpdate(msg._id, {
              verificationStatus: verification.status,
              verificationCheckedAt: new Date(),
            });

            // Log verification failures
            if (verification.status === 'failed') {
              await appendAuditLog({
                eventType: verification.integrityValid
                  ? AUDIT_EVENTS.MESSAGE_SIGNATURE_FAILURE
                  : AUDIT_EVENTS.MESSAGE_INTEGRITY_FAILURE,
                actorUserId: currentUserId,
                messageId: msg._id,
                metadata: {
                  conversationId,
                  integrityValid: verification.integrityValid,
                  signatureValid: verification.signatureValid,
                  isE2EE: msg.isEncrypted,
                },
                riskScore: 40,
              });
            }
          }
        } catch (err) {
          msgObj.verificationResult = {
            integrityValid: false,
            signatureValid: false,
            status: 'error',
          };
        }
        return msgObj;
      })
    );

    res.status(200).json({
      success: true,
      data: verifiedMessages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { isRead: true },
      { new: true },
    );

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
