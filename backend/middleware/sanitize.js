/* Strips keys that start with "$" or contain "." from request bodies and
   route params, so a body like { "email": { "$ne": "" } } can't turn into a
   MongoDB operator. Works with Express 5 (express-mongo-sanitize doesn't). */
function clean(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = clean(value[i], depth + 1);
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) delete value[key];
    else value[key] = clean(value[key], depth + 1);
  }
  return value;
}

function sanitize(req, _res, next) {
  if (req.body && typeof req.body === "object") clean(req.body);
  if (req.params && typeof req.params === "object") clean(req.params);
  next();
}

module.exports = sanitize;
module.exports.clean = clean;
