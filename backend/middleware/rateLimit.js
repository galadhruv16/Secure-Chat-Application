/**
 * Rate limiting middleware.
 * Provides distinct rate limit policies for login, refresh, message send, and general routes.
 */

import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/security.js';

/**
 * Rate limiter for login attempts.
 */
export const loginLimiter = rateLimit({
  windowMs: RATE_LIMITS.login.windowMs,
  max: RATE_LIMITS.login.max,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for token refresh.
 */
export const refreshLimiter = rateLimit({
  windowMs: RATE_LIMITS.refresh.windowMs,
  max: RATE_LIMITS.refresh.max,
  message: {
    success: false,
    message: 'Too many refresh attempts. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for message sending.
 */
export const messageSendLimiter = rateLimit({
  windowMs: RATE_LIMITS.messageSend.windowMs,
  max: RATE_LIMITS.messageSend.max,
  message: {
    success: false,
    message: 'Too many messages. Please slow down.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General rate limiter for all API routes.
 */
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMITS.general.windowMs,
  max: RATE_LIMITS.general.max,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  loginLimiter,
  refreshLimiter,
  messageSendLimiter,
  generalLimiter,
};
