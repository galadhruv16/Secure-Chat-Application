/**
 * Safe auth/session storage abstraction.
 */

export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('localStorage remove failed:', e);
  }
}

export function safeParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

export default { safeGetItem, safeSetItem, safeRemoveItem, safeParse };
