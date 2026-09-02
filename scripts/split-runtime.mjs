import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const chunkSize = 64 * 1024;
const runtimeUrl = new URL("../runtime/dream-unity.min.js", import.meta.url);
const chunksUrl = new URL("../runtime/chunks/", import.meta.url);
const runtime = await readFile(runtimeUrl);

await mkdir(chunksUrl, { recursive: true });

const chunks = [];
for (let offset = 0, index = 0; offset < runtime.length; offset += chunkSize, index += 1) {
  const filename = `dream-unity-${String(index).padStart(2, "0")}.chunk.js`;
  const content = runtime.subarray(offset, Math.min(offset + chunkSize, runtime.length));
  await writeFile(new URL(filename, chunksUrl), content);
  chunks.push({ file: filename, bytes: content.byteLength });
}

const manifest = {
  version: 1,
  revision: createHash("sha256").update(runtime).digest("hex"),
  totalBytes: runtime.byteLength,
  chunks
};

await writeFile(
  new URL("manifest.json", chunksUrl),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

console.log(`Split runtime into ${chunks.length} verified chunks (${runtime.byteLength} bytes).`);
