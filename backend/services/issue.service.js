const Issue = require("../models/Issue");

const createIssue = async (issueData) => {
  const { title, type, status, latitude, longitude } = issueData;

  const issue = await Issue.create({
    title,
    type,
    status: status || "Pending",
    latitude,
    longitude,
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
  });

  return issue;
};

const getNearbyIssues = async (latitude, longitude, radius = 2000) => {
  const issues = await Issue.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: radius,
      },
    },
  });

  return issues;
};

module.exports = {
  createIssue,
  getNearbyIssues,
};