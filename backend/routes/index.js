
const express = require("express");

const router = express.Router();

router.use("/auth", require("./authRoutes"));
router.use("/issues", require("./issueRoutes"));
router.use("/staff-requests", require("./staffRequestRoutes"));

module.exports = router;
