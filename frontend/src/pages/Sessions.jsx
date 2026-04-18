/**
 * Sessions page — lists active sessions with revoke actions.
 */

import { useNavigate, Link } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import SessionCard from "../components/SessionCard";

export default function Sessions() {
  const navigate = useNavigate();
  const { sessions, loading, error, revokeOne, revokeOthers } = useSession();

  const handleRevokeOne = async (sessionId) => {
    if (window.confirm("Revoke this session? The device will be logged out.")) {
      await revokeOne(sessionId);
    }
  };

  const handleRevokeOthers = async () => {
    if (window.confirm("Revoke ALL other sessions? All other devices will be logged out.")) {
      await revokeOthers();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/chat"
              className="text-blue-600 hover:text-blue-800 transition font-medium"
            >
              ← Back to Chat
            </Link>
            <h1 className="text-xl font-bold text-gray-800">📱 Active Sessions</h1>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeOthers}
              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
            >
              Revoke All Others
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            No active sessions found.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">
              {sessions.length} active session{sessions.length > 1 ? 's' : ''}. 
              You can revoke sessions you don't recognize.
            </p>
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRevoke={handleRevokeOne}
              />
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 text-sm mb-1">
            About Sessions
          </h3>
          <p className="text-sm text-blue-700">
            Each login creates a new session. Sessions use short-lived access tokens 
            and rotatable refresh tokens. Revoking a session immediately logs out 
            that device. If you see a session you don't recognize, revoke it and 
            change your password.
          </p>
        </div>
      </div>
    </div>
  );
}
