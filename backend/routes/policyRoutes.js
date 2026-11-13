const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getPolicy, putPolicy, getHistory } = require("../controllers/policyController");

const router = express.Router();

router.get("/", protect, getPolicy);
router.put("/", protect, authorizeRoles("admin"), putPolicy);
router.get("/history", protect, authorizeRoles("admin"), getHistory);

module.exports = router;
