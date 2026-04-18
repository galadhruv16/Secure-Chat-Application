/**
 * Signature service for message attribution.
 * Generates per-user RSA key pairs, signs canonical message payloads,
 * and verifies signatures on read.
 *
 * IMPORTANT: This provides strong attribution (server-attested message origin),
 * but NOT strict legal-grade non-repudiation because the server participates
 * in key management. True non-repudiation would require user-controlled
 * hardware-backed keys.
 */

import crypto from 'crypto';
import User from '../models/User.js';
import { KEY_PAIR_OPTIONS } from '../config/security.js';

/**
 * Generate an RSA signing key pair for a user.
 * The private key is stored server-side (encrypted at rest in production).
 * @param {string} userId - The user's MongoDB ObjectId
 * @returns {Object} { publicKey, privateKey, version }
 */
export async function generateUserKeyPair(userId) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', KEY_PAIR_OPTIONS);

  const user = await User.findById(userId);
  const newVersion = (user.publicKeyVersion || 0) + 1;

  await User.findByIdAndUpdate(userId, {
    signingPublicKey: publicKey,
    signingPrivateKey: privateKey,
    publicKeyVersion: newVersion,
  });

  return { publicKey, privateKey, version: newVersion };
}

/**
 * Get the signing private key for a user.
 * @param {string} userId
 * @returns {string|null} PEM-encoded private key
 */
export async function getPrivateKey(userId) {
  const user = await User.findById(userId).select('+signingPrivateKey');
  return user?.signingPrivateKey || null;
}

/**
 * Get the signing public key for a user.
 * @param {string} userId
 * @returns {{ publicKey: string, version: number }|null}
 */
export async function getPublicKey(userId) {
  const user = await User.findById(userId);
  if (!user?.signingPublicKey) return null;
  return { publicKey: user.signingPublicKey, version: user.publicKeyVersion };
}

/**
 * Sign a canonical message string using the sender's private key.
 * @param {string} canonicalPayload - The deterministic message string to sign
 * @param {string} privateKey - PEM-encoded RSA private key
 * @returns {string} Base64-encoded signature
 */
export function signPayload(canonicalPayload, privateKey) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(canonicalPayload, 'utf8');
  signer.end();
  return signer.sign(privateKey, 'base64');
}

/**
 * Verify a message signature against the sender's public key.
 * @param {string} canonicalPayload - The deterministic message string
 * @param {string} signature - Base64-encoded signature
 * @param {string} publicKey - PEM-encoded RSA public key
 * @returns {boolean} true if signature is valid
 */
export function verifySignature(canonicalPayload, signature, publicKey) {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(canonicalPayload, 'utf8');
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
}

/**
 * Ensure a user has signing keys, generate if missing.
 * Called during registration or first authenticated action.
 * @param {string} userId
 * @returns {{ publicKey: string, version: number }}
 */
export async function ensureUserKeys(userId) {
  const existing = await getPublicKey(userId);
  if (existing) return existing;

  const { publicKey, version } = await generateUserKeyPair(userId);
  return { publicKey, version };
}

export default {
  generateUserKeyPair,
  getPrivateKey,
  getPublicKey,
  signPayload,
  verifySignature,
  ensureUserKeys,
};
