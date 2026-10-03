'use strict';

// Real post-deployment browser verification. No request routing or fake application responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LIVE = 'https://dreamunity.one/prototype/';
const NOTE = 'Dream Unity browser verification note.';
const started = Date.now();
const deadline = started + 55000;
const directory = path.resolve('output/stage3-browser');
fs.mkdirSync(directory, { recursive: true });
const evidence = { liveUrl: LIVE, expectedCommit: process.env.DREAMUNITY_EXPECTED_COMMIT || '',
  status: 'running', checks: [], gateErrors: [], deployment: [], responses: [], failedRequests: [], pageErrors: [],
  consoleErrors: [], forbiddenRequests: [], screenshots: [], pageShows: [], historyRecovery: null };
let browser, page;

function remaining(maximum = 8000) {
  const value = deadline - Date.now();
  if (value <= 0) throw new Error('The browser verification deadline expired.');
  return Math.max(1, Math.min(maximum, value));
}
function prototypeUrl(value) {
  try { const url = new URL(value); return url.origin === 'https://dreamunity.one' && url.pathname.startsWith('/prototype/'); }
  catch { return false; }
}
function summary() {
  const result = { status: evidence.status, liveUrl: LIVE, expectedCommit: evidence.expectedCommit,
    durationMs: Date.now() - started, checks: evidence.checks, gateErrors: evidence.gateErrors, screenshots: evidence.screenshots,
    pageShows: evidence.pageShows, historyRecovery: evidence.historyRecovery,
    artifact: 'output/stage3-browser/verification.json' };
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
  evidence.status = 'failed'; evidence.error = 'Browser verification exceeded its hard 60-second deadline.';
  writeEvidence(); console.error(JSON.stringify(summary())); process.exit(1);
}, 60000);

async function check(name, action) {
  remaining(); await action(); evidence.checks.push(name);
}
async function screenshot(name) {
  await page.screenshot({ path: path.join(directory, name), fullPage: true, timeout: remaining(3000) });
  evidence.screenshots.push(name);
}
async function boot() {
  await page.waitForFunction(() => ['ready', 'failed'].includes(document.body.dataset.boot), null,
    { timeout: remaining(12000) });
  assert.equal(await page.locator('body').getAttribute('data-boot'), 'ready', 'the actual application module must start');
}
async function readMemory() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    let database; const timer = setTimeout(() => finish(new Error('Reading actual IndexedDB timed out.')), 2500);
    function finish(error, value) { clearTimeout(timer); database?.close(); error ? reject(error) : resolve(value); }
    const opening = indexedDB.open('dream-unity-constellation-v1', 1);
    opening.onerror = () => finish(new Error('The actual constellation database could not be read.'));
    opening.onblocked = () => finish(new Error('The actual constellation database is blocked.'));
    opening.onsuccess = () => {
      database = opening.result;
      try {
        const request = database.transaction('records', 'readonly').objectStore('records').get('constellation');
        request.onerror = () => finish(new Error('The actual constellation record could not be read.'));
        request.onsuccess = () => finish(null, request.result);
      } catch (error) { finish(error); }
    };
  }));
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

