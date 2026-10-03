import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
export const PUBLIC_DIRECTORY = resolve(repository, '.public-site');

// Explicitly publish the home, manifesto, Dream World portals and prototype. Keeping
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
  'manifesto/index.html',
  'manifesto/manifesto.css',
  'dream-world/index.html',
  'dream-world/entry.js',
  'dream-world/entry.css',
  'dream-world/hub.js',
  'dream-world/portals.css',
  'dream-world/gods-earth-view/index.html',
  'dream-world/gods-minds-eye-view/index.html',
  'assets/dream-unity-portals-refined.webp',
  'assets/symbol-ring-0.webp',
  'assets/symbol-ring-1.webp',
  'assets/symbol-ring-2.webp',
  'assets/symbol-ring-3.webp',
  'assets/symbol-mask-0.png',
  'assets/symbol-mask-1.png',
  'assets/symbol-mask-2.png',
  'assets/symbol-mask-3.png',
  'assets/parchment-texture.svg',
  'vendor/three/three.module.min.js',
  'vendor/three/three.core.min.js',
  'vendor/three/LICENSE',
  'prototype/index.html',
  'prototype/styles.css',
  'prototype/main.js',
  'prototype/boot.js',
  'prototype/state.js',
  'prototype/scene.js',
  'prototype/manifesto-view.js',
  'prototype/actions.js',
  'prototype/wire-contracts.js',
  'prototype/validate.js',
  'prototype/earth/adapter.js',
  'prototype/conversation/controller.js',
  'prototype/conversation/text.js',
  'prototype/memory/store.js',
  'prototype/memory/consent.js',
  'prototype/memory/view.js',
  'prototype/build-info.json',
]);

