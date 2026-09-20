import * as THREE from './vendor/three/three.module.min.js';
import { SURFACE_GLSL, SURFACE_SCALE, SURFACE_RINGS, sampleSurface, sampleSurfaceBasis,
  sampleSurfaceLife, advanceSurfaceTime } from './symbol-surface.js?v=clockwise-20260920';
import { INK_GLSL, INK_RINGS, getInkMotion, pauseInkMotion } from './symbol-motion.js?v=visible-ink-20260920';

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
const relief = { value: 0 };
const surfaceLife = { value: new THREE.Vector4() };
const inkTurn = { value: new THREE.Vector2(1, 0) };
const segments = 128;
let renderer, scene, camera, mechanism, surface, resizeObserver, panelObserver;
let ready = false, contextLost = false, destroyed = false;
let paused = false, raf = 0, frameCount = 0, lastTime = null;
let elapsed = 0, width = 1, height = 1, life = sampleSurfaceLife(0);

// Precompute height and slope coefficients once, instead of evaluating the
// complete deformation three times per vertex on every rendered frame.
function addReliefAttributes(geometry) {
  const positions = geometry.attributes.position;
  const base = new Float32Array(positions.count * 3);
  const wave = new Float32Array(positions.count * 4);
  const dx = new Float32Array(positions.count * 4);
  const dy = new Float32Array(positions.count * 4);
  const epsilon = .5;
  const divisor = 2 * epsilon * SURFACE_SCALE;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / SURFACE_SCALE + 627;
    const y = 627 - positions.getY(i) / SURFACE_SCALE;
    const basis = sampleSurfaceBasis(x, y);
    const left = sampleSurfaceBasis(x - epsilon, y);
    const right = sampleSurfaceBasis(x + epsilon, y);
    const top = sampleSurfaceBasis(x, y - epsilon);
    const bottom = sampleSurfaceBasis(x, y + epsilon);
    base.set([basis[0], (right[0] - left[0]) / divisor,
      (top[0] - bottom[0]) / divisor], i * 3);
    for (let j = 0; j < 4; j++) {
      wave[i * 4 + j] = basis[j + 1];
      dx[i * 4 + j] = (right[j + 1] - left[j + 1]) / divisor;
      dy[i * 4 + j] = (top[j + 1] - bottom[j + 1]) / divisor;
    }
  }
  geometry.setAttribute('reliefBase', new THREE.BufferAttribute(base, 3));
  geometry.setAttribute('reliefWave', new THREE.BufferAttribute(wave, 4));
  geometry.setAttribute('reliefDx', new THREE.BufferAttribute(dx, 4));
  geometry.setAttribute('reliefDy', new THREE.BufferAttribute(dy, 4));
}

// One connected mesh preserves the drawing's original X/Y and UV coordinates.
function build() {
  const texture = own(new THREE.Texture(original));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  mechanism = new THREE.Group();
  scene.add(mechanism);

  const geometry = own(new THREE.PlaneGeometry(10, 10, segments, segments));
  addReliefAttributes(geometry);
  const material = own(new THREE.MeshStandardMaterial({ map: texture,
    roughness: 1, metalness: 0, toneMapped: false }));
  const uniforms = { uSurfaceLife: surfaceLife, uSurfaceRelief: relief, uInkTurn: inkTurn };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = SURFACE_GLSL + shader.vertexShader;
    // The live normals and vertices use the same precomputed spatial basis.
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      vec3 surfacePoint = livingSurface(position);
      objectNormal = livingNormal();
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = surfacePoint;');
    shader.fragmentShader = 'uniform float uSurfaceRelief;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>',
      '#include <map_pars_fragment>\n' + INK_GLSL);
    // Rotate original ink landmarks on their existing circular tracks. Mixing
    // complete rigid samples avoids any accumulating twist or change of radius.
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 inkPoint = vec2(vMapUv.x, 1.0 - vMapUv.y) * 1254.0;
      vec4 ink = texture2D(map, vMapUv);
      ${INK_RINGS.map(r => `ink = turningInk(ink, inkPoint, vec4(${r.cx}.0, ${r.cy}.0, ${r.inner}.0, ${r.outer}.0), ${r.feather}.0);`).join('\n')}
      diffuseColor *= ink;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',
      '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
    // Preserve the original RGB on flat paper. Only real surface inclination
    // and soft, geometry-matched shadows modulate the drawing's neutral tones.
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 keyDirection = normalize(vec3(0.0, 5.0, 8.0));
      float facing = dot(normal, keyDirection);
      float shade = clamp(1.0 + 0.75 * (facing - keyDirection.z), 0.65, 1.12);
      float shadow = mix(1.0, getShadowMask(), 0.10 * uSurfaceRelief);
      outgoingLight = diffuseColor.rgb * shade * shadow;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'visible-clockwise-ink-1';
  surface = new THREE.Mesh(geometry, material);
  surface.castShadow = true;
  surface.receiveShadow = true;
  // Custom GPU displacement needs bounds that include its raised relief.
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += .5;
  const depth = own(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  depth.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = SURFACE_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = livingSurface(position);');
  };
  depth.customProgramCacheKey = () => 'fixed-proportions-shadow-1';
  surface.customDepthMaterial = depth;
  mechanism.add(surface);
}

