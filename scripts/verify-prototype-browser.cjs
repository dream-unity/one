'use strict';

// Real post-deployment browser verification. No request routing or fake application responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LIVE = 'https://dreamunity.one/prototype/';
const ORIGIN = new URL(LIVE).origin;
const BUDGET_MS = 180000;
const NOTE = 'Dream Unity browser verification note.';
const EDITED_NOTE = 'Dream Unity browser verification note, deliberately revised.';
const SECOND_NOTE = 'A second authored note for relationship verification.';
const DEVICE_NOTE = 'The existing device note stays on this device.';
const VISIT_NOTE = 'This deliberately temporary constellation note belongs only to this visit.';
const EDITED_VISIT_NOTE = 'This deliberately temporary constellation note was revised during this visit.';
const SECOND_VISIT_NOTE = 'A second temporary note for the visit relationship.';
const VISIT_DRAFT = 'Remember that this unsent visit draft must disappear when I leave.';
const INVALID_INVITE = `browser-verification-invalid-${require('node:crypto').randomUUID()}`;
const started = Date.now();
const deadline = started + BUDGET_MS - 10000;
const directory = path.resolve('output/stage5-browser');
fs.mkdirSync(directory, { recursive: true });
const evidence = { liveUrl: LIVE, expectedCommit: process.env.DREAMUNITY_EXPECTED_COMMIT || '',
  status: 'running', checks: [], unexercisedChecks: [], gateErrors: [], deployment: [], canonicalRelease: [], responses: [], failedRequests: [], pageErrors: [],
  consoleErrors: [], forbiddenRequests: [], screenshots: [], pageShows: [], historyRecovery: null, webStorageWriteEvents: [],
  publicationChecks: [], checkTimings: [], memoryEvidence: {}, visitEvidence: {}, voiceEvidence: {}, accessProbes: [],
  limitations: [
    'No authorized or paid conversation is created. Provider responses, actual microphone/audio, delayed remote hangup, and access expiry/revocation during an active session are not exercised.',
    'Correction requires an AI interpretation; its asynchronous ownership is not claimed by this unauthenticated live run.',
    'Configured-but-unavailable service is checked only when the deployed status or the single invalid-invitation probe returns that condition. A ready response is not evidence of provider usability.'
  ],
  capabilityProbes: [], scope: 'Real deployed UI and IndexedDB with passive native storage/microphone observation. One isolated context deliberately denies IndexedDB.open to verify the unavailable-storage path. A ready private service receives at most one obviously invalid invitation submission; every provider/session/text write remains forbidden. No mocked HTTP responses, microphone permission grants, or injected application state.' };
let browser, page, secondPage, accessProbeOpen = false;

