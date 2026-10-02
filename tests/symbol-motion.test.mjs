import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { INK_CYCLE, INK_RINGS, inkMask, inkSource } from '../symbol-motion.js';

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} near ${expected}`);
const point = (ring, radius, angle) => ({
  x: ring.cx + radius * Math.cos(angle), y: ring.cy + radius * Math.sin(angle),
});

test('original ink landmarks advance clockwise at four degrees per second in every ring', () => {
  for (const ring of INK_RINGS) {
    const radius = (ring.inner + ring.outer) / 2;
    const landmark = point(ring, radius, -Math.PI / 2);
    let previous;
    for (const seconds of [0, 1, 2, 3, 5, 8]) {
      // Follow an original landmark, then verify inverse sampling actually
      // recovers it at its new visible position, not just a changing clock.
      const destination = point(ring, radius, -Math.PI / 2 + seconds * Math.PI / 45);
      const sample = inkSource(destination.x, destination.y, ring, seconds);
      near(sample.x, landmark.x);
      near(sample.y, landmark.y);
      assert.ok(sample.weight > .99, 'Landmark must visibly replace the old ink');
      const angle = Math.atan2(destination.y - ring.cy, destination.x - ring.cx);
      if (previous) {
        const delta = Math.atan2(Math.sin(angle - previous.angle), Math.cos(angle - previous.angle));
        assert.ok(delta > 0, 'Clockwise landmark reversed');
        near(delta / (seconds - previous.seconds), Math.PI / 45);
      }
      previous = { angle, seconds };
    }
  }
});

test('rigid ink sampling preserves every radius over full cycles and long sessions', () => {
  for (const ring of INK_RINGS)
    for (const radius of [0, ring.inner, ring.inner + ring.feather, (ring.inner + ring.outer) / 2,
      ring.outer - ring.feather, ring.outer, ring.outer + 1])
      for (let i = 0; i < 24; i++) {
        const destination = point(ring, radius, i * Math.PI / 12);
        for (const seconds of [0, 1, 15, 30, 60, INK_CYCLE, 86400, 31536000]) {
          const source = inkSource(destination.x, destination.y, ring, seconds);
          near(Math.hypot(source.x - ring.cx, source.y - ring.cy), radius);
          assert.ok(source.weight >= 0 && source.weight <= 1);
          const repeated = inkSource(destination.x, destination.y, ring, seconds + INK_CYCLE);
          near(repeated.x, source.x, 1e-6);
          near(repeated.y, source.y, 1e-6);
          near(repeated.weight, source.weight, 1e-6);
        }
      }
});

test('stationary spine and all label holes remain excluded throughout rotation', () => {
  const anchors = [];
  for (let x = 0; x <= 1254; x += 19)
    for (const y of [617, 627, 637]) anchors.push({ x, y });
  for (const [cx, radius] of [[354, 69], [626, 130], [899, 69]])
    for (const fraction of [0, .5, 1])
      for (let i = 0; i < 24; i++)
        anchors.push(point({ cx, cy: 627 }, radius * fraction, i * Math.PI / 12));
  for (const ring of INK_RINGS)
    for (const p of anchors) {
      near(inkMask(p.x, p.y, ring), 0);
      for (const seconds of [0, 6, 22.5, 45, 80, 31536000])
        near(inkSource(p.x, p.y, ring, seconds).weight, 0);
    }
});

test('the original connector cannot rotate into a travelling black spoke', () => {
  for (const ring of INK_RINGS) {
    const radius = (ring.inner + ring.outer) / 2;
    const source = { x: ring.cx + Math.sqrt(radius ** 2 - (627 - ring.cy) ** 2), y: 627 };
    for (const seconds of [3, 9, 22.5, 30, 55, 70]) {
      const angle = seconds * Math.PI / 45;
      const dx = source.x - ring.cx, dy = source.y - ring.cy;
      const destination = {
        x: ring.cx + Math.cos(angle) * dx - Math.sin(angle) * dy,
        y: ring.cy + Math.sin(angle) * dx + Math.cos(angle) * dy,
      };
      const sampled = inkSource(destination.x, destination.y, ring, seconds);
      near(sampled.x, source.x);
      near(sampled.y, source.y);
      near(sampled.weight, 0);
    }
  }
});

test('neighbouring hub contours are protected in both source and destination space', () => {
  const hubs = [{ cx: 354, cy: 627, radius: 140 }, { cx: 626, cy: 604, radius: 200 },
    { cx: 899, cy: 627, radius: 140 }];
  for (const ring of INK_RINGS) {
    let sourceProbes = 0, destinationProbes = 0;
    for (const hub of hubs) {
      if (hub.cx === ring.cx && hub.cy === ring.cy) continue;
      for (let i = 0; i < 144; i++) {
        const p = point(hub, hub.radius - 4, i * Math.PI / 72);
        const radius = Math.hypot(p.x - ring.cx, p.y - ring.cy);
        // Probe actual contour intersections that would otherwise be fully
        // visible; existing label/spine/radial masks cannot pass this test.
        if (radius < ring.inner + ring.feather + 1 || radius > ring.outer - ring.feather - 1
          || Math.abs(p.y - 627) <= 24
          || Math.hypot(p.x - 354, p.y - 627) <= 81
          || Math.hypot(p.x - 626, p.y - 627) <= 148
          || Math.hypot(p.x - 899, p.y - 627) <= 81) continue;
        near(inkMask(p.x, p.y, ring), 0, 1e-10);
        for (const seconds of [3, 9, 22.5, 30, 45, 70]) {
          const angle = seconds * Math.PI / 45;
          const dx = p.x - ring.cx, dy = p.y - ring.cy;
          const destination = {
            x: ring.cx + Math.cos(angle) * dx - Math.sin(angle) * dy,
            y: ring.cy + Math.sin(angle) * dx + Math.cos(angle) * dy,
          };
          if (inkMask(destination.x, destination.y, ring) > .99) {
            const sample = inkSource(destination.x, destination.y, ring, seconds);
            near(sample.x, p.x); near(sample.y, p.y);
            near(sample.weight, 0);
            sourceProbes++;
          }
          const sample = inkSource(p.x, p.y, ring, seconds);
          if (inkMask(sample.x, sample.y, ring) > .99) {
            near(sample.weight, 0);
            destinationProbes++;
          }
        }
      }
    }
    assert.ok(sourceProbes > 0, `No source intersection exercised for ring ${ring.cx}`);
    assert.ok(destinationProbes > 0, `No destination intersection exercised for ring ${ring.cx}`);
  }
});

test('decoded bitmap consumers follow the independent clock through compositor and page suspension', async () => {
  // Exercise the real asynchronous fallback entry point without importing Three.
  const source = await readFile(new URL('../symbol-motion.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m, 'Fallback must not depend on Three startup');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script[^>]*type="module"[^>]*src="\.\/symbol-motion\.js\?/);
  const tracked = [], decodes = [], listeners = {}, windowListeners = {};
  let now = 1000;
  const makeElement = name => ({
    name, children: [], attrs: {}, style: {}, dataset: {}, className: '',
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return this.attrs[key] ?? null; },
    append(child) { this.children.push(child); },
    querySelectorAll(selector) {
      const className = selector.slice(1);
      return this.children.flatMap(child => [
        ...(child.className === className ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    },
    decode() {
      return new Promise(resolve => decodes.push({ image: this, resolve }));
    },
    animate(keyframes, options) {
      const animation = { keyframes, options, currentTime: 0, playState: 'running', playbackRate: 1,
        play() { this.playState = 'running'; }, pause() { this.playState = 'paused'; } };
      tracked.push(animation);
      return animation;
    },
  });
  const image = makeElement('img'); image.src = './art.webp';
  const host = makeElement('host');
  host.querySelector = selector => selector === '.portal-image' ? image : null;
  const panel = makeElement('panel'); panel.setAttribute('aria-hidden', 'true');
  const preference = { matches: true, addEventListener(name, listener) { listeners.preference = listener; } };
  const document = { hidden: false, timeline: { currentTime: now },
    querySelector(selector) {
      return selector === '.portal-artwork' ? host : selector === '#world-panel' ? panel : null;
    },
    createElement(name) { return makeElement(name); },
    addEventListener(name, listener) { listeners[name] = listener; },
  };
  const replacements = { document,
    window: { addEventListener(name, listener) { windowListeners[name] = listener; } },
    performance: { now: () => now },
    Image: class { constructor() { return makeElement('mask-image'); } },
    matchMedia: () => preference,
    MutationObserver: class { constructor(listener) { listeners.panel = listener; } observe() {} },
  };
  const advance = milliseconds => { now += milliseconds; document.timeline.currentTime = now; };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const assertPlaying = expected => assert.ok(tracked.every(animation =>
    animation.playState === (expected ? 'running' : 'paused')));
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key,
    Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(replacements))
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    const motion = await import(`../symbol-motion.js?fallback-test=${Date.now()}`);
    assert.equal(decodes.length, INK_RINGS.length * 2, 'Both source images and destination masks must decode');
    assert.equal(host.children.length, 0, 'Undecoded layers must never cover the artwork');
    assert.equal(tracked.length, 0);
    assert.equal(motion.getInkMotion().active, false);
    for (let i = 0; i < INK_RINGS.length; i++) {
      assert.match(decodes[i * 2].image.src, new RegExp(`/assets/symbol-mask-${i}\\.png$`));
      assert.match(decodes[i * 2 + 1].image.src, new RegExp(`/assets/symbol-ring-${i}\\.webp$`));
      assert.equal(decodes[i * 2 + 1].image.width, INK_RINGS[i].outer * 2);
      assert.equal(decodes[i * 2 + 1].image.height, INK_RINGS[i].outer * 2);
    }
    decodes.slice(0, -1).forEach(decode => decode.resolve());
    await flush();
    assert.equal(host.children.length, 0, 'A single pending mask or source keeps the complete layer hidden');
    advance(5000);
    decodes.at(-1).resolve();
    await flush();
    assert.equal(host.children.length, 1);
    const layer = host.children[0];
    assert.equal(layer.className, 'symbol-ink');
    assert.equal(layer.getAttribute('aria-hidden'), 'true');
    for (let i = 0; i < INK_RINGS.length; i++) {
      const band = layer.children[i];
      const ring = INK_RINGS[i];
      assert.equal(band.className, 'symbol-ink-band');
      near(parseFloat(band.style.left), (ring.cx - ring.outer) / 1254 * 100);
      near(parseFloat(band.style.top), (ring.cy - ring.outer) / 1254 * 100);
      near(parseFloat(band.style.width), ring.outer * 2 / 1254 * 100);
      assert.equal(band.style.width, band.style.height);
      assert.equal(band.style.maskImage, band.style.webkitMaskImage);
      assert.ok(band.style.maskImage.includes(`/assets/symbol-mask-${i}.png`));
      assert.equal(band.children[0].dataset.inkRing, i);
    }
    assert.equal(tracked.length, INK_RINGS.length);
    for (const animation of tracked) {
      assert.equal(animation.playState, 'running');
      assert.equal(animation.playbackRate, .5);
      near(animation.currentTime, 2500);
      near(animation.startTime, 1000);
      assert.deepEqual(animation.keyframes, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]);
      assert.equal(animation.options.duration, INK_CYCLE * 1000);
      assert.equal(animation.options.easing, 'linear');
      assert.equal(animation.options.iterations, Infinity);
    }
    assert.equal(motion.getInkMotion().active, true);
    assert.equal(motion.getInkMotion().reduced, true);
    assert.equal(motion.getInkMotion().paused, false);
    // A stalled or reset DOM animation cannot change the primary clock.
    tracked.forEach(animation => { animation.currentTime = 0; });
    advance(500);
    near(motion.getInkMotion().seconds, 2.75);
    near(motion.getInkMotion().angle, 11 * Math.PI / 180);
    motion.setInkCompositorHidden(true);
    assertPlaying(false);
    assert.equal(motion.getInkMotion().paused, false);
    advance(10000);
    near(motion.getInkMotion().seconds, 7.75);
    motion.setInkCompositorHidden(false);
    assertPlaying(true);
    assert.ok(tracked.every(animation => animation.currentTime === 7750));
    assert.ok(tracked.every(animation => animation.startTime === now - 7750 / .5));
    listeners.preference({ matches: false });
    assert.equal(motion.getInkMotion().reduced, false);
    assert.ok(tracked.every(animation => animation.playbackRate === 1));
    assertPlaying(true);
    near(motion.getInkMotion().seconds, 7.75);
    advance(2000);
    near(motion.getInkMotion().seconds, 9.75);

    document.hidden = true; listeners.visibilitychange();
    assertPlaying(false);
    assert.equal(motion.getInkMotion().paused, true);
    advance(120000);
    near(motion.getInkMotion().seconds, 9.75);
    document.hidden = false; listeners.visibilitychange();
    assertPlaying(true);
    assert.equal(motion.getInkMotion().paused, false);
    advance(1000);
    near(motion.getInkMotion().seconds, 10.75);

    panel.setAttribute('aria-hidden', 'false'); listeners.panel();
    assertPlaying(false);
    advance(30000);
    near(motion.getInkMotion().seconds, 10.75);
    panel.setAttribute('aria-hidden', 'true'); listeners.panel();
    assertPlaying(true);
    motion.pauseInkMotion(true);
    assertPlaying(false);
    advance(30000);
    near(motion.getInkMotion().seconds, 10.75);
    motion.pauseInkMotion(false);
    assertPlaying(true);

    // BFCache suspension is explicit even if visibilitychange never fires.
    windowListeners.pagehide({ persisted: true });
    assertPlaying(false);
    assert.equal(motion.getInkMotion().paused, true);
    advance(240000);
    near(motion.getInkMotion().seconds, 10.75);
    windowListeners.pageshow({ persisted: true });
    assertPlaying(true);
    assert.equal(motion.getInkMotion().paused, false);
    assert.ok(tracked.every(animation => animation.currentTime === 10750));
    advance(1000);
    near(motion.getInkMotion().seconds, 11.75);

    // Lifecycle recovery cannot unhide consumers selected off by WebGL.
    motion.setInkCompositorHidden(true);
    windowListeners.pagehide({ persisted: true });
    advance(1000);
    windowListeners.pageshow({ persisted: true });
    assertPlaying(false);
    advance(1000);
    near(motion.getInkMotion().seconds, 12.75);
    motion.setInkCompositorHidden(false);
    assertPlaying(true);
    assert.ok(tracked.every(animation => animation.currentTime === 12750));
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
