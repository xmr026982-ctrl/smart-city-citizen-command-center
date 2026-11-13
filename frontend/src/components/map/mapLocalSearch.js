/* ------------------------------------------------------------------
   Keyless city search (integration, Person 4).
   Without a MapTiler key the map searches what the city already knows:
   the six service zones and the open issues on the board (title, place,
   zone). Results come back in MapTiler's feature shape, so Person 3's
   result list and selectLocation() work unchanged.
------------------------------------------------------------------- */
import { WARDS } from "../../constants/issueConstants";
import { getIssues } from "../../store/issueStore";

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchCity(text) {
  const q = norm(text);
  if (!q) return [];
  const zones = WARDS.filter((w) => norm(w.name).includes(q)).map((w) => ({
    id: `zone-${w.name}`, text: w.name, place_name: `${w.name} · service zone, Kolkata`, center: [w.lng, w.lat],
  }));
  const issues = getIssues()
    .filter((i) => i.status !== "resolved" && Number.isFinite(i.lat) && Number.isFinite(i.lng))
    .filter((i) => norm(`${i.title} ${i.location} ${i.ward} ${i.id}`).includes(q))
    .slice(0, 8)
    .map((i) => ({ id: `issue-${i.id}`, text: i.location || i.title, place_name: `${i.id} · ${i.title} · ${i.ward}`, center: [i.lng, i.lat] }));
  return [...zones, ...issues];
}