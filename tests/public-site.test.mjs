import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PUBLIC_DIRECTORY, PUBLIC_FILES, PORTALS, sourceRevision, stagePublicSite } from '../scripts/stage-public-site.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const permitted = [
  '.nojekyll', 'build-info.json', 'CNAME', '404.html', 'index.html', 'styles.css',
  'symbol-motion.js', 'symbol-3d.js', 'symbol-surface.js',
  'dream-machine/index.html', 'dream-world/index.html', 'dream-maker/index.html', 'dream-unity/index.html',
  'dream-machine/architect-of-sacred-ground/index.html', 'dream-machine/modules.css',
  'assets/architect-of-sacred-ground.webp',
  'assets/dream-unity-portals-refined.webp', 'assets/parchment-texture.svg',
  ...Array.from({ length: 4 }, (_, i) => `assets/symbol-ring-${i}.webp`),
  ...Array.from({ length: 4 }, (_, i) => `assets/symbol-mask-${i}.png`),
  'vendor/three/three.module.min.js', 'vendor/three/three.core.min.js', 'vendor/three/LICENSE',
].sort();

test('publication removes stale applications and contains only the shell and approved Architect module', async () => {
  assert.deepEqual([...PUBLIC_FILES].sort(), permitted);
  const stale = join(PUBLIC_DIRECTORY, 'prototype/index.html');
  await mkdir(dirname(stale), { recursive: true });
  await writeFile(stale, '<h1>Retired application</h1>');
  await stagePublicSite();
  const entries = await readdir(PUBLIC_DIRECTORY, { recursive: true, withFileTypes: true });
  const files = entries.filter(entry => entry.isFile())
    .map(entry => relative(PUBLIC_DIRECTORY, join(entry.parentPath ?? entry.path, entry.name))).sort();
  assert.deepEqual(files, permitted);
  const info = JSON.parse(await readFile(join(PUBLIC_DIRECTORY, 'build-info.json'), 'utf8'));
  assert.equal(info.sourceCommit, sourceRevision());
  assert.equal(info.site, 'dream-university');
  assert.deepEqual(info.portals, PORTALS);
  for (const file of files) {
    if (['.nojekyll', 'build-info.json'].includes(file)) continue;
    assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, file)), await readFile(join(repository, file)),
      `${file} must publish the current source bytes`);
    if (!/\.(?:html|css|js)$/.test(file) || file.startsWith('vendor/')) continue;
    const source = await readFile(join(PUBLIC_DIRECTORY, file), 'utf8');
    const references = [
      ...source.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
      ...source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g),
    ];
    for (const [, target] of references) {
      if (/^(?:[a-z]+:|#)/i.test(target) || target.includes('${')) continue;
      const url = new URL(target, `https://site.example/${file}`);
      const destination = decodeURIComponent(url.pathname.slice(1)) + (url.pathname.endsWith('/') ? 'index.html' : '');
      assert.ok(files.includes(destination), `${file} references an unpublished path: ${target}`);
    }
  }
  const before = await readFile(join(PUBLIC_DIRECTORY, 'build-info.json'));
  const previous = process.env.DREAMUNITY_SOURCE_COMMIT;
  try {
    process.env.DREAMUNITY_SOURCE_COMMIT = 'invalid';
    await assert.rejects(stagePublicSite(), /exact 40-character/);
    assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, 'build-info.json')), before);
  } finally {
    if (previous === undefined) delete process.env.DREAMUNITY_SOURCE_COMMIT;
    else process.env.DREAMUNITY_SOURCE_COMMIT = previous;
  }
});

test('source identity fails closed for malformed release revisions', () => {
  for (const revision of ['', 'latest', 'a'.repeat(39), 'A'.repeat(40)]) {
    assert.throws(() => sourceRevision({ DREAMUNITY_SOURCE_COMMIT: revision }), /exact 40-character/);
  }
  assert.equal(sourceRevision({ DREAMUNITY_SOURCE_COMMIT: 'a'.repeat(40) }), 'a'.repeat(40));
});

test('legacy branch publication excludes development files and keeps vendor artwork runtime', async () => {
  await assert.rejects(readFile(join(repository, '.nojekyll')), { code: 'ENOENT' });
  const config = JSON.parse(await readFile(join(repository, '_config.yml'), 'utf8'));
  assert.ok(config.include.includes('vendor'));
  for (const file of permitted) assert.ok(!config.exclude.some(excluded => file.startsWith(excluded)));
  const entries = await readdir(repository, { recursive: true, withFileTypes: true });
  const current = entries.filter(entry => entry.isFile())
    .map(entry => relative(repository, join(entry.parentPath ?? entry.path, entry.name)));
  for (const file of current) {
    if (permitted.includes(file) || /^[._]/.test(file)) continue;
    assert.ok(config.exclude.some(excluded => file === excluded || file.startsWith(`${excluded}/`)),
      `legacy branch build would expose a non-public file: ${file}`);
  }
});

test('Pages checks the staged shell before upload and checks the exact published release afterwards', async () => {
  const workflow = await readFile(join(repository, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /run: node scripts\/stage-public-site\.mjs/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v\d+[\s\S]*?path: \.public-site\s/);
  assert.doesNotMatch(workflow, /path:\s*\.\s*(?:\n|$)/);
  assert.ok(workflow.indexOf('name: Verify the staged four-portal shell') < workflow.indexOf('actions/upload-pages-artifact'));
  assert.ok(workflow.indexOf('actions/deploy-pages') < workflow.indexOf('name: Verify the published four-portal shell'));
  assert.match(workflow, /DREAMUNITY_BASE_URL: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(workflow, /if: always\(\)[\s\S]*?path: output\/shell-browser/);
});