// Publication supports the source forms actually used by this app: a leading
// block of single-line named imports/re-exports, and boot's literal import().then.
// This is intentionally not a JavaScript lexer. Unsupported/import-like code
// fails closed instead of guessing through regex literals or template expressions.
export function moduleReferences(source) {
  const references = [];
  let offset = 0, prelude = true, blockComment = false;
  for (const line of source.split(/(?<=\n)/)) {
    const start = offset; offset += line.length;
    const trimmed = line.trim();
    if (blockComment) {
      const end = line.indexOf('*/');
      if (end >= 0) { if (line.slice(end + 2).trim()) throw new Error('Unsupported module comment layout.'); blockComment = false; }
      continue;
    }
    if (!trimmed || trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('/*')) {
      const end = line.indexOf('*/');
      if (end < 0) blockComment = true;
      else if (line.slice(end + 2).trim()) throw new Error('Unsupported module comment layout.');
      continue;
    }
    const declaration = /^([ \t]*(?:(?:import|export)[ \t]+(?:\{[\w$, \t]+\}|\*(?:[ \t]+as[ \t]+[\w$]+)?)[ \t]+from[ \t]+|import[ \t]+))(["'])([^"'\\\r\n]+)\2[ \t]*;[ \t]*(?:\/\/[^\r\n]*)?[\r\n]*$/.exec(line);
    if (prelude && declaration) {
      const at = start + declaration[1].length + 1;
      references.push({ value: declaration[3], start: at, end: at + declaration[3].length }); continue;
    }
    prelude = false;
    const dynamic = /^([ \t]*import\([ \t]*)(["'])([^"'\\\r\n]+)\2[ \t]*\)\.then\(/.exec(line);
    if (dynamic) {
      const at = start + dynamic[1].length + 1;
      references.push({ value: dynamic[3], start: at, end: at + dynamic[3].length });
      if (/\bimport\s*\(/.test(line.slice(dynamic[0].length))) throw new Error('Unsupported additional dynamic import.');
    } else if (/^[ \t]*(?:import(?![ \t]*\.)\b|export[ \t]*(?:\{|\*))|\bimport\s*\(/.test(line)) {
      throw new Error('Unsupported module import syntax; use leading single-line declarations or the literal boot import().then form.');
    }
  }
  if (blockComment) throw new Error('Unclosed module comment.');
  return references;
}

function stampedReference(value, sourceCommit) {
  const hashIndex = value.indexOf('#'), fragment = hashIndex < 0 ? '' : value.slice(hashIndex);
  const withoutFragment = hashIndex < 0 ? value : value.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf('?');
  const pathname = queryIndex < 0 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex < 0 ? '' : withoutFragment.slice(queryIndex + 1));
  query.set('v', sourceCommit);
  return `${pathname}?${query}${fragment}`;
}

async function versionedPrototype(sourceCommit) {
  const output = new Map(), permitted = new Set(PUBLIC_FILES);
  const pending = PUBLIC_FILES.filter(file => file.startsWith('prototype/') && file.endsWith('.js'));
  function dependency(specifier, owner) {
    if (!/^\.\.?\//.test(specifier)) throw new Error(`Only relative prototype module dependencies may be published: ${owner}: ${specifier}`);
    const file = new URL(specifier, `https://publication.invalid/${owner}`).pathname.slice(1);
    if (!permitted.has(file) || !/\.m?js$/.test(file)) throw new Error(`Prototype imports an unpublished module: ${owner}: ${specifier}`);
    return file;
  }
  while (pending.length) {
    const file = pending.pop(); if (output.has(file)) continue;
    const source = await readFile(resolve(repository, file), 'utf8'), references = moduleReferences(source);
    let stamped = source;
    for (const reference of [...references].reverse()) {
      pending.push(dependency(reference.value, file));
      stamped = stamped.slice(0, reference.start) + stampedReference(reference.value, sourceCommit) + stamped.slice(reference.end);
    }
    output.set(file, stamped);
  }
  const entry = await readFile(resolve(repository, 'prototype/index.html'), 'utf8');
  output.set('prototype/index.html', entry.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=)(["'])(\.\.?\/[^"']+\.(?:js|css)(?:[?#][^"']*)?)\2/g,
    (match, prefix, quote, value) => {
      const file = new URL(value, 'https://publication.invalid/prototype/index.html').pathname.slice(1);
      if (!permitted.has(file)) throw new Error(`Prototype entry references an unpublished asset: ${value}`);
      return `${prefix}${quote}${stampedReference(value, sourceCommit)}${quote}`;
    }));
  return output;
}

export async function stagePublicSite() {
  const explicitSourceCommit = process.env.DREAMUNITY_SOURCE_COMMIT;
  if (explicitSourceCommit !== undefined && !/^[a-f0-9]{40}$/.test(explicitSourceCommit)) {
    throw new Error('DREAMUNITY_SOURCE_COMMIT must identify an exact 40-character source revision.');
  }
  const sourceCommit = explicitSourceCommit || process.env.GITHUB_SHA;
  const exactRevision = /^[a-f0-9]{40}$/.test(sourceCommit || '');
  // Validate before replacing the output. The destination is fixed to this
  // repository; no command-line path can expand the removal scope.
  for (const file of PUBLIC_FILES) {
    if (file === '.nojekyll') continue;
    if (!(await stat(resolve(repository, file))).isFile()) {
      throw new Error(`Public asset is not a file: ${file}`);
    }
  }
  // Validate the complete graph before touching the previous valid artifact.
  const versioned = exactRevision ? await versionedPrototype(sourceCommit) : new Map();
  await rm(PUBLIC_DIRECTORY, { recursive: true, force: true });
  for (const file of PUBLIC_FILES) {
    const destination = resolve(PUBLIC_DIRECTORY, file);
    await mkdir(dirname(destination), { recursive: true });
    if (file === '.nojekyll') await writeFile(destination, '');
    else if (versioned.has(file)) await writeFile(destination, versioned.get(file));
    else if (file === 'prototype/build-info.json' && exactRevision) {
      const info = JSON.parse(await readFile(resolve(repository, file), 'utf8'));
      await writeFile(destination, JSON.stringify({ ...info, sourceCommit }) + '\n');
    } else await copyFile(resolve(repository, file), destination);
  }
  return PUBLIC_DIRECTORY;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await stagePublicSite();
  console.log(`Staged ${PUBLIC_FILES.length} permitted public files.`);
}
