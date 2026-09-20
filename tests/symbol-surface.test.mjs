import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SURFACE_CYCLE, SURFACE_RINGS, SURFACE_SCALE, SURFACE_SIZE, advanceSurfaceTime,
  sampleSurface, sampleSurfaceBasis, sampleSurfaceLife,
} from '../symbol-surface.js';

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} near ${expected}`);
const cycleTimes = Array.from({ length: 25 }, (_, i) => 72 + i * SURFACE_CYCLE / 24);
const sessionTimes = [0, 1, 2.4, 6, 12, ...cycleTimes, 3600, 86400, 604800, 31536000];
const ringPoints = ring => Array.from({ length: 24 }, (_, i) => {
  const a = (i + .5) * Math.PI / 12, r = (ring.inner + ring.outer) / 2;
  return [ring.cx + r * Math.cos(a), ring.cy + r * Math.sin(a)];
});
const slope = (x, y, t) => [
  (sampleSurface(x + .5, y, t).z - sampleSurface(x - .5, y, t).z) / SURFACE_SCALE,
  (sampleSurface(x, y - .5, t).z - sampleSurface(x, y + .5, t).z) / SURFACE_SCALE,
];

test('all source coordinates and radii remain exact throughout cycles and long sessions', () => {
  const points = [];
  for (let y = 0; y <= SURFACE_SIZE; y += 19)
    for (let x = 0; x <= SURFACE_SIZE; x += 19) points.push([x, y]);
  for (const ring of SURFACE_RINGS)
    for (const r of [ring.inner, (ring.inner + ring.outer) / 2, ring.outer])
      for (let i = 0; i < 48; i++)
        points.push([ring.cx + r * Math.cos(i * Math.PI / 24),
          ring.cy + r * Math.sin(i * Math.PI / 24)]);
  let maxRelief = 0;
  for (const t of sessionTimes) {
    assert.equal(sampleSurfaceLife(t).bodyScale, 1);
    for (const [x, y] of points) {
      const p = sampleSurface(x, y, t);
      assert.equal(p.x, x, 'Original X changed');
      assert.equal(p.y, y, 'Original Y changed');
      assert.ok(Number.isFinite(p.z) && p.z >= -1e-10 && p.z <= .222, 'Unbounded relief');
      for (const r of SURFACE_RINGS)
        assert.equal(Math.hypot(p.x - r.cx, p.y - r.cy), Math.hypot(x - r.cx, y - r.cy));
      maxRelief = Math.max(maxRelief, p.z);
    }
  }
  assert.ok(maxRelief > .18, 'Actual three-dimensional relief is missing');
});

test('spine, labels and outside contour remain anchored in all three dimensions', () => {
  const anchors = [[0, 0], [0, SURFACE_SIZE], [SURFACE_SIZE, 0], [SURFACE_SIZE, SURFACE_SIZE]];
  for (let x = 0; x <= SURFACE_SIZE; x += 17)
    for (const y of [619, 627, 635]) anchors.push([x, y]);
  for (const [cx, cy, radius] of [[354, 627, 69], [626, 627, 130], [899, 627, 69], [627, 627, 540]])
    for (const fraction of (radius === 540 ? [1] : [0, .5, 1]))
      for (let i = 0; i < 48; i++)
        anchors.push([cx + Math.cos(i * Math.PI / 24) * radius * fraction,
          cy + Math.sin(i * Math.PI / 24) * radius * fraction]);
  for (const t of sessionTimes)
    for (const [x, y] of anchors) {
      const p = sampleSurface(x, y, t);
      assert.equal(p.x, x);
      assert.equal(p.y, y);
      near(p.z, 0);
    }
});

test('each region changes real depth and slope within two seconds at every cycle phase', () => {
  // A moving clock is not sufficient: exclude a static image and phase stalls.
  for (const ring of SURFACE_RINGS)
    for (const t of cycleTimes) {
      let depthChange = 0, slopeChange = 0;
      for (const [x, y] of ringPoints(ring)) {
        depthChange = Math.max(depthChange,
          Math.abs(sampleSurface(x, y, t + 2).z - sampleSurface(x, y, t).z));
        const a = slope(x, y, t), b = slope(x, y, t + 2);
        slopeChange = Math.max(slopeChange, Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      assert.ok(depthChange > .02, `Depth stalled at ${ring.cx},${ring.cy}, time ${t}`);
      assert.ok(slopeChange > .03, `Normals stalled at ${ring.cx},${ring.cy}, time ${t}`);
    }
});

test('isolated left and right hubs move together in the same direction', () => {
  // Exclude the deliberately eccentric centre ring's overlapping regions.
  for (const t of sessionTimes)
    for (const a of [1, 1.5, 2, 4, 4.5, 5].map(n => n * Math.PI / 3)) {
      const dx = 100 * Math.cos(a), dy = 100 * Math.sin(a);
      const left = sampleSurface(354 + dx, 627 + dy, t);
      const right = sampleSurface(899 + dx, 627 + dy, t);
      near(right.x - left.x, 545);
      near(left.y, right.y);
      near(left.z, right.z);
      const l = slope(354 + dx, 627 + dy, t), r = slope(899 + dx, 627 + dy, t);
      near(l[0], r[0]);
      near(l[1], r[1]);
    }
});

test('sampled relief travels clockwise through every phase without reversing', () => {
  // These four isolated points recover the primary wave's spatial phase while
  // cancelling the secondary harmonic. Positive angles are clockwise in the
  // drawing's downward-Y coordinates; no direction configuration is inspected.
  for (const ring of SURFACE_RINGS) {
    const radius = (ring.inner + ring.outer) / 2;
    const points = [Math.PI / 4, Math.PI / 3, 2 * Math.PI / 3, 3 * Math.PI / 4]
      .map(angle => {
        const x = ring.cx + radius * Math.cos(angle);
        const y = ring.cy + radius * Math.sin(angle);
        for (const other of SURFACE_RINGS) {
          if (other === ring) continue;
          const distance = Math.hypot(x - other.cx, y - other.cy);
          assert.ok(distance <= other.inner || distance >= other.outer,
            'Direction probe must sample only one field');
        }
        const envelope = sampleSurfaceBasis(x, y)[0];
        assert.ok(envelope > .001, 'Direction probe must be outside fixed anchors');
        return { x, y, envelope };
      });
    let previousPhase;
    for (let step = 0; step <= 72; step++) {
      const time = 72 + step * SURFACE_CYCLE / 24;
      const relief = sampleSurfaceLife(time).relief;
      const [a, b, c, d] = points.map(({ x, y, envelope }) =>
        sampleSurface(x, y, time).z / (relief * envelope) - 1);
      const sine = (a - d) / 2;
      const cosine = -(b + c) + (a + d) / 2;
      assert.ok(Math.hypot(sine, cosine) > .5, 'Travelling relief disappeared');
      const phase = Math.atan2(sine, cosine);
      if (previousPhase !== undefined) {
        const delta = Math.atan2(Math.sin(phase - previousPhase),
          Math.cos(phase - previousPhase));
        assert.ok(delta > 0, `Relief reversed at ring ${ring.cx}, time ${time}`);
        near(delta, Math.PI * 2 / 24);
      }
      previousPhase = phase;
    }
  }
});

test('precomputed coefficients match an analytic travelling wave and source-Y slope sign', () => {
  const ring = SURFACE_RINGS[0], radius = (ring.inner + ring.outer) / 2;
  for (const angle of [Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI * 3 / 4]) {
    const x = ring.cx + radius * Math.cos(angle), y = ring.cy + radius * Math.sin(angle);
    const basis = sampleSurfaceBasis(x, y);
    near(basis[0], ring.height);
    const left = sampleSurfaceBasis(x - .5, y), right = sampleSurfaceBasis(x + .5, y);
    const top = sampleSurfaceBasis(x, y - .5), bottom = sampleSurfaceBasis(x, y + .5);
    for (const t of sessionTimes) {
      const life = sampleSurfaceLife(t), phase = life.phase;
      const expected = life.relief * ring.height *
        (1 + .6 * Math.cos(2 * angle - phase) + .1 * Math.cos(4 * angle - 2 * phase));
      near(sampleSurface(x, y, t).z, expected);
      // Float32 matches the actual precision of the GPU attributes.
      const gpuHeight = life.relief * (Math.fround(basis[0]) + life.wave.reduce(
        (sum, wave, i) => sum + wave * Math.fround(basis[i + 1]), 0));
      near(gpuHeight, expected, 5e-8);
      const gradient = (a, b) => life.relief * (Math.fround((a[0] - b[0]) / SURFACE_SCALE)
        + life.wave.reduce((sum, wave, i) => sum +
          wave * Math.fround((a[i + 1] - b[i + 1]) / SURFACE_SCALE), 0));
      const reference = slope(x, y, t);
      near(gradient(right, left), reference[0], 5e-8);
      near(gradient(top, bottom), reference[1], 5e-8);
    }
  }
});

test('relief is continuous at field boundaries and periodic without accumulated drift', () => {
  const e = .0001;
  for (const t of [73.5, 79.5, 91.5, 100.5, 31536000]) {
    for (const ring of SURFACE_RINGS)
      for (const r of [ring.inner, ring.outer])
        for (let i = 0; i < 48; i++) {
          const a = i * Math.PI / 24;
          const p = sampleSurface(ring.cx + Math.cos(a) * (r - e), ring.cy + Math.sin(a) * (r - e), t);
          const q = sampleSurface(ring.cx + Math.cos(a) * (r + e), ring.cy + Math.sin(a) * (r + e), t);
          assert.ok(Math.abs(p.z - q.z) < .00002, 'Discontinuous relief seam');
        }
    for (const [x, y] of [[940, 950], [318, 537], [932, 537], [626, 448]]) {
      const a = sampleSurface(x, y, t), b = sampleSurface(x, y, t + SURFACE_CYCLE);
      assert.equal(a.x, b.x);
      assert.equal(a.y, b.y);
      near(a.z, b.z, 1e-6);
    }
  }
});

test('one-FPS and sixty-FPS rendering advance by the same active wall time', () => {
  const run = fps => {
    let elapsed = 0, previous = null;
    for (let frame = 0; frame <= 30 * fps; frame++) {
      const now = 1000 + frame * 1000 / fps;
      elapsed = advanceSurfaceTime(elapsed, previous, now);
      previous = now;
    }
    return elapsed;
  };
  const slow = run(1), fast = run(60);
  near(slow, 30);
  near(fast, 30);
  for (const [x, y] of ringPoints(SURFACE_RINGS[0]))
    near(sampleSurface(x, y, slow).z, sampleSurface(x, y, fast).z);
  near(advanceSurfaceTime(5, 1000, 3500), 7.5);
  near(advanceSurfaceTime(5, 1000, 900), 5);
});

test('suspension reset and pause preserve pose without catch-up', () => {
  let elapsed = advanceSurfaceTime(4, null, 1000);
  near(elapsed, 4);
  elapsed = advanceSurfaceTime(elapsed, 1000, 1100);
  near(elapsed, 4.1);
  const pose = sampleSurface(900, 970, elapsed);
  // Wake resets previousTime to null, excluding the suspended duration.
  elapsed = advanceSurfaceTime(elapsed, null, 301100);
  assert.deepEqual(sampleSurface(900, 970, elapsed), pose);
  elapsed = advanceSurfaceTime(elapsed, 301100, 601100, true);
  assert.deepEqual(sampleSurface(900, 970, elapsed), pose);
  elapsed = advanceSurfaceTime(elapsed, null, 601200);
  assert.deepEqual(sampleSurface(900, 970, elapsed), pose);
  elapsed = advanceSurfaceTime(elapsed, 601200, 601450);
  near(elapsed, 4.35);
  assert.notEqual(sampleSurface(900, 970, elapsed).z, pose.z);
});
