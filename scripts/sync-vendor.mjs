import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const files = [
  ["node_modules/three/build/three.module.min.js", "vendor/three/three.module.min.js"],
  ["node_modules/three/examples/jsm/renderers/CSS2DRenderer.js", "vendor/three/addons/renderers/CSS2DRenderer.js"],
  ["node_modules/three/examples/jsm/postprocessing/EffectComposer.js", "vendor/three/addons/postprocessing/EffectComposer.js"],
  ["node_modules/three/examples/jsm/postprocessing/RenderPass.js", "vendor/three/addons/postprocessing/RenderPass.js"],
  ["node_modules/three/examples/jsm/postprocessing/ShaderPass.js", "vendor/three/addons/postprocessing/ShaderPass.js"],
  ["node_modules/three/examples/jsm/postprocessing/Pass.js", "vendor/three/addons/postprocessing/Pass.js"],
  ["node_modules/three/examples/jsm/postprocessing/MaskPass.js", "vendor/three/addons/postprocessing/MaskPass.js"],
  ["node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js", "vendor/three/addons/postprocessing/UnrealBloomPass.js"],
  ["node_modules/three/examples/jsm/postprocessing/OutputPass.js", "vendor/three/addons/postprocessing/OutputPass.js"],
  ["node_modules/three/examples/jsm/shaders/CopyShader.js", "vendor/three/addons/shaders/CopyShader.js"],
  ["node_modules/three/examples/jsm/shaders/LuminosityHighPassShader.js", "vendor/three/addons/shaders/LuminosityHighPassShader.js"],
  ["node_modules/three/LICENSE", "vendor/three/LICENSE"]
];

for (const [source, destination] of files) {
  const absoluteDestination = resolve(destination);
  await mkdir(dirname(absoluteDestination), { recursive: true });
  await copyFile(resolve(source), absoluteDestination);
}

console.log(`Vendored ${files.length} Three.js runtime files.`);
