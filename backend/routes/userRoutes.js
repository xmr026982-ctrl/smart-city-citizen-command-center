const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getMe, updateMe, deleteMe, getNames, exportMe } = require("../controllers/accountController");

const router = express.Router();

router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.delete("/me", protect, deleteMe);
router.get("/me/export", protect, exportMe);
router.get("/names", protect, getNames);

module.exports = router;
