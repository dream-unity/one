import * as THREE from './vendor/three/three.module.min.js';

// The original drawing is the surface of the mechanism, and also its fallback.
const host = document.querySelector('.portal-artwork');
const original = host.querySelector('.portal-image');
const buttons = [...host.querySelectorAll('.portal-card')];
const controls = document.querySelector('.symbol-controls');
const motionButton = document.querySelector('#symbol-motion');
const resetButton = document.querySelector('#symbol-reset');
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
let renderer, scene, camera, mechanism, resizeObserver, panelObserver;
let ready = false, contextLost = false, destroyed = false;
let paused = motionPreference.matches, raf = 0, frameCount = 0, lastTime = 0;
let elapsed = 0, width = 1, height = 1, settling = 0, slowFrames = 0;
let quality = compact ? 'mobile' : 'desktop';
let zoom = 1, targetZoom = 1, hover = -1;
const rotation = { x: -.12, y: -.18 };
const target = { x: -.12, y: -.18 };
const pointer = { x: 0, y: 0 };
const pointers = new Map();
const rings = [], portals = [], travellers = [];
const projected = new THREE.Vector3();
const right = new THREE.Vector3();
const worldPosition = new THREE.Vector3();
const cameraQuaternion = new THREE.Quaternion();
const inverseQuaternion = new THREE.Quaternion();
let pinchDistance = 0, dragDistance = 0, suppressClickUntil = 0;

function updateControls() {
  motionButton.setAttribute('aria-pressed', String(!paused));
  motionButton.setAttribute('aria-label', paused ? 'Play symbol animation' : 'Pause symbol animation');
  motionButton.textContent = paused ? 'Play' : 'Pause';
}

function pause(value) {
  paused = Boolean(value);
  updateControls();
  status.textContent = paused ? 'Symbol animation paused. You can still drag to explore.' : 'Symbol animation playing.';
  settling = 1;
  wake();
}