function remaining(maximum = 8000) {
  const value = deadline - Date.now();
  if (value <= 0) throw new Error('The browser verification deadline expired.');
  return Math.max(1, Math.min(maximum, value));
}
function prototypeUrl(value) {
  try { const url = new URL(value); return url.origin === ORIGIN && url.pathname.startsWith(new URL(LIVE).pathname); }
  catch { return false; }
}
function summary() {
  const result = { status: evidence.status, liveUrl: LIVE, expectedCommit: evidence.expectedCommit,
    durationMs: Date.now() - started, checks: evidence.checks, unexercisedChecks: evidence.unexercisedChecks, gateErrors: evidence.gateErrors, screenshots: evidence.screenshots,
    pageShows: evidence.pageShows, historyRecovery: evidence.historyRecovery, limitations: evidence.limitations,
    voiceEvidence: evidence.voiceEvidence, canonicalRelease: evidence.canonicalRelease,
    artifact: 'output/stage5-browser/verification.json' };
  if (evidence.error) Object.assign(result, { error: evidence.error, prototypeHttp: evidence.responses,
    deployment: evidence.deployment, failedRequests: evidence.failedRequests,
    pageErrors: evidence.pageErrors, consoleErrors: evidence.consoleErrors });
  return result;
}
function writeEvidence() {
  evidence.durationMs = Date.now() - started;
  fs.writeFileSync(path.join(directory, 'verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
const hardDeadline = setTimeout(() => {
  evidence.status = 'failed'; evidence.error = `Browser verification exceeded its hard ${BUDGET_MS / 1000}-second deadline.`;
  writeEvidence(); console.error(JSON.stringify(summary())); process.exit(1);
}, BUDGET_MS);

async function check(name, action) {
  remaining(); const checkStarted = Date.now();
  try {
    const result = await action();
    if (result?.unexercised) evidence.unexercisedChecks.push({ name, reason: result.unexercised });
    else evidence.checks.push(name);
  } finally {
    evidence.checkTimings.push({ name, durationMs: Date.now() - checkStarted, passed: evidence.checks.includes(name),
      unexercised: evidence.unexercisedChecks.some(item => item.name === name) });
  }
}
async function screenshot(name) {
  await page.screenshot({ path: path.join(directory, name), fullPage: true, timeout: remaining(3000) });
  evidence.screenshots.push(name);
}
async function boot(target = page) {
  await target.waitForFunction(() => ['ready', 'failed'].includes(document.body.dataset.boot), null,
    { timeout: remaining(12000) });
  assert.equal(await target.locator('body').getAttribute('data-boot'), 'ready', 'the actual application module must start');
}
// Read actual committed storage without creating a database in a session-only visit.
async function readMemory(target = page) {
  return target.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some(item => item.name === 'dream-unity-constellation-v1')) return undefined;
    return new Promise((resolve, reject) => {
      let database; const timer = setTimeout(() => finish(new Error('Reading actual IndexedDB timed out.')), 2500);
      function finish(error, value) { clearTimeout(timer); database?.close(); error ? reject(error) : resolve(value); }
      const opening = indexedDB.open('dream-unity-constellation-v1', 1);
      opening.onerror = () => finish(new Error('The actual constellation database could not be read.'));
      opening.onblocked = () => finish(new Error('The actual constellation database is blocked.'));
      opening.onsuccess = () => {
        database = opening.result;
        if (!database.objectStoreNames.contains('records')) return finish(null, undefined);
        try {
          const request = database.transaction('records', 'readonly').objectStore('records').get('constellation');
          request.onerror = () => finish(new Error('The actual constellation record could not be read.'));
          request.onsuccess = () => finish(null, request.result);
        } catch (error) { finish(error); }
      };
    });
  });
}
async function viewIs(destination, target = page) {
  await target.waitForFunction(value => document.body.dataset.view === value, destination, { timeout: remaining() });
}
async function send(text, target = page) {
  await target.locator('#intention-input').fill(text, { timeout: remaining() });
  await target.locator('#send-button').click({ timeout: remaining() });
}
function noteCard(title, target = page) {
  return target.locator('article.memory-card:not(.memory-edge)').filter({ has: target.getByRole('heading', { name: title, exact: true }) });
}
async function waitForNote(title, target = page) {
  await noteCard(title, target).waitFor({ state: 'visible', timeout: remaining() });
}
async function waitForMemoryMessage(fragment, target = page) {
  await target.waitForFunction(text => document.querySelector('#constellation-list > .memory-status')?.textContent.includes(text), fragment, { timeout: remaining() });
}
async function confirmDialog(action, expectedText) {
  const dialog = page.waitForEvent('dialog', { timeout: remaining() });
  const operation = action();
  const opened = await dialog;
  assert.equal(opened.type(), 'confirm'); assert.match(opened.message(), expectedText);
  await opened.accept(); await operation;
}
async function rememberingIs(enabled, target = page) {
  await target.waitForFunction(value => document.getElementById('memory-consent').checked === value &&
    !document.getElementById('memory-consent').disabled &&
    document.getElementById('memory-status').textContent.includes(value ? 'saved notes' : 'Remembering is off'), enabled, { timeout: remaining() });
}
async function waitForAccessOrUnreadyService(target = page) {
  await target.waitForFunction(() => !document.getElementById('access-panel').hidden ||
    document.getElementById('service-status').dataset.phase === 'unavailable', null, { timeout: remaining() });
}
async function assertUnauthenticatedServiceShell(target = page) {
  const shell = await target.evaluate(() => ({
    phase: document.getElementById('service-status').dataset.phase,
    banner: document.getElementById('service-status').textContent,
    voiceLabel: document.getElementById('voice-label').textContent,
    voiceHint: document.querySelector('#voice-start .voice-activation-hint').textContent,
    voiceEnabled: !document.getElementById('voice-start').disabled,
    voicePressed: document.getElementById('voice-start').getAttribute('aria-pressed'),
    sessionStatus: document.getElementById('session-status').textContent,
    intentionHelp: document.getElementById('intention-help').textContent,
    sendEnabled: !document.getElementById('send-button').disabled,
    inputEnabled: !document.getElementById('intention-input').disabled,
    accessHidden: document.getElementById('access-panel').hidden,
  }));
  assert.ok(['available', 'unavailable'].includes(shell.phase), 'assert the settled service state');
  assert.equal(shell.voiceEnabled, true, 'the primary voice control must allow a deliberate availability recheck');
  assert.equal(shell.voicePressed, 'false', 'readiness must never claim active capture');
  assert.equal(shell.sendEnabled, true, 'local navigation and manual remembering must remain submit-able');
  assert.equal(shell.inputEnabled, true);
  if (shell.phase === 'unavailable') {
    assert.match(shell.voiceLabel, /voice off/i);
    assert.match(shell.voiceHint, /check availability/i);
    assert.match(shell.sessionStatus, /AI conversation is unavailable/i);
    assert.match(shell.sessionStatus, /explore.*(?:own )?notes/i);
    assert.match(shell.intentionHelp, /AI replies are unavailable/i);
    assert.match(shell.intentionHelp, /destination.*note.*constellation/i);
    assert.equal(shell.accessHidden, true, 'unavailable AI must not invite access entry');
  } else {
    assert.equal(shell.voiceLabel, 'Speak');
    assert.match(shell.banner, /configured.*invitation.*connect/i);
    assert.doesNotMatch(shell.banner, /conversation available/i,
      'configuration readiness alone cannot establish provider availability');
  }
  return shell;
}
// Record the real transient DOM before a fast status response can settle it.
// This observer only reads styles/geometry: it never delays or replaces a request.
async function captureServiceRecheck(selector, target = page) {
  await target.evaluate(() => {
    function rectangle(element) {
      const box = element.getBoundingClientRect();
      return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
    }
    function snapshot() {
      const voice = document.getElementById('voice-start');
      const style = getComputedStyle(voice);
      const background = style.backgroundColor.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').map(Number);
      let effectiveOpacity = 1;
      for (let element = voice; element; element = element.parentElement) effectiveOpacity *= Number(getComputedStyle(element).opacity);
      return {
        phase: document.getElementById('service-status').dataset.phase,
        disabled: voice.disabled, pressed: voice.getAttribute('aria-pressed'), busy: voice.getAttribute('aria-busy'),
        microphone: document.body.dataset.microphone,
        label: document.getElementById('voice-label').textContent,
        hint: document.getElementById('voice-hint').textContent,
        invitation: document.getElementById('voice-invitation').textContent,
        sessionStatus: document.getElementById('session-status').textContent,
        intentionHelp: document.getElementById('intention-help').textContent,
        retryText: document.getElementById('service-retry').textContent,
        opacity: Number(style.opacity), effectiveOpacity,
        backgroundColor: style.backgroundColor,
        backgroundAlpha: background?.length === 3 ? 1 : background?.length === 4 ? background[3] : null,
        paintOrder: { voice: Number(style.zIndex), artwork: Number(getComputedStyle(document.querySelector('.scene-art')).zIndex) || 0 },
        boxes: Object.fromEntries(['#unity-scene', '#voice-start', '#voice-start > svg', '#voice-label', '#voice-hint',
          '#voice-invitation', '.quiet-navigation'].map(selector => [selector, rectangle(document.querySelector(selector))])),
        conversationTop: rectangle(document.querySelector('.conversation')).y,
      };
    }
    const observation = { before: snapshot(), checking: [] };
    const observer = new MutationObserver(() => {
      if (document.getElementById('service-status').dataset.phase === 'checking' && observation.checking.length < 16) {
        observation.checking.push(snapshot());
      }
    });
    for (const id of ['voice-start', 'service-status', 'voice-invitation', 'session-status']) {
      observer.observe(document.getElementById(id), { attributes: true, childList: true, characterData: true, subtree: true });
    }
    Object.defineProperty(globalThis, '__dreamUnityServiceRecheckObservation', { configurable: true,
      value: { finish() { observer.disconnect(); return { ...observation, after: snapshot() }; } } });
  });
  const isStatus = value => new URL(value.url()).pathname === '/api/unity/status' &&
    (typeof value.method === 'function' ? value.method() : value.request().method()) === 'GET';
  const [request, response] = await Promise.all([
    target.waitForRequest(isStatus, { timeout: remaining(12000) }),
    target.waitForResponse(isStatus, { timeout: remaining(12000) }),
    target.locator(selector).click({ timeout: remaining() }),
  ]);
  assert.equal(response.request(), request, 'pending UI must correspond to the actual recheck request');
  await target.waitForFunction(() => ['available', 'unavailable'].includes(document.getElementById('service-status').dataset.phase) &&
    !document.getElementById('service-retry').disabled, null, { timeout: remaining(12000) });
  const observation = await target.evaluate(() => {
    const value = globalThis.__dreamUnityServiceRecheckObservation.finish();
    delete globalThis.__dreamUnityServiceRecheckObservation;
    return value;
  });
  return { response, observation: { control: selector, request: { method: request.method(), url: request.url(), status: response.status() }, ...observation } };
}
function assertStableVoiceRecheck(observation) {
  assert.ok(observation.checking.length, `${observation.control} must expose the actual pending service state`);
  for (const sample of [observation.before, ...observation.checking, observation.after]) {
    assert.equal(sample.opacity, 1, 'the voice control must retain its opaque artwork cover');
    assert.equal(sample.effectiveOpacity, 1, 'no translucent ancestor may reveal the bitmap text beneath the control');
    assert.equal(sample.backgroundAlpha, 1, `the control background must stay opaque: ${sample.backgroundColor}`);
    assert.ok(sample.paintOrder.voice > sample.paintOrder.artwork, 'the opaque control must paint over the artwork');
    assert.equal(sample.pressed, 'false', 'checking availability must never imply active microphone capture');
    assert.ok(!['permission', 'connecting', 'listening', 'speaking', 'connected', 'ready'].includes(sample.microphone),
      `an unauthenticated service recheck cannot engage the microphone: ${sample.microphone}`);
  }
  for (const sample of observation.checking) {
    assert.equal(sample.phase, 'checking');
    assert.equal(sample.disabled, true, 'checking temporarily prevents duplicate voice activation');
    assert.equal(sample.busy, 'true', 'the central control must expose the real pending check accessibly');
    assert.match(sample.retryText, /checking/i, 'the service retry control must explain the actual pending request');
    assert.equal(sample.sessionStatus, observation.before.sessionStatus, 'a recheck must retain the settled session guidance');
    assert.equal(sample.intentionHelp, observation.before.intentionHelp, 'a recheck must retain the settled writing guidance');
    assert.equal(sample.label, observation.before.label, 'a recheck must retain the settled central voice label');
    assert.equal(sample.hint, observation.before.hint, 'a recheck must retain the settled central voice hint');
    assert.equal(sample.invitation, observation.before.invitation, 'a recheck must retain the surrounding invitation');
    for (const [selector, baseline] of Object.entries(observation.before.boxes)) {
      for (const coordinate of ['x', 'y', 'width', 'height']) {
        assert.ok(Math.abs(sample.boxes[selector][coordinate] - baseline[coordinate]) <= 0.5,
          `${selector} ${coordinate} moved during the service recheck: ${baseline[coordinate]} → ${sample.boxes[selector][coordinate]}`);
      }
    }
    assert.ok(Math.abs(sample.conversationTop - observation.before.conversationTop) <= 0.5,
      'rechecking must not shift the conversation below the scene');
  }
  assert.equal(observation.after.disabled, false, 'the settled voice control must allow another deliberate availability recheck');
  assert.equal(observation.after.busy, 'false', 'a completed check must clear the central pending indicator');
}
async function visitIs(enabled, target = page) {
  await target.waitForFunction(value => document.getElementById('memory-session-mode').getAttribute('aria-pressed') === String(value) &&
    (value ? !document.getElementById('memory-share-consent').disabled && document.getElementById('memory-status').textContent.includes('For this visit')
      : !document.getElementById('memory-session-mode').disabled), enabled, { timeout: remaining() });
}
// Native methods keep their original receiver, arguments, return values and errors.
// The counters observe attempted browser writes, without changing application state.
function observeBrowserCapabilities() {
  const observation = { indexedDBWrites: [], webStorageWrites: [], microphoneRequests: 0 };
  Object.defineProperty(globalThis, '__dreamUnityBrowserObservation', { value: observation });
  for (const method of ['add', 'put', 'delete', 'clear']) {
    const native = IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method] = function (...args) {
      observation.indexedDBWrites.push({ database: this.transaction.db.name, store: this.name, method });
      return Reflect.apply(native, this, args);
    };
  }
  const nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (...args) {
    let area = 'unknown';
    try { area = this === globalThis.localStorage ? 'localStorage' : this === globalThis.sessionStorage ? 'sessionStorage' : area; } catch { /* Native call below retains the browser's actual behavior. */ }
    const write = { area, key: typeof args[0] === 'string' ? args[0] : '[non-string key]' };
    observation.webStorageWrites.push(write);
    // Forward metadata only to the runner, so a BFCache-triggered reload cannot
    // erase evidence that the departed document wrote a supposedly temporary draft.
    globalThis.__dreamUnityObserveWebStorageWrite?.({ ...write, url: location.href, documentTimeOrigin: performance.timeOrigin }).catch(() => {});
    return Reflect.apply(nativeSetItem, this, args);
  };
  const nativeGetUserMedia = navigator.mediaDevices?.getUserMedia;
  if (nativeGetUserMedia) {
    navigator.mediaDevices.getUserMedia = function (...args) {
      observation.microphoneRequests += 1;
      globalThis.__dreamUnityObserveMicrophone?.().catch(() => {});
      return Reflect.apply(nativeGetUserMedia, this, args);
    };
  }
}
async function browserObservation(target = page) {
  return target.evaluate(() => structuredClone(globalThis.__dreamUnityBrowserObservation));
}
async function storageWritesFromDocument(documentTimeOrigin) {
  // Wait behind observation messages already sent by the departed document.
  await page.evaluate(() => globalThis.__dreamUnityObserveWebStorageWrite({ barrier: true }));
  return evidence.webStorageWriteEvents.filter(value => value.documentTimeOrigin === documentTimeOrigin && prototypeUrl(value.url));
}
async function assertNoVisitStorage(before, target = page) {
  const after = await browserObservation(target);
  assert.deepEqual(after.indexedDBWrites, before.indexedDBWrites, 'visit notes and relationships must make no IndexedDB writes');
  assert.deepEqual(after.webStorageWrites, before.webStorageWrites, 'visit notes and relationships must make no localStorage/sessionStorage writes');
  const leaked = await target.evaluate(fragments => {
    for (const storage of [localStorage, sessionStorage]) {
      for (let index = 0; index < storage.length; index++) {
        const value = storage.getItem(storage.key(index)) || '';
        if (fragments.some(fragment => value.includes(fragment))) return true;
      }
    }
    return false;
  }, [VISIT_NOTE, EDITED_VISIT_NOTE, SECOND_VISIT_NOTE, VISIT_DRAFT]);
  assert.equal(leaked, false, 'temporary note text must never be copied into browser Web Storage');
  return after;
}
async function deploymentIsCurrent(context) {
  function gateError(code, message) { return Object.assign(new Error(message), { deploymentGate: true, code }); }
  if (!/^[a-f0-9]{40}$/.test(evidence.expectedCommit)) {
    throw gateError('EXPECTED_COMMIT_INVALID', 'CI must identify the exact deployed commit.');
  }
  // Only an absent/stale deployment receives bounded propagation retries. Application failures do not.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const url = `${LIVE}build-info.json?ci=${evidence.expectedCommit}&attempt=${attempt}`;
    const response = await context.request.get(url, { timeout: remaining(6000) });
    const status = response.status(); let value;
    if (status === 200) value = await response.json();
    evidence.deployment.push({ attempt, status, contentType: response.headers()['content-type'] || '',
      sourceCommit: value?.sourceCommit || null, contractVersion: value?.contractVersion || null });
    if (status === 200 && value?.sourceCommit === evidence.expectedCommit) {
      if (value.contractVersion !== 'du-prototype/1.0') {
        throw gateError('CONTRACT_VERSION_MISMATCH', 'The exact commit exposes an unexpected public contract version.');
      }
      return;
    }
    if (status !== 404 && status !== 200) throw new Error(`Deployment verification returned HTTP ${status}.`);
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, remaining(2000))));
  }
  throw gateError('DEPLOYMENT_COMMIT_UNVERIFIED', 'The public deployment did not expose the expected commit within the bounded propagation checks.');
}
async function canonicalDeploymentIsCurrent(observeRequest) {
  function gateError(code, message) { return Object.assign(new Error(message), { deploymentGate: true, code }); }
  if (!/^[a-f0-9]{40}$/.test(evidence.expectedCommit)) {
    throw gateError('EXPECTED_COMMIT_INVALID', 'CI must identify the exact deployed commit.');
  }
  const propagationDeadline = Math.min(deadline, Date.now() + 20000);
  function budget(maximum = 6000) {
    const available = propagationDeadline - Date.now();
    if (available <= 0) throw gateError('CANONICAL_COMMIT_UNVERIFIED', 'The canonical page did not expose the expected release within its propagation budget.');
    return Math.min(remaining(maximum), available);
  }
  function expectedAsset(value, pathname) {
    if (!value) return false;
    const url = new URL(value);
    return url.origin === ORIGIN && url.pathname === pathname && url.searchParams.get('v') === evidence.expectedCommit;
  }
  // A fresh context has no browser cache or storage from the cache-busted run.
  // Each attempt navigates the exact visitor URL; no routing, headers, or query
  // parameters are used to bypass the CDN representation under examination.
  for (let attempt = 1; attempt <= 3; attempt++) {
    budget();
    const isolated = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: [] });
    const observed = { attempt, requestedUrl: LIVE, responses: [], failedRequests: [], pageErrors: [] };
    evidence.canonicalRelease.push(observed);
    let coherent = false;
    try {
      await isolated.clearPermissions();
      await isolated.exposeBinding('__dreamUnityObserveMicrophone', () => { evidence.voiceEvidence.microphoneRequests += 1; });
      await isolated.addInitScript(observeBrowserCapabilities);
      isolated.on('request', observeRequest);
      const canonical = await isolated.newPage();
      canonical.on('pageerror', error => observed.pageErrors.push(error.message));
      canonical.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === ORIGIN && (url.pathname.startsWith('/prototype/') || url.pathname === '/symbol-motion.js') &&
            ['script', 'stylesheet'].includes(response.request().resourceType())) {
          observed.responses.push({ url: response.url(), status: response.status(),
            contentType: response.headers()['content-type'] || '', resourceType: response.request().resourceType() });
        }
      });
      canonical.on('requestfailed', request => {
        if (['script', 'stylesheet'].includes(request.resourceType())) {
          observed.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
        }
      });
      const response = await canonical.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: budget() });
      observed.http = response?.status(); observed.finalUrl = canonical.url();
      assert.equal(observed.finalUrl, LIVE, 'the canonical visitor URL must remain bare and must not redirect to a cache-busted page');
      if (![200, 404].includes(observed.http)) throw new Error(`Canonical deployment verification returned HTTP ${observed.http}.`);
      if (observed.http === 200) {
        observed.document = await canonical.evaluate(() => ({
          sourceCommit: document.querySelector('meta[name="dream-unity-release"]')?.content || null,
          stylesheet: [...document.querySelectorAll('link[rel="stylesheet"]')].map(element => element.href),
          scripts: [...document.querySelectorAll('script[src]')].map(element => element.src),
        }));
        const documentCurrent = observed.document.sourceCommit === evidence.expectedCommit &&
          observed.document.stylesheet.length === 1 && expectedAsset(observed.document.stylesheet[0], '/prototype/styles.css') &&
          observed.document.scripts.length === 1 && expectedAsset(observed.document.scripts[0], '/prototype/boot.js');
        if (documentCurrent) {
          // Correct document identity with broken application startup is an
          // application failure, not a reason to retry until it happens to pass.
          await canonical.waitForFunction(() => ['ready', 'failed'].includes(document.body.dataset.boot), null,
            { timeout: budget(8000) });
          observed.running = await canonical.evaluate(() => ({
            boot: document.body.dataset.boot, sourceCommit: document.body.dataset.release || null,
            displayedCommit: document.getElementById('release-running')?.textContent.trim() || null,
            microphone: document.body.dataset.microphone,
            voicePressed: document.getElementById('voice-start')?.getAttribute('aria-pressed'),
          }));
          assert.equal(observed.running.boot, 'ready', 'the canonical page must boot its actual application module');
          assert.deepEqual(observed.pageErrors, [], 'the canonical release must not have runtime errors');
          assert.deepEqual(observed.failedRequests, [], 'the canonical release must load all required resources');
          const scripts = observed.responses.filter(value => value.resourceType === 'script');
          const styles = observed.responses.filter(value => value.resourceType === 'stylesheet');
          coherent = observed.running.sourceCommit === evidence.expectedCommit && observed.running.displayedCommit === evidence.expectedCommit &&
            ['/prototype/boot.js', '/prototype/main.js', '/prototype/release.js', '/symbol-motion.js']
              .every(pathname => scripts.some(value => expectedAsset(value.url, pathname))) &&
            scripts.every(value => new URL(value.url).searchParams.get('v') === evidence.expectedCommit) &&
            styles.length === 1 && expectedAsset(styles[0].url, '/prototype/styles.css');
          if (coherent) {
            assert.ok(scripts.every(value => value.status === 200 && /(?:java|ecma)script/i.test(value.contentType)),
              'the canonical release must load executable modules successfully');
            assert.ok(styles.every(value => value.status === 200 && /text\/css/i.test(value.contentType)),
              'the canonical release must load its actual stylesheet successfully');
            assert.equal(observed.running.voicePressed, 'false');
            assert.ok(!['permission', 'connecting', 'listening', 'speaking', 'connected', 'ready'].includes(observed.running.microphone),
              'canonical release verification must not engage the microphone');
          }
        }
      }
      assert.equal((await browserObservation(canonical)).microphoneRequests, 0, 'visiting the canonical page must not request microphone access');
      observed.coherent = coherent;
    } finally { await isolated.close(); }
    if (coherent) return;
    // Only an absent, stale, unversioned, or mixed release is allowed to propagate.
    if (attempt < 3 && propagationDeadline - Date.now() > 1000) {
      await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, budget(2000))));
    } else break;
  }
  throw gateError('CANONICAL_COMMIT_UNVERIFIED', 'The bare canonical page did not serve a coherent document, stylesheet, boot script, and running module graph for the expected release.');
}

