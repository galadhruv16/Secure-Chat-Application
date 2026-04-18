/**
 * Security API wrappers for sessions and security endpoints.
 */

import api from "./api";

export const sessionService = {
  listSessions: () => api.get("/sessions"),
  revokeSession: (sessionId) => api.delete(`/sessions/${sessionId}`),
  revokeOtherSessions: () => api.delete("/sessions/revoke-others"),
};

export const securityService = {
  getSecurityEvents: (limit = 20) => api.get(`/security/events?limit=${limit}`),
  getSecuritySummary: () => api.get("/security/summary"),
  getAuditLogs: (limit = 30) => api.get(`/security/audit-logs?limit=${limit}`),
  resolveEvent: (eventId) => api.patch(`/security/events/${eventId}/resolve`),
};

export default { sessionService, securityService };
