const mongoose = require("mongoose");
const Issue = require("../models/Issue");

const getIssues = async (req, res) => {
  try {
    const {
      status,
      category,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate("reportedBy", "name email ward")
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      Issue.countDocuments(filter)
    ]);

    res.json({
      issues,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error("Get issues error:", error);

    res.status(500).json({
      message: "Failed to fetch issues."
    });
  }
};

const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid issue ID."
      });
    }

    const issue = await Issue.findById(id)
      .populate("reportedBy", "name email ward")
      .populate("assignedTo", "name email role");

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found."
      });
    }

    res.json({
      issue
    });
  } catch (error) {
    console.error("Get issue error:", error);

    res.status(500).json({
      message: "Failed to fetch issue."
    });
  }
};

const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "submitted",
      "acknowledged",
      "in_progress",
      "resolved",
      "rejected"
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid issue ID."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid issue status."
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found."
      });
    }

    const previousStatus = issue.status;

    issue.status = status;

    await issue.save();

    const updatedIssue = await Issue.findById(id)
      .populate("reportedBy", "name email ward")
      .populate("assignedTo", "name email role");

    // Real-time event
    const { getIO } = require("../socket/socket");

    getIO().to("admin-room").emit("issue-status-updated", {
      issue: updatedIssue,
      previousStatus,
      updatedBy: {
        id: req.user._id,
        name: req.user.name,
        role: req.user.role
      }
    });

    getIO().to("moderator-room").emit("issue-status-updated", {
      issue: updatedIssue,
      previousStatus,
      updatedBy: {
        id: req.user._id,
        name: req.user.name,
        role: req.user.role
      }
    });

    res.json({
      message: "Issue status updated successfully.",
      issue: updatedIssue
    });
  } catch (error) {
    console.error("Update issue status error:", error);

    res.status(500).json({
      message: "Failed to update issue status."
    });
  }
};

const createIssue = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      latitude,
      longitude
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Issue title is required."
      });
    }

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        message: "Location is required."
      });
    }

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
      return res.status(400).json({
        message: "Invalid latitude or longitude."
      });
    }

    const allowedCategories = [
      "road_damage",
      "garbage",
      "water_leakage",
      "street_light",
      "encroachment",
      "drainage",
      "other"
    ];

    const issueCategory = category || "other";

    if (!allowedCategories.includes(issueCategory)) {
      return res.status(400).json({
        message: "Invalid issue category."
      });
    }

    const issue = await Issue.create({
      title: title.trim(),
      description: description || "",
      category: issueCategory,

      location: {
        type: "Point",
        coordinates: [lng, lat]
      },

      reportedBy: req.user._id,
      status: "submitted"
    });

    const populatedIssue = await Issue.findById(issue._id)
      .populate("reportedBy", "name email ward")
      .populate("assignedTo", "name email role");

    // Notify admin and moderators in real time.
    const { getIO } = require("../socket/socket");

    getIO().to("admin-room").emit("new-issue", {
      issue: populatedIssue
    });

    getIO().to("moderator-room").emit("new-issue", {
      issue: populatedIssue
    });

    res.status(201).json({
      message: "Issue reported successfully.",
      issue: populatedIssue
    });
  } catch (error) {
    console.error("Create issue error:", error);

    res.status(500).json({
      message: "Failed to create issue."
    });
  }
};

module.exports = {
    createIssue,
    getIssues,
    getIssueById,
    updateIssueStatus
};