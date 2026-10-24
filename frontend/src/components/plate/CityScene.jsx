import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import { ZONES, toneFor } from "../../config/zones";
import { getFeed, subscribeFeed } from "../../services/liveFeed";
import { ZONE_POS, RIVER, RIVER_W, MAIDAN, inMaidan, distToRiver, bridgeYawAt, rng } from "./geo";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const GREEN = new THREE.Color("#16a34a");
const AMBER = new THREE.Color("#f59e0b");

/* ------------------------------------------------------------------ */
/*  Roads (arteries between zones) and data arcs                       */
/* ------------------------------------------------------------------ */
const EDGES = [
  ["howrah", "bbdbagh"], ["howrah", "central"], ["bbdbagh", "esplanade"], ["esplanade", "dharmatala"],
  ["dharmatala", "park"], ["park", "victoria"], ["park", "ballygunge"], ["victoria", "alipore"],
  ["alipore", "tollygunge"], ["ballygunge", "tollygunge"], ["tollygunge", "behala"], ["college", "bbdbagh"],
  ["college", "shyambazar"], ["shyambazar", "belgachia"], ["belgachia", "salt"], ["central", "college"],
  ["central", "esplanade"], ["central", "salt"], ["victoria", "esplanade"], ["alipore", "behala"],
];
const HUB = "central";
const ARC_TO = ["howrah", "esplanade", "victoria", "college", "salt", "behala"];

function flowCurve(curve, a, b, n = 80) {
  const sp = curve.getSpacedPoints(n);
  const pts = new Float32Array((n + 1) * 3);
  sp.forEach((p, i) => { pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z; });
  return { curve, pts, n, len: curve.getLength(), a, b };
}

function buildRoads() {
  return EDGES.map(([a, b], i) => {
    const [ax, az] = ZONE_POS[a];
    const [bx, bz] = ZONE_POS[b];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const bulge = (i % 2 ? 1 : -1) * len * 0.1;
    const mx = (ax + bx) / 2 - (dz / len) * bulge;
    const mz = (az + bz) / 2 + (dx / len) * bulge;
    const curve = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(ax, 0.12, az), new THREE.Vector3(mx, 0.12, mz), new THREE.Vector3(bx, 0.12, bz)],
      false,
      "centripetal"
    );
    return flowCurve(curve, a, b);
  });
}

function buildArcs() {
  const [hx, hz] = ZONE_POS[HUB];
  return ARC_TO.map((id) => {
    const [x, z] = ZONE_POS[id];
    const d = Math.hypot(x - hx, z - hz);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(hx, 1.0, hz),
      new THREE.Vector3((hx + x) / 2, 1.0 + d * 0.32, (hz + z) / 2),
      new THREE.Vector3(x, 1.0, z)
    );
    return flowCurve(curve, HUB, id, 60);
  });
}

// Traffic speed/colour come straight from the live feed (read every frame, no React renders).
const roadSpeed = (c, f) => 1.0 + Math.min(f.zones[c.a].traffic, f.zones[c.b].traffic) * 0.035;
const roadColor = (c, f, out) => out.set(Math.min(f.zones[c.a].traffic, f.zones[c.b].traffic) < 60 ? "#f59e0b" : "#2563eb");
const arcSpeed = () => 9;
const arcColor = (c, f, out) => out.set("#06b6d4");

