// The original drawing's X/Y coordinates and UVs never change. Actual depth
// travels around its contours, preserving every circle, join and proportion.
export const SURFACE_SIZE = 1254;
export const SURFACE_SCALE = 10 / SURFACE_SIZE;
export const SURFACE_CYCLE = 15;
export const SURFACE_RINGS = [
  { cx: 627, cy: 627, inner: 405, outer: 526, height: .13 },
  { cx: 354, cy: 627, inner: 65, outer: 140, height: .075 },
  { cx: 626, cy: 604, inner: 108, outer: 200, height: .10 },
  { cx: 899, cy: 627, inner: 65, outer: 140, height: .075 },
];

const smooth = (lo, hi, x) => {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

export function sampleSurfaceLife(seconds) {
  const phase = seconds * Math.PI * 2 / SURFACE_CYCLE;
  return {
    elapsed: seconds, phase,
    relief: 1 - Math.exp(-seconds / 2.4),
    wave: [Math.sin(phase), Math.cos(phase), Math.sin(phase * 2), Math.cos(phase * 2)],
    bodyScale: 1,
  };
}

// Suspension resets previousTime to null. While visible, even a slow frame
// must advance by its real duration instead of silently slowing the animation.
export function advanceSurfaceTime(elapsed, previousTime, currentTime, paused = false) {
  return paused || previousTime === null ? elapsed
    : elapsed + Math.max(0, (currentTime - previousTime) / 1000);
}

function weight(x, y, ring) {
  const r = Math.hypot(x - ring.cx, y - ring.cy);
  if (r <= ring.inner || r >= ring.outer) return 0;
  const t = (r - ring.inner) / (ring.outer - ring.inner);
  return Math.sin(Math.PI * t) ** 2;
}

function anchor(x, y) {
  return smooth(8, 82, Math.abs(y - 627))
    * smooth(69, 81, Math.hypot(x - 354, y - 627))
    * smooth(130, 148, Math.hypot(x - 626, y - 627))
    * smooth(69, 81, Math.hypot(x - 899, y - 627));
}

// Precompute the spatial coefficients once. Only four shared harmonic values
// change each frame; rendering no longer recalculates four fields repeatedly.
export function sampleSurfaceBasis(x, y) {
  const weights = SURFACE_RINGS.map(ring => weight(x, y, ring));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const basis = [0, 0, 0, 0, 0];
  if (total === 0) return basis;
  const anchored = anchor(x, y) / Math.max(1, total);
  SURFACE_RINGS.forEach((ring, index) => {
    const h = ring.height * weights[index] * anchored;
    const angle = Math.atan2(y - ring.cy, x - ring.cx);
    basis[0] += h;
    // cos(2*angle - phase): every ring travels clockwise in source-image
    // coordinates (Y points down), with no reversal or opposing fields.
    basis[1] += h * .60 * Math.sin(angle * 2);
    basis[2] += h * .60 * Math.cos(angle * 2);
    basis[3] += h * .10 * Math.sin(angle * 4);
    basis[4] += h * .10 * Math.cos(angle * 4);
  });
  return basis;
}

export function sampleSurface(x, y, seconds) {
  const life = sampleSurfaceLife(seconds);
  const basis = sampleSurfaceBasis(x, y);
  const z = life.relief * (basis[0] + life.wave.reduce((sum, wave, i) => sum + wave * basis[i + 1], 0));
  return { x, y, z };
}

// These exact coefficients drive the visible surface, its live normals and
// its shadow geometry. There is no sideways displacement or texture warp.
export const SURFACE_GLSL = `
  uniform vec4 uSurfaceLife;
  uniform float uSurfaceRelief;
  attribute vec3 reliefBase;
  attribute vec4 reliefWave;
  attribute vec4 reliefDx;
  attribute vec4 reliefDy;
  vec3 livingSurface(vec3 position) {
    float height = uSurfaceRelief * (reliefBase.x + dot(reliefWave, uSurfaceLife));
    return position + vec3(0.0, 0.0, height);
  }
  vec3 livingNormal() {
    float dx = uSurfaceRelief * (reliefBase.y + dot(reliefDx, uSurfaceLife));
    float dy = uSurfaceRelief * (reliefBase.z + dot(reliefDy, uSurfaceLife));
    return normalize(vec3(-dx, -dy, 1.0));
  }
`;
