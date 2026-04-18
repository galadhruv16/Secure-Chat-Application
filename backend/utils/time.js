/**
 * Reusable TTL and expiry calculation utilities.
 */

/**
 * Parse a TTL string (e.g., '15m', '7d', '1h') into milliseconds.
 * @param {string} ttlString - TTL string
 * @returns {number} Milliseconds
 */
export function parseTTL(ttlString) {
  const match = ttlString.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttlString}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown TTL unit: ${unit}`);
  }
}

/**
 * Get expiry date from now + TTL string.
 * @param {string} ttlString - TTL string like '15m', '7d'
 * @returns {Date} The computed expiry date
 */
export function getExpiryDate(ttlString) {
  return new Date(Date.now() + parseTTL(ttlString));
}

/**
 * Check if a date has passed.
 * @param {Date} date
 * @returns {boolean}
 */
export function isExpired(date) {
  return new Date(date) < new Date();
}

export default { parseTTL, getExpiryDate, isExpired };
