/**
 * End-to-End Encryption Service using Web Crypto API.
 * 
 * Architecture:
 * - Each user generates an RSA-OAEP key pair for encryption (separate from signing keys)
 * - Public encryption keys are stored on the server; private keys stay in the browser
 * - Hybrid encryption: AES-256-GCM for message body, RSA-OAEP to wrap the AES key
 * - The server NEVER sees plaintext messages
 * 
 * Flow (sending):
 *   1. Generate random AES-256-GCM key
 *   2. Encrypt plaintext with AES-GCM → ciphertext + IV + authTag
 *   3. Export AES key as raw bytes
 *   4. Encrypt AES key with recipient's RSA-OAEP public key → encryptedAESKey
 *   5. Also encrypt AES key with sender's own public key → senderEncryptedAESKey  
 *      (so sender can also decrypt their own sent messages)
 *   6. Send { ciphertext, iv, encryptedAESKey, senderEncryptedAESKey } to server
 * 
 * Flow (receiving):
 *   1. Decrypt AES key using own RSA-OAEP private key
 *   2. Decrypt ciphertext with AES-GCM key + IV → plaintext
 */

const E2EE_PRIVATE_KEY = 'e2ee_privateKey';
const E2EE_PUBLIC_KEY = 'e2ee_publicKey';

// ─── Key Generation ───────────────────────────────────────────────

/**
 * Generate an RSA-OAEP key pair for E2EE.
 * @returns {{ publicKey: CryptoKey, privateKey: CryptoKey }}
 */
export async function generateEncryptionKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  return keyPair;
}

/**
 * Export a public key to JWK format for server storage.
 * @param {CryptoKey} publicKey
 * @returns {Object} JWK
 */
export async function exportPublicKey(publicKey) {
  return window.crypto.subtle.exportKey('jwk', publicKey);
}

/**
 * Export a private key to JWK format for local storage.
 * @param {CryptoKey} privateKey
 * @returns {Object} JWK
 */
export async function exportPrivateKey(privateKey) {
  return window.crypto.subtle.exportKey('jwk', privateKey);
}

/**
 * Import a public key from JWK format.
 * @param {Object} jwk
 * @returns {CryptoKey}
 */
export async function importPublicKey(jwk) {
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

/**
 * Import a private key from JWK format.
 * @param {Object} jwk
 * @returns {CryptoKey}
 */
export async function importPrivateKey(jwk) {
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

// ─── Local Key Storage ────────────────────────────────────────────

/**
 * Store the encryption private key in localStorage (JWK format).
 * In production, consider IndexedDB or a more secure storage mechanism.
 */
export async function storePrivateKey(privateKey) {
  const jwk = await exportPrivateKey(privateKey);
  localStorage.setItem(E2EE_PRIVATE_KEY, JSON.stringify(jwk));
}

/**
 * Store the encryption public key in localStorage (JWK format).
 */
export async function storePublicKeyLocally(publicKey) {
  const jwk = await exportPublicKey(publicKey);
  localStorage.setItem(E2EE_PUBLIC_KEY, JSON.stringify(jwk));
}

/**
 * Load the encryption private key from localStorage.
 * @returns {CryptoKey|null}
 */
export async function loadPrivateKey() {
  try {
    const jwkStr = localStorage.getItem(E2EE_PRIVATE_KEY);
    if (!jwkStr) return null;
    const jwk = JSON.parse(jwkStr);
    return importPrivateKey(jwk);
  } catch (err) {
    console.error('Failed to load E2EE private key:', err);
    return null;
  }
}

/**
 * Load own public key from localStorage.
 * @returns {CryptoKey|null}
 */
export async function loadOwnPublicKey() {
  try {
    const jwkStr = localStorage.getItem(E2EE_PUBLIC_KEY);
    if (!jwkStr) return null;
    const jwk = JSON.parse(jwkStr);
    return importPublicKey(jwk);
  } catch (err) {
    console.error('Failed to load own E2EE public key:', err);
    return null;
  }
}

/**
 * Check if E2EE keys exist locally.
 */
export function hasLocalKeys() {
  return !!localStorage.getItem(E2EE_PRIVATE_KEY);
}

/**
 * Clear E2EE keys from localStorage.
 */
export function clearE2EEKeys() {
  localStorage.removeItem(E2EE_PRIVATE_KEY);
  localStorage.removeItem(E2EE_PUBLIC_KEY);
}

// ─── Key Bootstrap ────────────────────────────────────────────────

/**
 * Full key bootstrap: generate, store locally, and upload public key to server.
 * @param {Function} uploadFn - async function(jwk) that uploads public key to server
 * @returns {{ publicKeyJwk: Object }}
 */
export async function bootstrapE2EEKeys(uploadFn) {
  const keyPair = await generateEncryptionKeyPair();
  
  // Store private key locally (never leaves the browser)
  await storePrivateKey(keyPair.privateKey);
  await storePublicKeyLocally(keyPair.publicKey);
  
  // Export and upload public key to server
  const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
  await uploadFn(publicKeyJwk);
  
  return { publicKeyJwk };
}

// ─── Encryption ───────────────────────────────────────────────────

/**
 * Encrypt a message for a recipient using hybrid RSA+AES encryption.
 * 
 * @param {string} plaintext - The message text
 * @param {CryptoKey} recipientPublicKey - Recipient's RSA-OAEP public key
 * @param {CryptoKey} senderPublicKey - Sender's own RSA-OAEP public key (for self-decryption)
 * @returns {{ ciphertext: string, iv: string, encryptedAESKey: string, senderEncryptedAESKey: string }}
 */
export async function encryptMessage(plaintext, recipientPublicKey, senderPublicKey) {
  // 1. Generate random AES-256-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Generate random IV (12 bytes for AES-GCM)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt plaintext with AES-GCM
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBytes
  );

  // 4. Export AES key as raw bytes
  const rawAESKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 5. Encrypt AES key with recipient's RSA public key
  const encryptedAESKeyBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    rawAESKey
  );

  // 6. Encrypt AES key with sender's own public key (so sender can read their own messages)
  const senderEncryptedAESKeyBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    senderPublicKey,
    rawAESKey
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    encryptedAESKey: arrayBufferToBase64(encryptedAESKeyBuffer),
    senderEncryptedAESKey: arrayBufferToBase64(senderEncryptedAESKeyBuffer),
  };
}

/**
 * Decrypt a message using own private key.
 * 
 * @param {string} ciphertextB64 - Base64 encoded ciphertext
 * @param {string} ivB64 - Base64 encoded IV
 * @param {string} encryptedAESKeyB64 - Base64 encoded encrypted AES key
 * @param {CryptoKey} privateKey - Own RSA-OAEP private key
 * @returns {string} Decrypted plaintext
 */
export async function decryptMessage(ciphertextB64, ivB64, encryptedAESKeyB64, privateKey) {
  // 1. Decrypt the AES key with our RSA private key
  const encryptedAESKeyBuffer = base64ToArrayBuffer(encryptedAESKeyB64);
  const rawAESKey = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedAESKeyBuffer
  );

  // 2. Import the AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    rawAESKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt the ciphertext
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextB64);
  const iv = base64ToArrayBuffer(ivB64);
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertextBuffer
  );

  // 4. Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBuffer);
}

// ─── Utility Functions ────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export default {
  generateEncryptionKeyPair,
  exportPublicKey,
  importPublicKey,
  bootstrapE2EEKeys,
  storePrivateKey,
  loadPrivateKey,
  loadOwnPublicKey,
  hasLocalKeys,
  clearE2EEKeys,
  encryptMessage,
  decryptMessage,
};
