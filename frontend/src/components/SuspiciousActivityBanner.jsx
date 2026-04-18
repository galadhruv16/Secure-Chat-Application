/**
 * Banner component shown when suspicious activity is detected.
 */

import { useNavigate } from "react-router-dom";

export default function SuspiciousActivityBanner({ summary, onDismiss }) {
  const navigate = useNavigate();

  if (!summary || (summary.unresolvedEvents === 0 && summary.suspiciousSessions === 0)) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-xl">🛡️</span>
        <div>
          <p className="font-semibold text-sm">Suspicious Activity Detected</p>
          <p className="text-xs text-red-100">
            {summary.unresolvedEvents > 0 &&
              `${summary.unresolvedEvents} unresolved security event${summary.unresolvedEvents > 1 ? 's' : ''}`}
            {summary.unresolvedEvents > 0 && summary.suspiciousSessions > 0 && ' · '}
            {summary.suspiciousSessions > 0 &&
              `${summary.suspiciousSessions} suspicious session${summary.suspiciousSessions > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/security")}
          className="px-3 py-1 text-xs font-semibold bg-white text-red-600 rounded-lg hover:bg-red-50 transition"
        >
          Review
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-white hover:text-red-200 transition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
