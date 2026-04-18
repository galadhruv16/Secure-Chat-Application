/**
 * Updated auth middleware.
 * Verifies short-lived access tokens with session binding.
 * Attaches both userId and sessionId to request context.
 * Rejects revoked sessions.
 */

import { verifyAccessToken } from '../services/tokenService.js';
import { isSessionActive, touchSession } from '../services/sessionService.js';

/**
 * Primary auth middleware - requires valid access token + active session.
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized to access this route" });
  }

  try {
    const decoded = verifyAccessToken(token);

    // Attach both userId and sessionId to request
    req.user = { id: decoded.id, sessionId: decoded.sid };

    // Verify session is still active (not revoked)
    if (decoded.sid) {
      const active = await isSessionActive(decoded.sid);
      if (!active) {
        return res.status(401).json({
          success: false,
          message: "Session has been revoked or expired",
          code: "SESSION_REVOKED",
        });
      }
      // Update lastSeenAt
      await touchSession(decoded.sid);
    }

    next();
  } catch (error) {
    // Differentiate between expired and invalid tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
  }
};

/**
 * Optional auth - attaches user info if token present, but doesn't block.
 */
export const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = { id: decoded.id, sessionId: decoded.sid };
    } catch {
      // Token invalid/expired — continue without auth
    }
  }

  next();
};

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Something went wrong";

  return res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { error: err }),
  });
};
