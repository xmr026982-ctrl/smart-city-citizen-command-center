const Issue = require("../models/Issue");

const PUBLIC = {
  pending_review: "in_progress",
};

// ==================== COMMON ====================

function forUser(issue, user) {
  const file = issue.toObject();

  file.id = String(issue._id);

  file.saved = (issue.savedBy || []).some(
    (item) => String(item) === String(user.id)
  );

  if (user.role === "citizen") {
    file.status = PUBLIC[file.status] || file.status;

    file.timeline = (file.timeline || [])
      .filter((step) => step.status !== "pending_review")
      .map((step) => ({
        status: step.status,
        at: step.at,
        note: step.note,
      }));

    file.comments = [];
  }

  return file;
}

// ==================== ISSUE MANAGEMENT ====================

async function list(user) {
  let query = {};

  if (user.role === "citizen") {
    query = {
      $or: [
        { reporterId: user.id },
        { reportedBy: user.name },
      ],
    };
  } else if (user.role === "staff") {
    // Show only issues assigned to this staff member.
    query = {
      assignedTo: user.name,
    };
  }

  const rows = await Issue.find(query).sort({
    createdAt: -1,
  });

  return rows.map((issue) => forUser(issue, user));
}

async function getOne(id, user) {
  const issue = await Issue.findById(id);

  if (!issue) return null;

  // Citizens can view their own issues.
  if (
    user.role === "citizen" &&
    String(issue.reporterId) !== String(user.id) &&
    issue.reportedBy !== user.name
  ) {
    return false;
  }

  // Staff can view only their assigned issues.
  if (
    user.role === "staff" &&
    issue.assignedTo !== user.name
  ) {
    return false;
  }

  return forUser(issue, user);
}

async function create(body, files, user) {
  const lat = Number(body.lat ?? body.latitude);
  const lng = Number(body.lng ?? body.longitude);

  const photos = (files || []).map((file) => ({
    name: file.originalname,
    url: `/uploads/${file.filename}`,
  }));

  const issueData = {
    title: body.title,
    description: body.description,
    category: body.category || body.type || "Other",
    type: body.type || body.category || "Other",

    locationText: body.location,
    ward: body.ward,

    lat,
    lng,
    latitude: lat,
    longitude: lng,

    location: {
      type: "Point",
      coordinates: [lng, lat],
    },

    photos,
    reportedBy: user.name,
    reporterId: user.id,

    status: "submitted",
    priority: "medium",

    timeline: [
      {
        status: "submitted",
        by: user.name,
        role: user.role,
      },
    ],
  };

  const issue = await Issue.create(issueData);

  return forUser(issue, user);
}

// ==================== STATUS MANAGEMENT ====================

function canMove(issue, user, next) {
  if (
    user.role === "admin" &&
    issue.status === "submitted" &&
    next === "acknowledged"
  ) {
    return true;
  }

  if (
    user.role === "staff" &&
    issue.assignedTo === user.name &&
    issue.status === "acknowledged" &&
    next === "in_progress"
  ) {
    return true;
  }

  if (
    user.role === "staff" &&
    issue.assignedTo === user.name &&
    issue.status === "in_progress" &&
    next === "pending_review"
  ) {
    return true;
  }

  if (
    user.role === "admin" &&
    issue.status === "pending_review" &&
    next === "resolved"
  ) {
    return true;
  }

  return false;
}

async function setStatus(id, next, user) {
  const issue = await Issue.findById(id);

  if (!issue) return null;

  if (!canMove(issue, user, next)) {
    return false;
  }

  issue.status = next;

  issue.timeline.push({
    status: next,
    by: user.name,
    role: user.role,
  });

  await issue.save();

  return forUser(issue, user);
}

// ==================== ASSIGNMENT ====================

async function assign(id, assignedTo, user) {
  if (user.role !== "admin") {
    return false;
  }

  const issue = await Issue.findById(id);

  if (!issue) return null;

  issue.assignedTo = assignedTo;
  issue.assignedAt = new Date();

  if (issue.status === "submitted") {
    issue.status = "acknowledged";

    issue.timeline.push({
      status: "acknowledged",
      by: user.name,
      role: user.role,
    });
  }

  await issue.save();

  return forUser(issue, user);
}

async function setPriority(id, priority) {
  return Issue.findByIdAndUpdate(
    id,
    { priority },
    { new: true, runValidators: true }
  );
}

// ==================== WORK UPDATES / COMMENTS ====================

