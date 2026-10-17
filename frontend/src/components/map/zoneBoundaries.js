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

  "B.P Township": [
    [22.475, 88.395],
    [22.495, 88.420],
  ],

  Dharmatala: [
    [22.552, 88.340],
    [22.570, 88.365],
  ],
};

export default ZONE_BOUNDARIES;