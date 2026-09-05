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

test("the front page exposes the complete Dream Unity interface", async () => {
  const html = await read("index.html");
  for (const required of [
    "DREAM UNITY",
    "THE NEXUS OF ALL POSSIBILITIES",
    "FIELD CALIBRATION",
    "SYSTEM HARMONY",
    "runtime/loader.js"
  ]) {
    assert.match(html, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal((html.match(/data-world=/g) || []).length, 3, "all three portals must be directly selectable");
  assert.match(html, /class="visual-scaffold"/, "the resilient visual depth scaffold is missing");
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

test("the Dream Unity title remains legible above the central crystal", async () => {
  const css = await read("styles.css");
  assert.match(css, /top:\s*clamp\(58px,\s*9vh,\s*84px\)/, "desktop title anchor moved away from the upper field");
  assert.match(css, /top:\s*clamp\(56px,\s*8\.5vh,\s*72px\)/, "mobile title anchor moved away from the upper field");
  assert.doesNotMatch(css, /top:\s*55\.2%|top:\s*54%/, "the title fell back over the crystal");
  assert.match(css, /\.intro::before[\s\S]*?radial-gradient/, "the title lost its readability veil");
});

test("the known-good scene and deployed renderer are protected byte for byte", async () => {
  assert.equal(
    await sha256("src/scene.js"),
    "ad007d172071c5d075c180ac53c44c8c2e0f1e4047d08941c92b4dc0cd7d6332",
    "the approved 3D scene must remain unchanged during the readability update"
  );
  assert.equal(
    JSON.parse(await read("runtime/chunks/manifest.json")).revision,
    "2c7a596e4dcc54a48a1bea3a8f232669859ae7e6a4e0100d28346f3491de4a91",
    "the approved deployed visualization runtime must remain unchanged during the readability update"
  );
});

test("home portal positions and shapes stay unchanged while their text can grow", async () => {
  const css = (await read("styles.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  // Geometry recorded from HEAD before the authorized readability changes.
  // Preserve both the desktop rules and their later narrow-screen overrides.
  const expected = {
    ".experience": [
      { position: "relative", width: "100%", height: "100%", "min-height": "520px" },
      { "min-height": "450px" }
    ],
    ".scene, .scene > canvas, .scene > div": [
      { position: "absolute", inset: "0", width: "100%", height: "100%" }
    ],
    ".visual-scaffold": [{ position: "absolute", "z-index": "0", inset: "0" }],
    ".intro": [
      { position: "absolute", "z-index": "14", top: "clamp(58px, 9vh, 84px)", left: "50%", width: "min(290px, 46vw)", transform: "translate(-50%, -50%)" },
      { top: "clamp(56px, 8.5vh, 72px)", width: "190px" }
    ],
    ".portal-label.machine": [{ top: "24.5%", left: "2.1%" }, { top: "25%", left: "8px" }],
    ".portal-label.maker": [{ top: "24.5%", right: "2.1%" }, { top: "25%", right: "8px" }],
    ".portal-label.world": [{ bottom: "7.5%", left: "50%", transform: "translateX(-50%)" }, { bottom: "8.5%" }],
    ".portal-card": [
      { position: "relative", width: "clamp(270px, 26vw, 408px)", height: "clamp(68px, 6.8vw, 98px)", padding: "0 clamp(21px, 2vw, 33px)" },
      { width: "190px", height: "68px", "padding-inline": "19px" }
    ],
    ".portal-label.machine .portal-card": [
      { "clip-path": "polygon(13px 0, 100% 0, 100% 100%, 13px 100%, 0 50%)" },
      { "padding-right": "16px" }
    ],
    ".portal-label.maker .portal-card": [
      { "clip-path": "polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%)" },
      { "padding-left": "16px" }
    ],
    ".portal-label.world .portal-card": [
      { width: "clamp(205px, 18vw, 286px)", height: "clamp(59px, 5.7vw, 82px)", "clip-path": "polygon(13px 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 13px 100%, 0 50%)" },
      { width: "190px", height: "60px" }
    ],
    ".portal-card, .portal-label.world .portal-card": [
      { width: "139px", height: "49px", padding: "0 13px" }
    ]
  };
  const properties = new Set([
    "position", "inset", "top", "right", "bottom", "left", "width", "height", "min-height",
    "padding", "padding-inline", "padding-left", "padding-right", "transform", "clip-path", "z-index"
  ]);
  const actual = Object.fromEntries(Object.keys(expected).map((selector) => [selector, []]));
  for (const [, selectorText, declarationText] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = selectorText.trim().replace(/\s+/g, " ");
    if (!Object.hasOwn(expected, selector)) continue;
    const declarations = {};
    for (const declaration of declarationText.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim();
      if (properties.has(property)) declarations[property] = declaration.slice(colon + 1).trim();
    }
    actual[selector].push(declarations);
  }
  assert.deepEqual(actual, expected, "the front page geometry changed outside the authorized text resizing");
});

test("the page cannot remain trapped behind its loading screen", async () => {
  const [html, main, loader] = await Promise.all([
    read("index.html"),
    read("src/main.js"),
    read("runtime/loader.js")
  ]);
  assert.match(html, /__DREAM_UNITY_WATCHDOG__/);
  assert.match(html, /setTimeout\(revealStaticExperience, 6000\)/);
  assert.match(html, /defer src="\.\/runtime\/loader\.js\?v=heart-research-20260905-2"/);
  assert.match(main, /clearTimeout\(window\.__DREAM_UNITY_WATCHDOG__\)/);
  assert.doesNotMatch(html, /<script[^>]+src="\.\/runtime\/dream-unity\.min\.js"/);
  assert.match(loader, /fetch\(manifestUrl, \{ cache: "no-store" \}\)/);
  assert.match(loader, /chunkUrl\.searchParams\.set\("v", manifest\.revision\)/);
  assert.match(loader, /globalThis\.crypto\.subtle\.digest\("SHA-256", runtimeBytes\)/);
  assert.match(loader, /fetchChunks\(manifest, "reload"\)/);
  assert.match(loader, /buffer\.byteLength !== chunk\.bytes/);
  assert.match(loader, /totalBytes !== manifest\.totalBytes/);
});

test("Dream Maker Eye overrides only the music event without rebuilding the visualization", async () => {
  const [html, main, controller] = await Promise.all([
    read("index.html"),
    read("src/main.js"),
    read("audio-controller.js")
  ]);
  const audioScript = html.indexOf("audio-controller.js?v=audio-crossbrowser-b23033e55592-v3");
  const runtimeScript = html.indexOf("runtime/loader.js?v=heart-research-20260905-2");
  assert.ok(audioScript > -1, "the independent audio controller is not loaded");
  assert.ok(audioScript < runtimeScript, "the audio controller should initialize independently of the 3D runtime");
  assert.match(html, /id="sound-toggle"[^>]*aria-pressed="false"[^>]*data-audio-state="starting"[^>]*data-audio-intent="on"/,
    "the server-rendered control must distinguish autoplay intent from actual playback");
  assert.match(html, /<span>MUSIC<\/span>\s*<strong>AUTO<\/strong>/,
    "the control must not claim playback before play() succeeds");
  assert.match(html, /<audio[\s\S]*?id="dream-unity-soundtrack"[\s\S]*?autoplay[\s\S]*?loop[\s\S]*?<source[^>]+type="audio\/mpeg"/,
    "the browser-native autoplay and loop path is missing");
  assert.doesNotMatch(html, /<script type="module" src="\.\/audio-controller\.js/,
    "the audio controller must remain executable in browsers without modules");
  assert.match(main, /UnityAudio/, "the known-good runtime fallback unexpectedly changed");
  assert.match(controller, /stopImmediatePropagation\(\)/, "the replacement must isolate the original button handler");
  assert.match(controller, /self\.toggle\(true\);\s*\}, true\);/, "the replacement must win before the restored bubble handler");
  assert.match(controller, /defaultOn: true/);
  assert.match(controller, /controller\.autoplay\(\)/);
  assert.match(controller, /addEventListener\("playing"/, "ON must be driven by real media playback");
  assert.match(controller, /addEventListener\("pause"/, "external browser pauses must invalidate ON");
  assert.doesNotMatch(controller, /\b(?:const|let|class|async|await|export|import)\b|=>|\?\?|\?\./,
    "the cross-browser controller contains syntax that legacy engines cannot parse");
  assert.match(controller, /assets\/audio\/dream-maker-eye\.mp3\?v=b23033e55592/);
  assert.equal(
    await sha256("assets/audio/dream-maker-eye.mp3"),
    "b23033e55592bdb62cb9a51f529aebf63401453d15fe6b45e06a9fae298e0d14",
    "the replacement track differs from the supplied file"
  );
  assert.equal(
    (await stat(new URL("../assets/audio/dream-maker-eye.mp3", import.meta.url))).size,
    8_281_268,
    "the replacement track is truncated"
  );
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
