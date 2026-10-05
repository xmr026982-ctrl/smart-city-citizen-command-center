const getStaffDashboard = async (req, res) => {
  res.json({
    message: "Welcome to Staff Dashboard",

    staff: {
      id: req.user.id,
      role: req.user.role,
    },
  });
};

module.exports = {
  getStaffDashboard,
};