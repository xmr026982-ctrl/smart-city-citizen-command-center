/**
 * Seed sample issues into MongoDB Atlas.
 *
 * Usage (from backend/):
 *   npm run db:seed-issues
 *   node scripts/seedIssues.js
 *
 * Safe to re-run: upserts by title + ward + reportedBy (no duplicates).
 * Staff filtering uses exact match: assignedTo === logged-in staff name.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Issue = require("../models/Issue");

// Fixed timestamps so re-seeds stay stable and timelines look realistic
const daysAgo = (n, hour = 10, minute = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
};

/**
 * Build a GeoJSON Point + flat lat/lng fields from a single pair.
 * coordinates order is [longitude, latitude] per GeoJSON.
 */
function withCoords(lat, lng) {
  return {
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    location: {
      type: "Point",
      coordinates: [lng, lat],
    },
  };
}

const samples = [
  {
    title: "Broken streetlight near Dharmatala",
    description:
      "Streetlight is not working after sunset near the crossing. Dark stretch after 7pm.",
    type: "Streetlight",
    category: "Street Lighting",
    locationText: "Dharmatala crossing, Kolkata",
    ward: "Dharmatala",
    ...withCoords(22.5604, 88.3519),
    reportedBy: "Demo Citizen",
    reporterId: "demo-citizen-001",
    status: "in_progress",
    priority: "high",
    assignedTo: "Koushik Bhowmik",
    assignedAt: daysAgo(3, 14, 40),
    photos: [],
    comments: [],
    savedBy: [],
    timeline: [
      {
        status: "submitted",
        at: daysAgo(4, 8, 10),
        by: "Demo Citizen",
        role: "citizen",
        note: "Reported via citizen app",
      },
      {
        status: "acknowledged",
        at: daysAgo(3, 14, 40),
        by: "Priti Sarkar",
        role: "admin",
        note: "Assigned to Koushik Bhowmik",
      },
      {
        status: "in_progress",
        at: daysAgo(2, 9, 15),
        by: "Koushik Bhowmik",
        role: "staff",
        note: "On site; ordering replacement lamp",
      },
    ],
  },
  {
    title: "Pothole on AJC Bose Road",
    description:
      "Large pothole on the carriageway is slowing peak-hour traffic and risking vehicle damage.",
    type: "Road",
    category: "Road Damage",
    locationText: "AJC Bose Road, Kolkata",
    ward: "B.B.D. Bagh",
    ...withCoords(22.5448, 88.3426),
    reportedBy: "Demo Citizen",
    reporterId: "demo-citizen-002",
    status: "acknowledged",
    priority: "critical",
    assignedTo: "Subhomoy Ghosh",
    assignedAt: daysAgo(2, 11, 0),
    photos: [],
    comments: [],
    savedBy: [],
    timeline: [
      {
        status: "submitted",
        at: daysAgo(3, 7, 30),
        by: "Demo Citizen",
        role: "citizen",
        note: "Reported via citizen app",
      },
      {
        status: "acknowledged",
        at: daysAgo(2, 11, 0),
        by: "Priti Sarkar",
        role: "admin",
        note: "Assigned to Subhomoy Ghosh",
      },
    ],
  },
  {
    title: "Water leakage near College Street",
    description:
      "Water is leaking from a municipal pipe beside the footpath and flooding the walkway.",
    type: "Water Supply",
    category: "Water Supply",
    locationText: "College Street, Kolkata",
    ward: "College Street",
    ...withCoords(22.5747, 88.3639),
    reportedBy: "Demo Citizen",
    reporterId: "demo-citizen-003",
    status: "acknowledged",
    priority: "medium",
    assignedTo: "Taras Hembram",
    assignedAt: daysAgo(1, 16, 20),
    photos: [],
    comments: [],
    savedBy: [],
    timeline: [
      {
        status: "submitted",
        at: daysAgo(1, 10, 5),
        by: "Demo Citizen",
        role: "citizen",
        note: "Reported via citizen app",
      },
      {
        status: "acknowledged",
        at: daysAgo(1, 16, 20),
        by: "Priti Sarkar",
        role: "admin",
        note: "Assigned to Taras Hembram",
      },
    ],
  },
  {
    title: "Garbage collection needed near Shyambazar",
    description:
      "Uncollected waste has piled up beside the road for several days and needs urgent clearance.",
    type: "Sanitation",
    category: "Sanitation",
    locationText: "Shyambazar, Kolkata",
    ward: "Shyambazar",
    ...withCoords(22.6018, 88.3737),
    reportedBy: "Demo Citizen",
    reporterId: "demo-citizen-004",
    status: "acknowledged",
    priority: "low",
    assignedTo: "Sayan Majumder",
    assignedAt: daysAgo(1, 9, 0),
    photos: [],
    comments: [],
    savedBy: [],
    timeline: [
      {
        status: "submitted",
        at: daysAgo(2, 18, 45),
        by: "Demo Citizen",
        role: "citizen",
        note: "Reported via citizen app",
      },
      {
        status: "acknowledged",
        at: daysAgo(1, 9, 0),
        by: "Priti Sarkar",
        role: "admin",
        note: "Assigned to Sayan Majumder",
      },
    ],
  },
  {
    title: "Streetlight outage near Ballygunge",
    description:
      "Streetlight near the park entrance is not illuminating. Area is unsafe after dark.",
    type: "Streetlight",
    category: "Street Lighting",
    locationText: "Ballygunge, Kolkata",
    ward: "Ballygunge",
    ...withCoords(22.5275, 88.3665),
    reportedBy: "Demo Citizen",
    reporterId: "demo-citizen-005",
    status: "pending_review",
    priority: "high",
    assignedTo: "Swarup Sutradhar",
    assignedAt: daysAgo(5, 12, 0),
    photos: [],
    comments: [],
    savedBy: [],
    timeline: [
      {
        status: "submitted",
        at: daysAgo(6, 7, 20),
        by: "Demo Citizen",
        role: "citizen",
        note: "Reported via citizen app",
      },
      {
        status: "acknowledged",
        at: daysAgo(5, 12, 0),
        by: "Priti Sarkar",
        role: "admin",
        note: "Assigned to Swarup Sutradhar",
      },
      {
        status: "in_progress",
        at: daysAgo(3, 10, 30),
        by: "Swarup Sutradhar",
        role: "staff",
        note: "Replaced bulb; testing circuit",
      },
      {
        status: "pending_review",
        at: daysAgo(1, 15, 0),
        by: "Swarup Sutradhar",
        role: "staff",
        note: "Work completed; awaiting admin review",
      },
    ],
  },
];

