/**
 * Security context middleware.
 * Derives request metadata (IP, user agent, fingerprint hash)
 * and attaches it to req.securityContext for downstream use.
 */

import { hashValue, createDeviceFingerprint, getClientIp, getUserAgent } from '../utils/fingerprint.js';

/**
 * Attach security context to every authenticated request.
 */
export function securityContext(req, res, next) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  req.securityContext = {
    ip,
    userAgent,
    ipHash: hashValue(ip),
    userAgentHash: hashValue(userAgent),
    deviceFingerprintHash: createDeviceFingerprint(ip, userAgent),
    userAgentRaw: userAgent.substring(0, 200), // Truncate for storage
  };

  next();
}

export default securityContext;
