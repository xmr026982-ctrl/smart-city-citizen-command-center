
const mongoose = require("mongoose");
const crypto = require("crypto");

const Issue = require("../models/Issue");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Policy = require("../models/Policy");
const AuditLog = require("../models/AuditLog");
const { nextIssueId } = require("../models/Counter");
const { textProblem } = require("../utils/textGuard");
const { getIO } = require("../socket/socket");

const WARDS = [
  "Shyambazar",
  "B.B.D. Bagh",
  "Ballygunge",
  "College Street",
  "B.P. Township",
  "Dharmatala",
];

const CATEGORIES = [
  "roads", "lighting", "water", "waste",
  "electricity", "safety", "other",
];

const STATUSES = [
  "submitted", "acknowledged", "in_progress",
  "pending_review", "resolved",
];

const PRIORITIES = ["low", "medium", "high", "critical"];

const nameOf = (user) =>
  String(user?.displayName || user?.name || "").trim();

const actorOf = (req) => ({
  id: String(req.user._id),
  role: req.user.role,
  name: nameOf(req.user),
  tab: req.headers["x-client-tab"] || null,
});

const publicPersonName = (role, name) => {
  if (role === "staff") return "Field crew";
  if (role === "admin") return "City Command";
  return name || "";
};

const idOf = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const issueFilterId = (id) => ({ publicId: id });


async function findIssue(publicId) {
  return Issue.findOne({ publicId })
    .populate("reportedBy", "name displayName role")
    .populate("assignedTo", "name displayName role");
}

function canSee(issue, user) {
  const uid = String(user._id);

  if (user.role === "admin") return true;

  if (user.role === "staff") {
    return !issue.removed || idOf(issue.assignedTo) === uid;
  }

  return (
    !issue.removed ||
    idOf(issue.reportedBy) === uid
  );
}

function serializeIssue(issue, user) {
  const raw = issue.toObject ? issue.toObject() : { ...issue };
  const ownReport = idOf(raw.reportedBy) === String(user._id);
  const admin = user.role === "admin";
  const staff = user.role === "staff";

  const reporter = raw.reportedBy;
  const assignee = raw.assignedTo;

  const result = {
    id: raw.publicId,
    title: raw.title,
    description: raw.description,
    category: raw.category,
    location: raw.locationText,
    ward: raw.ward,
    lat: raw.lat,
    lng: raw.lng,
    photos: raw.photos || [],
    danger: Boolean(raw.danger),
    priority: raw.priority,
    slaHours: raw.slaHours,
    status: raw.status,
    reporterId: idOf(reporter),
    reportedBy: nameOf(reporter),
    assignedTo: assignee
      ? (admin || staff
          ? nameOf(assignee)
          : "Field crew")
      : "",
    assignedToId: idOf(assignee),
    assignedAt: raw.assignedAt,
    timeline: (raw.timeline || []).map((step) => ({
      status: step.status,
      at: step.at,
      by: admin || staff
        ? step.by
        : step.role === "citizen"
          ? step.by
          : step.role === "staff"
            ? "Field crew"
            : "City Command",
            note: step.note,
          })),
    comments: (raw.comments || [])
      .filter((comment) => admin || staff || !comment.internal)
      .map((comment) => ({
        id: comment.id,
        author: admin || staff
          ? comment.author
          : publicPersonName(comment.role, comment.author),
        role: comment.role,
        body: comment.body,
        createdAt: comment.createdAt,
        internal: Boolean(comment.internal),
      })),
    savedBy: admin || staff
      ? (raw.savedBy || []).map(String)
      : (raw.savedBy || []).some((id) => String(id) === String(user._id))
        ? [String(user._id)]
        : [],
    supporters: (raw.supporters || []).map((supporter) => {
      const isSelf = String(supporter.id) === String(user._id);

      if (admin || staff || isSelf) {
        return {
          id: String(supporter.id),
          name: supporter.name || "",
          at: supporter.at,
        };
      }

      return { id: "", name: "", at: supporter.at };
    }),
    requests: (raw.requests || [])
      .filter((request) => admin || String(request.byId) === String(user._id))
      .map((request) => ({
        ...request,
        decided: request.decided
          ? {
              ...request.decided,
              by: admin
                ? request.decided.by
                : publicPersonName("admin", request.decided.by),
            }
          : null,
      })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (admin || staff) {
    result.returned = raw.returned || 0;
    result.lastReturn = raw.lastReturn || null;
    result.removed = raw.removed || null;
    result.restored = raw.restored || null;
  } else {
    result.removed = raw.removed
      ? {
          ...raw.removed,
          by: publicPersonName(raw.removed.role, raw.removed.by),
        }
      : null;
    result.restored = raw.restored
      ? {
          ...raw.restored,
          by: "City Command",
        }
      : null;

    if (!ownReport) {
      result.reporterId = null;
      result.reportedBy = "";
    }

    if (result.status === "pending_review") {
      result.status = "in_progress";
      result.timeline = result.timeline.filter(
        (step) => step.status !== "pending_review"
      );
    }
  }

  return result;
}

async function writeAudit(req, kind, action, issueId, n = null) {
  const actor = actorOf(req);

  await AuditLog.create({
    id: crypto.randomUUID(),
    at: new Date(),
    actorId: actor.id,
    actor: actor.name,
    role: actor.role,
    kind,
    action,
    issueId: issueId || "",
    n,
  });
}

function emitEvent(event, payload, rooms) {
  try {
    const io = getIO();
    const envelope = {
      at: new Date().toISOString(),
      actorId: payload.actorId || null,
      actorTab: payload.actorTab || null,
      ...payload,
    };

    for (const room of rooms) {
      io.to(room).emit(event, envelope);
    }
  } catch (error) {
    console.error("Socket event error:", error.message);
  }
}

async function notifyUser(userId, type, title, message, issue) {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      issue: issue?._id,
      isRead: false,
    });

    emitEvent(
      "notification:new",
      { id: String(notification._id), type },
      [`user:${userId}`]
    );
  } catch (error) {
    console.error("Notification error:", error.message);
  }
}

