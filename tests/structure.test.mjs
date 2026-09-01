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

test("the deployed experience has no runtime CDN dependency", async () => {
  const [html, main, scene] = await Promise.all([read("index.html"), read("src/main.js"), read("src/scene.js")]);
  assert.doesNotMatch(`${html}\n${main}\n${scene}`, /cdn\.jsdelivr|unpkg\.com|esm\.sh/);
});

test("the vendored Three.js runtime and required postprocessing modules exist", async () => {
  const requiredFiles = [
    "vendor/three/three.module.min.js",
    "vendor/three/addons/renderers/CSS2DRenderer.js",
    "vendor/three/addons/postprocessing/EffectComposer.js",
    "vendor/three/addons/postprocessing/UnrealBloomPass.js",
    "vendor/three/addons/postprocessing/OutputPass.js",
    "vendor/three/LICENSE"
  ];
  for (const file of requiredFiles) assert.ok((await stat(new URL(`../${file}`, import.meta.url))).size > 0, `${file} is empty`);
});

test("the deployable browser bundle is self-contained", async () => {
  const runtime = await read("runtime/dream-unity.min.js");
  assert.ok(runtime.length > 400_000, "runtime bundle is unexpectedly small");
  assert.doesNotMatch(runtime, /from\s*["']three|import\s*\(/);
});