async function comment(id, body, user) {
  const issue = await Issue.findById(id);

  if (!issue) return null;

  // Only the assigned staff member or admin can add internal updates.
  if (
    user.role === "staff" &&
    issue.assignedTo !== user.name
  ) {
    return false;
  }

  if (!["staff", "admin"].includes(user.role)) {
    return false;
  }

  if (typeof body !== "string" || !body.trim()) {
    return false;
  }

  issue.comments.push({
    body: body.trim(),
    author: user.name,
    role: user.role,
    internal: true,
  });

  await issue.save();

  return forUser(issue, user);
}

// ==================== SAVE ISSUE ====================

async function toggleSave(id, user) {
  const issue = await Issue.findById(id);

  if (!issue) return null;

  const savedBy = (issue.savedBy || []).map(String);
  const userId = String(user.id);

  issue.savedBy = savedBy.includes(userId)
    ? savedBy.filter((item) => item !== userId)
    : [...savedBy, user.id];

  await issue.save();

  return forUser(issue, user);
}

// ==================== MAP ====================

async function createIssue(issueData) {
  const {
    title,
    type,
    status,
    latitude,
    longitude,
  } = issueData;

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error("Valid latitude and longitude are required");
  }

  return Issue.create({
    title,
    type,
    category: type || "Other",
    description: issueData.description || title,

    status: status || "submitted",
    priority: "medium",

    latitude: lat,
    longitude: lng,
    lat,
    lng,

    location: {
      type: "Point",
      coordinates: [lng, lat],
    },

    ward: issueData.ward || "Unknown",
  });
}

async function getNearbyIssues(latitude, longitude, radius = 2000, user) {
  if (!user) {
    throw new Error("Authentication required");
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  const distanceLimit = Number(radius);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(distanceLimit) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    distanceLimit <= 0
  ) {
    throw new Error("Invalid location or radius");
  }

  // Staff can only see issues assigned to them.
  // Citizen and Admin retain the existing nearby-issue visibility.
  const accessFilter =
    user.role === "staff"
      ? { assignedTo: user.name }
      : {};

  const geoRows = await Issue.find({
    ...accessFilter,
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        $maxDistance: distanceLimit,
      },
    },
  }).lean();

  // Also support older issues that may not have GeoJSON location data.
  const latDelta = distanceLimit / 111320;
  const lngDelta =
    distanceLimit / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const legacyRows = await Issue.find({
    ...accessFilter,
    $or: [
      {
        latitude: {
          $gte: lat - latDelta,
          $lte: lat + latDelta,
        },
        longitude: {
          $gte: lng - lngDelta,
          $lte: lng + lngDelta,
        },
      },
      {
        lat: {
          $gte: lat - latDelta,
          $lte: lat + latDelta,
        },
        lng: {
          $gte: lng - lngDelta,
          $lte: lng + lngDelta,
        },
      },
    ],
  }).lean();

  // Merge GeoJSON and legacy results without duplicates.
  const uniqueRows = new Map();

  for (const issue of [...geoRows, ...legacyRows]) {
    uniqueRows.set(String(issue._id), issue);
  }

  // Calculate actual distance and return the fields used by the map.
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const nearbyIssues = [...uniqueRows.values()]
    .map((issue) => {
      const issueLat =
        issue.latitude ??
        issue.lat ??
        issue.location?.coordinates?.[1];

      const issueLng =
        issue.longitude ??
        issue.lng ??
        issue.location?.coordinates?.[0];

      if (
        !Number.isFinite(Number(issueLat)) ||
        !Number.isFinite(Number(issueLng))
      ) {
        return null;
      }

      const issueLatitude = Number(issueLat);
      const issueLongitude = Number(issueLng);

      const dLat = toRadians(issueLatitude - lat);
      const dLng = toRadians(issueLongitude - lng);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat)) *
          Math.cos(toRadians(issueLatitude)) *
          Math.sin(dLng / 2) ** 2;

      const distance =
        6371000 *
        2 *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distance > distanceLimit) {
        return null;
      }

      return {
        id: String(issue._id),
        title: issue.title,
        description: issue.description,
        type: issue.type,
        category: issue.category,
        status: issue.status,
        priority: issue.priority,
        latitude: issueLatitude,
        longitude: issueLongitude,
        lat: issueLatitude,
        lng: issueLongitude,
        locationText: issue.locationText,
        ward: issue.ward,
        createdAt: issue.createdAt,
        distance: Math.round(distance),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

  return nearbyIssues;
}

module.exports = {
  list,
  getOne,
  create,
  setStatus,
  assign,
  setPriority,
  comment,
  toggleSave,
  createIssue,
  getNearbyIssues,
};