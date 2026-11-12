
const User = require("../models/User");

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email role zone ward phone experience rank dutyStatus createdAt"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      message: "Failed to get profile."
    });
  }
};

module.exports = {
  getMyProfile
};