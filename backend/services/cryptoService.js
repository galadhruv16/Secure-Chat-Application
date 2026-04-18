/**
 * Cryptographic service layer.
 * Owns SHA-256 digests, HMAC helpers, and nonce generation.
 * NOTE: bcrypt stays for passwords - this service is for message/token/audit hashing only.
 */

import crypto from 'crypto';
import { MESSAGE_HMAC_ALGO } from '../config/security.js';

/**
 * Compute SHA-256 hash of a string.
 * @param {string} data
 * @returns {string} hex digest
 */
export function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Compute HMAC-SHA256 of data with a secret key.
 * This provides authenticity (not just integrity) because an attacker
 * cannot recompute the tag without the secret.
 * @param {string} data - The data to authenticate
 * @param {string} secret - The HMAC secret key
 * @returns {string} hex HMAC digest
 */
export function hmacSha256(data, secret) {
  return crypto
    .createHmac(MESSAGE_HMAC_ALGO, secret)
    .update(data, 'utf8')
    .digest('hex');
}

/**
 * Generate a cryptographically secure random nonce.
 * @param {number} bytes - Number of random bytes (default 16)
 * @returns {string} hex-encoded nonce
 */
export function generateNonce(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a cryptographically secure random token string.
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} hex-encoded token
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a token for secure server-side storage.
 * We store only the hash, never the raw token.
 * @param {string} token - The raw token
 * @returns {string} SHA-256 hex hash
 */
export function hashToken(token) {
  return sha256(token);
}

export default {
  sha256,
  hmacSha256,
  generateNonce,
  generateSecureToken,
  hashToken,
};
