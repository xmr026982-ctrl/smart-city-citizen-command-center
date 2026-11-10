/* ------------------------------------------------------------------
   City layout for the 3D model: roads, data arcs, buildings.
   Plain math (no three.js), computed once, so it can be checked on its own.
   1 scene unit = 100 m, +x = east, -z = north (see geo.js).

   Rules the layout keeps:
   - no road runs through a building: every building's whole footprint
     stays clear of every road bed
   - roads stop at the edge of a landmark instead of running under it
   - data arcs pass above buildings: anything under an arc is kept lower
     than the arc, or left out
   - zone hubs, landmarks, the river, the Maidan and Patuli lake stay open
------------------------------------------------------------------- */
import { ZONES } from "../../config/zones";
import { ZONE_POS, RIVER_W, inMaidan, distToRiver, rng, project } from "./geo";

export const EDGES = [
  ["howrah", "bbdbagh"], ["howrah", "central"], ["bbdbagh", "esplanade"], ["esplanade", "dharmatala"],
  ["dharmatala", "park"], ["park", "victoria"], ["park", "ballygunge"], ["victoria", "alipore"],
  ["alipore", "tollygunge"], ["ballygunge", "tollygunge"], ["tollygunge", "behala"], ["college", "bbdbagh"],
  ["college", "shyambazar"], ["shyambazar", "belgachia"], ["belgachia", "salt"], ["central", "college"],
  ["central", "esplanade"], ["central", "salt"], ["victoria", "esplanade"], ["alipore", "behala"],
  ["ballygunge", "bptownship"], ["tollygunge", "bptownship"],
];
export const HUB = "central";
export const ARC_TO = ["howrah", "esplanade", "victoria", "college", "salt", "behala", "bptownship"];

export const ROAD_Y = 0.12;
export const ROAD_HALF = 0.5; // half width of the road bed
export const HUB_Y = 9.2; // arcs leave the hub above its towers

// how far a road stops short of a landmark's centre, and where an arc lands above it
const TRIM = { central: 2.7, victoria: 3.5, esplanade: 1.1, howrah: 4.7 };
const LAND_Y = { esplanade: 5.0, howrah: 3.9, victoria: 3.5 };
const LAND_Y_DEFAULT = 1.7;

// open ground around each zone centre (landmarks need more)
const CLEAR = { victoria: 5, central: 3, esplanade: 2.6, howrah: 0 };
const CLEAR_DEFAULT = 1.6;

