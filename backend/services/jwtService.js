
const jwt = require("jsonwebtoken");

const getSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters."
    );
  }

  return secret;
};

const generateToken = (user, sessionId, expiresAt) => {
  if (!user?._id || !user?.role || !sessionId || !expiresAt) {
    throw new Error(
      "User, session ID and expiry date are required."
    );
  }

  const expirySeconds = Math.floor(
    new Date(expiresAt).getTime() / 1000
  );

  if (!Number.isFinite(expirySeconds) ||
      expirySeconds <= Math.floor(Date.now() / 1000)) {
    throw new Error("Invalid session expiry date.");
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      sid: sessionId.toString(),
      exp: expirySeconds
    },
    getSecret()
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, getSecret());
};

module.exports = {
  generateToken,
  verifyToken
};
