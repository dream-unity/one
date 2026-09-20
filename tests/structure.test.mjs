import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = async (path) => createHash("sha256")
  .update(await readFile(new URL(`../${path}`, import.meta.url)))
  .digest("hex");
const digest = (content) => createHash("sha256").update(content).digest("hex");

await import("../audio-controller.js");
const DreamUnityAudioController = globalThis.DreamUnityAudioController;

const readSegmentedRuntime = async () => {
  const manifest = JSON.parse(await read("runtime/chunks/manifest.json"));
  const parts = await Promise.all(manifest.chunks.map((chunk) =>
    readFile(new URL(`../runtime/chunks/${chunk.file}`, import.meta.url))
  ));
  return { manifest, runtime: Buffer.concat(parts) };
};

test("the front page exposes Dream World and labels the two restricted portals", async () => {
  const html = await read("index.html");
  const world = html.match(/<a\b[^>]*data-world="world"[^>]*>/)?.[0];
  assert.ok(world, "Dream World must remain a native link without requiring JavaScript");
  assert.match(world, /href="\.\/dream-world\/"/);
  assert.match(world, /aria-label="Open Dream World"/);
  assert.doesNotMatch(world, /\b(?:disabled|aria-disabled|aria-expanded|aria-controls|target)=/);
  for (const world of ["machine", "maker"]) {
    assert.match(html, new RegExp(`<button[^>]+data-world="${world}"[^>]+aria-label="Dream [^"]+access restricted"[^>]+disabled[^>]+aria-disabled="true"`));
  }
  assert.equal((html.match(/data-world=/g) || []).length, 3);
  assert.match(html, /<dialog[^>]+id="world-panel"[^>]+aria-labelledby="world-title"/);
  assert.match(html, /<h1 class="portal-title">Dream Unity<\/h1>/);
  assert.match(html, /portal-subnav\.js\?v=portal-access-/);
});

test("all three worlds retain their intended causal stages", async () => {
  const [scene, main] = await Promise.all([read("src/scene.js"), read("src/main.js")]);
  const source = `${scene}\n${main}`;
  for (const stage of [
    "DREAM MACHINE", "PERCEIVE", "MODEL", "PREDICT",
    "DREAM MAKER", "INTEND", "ACT", "BECOME",
    "DREAM WORLD", "MATTER", "STRUCTURE", "EMERGE"
  ]) assert.match(source, new RegExp(stage));
});

test("the deployed experience has no runtime CDN or font dependency", async () => {
  const [html, main, scene] = await Promise.all([read("index.html"), read("src/main.js"), read("src/scene.js")]);
  const css = await read("styles.css");
  assert.doesNotMatch(`${html}\n${main}\n${scene}\n${css}`, /cdn\.jsdelivr|unpkg\.com|esm\.sh|fonts\.googleapis/);
});



test("the retained 3D scene and renderer stay unchanged by the interface replacement", async () => {
  assert.equal(
    await sha256("src/scene.js"),
    "4c28ac6109bb75c3f7531d423529c1b2ff62a37dc76779f14c58c0702e7e39c9",
    "the approved 3D scene with its parchment background must remain intact"
  );
  assert.equal(
    JSON.parse(await read("runtime/chunks/manifest.json")).revision,
    "42a58ede068deaa8f64c352e1d6f82fd2deeda96f4839ce644a083df087e8d43",
    "the deployed visualization must match the approved parchment-background runtime"
  );
});

test("the front page reuses the original Breath Journal artwork and parchment", async () => {
  assert.equal(await sha256("assets/dream-unity-portals-refined.webp"),
    "2d398bb08d89aba766ce7fadb6d3547470ec1ae83feaaa16cb094c08d1dbc1af");
  assert.equal(await sha256("assets/parchment-texture.svg"),
    "0863a04273a9c7a1f167c0c5934b64ed8fc73b922d39dabeb771f744166aea09");
  assert.match(await read("index.html"), /class="portal-image"[^>]+src="\.\/assets\/dream-unity-portals-refined\.webp"/);
});

test("the circular home page does not start the previous 3D scene or its overlays", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /runtime\/loader\.js|audio-controller\.js|portal-depth\.js|id="(?:scene|boot|sound-toggle|information)"|FIELD CALIBRATION|SYSTEM HARMONY/);
  assert.match(html, /type="module" src="\.\/symbol-3d\.js/);
  assert.match(html, /<img[^>]+class="portal-image"/);
  assert.doesNotMatch(html, /href="\.\/portals\//);
});