// Patuli lake, beside the B.P. Township hub
const lk = project(22.4696, 88.3918);
export const LAKE = { x: lk[0], z: lk[1], rx: 2.4, rz: 1.5 };
const inLake = (x, z, pad = 0) => ((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((z - LAKE.z) / (LAKE.rz + pad)) ** 2 < 1;

/* ---------- curve helpers ---------- */
function quad(a, c, b, t) {
  const u = 1 - t;
  return a.map((_, k) => u * u * a[k] + 2 * u * t * c[k] + t * t * b[k]);
}

// equal-length spacing along a dense polyline
function resample(dense, n) {
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    let d = 0;
    for (let k = 0; k < dense[i].length; k++) d += (dense[i][k] - dense[i - 1][k]) ** 2;
    cum.push(cum[i - 1] + Math.sqrt(d));
  }
  const total = cum[cum.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let s = 0; s <= n; s++) {
    const want = (s / n) * total;
    while (j < cum.length - 1 && cum[j] < want) j++;
    const span = cum[j] - cum[j - 1] || 1;
    const u = Math.min(1, Math.max(0, (want - cum[j - 1]) / span));
    out.push(dense[j].map((v, k) => dense[j - 1][k] + (v - dense[j - 1][k]) * u));
  }
  return { pts: out, len: total };
}

/* ---------- roads ---------- */
// A gentle bend through a side-shifted midpoint (alternating sides), trimmed at landmarks.
export function buildRoads() {
  return EDGES.map(([a, b], i) => {
    const [ax, az] = ZONE_POS[a];
    const [bx, bz] = ZONE_POS[b];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const bulge = (i % 2 ? 1 : -1) * len * 0.1;
    const mid = [(ax + bx) / 2 - (dz / len) * bulge, (az + bz) / 2 + (dx / len) * bulge];
    // control point so the curve passes through mid
    const ctl = [2 * mid[0] - (ax + bx) / 2, 2 * mid[1] - (az + bz) / 2];
    const dense = [];
    for (let s = 0; s <= 240; s++) dense.push(quad([ax, az], ctl, [bx, bz], s / 240));
    const ta = TRIM[a] || 0;
    const tb = TRIM[b] || 0;
    const kept = dense.filter(([x, z]) => Math.hypot(x - ax, z - az) >= ta && Math.hypot(x - bx, z - bz) >= tb);
    const n = Math.max(24, Math.round(len * 2));
    const { pts, len: L } = resample(kept, n);
    return { a, b, n, len: L, pts: pts.map(([x, z]) => [x, ROAD_Y, z]) };
  });
}

/* ---------- data arcs (hub → zones), above everything ---------- */
export function buildArcs() {
  const [hx, hz] = ZONE_POS[HUB];
  return ARC_TO.map((id) => {
    const [x, z] = ZONE_POS[id];
    const d = Math.hypot(x - hx, z - hz);
    const endY = LAND_Y[id] ?? LAND_Y_DEFAULT;
    const peak = Math.min(24, Math.max(HUB_Y, endY) + 3 + d * 0.22);
    const ctl = [(hx + x) / 2, 2 * peak - (HUB_Y + endY) / 2, (hz + z) / 2];
    const dense = [];
    for (let s = 0; s <= 200; s++) dense.push(quad([hx, HUB_Y, hz], ctl, [x, endY, z], s / 200));
    const n = Math.max(40, Math.round(d * 1.2));
    const { pts, len } = resample(dense, n);
    return { a: HUB, b: id, n, len, pts };
  });
}

/* ---------- distance helpers ---------- */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

const CELL = 4;
function segmentIndex(roads) {
  const grid = new Map();
  roads.forEach((r) => {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, , az] = r.pts[i];
      const [bx, , bz] = r.pts[i + 1];
      const minx = Math.floor((Math.min(ax, bx) - 3) / CELL);
      const maxx = Math.floor((Math.max(ax, bx) + 3) / CELL);
      const minz = Math.floor((Math.min(az, bz) - 3) / CELL);
      const maxz = Math.floor((Math.max(az, bz) + 3) / CELL);
      for (let gx = minx; gx <= maxx; gx++) {
        for (let gz = minz; gz <= maxz; gz++) {
          const k = `${gx},${gz}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push([ax, az, bx, bz]);
        }
      }
    }
  });
  return (x, z) => {
    const segs = grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!segs) return Infinity;
    let best = Infinity;
    for (const s of segs) best = Math.min(best, segDist(x, z, s[0], s[1], s[2], s[3]));
    return best;
  };
}

/* ---------- buildings ---------- */
export const PALETTE_SIZE = 5;
export const BOUNDS = { x0: -64, x1: 62, z0: -60, z1: 112 };

export function generateCity(roads, arcs) {
  const roadDist = segmentIndex(roads);
  const r = rng(20261015);
  const core = ZONE_POS[HUB];
  const out = [];
  const cell = 1.9;
  for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += cell) {
    for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += cell) {
      const px = x + (r() - 0.5) * 0.5;
      const pz = z + (r() - 0.5) * 0.5;
      // every random draw happens in the same order whatever is skipped, so the city never reshuffles
      const keep = r();
      const hr = r();
      const w = 0.8 + r() * 0.8;
      const dd0 = 0.8 + r() * 0.8;
      const c0 = r();
      const c1 = r();
      const half = Math.hypot(w, dd0) / 2; // the footprint's reach from its centre

      if (distToRiver(px, pz) < RIVER_W / 2 + 0.7 + half) continue;
      if (inMaidan(px, pz)) continue;
      if (inLake(px, pz, half + 0.4)) continue;
      let blocked = false;
      for (const zn of ZONES) {
        const [zx, zz] = ZONE_POS[zn.id];
        if (Math.hypot(px - zx, pz - zz) < (CLEAR[zn.id] ?? CLEAR_DEFAULT) + half) { blocked = true; break; }
      }
      if (blocked) continue;
      if (roadDist(px, pz) < ROAD_HALF + half + 0.3) continue;

      let d = Math.exp(-((px - core[0]) ** 2 + (pz - core[1]) ** 2) / (2 * 34 * 34)) * 0.85 + 0.15;
      for (const zn of ZONES) {
        const [zx, zz] = ZONE_POS[zn.id];
        const dz = Math.hypot(px - zx, pz - zz);
        if (dz < 7) d += 0.22 * (1 - dz / 7);
        // B.P. Township is a planned residential township: a denser low-rise cluster round its hub
        if (zn.id === "bptownship" && dz < 11) d += 0.3 * (1 - dz / 11);
      }
      if (keep > Math.min(0.95, d * 1.1 + 0.1)) continue;
      const h = 0.35 + Math.pow(hr, 2.4) * 6.5 * (0.3 + d);
      out.push({ x: px, z: pz, w, d: dd0, h, c: Math.min(PALETTE_SIZE - 1, Math.floor(c0 * c1 * PALETTE_SIZE + (h > 3 ? 1 : 0))) });
    }
  }
  return keepUnderArcs(out, arcs);
}

// Anything under a data arc stays lower than the arc (with room for the moving dots), or goes.
const ARC_ROOM = 0.7;
function keepUnderArcs(list, arcs) {
  const samples = [];
  arcs.forEach((a) => a.pts.forEach((p) => samples.push(p)));
  return list
    .map((b) => {
      let cap = Infinity;
      for (const [x, y, z] of samples) {
        if (Math.abs(x - b.x) < b.w / 2 + 0.45 && Math.abs(z - b.z) < b.d / 2 + 0.45) cap = Math.min(cap, y - ARC_ROOM);
      }
      return cap === Infinity || b.h <= cap ? b : { ...b, h: cap };
    })
    .filter((b) => b.h >= 0.35);
}

/* ---------- roof heights (issue beacons sit on top of whatever is there) ---------- */
export function roofIndex(list) {
  const grid = new Map();
  list.forEach((b) => {
    const k = `${Math.floor(b.x / 2)},${Math.floor(b.z / 2)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(b);
  });
  return (x, z, pad = 0.35) => {
    let top = 0;
    const cx = Math.floor(x / 2);
    const cz = Math.floor(z / 2);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const a = grid.get(`${cx + i},${cz + j}`);
        if (!a) continue;
        for (const b of a) if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) top = Math.max(top, b.h);
      }
    }
    return top;
  };
}
