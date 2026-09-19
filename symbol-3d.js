import * as THREE from './vendor/three/three.module.min.js';
import { sampleLife, sampleBand, deformSurface, LIVING_SURFACE_GLSL } from './symbol-life.js?v=grounded-symbol-20260920';

// The original drawing is the surface of the mechanism, and also its fallback.
const host = document.querySelector('.portal-artwork');
const original = host.querySelector('.portal-image');
const buttons = [...host.querySelectorAll('.portal-card')];
const status = document.querySelector('#symbol-status');
const panel = document.querySelector('#world-panel');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 600px)').matches;
const S = 10 / 1254;
const segments = compact ? 96 : 160;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const disposables = new Set();
const events = new AbortController();
const own = (resource) => { disposables.add(resource); return resource; };
const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
let renderer, scene, camera, mechanism, resizeObserver, panelObserver, circulationField, goldMaterial;
let ready = false, contextLost = false, destroyed = false;
let paused = motionPreference.matches, raf = 0, frameCount = 0, lastTime = 0;
let elapsed = 0, width = 1, height = 1, settling = 0, slowFrames = 0;
let quality = compact ? 'mobile' : 'desktop';
let zoom = 1, targetZoom = 1;
const rotation = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
const pointers = new Map();
const rings = [], portals = [], travellers = [], nerves = [];
let life = sampleLife(0);
const surfaceUniforms = { uLifeTime: { value: 0 }, uLifeBreath: { value: 0 } };
const portalCenters = [];
const projected = new THREE.Vector3();
const right = new THREE.Vector3();
const worldPosition = new THREE.Vector3();
const worldScale = new THREE.Vector3();
const cameraQuaternion = new THREE.Quaternion();
const inverseQuaternion = new THREE.Quaternion();
let pinchDistance = 0, dragDistance = 0, suppressClickUntil = 0;

function pause(value) {
  paused = Boolean(value);
  status.textContent = paused ? 'Symbol animation paused. You can still drag to explore.' : 'Symbol animation playing.';
  settling = 1;
  wake();
}

function reset() {
  target.x = 0;
  target.y = 0;
  targetZoom = 1;
  settling = motionPreference.matches || paused ? 1 : 75;
  if (paused || motionPreference.matches) {
    rotation.x = target.x;
    rotation.y = target.y;
    zoom = targetZoom;
  }
  status.textContent = 'Symbol view reset.';
  wake();
}

function fallback(message) {
  ready = false;
  cancelAnimationFrame(raf);
  raf = 0;
  host.classList.remove('is-3d', 'is-dragging');
  for (const button of buttons) button.removeAttribute('style');
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
  getState: () => ({ ready, paused, reducedMotion: motionPreference.matches, frameCount,
    rotation: { ...rotation }, zoom, ringCount: rings.length,
    meshCount: scene ? (() => { let count = 0; scene.traverse(object => { if (object.isMesh) count++; }); return count; })() : 0,
    quality, contextLost, life: { ...life },
    centroid: portalCenters[1] ? { ...portalCenters[1] } : null,
    portalCenters: portalCenters.map(point => ({ ...point })),
    ringPoses: rings.map(({ group }) => ({ x: group.rotation.x, y: group.rotation.y, z: group.rotation.z, scale: group.scale.x })),
  }),
  reset, pause, destroy,
};