(async () => {
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, timeout: remaining(10000) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: [] });
    await context.clearPermissions();
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
    page.on('response', response => {
      if (prototypeUrl(response.url())) evidence.responses.push({ url: response.url(), status: response.status(),
        contentType: response.headers()['content-type'] || '', resourceType: response.request().resourceType() });
    });
    page.on('requestfailed', request => {
      if (prototypeUrl(request.url())) evidence.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
    });
    page.on('pageerror', error => { if (prototypeUrl(page.url())) evidence.pageErrors.push({ message: error.message, stack: error.stack || '' }); });
    page.on('console', message => { if (prototypeUrl(page.url()) && message.type() === 'error') evidence.consoleErrors.push(message.text()); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
        (url.pathname.startsWith('/api/unity/') || /(?:^|\.)openai\.com$/.test(url.hostname))) {
        evidence.forbiddenRequests.push({ method: request.method(), url: request.url() });
      }
    });
    await check('real-module-boot', async () => {
      const response = await page.goto(`${LIVE}?ci=${evidence.expectedCommit}`, { waitUntil: 'domcontentloaded', timeout: remaining(12000) });
      assert.equal(response.status(), 200); await boot();
      assert.equal(await page.locator('body').getAttribute('data-view'), 'unity');
      assert.equal(await page.locator('#stop-button').isVisible(), true);
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      await screenshot('unity-desktop.png');
    });
    const identity = await page.evaluate(() => { globalThis.__dreamUnityBrowserSmoke = crypto.randomUUID(); return globalThis.__dreamUnityBrowserSmoke; });
    await check('manifesto-inline-home-preserves-shell', async () => {
      await page.locator('.quiet-navigation [data-navigate="manifesto"]').click({ timeout: remaining() });
      await page.locator('#manifesto-content[data-loaded="true"]').waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await page.locator('body').getAttribute('data-view'), 'manifesto');
      await screenshot('manifesto-desktop.png');
      await page.locator('#manifesto-content a[data-navigate="unity"]').first().click({ timeout: remaining() });
      await page.waitForFunction(() => document.body.dataset.view === 'unity', null, { timeout: remaining() });
      assert.equal(new URL(page.url()).pathname, '/prototype/');
      assert.equal(await page.evaluate(() => globalThis.__dreamUnityBrowserSmoke), identity);
    });
    let saved;
    await check('exact-local-note-with-separate-sharing-consent', async () => {
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click({ timeout: remaining() });
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
    if (deadline - Date.now() >= 12000) {
      await check('exit-native-back-reboots-with-voice-off', async () => {
        const draft = 'An unsent browser verification draft.';
        await page.locator('.wordmark[data-navigate="unity"]').click({ timeout: remaining() });
        await page.waitForFunction(() => document.body.dataset.view === 'unity', null, { timeout: remaining() });
        await page.locator('#intention-input').fill(draft, { timeout: remaining() });
        const oldDocument = await page.evaluate(() => { globalThis.__dreamUnitySmokeExitDocument = crypto.randomUUID(); return globalThis.__dreamUnitySmokeExitDocument; });
        const eventsBeforeExit = evidence.pageShows.length;
        await page.locator('#exit-link').click({ timeout: remaining(6000) });
        await page.waitForURL('https://dreamunity.one/', { waitUntil: 'domcontentloaded', timeout: remaining(6000) });
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: remaining(7000) });
        await page.waitForFunction(previous => document.body.dataset.boot === 'ready' &&
          globalThis.__dreamUnitySmokeExitDocument !== previous, oldDocument, { timeout: remaining(8000) });
        await boot();
        const restoredFromCache = evidence.pageShows.slice(eventsBeforeExit).some(value => prototypeUrl(value.url) && value.persisted);
        const retained = await page.locator('#intention-input').inputValue() === draft;
        evidence.historyRecovery = { status: 'completed', bfcacheObserved: restoredFromCache,
          draftRetained: retained, bfcacheDraftBranch: restoredFromCache ? 'exercised' : 'unexercised' };
        if (restoredFromCache) assert.equal(retained, true, 'actual BFCache recovery must retain the exact unsent draft');
        assert.equal(new URL(page.url()).pathname, '/prototype/');
        assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
        assert.ok(!['permission', 'connecting', 'listening', 'speaking'].includes(await page.locator('body').getAttribute('data-microphone')));
      });
    } else evidence.historyRecovery = { status: 'not-run', bfcacheDraftBranch: 'unexercised', reason: 'Insufficient remaining browser deadline budget.' };
    await check('no-provider-writes-or-runtime-errors', async () => {
      assert.deepEqual(evidence.forbiddenRequests, []); assert.deepEqual(evidence.pageErrors, []);
      assert.deepEqual(evidence.failedRequests, []);
      assert.ok(evidence.responses.every(item => item.status < 400), 'a prototype resource returned an HTTP failure');
      const modules = evidence.responses.filter(item => item.resourceType === 'script');
      assert.ok(modules.some(item => new URL(item.url).pathname === '/prototype/main.js'), 'the actual main module must be fetched');
      assert.ok(modules.every(item => /(?:java|ecma)script/i.test(item.contentType)), 'JavaScript resources must have executable MIME types');
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
