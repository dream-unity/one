import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
export const PUBLIC_DIRECTORY = resolve(repository, '.public-site');

// Explicitly publish the home experience and its God's Earth entry only. Keeping
// an activity in source control must never expose its retired direct URL.
export const PUBLIC_FILES = Object.freeze([
  '.nojekyll',
  'CNAME',
  '404.html',
  'index.html',
  'styles.css',
  'portal-subnav.js',
  'home-dialog.js',
  'symbol-motion.js',
  'symbol-3d.js',
  'symbol-surface.js',
  'dream-world/index.html',
  'dream-world/entry.js',
  'dream-world/entry.css',
  'assets/dream-unity-portals-refined.webp',
  'assets/parchment-texture.svg',
  'vendor/three/three.module.min.js',
  'vendor/three/three.core.min.js',
  'vendor/three/LICENSE',
]);

export async function stagePublicSite() {
  // Validate before replacing the output. The destination is fixed to this
  // repository; no command-line path can expand the removal scope.
  for (const file of PUBLIC_FILES) {
    if (file === '.nojekyll') continue;
    if (!(await stat(resolve(repository, file))).isFile()) {
      throw new Error(`Public asset is not a file: ${file}`);
    }
  }
  await rm(PUBLIC_DIRECTORY, { recursive: true, force: true });
  for (const file of PUBLIC_FILES) {
    const destination = resolve(PUBLIC_DIRECTORY, file);
    await mkdir(dirname(destination), { recursive: true });
    if (file === '.nojekyll') await writeFile(destination, '');
    else await copyFile(resolve(repository, file), destination);
  }
  return PUBLIC_DIRECTORY;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await stagePublicSite();
  console.log(`Staged ${PUBLIC_FILES.length} permitted public files.`);
}
