const User = require("../models/User");
const getStaffDashboard = async (req, res) => {
  try {
    // Check whether authentication supplied a user.
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // Only staff members can access this dashboard.
    if (req.user.role !== "staff") {
      return res.status(403).json({
        message: "Access denied. Staff account required.",
      });
    }

    return res.status(200).json({
      message: "Welcome to Staff Dashboard",
      staff: {
        id: req.user.id || req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    console.error("Staff dashboard error:", error);

    return res.status(500).json({
      message: "Could not load staff dashboard.",
    });
  }
};

const getAllStaff = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    const staff = await User.find({ role: "staff" })
      .select("name email role zone department isActive createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: staff.length,
      staff,
    });
  } catch (error) {
    console.error("Get all staff error:", error);

    return res.status(500).json({
      message: "Could not load staff members.",
    });
  }
};

module.exports = {
  getStaffDashboard,
  getAllStaff,
};