import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Auth endpoints
export const authService = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
};

// User endpoints
export const userService = {
  getAllUsers: () => api.get("/users"),
  getUserStats: () => api.get("/users/stats"),
  updateUserStatus: (data) => api.put("/users/status", data),
};

// Message endpoints
export const messageService = {
  sendMessage: (data) => api.post("/messages/send", data),
  getMessages: (userId) => api.get(`/messages/${userId}`),
  markAsRead: (messageId) => api.patch(`/messages/${messageId}/read`),
};

export default api;
