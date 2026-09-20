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
let renderer, scene, camera, mechanism, wallMaterial, shadowMaterial, resizeObserver, panelObserver;
let ready = false, contextLost = false, destroyed = false;
let paused = motionPreference.matches, raf = 0, frameCount = 0, lastTime = 0;
let elapsed = 0, width = 1, height = 1, life = sampleLife(0);

// Real bevelled surfaces: their inclination is visible, never cancelled by
// screen-space compensation. The body's position and scale remain fixed.
function ringSurface(inner, outer, cx, cy) {
  const geometry = own(new THREE.RingGeometry(inner * S, outer * S, segments, 8));
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const radius = Math.hypot(x, y) / S;
    const across = THREE.MathUtils.clamp((radius - inner) / (outer - inner), 0, 1);
    const z = -.035 * Math.pow(Math.abs(across * 2 - 1), 6);
    uv.setXY(i, (cx + x / S) / 1254, 1 - (cy - y / S) / 1254);
    position.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function ringWall(radius) {
  const positions = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const x = Math.cos(angle) * radius * S;
    const y = Math.sin(angle) * radius * S;
    positions.push(x, y, -.035, x, y, -.18);
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
  // Remove the flat copies underneath the moving rings. When a real ring
  // inclines, it reveals paper, not a second drawing glued to the background.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = `
      float ringArea(float radius, float inner, float outer) {
        return step(inner, radius) * (1.0 - step(outer, radius));
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 pixel = vec2(vMapUv.x, 1.0 - vMapUv.y) * 1254.0;
      float area = ringArea(distance(pixel, vec2(627.0)), 414.5, 516.5);
      area = max(area, ringArea(distance(pixel, vec2(354.0, 627.0)), 69.5, 128.5));
      area = max(area, ringArea(distance(pixel, vec2(626.0, 604.0)), 138.5, 186.5));
      area = max(area, ringArea(distance(pixel, vec2(899.0, 627.0)), 69.5, 128.5));
      // A mirrored blank corner of the same source supplies matching paper.
      vec2 paperPixel = vec2(18.0) + abs(fract(pixel / 268.0) * 2.0 - 1.0) * 116.0;
      vec4 paper = texture2D(map, vec2(paperPixel.x / 1254.0, 1.0 - paperPixel.y / 1254.0));
      diffuseColor = mix(diffuseColor, paper, area);
    `);
  };
  material.customProgramCacheKey = () => 'paper-without-flat-rings-1';
  backing.position.z = -1.65;
  backing.renderOrder = 0;
  mechanism.add(backing);

  shadowMaterial = own(new THREE.ShadowMaterial({ color: 0x373229, opacity: 0, depthWrite: false }));
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), shadowMaterial);
  shadow.position.z = -1.6;
  shadow.receiveShadow = true;
  shadow.renderOrder = 1;
  mechanism.add(shadow);

  function ringMaterial(cx, cy) {
    const faceMaterial = own(material.clone());
    faceMaterial.depthTest = true;
    faceMaterial.depthWrite = true;
    faceMaterial.transparent = false;
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
        float light = dot(normalize(vReliefNormal), normalize(vec3(-0.5, 0.7, 1.0)));
        diffuseColor.rgb *= mix(1.0, 0.55 + max(light, 0.0) * 0.6, uRelief);
      `);
    };
    faceMaterial.customProgramCacheKey = () => 'dimensional-original-ink-3';
    return faceMaterial;
  }
  wallMaterial = own(new THREE.MeshStandardMaterial({ color: 0x635e52,
    roughness: .82, metalness: .06, side: THREE.DoubleSide, toneMapped: false }));

  function addRing(inner, outer, cx, cy, index, isOuter) {
    const spin = new THREE.Group();
    spin.position.set((cx - 627) * S, (627 - cy) * S, 0);
    const inclined = new THREE.Group();
    spin.add(inclined);
    mechanism.add(spin);
    for (const radius of [inner, outer]) {
      const wall = new THREE.Mesh(ringWall(radius), wallMaterial);
      wall.castShadow = true;
      wall.renderOrder = 2;
      inclined.add(wall);
    }
    const face = new THREE.Mesh(ringSurface(inner, outer, cx, cy), ringMaterial(cx, cy));
    face.castShadow = true;
    face.renderOrder = 2;
    inclined.add(face);
    rings.push({ spin, inclined, index, isOuter, inner, outer,
      initialAngle: sampleBand(sampleLife(0), index, isOuter).z });
  }

  // Keep the sparse outer construction guides on the paper: giving that
  // mostly-empty annulus solid walls would turn it into a broad white rim.
  [[415, 452], [452, 484], [484, 516]].forEach(([inner, outer], i) =>
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
      float across = abs(pixel.y - 627.0);
      float spine = 1.0 - smoothstep(1.5, 2.8, across);
      float bridges = max(step(420.0, pixel.x) * (1.0 - step(523.0, pixel.x)),
        step(730.0, pixel.x) * (1.0 - step(833.0, pixel.x)));
      bridges = max(bridges, step(155.0, pixel.x) * (1.0 - step(288.0, pixel.x)));
      bridges = max(bridges, step(969.0, pixel.x) * (1.0 - step(1100.0, pixel.x)));
      spine = max(spine, bridges * (1.0 - smoothstep(4.0, 7.0, across)));
      float pins = min(min(distance(pixel, vec2(282.0, 627.0)), distance(pixel, vec2(426.0, 627.0))),
        min(distance(pixel, vec2(828.0, 627.0)), distance(pixel, vec2(972.0, 627.0))));
      spine = max(spine, 1.0 - smoothstep(7.0, 9.0, pins));
      float labels = max(1.0 - smoothstep(68.0, 70.0, distance(pixel, vec2(354.0, 627.0))),
        1.0 - smoothstep(68.0, 70.0, distance(pixel, vec2(899.0, 627.0))));
      labels = max(labels, 1.0 - smoothstep(129.0, 132.0, distance(pixel, vec2(626.0, 604.0))));
      diffuseColor.a *= max(spine, labels);
    `);
  };
  spineMaterial.customProgramCacheKey = () => 'original-anchored-spine-1';
  const spine = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), spineMaterial);
  spine.renderOrder = 10;
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
  // A modest lift in circulation and tilt makes the depth readable on the
  // same slow clock. Each real ring turns; the body and camera never move.
  // Preserve the chosen real-time pace on slower devices too. Wake resets
  // lastTime after suspension, so background time never causes a catch-up.
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .25) : 0;
  lastTime = time;
  if (!paused) elapsed += dt / 12;
  life = sampleLife(elapsed);
  relief.value = 1 - Math.exp(-elapsed * 3);
  for (const ring of rings) {
    const pose = sampleBand(life, ring.index, ring.isOuter);
    ring.spin.rotation.z = (pose.z - ring.initialAngle) * (ring.isOuter ? .68 : .50);
    const direction = ring.index % 2 ? -1 : 1;
    const phase = life.phase * .50 + Math.floor(ring.index / 2) * .45;
    ring.inclined.rotation.x = direction * relief.value
      * ((ring.isOuter ? .24 : .20) + Math.sin(phase) * .055);
    ring.inclined.rotation.y = direction * relief.value
      * ((ring.isOuter ? .12 : .09) * Math.cos(phase * .8));
  }
  shadowMaterial.opacity = relief.value * .13;
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
      zoom: camera?.zoom ?? 1, meshCount: rings.length * 3 + (mechanism ? 3 : 0),
      ringCount: rings.length, wallMeshCount: rings.length * 2,
      simulation: 'rotating-3d-rings',
      life: { ...life }, centroid: portalCenters[1], portalCenters,
      ringPoses: rings.map(ring => ({ x: ring.inclined.rotation.x, y: ring.inclined.rotation.y,
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
    light.position.set(-1.5, 2.5, 30);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 20, far: 40 });
    light.shadow.bias = -.0003;
    light.shadow.normalBias = .01;
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
