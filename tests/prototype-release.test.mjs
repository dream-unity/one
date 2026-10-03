import test from 'node:test';
import assert from 'node:assert/strict';
import { EXECUTING_RELEASE, createReleaseMonitor, ensureReleaseElements } from '../prototype/release.js';

const current = 'a'.repeat(40), previous = 'b'.repeat(40), next = 'c'.repeat(40);
const response = sourceCommit => ({ ok: true, json: async () => ({ sourceCommit, version: 'test-release' }) });
const identified = { runningCommit: current, requestedCommit: current, documentCommit: current };

test('release identity comes from executing bytes, never a query or fetched manifest', async () => {
  assert.equal(EXECUTING_RELEASE, null, 'raw source must not claim a stamped deployment');
  const raw = createReleaseMonitor({ requestedCommit: current, documentCommit: current, fetcher: async () => response(current) });
  const result = await raw.check();
  assert.equal(result.running, null);
  assert.equal(result.status, 'unidentified');
  assert.equal(result.published, current);
  raw.close();
  const mixed = createReleaseMonitor({ ...identified, requestedCommit: previous, fetcher: async () => response(current) });
  assert.equal((await mixed.check()).issue, 'mixed', 'matching publication cannot conceal old URL/new response bytes');
  mixed.close();
  const oldDocument = createReleaseMonitor({ ...identified, documentCommit: previous, fetcher: async () => response(current) });
  assert.equal((await oldDocument.check()).issue, 'mixed', 'document identity is independent of the module');
  oldDocument.close();
});

test('bounded checks use no-store, coalesce, and retain known update information on failure', async () => {
  let complete, calls = 0, options;
  const monitor = createReleaseMonitor({ ...identified, fetcher: async (url, init) => {
    calls++; options = init;
    assert.match(String(url), /prototype\/build-info\.json$/);
    if (calls === 1) return new Promise(resolve => { complete = resolve; });
    throw new Error('offline');
  } });
  const pending = monitor.check();
  assert.equal(monitor.check(), pending);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(options.cache, 'no-store');
  assert.equal(options.credentials, 'omit');
  complete(response(next));
  assert.equal((await pending).issue, 'published');
  const offline = await monitor.check();
  assert.equal(offline.published, next);
  assert.equal(offline.issue, 'published');
  assert.equal(offline.phase, 'unavailable');
  assert.match(offline.error, /current visit can continue/);
  monitor.close();
});

test('the deadline settles even when fetch ignores abort, and late results cannot change the running check', async () => {
  let expire, late, signal, milliseconds;
  const monitor = createReleaseMonitor({ ...identified, setTimer(callback, delay) { expire = callback; milliseconds = delay; return 1; }, clearTimer() {},
    fetcher: async (url, init) => { signal = init.signal; return new Promise(resolve => { late = resolve; }); } });
  const pending = monitor.check(); await Promise.resolve();
  assert.equal(milliseconds, 5000);
  expire();
  const timeout = await pending;
  assert.equal(signal.aborted, true);
  assert.equal(timeout.phase, 'unavailable');
  assert.match(timeout.error, /timed out/);
  late(response(next)); await Promise.resolve(); await Promise.resolve();
  assert.equal(monitor.getState().published, null);
  monitor.close();
});

test('disposal settles an outstanding check and forbids late rendering or additional requests', async () => {
  let calls = 0, signal, renders = 0;
  const monitor = createReleaseMonitor({ ...identified, onChange() { renders++; }, fetcher: async (url, init) => {
    calls++; signal = init.signal; return new Promise(() => {});
  } });
  const pending = monitor.check(); await Promise.resolve(); const beforeClose = renders;
  monitor.close(); await pending; await monitor.check();
  assert.equal(signal.aborted, true); assert.equal(calls, 1); assert.equal(renders, beforeClose);
});

test('closing before the queued fetch starts prevents even a new release request', async () => {
  let calls = 0;
  const monitor = createReleaseMonitor({ ...identified, fetcher: async () => { calls++; return response(current); } });
  const pending = monitor.check(); monitor.close(); await pending;
  assert.equal(calls, 0);
});

test('an older document gains release controls without replacing or touching its current draft', () => {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; }
    append(...nodes) { for (const child of nodes) { child.parent = this; this.children.push(child); } }
    setAttribute(name, value) { this.attributes[name] = value; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const body = new Element('body'), footer = new Element('footer'), draft = new Element('textarea');
  footer.className = 'shell-footer'; draft.value = 'Keep this unsent thought.'; body.append(draft, footer);
  const find = predicate => {
    const visit = node => predicate(node) ? node : node.children.map(visit).find(Boolean);
    return visit(body) || null;
  };
  const document = { body, createElement: tag => new Element(tag),
    getElementById: id => find(node => node.id === id), querySelector: selector => find(node => node.className === selector.slice(1)) };
  ensureReleaseElements(document);
  for (const id of ['release-update-notice', 'release-update-message', 'release-reload', 'release-status',
    'release-running', 'release-document', 'release-requested', 'release-published']) assert.ok(document.getElementById(id), id);
  assert.equal(document.getElementById('release-update-notice').hidden, true);
  assert.equal(draft.value, 'Keep this unsent thought.');
  const controls = [...footer.children]; ensureReleaseElements(document);
  assert.deepEqual(footer.children, controls, 'a current document must retain the existing controls and listeners');
  assert.equal(body.children[0], draft);
});

test('a malformed or unstamped manifest cannot establish a current release', async () => {
  for (const commit of [null, 'bad', undefined]) {
    const monitor = createReleaseMonitor({ ...identified, fetcher: async () => response(commit) });
    const result = await monitor.check();
    assert.notEqual(result.status, 'current');
    assert.equal(result.published, null);
    monitor.close();
  }
  const monitor = createReleaseMonitor({ ...identified, fetcher: async () => response(current) });
  assert.equal((await monitor.check()).status, 'current');
  monitor.close();
});
