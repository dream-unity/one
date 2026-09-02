import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = async (path) => createHash("sha256")
  .update(await readFile(new URL(`../${path}`, import.meta.url)))
  .digest("hex");
const digest = (content) => createHash("sha256").update(content).digest("hex");

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

test("the known-good visual implementation is protected byte for byte", async () => {
  assert.equal(
    await sha256("src/scene.js"),
    "ad007d172071c5d075c180ac53c44c8c2e0f1e4047d08941c92b4dc0cd7d6332",
    "the 3D scene changed during an audio-only request"
  );
  assert.equal(
    await sha256("styles.css"),
    "ced29cd9e0fef6db38ca9e0bf27f0513b00e12abaed946cf140bce781e22a0cf",
    "the visual layout changed during an audio-only request"
  );
  assert.equal(
    JSON.parse(await read("runtime/chunks/manifest.json")).revision,
    "2c7a596e4dcc54a48a1bea3a8f232669859ae7e6a4e0100d28346f3491de4a91",
    "the known-good deployed visualization runtime changed during an audio-only request"
  );
});

test("the page cannot remain trapped behind its loading screen", async () => {
  const [html, main, loader] = await Promise.all([
    read("index.html"),
    read("src/main.js"),
    read("runtime/loader.js")
  ]);
  assert.match(html, /__DREAM_UNITY_WATCHDOG__/);
  assert.match(html, /setTimeout\(revealStaticExperience, 6000\)/);
  assert.match(html, /defer src="\.\/runtime\/loader\.js\?v=restore-aaa4d584"/);
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
  const audioScript = html.indexOf("audio-controller.js?v=audio-b23033e55592");
  const runtimeScript = html.indexOf("runtime/loader.js?v=restore-aaa4d584");
  assert.ok(audioScript > -1, "the independent audio controller is not loaded");
  assert.ok(audioScript < runtimeScript, "the audio controller should initialize independently of the 3D runtime");
  assert.match(main, /UnityAudio/, "the known-good runtime fallback unexpectedly changed");
  assert.match(controller, /stopImmediatePropagation\(\)/, "the replacement must isolate the original button handler");
  assert.match(controller, /\{ capture: true \}/, "the replacement must win before the restored bubble handler");
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
    this.dataset = {};
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
}

const makeAudio = (play) => ({
  loop: false,
  preload: "auto",
  playsInline: false,
  volume: 1,
  src: "",
  pauseCalls: 0,
  loadCalls: 0,
  listeners: new Map(),
  play,
  pause() { this.pauseCalls += 1; },
  load() { this.loadCalls += 1; },
  addEventListener(type, listener) { this.listeners.set(type, listener); },
  removeAttribute(name) { if (name === "src") this.src = ""; }
});

test("the music control loads lazily, reports progress, and can cancel stale playback", async () => {
  const { DreamUnityAudioController } = await import("../audio-controller.js");
  const button = new FakeButton();
  let resolvePlayback;
  let created = 0;
  const player = makeAudio(() => new Promise((resolve) => { resolvePlayback = resolve; }));
  const controller = new DreamUnityAudioController(button, {
    createAudio: () => { created += 1; return player; },
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  assert.equal(created, 0, "the 8 MB track must not compete with the page at startup");
  assert.equal(button.listenerOptions.get("click")?.capture, true, "the override must run before the restored handler");
  const starting = controller.toggle();
  assert.equal(created, 1);
  assert.equal(controller.state, "loading");
  assert.equal(button.getAttribute("aria-busy"), "true");
  assert.equal(player.loop, true);
  assert.equal(player.preload, "none");
  assert.equal(player.volume, 0.3);

  await controller.toggle();
  assert.equal(controller.state, "off");
  resolvePlayback();
  assert.equal(await starting, false, "a stale play promise must not switch the control back on");
  assert.equal(controller.state, "off");
  assert.ok(player.pauseCalls >= 1);
});

test("a rejected playback attempt remains retryable and recovers cleanly", async () => {
  const { DreamUnityAudioController } = await import("../audio-controller.js");
  const button = new FakeButton();
  const players = [
    makeAudio(() => Promise.reject(new Error("simulated media failure"))),
    makeAudio(() => Promise.resolve())
  ];
  let created = 0;
  const controller = new DreamUnityAudioController(button, {
    createAudio: () => players[created++],
    setTimer: () => 1,
    clearTimer: () => {},
    warn: () => {}
  });

  assert.equal(await controller.toggle(), false);
  assert.equal(controller.state, "retry");
  assert.equal(button.label.textContent, "RETRY");
  assert.equal(button.disabled, false, "a media error must never permanently disable the control");

  assert.equal(await controller.toggle(), true);
  assert.equal(created, 2, "retry should use a clean media element");
  assert.equal(controller.state, "on");
  assert.equal(button.label.textContent, "ON");
  assert.equal(button.getAttribute("aria-pressed"), "true");

  assert.equal(await controller.toggle(), false);
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
