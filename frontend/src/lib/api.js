const BASE_URL = "/api";

export async function apiGet(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}