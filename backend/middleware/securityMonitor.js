/**
 * Security monitor middleware.
 * Hooks to emit audit/security events on auth failures,
 * forbidden access, and verification anomalies.
 */

import { appendAuditLog } from '../services/auditService.js';
import { detectSessionAnomaly } from '../services/anomalyService.js';
import { AUDIT_EVENTS } from '../config/security.js';

/**
 * Monitor middleware that checks for session anomalies on each request.
 * Applied after auth middleware.
 */
export async function securityMonitor(req, res, next) {
  try {
    // Only check for authenticated requests
    if (req.user?.sessionId && req.securityContext) {
      const { suspicious, reasons } = await detectSessionAnomaly(
        req.user.sessionId,
        req.securityContext
      );

      if (suspicious) {
        // Attach warning to response headers for frontend awareness
        res.setHeader('X-Security-Warning', 'suspicious-session');

        // If session was auto-revoked, return 401
        if (reasons.length >= 2) {
          return res.status(401).json({
            success: false,
            message: 'Session revoked due to suspicious activity',
            code: 'SESSION_REVOKED',
          });
        }
      }
    }
  } catch (error) {
    console.error('Security monitor error:', error.message);
    // Don't block the request on monitoring errors
  }

  next();
}

/**
 * Log an audit event for a 401/403 response.
 * Can be used as error-handler middleware.
 */
export function auditFailedAccess(req, res, next) {
  // Hook into response finish to log failed access attempts
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      appendAuditLog({
        eventType: res.statusCode === 401 ? 'UNAUTHORIZED_ACCESS' : 'FORBIDDEN_ACCESS',
        actorUserId: req.user?.id || null,
        ipHash: req.securityContext?.ipHash,
        userAgentHash: req.securityContext?.userAgentHash,
        metadata: {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
        },
        riskScore: 20,
      }).catch((err) => console.error('Audit log failed:', err.message));
    }
    return originalJson(body);
  };

  next();
}

export default { securityMonitor, auditFailedAccess };
