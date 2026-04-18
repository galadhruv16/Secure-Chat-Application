/**
 * Privacy-safe fingerprinting utilities.
 * Hashes IP, user-agent, and device metadata into privacy-safer fingerprints.
 */

import crypto from 'crypto';

/**
 * Hash a string value using SHA-256 for privacy-safe storage.
 * @param {string} value - The raw value to hash
 * @returns {string} SHA-256 hex digest
 */
export function hashValue(value) {
  if (!value) return 'unknown';
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Create a device fingerprint hash from IP and user agent.
 * @param {string} ip - Client IP address
 * @param {string} userAgent - Client user agent string
 * @returns {string} SHA-256 hex digest of combined metadata
 */
export function createDeviceFingerprint(ip, userAgent) {
  const raw = `${ip || 'unknown'}|${userAgent || 'unknown'}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Extract client IP from request, handling proxies.
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || 'unknown';
}

/**
 * Get user agent from request.
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 */
export function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

export default { hashValue, createDeviceFingerprint, getClientIp, getUserAgent };