function assertSample(doc, index) {
  const required = ["title", "description", "category", "ward", "status", "priority"];
  for (const key of required) {
    if (doc[key] == null || doc[key] === "") {
      throw new Error(`Sample[${index}] missing required field: ${key}`);
    }
  }
  if (!Number.isFinite(doc.latitude) || !Number.isFinite(doc.longitude)) {
    throw new Error(`Sample[${index}] has invalid coordinates`);
  }
  if (
    !doc.location ||
    doc.location.type !== "Point" ||
    !Array.isArray(doc.location.coordinates) ||
    doc.location.coordinates.length !== 2
  ) {
    throw new Error(`Sample[${index}] has invalid GeoJSON location`);
  }
  if (doc.assignedTo != null && typeof doc.assignedTo !== "string") {
    throw new Error(
      `Sample[${index}] assignedTo must be a string (staff display name), got ${typeof doc.assignedTo}`
    );
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is missing. Set it in backend/.env before running the seed script."
    );
  }

  samples.forEach(assertSample);

  console.log("Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  const operations = samples.map((doc) => ({
    updateOne: {
      filter: {
        title: doc.title,
        ward: doc.ward,
        reportedBy: doc.reportedBy,
      },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await Issue.bulkWrite(operations, { ordered: true });

  console.log("—".repeat(48));
  console.log(`Atlas seed complete.`);
  console.log(`  Upserted (new):  ${result.upsertedCount}`);
  console.log(`  Modified:        ${result.modifiedCount}`);
  console.log(`  Matched:         ${result.matchedCount}`);
  console.log("—".repeat(48));
  console.log("Assigned staff names (must match login display names exactly):");
  for (const s of samples) {
    console.log(`  • ${s.title}`);
    console.log(`      → ${s.assignedTo}  [${s.status}]`);
  }
  console.log("—".repeat(48));
  console.log(
    "Staff list API filters with: assignedTo === req.user.name (exact string)."
  );
}

main()
  .catch((error) => {
    console.error("Atlas seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });