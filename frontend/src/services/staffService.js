import { api } from "../lib/api";

export async function fetchStaffRoster() {
  const { data } = await api.get("/staff");

  return data?.staff || [];
}