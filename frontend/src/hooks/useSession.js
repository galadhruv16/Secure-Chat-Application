/**
 * Hook to manage session list and revoke actions.
 */

import { useState, useEffect, useCallback } from "react";
import { sessionService } from "../services/securityApi";

export function useSession() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await sessionService.listSessions();
      setSessions(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeOne = async (sessionId) => {
    try {
      await sessionService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Failed to revoke session");
      return false;
    }
  };

  const revokeOthers = async () => {
    try {
      await sessionService.revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Failed to revoke sessions");
      return false;
    }
  };

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    revokeOne,
    revokeOthers,
  };
}

export default useSession;