// Isolate ink from the unmodified source so the paper remains behind every layer.
function drawingTextures() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1254;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(original, 0, 0, 1254, 1254);
  const ink = ctx.getImageData(0, 0, 1254, 1254);
  const scaffold = ctx.createImageData(1254, 1254);
  for (let y = 0; y < 1254; y++) {
    for (let x = 0; x < 1254; x++) {
      const i = (y * 1254 + x) * 4;
      const luminance = (ink.data[i] * .2126 + ink.data[i + 1] * .7152 + ink.data[i + 2] * .0722) / 255;
      const left = Math.hypot(x - 354, y - 627);
      const middle = Math.hypot(x - 626, y - 604);
      const label = Math.hypot(x - 627, y - 627);
      const right = Math.hypot(x - 899, y - 627);
      const alpha = left < 69 || label < 107 || right < 69 ? 0 : Math.round(clamp((.77 - luminance) / .65, 0, 1) * 255);
      ink.data[i] = 42; ink.data[i + 1] = 36; ink.data[i + 2] = 28; ink.data[i + 3] = alpha;
      scaffold.data[i] = 60; scaffold.data[i + 1] = 48; scaffold.data[i + 2] = 31;
      scaffold.data[i + 3] = Math.hypot(x - 627, y - 627) < 415 && left > 132 && middle > 191 && right > 132 ? alpha : 0;
    }
  }
  ctx.putImageData(ink, 0, 0);
  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const base = document.createElement('canvas');
  base.width = base.height = 1254;
  base.getContext('2d').putImageData(scaffold, 0, 0);
  const baseTexture = own(new THREE.CanvasTexture(base));
  baseTexture.colorSpace = THREE.SRGBColorSpace;
  return { texture, baseTexture };
}

function ringGeometry(inner, outer, cx, cy) {
  const geometry = own(new THREE.RingGeometry(inner * S, outer * S, segments));
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, (cx + positions.getX(i) / S) / 1254, 1 - (cy - positions.getY(i) / S) / 1254);
  }
  return geometry;
}

