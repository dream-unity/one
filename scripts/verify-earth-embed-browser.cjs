'use strict';

// Run against the coordinated public deployments. Observe the actual bridge;
// do not route requests, inject application state, or fabricate child messages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LIVE = 'https://dreamunity.one/prototype/';
const FRONTEND_ORIGIN = new URL(LIVE).origin;
const BUDGET_MS = 110000;
const started = Date.now();
const deadline = started + BUDGET_MS - 7000;
const directory = path.resolve('output/astra-earth-browser');
fs.mkdirSync(directory, { recursive: true });
const evidence = {
  liveUrl: LIVE,
  expectedFrontendCommit: process.env.DREAMUNITY_EXPECTED_COMMIT || '',
  expectedEarthCommit: process.env.DREAMUNITY_EXPECTED_EARTH_COMMIT || '',
  expectedKeylessBuildAt: process.env.DREAMUNITY_KEYLESS_EARTH_BUILD_AT || '',
  status: 'running', checks: [], timings: [], builds: {}, bridge: [], api: [],
  resources: [], failedRequests: [], pageErrors: [], consoleErrors: [],
  forbiddenRequests: [], microphoneRequests: 0, screenshots: [],
  limitations: [
    'This verifies the published frame, real bridge startup, canvas visibility, same-origin HTTP routing and frame disposal. It does not establish imagery quality or live provider data availability.',
    'No private invitation, paid AI request, microphone permission, media playback, map command or user-authored Earth state is created.',
    'Automatic map startup requires CI to attest the exact builtAt of a deployment built without GOOGLE_MAPS_API_KEY and CESIUM_ION_TOKEN, plus a currently unconfigured public photorealistic status. The browser probe cannot independently recover build-time environment provenance.',
    'Provider configuration and a mounted provider are not evidence of a successful public feed. Public-network failures are recorded separately from bridge and application readiness.'
  ],
};
let browser, page, earthOrigin;