(async () => {
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, timeout: remaining(10000) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: [] });
    await context.clearPermissions();
    evidence.voiceEvidence.microphoneRequests = 0;
    await context.exposeBinding('__dreamUnityObserveMicrophone', () => { evidence.voiceEvidence.microphoneRequests += 1; });
    await context.exposeBinding('__dreamUnityObserveWebStorageWrite', (_, value) => {
      if (value?.barrier === true) return;
      evidence.webStorageWriteEvents.push(value);
    });
    await context.addInitScript(observeBrowserCapabilities);
    try { await check('published-commit', () => deploymentIsCurrent(context)); }
    catch (error) {
      if (!error.deploymentGate) throw error;
      evidence.gateErrors.push({ code: error.code, message: error.message });
      // Continue safe functional diagnostics, while keeping version approval failed.
    }
    page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(12000);
    // Observe native lifecycle events without changing application behavior.
    await page.exposeBinding('__dreamUnityObservePageShow', ({ frame }, value) => {
      if (frame === page.mainFrame() && typeof value?.persisted === 'boolean' && evidence.pageShows.length < 20) {
        evidence.pageShows.push({ url: value.url, persisted: value.persisted });
      }
    });
    await page.addInitScript(() => {
      addEventListener('pageshow', event => {
        globalThis.__dreamUnityObservePageShow({ url: location.href, persisted: event.persisted }).catch(() => {});
      });
    });
    const sharedPrototypeRequests = new WeakSet();
    context.on('response', response => {
      if (prototypeUrl(response.url()) || sharedPrototypeRequests.has(response.request())) evidence.responses.push({ url: response.url(), status: response.status(),
        contentType: response.headers()['content-type'] || '', resourceType: response.request().resourceType() });
      if (new URL(response.url()).pathname === '/api/unity/status') {
        evidence.voiceEvidence.statusResponses ||= [];
        evidence.voiceEvidence.statusResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] || '' });
      }
    });
    context.on('requestfailed', request => {
      if (prototypeUrl(request.url())) evidence.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
    });
    page.on('pageerror', error => { if (prototypeUrl(page.url())) evidence.pageErrors.push({ message: error.message, stack: error.stack || '' }); });
    page.on('console', message => { if (prototypeUrl(page.url()) && message.type() === 'error') evidence.consoleErrors.push(message.text()); });
    function observeRequest(request) {
      const url = new URL(request.url());
      if (url.origin === ORIGIN && url.pathname === '/symbol-motion.js') {
        // Bind provenance when requested: a late old-home response can arrive after Back.
        try { if (prototypeUrl(request.frame().url())) sharedPrototypeRequests.add(request); } catch { /* No document frame owns this request. */ }
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
        (url.pathname.startsWith('/api/unity/') || /(?:^|\.)openai\.com$/.test(url.hostname))) {
        let allowedRejectionProbe = false;
        if (accessProbeOpen && request.method() === 'POST' && url.href === evidence.voiceEvidence.accessProbeUrl &&
            evidence.accessProbes.length === 0 && !request.headers().authorization) {
          try { allowedRejectionProbe = JSON.stringify(request.postDataJSON()) === JSON.stringify({ version: 1, inviteCode: INVALID_INVITE }); }
          catch { /* Unexpected request bodies remain forbidden. */ }
        }
        (allowedRejectionProbe ? evidence.accessProbes : evidence.forbiddenRequests).push({ method: request.method(), url: request.url() });
      }
    }
    context.on('request', observeRequest);
    try { await check('canonical-url-serves-the-exact-running-release', () => canonicalDeploymentIsCurrent(observeRequest)); }
    catch (error) {
      if (!error.deploymentGate) throw error;
      evidence.gateErrors.push({ code: error.code, message: error.message });
      // Keep the canonical release gate failed while collecting the existing diagnostics.
    }
    await check('real-module-boot', async () => {
      const response = await page.goto(`${LIVE}?ci=${evidence.expectedCommit}`, { waitUntil: 'domcontentloaded', timeout: remaining(12000) });
      assert.equal(response.status(), 200); await boot();
      assert.equal(await page.locator('body').getAttribute('data-view'), 'unity');
      assert.equal(await page.locator('#stop-button').isVisible(), true);
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      await screenshot('unity-desktop.png');
    });
    const identity = await page.evaluate(() => performance.timeOrigin);
    await check('keyboard-skip-write-stop-and-accessible-status', async () => {
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.skip-link').evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#main-content').evaluate(element => element === document.activeElement), true);
      await page.getByRole('button', { name: 'Write', exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('textbox', { name: 'Your intention or question' }).evaluate(element => element === document.activeElement), true);
      await page.getByRole('button', { name: 'Stop', exact: true }).focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.getElementById('announcement').textContent === 'Microphone and speaking stopped.', null, { timeout: remaining() });
      assert.equal(await page.locator('#transcript').getAttribute('role'), 'log');
      assert.equal(await page.locator('#announcement').getAttribute('aria-live'), 'polite');
      assert.equal(await page.getByRole('link', { name: 'Exit', exact: true }).isVisible(), true);
    });
    await check('stop-acknowledgement-cannot-overwrite-the-next-local-navigation', async () => {
      // Invoke the real controls in one task, so an old deferred Stop acknowledgement
      // cannot hide behind Playwright's waits between separate clicks. No state is injected.
      await page.evaluate(() => {
        document.getElementById('stop-button').click();
        document.querySelector('.quiet-navigation [data-navigate="dream-world"]').click();
      });
      await viewIs('dream-world');
      assert.equal(await page.locator('#announcement').textContent(), 'Opened Dream World.');
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      await page.locator('.wordmark[data-navigate="unity"]').click({ timeout: remaining() }); await viewIs('unity');
      evidence.voiceEvidence.stopAcknowledgement = { nextNavigationOwnsAnnouncement: true, activeRemoteHangup: 'unexercised' };
    });
    await check('service-readiness-and-safe-retry-never-request-microphone', async () => {
      await page.waitForFunction(() => ['available', 'unavailable'].includes(document.getElementById('service-status').dataset.phase),
        null, { timeout: remaining(12000) });
      const initialPhase = await page.locator('#service-status').getAttribute('data-phase');
      const initialCode = await page.locator('#service-status').getAttribute('data-code');
      const initialShell = await assertUnauthenticatedServiceShell();
      const previousCount = evidence.voiceEvidence.statusResponses?.length || 0;
      const retry = await captureServiceRecheck('#service-retry');
      const response = retry.response;
      assert.ok((evidence.voiceEvidence.statusResponses?.length || 0) > previousCount, 'retry must fetch the actual service status again');
      const phase = await page.locator('#service-status').getAttribute('data-phase');
      const code = await page.locator('#service-status').getAttribute('data-code');
      const message = await page.locator('#service-status').textContent();
      const retryShell = await assertUnauthenticatedServiceShell();
      if (response.status() === 404) {
        assert.equal(phase, 'unavailable'); assert.equal(code, 'SERVICE_DEPLOYMENT_MISSING');
        assert.match(message, /deploy|route|not installed/i);
        assert.doesNotMatch(message, /microphone.*(?:denied|blocked)|permission.*(?:denied|blocked)/i);
      } else if (response.status() === 200) {
        const status = await response.json();
        assert.equal(typeof status.ready, 'boolean');
        assert.equal(phase, status.ready ? 'available' : 'unavailable');
        if (!status.ready) {
          assert.equal(code, 'SERVICE_NOT_READY');
          assert.match(message, /configuration|configured|setup|not ready|turned off/i);
          assert.doesNotMatch(message, /microphone.*(?:denied|blocked)|permission.*(?:denied|blocked)/i);
        }
        evidence.voiceEvidence.publicReadiness = { ready: status.ready, reasonCodes: status.reasonCodes || [] };
        evidence.voiceEvidence.configuredUnavailable = !status.ready && status.voiceConfigured === true && status.textConfigured === true ? 'exercised' : 'unexercised';
      }
      evidence.voiceEvidence.accessProbeUrl = new URL('/api/unity/access', response.url()).href;
      const forbiddenBeforeRecheck = evidence.forbiddenRequests.length;
      const statusResponsesBeforeRecheck = evidence.voiceEvidence.statusResponses?.length || 0;
      const primaryRecheck = await captureServiceRecheck('#voice-start');
      assert.equal((await browserObservation()).microphoneRequests, 0);
      assert.equal(evidence.voiceEvidence.microphoneRequests, 0);
      assert.equal(evidence.forbiddenRequests.length, forbiddenBeforeRecheck,
        'a primary availability recheck must not create access, paid sessions, or text requests');
      assert.ok((evidence.voiceEvidence.statusResponses?.length || 0) > statusResponsesBeforeRecheck,
        'the primary control must actually recheck the deployed service');
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      const primaryRecheckShell = await assertUnauthenticatedServiceShell();
      if (await page.locator('#service-status').getAttribute('data-phase') === 'unavailable') {
        assert.equal(await page.locator('#access-panel').isVisible(), false, 'an unavailable service must not show a misleading invitation prompt');
      } else assert.equal(await page.locator('#access-panel').isVisible(), true, 'a ready private service must require an invitation before microphone capture');
      evidence.voiceEvidence.readinessRetry = { initialPhase, initialCode, retryHttp: response.status(), phase, code,
        microphoneRequests: 0, unauthorizedSpeakBlocked: true, noPaidRequests: true,
        shell: { initial: initialShell, retry: retryShell, primaryRecheck: primaryRecheckShell },
        unavailableBranch: phase === 'unavailable' ? 'exercised' : 'unexercised' };
      evidence.voiceEvidence.recheckPresentation = [retry.observation, primaryRecheck.observation];
    });
    await check('pending-availability-rechecks-stay-opaque-and-layout-stable', async () => {
      assert.equal(evidence.voiceEvidence.recheckPresentation.length, 2);
      for (const observation of evidence.voiceEvidence.recheckPresentation) assertStableVoiceRecheck(observation);
    });
    await check('ready-service-invitation-errors-stay-readable-without-microphone-capture', async () => {
      if (await page.locator('#service-status').getAttribute('data-phase') !== 'available') {
        evidence.voiceEvidence.invalidInvitation = { status: 'unexercised', reason: 'The deployed conversation service is unavailable.' };
        return { unexercised: evidence.voiceEvidence.invalidInvitation.reason };
      }
      assert.equal(await page.locator('#access-panel').isVisible(), true);
      const beforeMessage = await page.locator('#access-status').textContent();
      const responsePromise = page.waitForResponse(response => response.url() === evidence.voiceEvidence.accessProbeUrl &&
        response.request().method() === 'POST', { timeout: remaining(12000) });
      accessProbeOpen = true;
      let response;
      try {
        await page.locator('#access-invite').fill(INVALID_INVITE, { timeout: remaining() });
        await page.locator('#access-form button[type="submit"]').click({ timeout: remaining() });
        response = await responsePromise;
      } finally { accessProbeOpen = false; }
      assert.ok([401, 429, 503].includes(response.status()), 'an obviously invalid invitation must not create access');
      const failure = await response.json();
      assert.ok(['ACCESS_DENIED', 'ACCESS_RATE_LIMITED', 'SERVICE_NOT_READY', 'ADMISSION_UNAVAILABLE', 'ADMISSION_CONFIGURATION_ERROR'].includes(failure.code));
      await page.waitForFunction(previous => {
        const status = document.getElementById('access-status');
        return status.textContent.trim() && status.textContent !== previous;
      }, beforeMessage, { timeout: remaining() });
      assert.equal(await page.locator('#access-status').getAttribute('role'), 'status');
      const message = await page.locator('#access-status').textContent();
      assert.notEqual(message.trim(), failure.code, 'the UI must provide an explanation rather than only an internal error code');
      assert.equal(await page.locator('#access-invite').inputValue(), '', 'rejected invitation text must be cleared');
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#resume-button').isVisible(), false);
      assert.equal((await browserObservation()).microphoneRequests, 0);
      if (failure.code === 'ACCESS_DENIED' || failure.code === 'ACCESS_RATE_LIMITED') {
        assert.equal(await page.locator('#access-status').isVisible(), true);
        assert.match(message, /invitation|invite|access|attempt/i);
      } else {
        assert.equal(await page.locator('#service-status').getAttribute('data-phase'), 'unavailable');
        assert.equal(await page.locator('#service-status').getAttribute('data-code'), failure.code);
        assert.equal(await page.locator('#service-status').isVisible(), true);
        assert.match(await page.locator('#service-status').textContent(), /configuration|configured|access service|unavailable|ready/i);
        assert.equal(await page.locator('#access-panel').isVisible(), false, 'an admission outage must replace the invitation prompt with honest service guidance');
        evidence.voiceEvidence.admissionFailureShell = await assertUnauthenticatedServiceShell();
        evidence.voiceEvidence.configuredUnavailable = 'exercised-by-access';
      }
      evidence.voiceEvidence.invalidInvitation = { status: failure.code === 'ACCESS_DENIED' ? 'rejection-exercised' : 'blocked-before-invitation-check',
        http: response.status(), code: failure.code, explanationVisible: true, microphoneRequests: 0 };
    });
    await check('public-world-history-and-restricted-semantic-focus', async () => {
      await page.locator('.quiet-navigation [data-navigate="dream-world"]').focus(); await page.keyboard.press('Enter');
      await viewIs('dream-world');
      assert.equal(await page.locator('#view-title').evaluate(element => element === document.activeElement), true);
      assert.equal(await page.locator('#resume-button').isVisible(), false);
      assert.doesNotMatch(await page.locator('#session-status').textContent(), /Resume/);
      await page.locator('.world-choice[data-navigate="minds-eye"]').click({ timeout: remaining() });
      await viewIs('minds-eye');
      assert.equal(await page.locator('[data-view-panel="minds-eye"] .availability').textContent(), 'Coming soon.');
      await page.goBack({ timeout: remaining() }); await viewIs('dream-world');
      await page.goForward({ timeout: remaining() }); await viewIs('minds-eye');
      await page.locator('.compact-worlds [data-focus-world="machine"]').click({ timeout: remaining() });
      await viewIs('minds-eye');
      assert.match(await page.locator('#view-status').textContent(), /restricted/i);
      assert.equal(await page.locator('.compact-worlds [data-focus-world="machine"]').getAttribute('aria-pressed'), 'true');
      await page.locator('.compact-worlds [data-focus-world="maker"]').click({ timeout: remaining() });
      assert.match(await page.locator('#view-status').textContent(), /restricted/i);
      await page.locator('.wordmark').focus(); await page.keyboard.press('Enter'); await viewIs('unity');
      assert.equal(await page.locator('#arrival-title').evaluate(element => element === document.activeElement), true);
      assert.equal(await page.evaluate(() => performance.timeOrigin), identity);
    });
    await check('manifesto-inline-home-preserves-shell', async () => {
      await page.locator('.quiet-navigation [data-navigate="manifesto"]').click({ timeout: remaining() });
      await page.locator('#manifesto-content[data-loaded="true"]').waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await page.locator('body').getAttribute('data-view'), 'manifesto');
      await screenshot('manifesto-desktop.png');
      await page.locator('#manifesto-content a[data-navigate="unity"]').first().click({ timeout: remaining() });
      await page.waitForFunction(() => document.body.dataset.view === 'unity', null, { timeout: remaining() });
      assert.equal(new URL(page.url()).pathname, '/prototype/');
      assert.equal(await page.evaluate(() => performance.timeOrigin), identity);
    });
    await check('temporary-note-choice-is-visible-and-explained-before-device-storage', async () => {
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click({ timeout: remaining() });
      await viewIs('constellation'); await rememberingIs(false);
      const choice = page.getByRole('button', { name: 'For this visit', exact: true });
      assert.equal(await choice.isVisible(), true); assert.equal(await choice.isEnabled(), true);
      assert.equal(await choice.getAttribute('aria-pressed'), 'false', 'temporary notes require a deliberate choice');
      assert.equal(await choice.getAttribute('aria-describedby'), 'memory-session-help');
      assert.match(await page.locator('.visit-memory-choice > strong').textContent(), /temporary.*no device storage/i);
      const help = page.locator('#memory-session-help');
      assert.equal(await help.isVisible(), true);
      assert.match(await help.textContent(), /temporar/i); assert.match(await help.textContent(), /reload.*exit.*clear/i);
      assert.match(await help.textContent(), /device notes.*separat/i);
      assert.equal(await choice.evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById('memory-consent')) & Node.DOCUMENT_POSITION_FOLLOWING)), true,
        'the temporary choice must be discoverable before the device-storage opt-in');
      await choice.focus();
      assert.equal(await choice.evaluate(element => element === document.activeElement), true);
      evidence.visitEvidence.discoverability = { visibleBeforeStorageConsent: true, keyboardFocusable: true,
        accessibleRetentionDescription: true, offByDefault: true };
    });
    let saved;
    await check('no-consent-no-personal-persistence-and-retained-offline-input', async () => {
      await rememberingIs(false);
      const message = 'Remember that this unconsented browser note must remain unsaved.';
      await send(message);
      await waitForAccessOrUnreadyService();
      assert.equal(await page.locator('#intention-input').inputValue(), message);
      const unconsented = await readMemory();
      assert.deepEqual(unconsented?.nodes || [], []); assert.deepEqual(unconsented?.edges || [], []);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot();
      await rememberingIs(false);
      assert.equal(await page.locator('article.memory-card').count(), 0);
      assert.doesNotMatch(await page.locator('#transcript').textContent(), /unconsented browser note/);
      const reloaded = await readMemory();
      assert.deepEqual(reloaded?.nodes || [], []); assert.deepEqual(reloaded?.edges || [], []);
      for (const message of ['"Open the manifesto"', 'What would happen if I said open the manifesto?', 'Open the manifesto and open Dream World', 'Open Empire Dawn']) {
        await send(message);
        await waitForAccessOrUnreadyService();
        assert.equal(await page.locator('#intention-input').inputValue(), message);
        assert.equal(await page.locator('body').getAttribute('data-view'), 'constellation');
      }
    });
    await check('named-restricted-worlds-explain-without-opening-activities', async () => {
      for (const world of ['machine', 'maker']) {
        await send(`Open Dream ${world}`);
        await page.waitForFunction(value => document.querySelector(`.compact-worlds [data-focus-world="${value}"]`)?.getAttribute('aria-pressed') === 'true', world, { timeout: remaining() });
        assert.equal(await page.locator('body').getAttribute('data-view'), 'constellation');
        assert.match(await page.locator('#view-status').textContent(), /restricted|not available/i);
        assert.equal(await page.locator('#intention-input').inputValue(), '');
      }
    });
    await check('exact-local-note-with-separate-sharing-consent', async () => {
      await page.locator('#memory-consent').waitFor({ state: 'visible', timeout: remaining() });
      await page.waitForFunction(() => !document.getElementById('memory-consent').disabled, null, { timeout: remaining() });
      assert.equal(await page.locator('#memory-consent').isChecked(), false);
      await page.locator('#memory-consent').check({ timeout: remaining() });
      await page.waitForFunction(() => document.getElementById('memory-status').textContent.includes('0 saved notes'), null, { timeout: remaining() });
      assert.equal(await page.locator('#memory-share-consent').isChecked(), false);
      await page.locator('#intention-input').fill(`Remember that ${NOTE}`, { timeout: remaining() });
      await page.locator('#send-button').click({ timeout: remaining() });
      await page.locator('.memory-card').filter({ has: page.getByRole('heading', { name: NOTE, exact: true }) }).waitFor({ state: 'visible', timeout: remaining() });
      saved = await readMemory();
      assert.equal(saved.nodes.length, 1); assert.equal(saved.nodes[0].text, NOTE); assert.equal(saved.nodes[0].title, NOTE);
      assert.equal(saved.nodes[0].authorship, 'user'); assert.equal(saved.consent.storageEnabled, true);
      assert.equal(saved.consent.conversationUseEnabled, false);
    });
    await check('actual-indexeddb-persists-after-reload', async () => {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot();
      await page.locator('.memory-card').filter({ has: page.getByRole('heading', { name: NOTE, exact: true }) }).waitFor({ state: 'visible', timeout: remaining() });
      const reloaded = await readMemory(); assert.deepEqual(reloaded.nodes, saved.nodes);
      assert.equal(reloaded.revision, saved.revision); assert.equal(reloaded.consent.conversationUseEnabled, false);
    });
    await check('note-edit-preserves-identity-and-archive-is-recoverable', async () => {
      await page.getByRole('button', { name: `Edit ${NOTE}`, exact: true }).click({ timeout: remaining() });
      assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).evaluate(element => element === document.activeElement), true);
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill(EDITED_NOTE);
      await page.getByRole('button', { name: 'Save changes', exact: true }).click({ timeout: remaining() });
      await page.locator('.memory-editor').waitFor({ state: 'hidden', timeout: remaining() });
      const edited = await readMemory();
      assert.equal(edited.nodes.length, 1); assert.equal(edited.nodes[0].id, saved.nodes[0].id);
      assert.equal(edited.nodes[0].text, EDITED_NOTE); assert.ok(edited.nodes[0].revision > saved.nodes[0].revision);
      await page.getByRole('button', { name: `Archive ${NOTE}`, exact: true }).click({ timeout: remaining() });
      await page.getByRole('button', { name: `Make ${NOTE} active`, exact: true }).waitFor({ state: 'visible', timeout: remaining() });
      const archived = await readMemory(); assert.equal(archived.nodes[0].id, saved.nodes[0].id); assert.equal(archived.nodes[0].status, 'archived');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot();
      await page.getByRole('button', { name: `Make ${NOTE} active`, exact: true }).click({ timeout: remaining() });
      await noteCard(NOTE).locator('.memory-meta').filter({ hasText: 'active' }).waitFor({ state: 'visible', timeout: remaining() });
      const recovered = await readMemory(); assert.equal(recovered.nodes[0].id, saved.nodes[0].id); assert.equal(recovered.nodes[0].text, EDITED_NOTE); assert.equal(recovered.nodes[0].status, 'active');
      evidence.memoryEvidence.editArchiveRecovery = { sameId: true, revisionAdvanced: true, survivesReload: true };
    });
    await check('oversize-note-rejected-and-draft-retained', async () => {
      await page.getByRole('button', { name: 'Add a note', exact: true }).click({ timeout: remaining() });
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A deliberately invalid oversized note');
      const oversized = 'x'.repeat(1201);
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill(oversized);
      await page.getByRole('button', { name: 'Remember this note', exact: true }).click({ timeout: remaining() });
      await waitForMemoryMessage('Not saved.');
      assert.equal(await page.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), oversized);
      assert.equal((await readMemory()).nodes.length, 1);
      await page.getByRole('button', { name: 'Cancel editing', exact: true }).click({ timeout: remaining() });
    });
    await check('authored-relationship-and-transcript-clear-separation', async () => {
      await send(`Remember that ${SECOND_NOTE}`); await waitForNote(SECOND_NOTE);
      const relations = page.locator('.memory-relations');
      await relations.locator('summary').click({ timeout: remaining() });
      await relations.getByLabel('From', { exact: true }).selectOption({ label: NOTE });
      await relations.getByLabel('To', { exact: true }).selectOption({ label: SECOND_NOTE });
      await relations.getByLabel('Relationship', { exact: true }).selectOption('supports');
      await relations.getByLabel('Optional label', { exact: true }).fill('This explicit connection was authored in the browser.');
      await relations.getByRole('button', { name: 'Save this relationship', exact: true }).click({ timeout: remaining() });
      await page.locator('article.memory-edge').waitFor({ state: 'visible', timeout: remaining() });
      const connected = await readMemory(); assert.equal(connected.edges.length, 1);
      assert.equal(connected.edges[0].from, saved.nodes[0].id); assert.equal(connected.edges[0].relation, 'supports'); assert.equal(connected.edges[0].authorship, 'user');
      await screenshot('constellation-desktop.png');
      await page.getByRole('button', { name: 'Clear this conversation', exact: true }).click({ timeout: remaining() });
      await page.waitForFunction(() => document.getElementById('announcement').textContent.includes('Conversation cleared'), null, { timeout: remaining() });
      const afterClear = await readMemory(); assert.deepEqual(afterClear.nodes, connected.nodes); assert.deepEqual(afterClear.edges, connected.edges);
      assert.doesNotMatch(await page.locator('#transcript').textContent(), /Remember that/);
    });
    await check('second-tab-stale-edit-cannot-overwrite-newer-commit', async () => {
      secondPage = await context.newPage(); secondPage.setDefaultTimeout(8000);
      secondPage.on('pageerror', error => evidence.pageErrors.push({ page: 'second-tab', message: error.message }));
      await secondPage.goto(`${LIVE}?view=constellation`, { waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot(secondPage); await waitForNote(NOTE, secondPage);
      await secondPage.getByRole('button', { name: `Edit ${NOTE}`, exact: true }).click({ timeout: remaining() });
      const staleDraft = 'A stale second-tab edit must not replace the newer saved note.';
      await secondPage.getByRole('textbox', { name: 'Note', exact: true }).fill(staleDraft);
      await page.bringToFront();
      await page.getByRole('button', { name: `Edit ${NOTE}`, exact: true }).click({ timeout: remaining() });
      const currentText = `${EDITED_NOTE} Current first-tab version.`;
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill(currentText);
      await page.getByRole('button', { name: 'Save changes', exact: true }).click({ timeout: remaining() });
      await page.locator('.memory-editor').waitFor({ state: 'hidden', timeout: remaining() });
      await secondPage.bringToFront();
      await secondPage.locator('.memory-editor .memory-error').waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await secondPage.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), staleDraft);
      await secondPage.getByRole('button', { name: 'Save changes', exact: true }).click({ timeout: remaining() });
      await waitForMemoryMessage('Not saved.', secondPage);
      assert.equal((await readMemory(secondPage)).nodes.find(node => node.id === saved.nodes[0].id).text, currentText);
      assert.equal(await secondPage.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), staleDraft);
      await secondPage.getByRole('button', { name: 'Reload current version', exact: true }).click({ timeout: remaining() });
      assert.equal(await secondPage.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), currentText);
      await secondPage.getByRole('button', { name: 'Cancel editing', exact: true }).click({ timeout: remaining() });
      evidence.memoryEvidence.staleTab = { rejected: true, draftRetained: true, savedVersionRecoverable: true };
      await page.bringToFront();
    });
    await check('node-delete-removes-relationships-in-both-real-tabs', async () => {
      await page.getByRole('button', { name: `Review deleting ${NOTE}`, exact: true }).click({ timeout: remaining() });
      const confirmation = page.getByRole('group', { name: `Confirm deleting ${NOTE}`, exact: true });
      await confirmation.getByRole('button', { name: 'Delete this note', exact: true }).click({ timeout: remaining() });
      await noteCard(NOTE).waitFor({ state: 'hidden', timeout: remaining() });
      await noteCard(NOTE, secondPage).waitFor({ state: 'hidden', timeout: remaining() });
      const deleted = await readMemory(); assert.equal(deleted.nodes.length, 1); assert.equal(deleted.nodes[0].title, SECOND_NOTE); assert.deepEqual(deleted.edges, []);
      assert.equal(await page.locator('article.memory-edge').count(), 0); assert.equal(await secondPage.locator('article.memory-edge').count(), 0);
      assert.deepEqual(await readMemory(secondPage), deleted);
      evidence.memoryEvidence.deletion = { nodeRemoved: true, edgesRemoved: true, bothTabsObserved: true };
    });
    await check('cross-tab-revocation-clears-sharing-and-blocks-old-tab-saves', async () => {
      await page.locator('#memory-share-consent').check({ timeout: remaining() });
      await page.waitForFunction(() => document.getElementById('memory-status').textContent.includes('Choose which notes'), null, { timeout: remaining() });
      await noteCard(SECOND_NOTE).getByRole('checkbox').check({ timeout: remaining() });
      await waitForMemoryMessage('Only these selected');
      await secondPage.getByRole('button', { name: `Edit ${SECOND_NOTE}`, exact: true }).click({ timeout: remaining() });
      await secondPage.getByRole('textbox', { name: 'Title', exact: true }).fill('Revoked second-tab draft');
      await secondPage.getByRole('textbox', { name: 'Note', exact: true }).fill('This open draft must not restore revoked storage.');
      await page.bringToFront();
      await confirmDialog(() => page.locator('#memory-revoke').click({ timeout: remaining() }), /Turn remembering off and delete/);
      await rememberingIs(false); await rememberingIs(false, secondPage);
      assert.equal(await secondPage.locator('.memory-editor').count(), 0);
      await secondPage.bringToFront();
      const attempt = 'Remember that an old tab cannot silently restore revoked remembering.';
      await send(attempt, secondPage);
      await waitForAccessOrUnreadyService(secondPage);
      assert.equal(await secondPage.locator('#intention-input').inputValue(), attempt);
      const revoked = await readMemory(secondPage); assert.deepEqual(revoked.nodes, []); assert.deepEqual(revoked.edges, []);
      assert.equal(revoked.consent.storageEnabled, false); assert.equal(revoked.consent.conversationUseEnabled, false);
      // Renewing consent in the same document must not resurrect the erased editor.
      await secondPage.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true, secondPage);
      assert.equal(await secondPage.locator('.memory-editor').count(), 0);
      await secondPage.getByRole('button', { name: 'Add a note', exact: true }).click({ timeout: remaining() });
      assert.equal(await secondPage.getByRole('textbox', { name: 'Title', exact: true }).inputValue(), '');
      assert.equal(await secondPage.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), '');
      await secondPage.getByRole('button', { name: 'Cancel editing', exact: true }).click({ timeout: remaining() });
      await secondPage.locator('#memory-consent').uncheck({ timeout: remaining() }); await rememberingIs(false, secondPage); await rememberingIs(false);
      await secondPage.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot(secondPage); await rememberingIs(false, secondPage);
      assert.deepEqual((await readMemory(secondPage)).nodes, []);
      evidence.memoryEvidence.revocation = { bothTabsOff: true, nodesAndEdgesRemoved: true, oldTabSaveBlocked: true, erasedEditorCannotReturnAfterReconsent: true, survivesReload: true };
      await secondPage.close(); secondPage = null; await page.bringToFront();
    });
    await check('delete-all-requires-fresh-consent-and-leaves-no-records', async () => {
      await page.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true);
      await send(`Remember that ${NOTE}`); await waitForNote(NOTE);
      await page.getByRole('button', { name: `Edit ${NOTE}`, exact: true }).click({ timeout: remaining() });
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill('This private device edit must be erased with its graph.');
      await confirmDialog(() => page.locator('#memory-clear').click({ timeout: remaining() }), /Delete all saved notes and connections/);
      await rememberingIs(false);
      const cleared = await readMemory(); assert.deepEqual(cleared.nodes, []); assert.deepEqual(cleared.edges, []);
      assert.equal(cleared.consent.storageEnabled, false); assert.equal(cleared.consent.conversationUseEnabled, false);
      assert.equal(await page.locator('article.memory-card').count(), 0);
      await page.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true);
      assert.equal(await page.locator('.memory-editor').count(), 0);
      await page.getByRole('button', { name: 'Add a note', exact: true }).click({ timeout: remaining() });
      assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue(), '');
      assert.equal(await page.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), '');
      await page.getByRole('button', { name: 'Cancel editing', exact: true }).click({ timeout: remaining() });
      await page.locator('#memory-consent').uncheck({ timeout: remaining() }); await rememberingIs(false);
    });
    let deviceBaseline, visitObservation;
    await check('explicit-visit-mode-keeps-device-record-and-separate-sharing', async () => {
      await page.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true);
      await send(`Remember that ${DEVICE_NOTE}`); await waitForNote(DEVICE_NOTE);
      deviceBaseline = await readMemory();
      visitObservation = await browserObservation();
      await page.locator('#memory-session-mode').click({ timeout: remaining() }); await visitIs(true);
      assert.equal(await page.locator('#memory-consent').isChecked(), false);
      assert.equal(await page.locator('#memory-share-consent').isDisabled(), false);
      assert.equal(await page.locator('#memory-share-consent').isChecked(), false);
      assert.match(await page.locator('#memory-status').textContent(), /reload|refresh/i);
      assert.match(await page.locator('#memory-status').textContent(), /exit/i);
      assert.equal(await noteCard(DEVICE_NOTE).count(), 0, 'device notes must not be copied into the temporary graph');
      assert.deepEqual(await readMemory(), deviceBaseline, 'choosing visit mode must preserve the prior device record');
      await assertNoVisitStorage(visitObservation);
      evidence.visitEvidence.explicitMode = { deviceGraphPreserved: true, deviceNotesNotCopied: true, sharingOffByDefault: true };
    });
    await check('visit-note-edit-and-relationship-use-no-browser-storage', async () => {
      await send(`Remember that ${VISIT_NOTE}`); await waitForNote(VISIT_NOTE);
      await page.getByRole('button', { name: `Edit ${VISIT_NOTE}`, exact: true }).click({ timeout: remaining() });
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill(EDITED_VISIT_NOTE);
      await page.locator('.memory-editor [data-focus-key="save-note"]').click({ timeout: remaining() });
      await page.locator('.memory-editor').waitFor({ state: 'hidden', timeout: remaining() });
      assert.equal(await noteCard(VISIT_NOTE).getByText(EDITED_VISIT_NOTE, { exact: true }).isVisible(), true);
      await send(`Remember that ${SECOND_VISIT_NOTE}`); await waitForNote(SECOND_VISIT_NOTE);
      const relations = page.locator('.memory-relations');
      await relations.locator('summary').click({ timeout: remaining() });
      await relations.getByLabel('From', { exact: true }).selectOption({ label: VISIT_NOTE });
      await relations.getByLabel('To', { exact: true }).selectOption({ label: SECOND_VISIT_NOTE });
      await relations.getByLabel('Relationship', { exact: true }).selectOption('supports');
      await relations.getByLabel('Optional label', { exact: true }).fill('A relationship authored only during this visit.');
      await relations.locator('[data-focus-key="save-new-edge"]').click({ timeout: remaining() });
      await page.locator('article.memory-edge').waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await page.locator('article.memory-edge').count(), 1);
      await page.getByRole('button', { name: `Edit the relationship from ${VISIT_NOTE} to ${SECOND_VISIT_NOTE}`, exact: true }).click({ timeout: remaining() });
      const edgeEditor = page.locator('.memory-edge-editor');
      const revisedLabel = 'This temporary relationship was deliberately revised.';
      await edgeEditor.getByLabel('Optional label', { exact: true }).fill(revisedLabel);
      await edgeEditor.locator('[data-focus-key="save-edge"]').click({ timeout: remaining() });
      await edgeEditor.waitFor({ state: 'hidden', timeout: remaining() });
      assert.equal(await page.locator('article.memory-edge').getByText(revisedLabel, { exact: true }).isVisible(), true);
      await page.locator('#memory-share-consent').check({ timeout: remaining() });
      await page.waitForFunction(() => document.getElementById('memory-status').textContent.includes('Choose which notes'), null, { timeout: remaining() });
      await noteCard(VISIT_NOTE).getByRole('checkbox').check({ timeout: remaining() });
      await waitForMemoryMessage('Only these selected');
      await assertNoVisitStorage(visitObservation);
      assert.deepEqual(await readMemory(), deviceBaseline);
      await screenshot('constellation-visit-desktop.png');
      evidence.visitEvidence.editRelationship = { noteEditVisible: true, relationshipEditVisible: true, explicitSharingUsable: true, indexedDBWrites: 0, webStorageWrites: 0 };
    });
    await check('visit-navigation-retains-notes-and-relationships-in-same-document', async () => {
      const documentIdentity = await page.evaluate(() => performance.timeOrigin);
      await page.getByRole('link', { name: 'Back to the centre', exact: true }).click({ timeout: remaining() }); await viewIs('unity');
      await page.locator('.quiet-navigation [data-navigate="dream-world"]').click({ timeout: remaining() }); await viewIs('dream-world');
      await page.getByRole('link', { name: 'Back to the centre', exact: true }).click({ timeout: remaining() }); await viewIs('unity');
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click({ timeout: remaining() }); await viewIs('constellation');
      await visitIs(true); await waitForNote(VISIT_NOTE); await waitForNote(SECOND_VISIT_NOTE);
      assert.equal(await noteCard(VISIT_NOTE).getByText(EDITED_VISIT_NOTE, { exact: true }).isVisible(), true);
      assert.equal(await page.locator('article.memory-edge').count(), 1);
      assert.equal(await page.evaluate(() => performance.timeOrigin), documentIdentity);
      await assertNoVisitStorage(visitObservation);
      evidence.visitEvidence.navigation = { sameDocument: true, notesAndRelationshipsRetained: true };
    });
    await check('visit-clear-erases-editor-copies-while-sharing-revocation-retains-authored-drafts', async () => {
      const draftTitle = 'An unsaved private visit edit';
      const draftText = 'This draft must disappear when I delete the visit graph.';
      const edgeLabel = 'This unsaved relationship edit must also disappear.';
      const relationDraftLabel = 'An unsaved new connection belongs only to this visit graph.';
      await page.getByRole('button', { name: `Edit ${VISIT_NOTE}`, exact: true }).click({ timeout: remaining() });
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill(draftTitle);
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill(draftText);
      await page.getByRole('button', { name: `Edit the relationship from ${VISIT_NOTE} to ${SECOND_VISIT_NOTE}`, exact: true }).click({ timeout: remaining() });
      await page.locator('.memory-edge-editor').getByLabel('Optional label', { exact: true }).fill(edgeLabel);
      const relations = page.locator('.memory-relations');
      if (!await relations.evaluate(element => element.open)) await relations.locator('summary').click({ timeout: remaining() });
      await relations.getByLabel('From', { exact: true }).selectOption({ label: VISIT_NOTE });
      await relations.getByLabel('To', { exact: true }).selectOption({ label: SECOND_VISIT_NOTE });
      await relations.getByLabel('Optional label', { exact: true }).fill(relationDraftLabel);
      await page.locator('#memory-share-consent').uncheck({ timeout: remaining() });
      await page.waitForFunction(() => document.getElementById('memory-status').textContent.includes('notes are not included in conversation'), null, { timeout: remaining() });
      assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue(), draftTitle);
      assert.equal(await page.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), draftText);
      assert.equal(await page.locator('.memory-edge-editor').getByLabel('Optional label', { exact: true }).inputValue(), edgeLabel);
      assert.equal(await relations.getByLabel('Optional label', { exact: true }).inputValue(), relationDraftLabel);
      await confirmDialog(() => page.locator('#memory-clear').click({ timeout: remaining() }), /Delete all saved notes and connections from this visit/);
      await page.waitForFunction(() => document.querySelectorAll('#constellation-list article.memory-card').length === 0 &&
        document.querySelector('#constellation-list .memory-editor') === null, null, { timeout: remaining() });
      await visitIs(true);
      assert.equal(await page.locator('.memory-edge-editor').count(), 0);
      assert.equal(await page.locator('#memory-share-consent').isChecked(), false);
      await page.getByRole('button', { name: 'Add a note', exact: true }).click({ timeout: remaining() });
      assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue(), '');
      assert.equal(await page.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), '');
      await page.getByRole('button', { name: 'Cancel editing', exact: true }).click({ timeout: remaining() });
      await send(`Remember that ${VISIT_NOTE}`); await waitForNote(VISIT_NOTE);
      await send(`Remember that ${SECOND_VISIT_NOTE}`); await waitForNote(SECOND_VISIT_NOTE);
      await relations.locator('summary').click({ timeout: remaining() });
      assert.equal(await relations.getByLabel('From', { exact: true }).inputValue(), '');
      assert.equal(await relations.getByLabel('To', { exact: true }).inputValue(), '');
      assert.equal(await relations.getByLabel('Optional label', { exact: true }).inputValue(), '');
      assert.deepEqual(await readMemory(), deviceBaseline);
      await assertNoVisitStorage(visitObservation);
      evidence.visitEvidence.draftErasure = { sharingRevocationRetainsDrafts: true, noteEditorRemovedAndFreshNoteEmpty: true,
        newRelationshipDraftCleared: true, deletedRelationshipEditorHidden: true,
        freshEditorsEmpty: true, deviceGraphPreserved: true, indexedDBWrites: 0, webStorageWrites: 0 };
    });
    await check('visit-to-device-switch-does-not-promote-temporary-notes', async () => {
      await confirmDialog(() => page.locator('#memory-consent').check({ timeout: remaining() }), /visit|temporary|session/i);
      await rememberingIs(true); await visitIs(false); await waitForNote(DEVICE_NOTE);
      const restored = await readMemory();
      assert.deepEqual(restored.nodes, deviceBaseline.nodes); assert.deepEqual(restored.edges, deviceBaseline.edges);
      assert.equal(await noteCard(VISIT_NOTE).count(), 0); assert.equal(await noteCard(SECOND_VISIT_NOTE).count(), 0);
      assert.equal(await page.locator('#memory-share-consent').isChecked(), false);
      evidence.visitEvidence.modeSwitch = { priorDeviceNotesRestored: true, temporaryNotesPromoted: false, sharingOffByDefault: true };
      deviceBaseline = restored;
    });
    await check('ending-visit-memory-clears-only-the-active-temporary-graph', async () => {
      const before = await browserObservation();
      await page.locator('#memory-session-mode').click({ timeout: remaining() }); await visitIs(true);
      await send(`Remember that ${VISIT_NOTE}`); await waitForNote(VISIT_NOTE);
      assert.equal(await page.locator('#memory-revoke').textContent(), 'End session memory');
      await confirmDialog(() => page.locator('#memory-revoke').click({ timeout: remaining() }), /visit|temporary|session/i);
      await rememberingIs(false); await visitIs(false);
      assert.equal(await noteCard(VISIT_NOTE).count(), 0);
      assert.deepEqual(await readMemory(), deviceBaseline);
      await assertNoVisitStorage(before);
      await page.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true); await waitForNote(DEVICE_NOTE);
      const restored = await readMemory(); assert.deepEqual(restored.nodes, deviceBaseline.nodes); assert.deepEqual(restored.edges, deviceBaseline.edges);
      deviceBaseline = restored;
      evidence.visitEvidence.endSession = { temporaryGraphCleared: true, deviceGraphPreserved: true, indexedDBWrites: 0, webStorageWrites: 0 };
    });
    await check('visit-reload-clears-temporary-graph-and-preserves-device-notes', async () => {
      await page.locator('#memory-session-mode').click({ timeout: remaining() }); await visitIs(true);
      await send(`Remember that ${VISIT_NOTE}`); await waitForNote(VISIT_NOTE);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot();
      await viewIs('constellation'); await visitIs(false); await waitForNote(DEVICE_NOTE);
      assert.equal(await noteCard(VISIT_NOTE).count(), 0); assert.equal(await page.locator('article.memory-edge').count(), 0);
      assert.deepEqual(await readMemory(), deviceBaseline);
      assert.doesNotMatch(await page.locator('#transcript').textContent(), /temporary constellation note/);
      evidence.visitEvidence.reload = { temporaryGraphCleared: true, deviceGraphPreserved: true };
    });
    await check('visit-exit-and-native-back-clear-temporary-memory', async () => {
      for (const departure of ['ordinaryNavigation', 'exit']) {
        await page.locator('#memory-session-mode').click({ timeout: remaining() }); await visitIs(true);
        await send(`Remember that ${VISIT_NOTE}`); await waitForNote(VISIT_NOTE);
        await page.locator('#intention-input').fill(VISIT_DRAFT, { timeout: remaining() });
        const oldDocument = await page.evaluate(() => performance.timeOrigin);
        const eventsBeforeDeparture = evidence.pageShows.length;
        assert.deepEqual(await storageWritesFromDocument(oldDocument), []);
        if (departure === 'exit') await page.locator('#exit-link').click({ timeout: remaining(6000) });
        else await page.goto(new URL('/', LIVE).href, { waitUntil: 'domcontentloaded', timeout: remaining(6000) });
        await page.waitForURL(new URL('/', LIVE).href, { waitUntil: 'domcontentloaded', timeout: remaining(6000) });
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: remaining(7000) });
        await page.waitForFunction(previous => document.body.dataset.boot === 'ready' && performance.timeOrigin !== previous,
          oldDocument, { timeout: remaining(8000) });
        await boot(); await visitIs(false); await waitForNote(DEVICE_NOTE);
        assert.equal(await noteCard(VISIT_NOTE).count(), 0); assert.equal(await page.locator('article.memory-edge').count(), 0);
        assert.deepEqual(await readMemory(), deviceBaseline);
        assert.equal(await page.locator('#intention-input').inputValue(), '', 'leaving a visit must discard its unsent draft');
        assert.deepEqual(await storageWritesFromDocument(oldDocument), [],
          'neither visit departure nor BFCache restoration may persist its unsent draft');
        assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
        const restoredFromCache = evidence.pageShows.slice(eventsBeforeDeparture).some(value => prototypeUrl(value.url) && value.persisted);
        evidence.visitEvidence[departure] = { temporaryGraphClearedAfterBack: true, deviceGraphPreserved: true,
          unsentDraftCleared: true, departedDocumentWebStorageWrites: 0, voiceOff: true,
          bfcacheObserved: restoredFromCache, bfcacheDraftBranch: restoredFromCache ? 'exercised' : 'unexercised' };
      }
      await confirmDialog(() => page.locator('#memory-clear').click({ timeout: remaining() }), /Delete all saved notes and connections/);
      await rememberingIs(false);
    });
    await check('deleting-separate-device-notes-preserves-the-active-visit-and-its-draft', async () => {
      await page.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true);
      await send(`Remember that ${DEVICE_NOTE}`); await waitForNote(DEVICE_NOTE);
      await page.locator('#memory-session-mode').click({ timeout: remaining() }); await visitIs(true);
      await send(`Remember that ${VISIT_NOTE}`); await waitForNote(VISIT_NOTE);
      await page.getByRole('button', { name: `Edit ${VISIT_NOTE}`, exact: true }).click({ timeout: remaining() });
      const draft = 'The active visit draft survives deletion of separate device notes.';
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill(draft);
      await confirmDialog(() => page.locator('#memory-forget-device').click({ timeout: remaining() }), /Delete all device notes and connections/);
      await page.waitForFunction(() => document.getElementById('announcement').textContent === 'Device notes and connections deleted.', null, { timeout: remaining() });
      const clearedDevice = await readMemory();
      assert.deepEqual(clearedDevice.nodes, []); assert.deepEqual(clearedDevice.edges, []);
      assert.equal(clearedDevice.consent.storageEnabled, false);
      await visitIs(true); await waitForNote(VISIT_NOTE);
      assert.equal(await page.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), draft);
      assert.equal(await noteCard(DEVICE_NOTE).count(), 0);
      await confirmDialog(() => page.locator('#memory-revoke').click({ timeout: remaining() }), /visit|temporary|session/i);
      await rememberingIs(false); await visitIs(false);
      assert.equal(await page.locator('.memory-editor').count(), 0);
      assert.equal(await noteCard(VISIT_NOTE).count(), 0);
      assert.deepEqual(await readMemory(), clearedDevice);
      evidence.visitEvidence.separateDeviceDeletion = { deviceGraphCleared: true, temporaryGraphPreserved: true,
        temporaryDraftPreserved: true, subsequentEndVisitErasesDraft: true };
    });
    await check('unavailable-indexeddb-allows-explicit-visit-mode', async () => {
      const restricted = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: [] });
      restricted.on('request', observeRequest);
      await restricted.exposeBinding('__dreamUnityObserveMicrophone', () => { evidence.voiceEvidence.microphoneRequests += 1; });
      await restricted.clearPermissions(); await restricted.addInitScript(observeBrowserCapabilities);
      await restricted.addInitScript(() => {
        IDBFactory.prototype.open = function () { throw new DOMException('Device storage is disabled for this acceptance probe.', 'SecurityError'); };
      });
      evidence.capabilityProbes.push({ capability: 'IndexedDB.open', intervention: 'Throws SecurityError in an isolated context; deployed HTTP responses and application state are unchanged.' });
      const restrictedPage = await restricted.newPage(); restrictedPage.setDefaultTimeout(8000);
      restrictedPage.on('pageerror', error => evidence.pageErrors.push({ page: 'unavailable-indexeddb', message: error.message }));
      await restrictedPage.goto(`${LIVE}?view=constellation`, { waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot(restrictedPage);
      await restrictedPage.waitForFunction(() => document.getElementById('memory-consent').disabled, null, { timeout: remaining() });
      assert.equal(await restrictedPage.locator('#memory-session-mode').isEnabled(), true);
      assert.match(await restrictedPage.locator('#memory-status').textContent(), /storage|device/i);
      assert.equal(await restrictedPage.locator('#memory-session-mode').getAttribute('aria-pressed'), 'false');
      const before = await browserObservation(restrictedPage);
      await restrictedPage.locator('#memory-session-mode').click({ timeout: remaining() }); await visitIs(true, restrictedPage);
      assert.equal(await restrictedPage.locator('#memory-share-consent').isChecked(), false);
      await send(`Remember that ${VISIT_NOTE}`, restrictedPage); await waitForNote(VISIT_NOTE, restrictedPage);
      await assertNoVisitStorage(before, restrictedPage);
      await restrictedPage.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot(restrictedPage);
      await restrictedPage.waitForFunction(() => document.getElementById('memory-consent').disabled, null, { timeout: remaining() });
      assert.equal(await noteCard(VISIT_NOTE, restrictedPage).count(), 0); await visitIs(false, restrictedPage);
      assert.equal((await browserObservation(restrictedPage)).microphoneRequests, 0);
      evidence.visitEvidence.unavailableIndexedDB = { explicitChoiceRequired: true, noteUsable: true, indexedDBWrites: 0, webStorageWrites: 0, reloadClears: true };
      await restricted.close();
    });
    await check('unknown-route-normalizes-with-readable-recovery', async () => {
      await page.goto(`${LIVE}?view=unpublished-browser-check`, { waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot(); await viewIs('unity');
      assert.equal(new URL(page.url()).searchParams.has('view'), false);
      assert.match(await page.locator('#transcript').textContent(), /destination is not available.*back at the centre/i);
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
    });
    await check('reduced-motion-and-320px-controls', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.getElementById('unity-scene').dataset.motion === 'paused', null, { timeout: remaining() });
      assert.equal(await page.locator('#motion-toggle').isDisabled(), true);
      assert.equal(await page.locator('#motion-toggle').textContent(), 'Reduced motion');
      await page.setViewportSize({ width: 320, height: 740 });
      const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(widths.document <= widths.viewport + 1 && widths.body <= widths.viewport + 1, `320px overflow: ${JSON.stringify(widths)}`);
      for (const id of ['stop-button', 'text-toggle', 'exit-link', 'voice-start']) {
        const control = page.locator(`#${id}`); assert.equal(await control.isVisible(), true);
        const box = await control.boundingBox(); assert.ok(box.width >= 24 && box.height >= 24, `${id} is below a 24px target`);
      }
      const centralLayout = await page.locator('#voice-start').evaluate(control => {
        const box = control.getBoundingClientRect();
        return { opacity: Number(getComputedStyle(control).opacity),
          contents: ['svg', '#voice-label', '#voice-hint'].map(selector => {
            const element = control.querySelector(selector); const child = element.getBoundingClientRect();
            return { selector, fits: child.left >= box.left - 0.5 && child.right <= box.right + 0.5 &&
              child.top >= box.top - 0.5 && child.bottom <= box.bottom + 0.5,
              overflow: selector === 'svg' ? 0 : element.scrollWidth - element.clientWidth };
          }) };
      });
      assert.equal(centralLayout.opacity, 1, 'the narrow-screen central control must keep covering the bitmap lettering');
      for (const content of centralLayout.contents) {
        assert.equal(content.fits, true, `${content.selector} must stay inside the central control at 320px`);
        assert.ok(content.overflow <= 1, `${content.selector} must not clip horizontally at 320px`);
      }
      evidence.voiceEvidence.narrowLayout = { viewport: 320, ...centralLayout };
      await page.getByRole('button', { name: 'Write', exact: true }).click({ timeout: remaining() });
      assert.equal(await page.locator('#intention-input').evaluate(element => element === document.activeElement), true);
      await screenshot('unity-reduced-motion-320px.png');
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click({ timeout: remaining() }); await viewIs('constellation');
    });
    await check('stop-and-390px-layout', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('#stop-button').isVisible(), true);
      await page.locator('#stop-button').click({ timeout: remaining() });
      await page.waitForFunction(() => document.getElementById('announcement').textContent === 'Microphone and speaking stopped.', null, { timeout: remaining() });
      const widths = await page.evaluate(() => ({ viewport: innerWidth,
        document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(widths.document <= widths.viewport + 1 && widths.body <= widths.viewport + 1, `Horizontal overflow: ${JSON.stringify(widths)}`);
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      await screenshot('constellation-mobile.png');
    });
    await check('exit-native-back-reboots-with-voice-off', async () => {
      const draft = 'An unsent browser verification draft.';
      await page.locator('.wordmark[data-navigate="unity"]').click({ timeout: remaining() });
      await page.waitForFunction(() => document.body.dataset.view === 'unity', null, { timeout: remaining() });
      evidence.historyRecovery = { status: 'running' };
      for (const departure of ['exit', 'ordinaryNavigation']) {
        await page.locator('#intention-input').fill(draft, { timeout: remaining() });
        const oldDocument = await page.evaluate(() => performance.timeOrigin);
        const eventsBeforeExit = evidence.pageShows.length;
        if (departure === 'exit') await page.locator('#exit-link').click({ timeout: remaining(6000) });
        else await page.goto(new URL('/', LIVE).href, { waitUntil: 'domcontentloaded', timeout: remaining(6000) });
        await page.waitForURL(new URL('/', LIVE).href, { waitUntil: 'domcontentloaded', timeout: remaining(6000) });
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: remaining(7000) });
        await page.waitForFunction(previous => document.body.dataset.boot === 'ready' &&
          performance.timeOrigin !== previous, oldDocument, { timeout: remaining(8000) });
        await boot();
        const restoredFromCache = evidence.pageShows.slice(eventsBeforeExit).some(value => prototypeUrl(value.url) && value.persisted);
        const retained = await page.locator('#intention-input').inputValue() === draft;
        evidence.historyRecovery[departure] = { bfcacheObserved: restoredFromCache,
          draftRetained: retained, bfcacheDraftBranch: restoredFromCache ? 'exercised' : 'unexercised' };
        if (departure === 'exit') {
          assert.equal(await page.locator('#intention-input').inputValue(), '', 'explicit Exit must discard the unsent draft');
          assert.deepEqual(await storageWritesFromDocument(oldDocument), [], 'explicit Exit must not persist an unsent draft');
        } else if (restoredFromCache) {
          assert.equal(retained, true, 'ordinary nonvisit BFCache recovery must retain the exact unsent draft');
          const writes = await storageWritesFromDocument(oldDocument);
          assert.ok(writes.some(value => value.area === 'sessionStorage' && value.key === 'dream-unity:prototype:bfcache-draft:v1'));
        }
        assert.equal(new URL(page.url()).pathname, '/prototype/');
        assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
        assert.ok(!['permission', 'connecting', 'listening', 'speaking'].includes(await page.locator('body').getAttribute('data-microphone')));
      }
      evidence.historyRecovery.status = 'completed';
    });
    await check('publication-excludes-retired-activities-and-raw-contracts', async () => {
      for (const pathname of ['/games/empire-dawn/', '/dream-machine/', '/prototype/contracts/access.schema.json']) {
        const response = await context.request.get(new URL(pathname, LIVE).href, { timeout: remaining(6000) });
        evidence.publicationChecks.push({ pathname, status: response.status() });
        assert.equal(response.status(), 404, `${pathname} must remain unpublished`);
      }
    });
    await check('no-provider-writes-or-runtime-errors', async () => {
      assert.deepEqual(evidence.forbiddenRequests, []); assert.deepEqual(evidence.pageErrors, []);
      assert.equal(evidence.accessProbes.length, evidence.voiceEvidence.invalidInvitation?.status === 'unexercised' ? 0 : 1);
      assert.equal(evidence.voiceEvidence.microphoneRequests, 0, 'unauthorized verification must never request microphone access');
      assert.deepEqual(evidence.failedRequests, []);
      assert.ok(evidence.responses.every(item => item.status < 400), 'a prototype resource returned an HTTP failure');
      const modules = evidence.responses.filter(item => item.resourceType === 'script');
      assert.ok(modules.some(item => new URL(item.url).pathname === '/prototype/main.js'), 'the actual main module must be fetched');
      assert.ok(modules.every(item => /(?:java|ecma)script/i.test(item.contentType)), 'JavaScript resources must have executable MIME types');
      assert.ok(modules.some(item => new URL(item.url).pathname === '/symbol-motion.js'), 'the shared prototype ink-clock dependency must be observed');
      assert.ok(modules.every(item => new URL(item.url).searchParams.get('v') === evidence.expectedCommit), 'every served prototype module, including shared dependencies, must carry the exact release cache identity');
      const styles = evidence.responses.filter(item => new URL(item.url).pathname === '/prototype/styles.css');
      assert.ok(styles.length && styles.every(item => new URL(item.url).searchParams.get('v') === evidence.expectedCommit), 'the prototype stylesheet must carry the same release cache identity');
    });
    evidence.status = evidence.gateErrors.length ? 'failed' : 'passed';
    if (evidence.gateErrors.length) {
      evidence.error = 'Functional browser checks passed, but the exact deployed version remains unverified.';
      process.exitCode = 1;
    }
  } catch (error) {
    evidence.status = 'failed'; evidence.error = error.stack || error.message || String(error); process.exitCode = 1;
    if (page && Date.now() < deadline) { try { await screenshot('failure.png'); } catch (failure) { evidence.screenshotError = failure.message; } }
  } finally {
    writeEvidence();
    if (browser) {
      let timer;
      try { await Promise.race([browser.close(), new Promise(resolve => { timer = setTimeout(resolve, 1000); })]); }
      catch { /* Verification evidence is already complete. */ }
      finally { clearTimeout(timer); }
    }
    // Flush the concise log before terminating, even if a browser transport remains open.
    process.stdout.write(`${JSON.stringify(summary())}\n`, () => {
      clearTimeout(hardDeadline); process.exit(process.exitCode || 0);
    });
  }
})();
