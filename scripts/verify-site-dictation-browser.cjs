'use strict';

// Deterministic browser integration tests with SIMULATED SpeechRecognition events.
// This does not exercise actual sound, browser speech services, native permission
// prompts, native keyboard dictation, or a physical microphone.
// Usage: node scripts/verify-site-dictation-browser.cjs [prototype URL]
// Without a URL, serves the staged .public-site directory on an ephemeral local
// port. SITE_DICTATION_URL / DREAMUNITY_SITE_DICTATION_URL can specify another
// local or deployed target. The canonical deployed-release gate stays separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const explicitTarget = process.argv[2] || process.env.SITE_DICTATION_URL || process.env.DREAMUNITY_SITE_DICTATION_URL || process.env.DREAMUNITY_SITE_URL;
let target = explicitTarget ? new URL(explicitTarget) : null;
if (target) assert.ok(['http:', 'https:'].includes(target.protocol), 'The target must be an HTTP(S) prototype URL.');
const BUDGET_MS = 180000;
const started = Date.now();
const deadline = started + BUDGET_MS - 5000;
const directory = path.resolve('output/site-dictation-browser');
fs.mkdirSync(directory, { recursive: true });
const evidence = {
  target: target?.href || null, status: 'running', verification: 'simulated-speech-recognition-browser-integration',
  scope: 'Real application modules, controls, draft editing and temporary note store; synthetic recognizer callbacks and synthetic visibility changes. No mocked HTTP responses.',
  limitations: ['Actual sound, native speech recognition, native microphone permissions and keyboard dictation are unexercised.',
    'Synthetic hidden/visible events test application ownership; real browser background scheduling is unexercised.'],
  checks: [], contexts: [], forbiddenRequests: [], pageErrors: [], screenshots: [],
};
let browser;
let activePage;
let localServer;
function remaining(maximum = 8000) {
  const budget = deadline - Date.now();
  assert.ok(budget > 0, 'The simulated dictation verification deadline expired.');
  return Math.max(1, Math.min(maximum, budget));
}
function writeEvidence() {
  evidence.durationMs = Date.now() - started;
  fs.writeFileSync(path.join(directory, 'verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
const hardDeadline = setTimeout(() => {
  evidence.status = 'failed'; evidence.error = `Simulated dictation verification exceeded ${BUDGET_MS / 1000} seconds.`;
  writeEvidence(); console.error(JSON.stringify(evidence)); process.exit(1);
}, BUDGET_MS);

async function serveStagedSite() {
  const root = await fs.promises.realpath(path.resolve(__dirname, '../.public-site'));
  await fs.promises.access(path.join(root, 'prototype/index.html'));
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
  localServer = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filename = path.resolve(root, `.${requestedPath}`);
      if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
      if ((await fs.promises.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      filename = await fs.promises.realpath(filename);
      if (!filename.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
      const body = await fs.promises.readFile(filename);
      response.writeHead(200, { 'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': body.length, 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500); response.end();
    }
  });
  await new Promise((resolve, reject) => {
    localServer.once('error', reject); localServer.listen(0, '127.0.0.1', resolve);
  });
  return new URL(`http://127.0.0.1:${localServer.address().port}/prototype/`);
}

// Recognition itself is the only fake platform feature. Native-shaped events are
// delivered manually, including saved handlers deliberately replayed after abort.
function installRecognitionFixture({ supported }) {
  const observation = { starts: 0, stops: 0, aborts: 0, microphoneRequests: 0, instances: [], events: [] };
  const retained = new WeakMap();
  class SimulatedRecognition extends EventTarget {
    constructor() {
      super();
      this.continuous = false; this.interimResults = false; this.lang = ''; this.maxAlternatives = 1;
      this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null;
      this.onspeechstart = null; this.onspeechend = null;
      this.id = observation.instances.length; observation.instances.push(this);
      retained.set(this, new Map());
    }
    addEventListener(type, listener, options) {
      super.addEventListener(type, listener, options);
      if (listener) {
        const callbacks = retained.get(this).get(type) || [];
        callbacks.push(listener); retained.get(this).set(type, callbacks);
      }
    }
    start() {
      observation.starts++;
      this.savedHandlers = Object.fromEntries(['start', 'result', 'error', 'end', 'speechstart', 'speechend']
        .map(type => [type, this[`on${type}`]]));
    }
    stop() { observation.stops++; }
    abort() { observation.aborts++; }
  }
  Object.defineProperty(globalThis, 'SpeechRecognition', { configurable: true, writable: true, value: supported ? SimulatedRecognition : undefined });
  Object.defineProperty(globalThis, 'webkitSpeechRecognition', { configurable: true, writable: true, value: supported ? SimulatedRecognition : undefined });
  if (navigator.mediaDevices) {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => {
      observation.microphoneRequests++;
      return Promise.reject(new Error('The simulated dictation test forbids physical microphone capture.'));
    } });
  }
  function emit({ id = observation.instances.length - 1, type, results, resultIndex = 0, error, stale = false }) {
    const instance = observation.instances[id];
    if (!instance) throw new Error(`No simulated recognition instance ${id}.`);
    const event = new Event(type);
    if (type === 'result') {
      const values = results.map(result => {
        const alternatives = [{ transcript: result.text, confidence: 0.95 }];
        alternatives.isFinal = result.final !== false; alternatives.item = index => alternatives[index];
        return alternatives;
      });
      values.item = index => values[index];
      Object.defineProperties(event, { results: { value: values }, resultIndex: { value: resultIndex } });
    }
    if (type === 'error') Object.defineProperty(event, 'error', { value: error });
    observation.events.push({ id, type, stale, error: error || null });
    if (stale) {
      instance.savedHandlers?.[type]?.call(instance, event);
      for (const listener of retained.get(instance).get(type) || []) {
        if (typeof listener === 'function') listener.call(instance, event);
        else listener.handleEvent(event);
      }
    } else {
      instance[`on${type}`]?.call(instance, event);
      instance.dispatchEvent(event);
    }
  }
  Object.defineProperty(globalThis, '__siteDictationFixture', { value: {
    emit,
    snapshot: () => ({ starts: observation.starts, stops: observation.stops, aborts: observation.aborts,
      microphoneRequests: observation.microphoneRequests, instances: observation.instances.length, events: observation.events.slice(),
      options: observation.instances.map(instance => ({ continuous: instance.continuous,
        interimResults: instance.interimResults, maxAlternatives: instance.maxAlternatives })) }),
    visibility(hidden) {
      Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    },
  } });
}

async function snapshot(page) { return page.evaluate(() => globalThis.__siteDictationFixture.snapshot()); }
async function emit(page, event) { await page.evaluate(value => globalThis.__siteDictationFixture.emit(value), event); }
async function settled(page) {
  // Give immediate deferred callbacks and common erroneous short restart loops
  // time to run; controller unit tests separately own long watchdog timers.
  await page.waitForTimeout(Math.min(180, remaining()));
}
async function idle(page) {
  await page.waitForFunction(() => document.getElementById('voice-start').getAttribute('aria-pressed') === 'false', null, { timeout: remaining() });
  assert.equal(await page.locator('#voice-label').textContent(), 'Speak');
  assert.equal(await page.locator('#voice-start').getAttribute('aria-busy'), 'false');
}
async function start(page, { listening = true } = {}) {
  const before = await snapshot(page);
  await page.locator('#voice-start').click({ timeout: remaining() });
  const after = await snapshot(page);
  assert.equal(after.starts, before.starts + 1, 'One deliberate Speak activation starts exactly one recognizer.');
  assert.deepEqual(after.options.at(-1), { continuous: false, interimResults: false, maxAlternatives: 1 });
  const id = after.instances - 1;
  if (listening) {
    await emit(page, { id, type: 'start' });
    await page.waitForFunction(() => document.getElementById('voice-label').textContent === 'Listening', null, { timeout: remaining() });
    assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'true');
  }
  return id;
}
async function assertNoRestart(page, starts) {
  await settled(page);
  assert.equal((await snapshot(page)).starts, starts, 'Recognition must wait for a fresh deliberate Speak activation.');
}
async function caseInContext(name, action, { supported = true } = {}) {
  const checkStarted = Date.now();
  const record = { name, supported, status: 'running' }; evidence.contexts.push(record);
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, permissions: [], serviceWorkers: 'block' });
  try {
    await context.clearPermissions();
    await context.addInitScript(installRecognitionFixture, { supported });
    // A regression must fail without creating a backend session or writing to a
    // service. These are aborts, never fabricated success/error HTTP responses.
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.startsWith('/api/unity/') || /(?:^|\.)openai\.com$/.test(url.hostname) ||
          !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        evidence.forbiddenRequests.push({ context: name, method: request.method(), url: request.url() });
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(remaining()); page.setDefaultNavigationTimeout(remaining(12000));
    page.on('pageerror', error => evidence.pageErrors.push({ context: name, message: error.message }));
    const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: remaining(12000) });
    assert.equal(response.status(), 200, 'The real application document must load.');
    await page.waitForFunction(() => ['ready', 'failed'].includes(document.body.dataset.boot), null, { timeout: remaining(12000) });
    assert.equal(await page.locator('body').getAttribute('data-boot'), 'ready');
    assert.equal(await page.locator('#input-mode').inputValue(), 'site', 'Site input must be the default.');
    assert.equal(await page.locator('#ai-options').isHidden(), true);
    assert.equal((await snapshot(page)).starts, 0, 'Boot must never start recognition.');
    await action(page, record);
    record.recognition = await snapshot(page);
    assert.equal(record.recognition.microphoneRequests, 0, 'Simulated recognition never needs getUserMedia.');
    assert.deepEqual(evidence.forbiddenRequests.filter(value => value.context === name), [], 'Site mode must make no AI/service request or HTTP write.');
    assert.deepEqual(evidence.pageErrors.filter(value => value.context === name), [], 'The real application must not throw.');
    record.status = 'passed'; evidence.checks.push(name);
  } catch (error) {
    record.status = 'failed'; record.error = error.message;
    if (activePage && !activePage.isClosed() && Date.now() < deadline) {
      try {
        const filename = `${name}.png`;
        await activePage.screenshot({ path: path.join(directory, filename), fullPage: true, timeout: remaining(2000) });
        evidence.screenshots.push(filename);
      } catch { /* The original assertion is the useful failure. */ }
    }
    throw error;
  } finally {
    record.durationMs = Date.now() - checkStarted;
    activePage = null;
    await context.close();
  }
}

