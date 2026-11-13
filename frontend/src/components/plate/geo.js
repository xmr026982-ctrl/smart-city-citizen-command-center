// Geography helpers for the 3D city. 1 scene unit = 100 m, +x = east, -z = north.
import { ZONES } from "../../config/zones";

export const LAT0 = 22.565;
export const LNG0 = 88.365;
const UNIT_M = 100;
const KX = (111320 * Math.cos((LAT0 * Math.PI) / 180)) / UNIT_M;
const KZ = 110574 / UNIT_M;

export const project = (lat, lng) => [(lng - LNG0) * KX, -(lat - LAT0) * KZ];

export const ZONE_POS = Object.fromEntries(ZONES.map((z) => [z.id, project(z.lat, z.lng)]));

// Hooghly river centre line (north -> south), approximate.
const RIVER_LL = [
  [22.64, 88.362], [22.622, 88.36], [22.605, 88.356], [22.5851, 88.3468], [22.572, 88.3405],
  [22.5555, 88.3335], [22.543, 88.3255], [22.532, 88.312], [22.52, 88.296], [22.505, 88.282],
];
export const RIVER = RIVER_LL.map(([a, b]) => project(a, b));
export const RIVER_W = 5.5;

// The Maidan (big park) as an ellipse.
const mc = project(22.5535, 88.345);
export const MAIDAN = { x: mc[0], z: mc[1], rx: 7, rz: 13 };
export function inMaidan(x, z) {
  const dx = (x - MAIDAN.x) / MAIDAN.rx;
  const dz = (z - MAIDAN.z) / MAIDAN.rz;
  return dx * dx + dz * dz < 1;
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function nearestSegment(x, z) {
  let best = Infinity;
  let seg = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i];
    const [bx, bz] = RIVER[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; seg = i; }
  }
  return { d: best, seg };
}

export const distToRiver = (x, z) => nearestSegment(x, z).d;

// Rotation (about Y) that makes a model's local +X axis cross the river at (x, z).
export function bridgeYawAt(x, z) {
  const { seg } = nearestSegment(x, z);
  const dx = RIVER[seg + 1][0] - RIVER[seg][0];
  const dz = RIVER[seg + 1][1] - RIVER[seg][1];
  return Math.atan2(-dx, -dz);
}