const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getReadState, putReadState } = require("../controllers/notificationController");

const router = express.Router();

router.get("/read-state", protect, getReadState);
router.put("/read-state", protect, putReadState);

module.exports = router;
