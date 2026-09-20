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

test('animation starts independently of Three and remains active with reduced motion', async () => {
  // Exercise the fallback entry point without creating or importing WebGL.
  // Browser verification separately checks actual SVG rendering and playback.
  const source = await readFile(new URL('../symbol-motion.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m, 'Fallback must not depend on Three startup');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script[^>]*type="module"[^>]*src="\.\/symbol-motion\.js\?/);
  const tracked = [], listeners = {};
  const makeElement = name => ({
    name, children: [], attrs: {}, style: {}, classList: { add() {} },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return this.attrs[key] ?? null; },
    append(child) { this.children.push(child); },
    animate(keyframes, options) {
      const animation = { keyframes, options, currentTime: 0, playState: 'running', playbackRate: 1,
        updatePlaybackRate(value) { this.playbackRate = value; },
        play() { this.playState = 'running'; }, pause() { this.playState = 'paused'; } };
      tracked.push(animation);
      return animation;
    },
  });
  const image = makeElement('image'); image.setAttribute('src', './art.webp');
  const host = makeElement('host'); host.querySelector = () => image;
  const panel = makeElement('panel'); panel.setAttribute('aria-hidden', 'true');
  const preference = { matches: true, addEventListener(name, listener) { listeners.preference = listener; } };
  const document = { hidden: false, timeline: { currentTime: 1234 },
    querySelector(selector) { return selector === '.portal-artwork' ? host : panel; },
    createElementNS(ns, name) { return makeElement(name); },
    addEventListener(name, listener) { listeners[name] = listener; },
  };
  const replacements = { document, window: { addEventListener() {} }, matchMedia: () => preference,
    MutationObserver: class { constructor(listener) { listeners.panel = listener; } observe() {} },
  };
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key,
    Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(replacements))
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    const motion = await import(`../symbol-motion.js?fallback-test=${Date.now()}`);
    assert.equal(tracked.length, INK_RINGS.length);
    for (const animation of tracked) {
      assert.equal(animation.playState, 'running');
      assert.equal(animation.playbackRate, .5);
      assert.equal(animation.startTime, 1234);
      assert.deepEqual(animation.keyframes, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]);
      assert.equal(animation.options.duration, INK_CYCLE * 1000);
      assert.equal(animation.options.easing, 'linear');
    }
    assert.equal(motion.getInkMotion().active, true);
    assert.equal(motion.getInkMotion().reduced, true);
    assert.equal(motion.getInkMotion().paused, false);
    tracked.forEach(animation => { animation.currentTime = 2500; });
    near(motion.getInkMotion().angle, 10 * Math.PI / 180);
    listeners.preference({ matches: false });
    assert.ok(tracked.every(animation => animation.playbackRate === 1 && animation.playState === 'running'));
    document.hidden = true; listeners.visibilitychange();
    assert.ok(tracked.every(animation => animation.playState === 'paused'));
    document.hidden = false; listeners.visibilitychange();
    assert.ok(tracked.every(animation => animation.playState === 'running'));
    panel.setAttribute('aria-hidden', 'false'); listeners.panel();
    assert.ok(tracked.every(animation => animation.playState === 'paused'));
    panel.setAttribute('aria-hidden', 'true'); listeners.panel();
    assert.ok(tracked.every(animation => animation.playState === 'running'));
    motion.pauseInkMotion(true);
    assert.ok(tracked.every(animation => animation.playState === 'paused'));
    motion.pauseInkMotion(false);
    assert.ok(tracked.every(animation => animation.playState === 'running'));
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
