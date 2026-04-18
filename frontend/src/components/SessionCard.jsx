/**
 * Session card component — displays session metadata with revoke action.
 */

import { formatSessionInfo, timeAgo } from "../utils/security";

export default function SessionCard({ session, onRevoke }) {
  const { browser, os } = formatSessionInfo(session);

  return (
    <div
      className={`p-4 rounded-lg border ${
        session.isCurrent
          ? "border-blue-300 bg-blue-50"
          : session.isSuspicious
          ? "border-red-300 bg-red-50"
          : "border-gray-200 bg-white"
      } transition hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {os === 'Windows' ? '💻' : os === 'macOS' ? '🖥️' : os === 'Linux' ? '🐧' : os === 'Android' ? '📱' : os === 'iOS' ? '📱' : '🌐'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">
                {browser} on {os}
              </h3>
              {session.isCurrent && (
                <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                  Current
                </span>
              )}
              {session.isSuspicious && (
                <span className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                  ⚠ Suspicious
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Last active: {timeAgo(session.lastSeenAt)}
            </p>
            <p className="text-xs text-gray-400">
              Created: {new Date(session.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {!session.isCurrent && (
          <button
            onClick={() => onRevoke(session.id)}
            className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
