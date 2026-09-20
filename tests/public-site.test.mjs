import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { PUBLIC_DIRECTORY, PUBLIC_FILES, stagePublicSite } from '../scripts/stage-public-site.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const permitted = [
  '.nojekyll', 'CNAME', '404.html', 'index.html', 'styles.css',
  'portal-subnav.js', 'home-dialog.js', 'symbol-motion.js', 'symbol-3d.js',
  'symbol-surface.js', 'assets/dream-unity-portals-refined.webp',
  'assets/parchment-texture.svg', 'vendor/three/three.module.min.js',
  'vendor/three/three.core.min.js', 'vendor/three/LICENSE',
].sort();

test('publication contains only the home dependency closure and removes stale applications', async () => {
  assert.deepEqual([...PUBLIC_FILES].sort(), permitted);
  const stale = join(PUBLIC_DIRECTORY, 'portals/dream-world/index.html');
  await mkdir(dirname(stale), { recursive: true });
  await writeFile(stale, '<h1>Previously published activity</h1>');
  await stagePublicSite();
  const entries = await readdir(PUBLIC_DIRECTORY, { recursive: true, withFileTypes: true });
  const files = entries.filter(entry => entry.isFile())
    .map(entry => relative(PUBLIC_DIRECTORY, join(entry.parentPath ?? entry.path, entry.name))).sort();
  assert.deepEqual(files, permitted, 'no retained activity or stale file may enter the public artifact');

  for (const file of files) {
    if (file === '.nojekyll') {
      assert.equal(await readFile(join(PUBLIC_DIRECTORY, file), 'utf8'), '');
      continue;
    }
    assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, file)), await readFile(join(repository, file)),
      `${file} must publish the current source bytes`);
    if (!/\.(?:html|css|js)$/.test(file)) continue;
    const text = await readFile(join(PUBLIC_DIRECTORY, file), 'utf8');
    const links = [
      ...text.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      ...text.matchAll(/(?:from\s*|import\s*\(|url\(\s*)["']([^"']+)["']/g),
    ];
    for (const [, target] of links) {
      if (/^(?:[a-z]+:|#)/i.test(target) || target.includes('${')) continue;
      const targetUrl = new URL(target, `https://public.example/${file}`);
      targetUrl.search = '';
      targetUrl.hash = '';
      if (targetUrl.pathname.endsWith('/')) targetUrl.pathname += 'index.html';
      const targetFile = decodeURIComponent(targetUrl.pathname.slice(1));
      assert.ok(files.includes(targetFile), `${file} references an unpublished local path: ${target}`);
    }
  }
});

test('legacy branch publishing excludes every non-home source file', async () => {
  await assert.rejects(readFile(join(repository, '.nojekyll')), { code: 'ENOENT' },
    'root .nojekyll would bypass branch publication exclusions');
  const config = JSON.parse(await readFile(join(repository, '_config.yml'), 'utf8'));
  assert.ok(config.include.includes('vendor'), 'the home renderer must remain available');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  for (const file of tracked) {
    if (permitted.includes(file) || /^[._]/.test(file)) continue;
    assert.ok(config.exclude.some(excluded => file === excluded || file.startsWith(`${excluded}/`)),
      `legacy branch build would expose ${file}`);
  }
});

test('Pages uploads only the freshly staged public directory', async () => {
  const workflow = await readFile(join(repository, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /run: node scripts\/stage-public-site\.mjs/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v\d+[\s\S]*?path: \.public-site\s/);
  assert.doesNotMatch(workflow, /path:\s*\.\s*(?:\n|$)/);
  assert.ok(workflow.indexOf('node scripts/stage-public-site.mjs') < workflow.indexOf('actions/upload-pages-artifact'));
});
