# Smart City Citizen Command Center · Kolkata

A command center for Kolkata's civic issues, in three desks:

- **Citizen**: City Health (3D city), Report Issue, My Reports, Saved, Map, Community, Notifications
- **Field crew (staff)**: Field Health, Assigned Work, Operations, Map, Community zone board, Notifications
- **Command (admin)**: City Health, Issue Command (All Issues, assignments, analytics, service windows,
  audit log), Staff Desk, Map, Community Command, Notifications

React + Vite, Leaflet (map), three.js / react-three-fiber (3D city).

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill it in (never commit `.env`):

| Variable | What it does |
|---|---|
| `VITE_API_URL` | Backend address, e.g. `http://localhost:5000/api`. Empty: the app runs on its own sample data |
| `VITE_FIREBASE_*` | Google sign-in for citizens (empty hides the button) |
| `VITE_MAPTILER_KEY`, `VITE_TOMTOM_API_KEY` | Map tiles and traffic |

## Backend

The backend (Person 6) is built to fit this frontend. Everything it must do is in one
document: `docs/backend/BACKEND-HANDOVER.md`.

The connection points in this code: `src/config/server.js` (reads `VITE_API_URL`),
`src/lib/api.js` (the one HTTP client), `src/lib/socket.js` and `src/services/realtime.js`
(Socket.io), `src/services/events.js` (event names), `src/store/authStore.js` (the session).

Without `VITE_API_URL` the app runs on sample data in the browser. `VITE_DEV_DESK=true` in
`.env.local` opens a sample desk per role, under `npm run dev` only.

## How the parts connect

One issue board (`src/store/issueStore.js`), one command trail, one event channel
(`src/services/events.js`), one rule for opening a file (`src/utils/fileLink.js`).
Notifications (`src/store/notifyStore.js`) and Community (`src/store/communityStore.js`) read the
same board and trail, so a change shows up everywhere at once: the file, the map, the 3D city,
the top bar, the notifications and the community board.


## Team and credits

| Person | Part |
|---|---|
| Person 1 · Sayan Majumder | Authentication, users, profile |
| Person 2 | Dashboard and city data (taken over by Person 4) |
| Person 3 | Map: Leaflet map, routing, search, zone pinning (`src/components/map/`) |
| Person 4 | Issue Management, City Health 3D, top bar and shell, Notifications and Community rebuild |
| Person 5 | Community and Notifications: the original module and its API design (`/community-posts`, `/voting-slots`, `/notifications`). The rebuilt Community keeps those endpoint names as its contract |
| Person 6 · Priti Sarkar | Admin, backend and real-time (Socket.io), integration |

Person 5's original module (`src/modules/community`, `src/modules/community-admin`) was replaced by
the rebuilt Community and Notifications; it remains in the git history.
