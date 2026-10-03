import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { PUBLIC_DIRECTORY, PUBLIC_FILES, stagePublicSite, moduleReferences } from '../scripts/stage-public-site.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const permitted = [
  '.nojekyll', 'CNAME', '404.html', 'index.html', 'styles.css',
  'portal-subnav.js', 'home-dialog.js', 'symbol-motion.js', 'symbol-3d.js',
  'symbol-surface.js', 'assets/dream-unity-portals-refined.webp',
  ...Array.from({ length: 4 }, (_, i) => `assets/symbol-ring-${i}.webp`),
  ...Array.from({ length: 4 }, (_, i) => `assets/symbol-mask-${i}.png`),
  'manifesto/index.html', 'manifesto/manifesto.css',
  'dream-world/index.html', 'dream-world/entry.js', 'dream-world/entry.css',
  'dream-world/hub.js', 'dream-world/portals.css',
  'dream-world/gods-earth-view/index.html', 'dream-world/gods-minds-eye-view/index.html',
  'assets/parchment-texture.svg', 'vendor/three/three.module.min.js',
  'vendor/three/three.core.min.js', 'vendor/three/LICENSE',
  'prototype/index.html', 'prototype/styles.css', 'prototype/main.js', 'prototype/state.js',
  'prototype/boot.js',
  'prototype/scene.js', 'prototype/manifesto-view.js', 'prototype/actions.js',
  'prototype/wire-contracts.js', 'prototype/validate.js', 'prototype/earth/adapter.js',
  'prototype/conversation/controller.js', 'prototype/conversation/text.js',
  'prototype/memory/store.js', 'prototype/memory/consent.js', 'prototype/memory/view.js',
  'prototype/build-info.json',
].sort();

test('publication contains only the approved home and prototype dependencies and removes stale applications', async () => {
  const expectedSourceCommit = process.env.DREAMUNITY_SOURCE_COMMIT || process.env.GITHUB_SHA || '';
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
    if (file === 'prototype/build-info.json' && /^[a-f0-9]{40}$/.test(expectedSourceCommit)) {
      const info = JSON.parse(await readFile(join(PUBLIC_DIRECTORY, file), 'utf8'));
      assert.equal(info.sourceCommit, expectedSourceCommit);
      assert.equal(info.contractVersion, 'du-prototype/1.0');
    } else if (/^[a-f0-9]{40}$/.test(expectedSourceCommit) && (file === 'prototype/index.html' || file.endsWith('.js') && file.startsWith('prototype/'))) {
      assert.equal((await readFile(join(PUBLIC_DIRECTORY, file), 'utf8')).replaceAll(`?v=${expectedSourceCommit}`, ''),
        await readFile(join(repository, file), 'utf8'), `${file} may change only dependency cache identity`);
    } else assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, file)), await readFile(join(repository, file)),
        `${file} must publish the current source bytes`);
    if (!/\.(?:html|css|m?js)$/.test(file)) continue;
    const text = await readFile(join(PUBLIC_DIRECTORY, file), 'utf8');
    const links = [
      ...text.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      ...text.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|url\(\s*)["']([^"']+)["']/g),
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
  const beforeInvalidRevision = await readFile(join(PUBLIC_DIRECTORY, 'prototype/build-info.json'));
  const previousExplicitRevision = process.env.DREAMUNITY_SOURCE_COMMIT;
  try {
    for (const invalidRevision of ['', 'invalid-revision']) {
      process.env.DREAMUNITY_SOURCE_COMMIT = invalidRevision;
      await assert.rejects(stagePublicSite(), /DREAMUNITY_SOURCE_COMMIT must identify an exact/);
      assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, 'prototype/build-info.json')), beforeInvalidRevision,
        'an invalid explicit source revision must fail before replacing the valid public artifact');
    }
  } finally {
    if (previousExplicitRevision === undefined) delete process.env.DREAMUNITY_SOURCE_COMMIT;
    else process.env.DREAMUNITY_SOURCE_COMMIT = previousExplicitRevision;
  }
});

