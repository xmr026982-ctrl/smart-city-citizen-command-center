require("dotenv").config();

const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
const Issue = require("../models/Issue");

async function backfillGeoLocation() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) throw new Error("MONGO_URI is not defined in .env");

  await mongoose.connect(mongoURI);

  try {
    const issues = await Issue.find(
      {},
      { latitude: 1, longitude: 1, lat: 1, lng: 1, location: 1 }
    ).lean();

    let updated = 0;
    let removed = 0;
    const operations = [];

    for (const issue of issues) {
      const latitude = Number(issue.latitude ?? issue.lat ?? issue.location?.coordinates?.[1]);
      const longitude = Number(issue.longitude ?? issue.lng ?? issue.location?.coordinates?.[0]);
      const valid =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;

      if (valid) {
        const current = issue.location;
        const alreadyValid =
          current?.type === "Point" &&
          Array.isArray(current.coordinates) &&
          current.coordinates.length === 2 &&
          Number(current.coordinates[0]) === longitude &&
          Number(current.coordinates[1]) === latitude;

        if (!alreadyValid) {
          operations.push({
            updateOne: {
              filter: { _id: issue._id },
              update: {
                $set: {
                  latitude,
                  longitude,
                  lat: latitude,
                  lng: longitude,
                  location: { type: "Point", coordinates: [longitude, latitude] },
                },
              },
            },
          });
          updated += 1;
        }
      } else if (issue.location) {
        operations.push({
          updateOne: {
            filter: { _id: issue._id },
            update: { $unset: { location: "" } },
          },
        });
        removed += 1;
      }
    }

    if (operations.length) {
      await Issue.collection.bulkWrite(operations, { ordered: false });
    }

    await Issue.collection.createIndex({ location: "2dsphere" });
    console.log(`GeoJSON migration complete. Updated: ${updated}; removed invalid location: ${removed}.`);
  } finally {
    await mongoose.disconnect();
  }
}

backfillGeoLocation().catch((error) => {
  console.error("GeoJSON migration failed:", error.message);
  process.exitCode = 1;
});
