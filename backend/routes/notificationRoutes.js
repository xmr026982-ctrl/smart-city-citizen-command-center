const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require("../controllers/notificationController");

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);

router.patch(
  "/:id/read",
  markNotificationAsRead
);

router.patch(
  "/read-all",
  markAllNotificationsAsRead
);

module.exports = router;