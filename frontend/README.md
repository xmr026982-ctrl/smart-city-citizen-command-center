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
| `VITE_API_URL` | Backend address, e.g. `http://localhost:5000/api`. Required: every sign-in and every screen's data comes from the server |
| `VITE_FIREBASE_*` | Google sign-in for citizens (empty hides the button) |
| `VITE_MAPTILER_KEY`, `VITE_TOMTOM_API_KEY` | Map tiles and traffic |

## Backend

The backend is in `../backend` (Node, Express, MongoDB, Socket.io). How the whole system works,
every endpoint, live event, privacy rule and setup step, is in one document:
`docs/backend/BACKEND-HANDOVER.md`.

The connection points in this code: `src/config/server.js` (reads `VITE_API_URL`),
`src/lib/api.js` (the one HTTP client), `src/lib/socket.js` and `src/services/realtime.js`
(Socket.io), `src/services/events.js` (event names), `src/store/authStore.js` (the session).

There is no sample data and no offline desk: sign in with a real account (create the first
ones with `npm run seed` in the backend).

## How the parts connect

One issue board (`src/store/issueStore.js`), one command trail, one event channel
(`src/services/events.js`), one rule for opening a file (`src/utils/fileLink.js`), all fed by the server and kept live over
Socket.io. Notifications (`src/store/notifyStore.js`) and Community (`src/store/communityStore.js`)
read the same board and trail, so a change shows up everywhere at once: the file, the map, the
3D city, the top bar, the notifications and the community board.


## Team · Group D

| Member | Part |
|---|---|
| **Koushik Bhowmik** | Frontend and command interface, backend rebuild and system integration |
| **Priti Sarkar** | Backend foundations |
| **Sayan Majumder** | Sign-in, users and profiles |
| **Subhomoy Ghosh** | Community and Notifications: the original module and its API design |
| **Swarup Sutradhar** | City map |
| **Taras Hembram** | Project support |

Full details in the [project README](../README.md).