test("the retained audio controller and original soundtrack stay intact", async () => {
  const controller = await read("audio-controller.js");
  assert.match(controller, /stopImmediatePropagation\(\)/);
  assert.match(controller, /addEventListener\("playing"/);
  assert.match(controller, /addEventListener\("pause"/);
  assert.doesNotMatch(controller, /\b(?:const|let|class|async|await|export|import)\b|=>|\?\?|\?\./);
  assert.equal(await sha256("assets/audio/dream-maker-eye.mp3"),
    "b23033e55592bdb62cb9a51f529aebf63401453d15fe6b45e06a9fae298e0d14");
  assert.equal((await stat(new URL("../assets/audio/dream-maker-eye.mp3", import.meta.url))).size, 8_281_268);
});

class FakeButton {
  constructor() {
    this.attributes = new Map();
    this.disabled = false;
    this.label = { textContent: "OFF" };
    this.listeners = new Map();
    this.listenerOptions = new Map();
  }

  addEventListener(type, listener, options) {
    this.listeners.set(type, listener);
    this.listenerOptions.set(type, options);
  }

  querySelector(selector) {
    return selector === "strong" ? this.label : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  contains(target) {
    return target === this;
  }

  dispatch(type, event = {}) {
    this.listeners.get(type)?.({ ...event, type });
  }
}

class FakeActivationTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    [...(this.listeners.get(type) || [])].forEach((listener) => listener({ ...event, type }));
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }
}

const makeAudio = (play) => ({
  autoplay: false,
  loop: false,
  preload: "none",
  playsInline: false,
  defaultMuted: true,
  muted: true,
  volume: 1,
  src: "",
  currentSrc: "",
  currentTime: 0,
  paused: true,
  ended: false,
  readyState: 4,
  pauseCalls: 0,
  loadCalls: 0,
  playCalls: 0,
  attributes: new Map(),
  listeners: new Map(),
  playImpl: play,
  play() {
    this.playCalls += 1;
    return this.playImpl.call(this);
  },
  pause() {
    this.pauseCalls += 1;
    const changed = !this.paused;
    this.paused = true;
    if (changed) this.emit("pause");
  },
  load() { this.loadCalls += 1; },
  setAttribute(name, value) { this.attributes.set(name, value); },
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  },
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "src") this.src = "";
  },
  emit(type) {
    if (type === "playing") {
      this.paused = false;
      this.ended = false;
    }
    if (type === "pause") this.paused = true;
    if (type === "ended") {
      this.paused = true;
      this.ended = true;
    }
    [...(this.listeners.get(type) || [])].forEach((listener) => listener({ type, target: this }));
  }
});

test("default-on autoplay starts immediately but ON waits for actual playback", async () => {
  const button = new FakeButton();
  let resolvePlayback;
  let created = 0;
  const player = makeAudio(() => new Promise((resolve) => { resolvePlayback = resolve; }));
  const controller = new DreamUnityAudioController(button, {
    defaultOn: true,
    createAudio: () => { created += 1; return player; },
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  assert.equal(created, 0, "media creation should begin through the explicit autoplay lifecycle");
  assert.equal(controller.state, "starting");
  assert.equal(button.label.textContent, "AUTO");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.getAttribute("data-audio-intent"), "on");
  assert.equal(button.listenerOptions.get("click"), true, "the override must run before the restored handler");
  controller.autoplay();
  assert.equal(created, 1);
  assert.equal(controller.state, "starting");
  assert.equal(button.getAttribute("aria-busy"), "true");
  assert.equal(player.loop, true);
  assert.equal(player.preload, "auto");
  assert.equal(player.volume, 0.3);
  assert.equal(player.muted, false);

  resolvePlayback();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state, "starting", "a resolved play promise must not fabricate audible playback");
  assert.equal(button.label.textContent, "AUTO");

  player.emit("playing");
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");

  controller.stop();
  assert.equal(controller.state, "off");
  assert.ok(player.pauseCalls >= 1);
});

