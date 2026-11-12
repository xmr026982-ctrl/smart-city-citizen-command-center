import { SERVER_ON } from "../config/server";
import { api } from "../lib/api"; // Adjust only if your api wrapper is in another location.

// Approve an application and trigger the backend setup-email flow.
export async function approveServerStaffRequest(id, payload) {
  const { data } = await api.patch(
    `/staff-requests/${encodeURIComponent(id)}/approve`,
    payload
  );
  return data;
}

// Fetch applications from MongoDB.
export async function fetchStaffRequests() {
  const { data } = await api.get("/staff-requests");
  return data?.requests || [];
}

// Reject an application in MongoDB.
export async function rejectServerStaffRequest(id) {
  const { data } = await api.patch(
    `/staff-requests/${encodeURIComponent(id)}/reject`
  );
  return data;
}

function normalizeServerRequest(request) {
  return {
    id: request._id,
    serverId: request._id,
    name: request.name,
    email: request.email,
    experience: request.experience ?? request.Experience ?? "",
    expertise: request.expertise ?? request.Expertise ?? "",
    zone: request.zone || "",
    note: request.note || "",
    filedAt: request.createdAt || request.filedAt || new Date().toISOString(),
    status: request.status || "pending",
  };
}