
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDir = path.resolve(__dirname, "../uploads/issues");

fs.mkdirSync(uploadDir, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 3;

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = ALLOWED_TYPES[file.mimetype];

    if (!extension) {
      const error = new Error("Only JPEG, PNG and WebP images are allowed.");
      error.status = 400;
      return cb(error);
    }

    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  },
  fileFilter: (_req, file, cb) => {
    if (!Object.hasOwn(ALLOWED_TYPES, file.mimetype)) {
      const error = new Error("Only JPEG, PNG and WebP images are allowed.");
      error.status = 400;
      return cb(error);
    }

    cb(null, true);
  }
});

function removeUploadedFiles(files = []) {
  for (const file of files) {
    if (!file?.path) continue;

    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Could not remove rejected upload:", error.message);
      }
    }
  }
}

/**
 * Run after upload.array("photos", 3).
 * Verifies the actual file signature instead of trusting the
 * MIME type supplied by the browser.
 */
async function validateIssuePhotos(req, res, next) {
  const files = req.files || [];

  try {
    // file-type is ESM in current releases, so load it dynamically.
    const { fileTypeFromFile } = await import("file-type");

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        const error = new Error("Each photo must be 5 MB or smaller.");
        error.status = 400;
        throw error;
      }

      const detected = await fileTypeFromFile(file.path);

      if (!detected || !Object.hasOwn(ALLOWED_TYPES, detected.mime)) {
        const error = new Error(
          "A photo is not a valid JPEG, PNG or WebP image."
        );
        error.status = 400;
        throw error;
      }

      // Reject files whose browser MIME type does not match their contents.
      if (detected.mime !== file.mimetype) {
        const error = new Error(
          "A photo's file type does not match its contents."
        );
        error.status = 400;
        throw error;
      }

      // Also ensure the stored extension matches the detected image type.
      const expectedExtension = ALLOWED_TYPES[detected.mime];
      if (path.extname(file.filename).toLowerCase() !== expectedExtension) {
        const error = new Error("Invalid photo file extension.");
        error.status = 400;
        throw error;
      }
    }

    next();
  } catch (error) {
    removeUploadedFiles(files);

    if (!error.status) {
      error.status = 400;
      error.message = "Could not validate the uploaded photos.";
    }

    next(error);
  }
}

module.exports = upload;
module.exports.validateIssuePhotos = validateIssuePhotos;