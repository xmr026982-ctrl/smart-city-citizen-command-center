import * as THREE from "three";

/* ------------------------------------------------------------------
   The model's look, in one place: the day and night palettes and the
   shaders that draw the city. Every material reads the same shared
   uniforms (SKY), which the scene eases once a frame, so a day → night
   change is one smooth blend, never a jump.
   Colours are written as sRGB hex and converted once (three's colour
   management); every custom shader ends in <colorspace_fragment>.
------------------------------------------------------------------- */

export const DAY = {
  zenith: "#d9e4f5", horizon: "#eef2f8", ground: "#f1f4f9", gridCell: "#d7e0ee", gridSection: "#bccbe4",
  park: "#d6ecdd", lake: "#bfdcf3", side: "#dfe6f1", top: "#ffffff", glass: "#aebfdb",
  roadBed: "#e3eaf5", roadCore: "#a9c0ea", traffic: "#2563eb", trafficSlow: "#f59e0b",
  waterDeep: "#9ec8f0", waterShallow: "#cfe3f8", steel: "#c9d4e8", stone: "#ffffff",
  hemiSky: "#ffffff", hemiGround: "#c7d3ea", hemi: 0.95, sun: "#ffffff", sunI: 1.35,
};
export const NIGHT = {
  zenith: "#030712", horizon: "#13213f", ground: "#070e1d", gridCell: "#14233f", gridSection: "#1f3a66",
  park: "#0a1f1d", lake: "#0b2140", side: "#111a2d", top: "#18233a", glass: "#1b2a46",
  roadBed: "#0d1627", roadCore: "#c2772a", traffic: "#fff4dc", trafficSlow: "#ff8a3d",
  waterDeep: "#06142b", waterShallow: "#0c2346", steel: "#2b3a57", stone: "#c9d6ee",
  hemiSky: "#41609b", hemiGround: "#05080f", hemi: 0.55, sun: "#9db7ff", sunI: 0.32,
};
export const DUSK = { horizon: "#f2b48a", glow: "#ff9a5a", twilight: "#a3b4e6" };
export const WINDOW = { warm: "#ffc27a", cool: "#d6e6ff", edge: "#4f7cff" };
export const BRIDGE_GLOW = "#5eead4";
export const STREET = "#ffb04d";

const C = (hex) => new THREE.Color(hex);
const pal = (k) => ({ day: C(DAY[k]), night: C(NIGHT[k]) });
export const PAL = Object.fromEntries(Object.keys(DAY).filter((k) => typeof DAY[k] === "string").map((k) => [k, pal(k)]));

/* one set of uniforms, shared by reference by every shader */
export const SKY = {
  uNight: { value: 0 },
  uDusk: { value: 0 },
  uTime: { value: 0 },
  uFogColor: { value: C(DAY.horizon) },
  uFogNear: { value: 110 },
  uFogFar: { value: 300 },
};

export const mixInto = (out, key, n) => out.copy(PAL[key].day).lerp(PAL[key].night, n);

/* ---------------- shared GLSL ---------------- */
const HASH = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;
/* how far surfaces have turned to night: a quick cross-over, eased for the eye
   (colours mix in linear light, which would otherwise hang in a long grey half-way).
   The scene uses the same curve for plain materials (nightBody below). */
const BODY = `
float nightBody(float n){ float s = smoothstep(0.18, 0.82, n); return 1.0 - pow(1.0 - s, 1.8); }
`;
export const nightBody = (n) => { const t = Math.min(1, Math.max(0, (n - 0.18) / 0.64)); return 1 - Math.pow(1 - t * t * (3 - 2 * t), 1.8); };
const FOG_PARS = `
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
`;

/* ---------------- buildings ----------------
   Windows are drawn, not modelled: floors every 0.3 units, bays every
   0.24 along each face. By day they're glass bands; after dusk a share
   of them light up, warm or cool, building by building. A thin rim on
   each roofline glows at night. */
