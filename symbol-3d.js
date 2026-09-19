import * as THREE from './vendor/three/three.module.min.js';
import { sampleLife, sampleBand } from './symbol-life.js?v=grounded-symbol-20260920';

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
const rings = [];
const S = 10 / 1254;
const segments = 192;
let renderer, scene, camera, mechanism, wallMaterial, resizeObserver, panelObserver;
let ready = false, contextLost = false, destroyed = false;
let paused = motionPreference.matches, raf = 0, frameCount = 0, lastTime = 0;
let elapsed = 0, width = 1, height = 1, life = sampleLife(0);

// Actual annular surfaces and side walls carry the original, full-colour ink.
// Compensate the small, FIXED inclination in the geometry, keeping each ring's
// projected circle the original size. Rotating details never swell or drift.
function ringSurface(inner, outer, cx, cy, tilt) {
  const geometry = own(new THREE.RingGeometry(inner * S, outer * S, segments, 8));
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const radius = Math.hypot(x, y) / S;
    const across = THREE.MathUtils.clamp((radius - inner) / (outer - inner), 0, 1);
    const z = -.018 * Math.pow(Math.abs(across * 2 - 1), 6);
    uv.setXY(i, (cx + x / S) / 1254, 1 - (cy - y / S) / 1254);
    position.setXYZ(i, x, (y + z * Math.sin(tilt)) / Math.cos(tilt), z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function ringWall(radius, tilt) {
  const positions = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const x = Math.cos(angle) * radius * S;
    const y = (Math.sin(angle) * radius * S - .018 * Math.sin(tilt)) / Math.cos(tilt);
    positions.push(x, y, -.018, x, y, -.078);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function build() {
  const texture = own(new THREE.Texture(original));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  mechanism = new THREE.Group();
  scene.add(mechanism);
  const material = own(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  const backing = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), material);
  backing.renderOrder = 0;
  mechanism.add(backing);

  function ringMaterial(cx, cy) {
    const faceMaterial = own(material.clone());
    // Share the transparent queue so walls render beneath faces and the fixed
    // spine renders last. The ring faces themselves remain fully opaque.
    faceMaterial.transparent = true;
    faceMaterial.onBeforeCompile = shader => {
      shader.uniforms.uRelief = relief;
      shader.uniforms.uRingCenter = { value: new THREE.Vector2(cx, cy) };
      shader.vertexShader = 'varying vec3 vReliefNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvReliefNormal = normalize(normalMatrix * normal);');
      shader.fragmentShader = 'uniform float uRelief;\nuniform vec2 uRingCenter;\nvarying vec3 vReliefNormal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        // The connecting bar belongs to the stationary skeleton, not the rings.
        // Replace its pixels with the adjacent arc at the SAME radius, keeping
        // the original ink/paper instead of rotating extra bars and cut-outs.
        vec2 pixel = vec2(vMapUv.x, 1.0 - vMapUv.y) * 1254.0;
        float repair = 1.0 - smoothstep(12.0, 16.0, abs(pixel.y - 627.0));
        vec2 offset = pixel - uRingCenter;
        float radius = length(offset);
        float sampleY = 607.0 - uRingCenter.y;
        float sampleX = sign(offset.x) * sqrt(max(0.0, radius * radius - sampleY * sampleY));
        vec2 cleanPixel = uRingCenter + vec2(sampleX, sampleY);
        vec2 cleanUv = vec2(cleanPixel.x / 1254.0, 1.0 - cleanPixel.y / 1254.0);
        diffuseColor = mix(diffuseColor, texture2D(map, cleanUv), repair);
        float ink = 1.0 - smoothstep(0.18, 0.78, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
        float light = dot(normalize(vReliefNormal), normalize(vec3(-0.5, 0.7, 1.0)));
        diffuseColor.rgb *= 1.0 + uRelief * ink * (light - 0.76) * 0.28;
      `);
    };
    faceMaterial.customProgramCacheKey = () => 'original-ink-ring-relief-2';
    return faceMaterial;
  }
  wallMaterial = own(new THREE.MeshBasicMaterial({ color: 0x433d32, transparent: true,
    opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));

  function addRing(inner, outer, cx, cy, index, isOuter) {
    const tilt = (index % 2 ? -1 : 1) * (isOuter ? .06 : .075);
    const spin = new THREE.Group();
    spin.position.set((cx - 627) * S, (627 - cy) * S, 0);
    const inclined = new THREE.Group();
    inclined.rotation.x = tilt;
    spin.add(inclined);
    mechanism.add(spin);
    for (const radius of [inner, outer]) {
      const wall = new THREE.Mesh(ringWall(radius, tilt), wallMaterial);
      wall.renderOrder = 1;
      inclined.add(wall);
    }
    const face = new THREE.Mesh(ringSurface(inner, outer, cx, cy, tilt), ringMaterial(cx, cy));
    face.renderOrder = 2;
    inclined.add(face);
    rings.push({ spin, inclined, index, isOuter, inner, outer,
      initialAngle: sampleBand(sampleLife(0), index, isOuter).z });
  }

  [[415, 452], [452, 484], [484, 516], [516, 604]].forEach(([inner, outer], i) =>
    addRing(inner, outer, 627, 627, i, true));
  // The maker's drawing is deliberately eccentric: keep its original centre
  // and leave the offset label disc stationary, instead of rebuilding the hub.
  for (const [cx, cy, inner, split, outer, index] of [
    [354, 627, 70, 99, 128, 0],
    [626, 604, 139, 163, 186, 0],
    [899, 627, 70, 99, 128, 1],
  ]) {
    addRing(inner, split, cx, cy, index, false);
    addRing(split, outer, cx, cy, 1 - index, false);
  }

  // Preserve the original spine and ink around the labels above the moving
  // rings. This also masks the source image's old text with the existing DOM.
  const spineMaterial = own(material.clone());
  spineMaterial.transparent = true;
  spineMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 pixel = vec2(vMapUv.x, 1.0 - vMapUv.y) * 1254.0;
      float spine = 1.0 - smoothstep(16.0, 19.0, abs(pixel.y - 627.0));
      float labels = max(1.0 - smoothstep(68.0, 70.0, distance(pixel, vec2(354.0, 627.0))),
        1.0 - smoothstep(68.0, 70.0, distance(pixel, vec2(899.0, 627.0))));
      labels = max(labels, 1.0 - smoothstep(129.0, 132.0, distance(pixel, vec2(626.0, 604.0))));
      diffuseColor.a *= max(spine, labels);
    `);
  };
  spineMaterial.customProgramCacheKey = () => 'original-anchored-spine-1';
  const spine = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), spineMaterial);
  spine.renderOrder = 3;
  mechanism.add(spine);
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
  // Continuous counter-rotation, on the same slow clock as the earlier 3D
  // simulation. Each real ring turns; the body and camera never move.
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
  lastTime = time;
  if (!paused) elapsed += dt / 12;
  life = sampleLife(elapsed);
  for (const ring of rings) {
    const pose = sampleBand(life, ring.index, ring.isOuter);
    ring.spin.rotation.z = (pose.z - ring.initialAngle) * (ring.isOuter ? .55 : .4);
  }
  relief.value = 1 - Math.exp(-elapsed * 3);
  wallMaterial.opacity = relief.value * .2;
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
      zoom: camera?.zoom ?? 1, meshCount: rings.length * 3 + (mechanism ? 2 : 0),
      ringCount: rings.length, wallMeshCount: rings.length * 2,
      simulation: 'rotating-3d-rings',
      life: { ...life }, centroid: portalCenters[1], portalCenters,
      ringPoses: rings.map(ring => ({ x: ring.inclined.rotation.x, y: 0,
        z: ring.spin.rotation.z, scale: ring.spin.scale.x,
        depth: 2 * ring.outer * S * Math.tan(ring.inclined.rotation.x),
        center: ring.spin.position.toArray() })),
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
