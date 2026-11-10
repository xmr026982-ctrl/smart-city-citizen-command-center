import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ZONES, toneFor } from "../../config/zones";
import { getFeed, subscribeFeed } from "../../services/liveFeed";
import { ZONE_POS, RIVER, RIVER_W, MAIDAN, bridgeYawAt, project } from "./geo";
import { buildRoads, buildArcs, generateCity, roofIndex, LAKE, HUB, BOUNDS, ROAD_HALF } from "./layout";
import {
  SKY, NIGHT, DUSK, BRIDGE_GLOW, STREET, mixInto, nightBody,
  buildingMaterial, skyMaterial, groundMaterial, riverMaterial, lightsMaterial, beamMaterial, glowLineMaterial, sweepMaterial,
} from "./looks";

/* ------------------------------------------------------------------
   The 3D city (City Health / Field Health).

   Look: the model lives under the real sky over Kolkata (sky.js). By
   day it's a crisp holographic city; after dusk it's the city of the
   home film: lit windows, sodium streets, the river promenades in
   orange, Howrah Bridge drawn in light, a beam rising from every zone.
   Dawn and dusk blend the two. Every shader reads one set of uniforms
   (looks.js SKY) eased here once a frame, so the change is one glide.

   Speed: roads and arcs are merged into a handful of meshes, buildings
   are one instanced draw with their windows drawn in the shader (no
   window geometry), lights are point sprites, labels are textures that
   redraw only when their reading changes. Small buildings and traffic
   drop out when the camera is far, and the page stops drawing when the
   model is off screen (CityPlate). No full-screen post-processing: the
   glow is drawn into the scene, so it costs the same on every laptop.

   Colour: the role accent (admin violet, staff teal, citizen cyan)
   marks the data layer: arcs, the hub, the selected zone, the scan ring.
------------------------------------------------------------------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const GREEN = new THREE.Color("#22c55e");
const AMBER = new THREE.Color("#f59e0b");
const STATUS_COLOR = { submitted: "#64748b", acknowledged: "#7c3aed", in_progress: "#f59e0b", pending_review: "#06b6d4", resolved: "#10b981" };
const FAR_LOD = 118; // camera distance where small buildings and road traffic drop out

/* ------------------------------------------------------------------ */
/*  Sky: one eased value for the whole scene                           */
/* ------------------------------------------------------------------ */
const painters = new Set();
/* a component that recolours plain materials with the sky registers here */
function usePaint(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useLayoutEffect(() => {
    const f = (n, d) => ref.current(n, d);
    painters.add(f);
    f(SKY.uNight.value, SKY.uDusk.value);
    return () => painters.delete(f);
  }, []);
}

function SkyRig({ sky, instant }) {
  const scene = useThree((s) => s.scene);
  const hemi = useRef(null);
  const sun = useRef(null);
  const fog = useMemo(() => new THREE.Fog("#eef2f8", 110, 300), []);
  const duskHorizon = useMemo(() => new THREE.Color(DUSK.horizon), []);
  const last = useRef({ n: -1, d: -1 });
  const first = useRef(true);
  useLayoutEffect(() => { scene.fog = fog; return () => { scene.fog = null; }; }, [scene, fog]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    SKY.uTime.value += dt;
    const k = first.current || instant ? 1 : 1 - Math.exp(-dt * 1.4); // about two seconds from day to night
    first.current = false;
    SKY.uNight.value += (sky.night - SKY.uNight.value) * k;
    SKY.uDusk.value += (sky.dusk - SKY.uDusk.value) * k;
    const n = SKY.uNight.value;
    const d = SKY.uDusk.value;
    if (Math.abs(n - last.current.n) < 0.0015 && Math.abs(d - last.current.d) < 0.0015) return;
    last.current = { n, d };
    // surfaces cross over on the same curve as the shaders (looks.js): quick, no long grey half-way
    const nb = nightBody(n);
    // the far haze: the horizon colour, warmed at dusk, closer in at night
    mixInto(SKY.uFogColor.value, "horizon", nb).lerp(duskHorizon, d * 0.3 * (1 - nb));
    SKY.uFogNear.value = 110 - nb * 20;
    SKY.uFogFar.value = 300 - nb * 60;
    fog.color.copy(SKY.uFogColor.value);
    fog.near = SKY.uFogNear.value;
    fog.far = SKY.uFogFar.value;
    if (hemi.current) {
      mixInto(hemi.current.color, "hemiSky", nb);
      mixInto(hemi.current.groundColor, "hemiGround", nb);
      hemi.current.intensity = 0.95 + (NIGHT.hemi - 0.95) * nb;
    }
    if (sun.current) {
      mixInto(sun.current.color, "sun", nb);
      sun.current.intensity = 1.35 + (NIGHT.sunI - 1.35) * nb;
    }
    painters.forEach((f) => f(nb, d));
  }, -2);

  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffffff", "#c7d3ea", 0.95]} />
      <directionalLight ref={sun} position={[55, 85, 35]} intensity={1.35} />
    </>
  );
}

