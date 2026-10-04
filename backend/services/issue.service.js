const Issue = require("../models/Issue");

const PUBLIC = { pending_review: "in_progress" };

function forUser(issue, user) {
  const file = issue.toObject();
  file.id = file._id;
  file.saved = (issue.savedBy || []).includes(user.id);
  if (user.role === "citizen") {
    file.status = PUBLIC[file.status] || file.status;
    file.timeline = (file.timeline || [])
      .filter((step) => step.status !== "pending_review")
      .map((step) => ({ status: step.status, at: step.at, note: step.note }));
    file.comments = [];
  }
  return file;
}

async function list(user) {
  const query = user.role === "citizen" ? { $or: [{ reporterId: user.id }, { reportedBy: user.name }] } : {};
  const rows = await Issue.find(query).sort({ createdAt: -1 });
  return rows.map((row) => forUser(row, user));
}

async function getOne(id, user) {
  const issue = await Issue.findById(id);
  return issue ? forUser(issue, user) : null;
}

async function create(body, files, user) {
  const photos = (files || []).map((file) => ({ name: file.originalname, url: `/uploads/${file.filename}` }));
  const issue = await Issue.create({
    title: body.title,
    description: body.description,
    category: body.category,
    location: body.location,
    ward: body.ward,
    lat: Number(body.lat),
    lng: Number(body.lng),
    photos,
    reportedBy: user.name,
    reporterId: user.id,
    status: "submitted",
    priority: "medium",
    timeline: [{ status: "submitted", by: user.name, role: user.role }],
  });
  return forUser(issue, user);
}

function canMove(issue, user, next) {
  if (user.role === "admin" && issue.status === "submitted" && next === "acknowledged") return true;
  if (user.role === "staff" && issue.assignedTo === user.name && issue.status === "acknowledged" && next === "in_progress") return true;
  if (user.role === "staff" && issue.assignedTo === user.name && issue.status === "in_progress" && next === "pending_review") return true;
  if (user.role === "admin" && issue.status === "pending_review" && next === "resolved") return true;
  return false;
}

async function setStatus(id, next, user) {
  const issue = await Issue.findById(id);
  if (!issue) return null;
  if (!canMove(issue, user, next)) return false;
  issue.status = next;
  issue.timeline.push({ status: next, by: user.name, role: user.role });
  await issue.save();
  return forUser(issue, user);
}

async function assign(id, assignedTo, user) {
  const issue = await Issue.findById(id);
  if (!issue) return null;
  issue.assignedTo = assignedTo;
  issue.assignedAt = new Date();
  if (issue.status === "submitted") {
    issue.status = "acknowledged";
    issue.timeline.push({ status: "acknowledged", by: user.name, role: "admin" });
  }
  await issue.save();
  return forUser(issue, user);
}

async function setPriority(id, priority) {
  return Issue.findByIdAndUpdate(id, { priority }, { new: true });
}

async function comment(id, body, user) {
  const issue = await Issue.findById(id);
  if (!issue) return null;
  issue.comments.push({ body, author: user.name, role: user.role, internal: true });
  await issue.save();
  return forUser(issue, user);
}

async function toggleSave(id, user) {
  const issue = await Issue.findById(id);
  if (!issue) return null;
  issue.savedBy = issue.savedBy.includes(user.id)
    ? issue.savedBy.filter((item) => item !== user.id)
    : [...issue.savedBy, user.id];
  await issue.save();
  return forUser(issue, user);
}

module.exports = { list, getOne, create, setStatus, assign, setPriority, comment, toggleSave };