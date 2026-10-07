// The same original ink bands turn in WebGL and in compositor image layers.
// Whole circles rotate rigidly: their centres, radii and the connecting spine
// never move. An independent elapsed-time clock prevents a fallback pose jump.
export const INK_CYCLE = 90;
export const INK_RINGS = [
  { cx: 627, cy: 627, inner: 386, outer: 542, feather: 16 },
  { cx: 354, cy: 627, inner: 79, outer: 142, feather: 6 },
  { cx: 626, cy: 604, inner: 136, outer: 207, feather: 8 },
  { cx: 899, cy: 627, inner: 79, outer: 142, feather: 6 },
];
const HUB_GUARDS = [
  { cx: 354, cy: 627, radius: 140 },
  { cx: 626, cy: 604, radius: 200 },
  { cx: 899, cy: 627, radius: 140 },
];
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function inkMask(x, y, ring) {
  const radius = Math.hypot(x - ring.cx, y - ring.cy);
  return smooth(ring.inner, ring.inner + ring.feather, radius)
    * (1 - smooth(ring.outer - ring.feather, ring.outer, radius))
    * smooth(10, 24, Math.abs(y - 627))
    * smooth(69, 81, Math.hypot(x - 354, y - 627))
    * smooth(130, 148, Math.hypot(x - 626, y - 627))
    * smooth(69, 81, Math.hypot(x - 899, y - 627))
    * HUB_GUARDS.reduce((mask, hub) => mask *
      (hub.cx === ring.cx && hub.cy === ring.cy ? 1
        : smooth(hub.radius, hub.radius + 12, Math.hypot(x - hub.cx, y - hub.cy))), 1);
}
export function inkSource(x, y, ring, seconds) {
  const angle = seconds * Math.PI * 2 / INK_CYCLE;
  const dx = x - ring.cx, dy = y - ring.cy;
  // Inverse sampling: a source landmark moves clockwise in downward-Y space.
  const sx = ring.cx + Math.cos(angle) * dx + Math.sin(angle) * dy;
  const sy = ring.cy - Math.sin(angle) * dx + Math.cos(angle) * dy;
  return { x: sx, y: sy, weight: inkMask(x, y, ring) * inkMask(sx, sy, ring) };
}

export const INK_GLSL = `
  uniform vec2 uInkTurn;
  float inkAnchor(vec2 p, vec2 center) {
    float mask = smoothstep(10.0, 24.0, abs(p.y - 627.0))
      * smoothstep(69.0, 81.0, distance(p, vec2(354.0, 627.0)))
      * smoothstep(130.0, 148.0, distance(p, vec2(626.0, 627.0)))
      * smoothstep(69.0, 81.0, distance(p, vec2(899.0, 627.0)));
    ${HUB_GUARDS.map(hub => `if (distance(center, vec2(${hub.cx}.0, ${hub.cy}.0)) > 1.0)
      mask *= smoothstep(${hub.radius}.0, ${hub.radius + 12}.0, distance(p, vec2(${hub.cx}.0, ${hub.cy}.0)));`).join('\n')}
    return mask;
  }
  vec4 turningInk(vec4 base, vec2 p, vec4 ring, float feather) {
    vec2 d = p - ring.xy;
    float radius = length(d);
    float band = smoothstep(ring.z, ring.z + feather, radius)
      * (1.0 - smoothstep(ring.w - feather, ring.w, radius));
    if (band <= 0.0) return base;
    vec2 source = ring.xy + vec2(uInkTurn.x * d.x + uInkTurn.y * d.y,
      -uInkTurn.y * d.x + uInkTurn.x * d.y);
    float mask = band * band * inkAnchor(p, ring.xy) * inkAnchor(source, ring.xy);
    vec2 sourceUv = vec2(source.x / 1254.0, 1.0 - source.y / 1254.0);
    return mix(base, texture2D(map, sourceUv), mask);
  }
`;

// The visible renderer must never take its phase from an invisible DOM layer.
// This clock accounts for elapsed time, including delayed/dropped frames, and
// changes speed or suspension state without restarting at angle zero.
export function createInkClock(now = () => performance.now()) {
  let anchor = now(), seconds = 0, paused = false, rate = 1;
  const advance = () => {
    const time = now();
    if (!paused) seconds += Math.max(0, time - anchor) * rate / 1000;
    anchor = time;
  };
  return {
    read() {
      advance();
      return { seconds, angle: (seconds % INK_CYCLE) * Math.PI * 2 / INK_CYCLE, paused, rate };
    },
    setPaused(value) { advance(); paused = Boolean(value); },
    setRate(value) {
      if (!Number.isFinite(value) || value <= 0) throw new RangeError('Ink rate must be positive.');
      advance(); rate = value;
    },
  };
}

