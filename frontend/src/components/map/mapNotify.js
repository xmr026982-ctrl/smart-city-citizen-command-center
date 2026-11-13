/* ------------------------------------------------------------------
   Map notices (integration, Person 4).
   Replaces the browser alert() pop-ups in the map with a glass notice
   inside the map (CityMap listens for "citymap:notice"). Same messages,
   no blocking pop-up.
------------------------------------------------------------------- */
export function mapNotify(message, tone = "info") {
  window.dispatchEvent(new CustomEvent("citymap:notice", { detail: { message: String(message || ""), tone } }));
}
