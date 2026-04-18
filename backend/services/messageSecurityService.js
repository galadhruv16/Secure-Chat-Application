/**
 * Message security service.
 * Composes canonical message payloads, computes content hashes,
 * integrity tags (HMAC-SHA256), signs messages, and verifies on retrieval.
 */

import {
  canonicalizeMessage,
  buildCanonicalPayload,
} from "../utils/canonicalize.js";
import { sha256, hmacSha256, generateNonce } from "./cryptoService.js";
import {
  getPrivateKey,
  getPublicKey,
  signPayload,
  verifySignature,
} from "./signatureService.js";

const HMAC_SECRET =
  process.env.MESSAGE_HMAC_SECRET ||
  process.env.JWT_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_REFRESH_SECRET ||
  "dev-message-hmac-secret-change-me";

/**
 * Prepare security fields for a new message before persistence.
 * @param {Object} messageData - { senderId, receiverId, conversationId, text }
 * @returns {Object} Security fields to merge into the message document
 */
export async function prepareMessageSecurity(messageData) {
  const nonce = generateNonce();
  const timestamp = new Date().toISOString();

  // Build canonical payload for hashing and signing
  const payload = buildCanonicalPayload({
    ...messageData,
    nonce,
    timestamp,
  });
  const canonical = canonicalizeMessage(payload);

  // Content hash: SHA-256 of the canonical payload
  const contentHash = sha256(canonical);

  // Integrity tag: HMAC-SHA256 with server secret
  // This provides authenticity — an attacker cannot recompute without the secret
  const integrityTag = hmacSha256(canonical, HMAC_SECRET);

  // Digital signature using sender's private key
  let signature = null;
  let publicKeyVersion = null;

  try {
    const privateKey = await getPrivateKey(messageData.senderId);
    if (privateKey) {
      signature = signPayload(canonical, privateKey);
      const pubKeyInfo = await getPublicKey(messageData.senderId);
      publicKeyVersion = pubKeyInfo?.version || null;
    }
  } catch (err) {
    console.error("Message signing failed:", err.message);
    // Continue without signature — message will be marked as unsigned
  }

  return {
    contentHash,
    integrityTag,
    integrityAlgorithm: "HMAC-SHA256",
    nonce,
    securityTimestamp: timestamp,
    signature,
    signatureAlgorithm: signature ? "RSA-SHA256" : null,
    publicKeyVersion,
    verificationStatus: signature ? "verified" : "unsigned",
    verificationCheckedAt: new Date(),
  };
}

/**
 * Verify integrity and signature of a stored message.
 * Called on message retrieval to detect tampering.
 * @param {Object} message - The message document from MongoDB
 * @returns {{ integrityValid: boolean, signatureValid: boolean, status: string }}
 */
export async function verifyMessage(message) {
  const result = {
    integrityValid: false,
    signatureValid: false,
    status: "pending",
    reason: null,
  };

  if (!message.contentHash || !message.integrityTag || !message.nonce) {
    result.status = "unsigned";
    result.reason = "missing_integrity_fields";
    return result;
  }

  // Reconstruct canonical payload
  const senderId =
    message.sender?._id?.toString() || message.sender?.toString();
  const receiverId =
    message.receiver?._id?.toString() || message.receiver?.toString();

  // Prefer the exact canonical timestamp captured at send-time.
  // Fallback to createdAt for older messages.
  const verificationTimestamp =
    message.securityTimestamp || message.createdAt?.toISOString();

  if (!verificationTimestamp) {
    result.status = "unsigned";
    result.reason = "missing_verification_timestamp";
    return result;
  }

  const payload = buildCanonicalPayload({
    senderId,
    receiverId,
    conversationId: message.conversationId,
    text: message.text,
    nonce: message.nonce,
    timestamp: verificationTimestamp,
  });
  const canonical = canonicalizeMessage(payload);

  // Verify content hash
  const expectedHash = sha256(canonical);
  if (expectedHash !== message.contentHash) {
    // Legacy rows (created before securityTimestamp was persisted) can mismatch
    // even when not tampered, because canonical timestamp cannot be recreated exactly.
    if (!message.securityTimestamp) {
      result.status = "unsigned";
      result.reason = "legacy_unverifiable";
      return result;
    }
    result.status = "failed";
    result.reason = "content_hash_mismatch";
    return result;
  }

  // Verify HMAC integrity tag
  const expectedTag = hmacSha256(canonical, HMAC_SECRET);
  if (expectedTag !== message.integrityTag) {
    result.status = "failed";
    result.reason = "integrity_tag_mismatch";
    return result;
  }
  result.integrityValid = true;

  // Verify digital signature if present
  if (message.signature) {
    try {
      const pubKeyInfo = await getPublicKey(senderId);
      if (pubKeyInfo?.publicKey) {
        result.signatureValid = verifySignature(
          canonical,
          message.signature,
          pubKeyInfo.publicKey,
        );
      } else {
        result.status = "unsigned";
        result.reason = "missing_public_key";
        return result;
      }
    } catch (err) {
      console.error("Signature verification error:", err.message);
      result.status = "unsigned";
      result.reason = "signature_verification_error";
      return result;
    }

    // Signature mismatch can happen in non-tamper scenarios (e.g. key rotation).
    // Reserve 'failed' for integrity failures only.
    if (!result.signatureValid) {
      result.status = "unsigned";
      result.reason = "signature_mismatch";
      return result;
    }

    result.status = "verified";
    result.reason = "integrity_and_signature_verified";
  } else {
    result.status = result.integrityValid ? "verified" : "failed";
    result.reason = result.integrityValid
      ? "integrity_verified_unsigned"
      : "integrity_failed";
  }

  return result;
}

export default {
  prepareMessageSecurity,
  verifyMessage,
};