const clock = createInkClock();
let animations = [], portalAnimations = [], reduced = false, manuallyPaused = false, pageHidden = false;
let compositorHidden = false;
export function getInkMotion() {
  return { ...clock.read(), reduced, active: animations.length > 0 };
}
export function pauseInkMotion(value) {
  manuallyPaused = Boolean(value);
  syncMotion();
}
// Stop invisible compositor layers while WebGL is healthy. They are disposable
// consumers of the clock, so exposing them later cannot freeze or reset WebGL.
export function setInkCompositorHidden(value) {
  if (compositorHidden === Boolean(value)) return;
  compositorHidden = Boolean(value);
  syncMotion();
}
function syncMotion() {
  if (typeof document === 'undefined') return;
  const suspended = pageHidden || document.hidden || manuallyPaused || reduced;
  clock.setRate(1);
  clock.setPaused(suspended);
  const motion = clock.read();
  // One seek per lifecycle change, never once per animation frame. The browser
  // composites the decoded images without JS, SVG filters, or a shadow pass.
  for (const animation of [...animations, ...portalAnimations]) {
    animation.pause();
    animation.playbackRate = motion.rate;
    animation.currentTime = motion.seconds * 1000;
  }
  if (!suspended) {
    const timeline = document.timeline.currentTime;
    for (const animation of [...(compositorHidden ? [] : animations), ...portalAnimations]) {
      animation.play();
      if (timeline !== null) animation.startTime = timeline - motion.seconds * 1000 / motion.rate;
    }
  }
}

async function startInkMotion() {
  const host = document.querySelector('.portal-artwork');
  if (!host?.querySelector('.portal-image')) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  reduced = preference.matches;
  preference.addEventListener('change', event => { reduced = event.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('pagehide', () => { pageHidden = true; syncMotion(); });
  window.addEventListener('pageshow', () => { pageHidden = false; syncMotion(); });
  syncMotion();

  const layer = document.createElement('div');
  layer.className = 'symbol-ink';
  layer.setAttribute('aria-hidden', 'true');
  const ready = [];
  INK_RINGS.forEach((ring, i) => {
    const fixed = document.createElement('div');
    fixed.className = 'symbol-ink-band';
    fixed.style.left = `${(ring.cx - ring.outer) / 1254 * 100}%`;
    fixed.style.top = `${(ring.cy - ring.outer) / 1254 * 100}%`;
    fixed.style.width = fixed.style.height = `${ring.outer * 2 / 1254 * 100}%`;
    const maskUrl = new URL(`./assets/symbol-mask-${i}.png`, import.meta.url).href;
    fixed.style.maskImage = fixed.style.webkitMaskImage = `url("${maskUrl}")`;
    const mask = new Image();
    mask.src = maskUrl;
    ready.push(mask.decode());
    const turning = document.createElement('img');
    turning.className = 'symbol-ink-turn';
    turning.dataset.inkRing = i;
    turning.alt = '';
    turning.draggable = false;
    turning.width = turning.height = ring.outer * 2;
    turning.src = new URL(`./assets/symbol-ring-${i}.webp`, import.meta.url).href;
    ready.push(turning.decode());
    fixed.append(turning);
    layer.append(fixed);
  });
  // Do not expose half-decoded rings, or an animation at a different phase.
  await Promise.all(ready);
  host.append(layer);
  animations = [...layer.querySelectorAll('.symbol-ink-turn')].map(turning =>
    turning.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: INK_CYCLE * 1000, iterations: Infinity, easing: 'linear' }));
  // The new convergence ring remains visible in both renderer modes and uses
  // the same phase as the original ink. It is never hidden with the fallback.
  portalAnimations = [...host.querySelectorAll('.unity-ink-ring')].map(turning =>
    turning.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: INK_CYCLE * 1000, iterations: Infinity, easing: 'linear' }));
  syncMotion();
}
if (typeof document !== 'undefined') startInkMotion().catch(error => {
  console.warn('Dream Unity: ink layers could not load.', error.message);
});
