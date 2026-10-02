import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInkClock, INK_CYCLE } from '../symbol-motion.js';

const TAU = Math.PI * 2;
const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} near ${expected}`);
const phase = seconds => (seconds % INK_CYCLE) * TAU / INK_CYCLE;
const fixture = (initial = 1000) => {
  let now = initial;
  return { clock: createInkClock(() => now), advance(milliseconds) { now += milliseconds; } };
};

test('ink clock follows elapsed time across irregular and delayed reads without slowing', () => {
  const { clock, advance } = fixture();
  assert.deepEqual(clock.read(), { seconds: 0, angle: 0, paused: false, rate: 1 });
  let milliseconds = 0;
  for (const delay of [16, 17, 91, 3000, 7, 12000, 240000, 90000]) {
    advance(delay);
    milliseconds += delay;
    const state = clock.read();
    near(state.seconds, milliseconds / 1000);
    near(state.angle, phase(milliseconds / 1000));
    assert.equal(state.paused, false);
    assert.equal(state.rate, 1);
  }
});

test('pausing captures the current phase and resuming preserves it', () => {
  const { clock, advance } = fixture();
  // No read occurs before pausing: the setter must account for all elapsed time.
  advance(12500);
  clock.setPaused(true);
  const paused = clock.read();
  near(paused.seconds, 12.5);
  near(paused.angle, phase(12.5));
  assert.equal(paused.paused, true);
  advance(180000);
  assert.deepEqual(clock.read(), paused);
  clock.setPaused(false);
  const resumed = clock.read();
  near(resumed.seconds, paused.seconds);
  near(resumed.angle, paused.angle);
  assert.equal(resumed.paused, false);
  advance(7500);
  near(clock.read().seconds, 20);
  near(clock.read().angle, phase(20));
});

test('rate changes preserve phase and reduced motion continues at half speed', () => {
  const { clock, advance } = fixture();
  advance(20000);
  clock.setRate(.5);
  const reduced = clock.read();
  near(reduced.seconds, 20);
  near(reduced.angle, phase(20));
  assert.equal(reduced.rate, .5);
  assert.equal(reduced.paused, false);
  advance(16000);
  near(clock.read().seconds, 28);
  clock.setRate(1);
  near(clock.read().angle, phase(28));
  advance(11000);
  near(clock.read().seconds, 39);
  near(clock.read().angle, phase(39));
});

test('rate changes during a pause apply only after resuming', () => {
  const { clock, advance } = fixture();
  advance(6000);
  clock.setPaused(true);
  advance(20000);
  clock.setRate(.5);
  advance(30000);
  near(clock.read().seconds, 6);
  assert.equal(clock.read().rate, .5);
  clock.setPaused(false);
  advance(10000);
  near(clock.read().seconds, 11);
  near(clock.read().angle, phase(11));
});

test('repeated pause and rate synchronisation cannot reset or restart the clock', () => {
  const { clock, advance } = fixture();
  for (let i = 0; i < 10; i++) {
    advance(1250);
    clock.setPaused(false);
    clock.setRate(1);
  }
  near(clock.read().seconds, 12.5);
  clock.setPaused(true);
  for (let i = 0; i < 10; i++) {
    advance(1250);
    clock.setPaused(true);
    clock.setRate(.5);
  }
  near(clock.read().seconds, 12.5);
  clock.setPaused(false);
  for (let i = 0; i < 10; i++) {
    advance(1250);
    clock.setPaused(false);
    clock.setRate(.5);
  }
  const state = clock.read();
  near(state.seconds, 18.75);
  near(state.angle, phase(18.75));
  assert.equal(state.paused, false);
  assert.equal(state.rate, .5);
});

test('long sessions keep a finite periodic clockwise angle without discarding elapsed seconds', () => {
  const { clock, advance } = fixture();
  // Millions of full revolutions plus a visible quarter turn.
  const elapsed = INK_CYCLE * 10_000_000 + INK_CYCLE / 4;
  advance(elapsed * 1000);
  const quarter = clock.read();
  near(quarter.seconds, elapsed);
  near(quarter.angle, Math.PI / 2);
  assert.ok(Number.isFinite(quarter.angle));
  assert.ok(quarter.angle >= 0 && quarter.angle < TAU);
  advance(INK_CYCLE * 1000);
  const repeated = clock.read();
  near(repeated.seconds, elapsed + INK_CYCLE);
  near(repeated.angle, quarter.angle);
  advance(INK_CYCLE / 4 * 1000);
  near(clock.read().angle, Math.PI);
  advance(INK_CYCLE / 2 * 1000);
  near(clock.read().angle, 0);
});
