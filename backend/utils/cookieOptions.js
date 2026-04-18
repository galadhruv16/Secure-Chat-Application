/**
 * Environment-aware refresh cookie options.
 */

import { REFRESH_TOKEN_TTL_MS } from '../config/security.js';

/**
 * Get cookie options for the refresh token.
 * @returns {Object} Cookie configuration object
 */
export function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'strict' : 'lax'),
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
  };
}

/**
 * Get options to clear the refresh cookie.
 * @returns {Object} Cookie clear configuration
 */
export function getClearCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'strict' : 'lax'),
    path: '/api/auth',
  };
}

export default { getRefreshCookieOptions, getClearCookieOptions };