test('one exact revision versions the staged entry and complete module graph without changing raw or home source', async () => {
  const previous = { explicit: process.env.DREAMUNITY_SOURCE_COMMIT, github: process.env.GITHUB_SHA };
  const revision = 'a'.repeat(40);
  const originals = new Map(await Promise.all(PUBLIC_FILES.filter(file => file !== '.nojekyll').map(async file => [file, await readFile(join(repository, file))])));
  try {
    process.env.DREAMUNITY_SOURCE_COMMIT = revision;
    await stagePublicSite();
    const html = await readFile(join(PUBLIC_DIRECTORY, 'prototype/index.html'), 'utf8');
    assert.match(html, new RegExp(`src="\\./boot\\.js\\?v=${revision}"`));
    assert.match(html, new RegExp(`href="\\./styles\\.css\\?v=${revision}"`));
    // Independently walk the actual served graph, including boot's dynamic import
    // and the shared module above /prototype/. Every edge must stay allowlisted.
    const pending = ['prototype/boot.js'], visited = new Set();
    while (pending.length) {
      const file = pending.pop(); if (visited.has(file)) continue; visited.add(file);
      const source = await readFile(join(PUBLIC_DIRECTORY, file), 'utf8');
      const references = [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s*)["']([^"']+)["']/gm)];
      for (const [, specifier] of references) {
        const target = new URL(specifier, `https://public.example/${file}`);
        assert.equal(target.origin, 'https://public.example');
        assert.equal(target.searchParams.get('v'), revision, `${file}: ${specifier} must identify this release`);
        const dependency = target.pathname.slice(1);
        assert.ok(PUBLIC_FILES.includes(dependency), `${file} imports an unpublished dependency`);
        pending.push(dependency);
      }
      execFileSync(process.execPath, ['--check', join(PUBLIC_DIRECTORY, file)]);
    }
    assert.equal(visited.size, 14, 'the current boot/main graph and shared ink clock must all be traversed');
    assert.ok(visited.has('prototype/main.js')); assert.ok(visited.has('symbol-motion.js'));
    assert.match(await readFile(join(PUBLIC_DIRECTORY, 'prototype/memory/consent.js'), 'utf8'), new RegExp(`from '\\./store\\.js\\?v=${revision}'`), 'retained re-export entry is also versioned');
    for (const [file, original] of originals) {
      assert.deepEqual(await readFile(join(repository, file)), original, `staging cannot mutate raw source ${file}`);
      if (!file.startsWith('prototype/')) assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, file)), original, `unrelated published home asset ${file} remains byte-for-byte intact`);
    }
    delete process.env.DREAMUNITY_SOURCE_COMMIT; delete process.env.GITHUB_SHA;
    await stagePublicSite();
    for (const [file, original] of originals) assert.deepEqual(await readFile(join(PUBLIC_DIRECTORY, file)), original, `no-revision fallback must preserve ${file}`);
  } finally {
    if (previous.explicit === undefined) delete process.env.DREAMUNITY_SOURCE_COMMIT; else process.env.DREAMUNITY_SOURCE_COMMIT = previous.explicit;
    if (previous.github === undefined) delete process.env.GITHUB_SHA; else process.env.GITHUB_SHA = previous.github;
  }
});

test('bounded module references ignore comment and regex punctuation and reject unsupported imports', () => {
  const source = `// import('./comment.js')\n/* export { X } from './comment2.js'; */\nimport { x } from './state.js';\nexport { y } from '../shared.js';\nexport * from './other.js';\nimport './side-effect.js';\nconst punctuation = /['"/]/;\nconst prose = "from './example.js'";\n  import('./main.js').then(() => {});\nconst url = import.meta.url;`;
  assert.deepEqual(moduleReferences(source).map(item => item.value), ['./state.js', '../shared.js', './other.js', './side-effect.js', './main.js']);
  for (const unsupported of ['import(moduleName)', 'import(`./${name}.js`)', 'const later = import("./main.js")', 'const example = "import(\\"./main.js\\")"', 'const pattern = /import(".\/main.js")/']) {
    assert.throws(() => moduleReferences(unsupported), /Unsupported module import syntax/);
  }
});

test('legacy branch publishing excludes every source file outside the home, manifesto and Dream World portals', async () => {
  await assert.rejects(readFile(join(repository, '.nojekyll')), { code: 'ENOENT' },
    'root .nojekyll would bypass branch publication exclusions');
  const config = JSON.parse(await readFile(join(repository, '_config.yml'), 'utf8'));
  assert.ok(config.include.includes('vendor'), 'the home renderer must remain available');
  for (const file of permitted) {
    assert.ok(!config.exclude.some(excluded => file.startsWith(excluded)),
      `legacy exclusion prefix must not hide a permitted public file: ${file}`);
  }
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  for (const file of tracked) {
    if (permitted.includes(file) || /^[._]/.test(file)) continue;
    assert.ok(config.exclude.some(excluded => file.startsWith(excluded)),
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
