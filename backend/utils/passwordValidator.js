
const COMMON = [
  "password", "passw0rd", "qwerty", "letmein", "welcome",
  "admin", "kolkata", "smartcity", "smartkolkata",
  "123456", "abc123",
];

const FORBIDDEN_EXAMPLES = [
  "lantern47Pebble!orchid",
  "copper%Meadow318violin&Tundra",
];

function validatePassword(password, options = {}) {
  const {
    role,
    name = "",
    email = "",
  } = options;

  const isAdmin = role === "admin";
  const minLen = isAdmin ? 16 : 10;
  const maxLen = 128;

  if (typeof password !== "string" || !password) {
    return "Password is required.";
  }

  if (password.length < minLen) {
    return `Use at least ${minLen} characters.`;
  }

  if (password.length > maxLen) {
    return `Password must be at most ${maxLen} characters.`;
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Use both upper and lower case letters.";
  }

  if (!/[0-9]/.test(password)) {
    return "Include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Include at least one symbol.";
  }

  const lower = password.toLowerCase();

  const safeEmail = typeof email === "string" ? email : "";
  const safeName = typeof name === "string" ? name : "";

  const local = (safeEmail.split("@")[0] || "").toLowerCase();

const normalizedLocal = local.replace(/[^a-z0-9]/g, "");
const normalizedPassword = lower.replace(/[^a-z0-9]/g, "");

if (
  normalizedLocal.length >= 4 &&
  normalizedPassword.includes(normalizedLocal)
) {
  return "Password must not contain the part of your email before @.";
}

  const nameParts = safeName
    .toLowerCase()
    .split(/[\s._-]+/)
    .filter((part) => part.length >= 4);

  for (const part of nameParts) {
    if (lower.includes(part)) {
      return "Password must not contain a word from your name.";
    }
  }

  for (const bad of COMMON) {
    if (lower.includes(bad)) {
      return "This password is too common.";
    }
  }

  for (const example of FORBIDDEN_EXAMPLES) {
    if (lower === example.toLowerCase()) {
      return "This password is not allowed.";
    }
  }

  return null;
}

module.exports = { validatePassword };