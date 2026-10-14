const ALLOWED_ROLES = new Set(["citizen", "staff", "admin"]);

function requireUser(req, res, next) {
  const role = String(req.get("x-role") || "").trim().toLowerCase();
  const name = String(req.get("x-name") || "").trim();
  const id = String(req.get("x-user-id") || "").trim();

  if (!role || !name) {
    return res.status(401).json({
      success: false,
      message: "Missing user identity. Please sign in again.",
    });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return res.status(403).json({
      success: false,
      message: "Invalid user role.",
    });
  }

  req.user = {
    role,
    name,
    id: id || name,
  };

  return next();
}

module.exports = requireUser;
