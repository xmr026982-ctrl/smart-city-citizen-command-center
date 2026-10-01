const issueService = require("../services/issue.service");

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
      distance
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

module.exports = {
  createIssue,
  getNearbyIssues,
};