/**
 * Session controller.
 * Manages active sessions: list, revoke one, revoke all others.
 */

import {
  getUserSessions,
  revokeSession,
  revokeOtherSessions,
} from "../services/sessionService.js";
import { appendAuditLog } from "../services/auditService.js";
import { AUDIT_EVENTS } from "../config/security.js";

/**
 * List all active sessions for the current user.
 */
export const listSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;
    const sessions = await getUserSessions(userId);

    // Mark which session is the current one
    const sessionData = sessions.map((s) => ({
      id: s._id,
      isCurrent: s._id.toString() === currentSessionId,
      ipHash: s.ipHash,
      userAgentRaw: s.userAgentRaw,
      deviceFingerprintHash: s.deviceFingerprintHash,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      isSuspicious: s.isSuspicious,
    }));

    res.status(200).json({
      success: true,
      data: sessionData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Revoke a specific session.
 */
export const revokeOneSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify the session belongs to this user
    const sessions = await getUserSessions(userId);
    const targetSession = sessions.find((s) => s._id.toString() === sessionId);

    if (!targetSession) {
      return res.status(404).json({
        success: false,
        message: "Session not found or already revoked",
      });
    }

    await revokeSession(sessionId, "user_revoked");

    await appendAuditLog({
      eventType: AUDIT_EVENTS.SESSION_REVOKED,
      actorUserId: userId,
      sessionId,
      ipHash: req.securityContext?.ipHash,
      metadata: { revokedSessionId: sessionId },
      riskScore: 0,
    });

    res.status(200).json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Revoke all sessions except the current one.
 */
export const revokeAllOtherSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    const revokedCount = await revokeOtherSessions(userId, currentSessionId);

    await appendAuditLog({
      eventType: AUDIT_EVENTS.SESSION_REVOKED_ALL,
      actorUserId: userId,
      sessionId: currentSessionId,
      ipHash: req.securityContext?.ipHash,
      metadata: { revokedCount, keptSession: currentSessionId },
      riskScore: 0,
    });

    res.status(200).json({
      success: true,
      message: `Revoked ${revokedCount} other sessions`,
      revokedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
