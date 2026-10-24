const express = require("express");
const issueRoutes = require("./issueRoutes");

const router = express.Router();
router.use("/issues", issueRoutes);

module.exports = router;