function validateText(value, options) {
  return textProblem(value, options);
}

function ensureKolkataCoordinates(lat, lng) {
  // Approximate Kolkata bounds; adjust only if the project map
  // intentionally includes a larger surrounding service area.
  return lat >= 22.35 && lat <= 22.75 &&
    lng >= 88.20 && lng <= 88.55;
}

async function policyWindow(priority, category) {
  const policy = await Policy.findOne().sort({ version: -1 }).lean();

  const priorityWindows = policy?.priority || {
    critical: 12, high: 24, medium: 48, low: 120,
  };

  const ceilings = policy?.ceilings instanceof Map
    ? Object.fromEntries(policy.ceilings)
    : policy?.ceilings || { safety: 12, electricity: 12 };

  const hours = priorityWindows[priority];

  if (!Number.isInteger(hours)) {
    throw new Error("Service window policy is invalid.");
  }

  return Number.isInteger(ceilings[category])
    ? Math.min(hours, ceilings[category])
    : hours;
}

async function respondIssue(res, issue, user, statusCode = 200, related = []) {
  const response = {
    issue: serializeIssue(issue, user),
  };

  if (related.length) {
    response.related = related.map((item) => serializeIssue(item, user));
  }

  return res.status(statusCode).json(response);
}

async function loadAndAuthorize(req, res) {
  const issue = await findIssue(req.params.id);

  if (!issue) {
    res.status(404).json({ message: "Issue not found." });
    return null;
  }

  if (!canSee(issue, req.user)) {
    res.status(404).json({ message: "Issue not found." });
    return null;
  }

  return issue;
}

async function joinIssueRooms(issue) {
  // Existing connected sockets join rooms on connection.
  // This helper is intentionally a no-op placeholder for later
  // relationship-specific room updates.
}

