const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getAudit, getMyAudit } = require("../controllers/auditController");

const router = express.Router();

router.get("/mine", protect, authorizeRoles("staff", "citizen"), getMyAudit);
router.get("/", protect, authorizeRoles("admin"), getAudit);

module.exports = router;
