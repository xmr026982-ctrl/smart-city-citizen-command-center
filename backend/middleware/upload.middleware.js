const multer = require("multer");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
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