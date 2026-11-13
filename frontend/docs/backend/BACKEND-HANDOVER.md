# Smart Kolkata · system reference

How the finished system works: setup, every endpoint, live event and privacy rule. Code comments
point here by section (A1–A8, B1–B4). Frontend: React + Vite (`frontend/`). Backend: Node, Express 5,
MongoDB, Socket.io (`backend/`). Three roles only: `citizen`, `staff`, `admin`.

There is no sample data and no offline desk. Every screen reads the server, and every change is
pushed live to the people allowed to see it.

---

## A1 · Setup

**Backend** (`backend/`)

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in. `JWT_SECRET` must be 32+ characters; the server
   refuses to start without it. Never commit `.env` or `config/serviceAccountKey.json`.
3. First accounts: put `SEED_n="role|Full Name|email|password|…"` lines in `.env` (format in
   `.env.example`, values in double quotes), run `npm run seed`, then delete the lines. Every
   password is checked against the rules in A2; nothing is seeded if one fails. Existing emails are
   skipped. No password is ever printed.
4. `npm run dev`

**Frontend** (`frontend/`): `npm install`, `.env` with `VITE_API_URL=http://localhost:5000/api`
(plus the map and Firebase keys), `npm run dev`.

| Backend variable | Use |
|---|---|
| `MONGO_URI`, `JWT_SECRET`, `PORT`, `NODE_ENV` | core |
| `FRONTEND_URL` | allowed origins (comma-separated) for CORS and Socket.io, and the base of email links |
| `COOKIE_SAMESITE` | `lax` (default). Set `none` only when the frontend and API are on different sites; it forces `Secure` (HTTPS) |
| `COOKIE_SECURE` | `true` forces the cookie's Secure flag (always on when `NODE_ENV=production`) |
| `API_PUBLIC_URL` | base of photo URLs |
| `SMTP_EMAIL`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SUPPORT_EMAIL` | staff setup links, resets, email change, contact form |
| `CPCB_API_KEY`, `CPCB_AQI_RESOURCE_ID` | air quality (data.gov.in) |
| `TOMTOM_API_KEY` | traffic flow |
| `FIREBASE_SERVICE_ACCOUNT` or `config/serviceAccountKey.json` | Google sign-in for citizens (optional: without it only that is off) |

**Conventions.** Base path `/api`, JSON in and out. Errors are `{ message }` written for people, with
the right status (400, 401, 403, 404, 409, 413, 422, 429, 500). Lists are `{ items, total }`. Times are
stored in UTC and shown in IST, 24-hour. Every text field runs the keyboard-mash check
(`utils/textGuard.js`, an exact copy of the frontend's). Nothing a person made is ever deleted:
accounts, issues and community items are marked removed or hidden. Request bodies are stripped of
`$`-keys (`middleware/sanitize.js`).

## A2 · Sign-in, sessions, passwords

- **The session is an httpOnly cookie** (`sk_session`, `utils/sessionCookie.js`). Page scripts never
  see the token. Browsers get `{ user, session: { iat, exp } }` and the cookie; clients that send no
  `Origin` header (scripts, Postman) also get `token` in the body and use `Authorization: Bearer`.
  Changes made with the cookie must carry `X-Client-Tab` (cross-site request forgery guard; CORS
  allows only `FRONTEND_URL`). `POST /auth/session` (Bearer) turns an older version's token into
  the cookie once. `POST /auth/logout` and `/auth/logout-all` always drop the cookie.
- `POST /auth/login` `{ email, password, role }` (`user` = citizen) → `{ user, session }` + cookie. Every failure
  answers `401 "Email or password is incorrect for this desk."`. Five wrong passwords lock the
  account for 15 minutes (`429`).
- `POST /auth/register` (citizens), `POST /auth/google` (citizens with a verified Google email),
  `POST /auth/forgot-password` (same answer for every email), `POST /auth/reset-password/:token`,
  `GET /auth/me`, `POST /auth/logout`, `POST /auth/activity`.
- **Sessions.** Every sign-in is a session row; the JWT names it (`sid`). Every request and socket
  checks signature → session (not revoked, expired or idle) → user (active, same role). Lengths:
  citizen 30 days, staff 24 h, admin 12 h.
- **Away limit** (`prefs.idleSignOut`): citizen 0/60/240 min (default off), staff 30/60/240/0
  (default 60), admin 15/30/60 (default 30). Only write requests count as activity. Past the limit
  the session is revoked with `401 "Signed out after 30 min away…"`, which the sign-in page shows.
- **Passwords:** citizens and staff 10–128 characters, admin 16–128; upper and lower case, a
  number, a symbol; not containing the email name or a name word; not a common base. bcrypt cost 12.
- **One-time links:** 32 random bytes, only the SHA-256 hash stored, used once. Reset: 60 min
  (admin 15 min, at most 3 an hour; command's inbox is told after an admin reset). Staff setup and
  email change: 24 h.
- Rate limits by IP on sign-in, sign-up, Google, resets, email confirm, staff application and
  setup; contact form 5 an hour.

## A3 · Public pages

- `POST /contact`. `POST /staff-requests` `{ name, email, experience, expertise, zone, note }` gives
  the same answer whether or not the email already has an account or a request.
  `GET /staff-requests/setup?token=`, `POST /staff-requests/set-password` (staff rules; the account
  gets the zone, expertise, rank and experience from the request).
- `GET /public/board` (no sign-in): the Platform Preview's live board, meaning the latest three open
  reports' kind, zone and public status plus open and fixed-this-week counts. No titles, places or
  names. Cached for a minute.

## A4 · Account and Settings

| Endpoint | Who | Notes |
|---|---|---|
| `GET` / `PATCH /users/me` | any | display name (0–40), home zone (citizens, once every 30 days), designation and office (admin), avatar (JPEG data URL < 64 KB), `prefs` (by key). Role, email, rank and expertise are ignored |
| `DELETE /users/me` | citizen | marks the account closed ("Former resident"), ends every session; reports stay without the name |
| `POST /auth/change-password` | citizen, password sign-in | ends every other session |
| `POST /auth/change-email`, `POST /auth/confirm-email` | citizen | link to the new address; the old one is told |
| `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all` | any | ending a session drops its live connection |
| `GET /users/names?ids=` | any | citizens get "Field crew" / "City Command" for staff and admin |
| `GET /users/me/export` | any | the person's own data |

Account fields and alert preferences live on the account (every device); screen preferences (3D,
sky, motion, AQI scale) stay in the browser.

## A5 · Live updates (Socket.io)

- Handshake: the session cookie (`withCredentials`) or `auth.token` for non-browser clients, plus
  `auth: { tab }`; checked like an API request. Rooms: `user:<id>`, `sid:<session>`,
  `role:<role>`, `zone:<zone>` (citizens and staff), `issue:<id>`. A person joins an issue room when
  they file, follow, back or are assigned it (and leaves when that ends).
- Every payload carries `{ at, actorId, actorTab }`. The tab that acted skips its own echo
  (`actorTab` = its `X-Client-Tab` header); the person's other tabs and devices update.
- Payloads carry ids, never names a citizen mustn't see; screens read the item again through the
  API, which masks it.
- Every minute the server closes connections whose session expired, was revoked or is idle past the
  away limit, so an unattended desk stops receiving updates. When the server closes a connection the
  desk checks its session at once and signs out.
- After any reconnect every store reads its data again (`stream:resumed`).
- Top bar: **Live** (connected), **Reconnecting** (dropped under 20 s ago), **Offline · 3m** (how long
  the screen has gone without updates).

| Event | To |
|---|---|
| `issue:filed` | admin, the zone, every citizen and crew (a "read it again") |
| `issue:assigned` | admin, the old and new crew |
| `issue:status`, `issue:close-requested`, `issue:close-withdrawn`, `issue:sent-back`, `issue:resolved` | full detail: admin and the crew on the file. Citizens: a bare `issue:status` only when the public status changes; the close gate and every reason stay internal |
| `issue:priority`, `issue:note` | admin and the crew on the file; a public note also to the issue room |
| `issue:supported`, `issue:removed`, `issue:restored`, `issue:request`, `issue:request-decided` | admin, the crew, and the people concerned |
| `profile:updated`, `policy:changed`, `staff:changed`, `staff:duty`, `community:changed`, `notification:new`, `city:metrics` | as named in their sections |

## A6 · Service windows

`GET /policy` (any), `PUT /policy` (admin), `GET /policy/history` (admin). Table:
`{ version, priority: { critical, high, medium, low }, ceilings: { <category>: hours } }`; whole hours
1–720, critical ≤ high ≤ medium ≤ low. Each save adds a version, writes the audit row
("Service windows changed: Critical 12h → 6h · …") and emits `policy:changed`. Running issues keep
their window; a priority change recalculates from the report time.

## A7 · Issues

`GET /issues`, `GET /issues/:id`, `POST /issues` (citizen, multipart, 0–3 photos checked by their
bytes, 10 a day), `PATCH /issues/:id/assign | status | priority`, `POST /issues/:id/comments |
support | follow | withdraw | requests | dismiss | merge | restore`,
`PATCH /issues/:id/requests/:reqId(/seen)`, `GET /issues/:id/duplicates`. Every change answers
`{ issue, related? }` in the caller's view, writes one audit row and emits its events.

Status moves: dispatch (New → Acknowledged), start, request close (note ≥ 12), recall (≥ 8),
confirm (≥ 8), send back (≥ 12, counts the return). Command's Undo for a dispatch, dismissal or merge
puts the file back exactly (within 2 minutes).

**Who sees what.** Admin: everything. The crew on the file: everything. Other staff: the work,
without citizens' names, internal notes, timeline notes or return reasons. Citizens: the public
form. Staff are "Field crew" and command is "City Command"; no internal notes, timeline notes,
reasons or account ids; "pending confirmation" shows as In Progress; someone else's report carries no
reporter; other backers are counted, not named.

## A8 · Audit trail

`GET /audit` (admin): `{ items, total, page }`, newest first; filters `kind`, `role`, `actorId`,
`issueId`, `from`, `to`, `q`, `page`. Names are read when the trail is viewed, so renames carry.
Kinds: filed, dispatch, status, priority, request, removal, desk, community, policy, profile, auth.
Never passwords, tokens, links or bodies. `GET /audit/mine` (staff, citizens): the rows about the
person, masked for citizens; it feeds their notifications and field log.

---

## B1 · Staff Desk

`GET /staff` (admin): staff accounts plus cleared people awaiting their first sign-in
(`req-<id>`). `PATCH /staff/:id/rank | verify | zone`, `DELETE /staff/:id` (marks inactive, ends
sessions, returns open files to dispatch), `PATCH /staff/me/duty` (staff, admin),
`GET /staff/coverage` (any: on-duty counts by zone and expertise, no names). Clearance:
`GET /staff-requests?status=`, `PATCH /staff-requests/:id/approve { rank }` (`{ request, sent }`; a
failed email shows "Key not sent"), `PATCH /:id/reject`, `POST /:id/resend-setup`. The first sign-in
marks the person uplinked. Every action writes a `desk` audit row with `verb` and `subject`.

## B2 · Notifications

The inbox is built on the person's device from the trails they may see (`/audit` or
`/audit/mine`, `/community`) through one set of recipient rules (`store/notifyStore.js`), so each
item reads the live issue. Time-based items (windows closing or breached, polls ending) are worked
out from live data every minute. Read state is kept on the account,
`GET` / `PUT /notifications/read-state`, so it's the same on every device.

## B3 · Community

`GET /community`: the whole board, masked per role (citizens see no other person's id or name;
backers, concerns and votes are counts; crews and command show as roles; only announcements meant
for them). Actions: `POST /community/proposals`, `/proposals/:id/signal | concern | photo`,
`/proposals/:id/responses` (admin, staff), `PATCH /proposals/:id/decision` (admin: approved,
planned, not now, poll, or a work order filed for the author), `POST /community/polls`,
`/polls/:id/vote`, `PATCH /polls/:id/close`, `POST /community/announcements`, `/moderate` (hide, never
delete), `/notices`, `PATCH /notices/:id/end` (the crew on its own open file),
`POST /community/issues/:id/signal` (citizens: fixed / still happening) and `/check` (the crew's
answer). Each action writes a trail entry, an audit row with its `PRP-`/`POL-`/`ANN-`/`WN-` id
(the Audit Log opens it in the Community drawer) and `community:changed`.

## B4 · City Health

The server polls real sources for all 16 places on the 3D city and keeps every check (30 days):

| Reading | Source | Every | Budget |
|---|---|---|---|
| Air quality (CPCB AQI) | nearest Kolkata CPCB station, data.gov.in | 15 min | 1 call |
| Traffic (% of free-flow speed) | TomTom Traffic Flow, nearest road segment | 15 min | 1,536 calls a day (free tier 2,500) |
| Rainfall (mm, past hour), heat and feels-like (°C) | Open-Meteo, no key | 10 min | 1 call for all zones |

CPCB's data.gov.in feed publishes each pollutant's AQI **sub-index** (already averaged and scaled by
CPCB), not a concentration. A station's AQI is the highest sub-index among its pollutants reported
in the past 3 hours, with at least three pollutants including PM2.5 or PM10 (CPCB's rule).

`GET /metrics/live` → per zone `{ aqi, traffic, rain, heat, feels, at, history, providers }` and
`city: { sensors, uptime }`; `city:metrics` pushes each new reading. A source that fails keeps its
last value with its time for a while, and is never invented: a missing reading shows "No reading".
Keys stay on the server.

---

## Troubleshooting

| You see | Likely cause |
|---|---|
| CORS error | `FRONTEND_URL` doesn't match the frontend address exactly (no trailing slash) |
| Top bar stays Offline | backend not running, or Socket.io refused the token: sign in again |
| City Health shows "No reading" | that source's key is missing in `backend/.env`, or the source is down (see the `[CityMetrics]` lines in the backend log) |
| Staff Desk shows "Key not sent" | SMTP settings missing or wrong; fix them and re-transmit |
| Signed out with "after 30 min away" | the away limit (Settings) |
