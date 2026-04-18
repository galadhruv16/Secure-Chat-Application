/**
 * Updated API service with 401 interceptor for automatic token refresh.
 * Includes credentials for refresh token cookie flow.
 */

import axios from "axios";
import { getAccessToken, setAccessToken, clearAuthState } from "./authSession";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Required for refresh token cookies
});

// Flag to prevent concurrent refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add access token to requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 with single refresh retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying and not the refresh endpoint itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post("/auth/refresh");
        const { accessToken } = response.data;
        setAccessToken(accessToken);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed — force logout
        clearAuthState();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const authService = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  refresh: () => api.post("/auth/refresh"),
  logout: () => api.post("/auth/logout"),
  logoutAll: () => api.post("/auth/logout-all"),
};

// User endpoints
export const userService = {
  getAllUsers: () => api.get("/users"),
  getUserStats: () => api.get("/users/stats"),
  updateUserStatus: (data) => api.put("/users/status", data),
  getSecuritySummary: () => api.get("/users/me/security-summary"),
  // E2EE key exchange
  uploadEncryptionKey: (publicKey) => api.post("/users/me/encryption-key", { publicKey }),
  getEncryptionKey: (userId) => api.get(`/users/${userId}/encryption-key`),
};

// Message endpoints
export const messageService = {
  sendMessage: (data) => api.post("/messages/send", data),
  getMessages: (userId) => api.get(`/messages/${userId}`),
  markAsRead: (messageId) => api.patch(`/messages/${messageId}/read`),
};

export default api;