// Small boxes travelling along curves (one instanced mesh = one draw call).
function Flow({ curves, per, size, yOff = 0.1, speedOf, colorOf }) {
  const mesh = useRef(null);
  const count = curves.length * per;
  const phase = useMemo(
    () => Float32Array.from({ length: count }, (_, i) => ((i % per) / per + Math.floor(i / per) * 0.137) % 1),
    [count, per]
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const acc = useRef(10);

  useLayoutEffect(() => {
    const m = mesh.current;
    const feed = getFeed();
    curves.forEach((c, ci) => {
      colorOf(c, feed, col);
      for (let k = 0; k < per; k++) m.setColorAt(ci * per + k, col);
    });
    m.instanceColor.needsUpdate = true;
  }, [curves, per, colorOf, col]);

  useFrame((_, dt0) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(dt0, 0.05);
    const feed = getFeed();
    acc.current += dt;
    const recolor = acc.current > 0.5;
    if (recolor) acc.current = 0;

    for (let ci = 0; ci < curves.length; ci++) {
      const c = curves[ci];
      const v = (speedOf(c, feed) * dt) / c.len;
      if (recolor) {
        colorOf(c, feed, col);
        for (let k = 0; k < per; k++) m.setColorAt(ci * per + k, col);
      }
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
        const p = c.pts;
        dummy.position.set(p[a] + (p[b] - p[a]) * u, p[a + 1] + (p[b + 1] - p[a + 1]) * u + yOff, p[a + 2] + (p[b + 2] - p[a + 2]) * u);
        dummy.rotation.set(0, Math.atan2(-(p[b + 2] - p[a + 2]), p[b] - p[a]), 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (recolor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]} frustumCulled={false}>
      <boxGeometry args={size} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function Roads({ roads, arcs }) {
  const bed = useMemo(
    () => roads.map((r) => { const g = new THREE.TubeGeometry(r.curve, 60, 0.5, 6, false); g.scale(1, 0.12, 1); g.translate(0, 0.09, 0); return g; }),
    [roads]
  );
  const core = useMemo(() => roads.map((r) => new THREE.TubeGeometry(r.curve, 60, 0.09, 5, false)), [roads]);
  const arc = useMemo(() => arcs.map((r) => new THREE.TubeGeometry(r.curve, 50, 0.05, 5, false)), [arcs]);
  return (
    <>
      {bed.map((g, i) => (<mesh key={`b${i}`} geometry={g}><meshBasicMaterial color="#e4ebf7" /></mesh>))}
      {core.map((g, i) => (<mesh key={`c${i}`} geometry={g}><meshBasicMaterial color="#9db9ec" /></mesh>))}
      {arc.map((g, i) => (<mesh key={`a${i}`} geometry={g}><meshBasicMaterial color="#38bdf8" transparent opacity={0.5} /></mesh>))}
      <Flow curves={roads} per={5} size={[0.6, 0.22, 0.3]} speedOf={roadSpeed} colorOf={roadColor} />
      <Flow curves={arcs} per={3} size={[0.38, 0.38, 0.38]} yOff={0} speedOf={arcSpeed} colorOf={arcColor} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Buildings (instanced, generated once)                              */
/* ------------------------------------------------------------------ */
const PALETTE = ["#ffffff", "#f6f9fd", "#eef3fb", "#e3ecf8", "#d6e4f7"].map((c) => new THREE.Color(c));
const CLEAR = { victoria: 5, central: 3, esplanade: 2.6, howrah: 0 };

function generateCity(roads) {
  const buckets = new Map();
  roads.forEach((r) => {
    for (let i = 0; i <= r.n; i += 2) {
      const x = r.pts[i * 3];
      const z = r.pts[i * 3 + 2];
      const k = `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push([x, z]);
    }
  });
  const nearRoad = (x, z, rad) => {
    const cx = Math.floor(x / 2);
    const cz = Math.floor(z / 2);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const a = buckets.get(`${cx + i},${cz + j}`);
        if (a) for (const p of a) if (Math.hypot(x - p[0], z - p[1]) < rad) return true;
      }
    }
    return false;
  };

  const r = rng(20261015);
  const core = ZONE_POS.central;
  const out = [];
  const cell = 1.9;
  for (let x = -64; x <= 62; x += cell) {
    for (let z = -60; z <= 82; z += cell) {
      const px = x + (r() - 0.5) * 0.5;
      const pz = z + (r() - 0.5) * 0.5;
      if (distToRiver(px, pz) < RIVER_W / 2 + 1.2) continue;
      if (inMaidan(px, pz)) continue;
      let blocked = false;
      for (const zn of ZONES) {
        const [zx, zz] = ZONE_POS[zn.id];
        if (Math.hypot(px - zx, pz - zz) < (CLEAR[zn.id] ?? 1.6)) { blocked = true; break; }
      }
      if (blocked || nearRoad(px, pz, 1.9)) continue;
      let d = Math.exp(-((px - core[0]) ** 2 + (pz - core[1]) ** 2) / (2 * 34 * 34)) * 0.85 + 0.15;
      for (const zn of ZONES) {
        const [zx, zz] = ZONE_POS[zn.id];
        const dd = Math.hypot(px - zx, pz - zz);
        if (dd < 7) d += 0.22 * (1 - dd / 7);
      }
      if (r() > Math.min(0.95, d * 1.1 + 0.1)) continue;
      const h = 0.35 + Math.pow(r(), 2.4) * 6.5 * (0.3 + d);
      out.push({ x: px, z: pz, w: 0.8 + r() * 0.8, d: 0.8 + r() * 0.8, h, c: Math.min(PALETTE.length - 1, Math.floor(r() * r() * PALETTE.length + (h > 3 ? 1 : 0))) });
    }
  }
  return out;
}

function Buildings({ roads }) {
  const ref = useRef(null);
  const items = useMemo(() => generateCity(roads), [roads]);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0.5;
      col[i * 3] = top ? 1 : 0.76;
      col[i * 3 + 1] = top ? 1 : 0.81;
      col[i * 3 + 2] = top ? 1 : 0.91;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  useLayoutEffect(() => {
    const m = ref.current;
    const o = new THREE.Object3D();
    items.forEach((b, i) => {
      o.position.set(b.x, 0, b.z);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, PALETTE[b.c]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[null, null, items.length]} frustumCulled={false}>
      <primitive object={geo} attach="geometry" />
      <meshStandardMaterial vertexColors roughness={0.75} metalness={0.02} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Ground, Maidan, river                                              */
/* ------------------------------------------------------------------ */
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[190, 72]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MAIDAN.x, 0.04, MAIDAN.z]} scale={[MAIDAN.rx, MAIDAN.rz, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#dcefe3" />
      </mesh>
    </>
  );
}

const RIVER_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RIVER_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main(){
  float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
  float flow = sin(vUv.y * 1.4 - uTime * 1.1) * 0.5 + 0.5;
  float streak = smoothstep(0.82, 1.0, sin(vUv.y * 0.55 - uTime * 0.9 + vUv.x * 5.0));
  vec3 deep = vec3(0.62, 0.80, 0.96);
  vec3 shallow = vec3(0.80, 0.90, 0.99);
  vec3 col = mix(shallow, deep, edge * 0.55 + flow * 0.12);
  col += streak * 0.10 * edge;
  col = mix(vec3(0.93, 0.96, 1.0), col, 0.5 + 0.5 * edge);
  gl_FragColor = vec4(col, 1.0);
}
`;

function River() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const geo = useMemo(() => {
    const ctrl = RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const n = ctrl.length;
    const head = ctrl[0].clone().add(ctrl[0].clone().sub(ctrl[1]).multiplyScalar(3));
    const tail = ctrl[n - 1].clone().add(ctrl[n - 1].clone().sub(ctrl[n - 2]).multiplyScalar(3));
    const pts = new THREE.CatmullRomCurve3([head, ...ctrl, tail]).getSpacedPoints(220);
    const pos = [];
    const uv = [];
    const idx = [];
    let dist = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      const w = (RIVER_W / 2) * (1 + 0.12 * Math.sin(i * 0.15));
      pos.push(p.x - tz * w, 0.05, p.z + tx * w, p.x + tz * w, 0.05, p.z - tx * w);
      if (i > 0) dist += p.distanceTo(pts[i - 1]);
      uv.push(0, dist, 1, dist);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);

  useFrame((_, dt) => { uniforms.uTime.value += Math.min(dt, 0.05); });

  return (
    <mesh geometry={geo}>
      <shaderMaterial uniforms={uniforms} vertexShader={RIVER_VERT} fragmentShader={RIVER_FRAG} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Landmarks                                                          */
/* ------------------------------------------------------------------ */
const STEEL = { color: "#cbd6ea", roughness: 0.5, metalness: 0.2, emissive: "#7aa7ff", emissiveIntensity: 0.25 };

function HowrahBridge() {
  const [x, z] = ZONE_POS.howrah;
  const yaw = bridgeYawAt(x, z);
  const hangers = useRef(null);
  const chord = useMemo(() => {
    const pts = [[-4.4, 0.62], [-3.1, 1.75], [-1.8, 3.3], [0, 2.65], [1.8, 3.3], [3.1, 1.75], [4.4, 0.62]].map(([a, b]) => new THREE.Vector3(a, b, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return { geo: new THREE.TubeGeometry(curve, 80, 0.07, 6, false), samples: curve.getPoints(200) };
  }, []);

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
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[9.2, 0.12, 0.9]} /><meshStandardMaterial {...STEEL} /></mesh>
      {[-1.8, 1.8].flatMap((px) => [-0.4, 0.4].map((pz) => (
        <mesh key={`${px}${pz}`} position={[px, 1.65, pz]}><boxGeometry args={[0.26, 3.3, 0.26]} /><meshStandardMaterial {...STEEL} /></mesh>
      )))}
      {[-0.4, 0.4].map((pz) => (
        <mesh key={pz} geometry={chord.geo} position={[0, 0, pz]}><meshStandardMaterial {...STEEL} /></mesh>
      ))}
      <instancedMesh ref={hangers} args={[null, null, 60]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...STEEL} />
      </instancedMesh>
    </group>
  );
}

function Victoria() {
  const [x, z] = ZONE_POS.victoria;
  const white = { color: "#ffffff", roughness: 0.55 };
  return (
    <group position={[x, 0, z]} scale={1.15}>
      <mesh position={[0, 0.12, 0]}><boxGeometry args={[4.4, 0.24, 3.4]} /><meshStandardMaterial {...white} /></mesh>
      <mesh position={[0, 0.8, 0]}><boxGeometry args={[2.7, 1.1, 1.9]} /><meshStandardMaterial {...white} /></mesh>
      <mesh position={[0, 1.35, 0]}><sphereGeometry args={[0.85, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...white} /></mesh>
      <mesh position={[0, 2.35, 0]}><cylinderGeometry args={[0.06, 0.1, 0.5, 8]} /><meshStandardMaterial {...white} /></mesh>
      {[-1.55, 1.55].flatMap((px) => [-0.95, 0.95].map((pz) => (
        <mesh key={`${px}${pz}`} position={[px, 1.35, pz]}><sphereGeometry args={[0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...white} /></mesh>
      )))}
      {[-1.55, 1.55].flatMap((px) => [-0.95, 0.95].map((pz) => (
        <mesh key={`b${px}${pz}`} position={[px, 0.7, pz]}><boxGeometry args={[0.7, 0.9, 0.7]} /><meshStandardMaterial {...white} /></mesh>
      )))}
    </group>
  );
}

function CentralTowers() {
  const [x, z] = ZONE_POS.central;
  const glass = { color: "#e8f0fb", roughness: 0.25, metalness: 0.3, emissive: "#38bdf8", emissiveIntensity: 0.3 };
  return (
    <group position={[x, 0, z]}>
      {[[-1.1, 0.3, 5.2], [0.5, -0.9, 7.4], [1.4, 0.9, 4.2]].map(([px, pz, h], i) => (
        <group key={i} position={[px, 0, pz]}>
          <mesh position={[0, h / 2, 0]}><boxGeometry args={[0.85, h, 0.85]} /><meshStandardMaterial {...glass} /></mesh>
          <mesh position={[0, h + 0.5, 0]}><cylinderGeometry args={[0.02, 0.04, 1, 6]} /><meshBasicMaterial color="#2563eb" /></mesh>
        </group>
      ))}
    </group>
  );
}

function ShahidMinar() {
  const [x, z] = ZONE_POS.esplanade;
  const mat = { color: "#f3f6fb", roughness: 0.5 };
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.2, 0.4, 1.2]} /><meshStandardMaterial {...mat} /></mesh>
      <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.14, 0.24, 3.6, 16]} /><meshStandardMaterial {...mat} /></mesh>
      <mesh position={[0, 4.1, 0]}><sphereGeometry args={[0.3, 16, 12]} /><meshStandardMaterial {...mat} /></mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Zone beacons + labels                                              */
/* ------------------------------------------------------------------ */
function ZoneLabel({ zone, active, onSelect }) {
  const [x, z] = ZONE_POS[zone.id];
  // only re-renders when the rounded AQI actually changes
  const aqi = useSyncExternalStore(subscribeFeed, () => Math.round(getFeed().zones[zone.id].aqi));
  return (
    <Html position={[x, 1.55, z]} center zIndexRange={[4, 0]} pointerEvents="none">
      <div className="cl-wrap">
        <button type="button" className={`callout ${active ? "on" : ""}`} onClick={() => onSelect(zone)}>
          <span>{zone.name}<small>AQI {aqi}</small></span>
          <i />
        </button>
      </div>
    </Html>
  );
}

function Zones({ activeId, onSelect }) {
  const refs = useRef({});
  const acc = useRef(10);
  const [hover, setHover] = useState(null);

  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    acc.current += dt;
    const recolor = acc.current > 0.5;
    if (recolor) acc.current = 0;
    const feed = getFeed();
    ZONES.forEach((z, i) => {
      const r = refs.current[z.id];
      if (!r || !r.ring || !r.core || !r.stem) return;
      const on = z.id === activeId;
      const ph = (t * (on ? 0.9 : 0.5) + i * 0.37) % 1;
      r.ring.scale.setScalar((on ? 1.5 : 1) * (0.6 + ph * 2.2));
      r.ring.material.opacity = (1 - ph) * (on ? 0.75 : 0.4);
      r.core.position.y = 0.95 + Math.sin(t * 1.6 + i) * 0.08;
      r.core.scale.setScalar(on ? 1.5 : 1);
      if (recolor) {
        const c = toneFor(feed.zones[z.id]) === "warn" ? AMBER : GREEN;
        r.core.material.color.copy(c);
        r.ring.material.color.copy(c);
        r.stem.material.color.copy(c);
      }
    });
  });

  return (
    <>
      {ZONES.map((z) => {
        const [x, zz] = ZONE_POS[z.id];
        const slot = (refs.current[z.id] = refs.current[z.id] || {});
        return (
          <group key={z.id} position={[x, 0, zz]}>
            <mesh ref={(el) => { slot.ring = el; }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
              <ringGeometry args={[0.5, 0.62, 40]} />
              <meshBasicMaterial color="#16a34a" transparent opacity={0.4} depthWrite={false} />
            </mesh>
            <mesh ref={(el) => { slot.stem = el; }} position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
              <meshBasicMaterial color="#16a34a" />
            </mesh>
            <mesh ref={(el) => { slot.core = el; }} position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.26, 16, 12]} />
              <meshBasicMaterial color="#16a34a" />
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
        <ZoneLabel key={z.id} zone={z} active={z.id === activeId} onSelect={onSelect} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera: fly-to, 2D/3D tilt, auto-orbit that pauses on touch        */
/* ------------------------------------------------------------------ */
function CameraRig({ goal, orbit }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const off = useMemo(() => new THREE.Vector3(), []);
  const sph = useMemo(() => new THREE.Spherical(), []);
  const orbitRef = useRef(orbit);

  useEffect(() => { orbitRef.current = orbit; }, [orbit]);

  useEffect(() => {
    if (!controls) return undefined;
    let timer;
    const start = () => { clearTimeout(timer); controls.autoRotate = false; };
    const end = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { controls.autoRotate = orbitRef.current; }, 6000);
    };
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    return () => {
      clearTimeout(timer);
      controls.removeEventListener("start", start);
      controls.removeEventListener("end", end);
    };
  }, [controls]);

  useFrame((_, dt0) => {
    if (!controls) return;
    const t = controls.target;
    const g = goal.current;
    if (g) {
      const k = 1 - Math.pow(0.0006, Math.min(dt0, 0.05));
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
    t.x = clamp(t.x, -75, 75);
    t.z = clamp(t.z, -70, 90);
  });

  return null;
}

/* ------------------------------------------------------------------ */
function CityScene({ activeId, onSelect, goal, orbit }) {
  const roads = useMemo(buildRoads, []);
  const arcs = useMemo(buildArcs, []);

  return (
    <>
      <color attach="background" args={["#eef1f6"]} />
      <fog attach="fog" args={["#eef1f6", 95, 250]} />
      <hemisphereLight args={["#ffffff", "#c7d3ea", 0.95]} />
      <directionalLight position={[55, 85, 35]} intensity={1.35} />

      <Ground />
      <Grid
        position={[0, 0.01, 0]}
        args={[10, 10]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#d5dff0"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#b9c9e6"
        fadeDistance={150}
        fadeStrength={1.2}
        infiniteGrid
      />
      <River />
      <Buildings roads={roads} />
      <Roads roads={roads} arcs={arcs} />

      <HowrahBridge />
      <Victoria />
      <CentralTowers />
      <ShahidMinar />
      <Zones activeId={activeId} onSelect={onSelect} />

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
        autoRotate={orbit}
        autoRotateSpeed={0.35}
      />
      <CameraRig goal={goal} orbit={orbit} />
    </>
  );
}

export default memo(CityScene);