// Run in CI against the staged artifact, then against the published URL.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile, stat, mkdir, writeFile } = require('node:fs/promises');
const { resolve, join, extname, sep } = require('node:path');
const { chromium } = require('playwright');

const root = resolve(__dirname, '../.public-site');
const published = Boolean(process.env.DREAMUNITY_BASE_URL);
const output = resolve(__dirname, `../output/shell-browser/${published ? 'published' : 'staged'}`);
const expectedCommit = process.env.DREAMUNITY_EXPECTED_COMMIT || process.env.DREAMUNITY_SOURCE_COMMIT;
const portals = ['machine', 'world', 'maker', 'unity'];
const retired = ['prototype/', 'manifesto/', 'dream-world/gods-earth-view/',
  'dream-world/gods-minds-eye-view/', 'portals/dream-world/',
  'exercises/heart/', 'exercises/cbt/', 'games/empire-dawn/'];
const report = { mode: published ? 'published' : 'staged', checks: [], consoleErrors: [] };
let browser, server;

async function localServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let target = resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(root + sep)) throw new Error('Invalid path');
      if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
      const body = await readFile(target);
      response.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      response.end(await readFile(join(root, '404.html')));
    }
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  return `http://127.0.0.1:${server.address().port}/`;
}

async function waitForRelease(request, base) {
  assert.match(expectedCommit || '', /^[a-f0-9]{40}$/, 'browser check requires exact expected source revision');
  for (let attempt = 0; attempt < (published ? 18 : 1); attempt++) {
    const response = await request.get(new URL(`build-info.json?check=${expectedCommit}-${attempt}`, base).href);
    if (response.ok()) {
      const info = await response.json();
      if (info.sourceCommit === expectedCommit) {
        assert.equal(info.site, 'dream-university');
        report.sourceCommit = info.sourceCommit;
        return;
      }
    }
    if (published) await new Promise(resolveWait => setTimeout(resolveWait, 5000));
  }
  throw new Error('The requested university release is not being served.');
}

async function assertNoOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <=
    document.documentElement.clientWidth + 1), `${label} has horizontal overflow`);
}

async function verifyNormalMotion(base) {
  const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], consoleErrors = [], missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(base) && !response.url().includes('favicon.ico')) {
      missing.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto(base);
  await page.bringToFront();
  await page.waitForFunction(() => {
    const state = window.__DREAM_SYMBOL__?.getState();
    const ring = document.querySelector('.unity-ink-ring');
    return state?.inkMotion.active && (state.frameCount > 0 || document.querySelector('#symbol-status')?.textContent === 'Clockwise animation is playing.') &&
      ring?.complete && ring.naturalWidth > 0 && ring.getAnimations().some(animation => animation.playState === 'running');
  }, null, { timeout: 15000 });
  const before = await page.evaluate(() => {
    const host = document.querySelector('.portal-artwork').getBoundingClientRect();
    const ring = document.querySelector('.unity-ink-ring');
    return {
      state: window.__DREAM_SYMBOL__.getState(),
      ringTime: ring.getAnimations()[0].currentTime,
      ringTransform: getComputedStyle(ring).transform,
      portals: [...document.querySelectorAll('.portal-card')].map(element => {
        const rect = element.getBoundingClientRect();
        return { name: element.dataset.world, x: (rect.x + rect.width / 2 - host.x) / host.width,
          y: (rect.y + rect.height / 2 - host.y) / host.height };
      }),
    };
  });
  // Verify the original three anchors keep their positions in the source drawing.
  for (const [name, x, y] of [['machine', 354 / 1254, .5], ['world', 626 / 1254, 604 / 1254], ['maker', 899 / 1254, .5]]) {
    const portal = before.portals.find(item => item.name === name);
    assert.ok(portal && Math.abs(portal.x - x) < .002 && Math.abs(portal.y - y) < .002,
      `${name} must retain its original artwork alignment`);
    assert.ok(await page.locator(`.portal-card[data-world="${name}"]`).isVisible());
  }
  await page.waitForFunction(({ time, transform }) => {
    const ring = document.querySelector('.unity-ink-ring');
    const animation = ring.getAnimations()[0];
    return animation.playState === 'running' && animation.currentTime > time + 100 &&
      getComputedStyle(ring).transform !== transform;
  }, { time: before.ringTime, transform: before.ringTransform }, { timeout: 5000 });
  const after = await page.evaluate(() => {
    const original = document.querySelector('.portal-image');
    const layer = document.querySelector('.symbol-ink');
    const canvas = document.querySelector('.symbol-canvas');
    return {
      state: window.__DREAM_SYMBOL__.getState(),
      originalDecoded: original.complete && original.naturalWidth > 0,
      originalVisible: getComputedStyle(original).visibility !== 'hidden',
      fallbackVisible: layer && getComputedStyle(layer).visibility !== 'hidden',
      fallbackRingsRunning: layer ? [...layer.querySelectorAll('.symbol-ink-turn')].filter(ring =>
        ring.complete && ring.naturalWidth > 0 && ring.getAnimations().some(animation => animation.playState === 'running')).length : 0,
      canvasVisible: canvas && canvas.width > 0 && canvas.height > 0 && getComputedStyle(canvas).opacity === '1',
    };
  });
  assert.equal(after.state.reducedMotion, false);
  assert.equal(after.state.paused, false);
  assert.ok(after.originalDecoded, 'the original source artwork must load');
  if (after.state.simulation === 'continuous-3d-relief') {
    assert.ok(after.state.ready && after.state.frameCount > before.state.frameCount && after.canvasVisible,
      'the original renderer must render successive frames');
    assert.deepEqual(consoleErrors, [], 'the live renderer must not report initialization or shader errors');
  } else {
    // The renderer intentionally uses the original compositor artwork if WebGL
    // is unavailable or sustained slow frames make relief unsuitable for the device.
    assert.equal(after.state.simulation, 'animated-ink');
    assert.ok(after.originalVisible && after.fallbackVisible && after.fallbackRingsRunning === 4,
      'fallback must visibly animate all four original ink bands');
    assert.ok(consoleErrors.every(message => /Error creating WebGL context|WebGL is not supported/i.test(message)),
      `unexpected fallback errors: ${consoleErrors.join('; ')}`);
  }
  assert.deepEqual(errors, [], 'normal motion must not produce uncaught errors');
  assert.deepEqual(missing, [], 'normal motion must not request missing artwork or renderer modules');
  await page.screenshot({ path: join(output, 'desktop-normal-motion.png'), fullPage: true });
  report.normalMotion = { simulation: after.state.simulation, frameCount: after.state.frameCount,
    unityRingRunning: true, originalPortalAlignment: true, fallbackConsoleErrors: consoleErrors };
  report.checks.push('normal motion: original renderer or valid animated fallback, original three alignments, moving Unity ring');
  await context.close();
}

