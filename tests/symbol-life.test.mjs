import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleLife, sampleBand, deformSurface } from '../symbol-life.js';

const near = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`);
};

test('the living body breathes within a stable envelope throughout long sessions', () => {
  let smallestBody = Infinity;
  let largestBody = -Infinity;
  const times = Array.from({ length: 2401 }, (_, index) => index / 20);
  times.push(3600, 86_400, 604_800, 31_536_000);
  for (const time of times) {
    const life = sampleLife(time);
    for (const value of Object.values(life)) assert.ok(Number.isFinite(value));
    assert.ok(life.bodyScale >= .96 && life.bodyScale <= 1.04);
    assert.ok(life.opening >= 0 && life.opening <= 1);
    assert.ok(life.breath >= -1 && life.breath <= 1);
    assert.ok(life.pulse >= 0 && life.pulse <= 1.4);
    smallestBody = Math.min(smallestBody, life.bodyScale);
    largestBody = Math.max(largestBody, life.bodyScale);
    for (const outer of [false, true]) {
      for (let index = 0; index < 4; index++) {
        const pose = sampleBand(life, index, outer);
        for (const value of Object.values(pose)) assert.ok(Number.isFinite(value));
        assert.ok(Math.abs(pose.x) <= .4 && Math.abs(pose.y) <= .4);
        assert.ok(pose.scale >= .94 && pose.scale <= 1.06);
      }
    }
  }
  assert.ok(smallestBody < .98, 'the organism visibly exhales');
  assert.ok(largestBody > 1.02, 'the organism visibly inhales');
});

test('paired layers counter-rotate while breathing at exactly the same scale', () => {
  for (let frame = 0; frame <= 1920; frame++) {
    const life = sampleLife(frame / 60);
    for (const outer of [false, true]) {
      for (const firstIndex of [0, 2]) {
        const first = sampleBand(life, firstIndex, outer);
        const second = sampleBand(life, firstIndex + 1, outer);
        for (const axis of ['x', 'y', 'z']) near(first[axis] + second[axis], 0);
        near(first.scale, second.scale);
      }
    }
  }
});

test('surface deformation preserves opposite points and the centre in three dimensions', () => {
  for (const time of [0, .13, 1.6, 3.2, 6.4, 17.3, 3600, 86_400]) {
    const { breath } = sampleLife(time);
    near(deformSurface(0, 0, 0, time, breath).x, 0);
    near(deformSurface(0, 0, 0, time, breath).y, 0);
    near(deformSurface(0, 0, 0, time, breath).z, 0);
    for (const radius of [.01, .54, 1.48, 3.3, 4.82, 6]) {
      for (let sample = 0; sample < 96; sample++) {
        const angle = sample * Math.PI * 2 / 96;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = sample % 2 ? .024 : -.024;
        const a = deformSurface(x, y, z, time, breath);
        const b = deformSurface(-x, -y, -z, time, breath);
        for (const axis of ['x', 'y', 'z']) near(a[axis] + b[axis], 0);
        const deformedRadius = Math.hypot(a.x, a.y);
        assert.ok(deformedRadius >= radius * .98 && deformedRadius <= radius * 1.02);
        assert.ok(Math.abs(a.z - z) <= radius * .026);
      }
    }
  }
});

test('breathing, circulation and surface waves remain smooth across cycle boundaries', () => {
  const dt = 1 / 60;
  for (let frame = 0; frame < 2400; frame++) {
    const time = frame * dt;
    const before = sampleLife(time);
    const after = sampleLife(time + dt);
    assert.ok(Math.abs(after.bodyScale - before.bodyScale) < .002);
    assert.ok(after.circulation > before.circulation, 'circulation never snaps backwards');
    for (const outer of [false, true]) {
      for (let index = 0; index < 4; index++) {
        const a = sampleBand(before, index, outer);
        const b = sampleBand(after, index, outer);
        for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(b[axis] - a[axis]) < .02);
        assert.ok(Math.abs(b.scale - a.scale) < .003);
      }
    }
    const a = deformSurface(4, 3, .02, time, before.breath);
    const b = deformSurface(4, 3, .02, time + dt, after.breath);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < .01);
  }
});
