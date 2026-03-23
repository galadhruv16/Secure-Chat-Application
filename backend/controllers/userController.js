import User from "../models/User.js";

export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await User.find(
      { _id: { $ne: currentUserId } },
      "username email avatar isOnline lastSeen",
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