test("older engines that return no play promise wait for the playing event", () => {
  const button = new FakeButton();
  const player = makeAudio(() => undefined);
  const controller = new DreamUnityAudioController(button, {
    defaultOn: true,
    player,
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  assert.equal(controller.autoplay(), true);
  assert.equal(controller.state, "starting");
  assert.equal(button.label.textContent, "AUTO");
  assert.equal(button.getAttribute("aria-pressed"), "false");

  player.emit("playing");
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(player.loop, true);
  assert.equal(player.muted, false);

  assert.equal(controller.toggle(true), false);
  assert.equal(controller.state, "off");
});

test("a resolved promise without playback can never leave a false ON state", async () => {
  const button = new FakeButton();
  let playbackTimeout;
  const player = makeAudio(() => Promise.resolve());
  const controller = new DreamUnityAudioController(button, {
    defaultOn: true,
    player,
    setTimer: (callback) => { playbackTimeout = callback; return 1; },
    clearTimer: () => {},
    warn: () => {}
  });

  controller.autoplay();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state, "starting");
  assert.equal(button.label.textContent, "AUTO");

  playbackTimeout();
  assert.equal(controller.state, "blocked");
  assert.equal(button.label.textContent, "PLAY");
  assert.equal(button.getAttribute("aria-pressed"), "false");

  player.playImpl = function () {
    this.emit("playing");
    return undefined;
  };
  button.dispatch("click", {
    isTrusted: true,
    target: button,
    stopImmediatePropagation() {}
  });
  assert.equal(controller.state, "on", "one button press must start the previously silent player");
});

test("blocked autoplay is reported honestly and the music button starts it in one press", async () => {
  const button = new FakeButton();
  const activationTarget = new FakeActivationTarget();
  const blocked = Object.assign(new Error("play() failed because autoplay is not allowed"), {
    name: "NotAllowedError"
  });
  let attempts = 0;
  const player = makeAudio(() => {
    attempts += 1;
    return attempts === 1 ? Promise.reject(blocked) : Promise.resolve();
  });
  const controller = new DreamUnityAudioController(button, {
    defaultOn: true,
    activationTarget,
    createAudio: () => player,
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  controller.autoplay();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state, "blocked");
  assert.equal(button.label.textContent, "PLAY");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.getAttribute("data-audio-intent"), "on");

  let stopped = false;
  button.dispatch("click", {
    isTrusted: true,
    target: button,
    stopImmediatePropagation() { stopped = true; }
  });
  assert.equal(stopped, true, "the restored procedural handler must remain isolated");
  assert.equal(attempts, 2, "one music-button press must retry playback immediately");
  assert.equal(controller.state, "starting");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state, "starting", "promise resolution alone must not display ON");
  player.emit("playing");
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");
  assert.equal(button.getAttribute("aria-pressed"), "true");

  assert.equal(controller.toggle(true), false);
  assert.equal(controller.state, "off");
});

