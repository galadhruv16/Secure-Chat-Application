/**
 * Session management service.
 * Handles session create/rotate/revoke logic, current-session validation,
 * and multi-device management.
 */

import Session from '../models/Session.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  generateTokenFamily,
  generateAccessToken,
} from './tokenService.js';
import { getExpiryDate } from '../utils/time.js';
import { REFRESH_TOKEN_TTL } from '../config/security.js';

/**
 * Create a new session with a fresh refresh token.
 * @param {string} userId
 * @param {Object} securityContext - { ipHash, userAgentHash, deviceFingerprintHash, userAgentRaw }
 * @returns {{ session, rawRefreshToken, accessToken }}
 */
export async function createSession(userId, securityContext = {}) {
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const tokenFamily = generateTokenFamily();
  const expiresAt = getExpiryDate(REFRESH_TOKEN_TTL);

  const session = await Session.create({
    userId,
    refreshTokenHash,
    tokenFamily,
    ipHash: securityContext.ipHash || null,
    userAgentHash: securityContext.userAgentHash || null,
    deviceFingerprintHash: securityContext.deviceFingerprintHash || null,
    userAgentRaw: securityContext.userAgentRaw || null,
    expiresAt,
    lastSeenAt: new Date(),
  });

  const accessToken = generateAccessToken(userId, session._id.toString());

  return { session, rawRefreshToken, accessToken };
}

/**
 * Rotate a refresh token — issue a new one and invalidate the old.
 * If the old token has already been used (replay detected), revoke the entire family.
 * @param {string} rawRefreshToken - The raw refresh token from the client
 * @param {Object} securityContext
 * @returns {{ session, rawRefreshToken, accessToken } | null}
 */
export async function rotateSession(rawRefreshToken, securityContext = {}) {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  // Find the session with this refresh token
  const existingSession = await Session.findOne({ refreshTokenHash: tokenHash });

  if (!existingSession) {
    // Token not found — could be a replay of an already-rotated token.
    // Attempt to find the token family and revoke all sessions in it.
    // This is a security measure: if someone replays an old token,
    // we revoke the entire family to protect the user.
    return null;
  }

  // Check if session is active
  if (existingSession.revokedAt || existingSession.expiresAt < new Date()) {
    // Session already revoked or expired — possible replay attack
    // Revoke all sessions in this token family
    await Session.updateMany(
      { tokenFamily: existingSession.tokenFamily, revokedAt: null },
      { revokedAt: new Date(), revokeReason: 'token_replay_detected' }
    );
    return null;
  }

  // Issue new refresh token
  const newRawRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRawRefreshToken);
  const newExpiresAt = getExpiryDate(REFRESH_TOKEN_TTL);

  // Update existing session with new token (rotation)
  existingSession.refreshTokenHash = newRefreshTokenHash;
  existingSession.expiresAt = newExpiresAt;
  existingSession.lastSeenAt = new Date();
  existingSession.ipHash = securityContext.ipHash || existingSession.ipHash;
  existingSession.userAgentHash = securityContext.userAgentHash || existingSession.userAgentHash;
  await existingSession.save();

  const accessToken = generateAccessToken(
    existingSession.userId.toString(),
    existingSession._id.toString()
  );

  return { session: existingSession, rawRefreshToken: newRawRefreshToken, accessToken };
}

/**
 * Revoke a specific session.
 * @param {string} sessionId
 * @param {string} reason
 * @returns {Object|null} Updated session
 */
export async function revokeSession(sessionId, reason = 'user_revoked') {
  return Session.findByIdAndUpdate(
    sessionId,
    { revokedAt: new Date(), revokeReason: reason },
    { new: true }
  );
}

/**
 * Revoke all sessions for a user except the current one.
 * @param {string} userId
 * @param {string} exceptSessionId - The current session to keep
 * @returns {number} Number of sessions revoked
 */
export async function revokeOtherSessions(userId, exceptSessionId) {
  const result = await Session.updateMany(
    {
      userId,
      _id: { $ne: exceptSessionId },
      revokedAt: null,
    },
    { revokedAt: new Date(), revokeReason: 'user_revoked_all_others' }
  );
  return result.modifiedCount;
}

/**
 * Revoke ALL sessions for a user (logout everywhere).
 * @param {string} userId
 * @returns {number} Number of sessions revoked
 */
export async function revokeAllSessions(userId) {
  const result = await Session.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date(), revokeReason: 'user_logout_all' }
  );
  return result.modifiedCount;
}

/**
 * Get all active sessions for a user.
 * @param {string} userId
 * @returns {Array} Active sessions
 */
export async function getUserSessions(userId) {
  return Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ lastSeenAt: -1 });
}

/**
 * Validate that a session is still active.
 * @param {string} sessionId
 * @returns {boolean}
 */
export async function isSessionActive(sessionId) {
  const session = await Session.findById(sessionId);
  return session ? session.isActive() : false;
}

/**
 * Update session's lastSeenAt timestamp.
 * @param {string} sessionId
 */
export async function touchSession(sessionId) {
  await Session.findByIdAndUpdate(sessionId, { lastSeenAt: new Date() });
}

/**
 * Mark session as suspicious.
 * @param {string} sessionId
 * @param {boolean} isSuspicious
 */
export async function markSessionSuspicious(sessionId, isSuspicious = true) {
  await Session.findByIdAndUpdate(sessionId, { isSuspicious });
}

export default {
  createSession,
  rotateSession,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  getUserSessions,
  isSessionActive,
  touchSession,
  markSessionSuspicious,
};
