
const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

const path = require("path");

const fs = require("fs");

let app;

if (getApps().length > 0) {
  app = getApps()[0];
} else {
  let credential;

  // Option A: Use a JSON file if it exists locally.
  const serviceAccountPath = path.join(
    __dirname,
    "serviceAccountKey.json"
  );

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    credential = cert(serviceAccount);
  } else {
    // Option B: Use the service-account JSON stored in .env.
    const serviceAccountJson =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      try {
        credential = cert(JSON.parse(serviceAccountJson));
      } catch (error) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."
        );
      }
    } else {
      throw new Error(
        "Firebase Admin credentials are missing. " +
        "Provide a local serviceAccountKey.json file " +
        "or configure FIREBASE_SERVICE_ACCOUNT_JSON."
      );
    }
  }

  app = initializeApp({
    credential,
  });
}

const adminAuth = getAuth(app);

module.exports = { adminAuth };