const createIssue = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.isActive || user.role !== "citizen") {
      return res.status(403).json({ message: "Your account cannot file an issue." });
    }

    const { title, description, category, location, ward, danger } = req.body || {};
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    const checks = [
      [title, { min: 6, what: "a title", title: true }],
      [description, { min: 20, what: "a description" }],
      [location, { min: 4, what: "a landmark or address" }],
    ];

    for (const [value, options] of checks) {
      const problem = validateText(value, options);
      if (problem) return res.status(400).json({ message: problem });
    }

    if (title.trim().length > 90) {
      return res.status(400).json({ message: "Title must be 90 characters or fewer." });
    }

    if (description.trim().length > 600) {
      return res.status(400).json({ message: "Description must be 600 characters or fewer." });
    }

    if (description.trim().toLowerCase() === title.trim().toLowerCase()) {
      return res.status(400).json({ message: "Description must add details beyond the title." });
    }

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Invalid issue category." });
    }

    if (!WARDS.includes(ward)) {
      return res.status(400).json({ message: "Select a valid city zone." });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        !ensureKolkataCoordinates(lat, lng)) {
      return res.status(400).json({ message: "Choose a valid location within Kolkata." });
    }

    if (![true, false, "true", "false", undefined].includes(danger)) {
      return res.status(400).json({ message: "Invalid danger value." });
    }

    const files = req.files || [];

    if (files.length > 3) {
      return res.status(400).json({ message: "You can upload at most 3 photos." });
    }

    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      return res.status(400).json({ message: "Each photo must be 5 MB or smaller." });
    }

    const baseUrl = String(process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");

    const isHttps = /^https:\/\//i.test(baseUrl);

    const isLocalDevelopment =
      process.env.NODE_ENV !== "production" &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);

    if (files.length && !isHttps && !isLocalDevelopment) {
      return res.status(500).json({
        message: "Photo storage URL is not configured.",
      });
    }

    const isDanger = danger === true || danger === "true";
    const priority = isDanger ? "high" : "medium";
    const slaHours = await policyWindow(priority, category);

    const countToday = await Issue.countDocuments({
      reportedBy: user._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (countToday >= 10) {
      return res.status(429).json({ message: "Daily report limit reached. Try again later." });
    }

    const publicId = await nextIssueId();

    const photos = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.originalname,
      url: `${baseUrl}/uploads/issues/${file.filename}`,
      w: null,
      h: null,
      kb: Math.ceil(file.size / 1024),
    }));

    const now = new Date();

    const issue = await Issue.create({
      publicId,
      title: title.trim(),
      description: description.trim(),
      category,
      location: { type: "Point", coordinates: [lng, lat] },
      locationText: location.trim(),
      ward,
      lat,
      lng,
      danger: isDanger,
      priority,
      slaHours,
      photos,
      reportedBy: user._id,
      status: "submitted",
      timeline: [{
        status: "submitted",
        at: now,
        by: nameOf(user),
        note: "Issue submitted.",
      }],
    });

    await writeAudit(req, "filed", `Filed ${publicId}`, publicId);

    await notifyUser(
      user._id,
      "issue_created",
      "Issue submitted",
      `Your civic issue ${publicId} has been submitted.`,
      issue
    );

    emitEvent(
      "issue:filed",
      {
        id: publicId,
        title: issue.title,
        category,
        ward,
        priority,
        danger: isDanger,
        actorId: String(user._id),
        actorTab: req.headers["x-client-tab"] || null,
      },
      ["role:admin", `zone:${ward}`]
    );

    const populated = await findIssue(publicId);
    return respondIssue(res, populated, req.user, 201);
  } catch (error) {
    console.error("Create issue error:", error);
    return res.status(500).json({ message: "Failed to create issue." });
  }
};

const getIssues = async (req, res) => {
  try {
    const user = req.user;
    const filter = {};

    if (user.role === "citizen") {
      filter.$or = [
        { removed: null },
        { reportedBy: user._id },
      ];
    } else if (user.role === "staff") {
      filter.$or = [
        { removed: null },
        { assignedTo: user._id },
      ];
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const docs = await Issue.find(filter)
      .populate("reportedBy", "name displayName role")
      .populate("assignedTo", "name displayName role")
      .sort({ createdAt: -1 });

    const items = docs.map((issue) => serializeIssue(issue, user));

    return res.json({ items, total: items.length });
  } catch (error) {
    console.error("Get issues error:", error);
    return res.status(500).json({ message: "Failed to fetch issues." });
  }
};

const getIssueById = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;
    return res.json({ issue: serializeIssue(issue, req.user) });
  } catch (error) {
    console.error("Get issue error:", error);
    return res.status(500).json({ message: "Failed to fetch issue." });
  }
};

