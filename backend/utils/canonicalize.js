/**
 * Deterministic field ordering utility for canonical message serialization.
 * Ensures consistent hash computation regardless of object key order.
 */

/**
 * Canonicalize a message payload for hashing/signing.
 * Fields are sorted alphabetically and serialized as JSON.
 * @param {Object} payload - The message fields to canonicalize
 * @returns {string} Deterministic JSON string
 */
export function canonicalizeMessage(payload) {
  const ordered = {};
  const keys = Object.keys(payload).sort();
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      ordered[key] = value;
    }
  }
  return JSON.stringify(ordered);
}

/**
 * Build the canonical payload object from message data.
 * Only includes fields relevant for integrity/signing.
 * @param {Object} messageData
 * @returns {Object} canonical payload object
 */
export function buildCanonicalPayload(messageData) {
  return {
    senderId: messageData.senderId.toString(),
    receiverId: messageData.receiverId.toString(),
    conversationId: messageData.conversationId,
    text: messageData.text,
    nonce: messageData.nonce,
    timestamp: messageData.timestamp,
  };
}

export default { canonicalizeMessage, buildCanonicalPayload };