function build() {
  const { texture, baseTexture } = drawingTextures();
  function living(material) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, surfaceUniforms);
      shader.vertexShader = 'uniform float uLifeTime;\nuniform float uLifeBreath;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LIVING_SURFACE_GLSL);
    };
    material.customProgramCacheKey = () => 'dream-unity-grounded-surface-2';
    return material;
  }
  const ink = living(own(new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .045,
    side: THREE.DoubleSide, roughness: .72, metalness: .16, depthWrite: false })));
  const bronze = own(new THREE.MeshStandardMaterial({ color: 0x796044, metalness: .78, roughness: .31 }));
  const dark = own(new THREE.MeshStandardMaterial({ color: 0x302b25, metalness: .58, roughness: .42 }));
  const gold = own(new THREE.MeshStandardMaterial({ color: 0xc3a16a, metalness: .72, roughness: .24, emissive: 0x715024, emissiveIntensity: .12 }));
  goldMaterial = gold;
  const livingBronze = living(own(bronze.clone()));
  const livingDark = living(own(dark.clone()));
  const solidDepth = living(own(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })));
  const depth = living(own(new THREE.MeshDepthMaterial({ map: texture, alphaTest: .22, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide })));
  const beadGeometry = own(new THREE.SphereGeometry(.034, 10, 8));
  const pinGeometry = own(new THREE.SphereGeometry(.022, 8, 6));

  function rim(parent, radius, tube, material, z = 0, organic = false) {
    const mesh = new THREE.Mesh(own(new THREE.TorusGeometry(radius * S, tube, 6, segments)), material);
    mesh.position.z = z;
    parent.add(mesh);
    mesh.castShadow = true;
    if (organic) mesh.customDepthMaterial = solidDepth;
    return mesh;
  }

  function ring(parent, inner, outer, cx, cy, index, isOuter, edged = true) {
    const group = new THREE.Group();
    const face = new THREE.Mesh(ringGeometry(inner, outer, cx, cy), ink);
    face.castShadow = true;
    face.customDepthMaterial = depth;
    group.add(face);
    if (edged) rim(group, (inner + outer) / 2, outer > 400 ? .018 : .014, livingDark, -.028, true);
    rim(group, outer - 1, outer > 400 ? .011 : .009, livingBronze, -.025, true);
    parent.add(group);
    rings.push({ group, index, isOuter });
    return group;
  }

  // Counter-rotating pairs keep a fixed size, inclination and depth.
  const outerBands = [[415, 452], [452, 484], [484, 516], [516, 604]];
  outerBands.forEach(([inner, outer], index) => {
    const band = ring(mechanism, inner, outer, 627, 627, index, true, outer < 600);
    for (let i = 0; i < 4; i++) {
      const marker = new THREE.Mesh(beadGeometry, gold);
      band.add(marker);
      travellers.push({ mesh: marker, radius: (inner + outer) * .5 * S,
        direction: index % 2 === 0 ? 1 : -1, phase: i * Math.PI / 2 + index * .28 });
    }
  });

  const scaffold = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), own(new THREE.MeshBasicMaterial({
    map: baseTexture, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide,
  })));
  mechanism.add(scaffold);

  // A central spine and travelling pulses connect all three organs.
  for (const y of [-.026, .026]) {
    const bridge = new THREE.Mesh(own(new THREE.CylinderGeometry(.009, .009, 6.55, 8)), bronze);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, y, -.035);
    bridge.castShadow = true;
    mechanism.add(bridge);
    nerves.push({ bridge });
  }
  for (let i = 0; i < 3; i++) {
    const pair = [-1, 1].map(() => {
      const particle = new THREE.Mesh(beadGeometry, gold);
      mechanism.add(particle);
      return particle;
    });
    nerves.push({ pair, phase: i / 3 });
  }

  const specs = [{ cx: 354, cy: 627, inner: 70, outer: 128 },
    { cx: 626, cy: 604, inner: 110, outer: 186 },
    { cx: 899, cy: 627, inner: 70, outer: 128 }];
  specs.forEach((spec, index) => {
    const hub = new THREE.Group();
    hub.position.set((index - 1) * 2.17, 0, 0);
    mechanism.add(hub);
    const split = lerp(spec.inner, spec.outer, .52);
    ring(hub, spec.inner, split, spec.cx, spec.cy, index === 2 ? 1 : 0, false);
    ring(hub, split, spec.outer, spec.cx, spec.cy, index === 2 ? 0 : 1, false);
    const face = new THREE.Group();
    hub.add(face);
    const labelRadius = (index === 1 ? 106 : 68) * S;
    rim(face, labelRadius / S + 1, .024, dark);
    rim(face, labelRadius / S + 5, .008, gold, -.02);
    const back = new THREE.Mesh(own(new THREE.CircleGeometry(labelRadius, segments)), own(new THREE.MeshStandardMaterial({ color: 0xddd1b8, roughness: .93, metalness: .04 })));
    back.position.z = -.012;
    back.castShadow = true;
    face.add(back);
    for (const sign of [-1, 1]) {
      const pin = new THREE.Mesh(pinGeometry, gold);
      pin.position.set(sign * (spec.outer - 5) * S, 0, .025);
      hub.add(pin);
    }
    portals.push({ hub, face, radius: labelRadius, button: buttons[index] });
  });

  // Each circulating mote has an opposite partner, preserving visual balance.
  const dustGeometry = own(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((compact ? 24 : 40) * 3), 3));
  circulationField = new THREE.Points(dustGeometry, own(new THREE.PointsMaterial({ color: 0x9a7440, size: .020, transparent: true, opacity: .42, depthWrite: false })));
  mechanism.add(circulationField);
}

function canRender() {
  return ready && !destroyed && !contextLost && !document.hidden && panel.getAttribute('aria-hidden') !== 'false';
}

function wake() {
  if (!raf && canRender()) { lastTime = 0; raf = requestAnimationFrame(tick); }
}

