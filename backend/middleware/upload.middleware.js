const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

function fileFilter(_req, file, cb) {
  const ok = ["image/png", "image/jpeg", "image/jpg"].includes(file.mimetype);
  cb(ok ? null : new Error("PNG or JPEG only"), ok);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});
