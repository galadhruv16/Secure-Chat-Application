/**
 * Security Center page — displays security events, summary, and audit logs.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSecurityEvents } from "../hooks/useSecurityEvents";
import { getSeverityBadge, timeAgo } from "../utils/security";

export default function SecurityCenter() {
  const {
    events,
    summary,
    auditLogs,
    loading,
    error,
    fetchAuditLogs,
    resolveEvent,
  } = useSecurityEvents();
  const [activeTab, setActiveTab] = useState("events");
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    if (activeTab === "audit" && !showAudit) {
      fetchAuditLogs();
      setShowAudit(true);
    }
  }, [activeTab, showAudit, fetchAuditLogs]);

  const handleResolve = async (eventId) => {
    await resolveEvent(eventId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            to="/chat"
            className="text-blue-600 hover:text-blue-800 transition font-medium"
          >
            ← Back to Chat
          </Link>
          <h1 className="text-xl font-bold text-gray-800">🛡️ Security Center</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Security Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{summary.activeSessions}</p>
              <p className="text-xs text-gray-500 mt-1">Active Sessions</p>
            </div>
            <div className={`p-4 rounded-lg border shadow-sm ${
              summary.suspiciousSessions > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-white border-gray-200'
            }`}>
              <p className={`text-2xl font-bold ${
                summary.suspiciousSessions > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {summary.suspiciousSessions}
              </p>
              <p className="text-xs text-gray-500 mt-1">Suspicious Sessions</p>
            </div>
            <div className={`p-4 rounded-lg border shadow-sm ${
              summary.unresolvedEvents > 0
                ? 'bg-orange-50 border-orange-200'
                : 'bg-white border-gray-200'
            }`}>
              <p className={`text-2xl font-bold ${
                summary.unresolvedEvents > 0 ? 'text-orange-600' : 'text-green-600'
              }`}>
                {summary.unresolvedEvents}
              </p>
              <p className="text-xs text-gray-500 mt-1">Unresolved Events</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <p className="text-2xl font-bold text-gray-600">{summary.recentEventsLast24h}</p>
              <p className="text-xs text-gray-500 mt-1">Events (24h)</p>
            </div>
          </div>
        )}

        {/* Account status */}
        {summary?.isAccountLocked && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="font-semibold text-red-800">🔒 Account Locked</p>
            <p className="text-sm text-red-700 mt-1">
              Your account is temporarily locked due to suspicious activity.
              Failed login attempts: {summary.failedLoginCount}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {['events', 'audit'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'events' ? '🚨 Security Events' : '📋 Audit Trail'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12">
            Loading security data...
          </div>
        ) : activeTab === 'events' ? (
          /* Security Events Tab */
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p className="text-lg">✅ No security events</p>
                <p className="text-sm mt-1">Your account has no suspicious activity.</p>
              </div>
            ) : (
              events.map((event) => {
                const severityBadge = getSeverityBadge(event.severity);
                return (
                  <div
                    key={event._id}
                    className={`p-4 rounded-lg border transition ${
                      event.isResolved
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'bg-white border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${severityBadge.bgColor} ${severityBadge.color}`}>
                            {severityBadge.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {timeAgo(event.createdAt)}
                          </span>
                          {event.isResolved && (
                            <span className="text-xs text-green-600 font-medium">✓ Resolved</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 font-medium">
                          {event.eventType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {event.description}
                        </p>
                      </div>
                      {!event.isResolved && (
                        <button
                          onClick={() => handleResolve(event._id)}
                          className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition ml-3"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Audit Trail Tab */
          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>No audit logs available.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 px-3 text-gray-500 font-medium">Event</th>
                      <th className="py-2 px-3 text-gray-500 font-medium">Time</th>
                      <th className="py-2 px-3 text-gray-500 font-medium">Risk</th>
                      <th className="py-2 px-3 text-gray-500 font-medium">Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-800">
                          {log.eventType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {timeAgo(log.createdAt)}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            log.riskScore >= 50
                              ? 'bg-red-100 text-red-700'
                              : log.riskScore >= 20
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {log.riskScore}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400 font-mono">
                          {log.chainHash?.substring(0, 12)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 text-sm mb-1">
                About the Audit Trail
              </h3>
              <p className="text-sm text-blue-700">
                Each entry has a chain hash computed from the previous entry's hash, 
                creating a tamper-evident log. If any entry is modified, all subsequent 
                chain hashes become invalid, making retroactive tampering detectable.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
