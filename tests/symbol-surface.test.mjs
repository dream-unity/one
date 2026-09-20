import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SURFACE_CYCLE, SURFACE_RINGS, SURFACE_SIZE, sampleSurface, sampleSurfaceLife,
} from '../symbol-surface.js';

const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`);
};
const cycleTimes = Array.from({ length: 25 }, (_, index) => 72 + index * SURFACE_CYCLE / 24);
const sessionTimes = [0, 1, 2.4, 6, 12, ...cycleTimes, 3600, 86_400, 604_800, 31_536_000];

test('the spine, labels and outside contour remain grounded throughout the cycle and long sessions', () => {
  const anchors = [];
  for (let x = 0; x <= SURFACE_SIZE; x += 17) {
    for (const y of [619, 627, 635]) anchors.push([x, y]);
  }
  for (const [cx, cy, radius] of [[354, 627, 69], [626, 627, 130], [899, 627, 69]]) {
    for (const fraction of [0, .5, 1]) {
      for (let index = 0; index < 24; index++) {
        const angle = index * Math.PI / 12;
        anchors.push([cx + Math.cos(angle) * radius * fraction,
          cy + Math.sin(angle) * radius * fraction]);
      }
    }
  }
  for (let index = 0; index < 96; index++) {
    const angle = index * Math.PI / 48;
    anchors.push([627 + Math.cos(angle) * 540, 627 + Math.sin(angle) * 540]);
  }
  anchors.push([0, 0], [0, SURFACE_SIZE], [SURFACE_SIZE, 0], [SURFACE_SIZE, SURFACE_SIZE]);
  for (const seconds of sessionTimes) {
    assert.equal(sampleSurfaceLife(seconds).bodyScale, 1);
    for (const [x, y] of anchors) {
      const p = sampleSurface(x, y, seconds);
      near(p.x, x);
      near(p.y, y);
      near(p.z, 0);
    }
  }
});

test('the actual surface does not fold or exceed bounded travel across a full cycle', () => {
  // An earlier 26px spine feather folded at (1092, 648), with a negative
  // determinant. Check that regression point as well as the complete field.
  const points = [[1092, 648], [162, 675], [1092, 582], [162, 579]];
  for (let y = 72; y <= 1182; y += 12) {
    for (let x = 72; x <= 1182; x += 12) points.push([x, y]);
  }
  const epsilon = .05;
  let minDeterminant = Infinity;
  let maxTravel = 0;
  let maxRelief = 0;
  for (const seconds of sessionTimes) {
    for (const [x, y] of points) {
      const p = sampleSurface(x, y, seconds);
      const left = sampleSurface(x - epsilon, y, seconds);
      const right = sampleSurface(x + epsilon, y, seconds);
      const top = sampleSurface(x, y - epsilon, seconds);
      const bottom = sampleSurface(x, y + epsilon, seconds);
      const determinant = ((right.x - left.x) * (bottom.y - top.y)
        - (right.y - left.y) * (bottom.x - top.x)) / (4 * epsilon * epsilon);
      assert.ok(Number.isFinite(determinant), `Non-finite Jacobian at ${x},${y},${seconds}`);
      assert.ok(determinant > .2, `Fold or near collapse at ${x},${y},${seconds}: ${determinant}`);
      assert.ok(p.z >= 0 && p.z <= .37, `Relief escaped its bound at ${x},${y},${seconds}`);
      const travel = Math.hypot(p.x - x, p.y - y);
      assert.ok(travel <= 30, `Excessive displacement at ${x},${y},${seconds}: ${travel}`);
      minDeterminant = Math.min(minDeterminant, determinant);
      maxTravel = Math.max(maxTravel, travel);
      maxRelief = Math.max(maxRelief, p.z);
    }
  }
  // These lower bounds also prevent accidentally restoring an inert image.
  assert.ok(maxTravel > 20, `Tangential movement became imperceptible: ${maxTravel}`);
  assert.ok(maxRelief > .25, `The actual 3D relief was flattened: ${maxRelief}`);
  assert.ok(minDeterminant < .95, 'The deformation was replaced by a static plane');
});

test('the isolated left and right hub regions mirror each other in position and relief', () => {
  // Their source centres are 354 and 899, giving an axis of 626.5. Avoid
  // demanding false symmetry from the deliberately eccentric central artwork.
  for (const seconds of sessionTimes) {
    for (const angle of [Math.PI / 3, Math.PI / 2, Math.PI * 2 / 3,
      Math.PI * 4 / 3, Math.PI * 3 / 2, Math.PI * 5 / 3]) {
      const dx = 100 * Math.cos(angle), dy = 100 * Math.sin(angle);
      const left = sampleSurface(354 + dx, 627 + dy, seconds);
      const right = sampleSurface(899 - dx, 627 + dy, seconds);
      near(left.x + right.x, 1253);
      near(left.y, right.y);
      near(left.z, right.z);
    }
  }
});

test('deformation stays connected across field boundaries and settles into a bounded repeat', () => {
  const epsilon = .0001;
  for (const seconds of [73.5, 79.5, 91.5, 100.5, 31_536_000]) {
    for (const ring of SURFACE_RINGS) {
      for (const radius of [ring.inner, ring.outer]) {
        for (let index = 0; index < 48; index++) {
          const angle = index * Math.PI / 24;
          const a = sampleSurface(ring.cx + Math.cos(angle) * (radius - epsilon),
            ring.cy + Math.sin(angle) * (radius - epsilon), seconds);
          const b = sampleSurface(ring.cx + Math.cos(angle) * (radius + epsilon),
            ring.cy + Math.sin(angle) * (radius + epsilon), seconds);
          assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .002,
            `A seam opened at ring ${ring.cx},${ring.cy}, angle ${angle}`);
          assert.ok(Math.abs(a.z - b.z) < .00002, 'Relief has a discontinuous seam');
        }
      }
    }
    for (const [x, y] of [[940, 950], [318, 537], [932, 537], [626, 448]]) {
      const a = sampleSurface(x, y, seconds);
      const b = sampleSurface(x, y, seconds + SURFACE_CYCLE);
      near(a.x, b.x, 1e-6);
      near(a.y, b.y, 1e-6);
      near(a.z, b.z, 1e-6);
    }
  }
});