test("the first genuine interaction recovers even while autoplay is still pending", async () => {
  const button = new FakeButton();
  const activationTarget = new FakeActivationTarget();
  let resolveInitialAttempt;
  let resolveEarlyGesture;
  let attempts = 0;
  const player = makeAudio(function () {
    attempts += 1;
    if (attempts === 1) {
      return new Promise((resolve) => { resolveInitialAttempt = resolve; });
    }
    if (attempts === 2) {
      return new Promise((resolve) => { resolveEarlyGesture = resolve; });
    }
    this.emit("playing");
    return undefined;
  });
  const controller = new DreamUnityAudioController(button, {
    defaultOn: true,
    activationTarget,
    createAudio: () => player,
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  controller.autoplay();
  assert.equal(controller.state, "starting");
  assert.equal(button.label.textContent, "AUTO");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.ok(activationTarget.listenerCount() > 0, "recovery must be armed before rejection or timeout");

  activationTarget.dispatch("pointerdown", { isTrusted: false, target: {} });
  assert.equal(attempts, 1, "synthetic activity must not trigger playback");
  activationTarget.dispatch("pointerdown", { isTrusted: true, target: {} });
  assert.equal(attempts, 2, "the first real interaction must retry synchronously");
  assert.equal(controller.state, "starting");
  assert.ok(activationTarget.listenerCount() > 0, "later events from the same gesture must remain available");
  activationTarget.dispatch("pointerup", { isTrusted: true, target: {} });
  assert.equal(attempts, 3, "an engine-specific later gesture event must be able to retry");
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");
  assert.equal(activationTarget.listenerCount(), 0, "recovery listeners should be removed after playback starts");

  resolveInitialAttempt();
  resolveEarlyGesture();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state, "on", "the stale autoplay promise must not overwrite the real state");

  assert.equal(controller.toggle(true), false);
  assert.equal(controller.state, "off");
  assert.equal(button.label.textContent, "OFF");
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("browser suspension clears false ON and pageshow restores playback", () => {
  const button = new FakeButton();
  const activationTarget = new FakeActivationTarget();
  const pageTarget = new FakeActivationTarget();
  const visibilityTarget = new FakeActivationTarget();
  visibilityTarget.visibilityState = "visible";
  const player = makeAudio(function () {
    this.emit("playing");
    return undefined;
  });
  const controller = new DreamUnityAudioController(button, {
    defaultOn: true,
    player,
    activationTarget,
    pageTarget,
    visibilityTarget,
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  controller.autoplay();
  assert.equal(controller.state, "on");

  player.emit("pause");
  assert.equal(controller.state, "blocked");
  assert.equal(button.label.textContent, "PLAY");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.ok(activationTarget.listenerCount() > 0);

  pageTarget.dispatch("pageshow", { persisted: true, isTrusted: true });
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");
  assert.equal(button.getAttribute("aria-pressed"), "true");
});

test("a rejected playback attempt remains retryable and recovers cleanly", async () => {
  const button = new FakeButton();
  const players = [
    makeAudio(() => Promise.reject(new Error("simulated media failure"))),
    makeAudio(function () {
      this.emit("playing");
      return undefined;
    })
  ];
  let created = 0;
  const controller = new DreamUnityAudioController(button, {
    createAudio: () => players[created++],
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  assert.equal(controller.toggle(true), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state, "retry");
  assert.equal(button.label.textContent, "RETRY");
  assert.equal(button.disabled, false, "a media error must never permanently disable the control");

  assert.equal(controller.toggle(true), true);
  assert.equal(created, 2, "retry should use a clean media element");
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");
  assert.equal(button.getAttribute("aria-pressed"), "true");

  assert.equal(controller.toggle(true), false);
  assert.equal(controller.state, "off");
  assert.equal(button.label.textContent, "OFF");
});

test("the vendored Three.js runtime and license remain available", async () => {
  const requiredFiles = [
    "vendor/three/three.module.min.js",
    "vendor/three/three.core.min.js",
    "vendor/three/LICENSE"
  ];
  for (const file of requiredFiles) assert.ok((await stat(new URL(`../${file}`, import.meta.url))).size > 0, `${file} is empty`);
});

test("the live renderer honors the performance architecture", async () => {
  const scene = await read("src/scene.js");
  assert.match(scene, /new THREE\.WebGLRenderer/);
  assert.match(scene, /powerPreference: "high-performance"/);
  assert.match(scene, /renderer\.render\(this\.scene, this\.camera\)/);
  assert.match(scene, /pixelRatio: constrained \? 1 : 1\.35/);
  assert.match(scene, /animateOrbitParticles = false/);
  assert.doesNotMatch(scene, /EffectComposer|UnrealBloomPass|PMREMGenerator|MeshPhysicalMaterial|transmission|dispersion/);
});

test("the Unity crystal preserves a sharp tessellated octahedron", async () => {
  const { createCrystalGeometry } = await import("../src/scene.js");
  const geometry = createCrystalGeometry(1, 4);
  const positions = geometry.getAttribute("position");
  assert.equal(positions.count, 384, "the balanced crystal should contain 128 planar facets");
  for (let index = 0; index < positions.count; index += 1) {
    const l1Radius = Math.abs(positions.getX(index)) + Math.abs(positions.getY(index)) + Math.abs(positions.getZ(index));
    assert.ok(Math.abs(l1Radius - 1) < 1e-6, "a crystal vertex was rounded away from the octahedral surface");
  }
  geometry.dispose();
});

test("the deployable browser bundle is self-contained", async () => {
  const { runtime } = await readSegmentedRuntime();
  const source = runtime.toString("utf8");
  assert.ok(runtime.byteLength > 400_000, "runtime bundle is unexpectedly small");
  assert.ok(runtime.byteLength < 650_000, "runtime bundle exceeds the performance budget");
  assert.doesNotMatch(source, /from\s*["']three|import\s*\(/);
});

test("the segmented runtime reconstructs and authenticates the exact production bundle", async () => {
  const { manifest, runtime } = await readSegmentedRuntime();
  assert.match(manifest.revision, /^[a-f0-9]{64}$/, "runtime revision must be a SHA-256 digest");
  assert.ok(manifest.chunks.length >= 2, "runtime must be segmented for resilient delivery");
  await Promise.all(manifest.chunks.map(async (chunk) => {
    assert.ok(chunk.bytes <= 64 * 1024, `${chunk.file} exceeds the delivery ceiling`);
    const content = await readFile(new URL(`../runtime/chunks/${chunk.file}`, import.meta.url));
    assert.equal(content.byteLength, chunk.bytes, `${chunk.file} size differs from its manifest`);
  }));
  assert.equal(runtime.byteLength, manifest.totalBytes);
  assert.equal(digest(runtime), manifest.revision, "the deployed runtime chunks failed their SHA-256 check");
});