function remaining(maximum = 8000) {
  const value = deadline - Date.now();
  if (value <= 0) throw new Error('The Earth browser verification deadline expired.');
  return Math.max(1, Math.min(maximum, value));
}
function safeUrl(value) {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return '[unparseable URL]'; }
}
function boundedPush(target, item, limit = 160) { if (target.length < limit) target.push(item); }
function save() {
  evidence.durationMs = Date.now() - started;
  fs.writeFileSync(path.join(directory, 'verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
function summary() {
  return { status: evidence.status, expectedFrontendCommit: evidence.expectedFrontendCommit,
    expectedEarthCommit: evidence.expectedEarthCommit, expectedKeylessBuildAt: evidence.expectedKeylessBuildAt, earthOrigin, checks: evidence.checks,
    builds: evidence.builds, globe: evidence.globe, api: evidence.api, limitations: evidence.limitations,
    error: evidence.error, durationMs: Date.now() - started,
    artifact: 'output/astra-earth-browser/verification.json', screenshots: evidence.screenshots };
}
const hardDeadline = setTimeout(() => {
  evidence.status = 'failed'; evidence.error = 'Earth browser verification exceeded its 110-second hard deadline.';
  save(); console.error(JSON.stringify(summary())); process.exit(1);
}, BUDGET_MS);

async function check(name, action) {
  const before = Date.now();
  try { remaining(); await action(); evidence.checks.push(name); }
  finally { evidence.timings.push({ name, durationMs: Date.now() - before, passed: evidence.checks.includes(name) }); }
}
async function screenshot(filename) {
  await page.screenshot({ path: path.join(directory, filename), fullPage: true, timeout: remaining(15000) });
  evidence.screenshots.push(filename);
}
async function collectBridge() {
  if (page && !page.isClosed()) evidence.bridge = await page.evaluate(() => globalThis.__dreamUnityEarthProbe || []);
  return evidence.bridge;
}
async function jsonGet(context, url) {
  const response = await context.request.get(url, { timeout: remaining(8000), headers: { 'Cache-Control': 'no-cache' } });
  assert.equal(new URL(response.url()).origin, new URL(url).origin, 'deployment identity/status reads must remain on their selected origin');
  assert.equal(response.status(), 200, `${safeUrl(url)} must return HTTP 200`);
  assert.match(response.headers()['content-type'] || '', /application\/json/i, `${safeUrl(url)} must return JSON`);
  return response.json();
}

(async () => {
  try {
    assert.match(evidence.expectedFrontendCommit, /^[a-f0-9]{40}$/, 'CI must pin the exact frontend commit');
    assert.match(evidence.expectedEarthCommit, /^[a-f0-9]{40}$/, 'CI must pin the exact Earth commit; discovered metadata is not a substitute');
    // The runtime capability endpoint reflects server env, whereas browser map
    // credentials are compiled into the deployed assets. Only the operator who
    // verified this deployment's build environment can supply this attestation.
    assert.match(evidence.expectedKeylessBuildAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'CI must attest the exact builtAt of a verified keyless Earth build');
    assert.equal(new Date(evidence.expectedKeylessBuildAt).toISOString(), evidence.expectedKeylessBuildAt, 'keyless build attestation must use a valid exact UTC timestamp');
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, timeout: remaining(12000) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: [] });
    await context.clearPermissions();
    await context.exposeBinding('__dreamUnityObserveEarthMicrophone', () => { evidence.microphoneRequests += 1; });
    await context.addInitScript(() => {
      // Preserve browser behavior while counting attempts in every document,
      // including the cross-origin Earth frame and documents later disposed.
      const nativeCapture = navigator.mediaDevices?.getUserMedia;
      if (nativeCapture) navigator.mediaDevices.getUserMedia = function (...args) {
        globalThis.__dreamUnityObserveEarthMicrophone().catch(() => {});
        return Reflect.apply(nativeCapture, this, args);
      };
      if (window.parent !== window) return;
      const messages = [];
      Object.defineProperty(globalThis, '__dreamUnityEarthProbe', { value: messages });
      addEventListener('message', event => {
        const frame = document.querySelector('#earth-frame-host iframe');
        if (!frame || event.source !== frame.contentWindow || event.origin !== new URL(frame.src).origin) return;
        const data = event.data;
        if (!data || data.channel !== 'dream-unity:earth' || data.version !== 1 ||
            !['HELLO', 'STATUS', 'READY', 'FAILED', 'ACK', 'QUIET_ACK', 'SNAPSHOT'].includes(data.kind) || messages.length >= 80) return;
        // Snapshots contain operational location state; only their occurrence is needed.
        messages.push({ kind: data.kind, bridgeId: data.bridgeId, epoch: data.epoch, requestId: data.requestId,
          origin: event.origin, at: performance.now(), payload: data.kind === 'SNAPSHOT' ? null : data.payload });
      });
    });
    context.on('request', request => {
      const url = new URL(request.url());
      const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      const unityWrite = url.pathname.startsWith('/api/unity/') && !readOnly;
      const voiceOrAi = /^\/api\/(?:openai|google)(?:\/|$)/.test(url.pathname) ||
        /^\/api\/realtime(?:\/|$)/.test(url.pathname) && !/^\/api\/realtime\/status\/?$/.test(url.pathname);
      const directAi = /(?:^|\.)openai\.com$/.test(url.hostname);
      const meteredMap = url.hostname === 'tile.googleapis.com' ||
        /(?:^|\.)cesium\.com$/.test(url.hostname) && /\/assets\/2275207(?:\/|$)/.test(url.pathname);
      if (unityWrite || voiceOrAi || directAi || meteredMap) boundedPush(evidence.forbiddenRequests, { method: request.method(), url: safeUrl(request.url()) });
    });
    context.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === earthOrigin || url.origin === FRONTEND_ORIGIN && url.pathname.startsWith('/prototype/')) {
        boundedPush(evidence.resources, { url: safeUrl(response.url()), status: response.status(),
          resourceType: response.request().resourceType(), contentType: response.headers()['content-type'] || '' }, 240);
      }
    });
    context.on('requestfailed', request => boundedPush(evidence.failedRequests, { url: safeUrl(request.url()),
      resourceType: request.resourceType(), error: request.failure()?.errorText || 'unknown' }));
    page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(12000);
    page.on('pageerror', error => boundedPush(evidence.pageErrors, { message: error.message.slice(0, 1200) }));
    page.on('console', message => {
      if (message.type() === 'error') boundedPush(evidence.consoleErrors, { message: message.text().slice(0, 1000), source: safeUrl(message.location().url) });
    });

    await check('frontend-release-identifies-the-exact-coordinated-earth-commit', async () => {
      const metadata = await jsonGet(context, `${LIVE}build-info.json?ci=${evidence.expectedFrontendCommit}`);
      evidence.builds.frontend = { sourceCommit: metadata.sourceCommit, earthCommit: metadata.earthCommit, contractVersion: metadata.contractVersion };
      assert.equal(metadata.sourceCommit, evidence.expectedFrontendCommit);
      assert.equal(metadata.earthCommit, evidence.expectedEarthCommit, 'the published frontend must identify this exact backend release');
      assert.equal(metadata.contractVersion, 'du-prototype/1.0');
    });
    await check('real-frontend-boots-and-identifies-its-earth-origin', async () => {
      const response = await page.goto(`${LIVE}?ci=${evidence.expectedFrontendCommit}`, { waitUntil: 'domcontentloaded', timeout: remaining(12000) });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => ['ready', 'failed'].includes(document.body.dataset.boot), null, { timeout: remaining(12000) });
      assert.equal(await page.locator('body').getAttribute('data-boot'), 'ready');
      const fallback = new URL(await page.locator('#earth-fallback').getAttribute('href'), LIVE);
      assert.equal(fallback.protocol, 'https:'); assert.equal(fallback.username + fallback.password, '');
      earthOrigin = fallback.origin;
      assert.equal(await page.locator('#earth-frame-host iframe').count(), 0, 'Earth must remain unopened until the keyless build is verified');
    });
    await check('earth-metadata-matches-the-exact-keyless-build-before-any-frame-startup', async () => {
      const metadata = await jsonGet(context, new URL(`/build-info.json?ci=${evidence.expectedEarthCommit}`, earthOrigin).href);
      evidence.builds.earth = { commit: metadata.commit, builtAt: metadata.builtAt, repository: metadata.repository, application: metadata.application };
      assert.equal(metadata.commit, evidence.expectedEarthCommit);
      assert.equal(metadata.repository, 'dream-unity/November-1st');
      assert.equal(metadata.builtAt, evidence.expectedKeylessBuildAt, 'a rebuilt or replaced Earth artifact must be re-attested as keyless before automatic map startup');
      const capabilities = await jsonGet(context, new URL('/api/capabilities', earthOrigin).href);
      const photorealistic = capabilities.providers?.find(provider => provider.id === 'photorealistic');
      evidence.mapStartupPreflight = { origin: earthOrigin, photorealistic: photorealistic?.status || 'unknown' };
      assert.equal(photorealistic?.status, 'not-configured', 'Earth automatically starts configured photorealistic providers; this acceptance run requires their current configuration to be absent as well as its keyless build attestation');
    });
    await check('real-frontend-navigation-opens-the-coordinated-earth-frame', async () => {
      await page.locator('.quiet-navigation [data-navigate="dream-world"]').click({ timeout: remaining() });
      await page.locator('.world-choice[data-navigate="earth"]').click({ timeout: remaining() });
      const iframe = page.locator('#earth-frame-host iframe');
      await iframe.waitFor({ state: 'attached', timeout: remaining() });
      const src = new URL(await iframe.getAttribute('src'), LIVE);
      assert.equal(src.origin, earthOrigin, 'the embedded and standalone Earth links must select the same deployment');
      assert.equal(src.pathname, '/embed/');
      assert.equal(src.username + src.password + src.search + src.hash, '');
      evidence.iframeUrl = src.href;
      assert.match(await iframe.getAttribute('allow'), /microphone 'none'/);
      assert.match(await iframe.getAttribute('allow'), /camera 'none'/);
      assert.equal(await page.locator('#stop-button').isVisible(), true);
      assert.equal(await page.locator('#exit-link').isVisible(), true);
    });
    await check('earth-build-metadata-and-live-child-hello-match-the-pinned-release', async () => {
      await page.waitForFunction(() => globalThis.__dreamUnityEarthProbe.some(message => message.kind === 'HELLO') ||
        !document.getElementById('earth-recovery').hidden, null, { timeout: remaining(11000) });
      const hello = (await collectBridge()).find(message => message.kind === 'HELLO');
      assert.ok(hello, `Earth did not complete its real handshake: ${await page.locator('#earth-error').textContent()}`);
      assert.equal(hello.origin, earthOrigin); assert.equal(hello.payload.buildCommit, evidence.expectedEarthCommit);
      assert.equal(hello.payload.capabilities.mediaPreflight, true);
      assert.ok(hello.payload.capabilities.tools.includes('earth_get_view'));
    });
    await check('real-earth-startup-reaches-ready-and-renders-a-visible-globe-canvas', async () => {
      await page.waitForFunction(() => globalThis.__dreamUnityEarthProbe.some(message => message.kind === 'READY' || message.kind === 'FAILED') ||
        !document.getElementById('earth-recovery').hidden, null, { timeout: remaining(24000) });
      const messages = await collectBridge();
      const hello = messages.find(message => message.kind === 'HELLO');
      const ready = messages.find(message => message.kind === 'READY' && message.bridgeId === hello.bridgeId && message.epoch === hello.epoch);
      evidence.globe = { bridgeReady: Boolean(ready), readiness: ready?.payload || messages.filter(message => message.kind === 'STATUS').at(-1)?.payload || null,
        parentStatus: await page.locator('#earth-status').textContent(), recovery: await page.locator('#earth-error').textContent(),
        externalRequestsFailed: evidence.failedRequests.filter(item => !item.url.startsWith(earthOrigin) && !item.url.startsWith(FRONTEND_ORIGIN)).length };
      if (!ready) {
        evidence.limitations.push('Earth did not reach READY during this run; Cesium, WebGL or public-network availability may require investigation. No functioning globe is claimed.');
      }
      assert.ok(ready, `Earth startup failed or timed out: ${JSON.stringify(messages.filter(message => message.kind === 'FAILED'))}; ${evidence.globe.recovery}`);
      assert.equal(ready.payload.app, 'ready'); assert.equal(ready.payload.globe, 'ready'); assert.equal(ready.payload.restore, 'none');
      await page.waitForFunction(() => document.getElementById('earth-status').textContent === 'Earth is ready.' &&
        document.getElementById('earth-recovery').hidden, null, { timeout: remaining() });
      const frame = await (await page.locator('#earth-frame-host iframe').elementHandle()).contentFrame();
      assert.ok(frame, 'the ready Earth document must remain mounted');
      assert.equal(await frame.locator('#du-application').evaluate(element => !element.hidden && !element.inert), true);
      assert.equal(await frame.locator('#du-embed-waiting').isVisible(), false);
      const canvas = frame.locator('#cesiumContainer canvas').first();
      await canvas.waitFor({ state: 'visible', timeout: remaining() });
      const size = await canvas.evaluate(element => ({ width: element.width, height: element.height,
        displayWidth: element.getBoundingClientRect().width, displayHeight: element.getBoundingClientRect().height }));
      assert.ok(size.width > 0 && size.height > 0 && size.displayWidth > 100 && size.displayHeight > 100, 'the real globe canvas must have drawable and visible dimensions');
      evidence.globe.canvas = size;
      await screenshot('earth-embedded-desktop.png');
    });
    await check('earth-document-can-read-its-own-live-host-and-unity-status-apis', async () => {
      const frame = await (await page.locator('#earth-frame-host iframe').elementHandle()).contentFrame();
      const results = await frame.evaluate(async () => Promise.all(['/api/health', '/api/unity/status'].map(async pathname => {
        const response = await fetch(pathname, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(7000) });
        const text = await response.text();
        if (text.length > 65536) throw new Error('The public status response exceeds the acceptance bound.');
        let body; try { body = JSON.parse(text); } catch { body = null; }
        return { pathname, origin: location.origin, responseOrigin: new URL(response.url).origin,
          status: response.status, contentType: response.headers.get('content-type'), body };
      })));
      evidence.api = results;
      for (const result of results) {
        assert.equal(result.origin, earthOrigin); assert.equal(result.responseOrigin, earthOrigin);
        assert.equal(result.status, 200); assert.match(result.contentType || '', /application\/json/i);
        assert.ok(result.body && typeof result.body === 'object', `${result.pathname} must return an API object, not an HTML fallback`);
      }
      const health = results.find(item => item.pathname === '/api/health').body;
      assert.equal(health.status, 'ok'); assert.equal(health.service, 'dream-unity-gods-eye');
      assert.equal(health.commit, evidence.expectedEarthCommit, 'the actual API host must run the same pinned release as the Earth frame');
      assert.ok(Array.isArray(health.providersMounted) && health.providersMounted.length > 0);
      const unity = results.find(item => item.pathname === '/api/unity/status').body;
      assert.equal(unity.version, 1); assert.equal(typeof unity.ready, 'boolean'); assert.equal(typeof unity.enabled, 'boolean');
      evidence.privateConversation = { ready: unity.ready, enabled: unity.enabled, reasonCodes: unity.reasonCodes || [], providerUsability: 'unexercised' };
    });
    await check('leaving-earth-disposes-the-real-frame-and-retains-the-parent-controls', async () => {
      const dialogPromise = page.waitForEvent('dialog', { timeout: remaining(6000) });
      const navigation = page.locator('#earth-return').click({ timeout: remaining() });
      const dialog = await dialogPromise;
      assert.equal(dialog.type(), 'confirm'); assert.match(dialog.message(), /Leave Earth\?/);
      await dialog.accept(); await navigation;
      await page.waitForFunction(() => document.body.dataset.view === 'dream-world' &&
        !document.querySelector('#earth-frame-host iframe'), null, { timeout: remaining(6000) });
      await collectBridge();
      assert.equal(page.frames().some(frame => frame.url().startsWith(`${earthOrigin}/`)), false);
      assert.equal(await page.locator('#stop-button').isVisible(), true);
      assert.equal(await page.locator('#exit-link').isVisible(), true);
      assert.equal(await page.locator('#voice-start').getAttribute('aria-pressed'), 'false');
      evidence.disposal = { frameRemoved: true, returnedToDreamWorld: true, microphoneRequests: evidence.microphoneRequests };
      await screenshot('earth-returned-to-dream-world.png');
    });
    await check('embed-acceptance-created-no-ai-call-or-microphone-request', async () => {
      assert.deepEqual(evidence.forbiddenRequests, []);
      assert.equal(evidence.microphoneRequests, 0);
      assert.deepEqual(evidence.pageErrors, []);
      const scripts = evidence.resources.filter(item => item.url.startsWith(`${earthOrigin}/`) && item.resourceType === 'script');
      assert.ok(scripts.length > 0, 'the actual Earth runtime scripts must have loaded');
      assert.ok(scripts.every(item => item.status < 400 && /(?:java|ecma)script/i.test(item.contentType)), 'Earth runtime scripts must have successful executable responses');
    });
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed'; evidence.error = error.stack || error.message || String(error); process.exitCode = 1;
    if (page && Date.now() < deadline) {
      try { await collectBridge(); await screenshot('earth-failure.png'); }
      catch (failure) { evidence.captureError = failure.message; }
    }
  } finally {
    save();
    if (browser) {
      let timer;
      try { await Promise.race([browser.close(), new Promise(resolve => { timer = setTimeout(resolve, 1000); })]); }
      catch { /* The evidence has already been written. */ }
      finally { clearTimeout(timer); }
    }
    process.stdout.write(`${JSON.stringify(summary())}\n`, () => { clearTimeout(hardDeadline); process.exit(process.exitCode || 0); });
  }
})();
