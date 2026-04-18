/**
 * Auth controller - updated for secure session token architecture.
 * Login creates a session record, issues access + refresh tokens,
 * sets refresh token as HttpOnly cookie, handles refresh and logout-all.
 */

import User from "../models/User.js";
import { createSession, rotateSession, revokeSession, revokeAllSessions } from "../services/sessionService.js";
import { hashRefreshToken } from "../services/tokenService.js";
import { ensureUserKeys } from "../services/signatureService.js";
import { appendAuditLog } from "../services/auditService.js";
import { recordFailedLogin, resetFailedLogins, calculateLoginRisk } from "../services/anomalyService.js";
import { getRefreshCookieOptions, getClearCookieOptions } from "../utils/cookieOptions.js";
import { AUDIT_EVENTS } from "../config/security.js";

export const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const userExists = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists with that email or username",
      });
    }

    const user = await User.create({
      username,
      email,
      password,
    });

    // Generate signing key pair for message attribution
    await ensureUserKeys(user._id);

    // Create session with access + refresh tokens
    const securityContext = req.securityContext || {};
    const { session, rawRefreshToken, accessToken } = await createSession(
      user._id,
      securityContext
    );

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", rawRefreshToken, getRefreshCookieOptions());

    // Audit log
    await appendAuditLog({
      eventType: AUDIT_EVENTS.REGISTER,
      actorUserId: user._id,
      sessionId: session._id,
      ipHash: securityContext.ipHash,
      userAgentHash: securityContext.userAgentHash,
      metadata: { username: user.username },
      riskScore: 0,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check account lockout
    if (user.isLocked()) {
      const lockRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Try again in ${lockRemaining} minutes.`,
        code: "ACCOUNT_LOCKED",
      });
    }

    const isMatch = await user.matchPassword(password);
    const securityContext = req.securityContext || {};

    if (!isMatch) {
      // Record failed login attempt
      const { locked, remainingAttempts } = await recordFailedLogin(user._id, securityContext);

      // Audit failed login
      await appendAuditLog({
        eventType: AUDIT_EVENTS.LOGIN_FAILURE,
        actorUserId: user._id,
        ipHash: securityContext.ipHash,
        userAgentHash: securityContext.userAgentHash,
        metadata: { locked, remainingAttempts },
        riskScore: locked ? 60 : 20,
      });

      return res.status(401).json({
        success: false,
        message: locked
          ? "Account locked due to too many failed attempts"
          : "Invalid credentials",
        code: locked ? "ACCOUNT_LOCKED" : undefined,
      });
    }

    // Successful login — reset failed counter
    await resetFailedLogins(user._id);

    // Ensure user has signing keys
    await ensureUserKeys(user._id);

    // Calculate login risk score
    const riskScore = await calculateLoginRisk(user._id, securityContext);

    // Update user status and last login metadata
    user.isOnline = true;
    user.lastLoginIpHash = securityContext.ipHash;
    user.lastUserAgentHash = securityContext.userAgentHash;
    await user.save();

    // Create session
    const { session, rawRefreshToken, accessToken } = await createSession(
      user._id,
      securityContext
    );

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", rawRefreshToken, getRefreshCookieOptions());

    // Audit successful login
    await appendAuditLog({
      eventType: AUDIT_EVENTS.LOGIN_SUCCESS,
      actorUserId: user._id,
      sessionId: session._id,
      ipHash: securityContext.ipHash,
      userAgentHash: securityContext.userAgentHash,
      metadata: { riskScore },
      riskScore,
    });

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isOnline: user.isOnline,
      },
      securityNotice: riskScore >= 50
        ? "Login from a new device or location detected"
        : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const refresh = async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
        code: "NO_REFRESH_TOKEN",
      });
    }

    const securityContext = req.securityContext || {};
    const result = await rotateSession(rawRefreshToken, securityContext);

    if (!result) {
      // Clear the invalid cookie
      res.clearCookie("refreshToken", getClearCookieOptions());

      await appendAuditLog({
        eventType: AUDIT_EVENTS.TOKEN_REFRESH_FAILURE,
        ipHash: securityContext.ipHash,
        userAgentHash: securityContext.userAgentHash,
        metadata: { reason: "invalid_or_replayed_token" },
        riskScore: 50,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again.",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // Set new refresh token cookie
    res.cookie("refreshToken", result.rawRefreshToken, getRefreshCookieOptions());

    // Audit
    await appendAuditLog({
      eventType: AUDIT_EVENTS.TOKEN_REFRESH,
      actorUserId: result.session.userId,
      sessionId: result.session._id,
      ipHash: securityContext.ipHash,
      riskScore: 0,
    });

    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.user.sessionId;

    // Revoke current session
    if (sessionId) {
      await revokeSession(sessionId, "user_logout");
    }

    // Clear refresh cookie
    res.clearCookie("refreshToken", getClearCookieOptions());

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date(),
    });

    // Audit
    await appendAuditLog({
      eventType: AUDIT_EVENTS.LOGOUT,
      actorUserId: userId,
      sessionId,
      ipHash: req.securityContext?.ipHash,
      riskScore: 0,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    const revokedCount = await revokeAllSessions(userId);

    // Clear refresh cookie
    res.clearCookie("refreshToken", getClearCookieOptions());

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date(),
    });

    // Audit
    await appendAuditLog({
      eventType: AUDIT_EVENTS.LOGOUT_ALL,
      actorUserId: userId,
      ipHash: req.securityContext?.ipHash,
      metadata: { revokedCount },
      riskScore: 0,
    });

    res.status(200).json({
      success: true,
      message: `Logged out from all ${revokedCount} sessions`,
      revokedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
