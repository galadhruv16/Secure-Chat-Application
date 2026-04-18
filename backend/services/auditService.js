/**
 * Audit service for tamper-evident audit logging.
 * Uses chained SHA-256 hashes to create an append-only audit trail.
 * Each new entry's chainHash includes the previous entry's chainHash,
 * making retroactive tampering detectable.
 */

import AuditLog from '../models/AuditLog.js';
import { sha256 } from './cryptoService.js';

/**
 * Append an audit log entry with chain hash computation.
 * @param {Object} params
 * @param {string} params.eventType - Type of event (from AUDIT_EVENTS)
 * @param {string} [params.actorUserId] - User who performed the action
 * @param {string} [params.targetUserId] - User affected by the action
 * @param {string} [params.sessionId] - Related session
 * @param {string} [params.messageId] - Related message
 * @param {string} [params.ipHash] - Hashed IP
 * @param {string} [params.userAgentHash] - Hashed user agent
 * @param {Object} [params.metadata] - Additional event data
 * @param {number} [params.riskScore] - Risk score (0-100)
 * @returns {Object} The created audit log entry
 */
export async function appendAuditLog({
  eventType,
  actorUserId = null,
  targetUserId = null,
  sessionId = null,
  messageId = null,
  ipHash = null,
  userAgentHash = null,
  metadata = {},
  riskScore = 0,
}) {
  // Get the most recent audit log entry for chain linking
  const lastEntry = await AuditLog.findOne().sort({ createdAt: -1 }).select('chainHash');
  const previousChainHash = lastEntry?.chainHash || 'GENESIS';

  // Compute chain hash: SHA-256(previousHash + eventType + actorUserId + timestamp)
  const timestamp = new Date().toISOString();
  const chainInput = `${previousChainHash}|${eventType}|${actorUserId || 'system'}|${timestamp}|${JSON.stringify(metadata)}`;
  const chainHash = sha256(chainInput);

  const auditEntry = await AuditLog.create({
    eventType,
    actorUserId,
    targetUserId,
    sessionId,
    messageId,
    ipHash,
    userAgentHash,
    metadata,
    previousChainHash,
    chainHash,
    riskScore,
  });

  return auditEntry;
}

/**
 * Fetch recent audit logs for a user.
 * @param {string} userId
 * @param {number} limit
 * @returns {Array}
 */
export async function getUserAuditLogs(userId, limit = 50) {
  return AuditLog.find({
    $or: [{ actorUserId: userId }, { targetUserId: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(limit);
}

/**
 * Verify audit chain integrity by checking hash links.
 * @param {number} limit - Number of recent entries to verify
 * @returns {{ valid: boolean, checkedCount: number, brokenAt: string|null }}
 */
export async function verifyAuditChain(limit = 100) {
  const entries = await AuditLog.find()
    .sort({ createdAt: 1 })
    .limit(limit)
    .select('chainHash previousChainHash eventType actorUserId createdAt');

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previousChainHash !== entries[i - 1].chainHash) {
      return {
        valid: false,
        checkedCount: i,
        brokenAt: entries[i]._id.toString(),
      };
    }
  }

  return { valid: true, checkedCount: entries.length, brokenAt: null };
}

export default {
  appendAuditLog,
  getUserAuditLogs,
  verifyAuditChain,
};
