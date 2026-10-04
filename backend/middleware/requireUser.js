function requireUser(req, res, next) {
  const role = req.header("x-role");
  const name = req.header("x-name");
  const id = req.header("x-user-id");
  if (!role || !name) return res.status(401).json({ message: "Missing user" });
  req.user = { role, name, id: id || name };
  next();
}

module.exports = requireUser;