/**
 * Hook to fetch and manage suspicious activity state.
 */

import { useState, useEffect, useCallback } from "react";
import { securityService } from "../services/securityApi";

export function useSecurityEvents() {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, summaryRes] = await Promise.all([
        securityService.getSecurityEvents(),
        securityService.getSecuritySummary(),
      ]);
      setEvents(eventsRes.data.data || []);
      setSummary(summaryRes.data.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load security data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await securityService.getAuditLogs();
      setAuditLogs(res.data.data || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const resolveEvent = async (eventId) => {
    try {
      await securityService.resolveEvent(eventId);
      setEvents((prev) =>
        prev.map((e) =>
          e._id === eventId ? { ...e, isResolved: true, resolvedAt: new Date() } : e
        )
      );
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resolve event");
      return false;
    }
  };

  const hasUnresolvedEvents = events.some((e) => !e.isResolved);

  return {
    events,
    summary,
    auditLogs,
    loading,
    error,
    fetchEvents,
    fetchAuditLogs,
    resolveEvent,
    hasUnresolvedEvents,
  };
}

export default useSecurityEvents;
