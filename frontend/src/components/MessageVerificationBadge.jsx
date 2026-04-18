/**
 * Message verification badge component.
 * Displays integrity and signature verification status for each message.
 */

import { getVerificationBadge } from "../utils/security";

export default function MessageVerificationBadge({
  verificationResult,
  verificationStatus,
}) {
  const status = verificationResult?.status || verificationStatus || "pending";
  const reason = verificationResult?.reason;

  const isIntegrityFailure =
    reason === "content_hash_mismatch" || reason === "integrity_tag_mismatch";

  // Legacy or signature-only failures should not be presented as "tampered".
  const statusForBadge =
    status === "failed" && !isIntegrityFailure ? "unsigned" : status;
  const badge = getVerificationBadge(statusForBadge);

  return (
    <div
      className="inline-flex items-center gap-1 mt-1"
      title={badge.description}
    >
      <span className={`text-xs font-medium ${badge.color}`}>{badge.icon}</span>
      {status === "failed" && isIntegrityFailure && (
        <span className="text-xs text-red-500 font-medium">⚠ Tampered</span>
      )}
    </div>
  );
}