function canRender() {
  return ready && !destroyed && !contextLost && !document.hidden && panel.getAttribute('aria-hidden') !== 'false';
}

function wake() {
  if (!raf && canRender()) { lastTime = null; raf = requestAnimationFrame(tick); }
}

function pause(value) {
  paused = Boolean(value);
  pauseInkMotion(paused);
  status.textContent = paused ? 'Symbol animation paused.' : 'Symbol animation playing.';
  wake();
}

function tick(time) {
  raf = 0;
  if (!canRender()) return;
  // One real-time rhythm coordinates all four regions. The body and camera
  // never translate, tilt or scale; motion stays inside the original contours.
  elapsed = advanceSurfaceTime(elapsed, lastTime, time, paused);
  lastTime = time;
  life = sampleSurfaceLife(elapsed);
  const ink = getInkMotion();
  inkTurn.value.set(Math.cos(ink.angle), Math.sin(ink.angle));
  relief.value = life.relief * (motionPreference.matches ? .45 : 1);
  surfaceLife.value.fromArray(life.wave);
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
  // Match the displayed resolution without rendering a full desktop-sized
  // buffer on every phone. UVs and the square projection remain unchanged.
  const pixels = Math.max(1, Math.min(original.naturalWidth,
    Math.ceil(width * Math.min(devicePixelRatio || 1, 2))));
  renderer.setSize(pixels, pixels, false);
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
      rotation: { x: mechanism?.rotation.x ?? 0, y: mechanism?.rotation.y ?? 0 },
      position: mechanism?.position.toArray(), scale: mechanism?.scale.toArray(),
      zoom: camera?.zoom ?? 1, meshCount: ready && surface ? 1 : 0,
      vertexCount: surface?.geometry.attributes.position.count ?? 0,
      bufferSize: renderer ? [renderer.domElement.width, renderer.domElement.height] : null,
      simulation: ready && !contextLost ? 'continuous-3d-relief'
        : getInkMotion().active ? 'animated-ink' : 'static-illustration',
      inkMotion: getInkMotion(),
      life: { ...life }, centroid: portalCenters[1], portalCenters,
      surfaceSamples: SURFACE_RINGS.flatMap(ring => {
        const radius = (ring.inner + ring.outer) / 2;
        return [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4].map(angle => {
          const x = ring.cx + Math.cos(angle) * radius;
          const y = ring.cy + Math.sin(angle) * radius;
          const p = sampleSurface(x, y, elapsed);
          return { source: [x, y], position: [(p.x - 627) * SURFACE_SCALE,
            (627 - p.y) * SURFACE_SCALE, p.z] };
        });
      }),
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'symbol-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 30);
    camera.position.set(0, 0, 10);
    const light = new THREE.DirectionalLight(0xffffff, 2.8);
    light.position.set(0, 5, 8);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 1, far: 25 });
    light.shadow.bias = -.0001;
    light.shadow.normalBias = .015;
    light.shadow.radius = 2;
    scene.add(light);
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
      fallback('Clockwise animation continues.');
    });
    listen(renderer.domElement, 'webglcontextrestored', () => {
      contextLost = false;
      ready = true;
      elapsed = 0;
      wake();
      status.textContent = 'Symbol animation restored.';
    });
    listen(motionPreference, 'change', wake);
    listen(window, 'pagehide', event => { if (!event.persisted) destroy(); });
  } catch (error) {
    destroy();
    status.textContent = 'Clockwise animation is playing.';
    console.info('Dream Unity: using the animated ink fallback.', error.message);
  }
}

start();
