/**
 * Auth session management for the frontend.
 * Handles access token storage, refresh logic, and logout cleanup.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'user';

/**
 * Store access token (in memory-safe localStorage for this project).
 */
export function setAccessToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * Get current access token.
 */
export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Remove access token.
 */
export function removeAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * Store user data.
 */
export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get current user data.
 */
export function getUser() {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Full logout cleanup — clear all auth state.
 */
export function clearAuthState() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Legacy cleanup
  localStorage.removeItem('token');
  // Note: E2EE keys are intentionally NOT cleared here
  // They are tied to the user's identity and should persist
  // across re-login on the same device
}

/**
 * Check if user is authenticated (has an access token).
 */
export function isAuthenticated() {
  return !!getAccessToken();
}

export default {
  setAccessToken,
  getAccessToken,
  removeAccessToken,
  setUser,
  getUser,
  clearAuthState,
  isAuthenticated,
};
