import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { moduleReferences } from '../scripts/stage-public-site.mjs';

const source = await readFile(new URL('../prototype/boot.js', import.meta.url), 'utf8');
const ids = ['voice-label', 'voice-hint', 'session-status', 'service-status', 'memory-status',
  'voice-start', 'service-retry', 'memory-session-mode', 'memory-consent', 'memory-share-consent',
  'memory-revoke', 'memory-clear', 'memory-forget-device', 'access-panel', 'resume-button', 'exit-link'];

function start(loadMain, present = ids) {
  const elements = new Map(present.map(id => [id, {
    textContent: 'Checking', disabled: false, hidden: false,
    attributes: new Map([['aria-busy', 'true'], ['aria-pressed', 'false']]),
    setAttribute(name, value) { this.attributes.set(name, value); },
  }]));
  const document = { body: { dataset: { boot: 'loading', memory: 'loading' } }, getElementById: id => elements.get(id) || null };
  const errors = [];
  // Inject only the module-loader outcome; run the actual startup and recovery code.
  // Publication must continue to recognize the unchanged literal dynamic import.
  assert.deepEqual(moduleReferences(source).map(reference => reference.value), ['./main.js']);
  vm.runInNewContext(source.replace("import('./main.js')", 'loadMain()'), {
    document, loadMain, console: { error: (...args) => errors.push(args) },
  });
  return { document, elements, errors };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('boot stays pending until the application module loads and preserves its UI on success', async () => {
  let loaded;
  const page = start(() => new Promise(resolve => { loaded = resolve; }));
  assert.equal(page.document.body.dataset.boot, 'loading');
  page.elements.get('voice-label').textContent = 'Voice off';
  loaded(); await settle();
  assert.equal(page.document.body.dataset.boot, 'ready');
  assert.equal(page.elements.get('voice-label').textContent, 'Voice off');
  assert.deepEqual(page.errors, []);
});

test('module failure ends misleading checking states and leaves reload or Exit as recovery', async () => {
  const failure = new TypeError('A required module failed to load');
  const page = start(() => Promise.reject(failure));
  await settle();
  assert.equal(page.document.body.dataset.boot, 'failed');
  assert.equal(page.document.body.dataset.memory, 'failed');
  assert.equal(page.elements.get('voice-label').textContent, 'Unavailable');
  assert.equal(page.elements.get('voice-hint').textContent, 'Reload this page');
  for (const id of ['session-status', 'service-status']) {
    assert.match(page.elements.get(id).textContent, /could not start.*Reload.*Exit/);
  }
  assert.match(page.elements.get('memory-status').textContent, /Notes could not start.*Reload/);
  for (const id of ['voice-start', 'service-retry', 'memory-session-mode', 'memory-consent',
    'memory-share-consent', 'memory-revoke', 'memory-clear', 'memory-forget-device']) {
    assert.equal(page.elements.get(id).disabled, true, `${id} cannot act after failed startup`);
    assert.equal(page.elements.get(id).attributes.get('aria-busy'), 'false');
  }
  assert.equal(page.elements.get('voice-start').attributes.get('aria-pressed'), 'false');
  assert.equal(page.elements.get('access-panel').hidden, true);
  assert.equal(page.elements.get('resume-button').hidden, true);
  assert.equal(page.elements.get('exit-link').disabled, false);
  assert.equal(page.elements.get('exit-link').hidden, false);
  assert.deepEqual(page.errors, [['Dream Unity startup failed:', failure]]);
});

test('missing optional recovery elements do not swallow the original startup error', async () => {
  const failure = new Error('Entry and module could not initialize');
  const page = start(() => Promise.reject(failure), ['service-status']);
  await settle();
  assert.equal(page.document.body.dataset.boot, 'failed');
  assert.match(page.elements.get('service-status').textContent, /could not start.*Reload/);
  assert.deepEqual(page.errors, [['Dream Unity startup failed:', failure]]);
});
