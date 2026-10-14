# Smart City Citizen Command Center — Backend

## Setup

1. Install Node.js 20+.
2. Open a terminal in `backend/`.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set your own `MONGO_URI`.
5. If this database already contains issues created by the older schema, run `npm run db:fix-geo` once to repair/backfill GeoJSON coordinates.
6. Run `npm run dev`.

The API starts on `http://localhost:5000` by default. `GET /health` checks whether the server process is running; it does not prove that every issue endpoint works.

## Main issue endpoints

- `GET /api/issues` — all issues for admin, assigned issues for staff, own issues for citizen.
- `GET /api/issues/nearby?latitude=22.5726&longitude=88.3639&radius=2000` — nearby map issues.
- `POST /api/issues` — citizen report creation with multipart form fields and optional `photos`.
- `POST /api/issues/:id/status` — controlled status transition.
- `POST /api/issues/:id/assign` — admin assignment.
- `POST /api/issues/:id/comments` — staff/admin internal work update.
- `POST /api/issues/:id/priority` — admin priority change.

The current project uses `x-role`, `x-name`, and `x-user-id` request headers to simulate the logged-in user. This is suitable only for local development/demo use: a client can forge these headers. Before public deployment, replace this middleware with server-verified authentication (for example, JWT/session cookies) and enforce authorization using verified user IDs.

Do not commit `.env`, API keys, MongoDB connection strings, or uploaded private files.