const updateIssueStatus = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { status, note = "" } = req.body || {};
    const actor = actorOf(req);
    const previous = issue.status;
    const isAdmin = actor.role === "admin";
    const isAssignedStaff =
      actor.role === "staff" && idOf(issue.assignedTo) === actor.id;

    if (!isAdmin && !isAssignedStaff) {
      return res.status(403).json({ message: "Only the assigned crew or admin can change this issue." });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid issue status." });
    }

    let event;
    let action;

    if (!isAdmin && status === "in_progress" && previous === "acknowledged") {
      event = "issue:status";
      action = "Started work";
    } else if (!isAdmin && status === "pending_review" && previous === "in_progress") {
      const problem = validateText(note, { min: 12, what: "a completion note" });
      if (problem) return res.status(400).json({ message: problem });
      event = "issue:close-requested";
      action = "Requested close";
    } else if (!isAdmin && status === "in_progress" && previous === "pending_review") {
      const problem = validateText(note, { min: 8, what: "a recall reason" });
      if (problem) return res.status(400).json({ message: problem });
      event = "issue:close-withdrawn";
      action = "Recalled close request";
    } else if (isAdmin && status === "resolved" && previous === "pending_review") {
      const problem = validateText(note, { min: 8, what: "a confirmation note" });
      if (problem) return res.status(400).json({ message: problem });
      event = "issue:resolved";
      action = "Confirmed close";
    } else if (isAdmin && status === "in_progress" && previous === "pending_review") {
      const problem = validateText(note, { min: 12, what: "a return reason" });
      if (problem) return res.status(400).json({ message: problem });

      issue.returned = (issue.returned || 0) + 1;
      issue.lastReturn = { reason: note.trim(), by: actor.name, at: new Date() };
      event = "issue:sent-back";
      action = "Sent back";
    } else {
      return res.status(409).json({
        message: `That move isn't allowed from ${previous}.`,
      });
    }

    issue.status = status;

    if (status === "pending_review" || status === "resolved") {
      issue.lastReturn = undefined;
    }

    issue.timeline.push({
      status,
      at: new Date(),
      by: actor.name,
      note: note.trim(),
    });

    await issue.save();
    await writeAudit(req, "status", `${action} ${issue.publicId}`, issue.publicId);

    const rooms = ["role:admin", `issue:${issue.publicId}`];

    if (issue.reportedBy) rooms.push(`user:${issue.reportedBy}`);

    emitEvent(event, {
      id: issue.publicId,
      from: previous,
      to: status,
      owner: idOf(issue.reportedBy),
      reason: note.trim() || undefined,
      note: note.trim() || undefined,
      returned: issue.returned,
      actorId: actor.id,
      actorTab: actor.tab,
    }, rooms);

    if (status === "resolved" || status === "pending_review") {
      await notifyUser(
        issue.reportedBy,
        "issue_status_updated",
        "Issue updated",
        `${issue.publicId} status: ${status.replace(/_/g, " ")}.`,
        issue
      );
    }

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({ message: "Failed to update issue status." });
  }
};

const assignIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { staff, note = "", undo = false } = req.body || {};
    const actor = actorOf(req);

    const previousId = idOf(issue.assignedTo);
    let nextUser = null;

    if (staff !== null) {
      if (typeof staff !== "string" || !staff.trim()) {
        return res.status(400).json({ message: "Select a staff member." });
      }

      nextUser = await User.findOne({
        role: "staff",
        isActive: true,
        $or: [{ name: staff.trim() }, { displayName: staff.trim() }],
      });

      if (!nextUser) {
        return res.status(404).json({ message: "Staff member not found." });
      }
    }

    const previousUser = previousId
      ? await User.findById(previousId)
      : null;

    issue.assignedTo = nextUser?._id || null;
    issue.assignedAt = nextUser ? new Date() : null;

    if (issue.status === "submitted" || issue.status === "in_progress" ||
        issue.status === "pending_review") {
      issue.status = "acknowledged";
      issue.returned = 0;
      issue.lastReturn = undefined;
    }

    issue.timeline.push({
      status: issue.status,
      at: new Date(),
      by: actor.name,
      note: nextUser
        ? previousUser
          ? `Reassigned from ${nameOf(previousUser)} to ${nameOf(nextUser)}`
          : `Assigned to ${nameOf(nextUser)}`
        : `Returned to dispatch: unassigned from ${nameOf(previousUser)}`,
    });

    await issue.save();

    await writeAudit(
      req,
      "dispatch",
      nextUser ? `Assigned ${issue.publicId}` : `Unassigned ${issue.publicId}`,
      issue.publicId
    );

    const rooms = ["role:admin", `issue:${issue.publicId}`];
    if (previousId) rooms.push(`user:${previousId}`);
    if (nextUser) rooms.push(`user:${nextUser._id}`);

    emitEvent("issue:assigned", {
      id: issue.publicId,
      to: nextUser ? String(nextUser._id) : null,
      from: previousId || null,
      actorId: actor.id,
      actorTab: actor.tab,
    }, rooms);

    if (nextUser) {
      await notifyUser(
        nextUser._id,
        "issue_assigned",
        "Issue assigned",
        `You have been assigned ${issue.publicId}.`,
        issue
      );
    }

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Assign issue error:", error);
    return res.status(500).json({ message: "Failed to assign issue." });
  }
};

const updateIssuePriority = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { priority } = req.body || {};

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority." });
    }

    const previous = issue.priority;
    issue.priority = priority;

    if (issue.status !== "resolved") {
      issue.slaHours = await policyWindow(priority, issue.category);
    }

    await issue.save();
    await writeAudit(req, "priority", `Priority ${issue.publicId}: ${previous} → ${priority}`, issue.publicId);

    emitEvent("issue:priority", {
      id: issue.publicId,
      from: previous,
      to: priority,
      window: issue.slaHours,
      actorId: String(req.user._id),
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin", `user:${idOf(issue.reportedBy)}`]);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Priority error:", error);
    return res.status(500).json({ message: "Failed to update priority." });
  }
};

const addIssueComment = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const actor = actorOf(req);
    const assignedStaff =
      actor.role === "staff" && idOf(issue.assignedTo) === actor.id;

    if (actor.role !== "admin" && !assignedStaff) {
      return res.status(403).json({ message: "Only the assigned crew or admin can comment." });
    }

    const { body, internal = false } = req.body || {};
    const problem = validateText(body, { min: 2, what: "a comment" });

    if (problem) return res.status(400).json({ message: problem });
    if (body.trim().length > 1000) {
      return res.status(400).json({ message: "Comment must be 1000 characters or fewer." });
    }

    issue.comments.push({
      id: crypto.randomUUID(),
      author: actor.name,
      role: actor.role,
      body: body.trim(),
      createdAt: new Date(),
      internal: Boolean(internal),
    });

    await issue.save();
    await writeAudit(req, "desk", `Added note to ${issue.publicId}`, issue.publicId);

    const rooms = ["role:admin", `user:${idOf(issue.reportedBy)}`];
    if (!internal) rooms.push(`issue:${issue.publicId}`);

    emitEvent("issue:note", {
      id: issue.publicId,
      author: publicPersonName(actor.role, actor.name),
      internal: Boolean(internal),
      actorId: actor.id,
      actorTab: actor.tab,
    }, rooms);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Comment error:", error);
    return res.status(500).json({ message: "Failed to add comment." });
  }
};

const supportIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    if (issue.removed) {
      return res.status(409).json({ message: "This issue is no longer active." });
    }

    const uid = String(req.user._id);
    const exists = issue.supporters.some((item) => String(item.id) === uid);

    if (!exists) {
      issue.supporters.push({
        id: req.user._id,
        name: nameOf(req.user),
        at: new Date(),
      });
      issue.votes = (issue.votes || 0) + 1;
      await issue.save();

      await writeAudit(req, "desk", `Supported ${issue.publicId}`, issue.publicId);
    }

    emitEvent("issue:supported", {
      id: issue.publicId,
      count: issue.supporters.length,
      actorId: uid,
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin", `issue:${issue.publicId}`]);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Support error:", error);
    return res.status(500).json({ message: "Failed to support issue." });
  }
};

const followIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { on } = req.body || {};
    if (typeof on !== "boolean") {
      return res.status(400).json({ message: "Follow value must be true or false." });
    }

    const uid = String(req.user._id);
    const current = (issue.savedBy || []).some((id) => String(id) === uid);

    if (on && !current) issue.savedBy.push(req.user._id);
    if (!on && current) {
      issue.savedBy = issue.savedBy.filter((id) => String(id) !== uid);
    }

    await issue.save();
    await writeAudit(req, "desk", `${on ? "Followed" : "Unfollowed"} ${issue.publicId}`, issue.publicId);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Follow error:", error);
    return res.status(500).json({ message: "Failed to update follow." });
  }
};

const withdrawIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    if (idOf(issue.reportedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the reporter can withdraw this issue." });
    }

    if (issue.removed || issue.status === "submitted") {
      return res.status(409).json({ message: "This issue cannot be withdrawn now." });
    }

    const { reason, note = "" } = req.body || {};
    const problem = validateText(reason, { min: 3, what: "a withdrawal reason" });
    if (problem) return res.status(400).json({ message: problem });

    issue.requests.push({
      id: crypto.randomUUID(),
      type: "withdraw",
      by: nameOf(req.user),
      byId: String(req.user._id),
      role: "citizen",
      reason: reason.trim(),
      note: note.trim(),
      at: new Date(),
      seenAt: null,
      decided: null,
    });

    await issue.save();
    await writeAudit(req, "request", `Requested withdrawal ${issue.publicId}`, issue.publicId);

    emitEvent("issue:request", {
      id: issue.publicId,
      req: "withdraw",
      reason: reason.trim(),
      actorId: String(req.user._id),
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin"]);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ message: "Failed to request withdrawal." });
  }
};

const createIssueRequest = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { type, reason, note = "", linkedTo } = req.body || {};
    const actor = actorOf(req);

    if (!["withdraw", "dispute", "flag"].includes(type)) {
      return res.status(400).json({ message: "Invalid request type." });
    }

    const problem = validateText(reason, { min: 3, what: "a reason" });
    if (problem) return res.status(400).json({ message: problem });

    const isReporter = idOf(issue.reportedBy) === actor.id;
    const isAssigned = idOf(issue.assignedTo) === actor.id;

    if (type === "flag" && !(actor.role === "staff" && isAssigned)) {
      return res.status(403).json({ message: "Only assigned staff can flag an issue." });
    }

    if ((type === "withdraw" || type === "dispute") &&
        !(actor.role === "citizen" && isReporter)) {
      return res.status(403).json({ message: "Only the reporter can submit this request." });
    }

    if (type === "dispute" && !issue.removed) {
      return res.status(409).json({ message: "Only a dismissed issue can be disputed." });
    }

    if (type === "withdraw" && issue.status === "submitted") {
      return res.status(409).json({ message: "This issue has not yet been dispatched." });
    }

    if (issue.requests.some((r) => !r.decided)) {
      return res.status(409).json({ message: "There is already an open request." });
    }

    if (reason.trim() === "Duplicate report" && !linkedTo) {
      return res.status(400).json({ message: "Select the linked issue." });
    }

    if (linkedTo && !(await Issue.findOne({ publicId: linkedTo }))) {
      return res.status(404).json({ message: "Linked issue not found." });
    }

    issue.requests.push({
      id: crypto.randomUUID(),
      type,
      by: actor.name,
      byId: actor.id,
      role: actor.role,
      reason: reason.trim(),
      note: note.trim(),
      linkedTo: linkedTo || null,
      at: new Date(),
      seenAt: null,
      decided: null,
    });

    await issue.save();
    await writeAudit(req, "request", `Submitted ${type} request for ${issue.publicId}`, issue.publicId);

    emitEvent("issue:request", {
      id: issue.publicId,
      req: type,
      reason: reason.trim(),
      actorId: actor.id,
      actorTab: actor.tab,
    }, ["role:admin"]);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Request error:", error);
    return res.status(500).json({ message: "Failed to create request." });
  }
};

const markIssueRequestSeen = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const request = issue.requests.find((r) => r.id === req.params.reqId);
    if (!request) return res.status(404).json({ message: "Request not found." });

    request.seenAt = new Date();
    await issue.save();

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Mark request seen error:", error);
    return res.status(500).json({ message: "Failed to update request." });
  }
};