(async () => {
  try {
    if (!target) target = await serveStagedSite();
    evidence.target = target.href;
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, timeout: remaining(12000) });
    await caseInContext('site-default-is-idle-and-stable', async page => {
      await idle(page);
      assert.match(await page.locator('#voice-hint').textContent(), /or use keyboard mic/i);
      assert.equal(await page.locator('#service-status').getAttribute('data-phase'), 'idle');
      assert.equal(await page.locator('#intention-input').isEnabled(), true);
      await settled(page); await idle(page); assert.equal((await snapshot(page)).starts, 0);
    });
    await caseInContext('finals-append-to-editable-draft-without-executing', async page => {
      await page.locator('#intention-input').fill('Existing draft.');
      const previousLog = await page.locator('#transcript').textContent();
      const id = await start(page);
      await emit(page, { id, type: 'result', results: [{ text: 'interim words', final: false }] });
      assert.equal(await page.locator('#intention-input').inputValue(), 'Existing draft.', 'Interim words must not overwrite the draft.');
      await emit(page, { id, type: 'result', results: [{ text: 'Open the manifesto.', final: true }] });
      await emit(page, { id, type: 'result', resultIndex: 1, results: [
        { text: 'Open the manifesto.', final: true }, { text: 'Then review', final: false },
      ] });
      assert.equal(await page.locator('#intention-input').inputValue(), 'Existing draft. Open the manifesto.');
      await emit(page, { id, type: 'result', resultIndex: 1, results: [
        { text: 'Open the manifesto.', final: true }, { text: 'Then review this.', final: true },
      ] });
      // Cumulative native result lists can include already-final indices again.
      await emit(page, { id, type: 'result', results: [
        { text: 'Open the manifesto.', final: true }, { text: 'Then review this.', final: true },
      ] });
      await emit(page, { id, type: 'end' });
      assert.equal(await page.locator('#intention-input').inputValue(), 'Existing draft. Open the manifesto. Then review this.', 'Each final result is appended once.');
      assert.equal(await page.locator('body').getAttribute('data-view'), 'unity', 'A dictated command waits for Send.');
      assert.equal(await page.locator('#transcript').textContent(), previousLog, 'Dictation alone is not a submitted turn.');
      assert.equal(await page.locator('#send-button').isEnabled(), true);
      await idle(page); await assertNoRestart(page, 1);
      await page.locator('#intention-input').fill('Edited after dictation.');
      assert.equal(await page.locator('#intention-input').inputValue(), 'Edited after dictation.');
    });
    await caseInContext('stop-rejects-retained-late-callbacks', async page => {
      await page.locator('#intention-input').fill('Keep this draft.');
      const id = await start(page);
      await page.locator('#stop-button').click();
      const stoppedStatus = await page.locator('#session-status').textContent();
      assert.equal((await snapshot(page)).aborts, 1, 'Stop must abort the owned recognition.');
      for (const event of [
        { type: 'result', results: [{ text: 'Late words must disappear.', final: true }] },
        { type: 'start' }, { type: 'error', error: 'network' }, { type: 'end' },
      ]) await emit(page, { id, stale: true, ...event });
      await idle(page); await assertNoRestart(page, 1);
      assert.equal(await page.locator('#intention-input').inputValue(), 'Keep this draft.');
      assert.equal(await page.locator('#session-status').textContent(), stoppedStatus, 'Old callbacks cannot replace current guidance.');
    });
    await caseInContext('rapid-speak-stop-does-not-revive-pending-start', async page => {
      await page.evaluate(() => { document.getElementById('voice-start').click(); document.getElementById('stop-button').click(); });
      const stopped = await snapshot(page);
      assert.equal(stopped.starts, 1); assert.equal(stopped.aborts, 1);
      await emit(page, { id: 0, type: 'start', stale: true });
      await emit(page, { id: 0, type: 'result', stale: true, results: [{ text: 'Too late.', final: true }] });
      await emit(page, { id: 0, type: 'end', stale: true });
      await idle(page); await assertNoRestart(page, 1);
      assert.equal(await page.locator('#intention-input').inputValue(), '');
    });
    await caseInContext('active-speak-click-stops-without-second-start', async page => {
      const id = await start(page);
      await page.locator('#voice-start').click();
      assert.equal((await snapshot(page)).aborts, 1, 'Clicking active Speak aborts the current recognizer.');
      await emit(page, { id, type: 'end', stale: true });
      await idle(page); await assertNoRestart(page, 1);
    });
    await caseInContext('manual-edit-owns-draft-over-late-final', async page => {
      const id = await start(page);
      await page.locator('#intention-input').fill('My corrected wording.');
      assert.equal((await snapshot(page)).aborts, 1, 'Manual input ends the dictation owner.');
      await emit(page, { id, type: 'result', stale: true, results: [{ text: 'Discard these old words.', final: true }] });
      await emit(page, { id, type: 'end', stale: true });
      await idle(page); await assertNoRestart(page, 1);
      assert.equal(await page.locator('#intention-input').inputValue(), 'My corrected wording.');
    });
    await caseInContext('permission-network-no-speech-errors-do-not-restart', async (page, record) => {
      record.errors = [];
      const draft = 'Keep my words across every recognition error.';
      await page.locator('#intention-input').fill(draft);
      for (const error of ['not-allowed', 'network', 'no-speech']) {
        const id = await start(page);
        await emit(page, { id, type: 'error', error });
        await emit(page, { id, type: 'end', stale: true });
        await idle(page); await assertNoRestart(page, id + 1);
        const message = await page.locator('#session-status').textContent();
        if (error === 'not-allowed') assert.match(message, /permission.*denied/i);
        if (error === 'network') {
          assert.match(message, /service.*connect|connection/i);
          assert.doesNotMatch(message, /permission.*denied/i);
        }
        if (error === 'no-speech') assert.match(message, /no speech/i);
        assert.equal(await page.locator('#intention-input').inputValue(), draft);
        assert.equal(await page.locator('#intention-input').isEnabled(), true);
        await page.locator('#text-toggle').click();
        assert.equal(await page.locator('#intention-input').evaluate(element => element === document.activeElement), true);
        record.errors.push({ error, message, automaticRestart: false });
      }
    });
    await caseInContext('synthetic-hidden-return-requires-new-speak', async (page, record) => {
      const id = await start(page);
      await page.evaluate(() => globalThis.__siteDictationFixture.visibility(true));
      assert.equal((await snapshot(page)).aborts, 1);
      await emit(page, { id, type: 'result', stale: true, results: [{ text: 'Hidden late result.', final: true }] });
      await emit(page, { id, type: 'end', stale: true });
      await page.evaluate(() => globalThis.__siteDictationFixture.visibility(false));
      await idle(page); await assertNoRestart(page, 1);
      assert.equal(await page.locator('#intention-input').inputValue(), '');
      const next = await start(page);
      await emit(page, { id: next, type: 'end' });
      await idle(page); await assertNoRestart(page, 2);
      record.visibility = 'synthetic document.hidden and visibilityState; no real background-tab claim';
    });
    await caseInContext('unsupported-recognition-retains-keyboard-fallback', async page => {
      await idle(page);
      await page.locator('#voice-start').click();
      assert.equal(await page.locator('#intention-input').evaluate(element => element === document.activeElement), true, 'Unsupported Speak reveals editable keyboard input.');
      await page.locator('#text-toggle').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#intention-input').evaluate(element => element === document.activeElement), true);
      await page.locator('#intention-input').fill('Written with the keyboard.');
      await page.locator('#keyboard-dictation').click();
      assert.equal(await page.locator('#intention-input').evaluate(element => element === document.activeElement), true);
      assert.equal(await page.locator('#intention-input').inputValue(), 'Written with the keyboard.');
      assert.equal((await snapshot(page)).starts, 0);
      assert.match(await page.locator('#dictation-help').textContent(), /keyboard|microphone|mic/i);
    }, { supported: false });
    await caseInContext('dictated-visit-note-needs-send-and-disappears-on-reload', async (page, record) => {
      const note = 'A dictated note kept only for this simulated verification visit.';
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click();
      await page.waitForFunction(() => document.body.dataset.view === 'constellation', null, { timeout: remaining() });
      await page.locator('#memory-session-mode').click();
      await page.waitForFunction(() => document.getElementById('memory-session-mode').getAttribute('aria-pressed') === 'true', null, { timeout: remaining() });
      await page.locator('.wordmark[data-navigate="unity"]').click();
      const id = await start(page);
      await emit(page, { id, type: 'result', results: [{ text: `Remember that ${note}`, final: true }] });
      await emit(page, { id, type: 'end' });
      assert.equal(await page.locator('#intention-input').inputValue(), `Remember that ${note}`);
      assert.equal(await page.locator('article.memory-card').count(), 0, 'Recognizing a note must not save it.');
      await page.locator('#send-button').click();
      await page.waitForFunction(() => document.getElementById('intention-input').value === '', null, { timeout: remaining() });
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click();
      const card = page.locator('article.memory-card:not(.memory-edge)').filter({ hasText: note });
      await card.waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await card.count(), 1, 'Send saves the exact recognized note once.');
      assert.equal(await page.locator('#memory-consent').isChecked(), false);
      record.beforeReloadRecognition = await snapshot(page);
      assert.equal(record.beforeReloadRecognition.microphoneRequests, 0);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) });
      await page.waitForFunction(() => document.body.dataset.boot === 'ready' && document.body.dataset.memory === 'ready', null, { timeout: remaining(12000) });
      assert.equal(await page.locator('article.memory-card').count(), 0);
      assert.equal(await page.locator('#intention-input').inputValue(), '');
      assert.equal(await page.locator('#memory-session-mode').getAttribute('aria-pressed'), 'false');
      assert.equal((await snapshot(page)).starts, 0, 'Reload must not resume recognition.');
    });
    assert.deepEqual(evidence.forbiddenRequests, []);
    assert.deepEqual(evidence.pageErrors, []);
    evidence.microphoneRequests = evidence.contexts.reduce((total, value) => total +
      value.recognition.microphoneRequests + (value.beforeReloadRecognition?.microphoneRequests || 0), 0);
    assert.equal(evidence.microphoneRequests, 0);
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed'; evidence.error = error.stack || error.message || String(error); process.exitCode = 1;
  } finally {
    writeEvidence();
    if (browser) {
      let timer;
      try { await Promise.race([browser.close(), new Promise(resolve => { timer = setTimeout(resolve, 1000); })]); }
      catch { /* Preserve the original verification result. */ }
      finally { clearTimeout(timer); }
    }
    if (localServer) {
      localServer.closeAllConnections?.();
      await new Promise(resolve => localServer.close(resolve));
    }
    process.stdout.write(`${JSON.stringify({ status: evidence.status, verification: evidence.verification, target: target?.href,
      checks: evidence.checks, error: evidence.error, limitations: evidence.limitations,
      artifact: path.join(directory, 'verification.json'), durationMs: evidence.durationMs })}\n`, () => {
      clearTimeout(hardDeadline); process.exit(process.exitCode || 0);
    });
  }
})();
