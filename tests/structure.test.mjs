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
    "runtime/dream-unity.min.js"
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

test("the vendored Three.js runtime and license remain available", async () => {
  const requiredFiles = ["vendor/three/three.module.min.js", "vendor/three/LICENSE"];
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

test("the deployable browser bundle is self-contained", async () => {
  const runtime = await read("runtime/dream-unity.min.js");
  assert.ok(runtime.length > 400_000, "runtime bundle is unexpectedly small");
  assert.ok(runtime.length < 650_000, "runtime bundle exceeds the performance budget");
  assert.doesNotMatch(runtime, /from\s*["']three|import\s*\(/);
});
