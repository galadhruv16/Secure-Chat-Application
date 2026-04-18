/**
 * Security display utilities for the frontend.
 * Maps verification statuses to labels, colors, and icons.
 */

/**
 * Get verification badge info based on status.
 */
export function getVerificationBadge(status) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: '✓',
        description: 'Integrity and signature verified',
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: '✗',
        description: 'Verification failed — possible tampering',
      };
    case 'unsigned':
      return {
        label: 'Unsigned',
        color: 'text-gray-400',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: '—',
        description: 'No signature attached',
      };
    case 'pending':
      return {
        label: 'Pending',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: '⏳',
        description: 'Verification in progress',
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-gray-400',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: '?',
        description: 'Unknown verification status',
      };
  }
}

/**
 * Format session info for display.
 */
export function formatSessionInfo(session) {
  const ua = session.userAgentRaw || 'Unknown device';
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os, raw: ua };
}

/**
 * Get severity badge info.
 */
export function getSeverityBadge(severity) {
  switch (severity) {
    case 'critical':
      return { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100' };
    case 'high':
      return { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100' };
    case 'medium':
      return { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    case 'low':
      return { label: 'Low', color: 'text-blue-700', bgColor: 'bg-blue-100' };
    default:
      return { label: 'Info', color: 'text-gray-700', bgColor: 'bg-gray-100' };
  }
}

/**
 * Format relative time.
 */
export function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default { getVerificationBadge, formatSessionInfo, getSeverityBadge, timeAgo };
