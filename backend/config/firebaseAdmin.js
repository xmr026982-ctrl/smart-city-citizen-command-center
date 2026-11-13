/* Firebase Admin is only needed for Google sign-in (citizens).
   The key is read from config/serviceAccountKey.json, or from the
   FIREBASE_SERVICE_ACCOUNT env var (the same JSON on one line).
   If neither exists the server still starts and Google sign-in
   answers 503; every other feature works. Never commit the key. */
const fs = require("fs");
const path = require("path");

const KEY_FILE = path.join(__dirname, "serviceAccountKey.json");

function readKey() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    if (fs.existsSync(KEY_FILE)) {
      return JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
    }
  } catch (error) {
    console.error("Firebase key could not be read:", error.message);
  }
  return null;
}

let adminAuth = null;
const key = readKey();

if (key) {
  try {
    const { initializeApp, cert, getApps } = require("firebase-admin/app");
    const { getAuth } = require("firebase-admin/auth");
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(key) });
    adminAuth = getAuth(app);
    console.log("Google sign-in: on");
  } catch (error) {
    console.error("Google sign-in: off (Firebase failed to start):", error.message);
  }
} else {
  console.warn("Google sign-in: off (no Firebase service account key).");
}

module.exports = { adminAuth, googleSignInOn: Boolean(adminAuth) };
