// A single connected surface carries the original drawing. The four fields
// describe soft relief, not separate circular cut-outs of the source image.
export const SURFACE_SIZE = 1254;
export const SURFACE_SCALE = 10 / SURFACE_SIZE;
export const SURFACE_CYCLE = 30;
export const SURFACE_RINGS = [
  { cx: 627, cy: 627, inner: 390, outer: 540, height: .28, twist: .065, direction: 1 },
  { cx: 354, cy: 627, inner: 65, outer: 146, height: .16, twist: .12, direction: 1 },
  { cx: 626, cy: 604, inner: 108, outer: 206, height: .22, twist: .085, direction: -1 },
  { cx: 899, cy: 627, inner: 65, outer: 146, height: .16, twist: .12, direction: -1 },
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
    flow: .85 * Math.sin(phase) + .15 * Math.sin(phase * 2),
    flex: Math.sin(phase), crossFlex: Math.cos(phase),
    bodyScale: 1,
  };
}

function weight(x, y, ring) {
  const r = Math.hypot(x - ring.cx, y - ring.cy);
  if (r <= ring.inner || r >= ring.outer) return 0;
  const t = Math.max(0, Math.min(1, (r - ring.inner) / (ring.outer - ring.inner)));
  return Math.sin(Math.PI * t) ** 2;
}

function anchor(x, y) {
  return smooth(8, 82, Math.abs(y - 627))
    * smooth(69, 81, Math.hypot(x - 354, y - 627))
    * smooth(130, 148, Math.hypot(x - 626, y - 627))
    * smooth(69, 81, Math.hypot(x - 899, y - 627));
}

// Source-pixel coordinates in X/Y, world units in Z. Useful for checking the
// actual deformation's anchors, symmetry and Jacobian over complete cycles.
export function sampleSurface(x, y, seconds) {
  const life = sampleSurfaceLife(seconds);
  const weights = SURFACE_RINGS.map(ring => weight(x, y, ring));
  const sum = weights.reduce((total, w) => total + w, 0);
  if (sum === 0) return { x, y, z: 0 };
  const normalization = Math.max(1, sum);
  const fixed = anchor(x, y) * life.relief;
  let dx = 0, dy = 0, z = 0;
  SURFACE_RINGS.forEach((ring, index) => {
    const w = weights[index] / normalization * fixed;
    const px = x - ring.cx, py = y - ring.cy;
    const angle = Math.atan2(py, px);
    const turn = ring.direction * ring.twist * life.flow * w;
    dx += px * (Math.cos(turn) - 1) - py * Math.sin(turn);
    dy += px * Math.sin(turn) + py * (Math.cos(turn) - 1);
    // Odd angular modes balance raised and lowered sectors. The left and
    // right fields mirror each other; no rigid body tilting or depth travel.
    const flex = ring.direction * (.24 * Math.sin(angle * 2) * life.flex
      + .08 * Math.sin(angle * 4) * life.crossFlex);
    z += ring.height * w * (1 + flex);
  });
  return { x: x + dx, y: y + dy, z };
}

// Both visible geometry and its shadow use this exact vertex function.
// Original UVs stay attached to the vertices, so connected ink stays connected.
const f = value => Number(value).toFixed(8);
export const SURFACE_GLSL = `
  uniform vec4 uSurfaceLife;
  uniform float uSurfaceRelief;
  const float SURFACE_SCALE = ${f(SURFACE_SCALE)};
  float surfaceWeight(vec2 p, vec2 center, vec2 bounds) {
    float t = clamp((distance(p, center) - bounds.x) / (bounds.y - bounds.x), 0.0, 1.0);
    if (t <= 0.0 || t >= 1.0) return 0.0;
    float wave = sin(3.14159265359 * t);
    return wave * wave;
  }
  void addSurfaceField(vec2 p, vec2 center, float weight, float height,
    float twist, float direction, inout vec3 offset) {
    vec2 radial = p - center;
    float angle = atan(radial.y, radial.x);
    float turn = direction * twist * uSurfaceLife.x * weight;
    float c = cos(turn), s = sin(turn);
    offset.xy += vec2(radial.x * (c - 1.0) - radial.y * s,
      radial.x * s + radial.y * (c - 1.0));
    float flex = direction * (0.24 * sin(angle * 2.0) * uSurfaceLife.y
      + 0.08 * sin(angle * 4.0) * uSurfaceLife.z);
    offset.z += height * weight * (1.0 + flex);
  }
  vec3 livingSurface(vec3 position) {
    vec2 p = vec2(position.x / SURFACE_SCALE + 627.0, 627.0 - position.y / SURFACE_SCALE);
    vec4 weights = vec4(${SURFACE_RINGS.map(ring =>
      `surfaceWeight(p, vec2(${f(ring.cx)}, ${f(ring.cy)}), vec2(${f(ring.inner)}, ${f(ring.outer)}))`).join(',\n      ')});
    float totalWeight = dot(weights, vec4(1.0));
    if (totalWeight == 0.0) return position;
    float anchored = smoothstep(8.0, 82.0, abs(p.y - 627.0))
      * smoothstep(69.0, 81.0, distance(p, vec2(354.0, 627.0)))
      * smoothstep(130.0, 148.0, distance(p, vec2(626.0, 627.0)))
      * smoothstep(69.0, 81.0, distance(p, vec2(899.0, 627.0)));
    weights *= anchored * uSurfaceRelief / max(1.0, totalWeight);
    vec3 offset = vec3(0.0);
    ${SURFACE_RINGS.map((ring, i) =>
      `addSurfaceField(p, vec2(${f(ring.cx)}, ${f(ring.cy)}), weights[${i}], ${f(ring.height)}, ${f(ring.twist)}, ${f(ring.direction)}, offset);`).join('\n    ')}
    return position + vec3(offset.x * SURFACE_SCALE, -offset.y * SURFACE_SCALE, offset.z);
  }
`;