(async () => {
  await mkdir(output, { recursive: true });
  const base = published ? `${process.env.DREAMUNITY_BASE_URL.replace(/\/+$/, '')}/` : await localServer();
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await waitForRelease(context.request, base);
  const page = await context.newPage();
  const pageErrors = [], failedResources = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(base) && !response.url().includes('favicon.ico')) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  });
  for (const [label, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844],
    ['small-mobile', 320, 740], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    assert.equal((await page.goto(base)).status(), 200);
    await page.getByRole('heading', { name: 'Dream University', exact: true }).waitFor();
    assert.equal(await page.locator('a.portal-card').count(), 4);
    assert.equal(await page.getByRole('link', { name: /explore the prototype/i }).count(), 0);
    await assertNoOverflow(page, `${label} home`);
    await page.screenshot({ path: join(output, `${label}-home.png`), fullPage: true });
    for (const portal of portals) {
      const title = `Dream ${portal[0].toUpperCase()}${portal.slice(1)}`;
      const anchor = page.locator(`a.portal-card[data-world="${portal}"]`);
      await anchor.focus();
      assert.ok(await anchor.evaluate(element => element === document.activeElement), `${title} is keyboard-focusable`);
      await anchor.press('Enter');
      await page.waitForURL(new URL(`dream-${portal}/`, base).href);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.getByText('In preparation', { exact: true }).waitFor();
      await assertNoOverflow(page, `${label} ${title}`);
      await page.screenshot({ path: join(output, `${label}-${portal}.png`), fullPage: true });
      await page.getByRole('link', { name: /back/i }).click();
      await page.waitForURL(base);
    }
    report.checks.push(`${label}: four portal journeys, keyboard entry, return and overflow`);
  }
  // Old direct links must genuinely be retired, not merely hidden on the home.
  for (const path of retired) {
    const response = await context.request.get(new URL(path, base).href);
    assert.equal(response.status(), 404, `${path} must return HTTP 404`);
  }
  report.checks.push('eight retired direct URLs return HTTP 404');
  assert.deepEqual(pageErrors, [], 'uncaught browser errors');
  assert.deepEqual(failedResources, [], 'the shell requested missing resources');
  await verifyNormalMotion(base);

  // Progressive enhancement: every journey must remain available without JS.
  const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plainPage = await plain.newPage();
  await plainPage.goto(base);
  for (const portal of portals) {
    await plainPage.locator(`a.portal-card[data-world="${portal}"]`).click();
    await plainPage.getByText('In preparation', { exact: true }).waitFor();
    await plainPage.getByRole('link', { name: /back/i }).click();
  }
  report.checks.push('all four routes work without JavaScript');
  report.ok = true;
  console.log(JSON.stringify(report, null, 2));
})().catch(error => {
  report.ok = false;
  report.error = error.message;
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (browser) await browser.close();
  if (server) await new Promise(resolveClose => server.close(resolveClose));
});
