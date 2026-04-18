/**
 * Updated MessageBubble with E2EE support and verification badge.
 * Shows decrypted text for E2EE messages, or ciphertext placeholder if decryption fails.
 */

import MessageVerificationBadge from "./MessageVerificationBadge";

export default function MessageBubble({ message, isOwn }) {
  // For E2EE messages: show decryptedText; for plaintext: show text directly
  const displayText = message.isEncrypted
    ? (message.decryptedText || (message.decryptionFailed ? '🔒 Unable to decrypt' : '🔒 Encrypted message'))
    : message.text;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 text-gray-800 rounded-bl-none"
        }`}
      >
        <p className="break-words">{displayText}</p>
        <div className={`flex items-center justify-between gap-2 mt-1`}>
          <div className="flex items-center gap-1">
            <p
              className={`text-xs ${isOwn ? "text-blue-100" : "text-gray-500"}`}
            >
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {message.isEncrypted && (
              <span
                className={`text-xs ${isOwn ? "text-blue-200" : "text-green-500"}`}
                title="End-to-end encrypted"
              >
                🔐
              </span>
            )}
          </div>
          <MessageVerificationBadge
            verificationResult={message.verificationResult}
            verificationStatus={message.verificationStatus}
          />
        </div>
      </div>
    </div>
  );
}
