/**
 * Socket.IO authentication middleware.
 * Authenticates socket handshake using access token.
 * Binds verified user identity to socket — never trust client-provided senderId.
 */

import { verifyAccessToken } from '../services/tokenService.js';
import { isSessionActive } from '../services/sessionService.js';

/**
 * Middleware to authenticate Socket.IO connections.
 * Rejects unauthenticated connections before any event handlers fire.
 */
export function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = verifyAccessToken(token);

    // Bind authenticated identity to socket
    // ALL subsequent events use this identity — never trust client senderId
    socket.userId = decoded.id;
    socket.sessionId = decoded.sid;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    return next(new Error('Authentication failed'));
  }
}

/**
 * Check if session is still valid for an already-connected socket.
 * Call this periodically or on sensitive operations.
 * @param {Object} socket
 * @returns {boolean}
 */
export async function validateSocketSession(socket) {
  if (!socket.sessionId) return false;
  return isSessionActive(socket.sessionId);
}

export default { socketAuthMiddleware, validateSocketSession };
