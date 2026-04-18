/**
 * Central security configuration for the Secure Chat App.
 * All security-related constants and thresholds are defined here.
 */

// Token TTLs
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
export const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '7d';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Algorithms
export const MESSAGE_HMAC_ALGO = 'sha256';
export const AUDIT_HASH_ALGO = 'sha256';
export const SIGNATURE_ALGO = 'RSA-SHA256';
export const KEY_PAIR_OPTIONS = {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
};

// Account lockout
export const MAX_FAILED_LOGINS = 5;
export const LOCK_WINDOW_MINUTES = 15;

// Anomaly detection thresholds
export const ANOMALY_THRESHOLDS = {
  maxFailedLoginsPerHour: 10,
  maxRefreshesPerMinute: 5,
  maxMessagesPerMinute: 30,
  riskScoreAutoRevoke: 80,
  riskScoreWarning: 50,
};

// Rate limiting
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 10 },        // 10 per 15 min
  refresh: { windowMs: 1 * 60 * 1000, max: 10 },        // 10 per minute
  messageSend: { windowMs: 1 * 60 * 1000, max: 60 },    // 60 per minute
  general: { windowMs: 15 * 60 * 1000, max: 100 },      // 100 per 15 min
};

// Audit event types
export const AUDIT_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  REGISTER: 'REGISTER',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_REVOKED_ALL: 'SESSION_REVOKED_ALL',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_INTEGRITY_FAILURE: 'MESSAGE_INTEGRITY_FAILURE',
  MESSAGE_SIGNATURE_FAILURE: 'MESSAGE_SIGNATURE_FAILURE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SUSPICIOUS_SESSION: 'SUSPICIOUS_SESSION',
  FORCED_LOGOUT: 'FORCED_LOGOUT',
  KEYPAIR_GENERATED: 'KEYPAIR_GENERATED',
};

export default {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  MESSAGE_HMAC_ALGO,
  AUDIT_HASH_ALGO,
  SIGNATURE_ALGO,
  KEY_PAIR_OPTIONS,
  MAX_FAILED_LOGINS,
  LOCK_WINDOW_MINUTES,
  ANOMALY_THRESHOLDS,
  RATE_LIMITS,
  AUDIT_EVENTS,
};
