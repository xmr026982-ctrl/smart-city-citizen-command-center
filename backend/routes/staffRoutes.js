const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getCoverage, getStaff, setRank, setVerified, setZone, removeStaff, setMyDuty } = require("../controllers/staffController");

const router = express.Router();
const admin = [protect, authorizeRoles("admin")];

router.patch("/me/duty", protect, authorizeRoles("staff", "admin"), setMyDuty);
router.get("/coverage", protect, getCoverage);
router.get("/", ...admin, getStaff);
router.patch("/:id/rank", ...admin, setRank);
router.patch("/:id/verify", ...admin, setVerified);
router.patch("/:id/zone", ...admin, setZone);
router.delete("/:id", ...admin, removeStaff);

module.exports = router;
