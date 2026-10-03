'use strict';

// Real post-deployment browser verification. No request routing or fake application responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LIVE = 'https://dreamunity.one/prototype/';
const NOTE = 'Dream Unity browser verification note.';
const EDITED_NOTE = 'Dream Unity browser verification note, deliberately revised.';
const SECOND_NOTE = 'A second authored note for relationship verification.';
const started = Date.now();
const deadline = started + 110000;
const directory = path.resolve('output/stage4-browser');
fs.mkdirSync(directory, { recursive: true });
const evidence = { liveUrl: LIVE, expectedCommit: process.env.DREAMUNITY_EXPECTED_COMMIT || '',
  status: 'running', checks: [], gateErrors: [], deployment: [], responses: [], failedRequests: [], pageErrors: [],
  consoleErrors: [], forbiddenRequests: [], screenshots: [], pageShows: [], historyRecovery: null,
  publicationChecks: [], checkTimings: [], memoryEvidence: {}, scope: 'Real deployed UI and IndexedDB; no provider, microphone, mock response, or injected application state.' };
let browser, page, secondPage;

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
    artifact: 'output/stage4-browser/verification.json' };
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
  evidence.status = 'failed'; evidence.error = 'Browser verification exceeded its hard 120-second deadline.';
  writeEvidence(); console.error(JSON.stringify(summary())); process.exit(1);
}, 120000);

async function check(name, action) {
  remaining(); const checkStarted = Date.now();
  try { await action(); evidence.checks.push(name); }
  finally { evidence.checkTimings.push({ name, durationMs: Date.now() - checkStarted, passed: evidence.checks.includes(name) }); }
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
// This is a read-only observation of the browser's actual committed record. All writes use visible UI.
async function readMemory(target = page) {
  return target.evaluate(() => new Promise((resolve, reject) => {
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
    document.getElementById('memory-status').textContent.includes(value ? 'saved notes' : 'Remembering is off'), enabled, { timeout: remaining() });
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
    context.on('response', response => {
      if (prototypeUrl(response.url())) evidence.responses.push({ url: response.url(), status: response.status(),
        contentType: response.headers()['content-type'] || '', resourceType: response.request().resourceType() });
    });
    context.on('requestfailed', request => {
      if (prototypeUrl(request.url())) evidence.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
    });
    page.on('pageerror', error => { if (prototypeUrl(page.url())) evidence.pageErrors.push({ message: error.message, stack: error.stack || '' }); });
    page.on('console', message => { if (prototypeUrl(page.url()) && message.type() === 'error') evidence.consoleErrors.push(message.text()); });
    context.on('request', request => {
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
    let saved;
    await check('no-consent-no-personal-persistence-and-retained-offline-input', async () => {
      await page.locator('.quiet-navigation [data-navigate="constellation"]').click({ timeout: remaining() });
      await rememberingIs(false);
      const message = 'Remember that this unconsented browser note must remain unsaved.';
      await send(message);
      await page.locator('#access-panel').waitFor({ state: 'visible', timeout: remaining() });
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
        await page.locator('#access-panel').waitFor({ state: 'visible', timeout: remaining() });
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
      await secondPage.getByRole('button', { name: 'Reload saved version', exact: true }).click({ timeout: remaining() });
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
      await secondPage.getByRole('button', { name: 'Add a note', exact: true }).click({ timeout: remaining() });
      await secondPage.getByRole('textbox', { name: 'Title', exact: true }).fill('Revoked second-tab draft');
      await secondPage.getByRole('textbox', { name: 'Note', exact: true }).fill('This open draft must not restore revoked storage.');
      await page.bringToFront();
      await confirmDialog(() => page.locator('#memory-revoke').click({ timeout: remaining() }), /Turn remembering off and delete/);
      await rememberingIs(false); await rememberingIs(false, secondPage);
      assert.equal(await secondPage.locator('.memory-editor').count(), 0);
      await secondPage.bringToFront();
      const attempt = 'Remember that an old tab cannot silently restore revoked remembering.';
      await send(attempt, secondPage);
      await secondPage.locator('#access-panel').waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await secondPage.locator('#intention-input').inputValue(), attempt);
      const revoked = await readMemory(secondPage); assert.deepEqual(revoked.nodes, []); assert.deepEqual(revoked.edges, []);
      assert.equal(revoked.consent.storageEnabled, false); assert.equal(revoked.consent.conversationUseEnabled, false);
      await secondPage.reload({ waitUntil: 'domcontentloaded', timeout: remaining(12000) }); await boot(secondPage); await rememberingIs(false, secondPage);
      assert.deepEqual((await readMemory(secondPage)).nodes, []);
      evidence.memoryEvidence.revocation = { bothTabsOff: true, nodesAndEdgesRemoved: true, oldTabSaveBlocked: true, survivesReload: true };
      await secondPage.close(); secondPage = null; await page.bringToFront();
    });
    await check('delete-all-requires-fresh-consent-and-leaves-no-records', async () => {
      await page.locator('#memory-consent').check({ timeout: remaining() }); await rememberingIs(true);
      await send(`Remember that ${NOTE}`); await waitForNote(NOTE);
      await confirmDialog(() => page.locator('#memory-clear').click({ timeout: remaining() }), /Delete all saved notes and connections/);
      await rememberingIs(false);
      const cleared = await readMemory(); assert.deepEqual(cleared.nodes, []); assert.deepEqual(cleared.edges, []);
      assert.equal(cleared.consent.storageEnabled, false); assert.equal(cleared.consent.conversationUseEnabled, false);
      assert.equal(await page.locator('article.memory-card').count(), 0);
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
        await page.locator('#intention-input').fill(draft, { timeout: remaining() });
        const oldDocument = await page.evaluate(() => performance.timeOrigin);
        const eventsBeforeExit = evidence.pageShows.length;
        await page.locator('#exit-link').click({ timeout: remaining(6000) });
        await page.waitForURL('https://dreamunity.one/', { waitUntil: 'domcontentloaded', timeout: remaining(6000) });
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: remaining(7000) });
        await page.waitForFunction(previous => document.body.dataset.boot === 'ready' &&
          performance.timeOrigin !== previous, oldDocument, { timeout: remaining(8000) });
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
    await check('publication-excludes-retired-activities-and-raw-contracts', async () => {
      for (const pathname of ['/games/empire-dawn/', '/dream-machine/', '/prototype/contracts/access.schema.json']) {
        const response = await context.request.get(new URL(pathname, LIVE).href, { timeout: remaining(6000) });
        evidence.publicationChecks.push({ pathname, status: response.status() });
        assert.equal(response.status(), 404, `${pathname} must remain unpublished`);
      }
    });
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
