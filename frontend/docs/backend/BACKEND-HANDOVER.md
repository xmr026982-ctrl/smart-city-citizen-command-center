# Backend handover

**For:** Person 6 (backend and real-time, Socket.io). **From:** Person 4 (frontend).

This one document is everything the backend needs. The frontend is the finished reference: build the backend to fit it.

- **Part A** is **already wired** in the frontend. Build it exactly as written and those screens work with no frontend change. Each section ends with a check you can do in the browser.
- **Part B** is **not wired yet** in the frontend. The specs are final; the frontend side follows. Build them after Part A.

**The one rule:** this frontend plus this document are the single source of truth. If something here can't work with your setup, this document and the frontend change together (ask Person 4). Never work around it in the backend alone.

## Status at a glance

| Area | Frontend | Section |
|---|---|---|
| Clean-up of the current backend | n/a | A1 |
| Sign-in, sessions, passwords, away limit | **wired** | A2 |
| Public pages: contact, staff application, setup link | **wired** | A3 |
| Account and Settings | **wired** | A4 |
| Socket.io connection and events | **wired** (connection, profile, policy, every issue event) | A5 |
| Service windows | **wired** | A6 |
| Issues (filing, dispatch, close gate, requests, merge, photos, map) | **wired** | A7 |
| Audit trail | **wired** (command) | A8 |
| Staff Desk, roster, duty, base zone | not yet | B1 |
| Notifications | not yet | B2 |
| Community | not yet | B3 |
| City readings (air quality, traffic, rainfall, heat) | not yet | B4 |

## 1. How the frontend talks to the backend

| Part | File | What it does |
|---|---|---|
| Address | `src/config/server.js` | Reads `VITE_API_URL` (e.g. `http://localhost:5000/api`). Empty: the app runs on its own sample data and calls nothing |
| HTTP | `src/lib/api.js` | Every request. Sends `Authorization: Bearer <token>` and `X-Client-Tab: <id>`. A `401` signs the person out. Shows the server's `message` as it is |
| Live | `src/lib/socket.js`, `src/services/realtime.js` | Socket.io client. Connects to `VITE_API_URL` without `/api`, with `auth: { token, tab }`. Reconnects by itself |
| Events | `src/services/events.js` | The exact event names the server sends (A5). Stores listen there |
| Session | `src/store/authStore.js` | Keeps `token` and `user` in localStorage. Calls `GET /auth/me` on every start and trusts only that answer |

The frontend needs `npm install` once (it now depends on `socket.io-client`).

### Conventions (every endpoint)

1. **Base path** `/api`, JSON in and out (photo uploads: `multipart/form-data`).
2. **Errors:** `{ message }` with the right status: 400 bad input, 401 signed out or bad token, 403 not allowed, 404, 409 conflict, 413 too large, 422 a rule failed, 429 too many tries, 500. The screen shows `message` word for word, so write it for people ("Your current password isn't right."), never "Validation failed".
3. **Lists:** `{ items, total }`.
4. **Roles:** `citizen`, `staff`, `admin` only. The role always comes from the database, never from the request body or a header. The sign-in page may send `role: "user"`, which means citizen.
5. **People** are stored by account id. Every answer adds the person's current display name (`displayName || name`), so a renamed person is renamed everywhere.
6. **Citizens never see staff or admin names or emails.** In anything a citizen receives, staff are "Field crew" and admin is "City Command". The server applies this, not just the screen.
7. **Nothing is deleted.** People, issues, proposals and photos are marked removed (who, why, when).
8. **Every change writes one audit row** (doc 09).
9. **Every text field runs the keyboard-mash check** (`src/utils/textGuard.js`; copy it to the server unchanged) and answers 400 with `MASH_MESSAGE`.
10. **Times** are stored in UTC (ISO strings in JSON). The frontend shows IST, 24-hour.
11. **Live echo:** every Socket.io event a request causes carries `actorId` (the account) and `actorTab` (the `X-Client-Tab` header of that request). The tab that acted ignores it; the person's other tabs and devices update (A5).

## 2. Testing against the frontend

1. Backend `.env`: `FRONTEND_URL=http://localhost:5173` (the same list for the API's CORS and Socket.io's CORS).
2. Frontend `.env`: `VITE_API_URL=http://localhost:5000/api`. Leave `VITE_DEV_DESK` off: the developer desk is sample data only and never talks to the server.
3. `npm run dev` in both. Sign in on each desk. The top bar's live light should go green.

---

# Part A · Already wired (build exactly this)

## A1 · Clean the current backend first

Checked against `integrate-signin` (backend folder). Do these first: some are security problems in the code as it is today.

### 1. Remove now

| What | Why |
|---|---|
| `createModerator.js` | Has a **real password written in the code**. If the repository is or was ever public, treat it as known to everyone: delete the file, and delete that account from the database if it was ever created. Git history keeps the old file; that's why the account itself must go |
| `createAdmin.js` (root) | **Prints the admin password** in the console (`console.log("Password:", password)`). Use one seed script (section 3) instead |
| `createAccounts.js`, `scripts/createStaffAccounts.js`, `scripts/setAdminCredentials.js`, `scripts/createAdmin.js` | Four scripts doing overlapping things with different password rules (6, 8, 12 characters). Replace with the one seed script |
| `routes/testRoutes.js` | Test leftover (with a moderator route) |
| `models/staffRoutes.js` | A route file in the models folder, a copy of `routes/staffRoutes.js` |
| `GET /api/staff/dashboard` (`staffController.js`) | Returns a welcome message; the frontend doesn't use it |
| `backend/node_modules/` from git | **1,857 files are committed.** `git rm -r --cached backend/node_modules`, commit. Everyone runs `npm install` |

### 2. Fix now