function tick(time) {
  raf = 0;
  if (!canRender()) return;
  const rawDelta = lastTime ? (time - lastTime) / 1000 : 1 / 60;
  const dt = Math.min(rawDelta, .05);
  lastTime = time;
  // Slow the whole living rhythm together; input smoothing stays responsive.
  if (!paused) elapsed += dt / 12;
  const follow = 1 - Math.exp(-dt * 8);
  rotation.x = lerp(rotation.x, target.x, follow);
  rotation.y = lerp(rotation.y, target.y, follow);
  zoom = lerp(zoom, targetZoom, follow);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  const alive = !paused;
  life = sampleLife(elapsed);
  surfaceUniforms.uLifeTime.value = elapsed;
  surfaceUniforms.uLifeBreath.value = life.breath;
  // Keep the body grounded: no automatic scaling, rocking or depth motion.
  // Only deliberate dragging changes the overall viewing angle.
  mechanism.position.set(0, 0, 0);
  mechanism.scale.setScalar(life.bodyScale);
  mechanism.rotation.set(rotation.x, rotation.y, 0);
  for (const ring of rings) {
    const pose = sampleBand(life, ring.index, ring.isOuter);
    ring.group.rotation.set(pose.x, pose.y, pose.z);
    ring.group.scale.setScalar(pose.scale);
  }
  for (const traveller of travellers) {
    const angle = life.circulation * traveller.direction * 1.65 + traveller.phase;
    const point = deformSurface(Math.cos(angle) * traveller.radius, Math.sin(angle) * traveller.radius, .025, elapsed, life.breath);
    traveller.mesh.position.set(point.x, point.y, point.z);
    traveller.mesh.scale.setScalar(.90);
  }
  goldMaterial.emissiveIntensity = .10 + life.pulse * .13;
  for (const nerve of nerves) {
    if (nerve.bridge) continue;
    const phase = (elapsed / 3.2 + nerve.phase) % 1;
    const distance = phase * 3.55;
    nerve.pair.forEach((particle, index) => {
      const sign = index === 0 ? -1 : 1;
      particle.position.set(sign * distance, 0, .035);
      particle.scale.setScalar(Math.sin(phase * Math.PI) * (.8 + life.pulse * .35));
    });
  }
  const dust = circulationField.geometry.attributes.position;
  for (let i = 0; i < dust.count / 2; i++) {
    const angle = i * 2.399963 + life.circulation * .55;
    const radius = 2.95 + (i % 5) * .28;
    const point = deformSurface(Math.cos(angle) * radius, Math.sin(angle) * radius, 0, elapsed, life.breath);
    dust.setXYZ(i * 2, point.x, point.y, point.z);
    dust.setXYZ(i * 2 + 1, -point.x, -point.y, -point.z);
  }
  dust.needsUpdate = true;
  camera.getWorldQuaternion(cameraQuaternion);
  portals.forEach((portal, index) => {
    const side = index - 1;
    portal.hub.position.set(side * 2.17, 0, 0);
    portal.hub.scale.setScalar(1);
    portal.hub.updateWorldMatrix(true, false);
    portal.hub.getWorldQuaternion(inverseQuaternion).invert();
    portal.face.quaternion.copy(inverseQuaternion).multiply(cameraQuaternion);
  });
  scene.updateMatrixWorld();
  for (const [index, portal] of portals.entries()) {
    portal.face.getWorldPosition(worldPosition);
    portal.face.getWorldScale(worldScale);
    projected.copy(worldPosition).project(camera);
    right.set(portal.radius * worldScale.x, 0, 0).applyQuaternion(cameraQuaternion).add(worldPosition).project(camera);
    const diameter = Math.abs(right.x - projected.x) * width;
    const center = { x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height };
    portalCenters[index] = center;
    portal.button.style.left = `${center.x}px`;
    portal.button.style.top = `${center.y}px`;
    portal.button.style.width = `${diameter}px`;
    portal.button.style.height = `${diameter}px`;
    portal.button.style.setProperty('--disc-size', `${diameter}px`);
    portal.button.style.setProperty('--label-size', `${diameter * (portal === portals[1] ? .151 : .187)}px`);
  }
  renderer.render(scene, camera);
  frameCount++;
  if (!host.classList.contains('is-3d')) {
    host.classList.add('is-3d');
  }
  if (alive && rawDelta > .055) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (slowFrames > 90 && quality !== 'low') {
    quality = 'low';
    renderer.setPixelRatio(.85);
    renderer.shadowMap.enabled = false;
    renderer.setSize(width, height, false);
  }
  if (settling > 0) settling--;
  if (alive || settling > 0 || pointers.size) raf = requestAnimationFrame(tick);
}

