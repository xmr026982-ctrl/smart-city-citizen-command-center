# Frontend + backend integration notes

The combined archive includes both the cleaned frontend and the backend source.

## Changes in this version

- Map API base URL reads `VITE_API_URL` (default `http://localhost:5000/api`).
- Map requests send the current frontend session role, name, and ID instead of fixed test headers.
- Nearby issue fetches cancel stale requests, handle errors, and display backend errors in the map UI.
- Staff and Admin maps now load issues from `GET /api/issues`; the backend returns assigned issues for staff and all issues for admin.
- Issue statuses from the backend (`submitted`, `acknowledged`, `in_progress`, `pending_review`, `resolved`) are normalized for filtering and human-readable display.
- Staff/Admin status and work-update actions use backend routes.
- Fabricated staff-location pins remain removed. No real staff-location API/model exists in this backend, so the map intentionally does not pretend to show live staff coordinates.
- Nearby issue results are limited to map-safe fields and support older records that have latitude/longitude but no valid GeoJSON `location`.
- Added `backend/scripts/backfillGeoLocation.js` to repair older coordinate records before the 2dsphere index is used.
- `.env` files and `node_modules` are intentionally excluded.

## Important limitation: demo identity is not secure authentication

The current frontend has hard-coded demo accounts in `src/store/authStore.js`. The backend `requireUser` middleware reads `x-role`, `x-name`, and `x-user-id` headers. This resolves the missing-header error when the frontend sends those values, but it is **not production authentication**: users can forge client-supplied headers. Before public deployment, replace the demo login and header middleware with server-verified authentication (for example, JWT or secure session cookies) and use verified database user IDs.

The Citizen Report flow and several issue-management screens still use the local `issueStore` seed/state. The MapView staff/admin issue lists and map nearby issue markers are connected to the backend in this version, but this does not mean every screen in the app has been converted to live API data yet.

## Local setup

1. In `backend/`, copy `.env.example` to `.env` and set your own `MONGO_URI`.
2. Run `npm install` in `backend/`.
3. For a database created with the older schema, run `npm run db:fix-geo` once from `backend/`.
4. Start the backend with `npm run dev`.
5. In `frontend/`, copy `.env.example` to `.env`, add your own MapTiler/TomTom keys if needed, then run `npm install` and `npm run dev`.
6. Keep `VITE_API_URL=http://localhost:5000/api` for the local backend.

Do not commit `.env`, database credentials, API secrets, or `node_modules`.
