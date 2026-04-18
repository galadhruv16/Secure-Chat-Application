/**
 * Token service for JWT access tokens and refresh tokens.
 * Replaces the old single long-lived JWT approach with
 * short-lived access token + rotatable refresh token.
 */

import jwt from 'jsonwebtoken';
import { generateSecureToken, hashToken } from './cryptoService.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from '../config/security.js';

/**
 * Generate a short-lived access token.
 * Contains userId+sessionId for identity binding.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {string} JWT access token
 */
export function generateAccessToken(userId, sessionId) {
  return jwt.sign(
    { id: userId, sid: sessionId },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

/**
 * Verify an access token.
 * @param {string} token
 * @returns {Object} decoded payload { id, sid, iat, exp }
 */
export function verifyAccessToken(token) {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
}

/**
 * Generate a cryptographically random refresh token.
 * This is NOT a JWT — it's an opaque token stored as a hash server-side.
 * @returns {string} Raw refresh token (to be sent to client)
 */
export function generateRefreshToken() {
  return generateSecureToken(40);
}

/**
 * Hash a refresh token for server-side storage.
 * We never store the raw refresh token.
 * @param {string} rawToken
 * @returns {string} SHA-256 hash
 */
export function hashRefreshToken(rawToken) {
  return hashToken(rawToken);
}

/**
 * Generate a unique token family identifier for refresh token rotation.
 * If a refresh token from a used family is replayed, the entire family is revoked.
 * @returns {string}
 */
export function generateTokenFamily() {
  return generateSecureToken(16);
}

export default {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateTokenFamily,
};