function SkyDome() {
  const mat = useMemo(skyMaterial, []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[420, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */
const toCurve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");

// one geometry from many (position / normal / uv), so a whole layer is one draw call
function mergeAll(list) {
  let verts = 0;
  let idx = 0;
  list.forEach((g) => { verts += g.attributes.position.count; idx += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const index = new Uint32Array(idx);
  let vo = 0;
  let io = 0;
  list.forEach((g) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < n; i++) index[io + i] = vo + i; io += n; }
    vo += n;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

const flat = (c) => {
  const a = new Float32Array(c.pts.length * 3);
  c.pts.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; });
  return { ...c, arr: a };
};

/* the river's banks, shared by the water and its promenade lights */
function riverPath() {
  const ctrl = RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const n = ctrl.length;
  const head = ctrl[0].clone().add(ctrl[0].clone().sub(ctrl[1]).multiplyScalar(3));
  const tail = ctrl[n - 1].clone().add(ctrl[n - 1].clone().sub(ctrl[n - 2]).multiplyScalar(3));
  const pts = new THREE.CatmullRomCurve3([head, ...ctrl, tail]).getSpacedPoints(220);
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    return { p, tx, tz, w: (RIVER_W / 2) * (1 + 0.12 * Math.sin(i * 0.15)) };
  });
}

/* ------------------------------------------------------------------ */
/*  Moving dots (one instanced mesh per layer)                         */
/* ------------------------------------------------------------------ */
const tmpA = new THREE.Color();
const roadSpeed = (c, f) => 1.0 + Math.min(f.zones[c.a]?.traffic ?? 80, f.zones[c.b]?.traffic ?? 80) * 0.035;
const roadColor = (c, f, out) => {
  const slow = Math.min(f.zones[c.a]?.traffic ?? 80, f.zones[c.b]?.traffic ?? 80) < 60;
  return mixInto(out, slow ? "trafficSlow" : "traffic", SKY.uNight.value);
};
const arcSpeed = () => 9;

function Flow({ curves, per, radius, yOff = 0, speedOf, colorOf, lod = false }) {
  const mesh = useRef(null);
  const count = curves.length * per;
  const phase = useMemo(() => Float32Array.from({ length: count }, (_, i) => ((i % per) / per + Math.floor(i / per) * 0.137) % 1), [count, per]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const acc = useRef(10);

  useLayoutEffect(() => {
    const m = mesh.current;
    const feed = getFeed();
    curves.forEach((c, ci) => { colorOf(c, feed, col); for (let k = 0; k < per; k++) m.setColorAt(ci * per + k, col); });
    m.instanceColor.needsUpdate = true;
  }, [curves, per, colorOf, col]);

  useFrame(({ camera, controls }, dt0) => {
    const m = mesh.current;
    if (!m) return;
    if (lod && controls) {
      m.visible = camera.position.distanceTo(controls.target) < FAR_LOD;
      if (!m.visible) return;
    }
    const dt = Math.min(dt0, 0.05);
    const feed = getFeed();
    acc.current += dt;
    const recolor = acc.current > 0.5;
    if (recolor) acc.current = 0;
    for (let ci = 0; ci < curves.length; ci++) {
      const c = curves[ci];
      const v = (speedOf(c, feed) * dt) / c.len;
      if (recolor) { colorOf(c, feed, col); for (let k = 0; k < per; k++) m.setColorAt(ci * per + k, col); }
      for (let k = 0; k < per; k++) {
        const i = ci * per + k;
        let t = phase[i] + v;
        if (t >= 1) t -= 1;
        phase[i] = t;
        const f = t * c.n;
        const i0 = Math.min(c.n - 1, Math.floor(f));
        const u = f - i0;
        const a = i0 * 3;
        const b = a + 3;
        const p = c.arr;
        dummy.position.set(p[a] + (p[b] - p[a]) * u, p[a + 1] + (p[b + 1] - p[a + 1]) * u + yOff, p[a + 2] + (p[b + 2] - p[a + 2]) * u);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (recolor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[radius, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Roads({ roads, arcs, accent }) {
  const geo = useMemo(() => {
    const bed = mergeAll(roads.map((r) => { const g = new THREE.TubeGeometry(toCurve(r.pts), r.n, ROAD_HALF, 6, false); g.scale(1, 0.12, 1); g.translate(0, 0.09, 0); return g; }));
    const core = mergeAll(roads.map((r) => new THREE.TubeGeometry(toCurve(r.pts), r.n, 0.09, 5, false)));
    const arc = mergeAll(arcs.map((r) => new THREE.TubeGeometry(toCurve(r.pts), r.n, 0.05, 5, false)));
    const arcGlow = mergeAll(arcs.map((r) => new THREE.TubeGeometry(toCurve(r.pts), r.n, 0.2, 6, false)));
    return { bed, core, arc, arcGlow };
  }, [roads, arcs]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const bed = useRef(null);
  const core = useRef(null);
  const glow = useRef(null);
  usePaint((n) => {
    if (bed.current) mixInto(bed.current.color, "roadBed", n);
    if (core.current) mixInto(core.current.color, "roadCore", n);
    if (glow.current) glow.current.opacity = 0.05 + 0.13 * n;
  });
  const arcColor = useMemo(() => (c, f, out) => out.set(accent).lerp(tmpA.set("#ffffff"), SKY.uNight.value * 0.35), [accent]);
  return (
    <>
      <mesh geometry={geo.bed}><meshBasicMaterial ref={bed} color="#e3eaf5" /></mesh>
      <mesh geometry={geo.core}><meshBasicMaterial ref={core} color="#a9c0ea" /></mesh>
      <mesh geometry={geo.arc}><meshBasicMaterial color={accent} transparent opacity={0.55} depthWrite={false} toneMapped={false} /></mesh>
      <mesh geometry={geo.arcGlow}><meshBasicMaterial ref={glow} color={accent} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      <Flow curves={roads} per={5} radius={0.16} yOff={0.12} speedOf={roadSpeed} colorOf={roadColor} lod />
      <Flow curves={arcs} per={3} radius={0.2} speedOf={arcSpeed} colorOf={arcColor} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Lights: streetlights, the river promenades, the bridge deck        */
/* ------------------------------------------------------------------ */
function CityLights({ roads, bridge }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const mat = useMemo(lightsMaterial, []);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const dpr = gl.getPixelRatio ? gl.getPixelRatio() : 1;
    mat.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(((camera.fov || 35) * Math.PI) / 360));
  }, [size.height, camera, gl, mat]);

  const geo = useMemo(() => {
    const pos = [];
    const col = [];
    const sz = [];
    const ph = [];
    const street = new THREE.Color(STREET);
    const white = new THREE.Color("#e6efff");
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const add = (x, y, z, c, s) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); sz.push(s); ph.push(rnd() * 6.28); };
    // streets: both kerbs, staggered, every 1.7 units
    roads.forEach((r) => {
      const p = r.pts;
      let carry = 0;
      let side = 1;
      for (let i = 1; i < p.length; i++) {
        const dx = p[i][0] - p[i - 1][0];
        const dz = p[i][2] - p[i - 1][2];
        const l = Math.hypot(dx, dz) || 1;
        carry += l;
        while (carry >= 1.7) {
          carry -= 1.7;
          const t = 1 - carry / l;
          const x = p[i - 1][0] + dx * t;
          const z = p[i - 1][2] + dz * t;
          const o = (ROAD_HALF + 0.14) * side;
          add(x - (dz / l) * o, 0.42, z + (dx / l) * o, rnd() < 0.12 ? white : street, 0.5);
          side = -side;
        }
      }
    });
    // the river promenades: a dense string of lamps on both banks
    riverPath().forEach(({ p, tx, tz, w }, i) => {
      if (i % 2) return;
      const o = w + 0.45;
      add(p.x - tz * o, 0.3, p.z + tx * o, street, 0.62);
      add(p.x + tz * o, 0.3, p.z - tx * o, street, 0.62);
    });
    // Howrah Bridge: lamps along both deck edges
    for (let s = -4.3; s <= 4.31; s += 0.55) {
      for (const e of [-0.42, 0.42]) {
        const v = new THREE.Vector3(s, 0.7, e).applyAxisAngle(THREE.Object3D.DEFAULT_UP, bridge.yaw);
        add(bridge.x + v.x, v.y, bridge.z + v.z, white, 0.42);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(sz, 1));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(ph, 1));
    g.computeBoundingSphere();
    return g;
  }, [roads, bridge]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <points geometry={geo} material={mat} renderOrder={4} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/*  Buildings: two instanced layers (tall ones always, small ones near) */
/* ------------------------------------------------------------------ */
function useBoxGeo() {
  const g = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    return box;
  }, []);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

function BuildingLayer({ items, geo, mat, lod }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const m = ref.current;
    const o = new THREE.Object3D();
    items.forEach((b, i) => {
      o.position.set(b.x, 0, b.z);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  useFrame(({ camera, controls }) => {
    if (lod && ref.current && controls) ref.current.visible = camera.position.distanceTo(controls.target) < FAR_LOD;
  });
  return (
    <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} />
  );
}

function Buildings({ city }) {
  const geo = useBoxGeo();
  const mat = useMemo(buildingMaterial, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const major = useMemo(() => city.filter((b) => b.h >= 1.6), [city]);
  const minor = useMemo(() => city.filter((b) => b.h < 1.6), [city]);
  return (
    <>
      <BuildingLayer items={major} geo={geo} mat={mat} />
      <BuildingLayer items={minor} geo={geo} mat={mat} lod />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Ground, Maidan, Patuli lake, river                                 */
/* ------------------------------------------------------------------ */
function Ground() {
  const mat = useMemo(groundMaterial, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const park = useRef(null);
  const park2 = useRef(null);
  const lake = useRef(null);
  usePaint((n) => {
    if (park.current) mixInto(park.current.color, "park", n);
    if (park2.current) mixInto(park2.current.color, "park", n);
    if (lake.current) mixInto(lake.current.color, "lake", n);
  });
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 20]} material={mat}>
        <circleGeometry args={[240, 72]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MAIDAN.x, 0.04, MAIDAN.z]} scale={[MAIDAN.rx, MAIDAN.rz, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial ref={park} color="#d6ecdd" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAKE.x, 0.05, LAKE.z]} scale={[LAKE.rx + 0.5, LAKE.rz + 0.5, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial ref={park2} color="#d6ecdd" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAKE.x, 0.07, LAKE.z]} scale={[LAKE.rx, LAKE.rz, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial ref={lake} color="#bfdcf3" />
      </mesh>
    </>
  );
}

function River() {
  const mat = useMemo(riverMaterial, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const geo = useMemo(() => {
    const pos = [];
    const uv = [];
    const idx = [];
    let dist = 0;
    const path = riverPath();
    path.forEach(({ p, tx, tz, w }, i) => {
      pos.push(p.x - tz * w, 0.05, p.z + tx * w, p.x + tz * w, 0.05, p.z - tx * w);
      if (i > 0) dist += p.distanceTo(path[i - 1].p);
      uv.push(0, dist, 1, dist);
      if (i < path.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} />;
}

/* ------------------------------------------------------------------ */
/*  Landmarks                                                          */
/* ------------------------------------------------------------------ */
function useSteel() {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9d4e8", roughness: 0.5, metalness: 0.2, emissive: "#7aa7ff", emissiveIntensity: 0.25 }), []);
  useEffect(() => () => m.dispose(), [m]);
  usePaint((n) => { mixInto(m.color, "steel", n); m.emissiveIntensity = 0.25 - 0.15 * n; });
  return m;
}

function HowrahBridge() {
  const [x, z] = ZONE_POS.howrah;
  const yaw = bridgeYawAt(x, z);
  const hangers = useRef(null);
  const steel = useSteel();
  const chord = useMemo(() => {
    const pts = [[-4.4, 0.62], [-3.1, 1.75], [-1.8, 3.3], [0, 2.65], [1.8, 3.3], [3.1, 1.75], [4.4, 0.62]].map(([a, b]) => new THREE.Vector3(a, b, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return { geo: new THREE.TubeGeometry(curve, 80, 0.07, 6, false), glow: new THREE.TubeGeometry(curve, 80, 0.2, 8, false), samples: curve.getPoints(200) };
  }, []);
  const deck = useMemo(() => {
    const line = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.6, 0.62, 0), new THREE.Vector3(4.6, 0.62, 0)]);
    return new THREE.TubeGeometry(line, 40, 0.05, 6, false);
  }, []);
  useEffect(() => () => { chord.geo.dispose(); chord.glow.dispose(); deck.dispose(); }, [chord, deck]);
  const core = useMemo(() => glowLineMaterial(BRIDGE_GLOW, { speed: 0.16, base: 0.7, pulse: 1.1, width: 0 }), []);
  const halo = useMemo(() => glowLineMaterial(BRIDGE_GLOW, { speed: 0.16, base: 0.22, pulse: 0.35, width: 1 }), []);
  const deckGlow = useMemo(() => glowLineMaterial(BRIDGE_GLOW, { speed: 0.3, base: 0.5, pulse: 0.8, width: 0 }), []);
  useEffect(() => () => { core.dispose(); halo.dispose(); deckGlow.dispose(); }, [core, halo, deckGlow]);

  useLayoutEffect(() => {
    const m = hangers.current;
    const o = new THREE.Object3D();
    let i = 0;
    for (let hx = -4.2; hx <= 4.21; hx += 0.35) {
      let best = chord.samples[0];
      for (const p of chord.samples) if (Math.abs(p.x - hx) < Math.abs(best.x - hx)) best = p;
      const h = Math.max(0.1, best.y - 0.62);
      for (const sz of [-0.4, 0.4]) {
        o.position.set(hx, 0.62 + h / 2, sz);
        o.scale.set(0.03, h, 0.03);
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
  }, [chord]);

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.55, 0]} material={steel}><boxGeometry args={[9.2, 0.12, 0.9]} /></mesh>
      {[-1.8, 1.8].flatMap((px) => [-0.4, 0.4].map((pz) => (
        <mesh key={`${px}${pz}`} position={[px, 1.65, pz]} material={steel}><boxGeometry args={[0.26, 3.3, 0.26]} /></mesh>
      )))}
      {[-0.4, 0.4].map((pz) => (
        <group key={pz} position={[0, 0, pz]}>
          <mesh geometry={chord.geo} material={steel} />
          <mesh geometry={chord.geo} material={core} renderOrder={6} />
          <mesh geometry={chord.glow} material={halo} renderOrder={7} />
          <mesh geometry={deck} material={deckGlow} renderOrder={6} />
        </group>
      ))}
      <instancedMesh ref={hangers} args={[undefined, steel, 60]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}

/* floodlit stone: white by day, lit warm-white from below at night */
function useStone() {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, emissive: "#f3e3c3", emissiveIntensity: 0 }), []);
  useEffect(() => () => m.dispose(), [m]);
  usePaint((n) => { mixInto(m.color, "stone", n); m.emissiveIntensity = 0.42 * n; });
  return m;
}

function Victoria() {
  const [x, z] = ZONE_POS.victoria;
  const stone = useStone();
  return (
    <group position={[x, 0, z]} scale={1.15}>
      <mesh position={[0, 0.12, 0]} material={stone}><boxGeometry args={[4.4, 0.24, 3.4]} /></mesh>
      <mesh position={[0, 0.8, 0]} material={stone}><boxGeometry args={[2.7, 1.1, 1.9]} /></mesh>
      <mesh position={[0, 1.35, 0]} material={stone}><sphereGeometry args={[0.85, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh position={[0, 2.35, 0]} material={stone}><cylinderGeometry args={[0.06, 0.1, 0.5, 8]} /></mesh>
      {[-1.55, 1.55].flatMap((px) => [-0.95, 0.95].map((pz) => (
        <mesh key={`${px}${pz}`} position={[px, 1.35, pz]} material={stone}><sphereGeometry args={[0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      )))}
      {[-1.55, 1.55].flatMap((px) => [-0.95, 0.95].map((pz) => (
        <mesh key={`b${px}${pz}`} position={[px, 0.7, pz]} material={stone}><boxGeometry args={[0.7, 0.9, 0.7]} /></mesh>
      )))}
    </group>
  );
}

function CentralTowers() {
  const [x, z] = ZONE_POS.central;
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8f0fb", roughness: 0.25, metalness: 0.3, emissive: "#38bdf8", emissiveIntensity: 0.3 }), []);
  const tip = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ef4444", toneMapped: false }), []);
  useEffect(() => () => { glass.dispose(); tip.dispose(); }, [glass, tip]);
  usePaint((n) => { glass.color.set("#e8f0fb").lerp(tmpA.set("#1d2b4a"), n); glass.emissiveIntensity = 0.3 + 0.55 * n; });
  // aircraft warning lights on the masts, blinking
  useFrame(() => { const on = Math.sin(SKY.uTime.value * 3.2) > 0.2; tip.color.set(on ? "#ff4d4d" : "#3a0d0d"); });
  return (
    <group position={[x, 0, z]}>
      {[[-1.1, 0.3, 5.2], [0.5, -0.9, 7.4], [1.4, 0.9, 4.2]].map(([px, pz, h], i) => (
        <group key={i} position={[px, 0, pz]}>
          <mesh position={[0, h / 2, 0]} material={glass}><boxGeometry args={[0.85, h, 0.85]} /></mesh>
          <mesh position={[0, h + 0.5, 0]}><cylinderGeometry args={[0.02, 0.04, 1, 6]} /><meshBasicMaterial color="#64748b" /></mesh>
          <mesh position={[0, h + 1.02, 0]} material={tip}><sphereGeometry args={[0.07, 8, 6]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function ShahidMinar() {
  const [x, z] = ZONE_POS.esplanade;
  const stone = useStone();
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]} material={stone}><boxGeometry args={[1.2, 0.4, 1.2]} /></mesh>
      <mesh position={[0, 2.2, 0]} material={stone}><cylinderGeometry args={[0.14, 0.24, 3.6, 16]} /></mesh>
      <mesh position={[0, 4.1, 0]} material={stone}><sphereGeometry args={[0.3, 16, 12]} /></mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Hub: the glow follows the live feed (more zones under watch →      */
/*  warmer and faster) and a radar sweep turns over it                 */
/* ------------------------------------------------------------------ */
function HubGlow({ accent }) {
  const [x, z] = ZONE_POS[HUB];
  const disc = useRef(null);
  const ring = useRef(null);
  const base = useMemo(() => new THREE.Color(accent), [accent]);
  const col = useMemo(() => new THREE.Color(), []);
  const sweep = useMemo(() => sweepMaterial(accent), [accent]);
  useEffect(() => () => sweep.dispose(), [sweep]);
  const share = useRef(0);
  const acc = useRef(10);
  const phase = useRef(0);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    acc.current += dt;
    if (acc.current > 0.5) {
      acc.current = 0;
      const f = getFeed();
      const warn = ZONES.filter((zn) => toneFor(f.zones[zn.id]) === "warn").length;
      share.current = warn / ZONES.length;
    }
    const s = share.current;
    phase.current += dt * (0.5 + s * 1.6);
    const wave = 0.5 + 0.5 * Math.sin(phase.current * Math.PI * 2);
    col.copy(base).lerp(AMBER, clamp(s * 1.8, 0, 0.85));
    if (disc.current) { disc.current.material.color.copy(col); disc.current.material.opacity = 0.07 + 0.06 * wave + s * 0.08; }
    if (ring.current) { ring.current.material.color.copy(col); ring.current.material.opacity = 0.25 + 0.3 * wave; ring.current.scale.setScalar(1 + wave * 0.06); }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[3.3, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[3.15, 3.35, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={11} material={sweep} renderOrder={3}>
        <circleGeometry args={[1, 72]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Labels, drawn into the scene (a texture per label, redrawn only     */
/*  when its reading or the light changes) and kept on top              */
/* ------------------------------------------------------------------ */
const NAME_FONT = "700 19px 'JetBrains Mono', ui-monospace, monospace";
const VALUE_FONT = "650 27px 'IBM Plex Sans', system-ui, sans-serif";
const LABEL_H = 132;
const LABEL_SCALE = 0.056; // share of the view height (constant on screen)
const PAD = 22;

function drawLabel(canvas, { name, value, on, accent, dark, tone }) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = NAME_FONT;
  const wn = ctx.measureText(name).width + name.length * 2.2;
  ctx.font = VALUE_FONT;
  const wv = ctx.measureText(value).width;
  const pw = Math.min(canvas.width - 8, Math.max(wn, wv) + PAD * 2 + 14);
  const x0 = (canvas.width - pw) / 2;
  const y0 = 8;
  const ph = 92;
  const edge = on ? accent : tone === "warn" ? "#f59e0b" : dark ? "#3ec7b6" : "#94a3b8";
  // panel: dark glass after dusk, light glass by day
  ctx.shadowColor = dark ? "rgba(0,0,0,.55)" : "rgba(15,23,42,.18)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = dark ? (on ? "rgba(12,18,40,.94)" : "rgba(7,13,30,.84)") : on ? accent : "rgba(255,255,255,.96)";
  ctx.beginPath();
  ctx.roundRect(x0, y0, pw, ph, 12);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = on ? 3 : 2;
  ctx.strokeStyle = dark ? edge : on ? "rgba(255,255,255,.0)" : "rgba(148,163,184,.4)";
  ctx.stroke();
  // a lit edge on the left, like the film's tags
  ctx.fillStyle = edge;
  ctx.fillRect(x0 + 10, y0 + 18, 4, ph - 36);
  // pointer down to the zone
  ctx.fillStyle = dark ? edge : on ? accent : "rgba(255,255,255,.96)";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 9, y0 + ph - 1);
  ctx.lineTo(canvas.width / 2 + 9, y0 + ph - 1);
  ctx.lineTo(canvas.width / 2, y0 + ph + 13);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.font = NAME_FONT;
  ctx.fillStyle = dark ? (on ? "#ffffff" : "rgba(170,198,236,.92)") : on ? "rgba(255,255,255,.85)" : "#64748b";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
  ctx.fillText(name, x0 + PAD + 6, y0 + 30);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.font = VALUE_FONT;
  ctx.fillStyle = dark || on ? "#ffffff" : "#0f172a";
  ctx.fillText(value, x0 + PAD + 6, y0 + 63);
}

function labelWidth(name) {
  const c = document.createElement("canvas").getContext("2d");
  c.font = NAME_FONT;
  const wn = c.measureText(name.toUpperCase()).width + name.length * 2.2;
  c.font = VALUE_FONT;
  const wv = c.measureText("AQI 000 · LIVE").width;
  return Math.ceil(Math.max(wn, wv) + PAD * 2 + 14 + 40);
}

function ZoneLabel({ zone, active, accent, onSelect, y, dark }) {
  const [x, z] = ZONE_POS[zone.id];
  const aqi = useSyncExternalStore(subscribeFeed, () => Math.round(getFeed().zones[zone.id]?.aqi ?? 0));
  const tone = useSyncExternalStore(subscribeFeed, () => toneFor(getFeed().zones[zone.id]));
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = labelWidth(zone.name);
    canvas.height = LABEL_H;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [zone.name]);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    const paint = () => { drawLabel(tex.image, { name: zone.name.toUpperCase(), value: `AQI ${aqi} · LIVE`, on: active, accent, dark, tone }); tex.needsUpdate = true; };
    paint();
    let live = true;
    document.fonts?.ready?.then(() => { if (live) paint(); });
    return () => { live = false; };
  }, [tex, zone.name, aqi, active, accent, dark, tone]);
  const aspect = tex.image.width / LABEL_H;
  return (
    <sprite
      position={[x, y, z]}
      center={[0.5, 0.3]}
      scale={[LABEL_SCALE * aspect, LABEL_SCALE, 1]}
      renderOrder={20}
      onClick={(e) => { e.stopPropagation(); onSelect(zone); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} toneMapped={false} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/*  Zones: a beacon and a beam of light per zone                       */
/* ------------------------------------------------------------------ */
const BEAM_H = { on: 15, off: 7.5 };
function Zones({ activeId, onSelect, accent, dark }) {
  const refs = useRef({});
  const acc = useRef(10);
  const [hover, setHover] = useState(null);
  const beamGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.42, 0.42, 1, 18, 1, true); g.translate(0, 0.5, 0); return g; }, []);
  const coreGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true); g.translate(0, 0.5, 0); return g; }, []);
  const mats = useMemo(() => Object.fromEntries(ZONES.map((z, i) => [z.id, beamMaterial("#22c55e", i * 0.37)])), []);
  const accentCol = useMemo(() => new THREE.Color(accent), [accent]);
  useEffect(() => () => { beamGeo.dispose(); coreGeo.dispose(); Object.values(mats).forEach((m) => m.dispose()); }, [beamGeo, coreGeo, mats]);
  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    acc.current += dt;
    const recolor = acc.current > 0.5;
    if (recolor) acc.current = 0;
    const feed = getFeed();
    ZONES.forEach((z, i) => {
      const r = refs.current[z.id];
      if (!r || !r.ring || !r.core) return;
      const on = z.id === activeId;
      const ph = (t * (on ? 0.9 : 0.5) + i * 0.37) % 1;
      r.ring.scale.setScalar((on ? 1.5 : 1) * (0.6 + ph * 2.2));
      r.ring.material.opacity = (1 - ph) * (on ? 0.75 : 0.4);
      r.core.position.y = 0.95 + Math.sin(t * 1.6 + i) * 0.08;
      r.core.scale.setScalar(on ? 1.5 : 1);
      // the beam grows to the selected zone and settles back on the others
      if (r.beam) {
        const want = on ? BEAM_H.on : BEAM_H.off;
        const s = r.beam.scale.y + (want - r.beam.scale.y) * Math.min(1, dt * 3);
        r.beam.scale.set(on ? 1.3 : 1, s, on ? 1.3 : 1);
        if (r.beamCore) r.beamCore.scale.y = s;
      }
      if (recolor) {
        const c = on ? accentCol : toneFor(feed.zones[z.id]) === "warn" ? AMBER : GREEN;
        r.core.material.color.copy(c);
        r.ring.material.color.copy(c);
        mats[z.id].uniforms.uColor.value.copy(c);
        mats[z.id].uniforms.uBoost.value = on ? 1.35 : 1;
      }
    });
  });

  // labels land above whatever stands at the zone (landmark tops)
  const LABEL_Y = { central: 9.6, esplanade: 5.2, howrah: 4.2, victoria: 3.8 };
  return (
    <>
      {ZONES.map((z) => {
        const [x, zz] = ZONE_POS[z.id];
        const slot = (refs.current[z.id] = refs.current[z.id] || {});
        return (
          <group key={z.id} position={[x, 0, zz]}>
            <mesh ref={(el) => { slot.ring = el; }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
              <ringGeometry args={[0.5, 0.62, 40]} />
              <meshBasicMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh ref={(el) => { slot.beam = el; }} geometry={beamGeo} material={mats[z.id]} scale={[1, BEAM_H.off, 1]} renderOrder={8} />
            <mesh ref={(el) => { slot.beamCore = el; }} geometry={coreGeo} material={mats[z.id]} scale={[1, BEAM_H.off, 1]} renderOrder={9} />
            <mesh ref={(el) => { slot.core = el; }} position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.26, 16, 12]} />
              <meshBasicMaterial color="#22c55e" toneMapped={false} />
            </mesh>
            <mesh
              position={[0, 0.9, 0]}
              onClick={(e) => { e.stopPropagation(); onSelect(z); }}
              onPointerOver={(e) => { e.stopPropagation(); setHover(z.id); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { setHover(null); document.body.style.cursor = "auto"; }}
            >
              <sphereGeometry args={[1.1, 10, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
      {ZONES.filter((z) => z.landmark || z.id === activeId || z.id === hover).map((z) => (
        <ZoneLabel key={z.id} zone={z} active={z.id === activeId} accent={accent} onSelect={onSelect} y={LABEL_Y[z.id] ?? 1.5} dark={dark} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Scan ring: one sweep across the zone just selected                 */
/* ------------------------------------------------------------------ */
function ScanRing({ activeId, accent }) {
  const ref = useRef(null);
  const t = useRef(-1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    t.current = 0;
  }, [activeId]);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (t.current < 0) { m.visible = false; return; }
    t.current += Math.min(dt, 0.05);
    const k = t.current / 1.5;
    if (k >= 1) { t.current = -1; m.visible = false; return; }
    const [x, z] = ZONE_POS[activeId] || [0, 0];
    m.visible = true;
    m.position.set(x, 0.14, z);
    const e = 1 - Math.pow(1 - k, 3);
    m.scale.setScalar(0.6 + e * 8);
    m.material.opacity = 0.85 * (1 - k);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}>
      <ringGeometry args={[0.9, 1, 72]} />
      <meshBasicMaterial color={accent} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Ripples: an issue filed or moved somewhere sends a ring out there  */
/* ------------------------------------------------------------------ */
const RIPPLES = 6;
function Ripples({ queue }) {
  const refs = useRef([]);
  const slots = useRef(Array.from({ length: RIPPLES }, () => ({ t: -1 })));
  const next = useRef(0);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    while (queue.current.length) {
      const r = queue.current.shift();
      const at = next.current;
      const s = slots.current[at];
      next.current = (next.current + 1) % RIPPLES;
      Object.assign(s, { t: 0, x: r.x, z: r.z, y: r.y ?? 0.15 });
      if (refs.current[at]) refs.current[at].material.color.set(r.color);
    }
    slots.current.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      if (s.t < 0) { m.visible = false; return; }
      s.t += dt;
      const k = s.t / 1.8;
      if (k >= 1) { s.t = -1; m.visible = false; return; }
      m.visible = true;
      m.position.set(s.x, s.y, s.z);
      m.scale.setScalar(0.4 + (1 - Math.pow(1 - k, 2)) * 4.2);
      m.material.opacity = 0.85 * (1 - k);
    });
  });
  return Array.from({ length: RIPPLES }, (_, i) => (
    <mesh key={i} ref={(el) => { refs.current[i] = el; }} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={6}>
      <ringGeometry args={[0.8, 1, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  ));
}

/* ------------------------------------------------------------------ */
/*  Issue beacons in the selected zone (sitting on the roof below)     */
/* ------------------------------------------------------------------ */
function IssueBeacon({ b, onOpen, onHover, hovered, accent }) {
  const head = useRef(null);
  const halo = useRef(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (head.current) {
      head.current.rotation.y = t * 1.2;
      head.current.position.y = b.top + 1.75 + Math.sin(t * 2 + b.seed) * 0.06;
      head.current.scale.setScalar(hovered ? 1.45 : 1);
    }
    if (halo.current) {
      const loud = b.breached || b.fresh;
      const k = (t * (loud ? 0.9 : 0.45) + b.seed) % 1;
      halo.current.scale.setScalar(0.5 + k * (loud ? 2.4 : 1.6));
      halo.current.material.opacity = (1 - k) * (loud ? 0.8 : 0.45);
    }
  });
  const color = b.breached ? "#ef4444" : STATUS_COLOR[b.status] || "#64748b";
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.top + 0.8, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, b.top + 0.03, 0]}>
        <ringGeometry args={[0.32, 0.42, 32]} />
        <meshBasicMaterial color={b.fresh && !b.breached ? accent : color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={head}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh
        position={[0, b.top + 1.6, 0]}
        onClick={(e) => { e.stopPropagation(); onOpen(b.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(b.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[0.7, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function IssueBeacons({ beacons, roofAt, onOpen, onHover, hoverId, accent }) {
  const placed = useMemo(
    () => beacons.map((b, i) => {
      const [x, z] = project(b.lat, b.lng);
      return { ...b, x, z, top: roofAt(x, z), seed: (i * 0.37) % 1 };
    }),
    [beacons, roofAt]
  );
  return placed.map((b) => <IssueBeacon key={b.id} b={b} onOpen={onOpen} onHover={onHover} hovered={hoverId === b.id} accent={accent} />);
}

/* ------------------------------------------------------------------ */
/*  Camera: an opening glide, glide to a zone, 2D/3D tilt, and a       */
/*  steady auto orbit                                                  */
/*  - opening: from high over the river down onto the city (skipped    */
/*    with Reduce motion)                                              */
/*  - constant speed (frame-rate independent), slower when zoomed in   */
/*  - a drag takes over at once; the orbit eases back 1.5 s after      */
/*  - zooming pauses it; it resumes 1.5 s after the last wheel step,   */
/*    orbiting the spot you zoomed to                                  */
/* ------------------------------------------------------------------ */
const ORBIT_RAD_S = 0.045;
const RESUME_MS = 1500;

function CameraRig({ goal, orbit, intro }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const off = useMemo(() => new THREE.Vector3(), []);
  const sph = useMemo(() => new THREE.Spherical(), []);
  const spin = useRef(orbit ? 1 : 0);
  const held = useRef(false);
  const resumeAt = useRef(0);
  const opened = useRef(false);

  // the opening glide: start high and wide, then settle onto the city
  useEffect(() => {
    if (!controls || opened.current) return;
    opened.current = true;
    if (!intro) return;
    off.copy(camera.position).sub(controls.target);
    sph.setFromVector3(off);
    sph.radius = 150;
    sph.phi = 0.42;
    sph.theta -= 0.75;
    off.setFromSpherical(sph);
    camera.position.copy(controls.target).add(off);
    goal.current = { ...(goal.current || {}), dist: goal.current?.dist ?? 96, phi: 1.0, ease: 0.09 };
    spin.current = 0;
    resumeAt.current = performance.now() + 2600;
  }, [controls, intro, camera, goal, off, sph]);

  useEffect(() => {
    if (!controls) return undefined;
    const start = () => { held.current = true; if (goal.current) goal.current.ease = undefined; };
    const end = () => { held.current = false; resumeAt.current = performance.now() + RESUME_MS; };
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    return () => {
      controls.removeEventListener("start", start);
      controls.removeEventListener("end", end);
    };
  }, [controls, goal]);

  useFrame((_, dt0) => {
    if (!controls) return;
    const dt = Math.min(dt0, 0.05);
    const t = controls.target;
    const g = goal.current;
    if (g) {
      const k = 1 - Math.pow(g.ease ?? 0.0006, dt);
      off.copy(camera.position).sub(t);
      sph.setFromVector3(off);
      if (g.x !== undefined) {
        t.x += (g.x - t.x) * k;
        t.z += (g.z - t.z) * k;
        if (Math.abs(g.x - t.x) + Math.abs(g.z - t.z) < 0.03) { g.x = undefined; g.z = undefined; }
      }
      if (g.dist !== undefined) {
        sph.radius += (g.dist - sph.radius) * k;
        if (Math.abs(g.dist - sph.radius) < 0.08) g.dist = undefined;
      }
      if (g.phi !== undefined) {
        sph.phi += (g.phi - sph.phi) * k;
        if (Math.abs(g.phi - sph.phi) < 0.004) g.phi = undefined;
      }
      off.setFromSpherical(sph);
      camera.position.copy(t).add(off);
      if (g.x === undefined && g.dist === undefined && g.phi === undefined) goal.current = null;
    }

    // auto orbit
    const want = orbit && !held.current && performance.now() >= resumeAt.current ? 1 : 0;
    spin.current += (want - spin.current) * (1 - Math.exp(-dt * (want ? 1.6 : 8)));
    if (spin.current > 0.001) {
      off.copy(camera.position).sub(t);
      const r = off.length();
      const zoomFactor = clamp((r - 20) / 76, 0.3, 1);
      off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, ORBIT_RAD_S * spin.current * zoomFactor * dt);
      camera.position.copy(t).add(off);
    }

    // keep the target over the city (it reaches B.P. Township in the south-east)
    const cx = clamp(t.x, BOUNDS.x0 - 10, BOUNDS.x1 + 12);
    const cz = clamp(t.z, BOUNDS.z0 - 10, BOUNDS.z1 + 4);
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x;
      camera.position.z += cz - t.z;
      t.x = cx;
      t.z = cz;
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
function CityScene({ activeId, onSelect, goal, orbit, accent, beacons, onOpenIssue, onHoverIssue, hoverIssueId, ripples, sky, intro = true, instantSky = false }) {
  const roads = useMemo(() => buildRoads().map(flat), []);
  const arcs = useMemo(() => buildArcs().map(flat), []);
  const city = useMemo(() => generateCity(roads, arcs), [roads, arcs]);
  const roofAt = useMemo(() => roofIndex(city), [city]);
  const bridge = useMemo(() => { const [x, z] = ZONE_POS.howrah; return { x, z, yaw: bridgeYawAt(x, z) }; }, []);
  const target = sky || { night: 0, dusk: 0 };
  const dark = target.night > 0.5;

  return (
    <>
      <SkyRig sky={target} instant={instantSky} />
      <SkyDome />
      <Ground />
      <River />
      <Buildings city={city} />
      <Roads roads={roads} arcs={arcs} accent={accent} />
      <CityLights roads={roads} bridge={bridge} />

      <HowrahBridge />
      <Victoria />
      <CentralTowers />
      <ShahidMinar />
      <HubGlow accent={accent} />
      <Zones activeId={activeId} onSelect={onSelect} accent={accent} dark={dark} />
      <ScanRing activeId={activeId} accent={accent} />
      <Ripples queue={ripples} />
      <IssueBeacons beacons={beacons} roofAt={roofAt} onOpen={onOpenIssue} onHover={onHoverIssue} hoverId={hoverIssueId} accent={accent} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        panSpeed={0.7}
        minDistance={20}
        maxDistance={150}
        minPolarAngle={0.05}
        maxPolarAngle={1.42}
        screenSpacePanning={false}
        zoomToCursor
      />
      <CameraRig goal={goal} orbit={orbit} intro={intro} />
    </>
  );
}

export default memo(CityScene);

