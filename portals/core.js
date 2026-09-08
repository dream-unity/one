// Small, inspectable models. Units and limits are explained beside each activity.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function signalField(seed, round) {
  const random = rng(seed + round * 7919);
  const right = random() > .5;
  const margin = [10, 6, 2, 8, 4, 2, 6, 4][round % 8];
  const rightCount = 24 + (right ? margin : -margin);
  return { right, rightCount, values: shuffle(Array.from({ length: 48 }, (_, i) => i < rightCount), random) };
}
// Binary Brier convention: [0,1], not the doubled two-category convention.
export const brier = (probability, outcome) => (clamp(probability, 0, 1) - Number(outcome)) ** 2;
export function forecastWorld(seed) {
  const random = rng(seed);
  const probability = [.2, .35, .65, .8][Math.floor(random() * 4)];
  // Outcomes exist before the learner makes any prediction.
  const draws = Array.from({ length: 24 }, () => random() < probability);
  return { probability, history: draws.slice(0, 12), future: draws.slice(12) };
}
export const posteriorMean = history => (history.filter(Boolean).length + 1) / (history.length + 2);
export function calibration(records) {
  return [[0, .25], [.25, .5], [.5, .75], [.75, 1.001]].map(([lo, hi]) => {
    const rows = records.filter(r => r.p >= lo && r.p < hi);
    return { lo, hi: Math.min(1, hi), n: rows.length, predicted: mean(rows.map(r => r.p)), observed: mean(rows.map(r => Number(r.y))) };
  });
}

export class Clock {
  constructor(duration) { this.duration = duration; this.elapsed = 0; this.running = false; this.last = null; }
  start(now) { if (this.elapsed < this.duration) { this.running = true; this.last = now; } }
  tick(now) {
    if (this.running) {
      this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, now - this.last) / 1000);
      this.last = now;
      if (this.elapsed >= this.duration) this.running = false;
    }
    return this.elapsed;
  }
  pause(now) { this.tick(now); this.running = false; this.last = null; }
  get done() { return this.elapsed >= this.duration; }
}

// Exact free flight between impacts. e is the speed restitution coefficient.
export function makeBall({ height = 3, mass = 1, gravity = 9.81, restitution = .8 } = {}) {
  return { y: height, v: 0, t: 0, mass, gravity, restitution, initial: mass * gravity * height, heat: 0, hits: 0, rest: false };
}
export function stepBall(ball, seconds) {
  const b = { ...ball };
  let left = Math.max(0, seconds), iterations = 0;
  if (b.rest) { b.t += left; return b; }
  while (left > 1e-10 && iterations++ < 100) {
    const hitTime = (b.v + Math.sqrt(b.v * b.v + 2 * b.gravity * Math.max(0, b.y))) / b.gravity;
    if (hitTime > left) {
      b.y += b.v * left - .5 * b.gravity * left * left;
      b.v -= b.gravity * left;
      b.t += left; left = 0;
    } else {
      b.v -= b.gravity * hitTime;
      b.y = 0; b.t += hitTime; left -= hitTime;
      b.v = -b.v * b.restitution; b.hits++;
      b.heat = b.initial - .5 * b.mass * b.v * b.v;
      if (b.v < .015) { b.v = 0; b.rest = true; b.heat = b.initial; b.t += left; left = 0; }
    }
  }
  return b;
}
export function energies(b) {
  return { height: b.mass * b.gravity * Math.max(0, b.y), motion: .5 * b.mass * b.v * b.v, surroundings: b.heat };
}
export const bounceHeight = (height, restitution) => height * restitution ** 2;

export const edgeKey = (a, b) => [Math.min(a, b), Math.max(a, b)].join('-');
export function reachable(edges, source = 4, removed = null) {
  const seen = new Set([source]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of edges) {
      if (edgeKey(a, b) === removed) continue;
      if (seen.has(a) && !seen.has(b)) { seen.add(b); changed = true; }
      if (seen.has(b) && !seen.has(a)) { seen.add(a); changed = true; }
    }
  }
  return seen;
}
export function networkReport(edges) {
  const working = reachable(edges).size;
  const trials = edges.map(([a, b]) => ({ key: edgeKey(a, b), reached: reachable(edges, 4, edgeKey(a, b)).size }));
  const worst = trials.reduce((a, b) => b.reached < a.reached ? b : a, { key: null, reached: working });
  return { working, worst, resilient: working === 9 && worst.reached === 9, trials };
}

export function makeFlock(seed, count = 48) {
  const random = rng(seed);
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    return { x: random() * 600, y: random() * 360, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40 };
  });
}
const wrapDelta = (d, size) => d > size / 2 ? d - size : d < -size / 2 ? d + size : d;
export function stepFlock(flock, rules, dt) {
  // Read only the previous generation: updating one agent cannot advantage it.
  return flock.map(bird => {
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, count = 0;
    for (const other of flock) {
      if (other === bird) continue;
      const dx = wrapDelta(other.x - bird.x, 600), dy = wrapDelta(other.y - bird.y, 360);
      const d2 = dx * dx + dy * dy;
      if (d2 < 95 ** 2 && d2 > .0001) {
        count++; ax += other.vx; ay += other.vy; cx += dx; cy += dy;
        if (d2 < 28 ** 2) { sx -= dx / d2 * 1000; sy -= dy / d2 * 1000; }
      }
    }
    if (count) { ax = ax / count - bird.vx; ay = ay / count - bird.vy; cx /= count; cy /= count; }
    let fx = sx * rules.space + ax * rules.align * 1.4 + cx * rules.near * .65;
    let fy = sy * rules.space + ay * rules.align * 1.4 + cy * rules.near * .65;
    const force = Math.hypot(fx, fy);
    if (force > 110) { fx *= 110 / force; fy *= 110 / force; }
    let vx = bird.vx + fx * dt, vy = bird.vy + fy * dt;
    const speed = Math.hypot(vx, vy);
    const limited = clamp(speed, 24, 65);
    if (speed > 1e-8) { vx *= limited / speed; vy *= limited / speed; }
    return { x: (bird.x + vx * dt + 600) % 600, y: (bird.y + vy * dt + 360) % 360, vx, vy };
  });
}
export function flockReport(flock) {
  let x = 0, y = 0, close = 0;
  for (const b of flock) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed) { x += b.vx / speed; y += b.vy / speed; }
    if (flock.some(o => o !== b && Math.hypot(wrapDelta(b.x - o.x, 600), wrapDelta(b.y - o.y, 360)) < 12)) close++;
  }
  return { alignment: Math.hypot(x, y) / flock.length, crowded: close / flock.length };
}

export function stepPilot(state, thrust, wind, dt) {
  const ax = thrust * 90 + wind;
  let x = state.x + state.v * dt + .5 * ax * dt ** 2;
  let v = state.v + ax * dt;
  if (x < 12) { x = 12; v = Math.max(0, -v * .35); }
  if (x > 588) { x = 588; v = Math.min(0, -v * .35); }
  const docked = Math.abs(x - state.target) < 22 && Math.abs(v) < 12;
  return { ...state, x, v, hold: docked ? state.hold + dt : 0, time: state.time + dt };
}
