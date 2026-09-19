import * as THREE from './vendor/three/three.module.min.js';
import { sampleLife } from './symbol-life.js?v=grounded-symbol-20260920';

const host = document.querySelector('.portal-artwork');
const original = host.querySelector('.portal-image');
const buttons = [...host.querySelectorAll('.portal-card')];
const status = document.querySelector('#symbol-status');
const panel = document.querySelector('#world-panel');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const events = new AbortController();
const disposables = new Set();
const own = resource => { disposables.add(resource); return resource; };
const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });
const motion = { value: new THREE.Vector4() };
let renderer, scene, camera, surface, resizeObserver, panelObserver;
let ready = false, contextLost = false, destroyed = false;
let paused = motionPreference.matches, raf = 0, frameCount = 0, lastTime = 0;
let elapsed = 0, width = 1, height = 1, life = sampleLife(0);

// Keep every original line and the paper. Only small angular movements inside
// the ink rings are allowed; silhouette, label discs and connections stay fixed.
const flowShader = `
uniform vec4 uInkMotion;
vec2 inkFlow(vec2 point, vec2 centre, float inner, float outer, float angle) {
  vec2 delta = point - centre;
  float radius = length(delta);
  float feather = (outer - inner) * 0.45;
  float band = smoothstep(inner, inner + feather, radius)
    * (1.0 - smoothstep(outer - feather, outer, radius));
  float spine = smoothstep(12.0, 52.0, abs(point.y - 627.0));
  float turn = angle * band * spine;
  float c = cos(turn), s = sin(turn);
  return centre + vec2(c * delta.x - s * delta.y, s * delta.x + c * delta.y);
}
`;

function build() {
  const texture = own(new THREE.Texture(original));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const material = own(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  material.onBeforeCompile = shader => {
    shader.uniforms.uInkMotion = motion;
    shader.fragmentShader = flowShader + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 sourcePoint = vec2(vMapUv.x, 1.0 - vMapUv.y) * 1254.0;
      vec2 point = inkFlow(sourcePoint, vec2(627.0), 405.0, 461.0, uInkMotion.x);
      point = inkFlow(point, vec2(627.0), 461.0, 535.0, uInkMotion.y);
      point = inkFlow(point, vec2(354.0, 627.0), 77.0, 132.0, uInkMotion.z);
      point = inkFlow(point, vec2(626.0, 604.0), 139.0, 190.0, uInkMotion.w);
      point = inkFlow(point, vec2(899.0, 627.0), 77.0, 132.0, -uInkMotion.z);
      vec2 drawingUv = vec2(point.x / 1254.0, 1.0 - point.y / 1254.0);
      diffuseColor *= texture2D(map, drawingUv);
    `);
  };
  material.customProgramCacheKey = () => 'original-artwork-flow-1';
  surface = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), material);
  scene.add(surface);
}

function canRender() {
  return ready && !destroyed && !contextLost && !document.hidden && panel.getAttribute('aria-hidden') !== 'false';
}

function wake() {
  if (!raf && canRender()) { lastTime = 0; raf = requestAnimationFrame(tick); }
}

function pause(value) {
  paused = Boolean(value);
  status.textContent = paused ? 'Symbol animation paused.' : 'Symbol animation playing.';
  wake();
}

function tick(time) {
  raf = 0;
  if (!canRender()) return;
  // Start at the untouched image. Keep the slow clock and bound the motion,
  // so even a long session preserves the drawing's original shape.
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
  lastTime = time;
  if (!paused) elapsed += dt / 12;
  life = sampleLife(elapsed);
  motion.value.set(
    .012 * Math.sin(life.phase * .72),
    -.014 * Math.sin(life.phase * .63),
    .035 * Math.sin(life.phase * .84),
    -.028 * Math.sin(life.phase * .76),
  );
  renderer.render(scene, camera);
  frameCount++;
  host.classList.add('is-3d');
  if (!paused) raf = requestAnimationFrame(tick);
}

function resize() {
  const rect = host.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  // Exactly the image's extent, with no readiness-dependent layout change.
  camera.left = -5 * width / height;
  camera.right = 5 * width / height;
  camera.top = 5;
  camera.bottom = -5;
  camera.updateProjectionMatrix();
  // Use the same intrinsic pixel grid as <img>; CSS applies the same scaling
  // to both surfaces, avoiding a blur/half-pixel shift during the handoff.
  renderer.setSize(original.naturalWidth, original.naturalHeight, false);
  wake();
}

function fallback(message) {
  ready = false;
  cancelAnimationFrame(raf);
  raf = 0;
  host.classList.remove('is-3d');
  if (message) status.textContent = message;
}

function destroy() {
  if (destroyed) return;
  destroyed = true;
  fallback();
  events.abort();
  resizeObserver?.disconnect();
  panelObserver?.disconnect();
  for (const resource of disposables) resource.dispose();
  renderer?.dispose();
  renderer?.domElement.remove();
}

window.__DREAM_SYMBOL__ = {
  getState: () => {
    const rect = host.getBoundingClientRect();
    const portalCenters = buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { x: box.x + box.width / 2 - rect.x, y: box.y + box.height / 2 - rect.y };
    });
    return {
      ready, paused, reducedMotion: motionPreference.matches, frameCount, contextLost,
      rotation: { x: surface?.rotation.x ?? 0, y: surface?.rotation.y ?? 0 },
      zoom: camera?.zoom ?? 1, meshCount: surface ? 1 : 0, ringCount: 5,
      life: { ...life }, centroid: portalCenters[1], portalCenters,
      ringPoses: [...motion.value.toArray(), -motion.value.z].map(z => ({ x: 0, y: 0, z, scale: 1 })),
    };
  },
  pause, destroy,
};

async function start() {
  try {
    if (!original.complete || !original.naturalWidth) await original.decode();
    if (destroyed) return;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = 'symbol-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 30);
    camera.position.set(0, 0, 10);
    build();
    ready = true;
    resize();
    // Cover the fallback only after rendering an identical, successful frame.
    cancelAnimationFrame(raf);
    raf = 0;
    tick(performance.now());
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    panelObserver = new MutationObserver(() => {
      if (!canRender()) { cancelAnimationFrame(raf); raf = 0; } else wake();
    });
    panelObserver.observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake();
    });
    listen(renderer.domElement, 'webglcontextlost', event => {
      event.preventDefault();
      contextLost = true;
      fallback('The original artwork remains available. All portals are ready.');
    });
    listen(renderer.domElement, 'webglcontextrestored', () => {
      contextLost = false;
      ready = true;
      elapsed = 0;
      wake();
      status.textContent = 'Symbol animation restored.';
    });
    listen(motionPreference, 'change', event => { if (event.matches) pause(true); });
    listen(window, 'pagehide', event => { if (!event.persisted) destroy(); });
  } catch (error) {
    destroy();
    status.textContent = 'Explore the original artwork. All three portals are available.';
    console.info('Dream Unity: using the original illustration.', error.message);
  }
}

start();
