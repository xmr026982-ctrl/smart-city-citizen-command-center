// Temporary zone boundaries for MAP PICK HANDOFF.
// Format:
// [
//   [south, west],
//   [north, east]
// ]
//
// NOTE:
// These are project-defined approximate rectangles for testing.
// Replace with actual zone polygons/bounds when available.

const ZONE_BOUNDARIES = {
  Shyambazar: [
    [22.590, 88.360],
    [22.610, 88.385],
  ],

  "B.B.D. Bagh": [
    [22.565, 88.335],
    [22.580, 88.360],
  ],

  Ballygunge: [
    [22.515, 88.350],
    [22.540, 88.375],
  ],

  "College Street": [
    [22.565, 88.350],
    [22.585, 88.375],
  ],

  // integration fix: name matches the app's zone ("B.P. Township"); the box sits on
  // the township's real centre (Baishnabghata Patuli, 22.4722, 88.3878)
  "B.P. Township": [
    [22.460, 88.374],
    [22.486, 88.402],
  ],

  Dharmatala: [
    [22.552, 88.340],
    [22.570, 88.365],
  ],
};

export default ZONE_BOUNDARIES;