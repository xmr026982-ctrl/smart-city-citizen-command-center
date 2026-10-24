const express = require("express");
const requireUser = require("../middleware/requireUser");
const upload = require("../middleware/upload.middleware");
const validate = require("../middleware/validate.middleware");
const { createIssue } = require("../validators/issue.validator");
const issues = require("../controllers/issueController");

const router = express.Router();

router.use(requireUser);
router.get("/", issues.list);
router.get("/:id", issues.getOne);
router.post("/", upload.array("photos", 5), validate(createIssue), issues.create);
router.post("/:id/status", issues.setStatus);
router.post("/:id/assign", issues.assign);
router.post("/:id/priority", issues.setPriority);
router.post("/:id/comments", issues.comment);
router.post("/:id/save", issues.toggleSave);

module.exports = router;