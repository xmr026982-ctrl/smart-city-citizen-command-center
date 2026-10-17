const issueService = require("../services/issue.service");

// ==================== MAP / GEOLOCATION ====================

const createIssue = async (req, res) => {
  try {
    const { title, type, status, latitude, longitude } = req.body;

    if (!title || !type || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "title, type, latitude and longitude are required",
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude must be valid numbers",
      });
    }

    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude",
      });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude",
      });
    }

    const issue = await issueService.createIssue({
      title,
      type,
      status,
      latitude: lat,
      longitude: lng,
    });

    return res.status(201).json({
      success: true,
      message: "Issue created successfully",
      data: issue,
    });
  } catch (error) {
    console.error("Create issue error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create issue",
      error: error.message,
    });
  }
};

const getNearbyIssues = async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const distance = radius ? Number(radius) : 2000;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(distance)
    ) {
      return res.status(400).json({
        success: false,
        message: "latitude, longitude and radius must be valid numbers",
      });
    }

    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude",
      });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude",
      });
    }

    if (distance <= 0) {
      return res.status(400).json({
        success: false,
        message: "radius must be greater than 0",
      });
    }

   const issues = await issueService.getNearbyIssues(
        lat,
        lng,
        distance,
     req.user
    );

   return res.status(200).json({
     success: true,
     count: issues.length,
     data: issues,
   });

  } catch (error) {
    console.error("Nearby issues error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch nearby issues",
      error: error.message,
    });
  }
};

// ==================== ISSUE MANAGEMENT ====================

const list = async (req, res) => {
  res.json(await issueService.list(req.user));
};

const getOne = async (req, res) => {
  const issue = await issueService.getOne(req.params.id, req.user);

  if (issue === false) {
    return res.status(403).json({
      message: "You are not allowed to view this issue.",
    });
  }

  if (!issue) {
    return res.status(404).json({
      message: "Not found",
    });
  }

  res.json(issue);
};

const create = async (req, res) => {
  if (req.user.role !== "citizen") {
    return res.status(403).json({
      message: "Citizen only",
    });
  }

  res.status(201).json(
    await issueService.create(req.body, req.files, req.user)
  );
};

const setStatus = async (req, res) => {
  const allowedStatuses = new Set([
    "submitted",
    "acknowledged",
    "in_progress",
    "pending_review",
    "resolved",
  ]);
  const status = String(req.body.status || "").toLowerCase();

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({
      message: "Invalid status value.",
    });
  }

  const result = await issueService.setStatus(
    req.params.id,
    status,
    req.user
  );

  if (result === null) {
    return res.status(404).json({
      message: "Not found",
    });
  }

  if (result === false) {
    return res.status(403).json({
      message: "Status move not allowed",
    });
  }

  res.json(result);
};

const assign = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin only",
    });
  }

  const issue = await issueService.assign(
    req.params.id,
    req.body.assignedTo,
    req.user
  );

  if (issue === false) {
    return res.status(403).json({
      message: "Assignment is not allowed.",
    });
  }

  if (!issue) {
    return res.status(404).json({
      message: "Not found",
    });
  }

  res.json(issue);
};

const setPriority = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin only",
    });
  }

  const allowedPriorities = new Set(["low", "medium", "high", "critical"]);
  const priority = String(req.body.priority || "").toLowerCase();

  if (!allowedPriorities.has(priority)) {
    return res.status(400).json({
      message: "priority must be low, medium, high, or critical",
    });
  }

  const issue = await issueService.setPriority(
    req.params.id,
    priority
  );

  if (!issue) {
    return res.status(404).json({
      message: "Not found",
    });
  }

  res.json(issue);
};

const comment = async (req, res) => {
  if (req.user.role === "citizen") {
    return res.status(403).json({
      message: "No citizen comments",
    });
  }

  const issue = await issueService.comment(
    req.params.id,
    req.body.body,
    req.user
  );

  if (issue === false) {
    return res.status(403).json({
      message: "You are not allowed to add a work update to this issue.",
    });
  }

  if (!issue) {
    return res.status(404).json({
      message: "Not found",
    });
  }

  res.json(issue);
};

const toggleSave = async (req, res) => {
  const issue = await issueService.toggleSave(
    req.params.id,
    req.user
  );

  if (!issue) {
    return res.status(404).json({
      message: "Not found",
    });
  }

  res.json(issue);
};

module.exports = {
  // Map
  createIssue,
  getNearbyIssues,

  // Issue Management
  list,
  getOne,
  create,
  setStatus,
  assign,
  setPriority,
  comment,
  toggleSave,
};