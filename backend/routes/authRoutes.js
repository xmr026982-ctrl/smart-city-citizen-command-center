const express = require("express");
const protect = require("../middleware/authMiddleware");
const { register, login, googleLogin, forgotPassword, resetPassword, getMe, logout, adoptSession, activity } = require("../controllers/authController");
const { clearSessionCookie } = require("../utils/sessionCookie");
const { changePassword, changeEmail, confirmEmail, logoutAll, listSessions, revokeSession } = require("../controllers/accountController");

const router = express.Router();

// public
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/confirm-email", confirmEmail);

// signed in
router.get("/me", protect, getMe);
// signing out always drops the cookie, even when the session has already ended
const dropCookie = (_req, res, next) => { clearSessionCookie(res); next(); };
router.post("/logout", dropCookie, protect, logout);
router.post("/logout-all", dropCookie, protect, logoutAll);
// one-time: a token kept by an older version of the app becomes the cookie
router.post("/session", protect, adoptSession);
router.post("/activity", protect, activity);
router.post("/change-password", protect, changePassword);
router.post("/change-email", protect, changeEmail);
router.get("/sessions", protect, listSessions);
router.delete("/sessions/:id", protect, revokeSession);

module.exports = router;
