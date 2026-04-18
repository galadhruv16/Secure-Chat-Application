/**
 * Security controller.
 * Exposes suspicious events, security summary, and verification failure events.
 */

import { getRecentSecurityEvents, getSecuritySummary } from "../services/anomalyService.js";
import { getUserAuditLogs } from "../services/auditService.js";
import SecurityEvent from "../models/SecurityEvent.js";

/**
 * Fetch recent suspicious events for the current user.
 */
export const getSecurityEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const events = await getRecentSecurityEvents(userId, limit);

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Fetch account security summary.
 */
export const getSecurityOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = await getSecuritySummary(userId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Fetch audit logs for the current user (security-critical actions).
 */
export const getAuditLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;
    const logs = await getUserAuditLogs(userId, limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark a security event as resolved.
 */
export const resolveSecurityEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await SecurityEvent.findOneAndUpdate(
      { _id: eventId, userId },
      { isResolved: true, resolvedAt: new Date() },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Security event not found",
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
