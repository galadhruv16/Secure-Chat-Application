/**
 * Anomaly detection and risk scoring service.
 * Detects suspicious login patterns, session abuse, brute force attempts,
 * and anomalous token usage. Triggers session revocation or account lockout
 * when thresholds are exceeded.
 */

import User from '../models/User.js';
import Session from '../models/Session.js';
import SecurityEvent from '../models/SecurityEvent.js';
import { ANOMALY_THRESHOLDS, MAX_FAILED_LOGINS, LOCK_WINDOW_MINUTES, AUDIT_EVENTS } from '../config/security.js';
import { appendAuditLog } from './auditService.js';
import { revokeSession } from './sessionService.js';

/**
 * Record a failed login attempt and check for account lockout.
 * @param {string} userId
 * @param {Object} securityContext - { ipHash, userAgentHash }
 * @returns {{ locked: boolean, remainingAttempts: number }}
 */
export async function recordFailedLogin(userId, securityContext = {}) {
  const user = await User.findById(userId);
  if (!user) return { locked: false, remainingAttempts: MAX_FAILED_LOGINS };

  const newCount = (user.failedLoginCount || 0) + 1;
  const updates = { failedLoginCount: newCount };

  if (newCount >= MAX_FAILED_LOGINS) {
    updates.lockUntil = new Date(Date.now() + LOCK_WINDOW_MINUTES * 60 * 1000);

    // Log account lockout
    await appendAuditLog({
      eventType: AUDIT_EVENTS.ACCOUNT_LOCKED,
      actorUserId: userId,
      targetUserId: userId,
      ipHash: securityContext.ipHash,
      userAgentHash: securityContext.userAgentHash,
      metadata: { failedAttempts: newCount, lockMinutes: LOCK_WINDOW_MINUTES },
      riskScore: 70,
    });

    // Create user-visible security event
    await SecurityEvent.create({
      userId,
      eventType: AUDIT_EVENTS.ACCOUNT_LOCKED,
      severity: 'high',
      description: `Account locked after ${newCount} failed login attempts. Locked for ${LOCK_WINDOW_MINUTES} minutes.`,
      ipHash: securityContext.ipHash,
    });

    return { locked: true, remainingAttempts: 0 };
  }

  await User.findByIdAndUpdate(userId, updates);
  return { locked: false, remainingAttempts: MAX_FAILED_LOGINS - newCount };
}

/**
 * Reset failed login counter on successful login.
 * @param {string} userId
 */
export async function resetFailedLogins(userId) {
  await User.findByIdAndUpdate(userId, {
    failedLoginCount: 0,
    lockUntil: null,
  });
}

/**
 * Calculate risk score for a login attempt based on context changes.
 * @param {string} userId
 * @param {Object} securityContext - { ipHash, userAgentHash }
 * @returns {number} Risk score 0-100
 */
export async function calculateLoginRisk(userId, securityContext) {
  const user = await User.findById(userId);
  if (!user) return 0;

  let riskScore = 0;

  // New IP detected
  if (user.lastLoginIpHash && user.lastLoginIpHash !== securityContext.ipHash) {
    riskScore += 30;
  }

  // New user agent detected
  if (user.lastUserAgentHash && user.lastUserAgentHash !== securityContext.userAgentHash) {
    riskScore += 20;
  }

  // Recently locked account
  if (user.lockUntil && user.lockUntil > new Date(Date.now() - 60 * 60 * 1000)) {
    riskScore += 25;
  }

  // High failed login count (even if not yet locked)
  if (user.failedLoginCount > 2) {
    riskScore += user.failedLoginCount * 5;
  }

  return Math.min(riskScore, 100);
}

/**
 * Check if a session shows suspicious behavior (IP/UA change mid-session).
 * @param {string} sessionId
 * @param {Object} currentContext - { ipHash, userAgentHash }
 * @returns {{ suspicious: boolean, reasons: string[] }}
 */
export async function detectSessionAnomaly(sessionId, currentContext) {
  const session = await Session.findById(sessionId);
  if (!session) return { suspicious: false, reasons: [] };

  const reasons = [];

  if (session.ipHash && session.ipHash !== currentContext.ipHash) {
    reasons.push('IP address changed mid-session');
  }

  if (session.userAgentHash && session.userAgentHash !== currentContext.userAgentHash) {
    reasons.push('User agent changed mid-session');
  }

  const suspicious = reasons.length > 0;

  if (suspicious) {
    await Session.findByIdAndUpdate(sessionId, { isSuspicious: true });

    await SecurityEvent.create({
      userId: session.userId,
      eventType: AUDIT_EVENTS.SUSPICIOUS_SESSION,
      severity: reasons.length >= 2 ? 'high' : 'medium',
      description: `Suspicious session activity detected: ${reasons.join(', ')}`,
      metadata: { sessionId, reasons },
      ipHash: currentContext.ipHash,
    });

    // Auto-revoke if risk score exceeds threshold
    if (reasons.length >= 2) {
      await revokeSession(sessionId, 'auto_revoked_suspicious');
      await appendAuditLog({
        eventType: AUDIT_EVENTS.SESSION_REVOKED,
        actorUserId: session.userId,
        sessionId,
        metadata: { reason: 'auto_revoked_suspicious', anomalies: reasons },
        riskScore: ANOMALY_THRESHOLDS.riskScoreAutoRevoke,
      });
    }
  }

  return { suspicious, reasons };
}

/**
 * Get recent security events for a user.
 * @param {string} userId
 * @param {number} limit
 * @returns {Array}
 */
export async function getRecentSecurityEvents(userId, limit = 20) {
  return SecurityEvent.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

/**
 * Get security summary for a user.
 * @param {string} userId
 * @returns {Object}
 */
export async function getSecuritySummary(userId) {
  const [
    activeSessions,
    suspiciousSessions,
    recentEvents,
    unresolvedEvents,
  ] = await Promise.all([
    Session.countDocuments({ userId, revokedAt: null, expiresAt: { $gt: new Date() } }),
    Session.countDocuments({ userId, isSuspicious: true, revokedAt: null }),
    SecurityEvent.countDocuments({
      userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    SecurityEvent.countDocuments({ userId, isResolved: false }),
  ]);

  const user = await User.findById(userId).select('failedLoginCount lockUntil lastLoginIpHash');

  return {
    activeSessions,
    suspiciousSessions,
    recentEventsLast24h: recentEvents,
    unresolvedEvents,
    isAccountLocked: user?.isLocked() || false,
    failedLoginCount: user?.failedLoginCount || 0,
  };
}

export default {
  recordFailedLogin,
  resetFailedLogins,
  calculateLoginRisk,
  detectSessionAnomaly,
  getRecentSecurityEvents,
  getSecuritySummary,
};
