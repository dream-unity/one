import * as THREE from './vendor/three/three.module.min.js';
import { SURFACE_GLSL, SURFACE_SCALE, SURFACE_RINGS, sampleSurface, sampleSurfaceLife } from './symbol-surface.js?v=coherent-pace-20260920';

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
const segments = 192;
let renderer, scene, camera, mechanism, surface, resizeObserver, panelObserver;
let ready = false, contextLost = false, destroyed = false;
let paused = motionPreference.matches, raf = 0, frameCount = 0, lastTime = 0;
let elapsed = 0, width = 1, height = 1, life = sampleSurfaceLife(0);

// The source drawing has eccentric, overlapping circles. Keeping it on one
// connected mesh avoids cutting its strokes into independently tilted slices.
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
  const material = own(new THREE.MeshStandardMaterial({ map: texture,
    roughness: 1, metalness: 0, toneMapped: false }));
  const uniforms = { uSurfaceLife: surfaceLife, uSurfaceRelief: relief };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = SURFACE_GLSL + shader.vertexShader;
    // Normals follow the same live surface as the vertices, including the
    // tangential motion. Shading must not pretend this is still a flat image.
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      vec3 surfacePoint = livingSurface(position);
      vec3 surfaceDx = livingSurface(position + vec3(0.008, 0.0, 0.0)) - surfacePoint;
      vec3 surfaceDy = livingSurface(position + vec3(0.0, 0.008, 0.0)) - surfacePoint;
      objectNormal = normalize(cross(surfaceDx, surfaceDy));
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = surfacePoint;');
    shader.fragmentShader = 'uniform float uSurfaceRelief;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',
      '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
    // Preserve the original RGB on flat paper. Only real surface inclination
    // and soft, geometry-matched shadows modulate the drawing's neutral tones.
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 keyDirection = normalize(vec3(-3.0, 5.0, 8.0));
      float facing = dot(normal, keyDirection);
      float shade = clamp(1.0 + 0.75 * (facing - keyDirection.z), 0.52, 1.16);
      float shadow = mix(1.0, getShadowMask(), 0.18 * uSurfaceRelief);
      outgoingLight = diffuseColor.rgb * shade * shadow;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'connected-ink-relief-1';
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
  depth.customProgramCacheKey = () => 'connected-ink-shadow-1';
  surface.customDepthMaterial = depth;
  mechanism.add(surface);
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
  // One real-time rhythm coordinates all four regions. The body and camera
  // never translate, tilt or scale; motion stays inside the original contours.
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .25) : 0;
  lastTime = time;
  if (!paused) elapsed += dt;
  life = sampleSurfaceLife(elapsed);
  relief.value = life.relief;
  surfaceLife.value.set(life.flow, life.flex, life.crossFlex, 0);
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
      rotation: { x: mechanism?.rotation.x ?? 0, y: mechanism?.rotation.y ?? 0 },
      position: mechanism?.position.toArray(), scale: mechanism?.scale.toArray(),
      zoom: camera?.zoom ?? 1, meshCount: surface ? 1 : 0,
      vertexCount: surface?.geometry.attributes.position.count ?? 0,
      simulation: 'continuous-3d-relief',
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8271, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.8);
    light.position.set(-3, 5, 8);
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
