/**
 * User controller - with E2EE public key exchange and security summary.
 */

import User from "../models/User.js";
import { getSecuritySummary } from "../services/anomalyService.js";

export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await User.find(
      { _id: { $ne: currentUserId } },
      "username email avatar isOnline lastSeen encryptionPublicKey",
    ).limit(50);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(
      userId,
      "username email isOnline lastSeen",
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isOnline } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isOnline, lastSeen: new Date() },
      { new: true },
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSecuritySummaryForUser = async (req, res) => {
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
 * Upload E2EE encryption public key.
 * The private key NEVER leaves the client browser.
 */
export const uploadEncryptionPublicKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        message: "Public key is required",
      });
    }

    // Store as JSON string
    const publicKeyStr = typeof publicKey === 'string' ? publicKey : JSON.stringify(publicKey);

    await User.findByIdAndUpdate(userId, {
      encryptionPublicKey: publicKeyStr,
    });

    res.status(200).json({
      success: true,
      message: "Encryption public key uploaded successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get a specific user's E2EE encryption public key.
 */
export const getEncryptionPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId, "username encryptionPublicKey");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        encryptionPublicKey: user.encryptionPublicKey
          ? JSON.parse(user.encryptionPublicKey)
          : null,
        hasE2EE: !!user.encryptionPublicKey,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
