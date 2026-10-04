const issues = require("../services/issue.service");

async function list(req, res) {
  res.json(await issues.list(req.user));
}

async function getOne(req, res) {
  const issue = await issues.getOne(req.params.id, req.user);
  if (!issue) return res.status(404).json({ message: "Not found" });
  res.json(issue);
}

async function create(req, res) {
  if (req.user.role !== "citizen") return res.status(403).json({ message: "Citizen only" });
  res.status(201).json(await issues.create(req.body, req.files, req.user));
}

async function setStatus(req, res) {
  const result = await issues.setStatus(req.params.id, req.body.status, req.user);
  if (result === null) return res.status(404).json({ message: "Not found" });
  if (result === false) return res.status(403).json({ message: "Status move not allowed" });
  res.json(result);
}

async function assign(req, res) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const issue = await issues.assign(req.params.id, req.body.assignedTo, req.user);
  if (!issue) return res.status(404).json({ message: "Not found" });
  res.json(issue);
}

async function setPriority(req, res) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const issue = await issues.setPriority(req.params.id, req.body.priority);
  if (!issue) return res.status(404).json({ message: "Not found" });
  res.json(issue);
}

async function comment(req, res) {
  if (req.user.role === "citizen") return res.status(403).json({ message: "No citizen comments" });
  const issue = await issues.comment(req.params.id, req.body.body, req.user);
  if (!issue) return res.status(404).json({ message: "Not found" });
  res.json(issue);
}

async function toggleSave(req, res) {
  const issue = await issues.toggleSave(req.params.id, req.user);
  if (!issue) return res.status(404).json({ message: "Not found" });
  res.json(issue);
}

module.exports = { list, getOne, create, setStatus, assign, setPriority, comment, toggleSave };