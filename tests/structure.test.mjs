import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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

test("the page cannot remain trapped behind its loading screen", async () => {
  const [html, main, loader] = await Promise.all([
    read("index.html"),
    read("src/main.js"),
    read("runtime/loader.js")
  ]);
  assert.match(html, /__DREAM_UNITY_WATCHDOG__/);
  assert.match(html, /setTimeout\(revealStaticExperience, 6000\)/);
  assert.match(html, /defer src="\.\/runtime\/loader\.js"/);
  assert.match(main, /clearTimeout\(window\.__DREAM_UNITY_WATCHDOG__\)/);
  assert.doesNotMatch(html, /<script[^>]+src="\.\/runtime\/dream-unity\.min\.js"/);
  assert.match(loader, /buffer\.byteLength !== chunk\.bytes/);
  assert.match(loader, /totalBytes !== manifest\.totalBytes/);
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
  const runtime = await read("runtime/dream-unity.min.js");
  assert.ok(runtime.length > 400_000, "runtime bundle is unexpectedly small");
  assert.ok(runtime.length < 650_000, "runtime bundle exceeds the performance budget");
  assert.doesNotMatch(runtime, /from\s*["']three|import\s*\(/);
});

test("the segmented runtime reconstructs the exact production bundle", async () => {
  const manifest = JSON.parse(await read("runtime/chunks/manifest.json"));
  assert.ok(manifest.chunks.length >= 2, "runtime must be segmented for resilient delivery");
  const parts = await Promise.all(manifest.chunks.map(async (chunk) => {
    assert.ok(chunk.bytes <= 64 * 1024, `${chunk.file} exceeds the delivery ceiling`);
    const content = await readFile(new URL(`../runtime/chunks/${chunk.file}`, import.meta.url));
    assert.equal(content.byteLength, chunk.bytes, `${chunk.file} size differs from its manifest`);
    return content;
  }));
  const reconstructed = Buffer.concat(parts);
  const runtime = await readFile(new URL("../runtime/dream-unity.min.js", import.meta.url));
  assert.equal(reconstructed.byteLength, manifest.totalBytes);
  assert.deepEqual(reconstructed, runtime);
});
