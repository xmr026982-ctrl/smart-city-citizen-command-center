import { getUser } from "../../store/authStore";
import { getIssues } from "../../store/issueStore";
import { CATEGORY_LABEL } from "../../constants/issueCategories";

/* ------------------------------------------------------------------
   The map's issues, from the app's own issue board (store/issueStore).

   The map never calls the server for issues itself. The board is the one
   place issues come from: the pins, the issue card and the admin counts
   all read it, so they always agree, and when the board is connected to
   the server (docs/backend/BACKEND-HANDOVER.md · A7) the map follows with no
   change here. Every server call goes through lib/api.js with the
   signed-in token; there are no x-role / x-user-id headers anywhere.

   What each role gets: admin every file, staff their own assignments,
   citizens the open files without internal notes.
------------------------------------------------------------------- */
function boardIssues() {
  const me = getUser();
  const role = me?.role || "citizen";
  const mine = (i) => i.assignedTo && i.assignedTo === me?.name;
  return getIssues()
    .filter((i) => (role === "admin" ? true : role === "staff" ? mine(i) : i.status !== "resolved"))
    .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
    .map((i) => ({
      id: i.id,
      title: i.title,
      description: role === "citizen" ? "" : i.description,
      type: CATEGORY_LABEL[i.category] || i.category,
      category: i.category,
      status: i.status,
      priority: i.priority,
      latitude: i.lat,
      longitude: i.lng,
      ward: i.ward,
      zone: i.ward,
      location: i.location,
      assignedTo: role === "citizen" ? null : i.assignedTo || null,
      assignedStaffName: role === "citizen" ? "" : i.assignedTo || "",
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
}

/** { data: [...] } in the shape the map expects. Never throws. */
export async function fetchIssues() {
  return { data: boardIssues() };
}