function reset() {
  target.x = -.12;
  target.y = -.18;
  targetZoom = 1;
  pointer.x = pointer.y = 0;
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
  controls.hidden = true;
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
    quality, contextLost }),
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
  const ink = own(new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .045,
    side: THREE.DoubleSide, roughness: .72, metalness: .16, depthWrite: false }));
  const bronze = own(new THREE.MeshStandardMaterial({ color: 0x796044, metalness: .78, roughness: .31 }));
  const dark = own(new THREE.MeshStandardMaterial({ color: 0x302b25, metalness: .58, roughness: .42 }));
  const gold = own(new THREE.MeshStandardMaterial({ color: 0xc3a16a, metalness: .72, roughness: .24, emissive: 0x715024, emissiveIntensity: .12 }));
  const depth = own(new THREE.MeshDepthMaterial({ map: texture, alphaTest: .22, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }));
  const beadGeometry = own(new THREE.SphereGeometry(.034, 10, 8));
  const pinGeometry = own(new THREE.SphereGeometry(.022, 8, 6));

  function rim(parent, radius, tube, material, z = 0) {
    const mesh = new THREE.Mesh(own(new THREE.TorusGeometry(radius * S, tube, 6, segments)), material);
    mesh.position.z = z;
    parent.add(mesh);
    mesh.castShadow = true;
    return mesh;
  }

  function ring(parent, inner, outer, cx, cy, z, speed, phase, tilt = .2, edged = true) {
    const group = new THREE.Group();
    group.position.z = z;
    const face = new THREE.Mesh(ringGeometry(inner, outer, cx, cy), ink);
    face.castShadow = true;
    face.customDepthMaterial = depth;
    group.add(face);
    if (edged) rim(group, (inner + outer) / 2, outer > 400 ? .018 : .014, dark, -.028);
    const edge = rim(group, outer - 1, outer > 400 ? .011 : .009, bronze, -.025);
    if (!edged) edge.material = bronze;
    parent.add(group);
    rings.push({ group, z, speed, phase, tilt });
    return group;
  }

  // Outer bands separate along the depth axis and precess at different rates.
  const outerBands = [[415, 452, .12, .032, .0, .13], [452, 484, .36, -.045, 1.8, .27],
    [484, 516, .60, .024, 3.7, .19], [516, 604, -.08, -.012, 1.2, .07]];
  for (const [inner, outer, z, speed, phase, tilt] of outerBands) {
    const band = ring(mechanism, inner, outer, 627, 627, z, speed, phase, tilt, outer < 600);
    for (let i = 0; i < (outer < 600 ? 3 : 2); i++) {
      const marker = new THREE.Mesh(beadGeometry, gold);
      band.add(marker);
      travellers.push({ mesh: marker, radius: (inner + outer) * .5 * S, speed: speed * 6, phase: i * Math.PI * 2 / 3 + phase });
    }
  }

  const scaffold = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 10)), own(new THREE.MeshBasicMaterial({
    map: baseTexture, transparent: true, opacity: .48, depthWrite: false, side: THREE.DoubleSide,
  })));
  scaffold.position.z = -.24;
  mechanism.add(scaffold);

  // Physical bridges tie the three portal hubs together.
  for (const y of [-.026, .026]) {
    const bridge = new THREE.Mesh(own(new THREE.CylinderGeometry(.012, .012, 6.55, 8)), bronze);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, y, .28);
    bridge.castShadow = true;
    mechanism.add(bridge);
  }

  const specs = [{ cx: 354, cy: 627, inner: 70, outer: 128, z: .5 },
    { cx: 626, cy: 604, inner: 110, outer: 186, z: .72 },
    { cx: 899, cy: 627, inner: 70, outer: 128, z: .5 }];
  specs.forEach((spec, index) => {
    const hub = new THREE.Group();
    hub.position.set((spec.cx - 627) * S, (627 - spec.cy) * S, spec.z);
    mechanism.add(hub);
    const split = lerp(spec.inner, spec.outer, .52);
    ring(hub, spec.inner, split, spec.cx, spec.cy, .02, index === 1 ? -.12 : .16, index * 2, .12);
    ring(hub, split, spec.outer, spec.cx, spec.cy, .16, index === 1 ? .10 : -.11, index * 2 + 1, .24);
    const face = new THREE.Group();
    face.position.set(0, index === 1 ? -23 * S : 0, .20);
    hub.add(face);
    const labelRadius = (index === 1 ? 106 : 68) * S;
    rim(face, labelRadius / S + 1, .024, dark);
    rim(face, labelRadius / S + 5, .008, gold, -.02);
    const back = new THREE.Mesh(own(new THREE.CircleGeometry(labelRadius, segments)), own(new THREE.MeshStandardMaterial({ color: 0xddd1b8, roughness: .93, metalness: .04 })));
    back.position.z = -.012;
    back.castShadow = true;
    face.add(back);
    // Small pivot screws reveal the three-dimensional construction in motion.
    for (const sign of [-1, 1]) {
      const pin = new THREE.Mesh(pinGeometry, gold);
      pin.position.set(sign * (spec.outer - 5) * S, 0, .25);
      hub.add(pin);
    }
    portals.push({ hub, face, radius: labelRadius, baseZ: spec.z, button: buttons[index] });
  });

  // A sparse, deterministic field of warm dust gives the empty space depth.
  const dustPositions = [];
  for (let i = 0; i < (compact ? 35 : 65); i++) {
    const a = i * 2.399963;
    const r = 2.9 + ((i * 37) % 101) / 101 * 2.1;
    dustPositions.push(Math.cos(a) * r, Math.sin(a) * r, Math.sin(i * 8.2) * .9);
  }
  const dustGeometry = own(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, own(new THREE.PointsMaterial({ color: 0x9a7440, size: .018, transparent: true, opacity: .40, depthWrite: false })));
  mechanism.add(dust);
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
  if (!paused) elapsed += dt;
  const follow = 1 - Math.exp(-dt * 8);
  rotation.x = lerp(rotation.x, target.x, follow);
  rotation.y = lerp(rotation.y, target.y, follow);
  zoom = lerp(zoom, targetZoom, follow);
  camera.position.z = 17 / zoom;
  const alive = !paused;
  mechanism.rotation.set(rotation.x + Math.sin(elapsed * .25) * .035 + pointer.y * .035,
    rotation.y + Math.sin(elapsed * .19) * .075 + pointer.x * .05, Math.sin(elapsed * .12) * .012);
  for (const ring of rings) {
    ring.group.rotation.set(Math.sin(elapsed * .32 + ring.phase) * ring.tilt,
      Math.cos(elapsed * .26 + ring.phase) * ring.tilt * .72, elapsed * ring.speed);
    ring.group.position.z = ring.z + Math.sin(elapsed * .5 + ring.phase) * .055;
  }
  for (const traveller of travellers) {
    const angle = elapsed * traveller.speed + traveller.phase;
    traveller.mesh.position.set(Math.cos(angle) * traveller.radius, Math.sin(angle) * traveller.radius, .05);
  }
  camera.getWorldQuaternion(cameraQuaternion);
  portals.forEach((portal, index) => {
    const lift = hover === index ? .28 : 0;
    portal.hub.position.z = lerp(portal.hub.position.z, portal.baseZ + lift + Math.sin(elapsed * .62 + index * 1.4) * .06, follow);
    portal.hub.updateWorldMatrix(true, false);
    portal.hub.getWorldQuaternion(inverseQuaternion).invert();
    portal.face.quaternion.copy(inverseQuaternion).multiply(cameraQuaternion);
  });
  scene.updateMatrixWorld();
  for (const portal of portals) {
    portal.face.getWorldPosition(worldPosition);
    projected.copy(worldPosition).project(camera);
    right.set(portal.radius, 0, 0).applyQuaternion(cameraQuaternion).add(worldPosition).project(camera);
    const diameter = Math.abs(right.x - projected.x) * width;
    portal.button.style.left = `${(projected.x * .5 + .5) * width}px`;
    portal.button.style.top = `${(-projected.y * .5 + .5) * height}px`;
    portal.button.style.width = `${diameter}px`;
    portal.button.style.height = `${diameter}px`;
    portal.button.style.setProperty('--disc-size', `${diameter}px`);
    portal.button.style.setProperty('--label-size', `${diameter * (portal === portals[1] ? .151 : .187)}px`);
  }
  renderer.render(scene, camera);
  frameCount++;
  if (!host.classList.contains('is-3d')) {
    host.classList.add('is-3d');
    controls.hidden = false;
    updateControls();
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
  camera.aspect = width / height;
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
    camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
    camera.position.set(0, 0, 17);
    mechanism = new THREE.Group();
    scene.add(mechanism);
    scene.add(new THREE.HemisphereLight(0xfff7e4, 0x6d5840, 2.6));
    const light = new THREE.DirectionalLight(0xffedc8, 3.7);
    light.position.set(-3, 5, 9);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 30 });
    light.shadow.bias = -.0005;
    light.shadow.normalBias = .012;
    scene.add(light);
    const rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
    rimLight.position.set(4, -1, 5);
    scene.add(rimLight);
    const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(30, 30)), own(new THREE.ShadowMaterial({ opacity: .12, color: 0x5b432a })));
    shadow.position.z = -1.05;
    shadow.receiveShadow = true;
    scene.add(shadow);
    build();
    ready = true;
    resize();
    // Render successfully before replacing the static, functional interface.
    cancelAnimationFrame(raf);
    raf = 0;
    tick(performance.now());
    updateControls();
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
  listen(motionButton, 'click', () => pause(!paused));
  listen(resetButton, 'click', reset);
  listen(motionPreference, 'change', event => { if (event.matches) pause(true); });
  buttons.forEach((button, index) => {
    for (const event of ['pointerenter', 'focus']) listen(button, event, () => { hover = index; settling = 30; wake(); });
    for (const event of ['pointerleave', 'blur']) listen(button, event, () => { if (hover === index) hover = -1; settling = 30; wake(); });
  });
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
    if (!previous) {
      if (!paused && event.pointerType === 'mouse') {
        const bounds = host.getBoundingClientRect();
        pointer.x = clamp((event.clientX - bounds.left) / bounds.width - .5, -.5, .5);
        pointer.y = clamp((event.clientY - bounds.top) / bounds.height - .5, -.5, .5);
      }
      return;
    }
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
