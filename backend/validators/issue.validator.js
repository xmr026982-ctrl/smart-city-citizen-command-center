function createIssue(body) {
  const required = ["title", "description", "category", "location", "ward", "lat", "lng"];
  const missing = required.find((key) => body[key] === undefined || body[key] === "");
  if (missing) return `${missing} is required`;
  if (!Number.isFinite(Number(body.lat)) || !Number.isFinite(Number(body.lng))) return "lat and lng are required";
  return "";
}

module.exports = { createIssue };