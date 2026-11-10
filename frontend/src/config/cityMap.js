/* ------------------------------------------------------------------
   City map hand-off (Person 3's map module).

   The citizen picks a zone on Report Issue, opens the location door, and
   the door sends them to the city map in pick mode:
     /map?zone=<zone>&pick=1&return=/citizen/report
   The map keeps the pin inside that zone and, on Confirm, comes back to
     /citizen/report?zone=<zone>&lat=<lat>&lng=<lng>&label=<place name>
   Report Issue reads that, locks the pin on, and shows the place,
   latitude and longitude under the zone card.

   `installed: true`: the map is merged (pages/common/CityMap.jsx at /map).
   Set it to false to fall back to pinning on the built-in zone card.
------------------------------------------------------------------- */

export const CITY_MAP = {
  installed: true,
  route: "/map",
  returnTo: "/citizen/report",
};

// the category rides along so the map can say "already reported nearby" while pinning
export const cityMapLink = (zone, category = "") =>
  `${CITY_MAP.route}?${new URLSearchParams({ zone, pick: "1", return: CITY_MAP.returnTo, ...(category ? { category } : {}) }).toString()}`;

/* the area the map itself allows (its maxBounds), used to sanity-check a returned pin */
export const CITY_BOUNDS = { south: 22.35, west: 88.15, north: 22.8, east: 88.6 };