import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
export const PUBLIC_DIRECTORY = resolve(repository, '.public-site');
export const PORTALS = Object.freeze(['machine', 'world', 'maker', 'unity']);

// Only the university shell, approved modules and their artwork may reach the public site.
// Retired applications cannot return through an incidental source-directory copy.
export const PUBLIC_FILES = Object.freeze([
  '.nojekyll', 'build-info.json', 'CNAME', '404.html', 'index.html', 'styles.css',
  'symbol-motion.js', 'symbol-3d.js', 'symbol-surface.js',
  ...PORTALS.map(portal => `dream-${portal}/index.html`),
  'dream-machine/architect-of-sacred-ground/index.html', 'dream-machine/modules.css',
  'assets/architect-of-sacred-ground.webp',
  'assets/dream-unity-portals-refined.webp', 'assets/parchment-texture.svg',
  ...Array.from({ length: 4 }, (_, i) => `assets/symbol-ring-${i}.webp`),
  ...Array.from({ length: 4 }, (_, i) => `assets/symbol-mask-${i}.png`),
  'vendor/three/three.module.min.js', 'vendor/three/three.core.min.js', 'vendor/three/LICENSE',
]);

export function sourceRevision(env = process.env) {
  const selected = env.DREAMUNITY_SOURCE_COMMIT ?? env.GITHUB_SHA ??
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(selected)) {
    throw new Error('The source revision must be an exact 40-character Git commit.');
  }
  return selected;
}

export async function stagePublicSite() {
  const sourceCommit = sourceRevision();
  const generated = new Set(['.nojekyll', 'build-info.json']);
  // Validate before replacing the previous artifact; the removal scope is fixed.
  for (const file of PUBLIC_FILES) {
    if (!generated.has(file) && !(await stat(resolve(repository, file))).isFile()) {
      throw new Error(`Public asset is not a regular file: ${file}`);
    }
  }
  await rm(PUBLIC_DIRECTORY, { recursive: true, force: true });
  for (const file of PUBLIC_FILES) {
    const destination = resolve(PUBLIC_DIRECTORY, file);
    await mkdir(dirname(destination), { recursive: true });
    if (file === '.nojekyll') await writeFile(destination, '');
    else if (file === 'build-info.json') await writeFile(destination,
      JSON.stringify({ sourceCommit, site: 'dream-university', portals: PORTALS }, null, 2) + '\n');
    else await copyFile(resolve(repository, file), destination);
  }
  return PUBLIC_DIRECTORY;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await stagePublicSite();
  console.log(`Staged ${PUBLIC_FILES.length} permitted public files.`);
}