export function buildingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...SKY,
      uSideDay: { value: C(DAY.side) }, uTopDay: { value: C(DAY.top) }, uGlassDay: { value: C(DAY.glass) },
      uSideNight: { value: C(NIGHT.side) }, uTopNight: { value: C(NIGHT.top) }, uGlassNight: { value: C(NIGHT.glass) },
      uWarm: { value: C(WINDOW.warm) }, uCool: { value: C(WINDOW.cool) }, uEdge: { value: C(WINDOW.edge) }, uDuskCol: { value: C(DUSK.glow) },
      uTwi: { value: C(DUSK.twilight) },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vL; varying vec3 vS; varying float vSeed; varying float vDepth;
      void main(){
        mat4 im = instanceMatrix;
        vS = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
        vec4 w = modelMatrix * im * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vL = position;
        vSeed = fract(sin(dot(im[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vec4 mv = viewMatrix * w; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uNight; uniform float uDusk;
      uniform vec3 uSideDay; uniform vec3 uTopDay; uniform vec3 uGlassDay; uniform vec3 uSideNight; uniform vec3 uTopNight; uniform vec3 uGlassNight;
      uniform vec3 uWarm; uniform vec3 uCool; uniform vec3 uEdge; uniform vec3 uDuskCol; uniform vec3 uTwi;
      ${FOG_PARS}
      varying vec3 vN; varying vec3 vL; varying vec3 vS; varying float vSeed; varying float vDepth;
      ${HASH}${BODY}
      void main(){
        vec3 N = normalize(vN);
        float top = step(0.5, N.y);
        float xFace = step(0.5, abs(N.x));
        float y = vL.y * vS.y;
        float u = mix(vL.x * vS.x, vL.z * vS.z, xFace);
        float face = xFace * (N.x > 0.0 ? 1.0 : 2.0) + (1.0 - xFace) * (N.z > 0.0 ? 3.0 : 4.0);
        vec2 g = vec2(u / 0.24, y / 0.3);
        vec2 cell = floor(g); vec2 f = fract(g);
        float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.84);
        win *= step(0.3, y) * step(y, vS.y - 0.12) * (1.0 - top);
        float r = h21(cell + vSeed * 37.0 + face * 11.0);
        float share = 0.24 + 0.4 * vSeed;
        float lit = step(r, share);
        float warm = step(0.3, h21(cell * 1.7 + vSeed * 13.0));
        vec3 L = normalize(vec3(0.45, 0.8, 0.35));
        float diff = max(dot(N, L), 0.0);
        float ao = mix(0.7, 1.0, smoothstep(0.0, 1.6, y));

        vec3 day = mix(uSideDay, uTopDay, top) * (0.8 + 0.2 * diff) * ao;
        day = mix(day, uGlassDay, win * 0.42);
        // dusk: the city cools to twilight blue, faces to the west catch the last sun
        day = mix(day, day * uTwi, uDusk * 0.3);
        day += uDuskCol * uDusk * 0.45 * max(dot(N, normalize(vec3(-0.85, 0.25, 0.2))), 0.0);
        day += uDuskCol * uDusk * 0.12 * top;

        vec3 night = mix(uSideNight, uTopNight, top) * (0.74 + 0.26 * diff) * ao;
        night = mix(night, uGlassNight, win * (1.0 - lit) * 0.6);
        vec3 wl = mix(uCool, uWarm, warm) * (0.7 + 0.3 * h21(cell + 3.1));
        vec3 lights = win * lit * wl * 1.2;
        float rim = (1.0 - top) * smoothstep(vS.y - 0.05, vS.y, y);
        night += uEdge * rim * 0.5;

        // windows come on early in the evening and stay bright: the body darkens, the lights don't fade with it
        // the body crosses over quickly (no long grey half-way); the lights lead it
        vec3 col = mix(day, night, nightBody(uNight)) + lights * smoothstep(0.12, 0.6, uNight);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- sky dome ---------------- */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uZenDay: { value: C(DAY.zenith) }, uZenNight: { value: C(NIGHT.zenith) }, uDuskHor: { value: C(DUSK.horizon) }, uDuskGlow: { value: C(DUSK.glow) } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uNight; uniform float uDusk; uniform vec3 uZenDay; uniform vec3 uZenNight; uniform vec3 uDuskHor; uniform vec3 uDuskGlow; uniform vec3 uFogColor;
      varying vec3 vP;
      ${HASH}${BODY}
      void main(){
        float h = clamp(vP.y, -0.2, 1.0);
        vec3 zen = mix(uZenDay, uZenNight, uNight);
        vec3 col = mix(uFogColor, zen, pow(smoothstep(-0.02, 0.55, h), 0.75));
        float west = max(0.0, -vP.x) * 0.6 + 0.4;
        col += uDuskGlow * uDusk * west * exp(-abs(h) * 9.0) * 0.55;
        vec2 st = floor(vec2(atan(vP.z, vP.x) * 260.0, h * 420.0));
        float star = step(0.9965, h21(st)) * smoothstep(0.08, 0.4, h) * uNight;
        col += vec3(0.85, 0.9, 1.0) * star * (0.4 + 0.6 * h21(st + 7.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- ground with its grid ---------------- */
export function groundMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uDay: { value: C(DAY.ground) }, uNightC: { value: C(NIGHT.ground) }, uCellD: { value: C(DAY.gridCell) }, uCellN: { value: C(NIGHT.gridCell) }, uSecD: { value: C(DAY.gridSection) }, uSecN: { value: C(NIGHT.gridSection) } },
    vertexShader: `varying vec2 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uNight; uniform vec3 uDay; uniform vec3 uNightC; uniform vec3 uCellD; uniform vec3 uCellN; uniform vec3 uSecD; uniform vec3 uSecN;
      ${FOG_PARS}
      varying vec2 vW; varying float vDepth;
      ${BODY}
      float line(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
      void main(){
        vec3 col = mix(uDay, uNightC, nightBody(uNight));
        float fade = 1.0 - smoothstep(60.0, 150.0, vDepth);
        col = mix(col, mix(uCellD, uCellN, nightBody(uNight)), line(vW, 2.0, 1.0) * 0.55 * fade);
        col = mix(col, mix(uSecD, uSecN, nightBody(uNight)), line(vW, 10.0, 1.4) * 0.8 * fade);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- river ---------------- */
export function riverMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uDeepD: { value: C(DAY.waterDeep) }, uShalD: { value: C(DAY.waterShallow) }, uDeepN: { value: C(NIGHT.waterDeep) }, uShalN: { value: C(NIGHT.waterShallow) }, uLamp: { value: C(STREET) }, uGlint: { value: C(BRIDGE_GLOW) } },
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uNight; uniform float uTime; uniform vec3 uDeepD; uniform vec3 uShalD; uniform vec3 uDeepN; uniform vec3 uShalN; uniform vec3 uLamp; uniform vec3 uGlint;
      ${FOG_PARS}
      varying vec2 vUv; varying float vDepth;
      ${HASH}${BODY}
      void main(){
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float flow = sin(vUv.y * 1.4 - uTime * 1.1) * 0.5 + 0.5;
        float streak = smoothstep(0.82, 1.0, sin(vUv.y * 0.55 - uTime * 0.9 + vUv.x * 5.0));
        vec3 deep = mix(uDeepD, uDeepN, nightBody(uNight)); vec3 shal = mix(uShalD, uShalN, nightBody(uNight));
        vec3 col = mix(shal, deep, edge * 0.6 + flow * 0.12);
        col += streak * edge * mix(0.08, 0.05, uNight);
        // night: the bank lights shiver on the water, and the current catches the light
        float bank = pow(1.0 - edge, 3.0);
        float shiver = 0.6 + 0.4 * sin(vUv.y * 9.0 + uTime * 2.4 + vUv.x * 20.0);
        col += uLamp * bank * shiver * 0.32 * uNight;
        vec2 gq = floor(vec2(vUv.x * 40.0, vUv.y * 4.0 - uTime * 1.6));
        float glint = step(0.985, h21(gq)) * edge;
        col += uGlint * glint * 0.35 * uNight;
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- glowing lights (points) ----------------
   Soft round lights with a halo, sized in the world (smaller far away),
   added onto the scene so a row of them reads as a lit street. They fade
   in with the night. */
export function lightsMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uScale: { value: 400 }, uDayShare: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uScale; uniform float uNight; uniform float uTime; uniform float uDayShare; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 64.0);
        gl_Position = projectionMatrix * mv;
        vC = aColor;
        float on = max(uNight, uDayShare);
        vA = on * (0.86 + 0.14 * sin(uTime * 2.0 + aPhase)) * (1.0 - smoothstep(uFogNear, uFogFar, -mv.z));
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.32, 0.0, d);
        float halo = pow(max(0.0, 1.0 - d), 2.4) * 0.5;
        float a = (core + halo) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vC * (core * 1.5 + halo), a);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- beams (zone light pillars) ----------------
   Open cylinders, brightest at the base and down the middle, a slow
   current running up them. Day keeps a faint trace; night lights them. */
export function beamMaterial(color, seed = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uColor: { value: C(color) }, uSeed: { value: seed }, uBoost: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vF = abs(n.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uNight; uniform float uTime; uniform float uSeed; uniform float uBoost;
      varying vec2 vUv; varying float vF;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.7);
        float flow = 0.7 + 0.3 * sin(vUv.y * 16.0 - uTime * 2.6 + uSeed * 6.28);
        float body = pow(vF, 1.6);
        float a = fade * flow * body * mix(0.16, 0.78, uNight) * uBoost;
        gl_FragColor = vec4(uColor * (1.0 + uNight * 0.6), a);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- light-carrying lines (bridge cables) ---------------- */
export function glowLineMaterial(color, { speed = 0.16, base = 0.65, pulse = 0.9, width = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uColor: { value: C(color) }, uSpeed: { value: speed }, uBase: { value: base }, uPulse: { value: pulse }, uWidth: { value: width } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vF = abs(n.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uNight; uniform float uTime; uniform float uSpeed; uniform float uBase; uniform float uPulse; uniform float uWidth;
      varying vec2 vUv; varying float vF;
      void main(){
        float p = fract(vUv.x * 1.5 - uTime * uSpeed);
        float run = exp(-pow((p - 0.5) * 12.0, 2.0));
        float i = (uBase + uPulse * run) * mix(0.12, 1.0, uNight);
        float body = mix(1.0, pow(vF, 1.4), uWidth);
        gl_FragColor = vec4(uColor * i * 1.3, i * body);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------------- hub radar sweep ---------------- */
export function sweepMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SKY, uColor: { value: C(color) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime; uniform float uNight;
      varying vec2 vP;
      void main(){
        float r = length(vP);
        float ang = atan(vP.y, vP.x) / 6.2831853 + 0.5;
        float s = fract(ang - uTime * 0.11);
        float trail = pow(1.0 - s, 7.0) * smoothstep(1.0, 0.92, r) * smoothstep(0.1, 0.3, r);
        float rings = (smoothstep(0.012, 0.0, abs(r - 0.36)) + smoothstep(0.012, 0.0, abs(r - 0.68)) + smoothstep(0.014, 0.0, abs(r - 0.985))) * 0.5;
        float a = (trail * 0.55 + rings * 0.35) * mix(0.35, 1.0, uNight);
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}
