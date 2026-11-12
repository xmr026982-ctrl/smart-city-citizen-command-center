
const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");

const router = express.Router();

// All notification endpoints require authentication.
router.use(protect);

// GET /api/notifications
router.get("/", getNotifications);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", markNotificationAsRead);

// PATCH /api/notifications/read-all
router.patch("/read-all", markAllNotificationsAsRead);

module.exports = router;
