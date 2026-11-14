/* The sign-in session lives in an httpOnly cookie, so page scripts can never
   read it (an XSS bug can't steal it for later use).

   - Browsers: the cookie travels with every request (fetch credentials:
     "include") and with the live connection (withCredentials).
   - Other clients (test scripts, Postman, server-to-server) send no Origin
     header; they still get the token in the response body and use
     "Authorization: Bearer <token>".
   - Changes made with the cookie must carry the app's X-Client-Tab header.
     Another website can't add a custom header without passing CORS, and CORS
     only allows FRONTEND_URL, so this blocks cross-site request forgery.

   Settings (backend/.env):
     COOKIE_SAMESITE  lax (default) | strict | none
                      "none" only when the frontend and the API are on
                      different sites (e.g. two different domains). It
                      forces Secure, which needs HTTPS.
     COOKIE_SECURE    true to force the Secure flag (always on in production)
     With "none" the cookie is also Partitioned (CHIPS), so it still works
     in browsers that block third-party cookies.
*/

const COOKIE_NAME = "sk_session";

function cookieOptions(expiresAt) {
  const sameSite = ["lax", "strict", "none"].includes(String(process.env.COOKIE_SAMESITE || "").toLowerCase())
    ? String(process.env.COOKIE_SAMESITE).toLowerCase()
    : "lax";
  const secure = sameSite === "none" || process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
  const opts = { httpOnly: true, sameSite, secure, path: "/" };
  // Frontend and API on different sites (e.g. vercel.app + onrender.com):
  // a Partitioned (CHIPS) cookie keeps working where browsers block ordinary
  // third-party cookies (Chrome Incognito, Firefox), scoped to our frontend.
  if (sameSite === "none") opts.partitioned = true;
  if (expiresAt) opts.expires = new Date(expiresAt);
  return opts;
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, cookieOptions(expiresAt));
}

function clearSessionCookie(res) {
  const { expires, ...opts } = cookieOptions(); // eslint-disable-line no-unused-vars
  res.clearCookie(COOKIE_NAME, opts);
}

/* the named cookie from a raw Cookie header ("a=1; sk_session=…") */
function readCookie(header, name = COOKIE_NAME) {
  if (typeof header !== "string" || !header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    const raw = part.slice(i + 1).trim();
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw || null;
    }
  }
  return null;
}

/* Where this request's token comes from: { token, source: "bearer" | "cookie" } or null */
function tokenFrom(req) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return { token, source: "bearer" };
  }
  const token = readCookie(req.headers.cookie);
  return token ? { token, source: "cookie" } : null;
}

/* A browser always sends Origin on these requests and gets no token in the
   body; a non-browser client (no Origin) gets it for the Bearer header. */
const wantsBodyToken = (req) => !req.headers.origin;

/* The session's start and end, safe for page scripts (no secret in it) */
function sessionInfo(session) {
  return {
    iat: session?.createdAt ? new Date(session.createdAt).getTime() : Date.now(),
    exp: session?.expiresAt ? new Date(session.expiresAt).getTime() : null,
  };
}

/* After a sign-in: cookie for browsers, token in the body for other clients */
function sendSignedIn(req, res, status, { token, session, user }) {
  setSessionCookie(res, token, session?.expiresAt);
  const body = { user, session: sessionInfo(session) };
  if (wantsBodyToken(req)) body.token = token;
  return res.status(status).json(body);
}

module.exports = {
  COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  readCookie,
  tokenFrom,
  sessionInfo,
  sendSignedIn,
};