function resize() {
  const rect = host.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  camera.left = -5.6 * width / height;
  camera.right = 5.6 * width / height;
  camera.top = 5.6;
  camera.bottom = -5.6;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  settling = 1;
  wake();
}

async function start() {
  try {
    if (!original.complete || !original.naturalWidth) await original.decode();
    if (destroyed) return;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, compact ? 2 : 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = !compact;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'symbol-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-5.6, 5.6, 5.6, -5.6, .1, 60);
    camera.position.set(0, 0, 17);
    mechanism = new THREE.Group();
    scene.add(mechanism);
    scene.add(new THREE.HemisphereLight(0xfff7e4, 0x6d5840, 2.6));
    const light = new THREE.DirectionalLight(0xffedc8, 3.7);
    light.position.set(-2, 3, 18);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 30 });
    light.shadow.bias = -.0005;
    light.shadow.normalBias = .012;
    scene.add(light);
    const rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
    rimLight.position.set(4, -1, 5);
    scene.add(rimLight);
    const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(30, 30)), own(new THREE.ShadowMaterial({ opacity: .065, color: 0x5b432a, depthWrite: false })));
    shadow.position.z = -.85;
    shadow.receiveShadow = true;
    scene.add(shadow);
    build();
    ready = true;
    resize();
    // Render successfully before replacing the static, functional interface.
    cancelAnimationFrame(raf);
    raf = 0;
    tick(performance.now());
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    panelObserver = new MutationObserver(() => {
      if (!canRender()) { cancelAnimationFrame(raf); raf = 0; } else { settling = 1; wake(); }
    });
    panelObserver.observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { settling = 1; wake(); }
    });
    listen(renderer.domElement, 'webglcontextlost', event => {
      event.preventDefault();
      contextLost = true;
      fallback('The still symbol is available while 3D graphics recover. All portals remain available.');
    });
    listen(renderer.domElement, 'webglcontextrestored', () => {
      contextLost = false;
      ready = true;
      settling = 1;
      wake();
      status.textContent = '3D symbol restored.';
    });
    installInteractions();
  } catch (error) {
    fallback('Explore the still symbol. All three portals are available.');
    renderer?.dispose();
    renderer?.domElement.remove();
    for (const resource of disposables) resource.dispose();
    console.info('Dream Unity: using the illustrated symbol fallback.', error.message);
  }
}

function installInteractions() {
  listen(motionPreference, 'change', event => { if (event.matches) pause(true); });
  listen(host, 'pointerdown', event => {
    if (!ready || event.target.closest('button') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    host.setPointerCapture(event.pointerId);
    dragDistance = 0;
    host.classList.add('is-dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
    wake();
  });
  listen(host, 'pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance) targetZoom = clamp(targetZoom * distance / pinchDistance, .78, 1.35);
      pinchDistance = distance;
    } else {
      target.y = clamp(target.y + dx / width * 2.6, -.80, .80);
      target.x = clamp(target.x + dy / height * 2.6, -.65, .65);
    }
    if (paused || motionPreference.matches) {
      rotation.x = target.x; rotation.y = target.y; zoom = targetZoom;
    }
    settling = 45;
    wake();
  });
  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    pinchDistance = 0;
    if (dragDistance > 6) suppressClickUntil = performance.now() + 250;
    if (!pointers.size) host.classList.remove('is-dragging');
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(host, type, release);
  listen(host, 'click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true });
  listen(host, 'wheel', event => {
    if (!ready || panel.open) return;
    event.preventDefault();
    targetZoom = clamp(targetZoom * Math.exp(-event.deltaY * .001), .78, 1.35);
    if (paused || motionPreference.matches) zoom = targetZoom;
    settling = 45;
    wake();
  }, { passive: false });
  listen(window, 'pagehide', event => { if (!event.persisted) destroy(); });
}

start();