const decideIssueRequest = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { verdict, reason = "" } = req.body || {};

    if (!["approved", "declined"].includes(verdict)) {
      return res.status(400).json({ message: "Invalid verdict." });
    }

    if (verdict === "declined") {
      const problem = validateText(reason, { min: 3, what: "a decision reason" });
      if (problem) return res.status(400).json({ message: problem });
    }

    const request = issue.requests.find((r) => r.id === req.params.reqId);
    if (!request || request.decided) {
      return res.status(404).json({ message: "Open request not found." });
    }

    request.decided = {
      verdict,
      reason: reason.trim(),
      by: nameOf(req.user),
      at: new Date(),
    };

    if (verdict === "approved") {
      if (request.type === "withdraw" || request.type === "flag") {
        issue.removed = {
          kind: request.type === "withdraw" ? "withdrawn" : "dismissed",
          reason: request.reason,
          note: request.note,
          by: nameOf(req.user),
          role: "admin",
          at: new Date(),
          requestedBy: request.byId,
          linkedTo: request.linkedTo || null,
        };
      } else if (request.type === "dispute") {
        issue.restored = {
          from: issue.removed,
          by: nameOf(req.user),
          at: new Date(),
          note: reason.trim(),
        };
        issue.removed = null;
      }
    }

    await issue.save();
    await writeAudit(req, "request", `${verdict} request for ${issue.publicId}`, issue.publicId);

    emitEvent("issue:request-decided", {
      id: issue.publicId,
      req: request.type,
      verdict,
      actorId: String(req.user._id),
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin", `user:${request.byId}`]);

    if (issue.removed) {
      emitEvent("issue:removed", {
        id: issue.publicId,
        kind: issue.removed.kind,
        reason: issue.removed.reason,
        actorId: String(req.user._id),
        actorTab: req.headers["x-client-tab"] || null,
      }, ["role:admin", `issue:${issue.publicId}`]);
    }

    if (issue.restored) {
      emitEvent("issue:restored", {
        id: issue.publicId,
        actorId: String(req.user._id),
        actorTab: req.headers["x-client-tab"] || null,
      }, ["role:admin", `issue:${issue.publicId}`]);
    }

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Decide request error:", error);
    return res.status(500).json({ message: "Failed to decide request." });
  }
};

const dismissIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    if (issue.removed) {
      return res.status(409).json({ message: "Issue is already removed." });
    }

    const { reason, note = "", linkedTo } = req.body || {};
    const problem = validateText(reason, { min: 3, what: "a dismissal reason" });
    if (problem) return res.status(400).json({ message: problem });

    if (reason.trim() === "Duplicate report" && !linkedTo) {
      return res.status(400).json({ message: "Select the original issue." });
    }

    issue.removed = {
      kind: "dismissed",
      reason: reason.trim(),
      note: note.trim(),
      by: nameOf(req.user),
      role: "admin",
      at: new Date(),
      linkedTo: linkedTo || null,
      merged: false,
      addedTo: [],
    };

    await issue.save();
    await writeAudit(req, "removal", `Dismissed ${issue.publicId}`, issue.publicId);

    emitEvent("issue:removed", {
      id: issue.publicId,
      kind: "dismissed",
      reason: reason.trim(),
      actorId: String(req.user._id),
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin", `issue:${issue.publicId}`]);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Dismiss error:", error);
    return res.status(500).json({ message: "Failed to dismiss issue." });
  }
};

const mergeIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const { into, note = "" } = req.body || {};
    const original = await Issue.findOne({ publicId: into });

    if (!original || original._id.equals(issue._id)) {
      return res.status(400).json({ message: "Select a different original issue." });
    }

    if (issue.removed || original.removed ||
        issue.category !== original.category ||
        issue.status === "resolved" || original.status === "resolved") {
      return res.status(409).json({ message: "These issues cannot be merged." });
    }

    const distance = (() => {
      const R = 6371000;
      const rad = (v) => (v * Math.PI) / 180;
      const dLat = rad(issue.lat - original.lat);
      const dLng = rad(issue.lng - original.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(original.lat)) *
        Math.cos(rad(issue.lat)) *
        Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    })();

    const age = Math.abs(issue.createdAt - original.createdAt);

    if (distance > 200 || age > 7 * 24 * 60 * 60 * 1000) {
      return res.status(409).json({ message: "Issues are outside the duplicate matching range." });
    }

    const addedIds = [];

    if (!original.supporters.some((s) => String(s.id) === String(issue.reportedBy))) {
      original.supporters.push({
        id: issue.reportedBy,
        name: "",
        at: new Date(),
      });
    }

    for (const supporter of issue.supporters || []) {
      if (!original.supporters.some((s) => String(s.id) === String(supporter.id))) {
        original.supporters.push(supporter);
        addedIds.push(String(supporter.id));
      }
    }

    for (const saved of issue.savedBy || []) {
      if (!original.savedBy.some((id) => String(id) === String(saved))) {
        original.savedBy.push(saved);
      }
    }

    issue.removed = {
      kind: "dismissed",
      reason: "Duplicate report",
      note: note.trim(),
      by: nameOf(req.user),
      role: "admin",
      at: new Date(),
      linkedTo: original.publicId,
      merged: true,
      addedTo: addedIds,
    };

    await Promise.all([issue.save(), original.save()]);
    await writeAudit(req, `removal`, `Merged ${issue.publicId} into ${original.publicId}`, issue.publicId);

    emitEvent("issue:removed", {
      id: issue.publicId,
      kind: "dismissed",
      reason: "Duplicate report",
      actorId: String(req.user._id),
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin", `issue:${issue.publicId}`]);

    const updated = await findIssue(issue.publicId);
    const related = await findIssue(original.publicId);

    return respondIssue(res, updated, req.user, 200, [related]);
  } catch (error) {
    console.error("Merge error:", error);
    return res.status(500).json({ message: "Failed to merge issues." });
  }
};

const restoreIssue = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    if (!issue.removed || issue.removed.kind === "withdrawn") {
      return res.status(409).json({ message: "This issue cannot be restored." });
    }

    const { note = "", undo = false } = req.body || {};

    issue.restored = {
      from: issue.removed,
      by: nameOf(req.user),
      at: new Date(),
      note: note.trim() || (undo ? "Dismissal undone." : "Issue restored."),
    };

    issue.removed = null;
    await issue.save();

    await writeAudit(req, "removal", `Restored ${issue.publicId}`, issue.publicId);

    emitEvent("issue:restored", {
      id: issue.publicId,
      actorId: String(req.user._id),
      actorTab: req.headers["x-client-tab"] || null,
    }, ["role:admin", `issue:${issue.publicId}`]);

    return respondIssue(res, await findIssue(issue.publicId), req.user);
  } catch (error) {
    console.error("Restore error:", error);
    return res.status(500).json({ message: "Failed to restore issue." });
  }
};

const getPossibleDuplicates = async (req, res) => {
  try {
    const issue = await loadAndAuthorize(req, res);
    if (!issue) return;

    const candidates = await Issue.find({
      _id: { $ne: issue._id },
      category: issue.category,
      removed: null,
      createdAt: {
        $gte: new Date(issue.createdAt.getTime() - 7 * 86400000),
        $lte: new Date(issue.createdAt.getTime() + 7 * 86400000),
      },
      lat: { $gte: issue.lat - 0.02, $lte: issue.lat + 0.02 },
      lng: { $gte: issue.lng - 0.02, $lte: issue.lng + 0.02 },
    })
      .populate("reportedBy", "name displayName role")
      .populate("assignedTo", "name displayName role")
      .sort({ createdAt: 1 });

    const nearby = candidates.filter((candidate) => {
      const rad = (v) => (v * Math.PI) / 180;
      const dLat = rad(candidate.lat - issue.lat);
      const dLng = rad(candidate.lng - issue.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(issue.lat)) * Math.cos(rad(candidate.lat)) *
        Math.sin(dLng / 2) ** 2;
      const metres = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return metres <= 200;
    });

    return res.json({
      items: nearby.map((item) => serializeIssue(item, req.user)),
      total: nearby.length,
    });
  } catch (error) {
    console.error("Duplicate lookup error:", error);
    return res.status(500).json({ message: "Failed to find possible duplicates." });
  }
};

module.exports = {
  createIssue,
  getIssues,
  getIssueById,
  updateIssueStatus,
  assignIssue,
  updateIssuePriority,
  addIssueComment,
  supportIssue,
  followIssue,
  withdrawIssue,
  createIssueRequest,
  markIssueRequestSeen,
  decideIssueRequest,
  dismissIssue,
  mergeIssue,
  restoreIssue,
  getPossibleDuplicates,
};