| What | Change |
|---|---|
| Staff application fields | The form now sends **`experience` and `expertise`** (lower case), with the expertise **id** as the value: `electrical`, `roads`, `waste`, `water`, `civic`. `submitStaffRequest` must read these two names and store them under the same names. Stop reading `Experience`/`Expertise` and the old `qualification`/`department` fallbacks. **Until this changes, applications from the frontend are refused** |
| `.gitignore` | Add `.env` and `.env.*` (keep `!.env.example`). Today only `*.local` is ignored, so a `.env` would be committed |
| `.env.example` | Add one, listing every variable with no values: `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `SMTP_*`, `SUPPORT_EMAIL` |
| `JWT_SECRET` | At least 32 random characters. Refuse to start without it |
| `role: "moderator"` | Remove from `User`, `authController`, `adminController`, `issueRoutes`, `socket.js`. Any moderator account in the database becomes `staff` |
| Admin password in `.env` | Doc 01 section 7: a bcrypt hash in the database, never plain text |
| `server.js` | Mount the routes that exist but aren't mounted (`/api/issues`, `/api/notifications`), start Socket.io (A5) |
| Error handler | Keep yours (it's good). Make every answer `{ message }` (section 1), and log errors without request bodies (they can contain passwords) |
| Basics | Add `helmet`, rate limits on the public endpoints (A2 section 4), and strip keys starting with `$` from bodies and queries (`express-mongo-sanitize`, or a small middleware) |

### 3. One seed script

Seeds the team accounts once from `.env` lines, then the lines are deleted:

```text
SEED_1=admin|Full Name|email|password
SEED_2=staff|Full Name|email|password|Zone|expertise|Rank
SEED_3=citizen|Full Name|email|password|Zone
```

- Check every password against A2 section 3 (admin: 16+) and **stop with an error if any fails**: nothing is seeded from a weak password.
- Skip an email that already exists; never overwrite.
- Never print a password.

### 4. Existing data in Atlas

| Data | Do |
|---|---|
| Moderator accounts | Role → `staff` (or remove if they were tests) |
| The admin | Password → bcrypt hash; email unchanged |
| `User.department` | → `expertise`, lower-case id: `electrical`, `roads`, `waste`, `water`, `civic` |
| `User.ward` | Not used; `zone` is |
| `StaffRequest.Experience`, `.Expertise` | → `experience`, `expertise` (B1) |
| Old issues (categories `road_damage`, `garbage`…, status `rejected`, GeoJSON location) | Map to A7, or clear them if they're test data |

> **Check:** `git status` shows no `.env`, no `node_modules`; the server starts.

## A2 · Sign-in, sessions and passwords

### 1. The user object

Every sign-in answer, `GET /auth/me` and `PATCH /users/me` return the same shape. Never a password hash or a token in it.

```json
{
  "id": "665f…",
  "name": "Account name",
  "displayName": "",
  "email": "person@example.com",
  "role": "citizen | staff | admin",
  "zone": "Ballygunge",
  "provider": "password | google",
  "avatar": "",
  "dutyStatus": "on | break | off",
  "prefs": { "idleSignOut": 60, "inboxMuted": [], "popups": "all", "quietHours": false, "quietFrom": "22:00", "quietTo": "07:00" },
  "zoneChangedAt": "2026-11-01T10:00:00.000Z",
  "designation": "", "office": "",
  "expertise": "roads", "rank": "Specialist", "experience": "5 Years", "verified": true
}
```

- `zone`: the citizen's home zone or the staff member's base zone, exactly one of: `Shyambazar`, `B.B.D. Bagh`, `Ballygunge`, `College Street`, `B.P. Township`, `Dharmatala`. Empty for admin.
- `dutyStatus`: staff and admin only.
- `designation`, `office`: admin only. `expertise`, `rank`, `experience`, `verified`: staff only.
- `prefs`: A4.

### 2. Endpoints

| Method and path | Who | Body → answer |
|---|---|---|
| `POST /auth/login` | public | `{ email, password, role, zone? }` → `{ token, user }`. `role` is the desk the person picked (`user` = citizen) |
| | | A citizen with no saved zone and none sent → `200 { requiresZone: true, email }`. The page asks for a zone and sends the login again with `zone` |
| | | **Every** failure (wrong email, wrong password, wrong desk, inactive account) → `401 { message: "Email or password is incorrect for this desk." }`. Exactly this text, so nobody can tell whether an email exists |
| | | Locked (see 4) → `429` |
| `POST /auth/register` | public | `{ name, email, password, zone }` → `201 { token, user }` (citizen). `409` if the email exists. `422` when the password fails a rule (message names the rule) |
| `POST /auth/google` | public | `{ idToken, zone? }` → `{ token, user }`, or `{ requiresZone: true, email }` for a new citizen. Citizens only: a staff or admin email → `401` |
| `POST /auth/forgot-password` | public | `{ email }` → `200` with the **same** message for every email. Emails `FRONTEND_URL/reset-password?token=<raw>&desk=<role>` |
| `POST /auth/reset-password/:token` | public | `{ password, confirmPassword }` → `200 { message, desk }`. `400` expired or used. `422` a rule failed for **that account's role**. On success: **end every session** of the account |
| `GET /auth/me` | token | → `{ user }`. `401` for a bad, expired, revoked or idle session. The frontend calls this on every start and opens the desk the server names |
| `POST /auth/logout` | token | Ends this session. The frontend calls it fire-and-forget on sign-out |
| `POST /auth/activity` | token | → `204`. Sent at most once a minute while the person clicks or types (section 5) |

The pages for change password, change email, devices and sign out everywhere are in A4.

### 3. Password rules (check on every endpoint that sets a password)

Register, reset, staff setup (B1), change password (A4) and any seed script use one check. The frontend shows the same rules live (`passwordCheck` in `src/services/authService.js`), but only the server's check counts.

| Rule | Citizen and staff | Admin |
|---|---|---|
| Length | 10 to 128 characters | **16** to 128 |
| Upper and lower case letters | yes | yes |
| A number | yes | yes |
| A symbol (not a letter or digit) | yes | yes |
| Doesn't contain the part of the email before `@` (4+ letters) | yes | yes |
| Doesn't contain a word of the name (4+ letters) | yes | yes |
| Not a common base plus digits or symbols: `password`, `passw0rd`, `qwerty`, `letmein`, `welcome`, `admin`, `kolkata`, `smartcity`, `smartkolkata`, `123456`, `abc123` | yes | yes |
| Not one of the two examples sent to the team: `lantern47Pebble!orchid`, `copper%Meadow318violin&Tundra` (any case) | yes | yes |

Answer `422 { message }` naming the first rule that failed, e.g. "Use at least 16 characters." Hash with bcrypt (cost 12).

### 4. Sessions (this is where the real protection is)

1. **Every sign-in creates a session row:** `{ _id, userId, role, device (from User-Agent), createdAt, lastActiveAt, lastSeenAt, expiresAt, revokedAt }`.
2. **The JWT names it:** `{ id, role, sid, iat, exp }` (keep `id` as you have it; add `sid`). `exp` equals the session's `expiresAt`. The frontend reads `iat` and `exp` for the session ring in Settings and closes the desk at `exp`.
3. **Every protected request** (and every Socket.io connection, A5) checks, in this order: the signature, then the session row (exists, not revoked, not expired, not idle), then the user (exists, `isActive`, **same role as the token**). Any failure → `401`. A changed role revokes the session.
4. **Length:** citizen 30 days, staff 24 hours, admin 12 hours. (Today every token lasts 7 days.)
5. **Lockout:** 5 wrong passwords in a row lock the account for 15 minutes (`429`, "Too many wrong tries. Try again after 15 minutes."). Also rate-limit `/auth/login`, `/auth/register`, `/auth/forgot-password` and `/auth/reset-password/*` by IP.
6. **Revoking a session also disconnects its sockets** (A5).

### 5. Away limit (enforced on the server)

The person picks it in Settings (`prefs.idleSignOut`, minutes; A4). The allowed choices, and the default when none is saved:

| Role | Choices | Default |
|---|---|---|
| citizen | 0 (never), 60, 240 | 0 |
| staff | 30, 60, 240, 0 | 60 |
| admin | 15, 30, 60 (command can't switch it off) | 30 |

- **Activity** = any write request (`POST`, `PUT`, `PATCH`, `DELETE`) or `POST /auth/activity`. Reads (`GET`) and the socket don't count, so a tab left open can't keep an unattended desk alive. On activity set `lastActiveAt = now`.
- On every request: if the limit isn't 0 and `now - lastActiveAt > limit`, revoke the session and answer `401 { message: "Signed out after 30 min away, to keep your account safe." }` (the actual minutes; `1 h` / `4 h` for 60 and 240). The frontend shows that message on the sign-in page.

### 6. One-time links

| Link | Life | Where it points |
|---|---|---|
| Password reset | 60 minutes; **admin 15 minutes, at most 3 per hour** | `FRONTEND_URL/reset-password?token=…&desk=<citizen|staff|admin>` |
| Staff setup | 24 hours | B1 |
| Email change | 24 hours | A4 |

32 random bytes, only the SHA-256 hash stored, used once, every older unused link of the same kind for that account stops working. `desk` only picks which rules the page shows; the server checks the rules itself. After an **admin** reset, email the command inbox: "The command password was changed at HH:MM IST. Every device was signed out. Not you? Write to support at once."

### 7. What to change in the current backend

| Today | Change to |
|---|---|
| Admin login compares the password with plain text in `.env` (`ADMIN_PASSWORD`) | Store the admin like everyone else (bcrypt hash in the database) and use `bcrypt.compare`. Remove `ADMIN_PASSWORD` from `.env` |
| Failed login says "Invalid email, password or role." | "Email or password is incorrect for this desk." |
| Missing admin account answers `403` "Admin account is not provisioned" | `401` with the same one message |
| Citizen login overwrites the saved zone whenever `zone` is sent | Only fill a **missing** zone (the `requiresZone` case). Zone changes go through `PATCH /users/me` (A4) |
| Passwords need only 8 characters | Section 3 |
| `role: "moderator"` | Gone. Only citizen, staff, admin |
| Token `{ id, role }`, 7 days, no record | Section 4 |
| No `/auth/me`, `/auth/logout`, `/auth/activity` | Section 2 |
| Reset link has no `desk=`, lasts 15 minutes for everyone, doesn't end sessions | Section 6, and revoke every session on reset |
| Welcome email on every registration | Keep it or drop it, your choice; never block the sign-up on it |
| "Temporary diagnostic log" lines printing submitted zones | Remove |
| `getPublicUser` returns `{ id, name, email, role, ward, zone }` | The section 1 shape |

> **Check:** sign in on each desk → the right desk opens. Wrong password → "Email or password is incorrect for this desk." Reload → still signed in (`/auth/me`). Sign out → the old token gets `401`.

## A3 · Public pages (contact, staff application, setup link)

These pages are wired today. Their full spec is the old contract's shape, kept here until doc 03 arrives:

- [ ] `POST /contact` `{ name, email, issueType, message }` → `{ message }`. `issueType` is one of `account`, `registration`, `password`, `staff`, `technical`, `feedback`, `other`. Forward to the support inbox; rate-limit (about 5 an hour per IP)
- [ ] `POST /staff-requests` `{ name, email, experience, expertise, zone, note }` → `201 { message }`. **Lower-case field names**, `expertise` is an id (`electrical`, `roads`, `waste`, `water`, `civic`), `experience` one of `Field Active`, `2 Years`, `5 Years`, `10 Years`, `Senior Field`. Give the same answer whether or not the email already has an account or a request
- [ ] `GET /staff-requests/setup?token=` → `{ request: { name, email, rank, expertise, zone, experience } }` for a valid unused link, else `400`
- [ ] `POST /staff-requests/set-password` `{ token, password }` → `201`. Creates the staff account **with** `zone`, `expertise`, `rank`, `experience` from the request (today they're lost). Password rules from doc 01 §3. Setup links last 24 h and work once

**Check:** the Contact page sends and shows your answer. `/staff-request` submits. A setup link opens `/staff-setup`, shows the person's name and rank, and the new password signs in on the staff desk.

The Staff Desk's **Accept** (`PATCH /staff-requests/:id/approve { rank, expertise, zone }`) and **Resend link** (`POST /staff-requests/:id/resend-setup`) are in the code too, but they only work once the Staff Desk loads its requests from the server (doc 03).

## A4 · Account and Settings

### 1. What Settings keeps where

| Kept | What | Why |
|---|---|---|
| **The account (server)** | display name, home zone, photo, designation, office, duty status, the away limit, alert preferences, password, email, devices | They belong to the person and must be the same on every device |
| **This browser only** | 3D quality, City sky, auto-orbit, reduce motion, high contrast, live data refresh, air-quality scale, "Dashboard opens on" | They belong to the screen. A slow office PC and a laptop may differ. Nothing to build |

### 2. Endpoints

All need the token.

| Method and path | Who | Body → answer |
|---|---|---|
| `GET /users/me` | any | → `{ user }` (A2 shape) |
| `PATCH /users/me` | any | Any subset of the fields in section 3 → `{ user }`. Ignore every other field: never `role`, `email`, `password`, `rank`, `expertise` |
| `POST /auth/change-password` | citizen with `provider: "password"` | `{ currentPassword, newPassword }` → `{ message }`. `400` wrong current password or same as before. `422` a rule failed (A2). Ends every **other** session. Staff and admin: `403` (they use a reset link) |
| `POST /auth/forgot-password` | staff and admin, from Settings | `{ email }` (their own). Same endpoint as A2 |
| `POST /auth/change-email` | citizen with `provider: "password"` | `{ newEmail, password }` → `{ message }`. `400` wrong password. `409` the email is taken. Emails `FRONTEND_URL/confirm-email?token=…` to the **new** address. The email doesn't change yet |
| `POST /auth/confirm-email` | public | `{ token }` → `{ user, message }`. Swaps the email, uses the link up, and emails the **old** address that it changed. `400` bad, used or expired |
| `GET /auth/sessions` | any | → `{ sessions: [{ id, device, place?, lastSeen, createdAt, current }] }`, only live sessions (not revoked, not expired, not idle). `current` marks the caller's own |
| `DELETE /auth/sessions/:id` | any | Ends one of **your own** sessions (`404` otherwise) and disconnects its sockets |
| `POST /auth/logout-all` | any | Ends every session of the account, this one included |
| `DELETE /users/me` | citizen | `{ password }` (`{}` for a Google account) → `{ message }`. Marks the account inactive (never deletes), clears name to "Former resident", email to a placeholder, photo, Google link and password, ends every session. Their reports stay, without their name. Staff and admin: `403` |
| `GET /users/names?ids=a,b,c` | any | → `{ "<id>": "<current display name>" }`, up to 100 ids. For a citizen caller, staff come back as "Field crew" and admin as "City Command" |
| `PATCH /staff/me/duty` | staff, admin | `{ dutyStatus: "on" | "break" | "off" }` → `{ user }`. Wired with the Staff Desk (B1) |
| `GET /users/me/export` | any | The person's own data as JSON. Wired with B2 |

### 3. `PATCH /users/me` fields

| Field | Who | Rule |
|---|---|---|
| `displayName` | any | 0 to 40 characters, keyboard-mash check. `""` clears it (the account name shows) |
| `zone` | **citizen only** | One of the six zones. **At most once every 30 days** (zone polls are for residents, B3): store `zoneChangedAt`; a change before 30 days → `409 { message: "You can change your home zone again on 9 Dec 2026." }` (date in IST). Staff → `403` "Your base zone is set by command on the Staff Desk." Admin → `403` |
| `designation`, `office` | admin only | 0 to 60 characters, mash check |
| `avatar` | any | A JPEG data URL (`data:image/jpeg;base64,…`) under 64 KB, or `""` to remove. The frontend crops, resizes to 256 px and re-encodes, which also strips hidden photo data such as GPS |
| `prefs` | any | Any subset of the object below. Save only the keys sent |

**`prefs`** (the frontend sends these exact keys whenever the person changes one, from any device):

| Key | Type | Allowed |
|---|---|---|
| `idleSignOut` | number (minutes) | the role's choices in A2 section 5; anything else → `400` |
| `inboxMuted` | string[] | notification group ids the person muted (up to 30). Groups that can't be muted (B2) are ignored when sending |
| `popups` | string | `all`, `urgent`, `off` |
| `quietHours` | boolean | |
| `quietFrom`, `quietTo` | string | 24-hour `HH:MM` |

**After a successful save,** emit `profile:updated` (A5) to the person's own room, so their other devices read `/auth/me` again. When `displayName` or `avatar` changed, also send it to the staff and admin rooms, because those names show on other people's screens.

### 4. What the frontend does with the answers

- Every account field shows the server's `message` when it says no, and puts the old value back.
- The answer's `user` replaces the saved one (`updateSessionUser`), so the whole app sees the change at once.
- Preferences: the account's `prefs` always win over what a browser kept. A refused save puts the account's values back.

### 5. What to change in the current backend

| Today | Change to |
|---|---|
| `GET /users/profile` (citizens only) is the only account endpoint | Section 2 |
| `User` has no `displayName`, `avatar`, `prefs`, `designation`, `office`, `dutyStatus`, `zoneChangedAt`, `provider` | Add them. `provider` is `google` for accounts made with Google (today they get a random password instead; keep the hash empty and mark the provider) |
| `User.ward` and `User.department` | `ward` isn't used by the frontend (zone is). `department` becomes `expertise` (B1) |
| `DELETE /api/admin/users/:id` deletes the user | Never delete: mark inactive (rule 7 in section 1) |
| `PATCH /api/admin/users/:id` can set any role, including `moderator`, and any email | Role changes and email changes for staff and admin go through the Staff Desk (B1). No moderator |

> **Check:** Settings → change display name → reload, still there. Mute an alert group on one browser → it's muted on another after reload. "Where you're signed in" lists both browsers; "Sign out" on one ends it.

## A5 · Socket.io

Files: `src/lib/socket.js` (the client), `src/services/realtime.js` (connection), `src/services/events.js` (names). The frontend depends on `socket.io-client` 4.8.

### 1. Server setup

```js
const http = require("http");
const server = http.createServer(app);
initializeSocket(server);          // before listen
server.listen(PORT);
```

- **CORS:** the same `FRONTEND_URL` list as the API (today the socket uses `CLIENT_URL` and the API `FRONTEND_URL`; use one).
- **Path:** default `/socket.io`. The client connects to `VITE_API_URL` without `/api` (e.g. `http://localhost:5000`).
- **Transports:** WebSocket first, long-polling as fallback (the client asks for both).
- One server process is assumed. With several, add the Socket.io Redis adapter.

### 2. Connecting

The client sends `auth: { token, tab }` in the handshake:

- `token`: the same JWT as the API.
- `tab`: this browser tab's id (the same value the API gets in `X-Client-Tab`).

In `io.use(...)`, check exactly what `GET /auth/me` checks (A2 section 4): signature, session row (not revoked, expired or idle), user active, same role. Refuse with `next(new Error("unauthorized"))`. The client then shows "Offline" and retries; the next API call's `401` signs the person out.

On connect, store `socket.data = { userId, role, zone, sid, tab }` and join the rooms.

**When a session is revoked** (sign out, sign out everywhere, password reset, idle, account removed), disconnect its sockets: `io.in("sid:" + sid).disconnectSockets(true)` (join a `sid:<sid>` room on connect for this).

### 3. Rooms

| Room | Who joins |
|---|---|
| `user:<id>` | every device of one person |
| `sid:<sid>` | the sockets of one session (for revoking) |
| `role:admin`, `role:staff`, `role:citizen` | by role |
| `zone:<zone>` | citizens by home zone, staff by base zone (admin: none). When the zone changes, move their sockets |
| `issue:<id>` | staff on that file, and citizens who reported, follow or back it. Doc 04 explains when to join and leave |

### 4. Every payload

```json
{ "at": "2026-11-10T08:00:00.000Z", "actorId": "<account that acted>", "actorTab": "<X-Client-Tab of that request>", "...": "the fields below" }
```

- `actorTab`: the tab that acted ignores the event (it already shows the change). Every other tab and device of the same person still updates. Leave it out for events no request caused (timers).
- **Never put a name a citizen mustn't see in a payload that goes to citizens.** Payloads carry ids; the frontend reads names through the API, which masks them.
- **"Something changed, read it again" events** (`*:changed`) carry only what changed, and the frontend reads the item through the API, which applies who-may-see-what.

### 5. The events

Names are exactly the values of `EVENTS` in `src/services/events.js`. The client listens to these and nothing else.

| Event | Payload (besides `at`, `actorId`, `actorTab`) | Send to | Wired |
|---|---|---|---|
| `profile:updated` | `{ id, displayName, avatar }` (`avatar` = true/false) | `user:<id>` always; also `role:admin` and `role:staff` when the name or photo changed | **yes** |
| `policy:changed` | `{ version }` | every role | **yes** |
| `issue:filed` | `{ id, title, category, ward, priority, danger }` | `role:admin`, `zone:<ward>` (citizens and staff of that zone) | **yes** |
| `issue:assigned` | `{ id, to, from }` (staff ids, `to` null when unassigned) | `role:admin`, `user:<to>`, `user:<from>`, `issue:<id>` | **yes** |
| `issue:status` | `{ id, from, to, owner, reason? }` | `role:admin`, `issue:<id>` | **yes** |
| `issue:close-requested` | `{ id, owner }` | `role:admin` | **yes** |
| `issue:close-withdrawn` | `{ id, owner, reason }` | `role:admin` | **yes** |
| `issue:resolved` | `{ id, owner, note }` | `role:admin`, `issue:<id>` | **yes** |
| `issue:sent-back` | `{ id, owner, reason, returned }` | `user:<owner>`, `role:admin` | **yes** |
| `issue:priority` | `{ id, from, to, window }` | `role:admin`, `user:<owner>` | **yes** |
| `issue:note` | `{ id, author, internal }` | `role:admin`, `user:<owner>`; also `issue:<id>` when not internal | **yes** |
| `issue:supported` | `{ id, count }` | `role:admin`, `issue:<id>` | **yes** |
| `issue:removed` | `{ id, kind, reason }` | `role:admin`, `issue:<id>` | **yes** |
| `issue:restored` | `{ id }` | `role:admin`, `issue:<id>` | **yes** |
| `issue:request` | `{ id, req, reason }` | `role:admin` | **yes** |
| `issue:request-decided` | `{ id, req, verdict }` | `role:admin`, the requester's `user:<id>` | **yes** |
| `staff:changed` | `{ id }` | `role:admin`; also `user:<id>` when it's about that person | B1 |
| `staff:duty` | `{ id, onDuty }` | `role:admin`, `user:<id>` | B1 |
| `community:changed` | `{ type, id, zone }` (`type`: proposal, poll, announcement, notice, check) | `zone:<zone>` (`all` = every role), `role:admin` | B3 |
| `notification:new` | `{ id, type }` | `user:<recipient>` | B2 |

### 6. What the client does

- Connects on sign-in and on start (when a server session exists); disconnects on sign-out.
- Reconnects by itself (1 s, growing to 15 s, with jitter).
- **After a drop and reconnect, every wired area reads its data again**, because events sent while it was offline are gone. The server never has to replay.
- The top bar shows **Live**, **Connecting** or **Offline**.

### 7. In the current backend (`socket/socket.js`)

| Today | Change to |
|---|---|
| `initializeSocket` is never called (`app.listen` is used), so `getIO()` throws and filing an issue crashes after saving it | Section 1 |
| CORS from `CLIENT_URL` | `FRONTEND_URL`, the same list as the API |
| Checks only the JWT signature and `isActive` | Section 2 (the session row too) |
| Rooms `admin-room`, `moderator-room`, `user-<id>` | Section 3. No moderator |
| Events `issue-created`, `issue-status-updated`, `notification` | Section 5 names, exactly |
| Payloads carry the whole populated issue (with reporter email) to admin and moderator rooms | Section 4: ids only, read through the API |

> **Check:** the top bar shows **Live** on each desk. Stop the server → **Offline**; start it → **Live** again. Change your display name in one browser → the other updates without reload.

## A6 · Service windows

How long the city gives itself to fix an issue. One table, owned by command, read by every desk.

### 1. The table

```json
{
  "version": 3,
  "priority": { "critical": 12, "high": 24, "medium": 48, "low": 120 },
  "ceilings": { "safety": 12, "electricity": 12 },
  "savedAt": "2026-11-10T08:00:00.000Z"
}
```

- **Window for an issue** = `min(priority[issue.priority], ceilings[issue.category] ?? ∞)`, in hours.
- **Rules (answer `422` if broken):**
  - every value is a whole number from 1 to 720;
  - a higher priority never gets more time than a lower one (critical ≤ high ≤ medium ≤ low);
  - ceiling keys are categories: `roads`, `lighting`, `water`, `waste`, `electricity`, `safety`, `other`.
- **Before anything is saved** (fresh database), `GET /policy` answers the default above with `version: 0`.

### 2. Endpoints

| Method and path | Who | Body → answer |
|---|---|---|
| `GET /policy` | any signed-in role | → the table |
| `PUT /policy` | admin | `{ priority, ceilings }` → the saved table with its new `version`. `422 { message, problems: ["…"] }` when a rule fails |
| `GET /policy/history` | admin | → `{ items: [{ version, priority, ceilings, savedAt, savedBy }], total }`, newest first. `savedBy` = the saver's current display name |

### 3. Rules the server keeps

1. **Saving adds a version.** Never edit an old one.
2. **Saving never changes windows already running.** Each issue stores its own `slaHours` when it's filed (A7).
3. **A priority change on an issue recalculates its window under the live table, counted from the original report time** (A7), so raising the priority never gives free hours.
4. **Every save writes an audit row** (A8): "Service windows changed: Critical 12h → 6h · …".
5. **After a save, emit `policy:changed { version }`** to every role (A5). Every open desk reads `GET /policy` again.

### 4. What the frontend does

- Reads `GET /policy` on sign-in, on `policy:changed` and after the live connection comes back.
- Command's save changes the table on screen at once, sends `PUT /policy`, and puts the old table back with the server's message if it's refused.

### 5. In the current backend

Nothing exists yet: add a `Policy` model (versioned) and the three endpoints.

> **Check:** command opens Service Windows in two browsers, saves a change in one → the other updates live.

## A7 · Issues

Every issue screen (Report Issue, My Reports, Saved, Assigned Work, Issue Command, analytics, the map, the 3D model, the issue files) reads one board. With a server, the board is `GET /issues`; every change is shown at once, sent to the endpoint below, and **the issue in your answer replaces the one on screen**. If you refuse, the screen shows your `message` and reads the issue again.

### 1. The issue object

The frontend uses exactly these fields. Address issues by the human id (`ISS-2437`) in every URL.

```json
{
  "id": "ISS-2437",
  "title": "Streetlight out near the crossing",
  "description": "…",
  "category": "lighting",
  "location": "Opposite the Ballygunge station gate",
  "ward": "Ballygunge",
  "lat": 22.527112, "lng": 88.363401,
  "photos": [{ "id": "p1", "name": "light.jpg", "url": "https://api.example.com/uploads/8f3c….jpg", "w": 1200, "h": 800, "kb": 184 }],
  "danger": false,
  "priority": "medium",
  "slaHours": 48,
  "status": "submitted",
  "reporterId": "<user id>", "reportedBy": "<name>",
  "assignedTo": "<staff account name>", "assignedToId": "<user id>", "assignedAt": "…",
  "timeline": [{ "status": "submitted", "at": "…", "by": "<name>", "note": "…" }],
  "comments": [{ "id": "c1", "author": "<name>", "role": "staff", "body": "…", "createdAt": "…", "internal": true }],
  "savedBy": ["<user id>"],
  "supporters": [{ "id": "<user id>", "name": "<name>", "at": "…" }],
  "returned": 0,
  "lastReturn": { "reason": "…", "by": "<name>", "at": "…" },
  "requests": [{ "id": "r1", "type": "withdraw|dispute|flag", "by": "<name>", "byId": "<user id>", "role": "citizen|staff",
                 "reason": "…", "note": "…", "linkedTo": "ISS-…", "at": "…", "seenAt": null,
                 "decided": { "verdict": "approved|declined", "reason": "…", "by": "<name>", "at": "…" } }],
  "removed": { "kind": "withdrawn|dismissed", "reason": "…", "note": "…", "by": "<name>", "role": "…", "at": "…",
               "linkedTo": "ISS-…", "merged": true, "addedTo": ["<user id>"], "requestedBy": "<name>" },
  "restored": { "from": { "…": "the removed object" }, "by": "<name>", "at": "…", "note": "…" },
  "createdAt": "…", "updatedAt": "…"
}
```

| Field | Rule |
|---|---|
| `id` | `ISS-` + a number, made by the server, **never reused**: use an atomic counter (`findOneAndUpdate` with `$inc`), not "max + 1" |
| `category` | `roads`, `lighting`, `water`, `waste`, `electricity`, `safety`, `other` |
| `ward` | one of the six zones |
| `status` | `submitted`, `acknowledged`, `in_progress`, `pending_review`, `resolved` |
| `priority` | `low`, `medium`, `high`, `critical`. New report: `high` if `danger`, else `medium` |
| `slaHours` | stamped when filed from the live service window table (A6); recalculated on a priority change, still counted from `createdAt` |
| `assignedTo` | the staff member's **account `name`** (the screens compare it with the signed-in person's `name`). Also send `assignedToId` |
| `photos[].url` | an **absolute** `https://` URL. A relative path is dropped by the screen |
| `removed`, `restored`, `lastReturn` | absent or `null` when they don't apply |
| `requests[].id`, `comments[].id` | stable ids made by the server |

Time fields are ISO strings (UTC).

### 2. Who sees what (`GET /issues`, `GET /issues/:id`)

| Caller | Gets |
|---|---|
| admin | every issue, removed ones included, everything in them |
| staff | every issue not removed, plus removed ones assigned to them. Everything in them |
| citizen | **every issue not removed**, in the public form below, plus **their own** reports including removed ones |

**Public form (what a citizen receives for any issue, their own included):**

- staff and admin names → `"Field crew"` and `"City Command"` in `assignedTo`, `timeline[].by`, `comments[].author`, `removed.by`, `restored.by`, `requests[].decided.by`, `lastReturn.by`;
- `assignedToId`, `returned`, `lastReturn` → removed;
- `comments` → only those with `internal: false`;
- `status: "pending_review"` → `"in_progress"`, and timeline steps with `pending_review` removed;
- `requests` → only the citizen's own;
- **someone else's report**: `reporterId` → `null`, `reportedBy` → `""`, `photos` kept;
- `supporters` → keep the array's **length** (the screen counts affected people); entries for other people become `{ "id": "", "name": "", "at": "…" }`;
- `savedBy` → `[their id]` if they follow it, else `[]`.

`GET /issues` → `{ items, total }`, newest first, no paging (the board needs every issue). `GET /issues/:id` → `{ issue }`; `404` when the caller may not see it.

### 3. Changes

Every change answers `{ issue }` (the changed issue, in the caller's form), plus `related: [issue]` when a second issue changed too (merge, unmerge). Send `403` for a role or owner that may not, `409` when the issue isn't in a state that allows it, `400`/`422` for bad input. Every one writes an audit row (A8) and emits its event (section 5).

| Method and path | Who | Body | Rules |
|---|---|---|---|
| `POST /issues` | citizen | `multipart/form-data`: `title`, `description`, `category`, `location`, `ward`, `lat`, `lng`, `danger` (`"true"`/`"false"`), files `photos` (0–3) | section 4. Answers `201 { issue }` |
| `PATCH /issues/:id/assign` | admin | `{ staff: "<account name>" \| null, note?, undo? }` | `staff` names an **active staff account** (exact `name`); none or two with that name → `409`. Section 3.1 |
| `PATCH /issues/:id/status` | staff (assigned), admin | `{ status, note? }` | the move table, section 3.1 |
| `PATCH /issues/:id/priority` | admin | `{ priority }` | recalculates `slaHours` from `createdAt` if open; a resolved issue keeps its window |
| `POST /issues/:id/comments` | staff (assigned), admin | `{ body, internal }` | 1–700 characters, mash check. No notes once `resolved` (`409`). Citizens can't write notes (`403`) |
| `POST /issues/:id/support` | citizen | `{}` | "Affects me too": not the reporter, not twice, not resolved. Adds `{ id, name, at }` to `supporters` and their id to `savedBy` |
| `POST /issues/:id/follow` | citizen | `{ on: true \| false }` | adds or removes their id in `savedBy` (on their own report it's their star) |
| `POST /issues/:id/withdraw` | citizen (reporter) | `{ reason, note }` | only while `submitted` and unassigned. `reason` from: `Submitted by mistake`, `Duplicate report`, `Already fixed`, `Wrong location`. Sets `removed: { kind: "withdrawn", … }` |
| `POST /issues/:id/requests` | citizen, staff | `{ type, reason, note, linkedTo? }` | section 3.2 |
| `PATCH /issues/:id/requests/:reqId/seen` | admin | `{}` | sets `seenAt` once (the requester sees "Seen") |
| `PATCH /issues/:id/requests/:reqId` | admin | `{ verdict, reason? }` | section 3.2 |
| `POST /issues/:id/dismiss` | admin | `{ reason, note, linkedTo? }` | `reason` from: `Spam or test`, `Duplicate report`, `Not a city issue`, `Location not found`. Not already removed. Sets `removed: { kind: "dismissed", … }` |
| `POST /issues/:id/merge` | admin | `{ into, note }` | section 3.3 |
| `POST /issues/:id/restore` | admin | `{ note, undo? }` | only `removed.kind === "dismissed"` (a citizen's withdrawal is theirs). Deletes `removed`, sets `restored`. A merged one is unmerged (3.3). Also the undo for dismiss and merge (`undo: true`) |
| `GET /issues/:id/duplicates` | admin | | optional; the screen works it out itself (3.3) |

Text fields (`note`, `reason`, `body`, title, description, location) run the keyboard-mash check (section 1).

#### 3.1 Status and assignment

| Move | Who | From → to | Words |
|---|---|---|---|
| Dispatch | admin assigns | `submitted` → `acknowledged`; timeline note "Assigned to <name>" | – |
| Reassign | admin assigns someone else while `in_progress`/`pending_review` | → `acknowledged`, note "Reassigned from A to B"; `returned` → 0, `lastReturn` → null | – |
| Unassign | admin `staff: null` while in motion | → `acknowledged`, note "Returned to dispatch: unassigned from A" | – |
| Start work | assigned staff | `acknowledged` → `in_progress` | – |
| Request close | assigned staff | `in_progress` → `pending_review` | `note` ≥ 12 |
| Recall request | assigned staff | `pending_review` → `in_progress` | `note` ≥ 8 |
| Confirm close | admin | `pending_review` → `resolved` | `note` ≥ 8 |
| Send back | admin | `pending_review` → `in_progress`; `returned + 1`, `lastReturn = { reason: note, by, at }` | `note` ≥ 12 |

- Every move appends `{ status, at, by, note? }` to `timeline`.
- `pending_review` and `resolved` clear `lastReturn`.
- Anything else → `409 "That move isn't allowed from <status>."`.

#### 3.2 Requests

| `type` | Who | When | Rules |
|---|---|---|---|
| `withdraw` | the reporter | after dispatch (before it, use `/withdraw`) | not removed |
| `dispute` | the reporter | `removed.kind === "dismissed"` | – |
| `flag` | the assigned staff member | not removed | `reason` from `Duplicate report` (needs `linkedTo`), `Not a city issue`, `Location not found`, `Already fixed` (these three only while `in_progress`/`pending_review`, with a `note` ≥ 10) |

- One open request at a time (`409` otherwise).
- **Decide** (`verdict: "approved" | "declined"`; a decline needs `reason`): sets `decided`. Approving a `withdraw` or `flag` dismisses the issue (`withdraw` → `removed.kind = "withdrawn"`, `requestedBy`). Approving a `flag` with `Duplicate report` merges it into `linkedTo` (3.3). Approving a `dispute` restores it.

#### 3.3 Duplicates and merging

- **Possible duplicates:** same category, both open and not removed, within **200 m** and **7 days**; the older is the original.
- **Merge** `into`: the duplicate becomes `removed: { kind: "dismissed", reason: "Duplicate report", linkedTo: into, merged: true, addedTo: [ids] }`. Its reporter and supporters who aren't already on the original are added to the original's `supporters` and `savedBy`; `addedTo` lists them. Answer `{ issue: duplicate, related: [original] }`.
- **Unmerge** (restore of a merged issue): those `addedTo` people leave the original's `supporters` and `savedBy` (except its own reporter). Answer with `related: [original]`.

### 4. Filing (`POST /issues`)

| Field | Rule |
|---|---|
| `title` | 6–90 characters, mash check (title mode) |
| `description` | 20–600, mash check, not the same as the title |
| `location` | landmark text, 4–120, mash check |
| `ward` | one of the six zones |
| `lat`, `lng` | numbers inside Kolkata |
| `photos` | 0–3 files, JPEG/PNG/WebP, ≤ 5 MB each. **Check the file's real type** from its first bytes, not the name or the browser's claim. Save under a random name (never the uploaded name), serve as plain files from your domain, return absolute URLs |

The server sets `id`, `reporterId`, `reportedBy`, `status: "submitted"`, `priority`, `slaHours`, `timeline: [{ status: "submitted", at, by }]`, `savedBy: []`, `supporters: []`, `createdAt`.

Rate-limit filing (e.g. 10 a day per citizen).

### 5. Events (A5)

Emit after each change, with `actorId` and `actorTab`. The frontend only needs `id` to read the issue again; the other fields feed notifications (B2).

| Change | Event |
|---|---|
| filed | `issue:filed` → `role:admin`, `zone:<ward>` |
| assign / reassign / unassign | `issue:assigned` |
| any status move | `issue:status`, plus `issue:close-requested`, `issue:close-withdrawn`, `issue:resolved` or `issue:sent-back` as they apply |
| priority | `issue:priority` |
| note | `issue:note` |
| support, merge (on the original) | `issue:supported` |
| withdraw, dismiss, merge, approved flag/withdrawal | `issue:removed` |
| restore, approved dispute | `issue:restored` |
| new request | `issue:request` |
| decision | `issue:request-decided` |

`issue:<id>` room: on connect, join every issue the person reported, follows, backs or is assigned; join or leave when that changes.

### 6. The map

The map reads the same board (`src/components/map/mapApi.js`). Nothing extra to build. The staff map's "work update" and "send for review" use the same `PATCH /issues/:id/status` and the same rules.

### 7. In the current backend

| Today | Change to |
|---|---|
| `routes/issueRoutes.js` is never mounted | Mount at `/api/issues` |
| Categories `road_damage`, `garbage`, `water_leakage`, `street_light`, `encroachment`, `drainage` | Section 1's list |
| Status `rejected`, no `pending_review` | Section 1. Removal is `removed`, never a status |
| `location` is GeoJSON, `photos` are strings | `location` (landmark text) + `lat`, `lng`; photo objects with absolute URLs. Keep a GeoJSON index field if you want geo queries |
| No `priority`, `slaHours`, `ward`, `timeline`, `comments`, `requests`, `supporters`, `savedBy`, `danger` | Add them |
| `reportedBy`/`assignedTo` are populated user objects (with emails) | Section 1: ids plus names; never emails |
| Staff can't read their work; citizens can't read their reports | Section 2 |
| `updateIssueStatus` lets admin set any status | Section 3.1 |
| `createIssue` writes `contributionStats` (not in the schema) and logs "NOTIFICATION CREATED" | Remove both |
| Only `issue-created` / `issue-status-updated` socket events | Section 5 |

> **Check (three browsers):** citizen files a report with a photo → command sees it live → command dispatches to a staff member → staff sees it live → staff starts and requests close → command sees "Pending confirmation" → command sends back with a reason → staff sees why → staff requests close again → command confirms → citizen sees **Resolved** live. The citizen never sees a staff name or an internal note. Reload any desk → everything is still there.

## A8 · Audit trail

Every change in the system writes one row. Nothing is ever deleted from it.

### 1. The row

```json
{
  "id": "…",
  "at": "2026-11-10T08:00:00.000Z",
  "actorId": "<user id>",
  "actor": "<current display name>",
  "role": "citizen | staff | admin | system",
  "kind": "filed | dispatch | status | priority | request | removal | desk | community | policy | profile | auth",
  "action": "Assigned ISS-2437 to <name>",
  "issueId": "ISS-2437",
  "n": { "type": "assign", "to": "<name>", "from": null }
}
```

- `actor`: resolved **when read** from `actorId`, so a renamed person is renamed in the whole history.
- `action`: one readable line. The frontend shows it as written. Use the same wording the frontend writes in no-server mode (`src/store/issueStore.js`: "Filed ISS-…", "Assigned ISS-… to …", "Requested close on ISS-…", "Confirmed close on ISS-…: <note>", "Sent ISS-… back to the field: <reason>", "Set ISS-… priority to High · window 48h → 24h", "Dismissed ISS-… · <reason>", "Merged ISS-… into ISS-… · duplicate report", "Restored ISS-…").
- `n`: the structured notice notifications are built from (B2). For issues, the same `n` the frontend writes in `issueStore.js` for that change.

### 2. Endpoint

| Method and path | Who | Answer |
|---|---|---|
| `GET /audit` | admin | `{ items, total, page }`, newest first. Query: `kind`, `role`, `actorId`, `issueId`, `from`, `to`, `q`, `page` (100 per page). With no query, the latest 600 rows (the command screens read the recent trail) |

Staff Desk rows (`kind: "desk"`) also carry `verb` and `subject` (B1).

### 3. Rules

1. Write the row **in the same request** as the change, after it succeeds.
2. Never log passwords, tokens, reset links or request bodies.
3. Index `at`, `actorId`, `issueId`, `kind`.

---

# Part B · Not wired yet (final specs; the frontend follows)

## B1 · Staff Desk, roster, duty, base zone

The Staff Desk is today run on sample data in the browser (`src/store/staffDeskStore.js`, `src/store/fieldRoster.js`, `src/store/dutyStore.js`). The roster **is** the staff users: one person, one account id.

**Staff fields on the user** (A2 §1 shape): `expertise` (id: `electrical`, `roads`, `waste`, `water`, `civic`), `rank` (`Field Operative`, `Specialist`, `Senior Specialist`, `Zone Lead`, `Command Fellow`), `experience` (`Field Active`, `2 Years`, `5 Years`, `10 Years`, `Senior Field`), `zone` (base zone), `verified`, `dutyStatus` (`on`, `break`, `off`), `closedPrior` (closed before this system), `requestedAt`, `acceptedAt`, `uplinkedAt` (first sign-in), `isActive`.

**Clearance request:** `{ id, name, email, zone, expertise, experience, note, filedAt, status: pending | approved | rejected | completed, rank, linkSentAt, linkStatus }`. Lower-case field names.

| Method and path | Who | Notes |
|---|---|---|
| `GET /staff-requests?status=` | admin | `{ items, total }` |
| `PATCH /staff-requests/:id/approve` | admin | `{ rank, expertise?, zone? }`. Emails a one-time setup link (`FRONTEND_URL/staff-setup?token=…`, 24 h). Answer `{ request, sent }`; if the email fails, keep it approved with `linkStatus: "failed"` so the desk can resend |
| `PATCH /staff-requests/:id/reject` | admin | `{ reason? }` |
| `POST /staff-requests/:id/resend-setup` | admin | a fresh link; the old one stops working |
| `GET /staff` | admin | `{ items }`: every staff user with the fields above. Live load is counted from the issues |
| `PATCH /staff/:id/rank` | admin | `{ rank }` |
| `PATCH /staff/:id/verify` | admin | `{ verified }` |
| `PATCH /staff/:id/zone` | admin | `{ zone }`: the base zone (staff can't change it themselves) |
| `DELETE /staff/:id` | admin | marks the user inactive (never deletes), ends their sessions, returns their open issues to dispatch (A7 §3.1 unassign) |
| `PATCH /staff/me/duty` | staff, admin | `{ dutyStatus }` → `{ user }` |

- First sign-in after setup: set `uplinkedAt`.
- Events: `staff:changed { id }` to `role:admin` (and to `user:<id>` when it's about that person); `staff:duty { id, onDuty }` to `role:admin` and `user:<id>`.
- Every action writes an audit row with `kind: "desk"`, plus `verb` (`cleared`, `rejected`, `removed`, `rank`, `verify`, `uplink`, `key`) and `subject` (a snapshot of the person: `{ id, name, email, rank, expertise, zone, experience }`), so the record stays readable after someone leaves.
- Staff emails go to admin only; citizens never receive them.

## B2 · Notifications

### How it works in the frontend

1. Every change to an issue is written to the command trail (`issueStore`, saved as `issue-board-v2`).
   Each trail entry carries a structured notice, `n`:

| `n.type` | Fields | Written when |
|---|---|---|
| `filed` | `reporterId` | a citizen files a report |
| `supported` | `userId`, `count` | another citizen says "affects me too" |
| `assign` | `to`, `from`, `left?` | dispatch, reassign, unassign, crew left the field |
| `status` | `from`, `to`, `owner`, `reason?`, `sentBack?`, `recalled?` | every status move |
| `priority` | `from`, `to`, `owner` | priority change (window recalculated) |
| `withdrawn` | `reason` | citizen withdraws a New report |
| `request` | `req` (`withdraw`/`flag`/`dispute`), `reason`, `linkedTo?` | a request to command |
| `dismissed` | `reason`, `owner`, `linkedTo?` | command dismisses |
| `merged` | `into`, `owner` | command merges a duplicate |
| `restored` | `unmerged?` | command restores |
| `decided` | `req`, `verdict`, `by`, `byId`, `reason?`, `into?` | command decides a request |

2. `store/notifyStore.js` runs the trail through the recipient rules below and adds three
   signals that are not trail events: service windows (closing / breached), possible duplicates,
   pending Staff Desk clearance requests. Notes on a file (comments) also notify.
3. Read state is per person: `inbox-read-<userId>` = `{ c: cursor, r: [read keys], u: [unread keys] }`.

Nothing is copied into a notification: each item reads the live issue, so titles, owners and
status are never stale.

### Recipient rules

| Event | Admin | Staff (owner) | Citizen (reporter) | Citizen (following) |
|---|---|---|---|---|
| Report filed | New report (danger flagged = alert) | | | |
| Possible duplicate (same category, 200 m, 7 days) | Decide | | | |
| Affects me too | at 3, 5, 10, 25, 50 people | | Someone else is affected | |
| Assigned to a crew | | New assignment | A field crew is on your report | |
| Reassigned / unassigned | | Reassigned to X / Back in the dispatch queue | | |
| Work started | | | Work started | Work started |
| Close requested | Decide | | | |
| Close recalled | info | | | |
| Sent back | | Sent back by command (reason) | | |
| Close confirmed | | Close confirmed | Your report is resolved | Fixed |
| Priority changed | | Priority set to X | | |
| Withdrawn by citizen | info | | | |
| Request sent (withdraw / flag / dispute) | Decide | | | |
| Request decided | | Flag approved / declined | Withdrawal / dispute approved or declined | |
| Dismissed | | Removed from your work | Your report was dismissed | |
| Merged | | Merged into X | Tracked under X | |
| Restored | | | Your report is back | |
| Note on the file | | from command | from the city (not internal) | |
| Window under 30% left | | Service window closing | | |
| Window breached | Service window breached | Service window breached | | |
| Clearance request pending | Decide | | | |
| Staff Desk event by someone else | info | | | |

Nobody is notified of their own action. Citizens never see service windows or internal notes.

### What the backend needs to do

- Store the trail events with the same `n` payloads (the frontend already sends them in `issueStore`).
- Apply the rules above per recipient, server side, and push new items over the live stream.
  The live stream feeds the same channel: `services/events.js`.
- Store read state per user: `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
  (endpoint names kept from Person 5's original API).
- Time-based items (window closing / breached) need a scheduler on the server.
- Keep 14 days per person.

## B3 · Community

### Endpoints (Person 5's names kept, extended)

| Thing | Endpoint | Notes |
|---|---|---|
| Proposals | `GET/POST /community-posts` | `POST` = a citizen proposes (title ≤ 90, summary ≤ 280, kind, zone) |
| Signal | `POST /community-posts/:id/signals` | `{ kind: "affects" \| "use" }`, one per person, the same again removes it |
| Concern | `POST /community-posts/:id/concerns` | `{ reason }` from the fixed list, one per person, `null` removes it |
| Photo | `POST /community-posts/:id/photos` | one per person per proposal, max 12 |
| Official response | `POST /community-posts/:id/responses` | admin or field crew only |
| Decision | `PATCH /community-posts/:id/decision` | admin only (next batch) |
| Polls | `GET/POST /voting-slots` | admin opens; `POST /voting-slots/:id/options/:optionId/vote`: one vote per person, can change while open |
| Announcements | `POST /notifications/broadcast` | admin only: zones, audience (citizens / field crews), until |
| Work notices | `POST /work-notices` | field crew, on their own open file only |
| Fixed-issue signal | `POST /issues/:id/signals` | `{ kind: "fixed" \| "still" }`, citizen, resolved issues only |

### Rules the backend must enforce

- Citizens send no free text except their own proposal's title and summary (run the same
  keyboard-mash check as issue reports). Everything else is a fixed choice.
- One signal, one concern and one photo per person per proposal; one vote per person per poll.
- Residents are counted from the user's home zone (account `ward`), never from the client.
- A citizen can send one proposal a day while their last one is under review.
- Every proposal gets an answer within 7 days (`answerDue = createdAt + 7 days`).
- Official responses, decisions, announcements and moderation are logged with the actor.

### Trail notices (`n.type`) for notifications

`proposed`, `backed` (milestones 10/25/50/100 and target), `decided`, `responded`,
`poll-opened`, `poll-closed`, `announced`, `notice`, `still`.

Citizen recipients: decisions and responses go to the author and everyone who backed it; polls,
announcements and work notices go to people whose home zone matches (and to anyone following
the issue a work notice is about); a poll closing in 3 hours reminds people who haven't voted.
Command and field-crew rules follow with their boards.

### Command (admin)

| Action | Endpoint | Rules |
|---|---|---|
| Decide a proposal | `PATCH /community-posts/:id/decision` | `approved` / `planned` / `notnow` / `issue` / `poll`, reason ≥ 6 chars, public. `issue` files a work order for the proposal's author (`fromProposal`); `poll` opens a poll linked back (`from`) |
| Open a poll | `POST /voting-slots` | question ≥ 8, 2 to 4 distinct options, 1 to 7 days, optional `from` (proposal or issue) |
| Close a poll | `PATCH /voting-slots/:id/progress` | outcome option + note ≥ 6 (Person 5's `progress` endpoint) |
| Announcement | `POST /notifications/broadcast` | zones (or all), audience: citizens and/or field crews, stays up 1 day to 2 weeks |
| Moderation | `PATCH /community/moderation` | hide (never delete) a photo, announcement or work notice with a fixed reason |
| Official response | `POST /community-posts/:id/responses` | admin or field crew |

Every command action is written to the audit log with kind `community`.

Command notifications: new proposal, proposal reached its target (decide), answer overdue after 7 days
(decide), poll ended without an outcome (decide), "still happening" after a fix, work notice posted,
field-crew response on a proposal.

### Field crews (staff)

| Action | Endpoint | Rules |
|---|---|---|
| Work notice | `POST /work-notices` | own open file only; kind from the fixed list; window ends after it starts, at most 3 days, not already over; note ≤ 140 (mash check); ends when the file closes |
| End a notice early | `PATCH /work-notices/:id/end` | the crew that posted it |
| Answer "still happening" | `POST /issues/:id/checks` | the crew on the closed file: `fixed` (note goes to the residents who said it isn't) or `revisit` (command decides the next visit) |

Field-crew notifications: command announcements that reach crews in their zones (home zone + zones of
their open files), "still happening" on a file they closed. Citizens who said "still happening" are told
the crew's answer. Command gets "Field crew asks to revisit" (decide).

## B4 · City readings (City Health)

City Health shows four **real, live** readings per zone. Today the frontend simulates them (`src/services/liveFeed.js`); it switches to the server when this exists.

| Reading | Source | Notes |
|---|---|---|
| **Air quality** (AQI) | CPCB stations via data.gov.in (free key) | each zone takes its nearest Kolkata station |
| **Traffic flow** (% of free-flow speed) | TomTom Traffic Flow (the project's TomTom key) | sample a few main roads per zone, average |
| **Rainfall** (mm/h) | Open-Meteo (free, no key) | current precipitation at the zone's centre |
| **Heat** (°C and feels-like) | Open-Meteo | current temperature and apparent temperature |

- The **server** fetches on a timer (air 15 min, traffic 5 min, weather 10 min), stores each reading (`CityMetrics`), and never exposes a key to the browser. Keys only in the backend `.env`.
- Zone centres: Shyambazar 22.6015, 88.3736 · B.B.D. Bagh 22.5726, 88.349 · Ballygunge 22.527, 88.363 · College Street 22.576, 88.3635 · B.P. Township 22.4722, 88.3878 · Dharmatala 22.5604, 88.3519.
- `GET /metrics/live` (any signed-in role) → `{ zones: { "<zone>": { aqi, traffic, rain, heat, feels, at } }, city: { sensors, uptime } }`; `sensors` counts feeds that answered in the last hour, `uptime` their share over 24 h.
- Event `city:metrics` with one zone's new values to every role.
- A source that fails keeps its last value with its time; never invent a number.

---

# Troubleshooting

| You see | Likely cause |
|---|---|
| Browser console: CORS error | `FRONTEND_URL` doesn't match the frontend address exactly (no trailing slash) |
| Signed out right after signing in | `/auth/me` missing or answering a different user shape (doc 01 §1) |
| Top bar stays **Offline** | Socket.io not started on the same server/port, or handshake refusing the token |
| A change flips back with a message at the bottom | Your server refused it; the message is your `message` |
| Photos missing on reports | Photo URLs are relative; they must be absolute `https://…` |
| A staff member never sees their work | `assignedTo` isn't their exact account `name` |

Questions about the frontend go to Person 4. If a doc and your setup disagree, the doc and the frontend change together; don't work around it.
