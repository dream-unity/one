// The same original ink bands turn in WebGL and in the SVG fallback.
// Whole circles rotate rigidly: their centres, radii and the connecting spine
// never move. A shared browser animation clock prevents a fallback pose jump.
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

let animations = [], reduced = false, manuallyPaused = false;
export function getInkMotion() {
  const seconds = (Number(animations[0]?.currentTime) || 0) / 1000;
  return { seconds, angle: seconds * Math.PI * 2 / INK_CYCLE,
    paused: animations[0]?.playState === 'paused', reduced,
    active: animations.length > 0 };
}
export function pauseInkMotion(value) {
  manuallyPaused = Boolean(value);
  syncMotion();
}
function syncMotion() {
  if (typeof document === 'undefined') return;
  const hidden = document.hidden || document.querySelector('#world-panel')?.getAttribute('aria-hidden') === 'false';
  for (const animation of animations) {
    animation.updatePlaybackRate(reduced ? .5 : 1);
    if (hidden || manuallyPaused) animation.pause(); else animation.play();
  }
}

function startInkMotion() {
  const host = document.querySelector('.portal-artwork');
  const image = host?.querySelector('.portal-image');
  if (!host || !image) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1254 1254');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('symbol-ink');
  const defs = document.createElementNS(ns, 'defs');
  svg.append(defs);
  const make = (name, attrs, parent) => {
    const el = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent.append(el);
    return el;
  };
  // Feather only masks, never the drawing itself. Source and destination
  // masks both protect the spine so it cannot rotate into a moving spoke.
  const blur = make('filter', { id: 'ink-feather', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
  make('feGaussianBlur', { stdDeviation: 2 }, blur);
  INK_RINGS.forEach((ring, i) => {
    const mask = make('mask', { id: `ink-band-${i}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1254, height: 1254 }, defs);
    const feathered = make('g', { filter: 'url(#ink-feather)' }, mask);
    make('circle', { cx: ring.cx, cy: ring.cy, r: (ring.inner + ring.outer) / 2,
      fill: 'none', stroke: 'white', 'stroke-width': ring.outer - ring.inner - ring.feather }, feathered);
    make('rect', { x: 0, y: 609, width: 1254, height: 36, fill: 'black' }, feathered);
    for (const [cx, radius] of [[354, 75], [626, 139], [899, 75]])
      make('circle', { cx, cy: 627, r: radius, fill: 'black' }, feathered);
    for (const hub of HUB_GUARDS)
      if (hub.cx !== ring.cx || hub.cy !== ring.cy)
        make('circle', { cx: hub.cx, cy: hub.cy, r: hub.radius + 6, fill: 'black' }, feathered);
    const fixed = make('g', { mask: `url(#ink-band-${i})` }, svg);
    const turning = make('g', { 'data-ink-ring': i }, fixed);
    turning.style.transformBox = 'view-box';
    turning.style.transformOrigin = `${ring.cx}px ${ring.cy}px`;
    make('image', { href: image.getAttribute('src'), x: 0, y: 0, width: 1254, height: 1254,
      mask: `url(#ink-band-${i})` }, turning);
    const animation = turning.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: INK_CYCLE * 1000, iterations: Infinity, easing: 'linear' });
    animations.push(animation);
  });
  host.append(svg);
  // Start every ring on exactly the same timeline, including on slow devices.
  const startTime = document.timeline.currentTime;
  animations.forEach(animation => { animation.startTime = startTime; });
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  reduced = preference.matches;
  preference.addEventListener('change', event => { reduced = event.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  const panel = document.querySelector('#world-panel');
  if (panel) new MutationObserver(syncMotion).observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
  window.addEventListener('pageshow', syncMotion);
  syncMotion();
}
if (typeof document !== 'undefined') startInkMotion();
