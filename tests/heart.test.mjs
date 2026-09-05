import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const read = name => readFile(new URL(`../exercises/heart/${name}`, import.meta.url), 'utf8');
const audioSource = await read('audio.js');
const html = await read('index.html');
const sessionSource = await read('session.js');
const sha = value => createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));

function teachingText(className) {
  const opener = new RegExp(`<([a-z0-9]+)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'i').exec(html);
  assert.ok(opener, `missing source teaching section ${className}`);
  const start = opener.index + opener[0].length, tag = opener[1]; let depth = 1, end = start;
  for (const token of html.slice(start).matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'))) {
    depth += token[1] ? -1 : 1;
    if (!depth) { end = start + token.index; break; }
  }
  const entities = { amp: '&', larr: '←', ldquo: '“', mdash: '—', middot: '·', nbsp: '\u00a0', ndash: '–', rarr: '→', rdquo: '”', rsquo: '’' };
  return html.slice(start, end).replace(/<[^>]+>/g, '').replace(/&([a-z]+);/g, (all, name) => entities[name] ?? all).replace(/\s+/g, ' ').trim();
}

test('all original teaching, safety guidance and completion messages remain intact', () => {
  // Fingerprints independently recorded from the user-supplied index(4).html,
  // SHA256 9b273d55b47ed3b0719e128b074a13b86d3ccd5b42864f265fdd11decc3a197f.
  const expected = {
    's1-howto': 'f2fb603f63f0b7c9cc92ae9df58d12df2ab6d53ed2122b5d956390ac59d3ebe1',
    's2-howto': '7006dfa2054e50eb8ed66ade959e79baf6aa49d3745a74caec0aedccc409a39d',
    's1-ex-note': 'e458037fc3b3428eea47d056a59dc2854ecd75aa53a89b94f055c5c4c04a519c',
    's2-ex-note': '96f72c5689ec443c99903cc2ede70c07582cedc963ae10a4192a1b2143065318',
    'completion-text': '8f727c51d45c0cb7f73a1c4cda5bb36e6844664e0144bc13e48b9c731a94aba9',
    's2c-text': 'de907d6db3d18cd64b788fe912308131250e148234ba5e4f02fad2088148c425'
  };
  for (const [section, fingerprint] of Object.entries(expected)) assert.equal(sha(teachingText(section)), fingerprint, section);
  assert.doesNotMatch(html, /<iframe|screen-intro|Project Meaning<|pillar-mind|stage3-icon|stage4-icon/);
});

class Clock {
  now = 0; next = 1; tasks = new Map();
  schedule(fn, delay, interval = false) {
    const id = this.next++;
    this.tasks.set(id, { id, fn, at: this.now + delay, interval: interval ? delay : 0 });
    return id;
  }
  clear(id) { this.tasks.delete(id); }
  advance(ms) {
    const target = this.now + ms;
    for (;;) {
      const task = [...this.tasks.values()].filter(t => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!task) break;
      this.now = task.at;
      if (task.interval) task.at += task.interval; else this.tasks.delete(task.id);
      task.fn();
    }
    this.now = target;
  }
}

class Classes {
  values = new Set();
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force = !this.contains(name)) { force ? this.add(name) : this.remove(name); return force; }
}
class Element {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase(); this.attributes = { ...attrs }; this.dataset = {}; this.children = [];
    this.classList = new Classes(); this.classList.add(...(attrs.class || '').split(/\s+/).filter(Boolean));
    this.style = { setProperty(name, value) { this[name] = value; } }; this.listeners = new Map();
    this.value = attrs.value || ''; this.textContent = ''; this.innerHTML = ''; this.open = false;
    for (const [name, value] of Object.entries(attrs)) if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  get id() { return this.attributes.id || ''; }
  get hidden() { return Object.hasOwn(this.attributes, 'hidden'); }
  set hidden(value) { value ? this.attributes.hidden = '' : delete this.attributes.hidden; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, callback) { this.listeners.set(name, [...this.listeners.get(name) || [], callback]); }
  dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event); }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
    const parts = selector.trim().split(/\s+/), own = parts.pop();
    if (parts.length) { let parent = this.parentElement; while (parent && !parent.matches(parts.join(' '))) parent = parent.parentElement; if (!parent) return false; }
    const tag = own.match(/^[\w-]+/)?.[0]; if (tag && this.tagName !== tag.toUpperCase()) return false;
    for (const [, id] of own.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
    for (const [, cls] of own.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(cls)) return false;
    for (const [, name, value] of own.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if (!Object.hasOwn(this.attributes, name) || value !== undefined && this.attributes[name] !== value) return false;
    }
    return true;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { this.focused = true; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function documentFixture() {
  const doc = new Element('document'), stack = [doc];
  const voids = new Set(['meta', 'link', 'input', 'br', 'hr', 'img']);
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) { const index = stack.findLastIndex(el => el.tagName === tag.toUpperCase()); if (index > 0) stack.length = index; continue; }
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m => [m[1], m[2] ?? m[3] ?? m[4] ?? '']));
    const el = new Element(tag, attrs); el.parentElement = stack.at(-1); el.parentElement.children.push(el);
    if (!voids.has(tag)) stack.push(el);
  }
  const ids = new Map(doc.querySelectorAll('*').filter(el => el.id).map(el => [el.id, el]));
  doc.getElementById = id => ids.get(id) || null;
  doc.body = doc.querySelector('body'); doc.documentElement = doc.querySelector('html');
  doc.visibilityState = 'visible'; return doc;
}

class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, at) { this.events.push(['set', value, at]); this.value = value; }
  exponentialRampToValueAtTime(value, at) { assert.ok(value > 0, 'Web Audio exponential ramps cannot target zero'); this.events.push(['exponential', value, at]); this.value = value; }
  linearRampToValueAtTime(value, at) { this.events.push(['linear', value, at]); this.value = value; }
  cancelScheduledValues(at) { this.events.push(['cancel', at]); }
}
class AudioNode {
  constructor(kind) { this.kind = kind; this.gain = new Param(1); this.frequency = new Param(); this.Q = new Param(); this.pan = new Param(); this.connections = []; this.starts = []; this.stops = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; this.connections = []; }
  start(at) { this.starts.push(at); }
  stop(at) { this.stops.push(at); }
}

function harness({ session = false, initialState = 'running', panning = true, silentBells = false, reducedMotion = false } = {}) {
  const clock = new Clock(), document = documentFixture(), contexts = [], events = new Map(), bells = [];
  class AudioContext {
    constructor() { this.state = initialState; this.sampleRate = 8000; this.nodes = []; this.buffers = []; this.destination = new AudioNode('destination'); contexts.push(this); if (!panning) this.createStereoPanner = undefined; }
    get currentTime() { return clock.now / 1000; }
    resume() { this.resumes = (this.resumes || 0) + 1; this.state = 'running'; return Promise.resolve(); }
    node(kind) { const node = new AudioNode(kind); this.nodes.push(node); return node; }
    createGain() { return this.node('gain'); }
    createOscillator() { return this.node('oscillator'); }
    createBiquadFilter() { return this.node('filter'); }
    createStereoPanner() { return this.node('panner'); }
    createConvolver() { return this.node('convolver'); }
    createBufferSource() { return this.node('bufferSource'); }
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { numberOfChannels: channels, length, sampleRate, getChannelData: index => data[index] };
      this.buffers.push(buffer); return buffer;
    }
  }
  const context = vm.createContext({
    console, document, AudioContext, Element, HTMLElement: Element, URL, URLSearchParams,
    setTimeout: (fn, ms = 0) => clock.schedule(fn, ms), clearTimeout: id => clock.clear(id),
    setInterval: (fn, ms) => clock.schedule(fn, ms, true), clearInterval: id => clock.clear(id),
    requestAnimationFrame: fn => clock.schedule(() => fn(clock.now), 16), cancelAnimationFrame: id => clock.clear(id),
    performance: { now: () => clock.now }, scrollTo() {},
    matchMedia: () => ({ matches: reducedMotion }),
    location: { href: 'https://dreamunity.one/exercises/heart/' },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    addEventListener(name, fn) { events.set(name, [...events.get(name) || [], fn]); },
    dispatchEvent(event) { for (const fn of events.get(event.type) || []) fn(event); },
  });
  context.window = context; context.globalThis = context;
  vm.runInContext(audioSource, context, { filename: 'heart/audio.js' });
  if (silentBells) { context.bowl = (fund, peak, decay) => { bells.push({ at: clock.now, fund, peak, decay }); return true; }; context.setWave(0); }
  if (session) vm.runInContext(sessionSource, context, { filename: 'heart/session.js' });
  return { context, clock, document, contexts, bells, el: id => document.getElementById(id), evaluate: expression => vm.runInContext(expression, context), emit: type => context.dispatchEvent({ type }) };
}

test('Heart keeps the exact authored breathing prompts and seven mapping questions', () => {
  const h = harness({ session: true });
  assert.equal(sha(h.evaluate('JSON.stringify(PHASES)')), '46032bfb16a2a7b45abc026af6609b84a1ad92017304c49c0667b3d7fe6f0c92');
  assert.equal(sha(h.evaluate('JSON.stringify(S2_DIMENSIONS)')), '2e9db874f0e6e1d0d6b462a2f59f54b63e70f7e78b80503f6b97715c927df16f');
});

test('bell volume is remembered separately for all seven options and 150% means 2.5 times gain', () => {
  const h = harness(), c = h.context;
  assert.equal(c.WAVE_HZ, 10); assert.equal(c.WAVE_ON, true);
  for (const hz of [0, 1, 2, 3, 8, 10, 12]) {
    c.setWave(hz); assert.equal(c.bellVol(), hz > 0 && hz < 5 ? 0.48 : 1);
    c.setBellVol((hz + 1) / 10);
  }
  for (const hz of [0, 1, 2, 3, 8, 10, 12]) { c.setWave(hz); assert.equal(c.bellVol(), (hz + 1) / 10); }
  c.setBellVol(1.5); assert.equal(c.bellGain(), 2.5);
  assert.ok(h.document.querySelectorAll('.bell-vol').every(el => Number(el.value) === 1.5));
  assert.ok(h.document.querySelectorAll('.bell-vol-val').every(el => el.textContent === '150%'));
  c.setBellVol(0); c.breathBell('inhale');
  assert.equal(h.contexts[0].nodes.filter(node => node.kind === 'oscillator').length, 0);
  c.setBellVol(-3); assert.equal(c.bellGain(), 0);
  c.setBellVol(8); assert.equal(c.bellGain(), 2.5);
});

test('breath bells preserve all four partials, pans, envelopes and independent warm reverb', () => {
  const h = harness(), c = h.context; c.breathBell('inhale');
  const ac = h.contexts[0], oscillators = ac.nodes.filter(n => n.kind === 'oscillator');
  const partials = [[1, 1, 1, -0.3], [1.003, 0.7, 1, 0.3], [2, 0.26, 0.78, 0], [2.76, 0.07, 0.45, 0.18]];
  assert.equal(oscillators.length, 4);
  oscillators.forEach((osc, index) => {
    const [ratio, gain, decay, pan] = partials[index], amp = osc.connections[0];
    assert.equal(osc.type, 'sine'); assert.equal(osc.frequency.value, 392 * ratio);
    assert.deepEqual(amp.gain.events, [['set', 0.0001, 0], ['exponential', 0.08 * gain, 0.045], ['exponential', 0.0001, 3.3 * decay]]);
    assert.deepEqual(osc.starts, [0]); assert.deepEqual(osc.stops, [3.3 * decay + 0.1]);
    if (pan) assert.equal(amp.connections[0].pan.value, pan);
  });
  const convolver = ac.nodes.find(n => n.kind === 'convolver'), wetFilter = convolver.connections[0];
  assert.equal(convolver.buffer.numberOfChannels, 2); assert.equal(convolver.buffer.length, ac.sampleRate * 4.5);
  assert.equal(wetFilter.type, 'lowpass'); assert.equal(wetFilter.frequency.value, 1800); assert.equal(wetFilter.Q.value, 0.2);
  assert.equal(wetFilter.connections[0].gain.value, 0.55);
  assert.ok(ac.nodes.some(n => n.kind === 'gain' && n.gain.value === 0.9 && n.connections.includes(ac.destination)));
  const strikeFilter = ac.nodes.find(n => n.kind === 'filter' && n.frequency.events.length);
  assert.deepEqual(strikeFilter.frequency.events, [['set', 2600, 0], ['exponential', 1100, 1.65]]);
  h.clock.advance(3700); assert.equal(c._heartStrikes.size, 0); assert.ok(oscillators.every(n => n.disconnected));
  c.breathBell('exhale'); assert.equal(ac.nodes.filter(n => n.kind === 'oscillator')[4].frequency.value, 293.66);
});

for (const hz of [1, 2, 3, 8, 10, 12]) test(`${hz} Hz drives the exact source pad and sixty-second rate ramps`, () => {
  const h = harness(), c = h.context; c.setWave(hz); c.droneStart();
  const d = c._drone, delta = hz < 5, top = Math.min(delta ? 4 : 12, hz + 2), center = delta ? 110 : 220;
  assert.ok(d); assert.equal(d.osc.length, delta ? 9 : 8);
  const tones = d.osc.filter(n => n.kind === 'oscillator').slice(0, 6);
  const expected = delta ? [73.42, 110, center - hz / 2, center + hz / 2, 146.83, 220] : [146.83, 293.66, center - hz / 2, center + hz / 2, 440, 587.33];
  assert.deepEqual(plain(tones.map(n => n.frequency.value)), expected);
  const gains = delta ? [0.052, 0.07, 0.084, 0.084, 0.054, 0.03] : [0.08, 0.042, 0.058, 0.058, 0.05, 0.034];
  tones.forEach((n, i) => assert.equal(n.connections[0].gain.value, gains[i]));
  assert.equal(tones[2].connections[0].connections[0].pan.value, -1); assert.equal(tones[3].connections[0].connections[0].pan.value, 1);
  assert.deepEqual(tones[2].frequency.events, [['set', center - top / 2, 0], ['linear', center - hz / 2, 60]]);
  assert.deepEqual(tones[3].frequency.events, [['set', center + top / 2, 0], ['linear', center + hz / 2, 60]]);
  const modulator = d.osc.at(-2), drift = d.osc.at(-1);
  assert.deepEqual(modulator.frequency.events, [['set', top, 0], ['linear', hz, 60]]);
  assert.equal(modulator.connections[0].gain.value, delta ? 0.22 : 0.26);
  assert.equal(drift.frequency.value, delta ? 0.045 : 0.07); assert.equal(drift.connections[0].gain.value, delta ? 0.18 : 0.03);
  assert.deepEqual(d.env.gain.events, [['set', 0.0001, 0], ['exponential', 1.8, delta ? 13 : 4.5]]);
  assert.ok(d.node.some(n => n.type === 'highpass' && n.frequency.value === (delta ? 45 : 110)));
  assert.ok(d.node.some(n => n.type === 'lowpass' && n.frequency.value === (delta ? 480 : 1000)));
  if (delta) { const noise = d.osc.find(n => n.kind === 'bufferSource'); assert.equal(noise.buffer.length, 32000); assert.equal(noise.loop, true); assert.equal(noise.connections[0].frequency.value, 210); assert.equal(noise.connections[0].Q.value, 0.3); assert.equal(noise.connections[0].connections[0].gain.value, 0.07); }
  c.setWave(hz === 1 ? 12 : 1); c.droneStart(); assert.equal(c._drone, d, 'changing the selector must not retune an active session');
  c.droneStop(); assert.equal(c._drone, null); assert.equal(c._heartFadingDrones.size, 1);
  assert.deepEqual(d.env.gain.events.at(-1), ['exponential', 0.0001, 3]);
  h.clock.advance(3299); assert.equal(d.disposed, false); h.clock.advance(1);
  assert.equal(d.disposed, true); assert.ok(d.osc.every(n => n.disconnected)); assert.equal(c._heartFadingDrones.size, 0);
});

test('Test is bell-only, Off makes no drone, and completion rings the exact delayed pair', () => {
  const h = harness({ silentBells: true }), c = h.context;
  c.setWave(0); c.droneStart(); assert.equal(c._drone, null);
  c.testBell(); assert.deepEqual(h.bells, [{ at: 0, fund: 392, peak: 0.08, decay: 3.3 }]);
  h.clock.advance(649); assert.equal(h.bells.length, 1); h.clock.advance(1);
  assert.deepEqual(h.bells[1], { at: 650, fund: 293.66, peak: 0.08, decay: 3.3 });
  assert.equal(c._drone, null); c.completeBell();
  assert.deepEqual(h.bells.at(-1), { at: 650, fund: 392, peak: 0.13, decay: 8.5 });
  h.clock.advance(2999); assert.equal(h.bells.length, 3); h.clock.advance(1);
  assert.deepEqual(h.bells.at(-1), { at: 3650, fund: 293.66, peak: 0.11, decay: 9.5 });
});

test('rapid restarts and immediate return own and dispose every audio graph and delayed cue', () => {
  const h = harness(), c = h.context; c.droneStart(); const old = c._drone;
  c.droneStop(); c.droneStart(); const next = c._drone; assert.notEqual(next, old);
  h.clock.advance(3300); assert.equal(old.disposed, true); assert.equal(next.disposed, false);
  c.testBell(); c.completeBell(); c.stopHeartAudio({ immediate: true });
  const before = h.contexts[0].nodes.length; h.clock.advance(15000);
  assert.equal(h.contexts[0].nodes.length, before); assert.equal(next.disposed, true);
  assert.equal(c._heartCueTimers.size, 0); assert.equal(c._heartStrikes.size, 0); assert.equal(c._heartFadingDrones.size, 0);
  assert.equal(h.clock.tasks.size, 0); assert.equal(c.getHeartAudioState().soundActive, false);
});

test('suspended browser audio resumes and rejected or cancelled resumes cannot resurrect a session', async () => {
  const h = harness({ initialState: 'suspended' }), c = h.context;
  await c.breathBell('inhale'); assert.equal(h.contexts[0].resumes, 1); assert.equal(c._heartStrikes.size, 1);
  const second = harness({ initialState: 'suspended' }), ac = second.context._audio();
  let resolve; ac.resume = () => new Promise(r => { resolve = r; });
  const pending = second.context.droneStart(); second.context.stopHeartAudio({ immediate: true }); ac.state = 'running'; resolve(); await pending;
  assert.equal(second.context._drone, null);
  const third = harness({ initialState: 'suspended' }); third.context._audio().resume = () => Promise.reject(new Error('not allowed'));
  assert.equal(await third.context.breathBell('inhale'), false); assert.equal(third.context._heartStrikes.size, 0);
});

test('audio works without stereo panners and releases its fallback graph', () => {
  const h = harness({ panning: false }), c = h.context;
  c.droneStart(); c.breathBell('inhale'); c.stopHeartAudio({ immediate: true });
  assert.equal(c._heartStrikes.size, 0); assert.equal(c._drone, null);
  assert.ok(h.contexts[0].nodes.every(n => n.disconnected));
});

for (const seconds of [900, 1800, 3600, 7200, 10800]) test(`Stage One runs the full ${seconds}-second duration and naturally completes once`, () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startWithDuration(seconds);
  assert.equal(c.s1.total, seconds); assert.equal(c.s1.rem, seconds);
  assert.equal(h.el('session-timer').textContent, `${String(seconds / 60).padStart(2, '0')}:00`);
  assert.equal(h.el('s1-live').classList.contains('is-hidden'), false);
  assert.equal(h.el('s1-start').classList.contains('is-hidden'), true);
  h.clock.advance(seconds * 1000 - 1);
  assert.equal(c.s1.rem, 1); assert.equal(h.el('completion').open, false);
  h.clock.advance(1);
  assert.equal(c.s1.rem, 0); assert.equal(c.s1.active, false);
  assert.equal(h.el('session-timer').textContent, '00:00'); assert.equal(h.el('progress-fill').style.width, '100.00%');
  assert.equal(h.el('completion').open, true);
  const closing = () => h.bells.filter(bell => bell.decay > 8);
  assert.deepEqual(closing(), [{ at: seconds * 1000, fund: 392, peak: 0.13, decay: 8.5 }]);
  h.clock.advance(3000);
  assert.deepEqual(closing()[1], { at: (seconds + 3) * 1000, fund: 293.66, peak: 0.11, decay: 9.5 });
  h.clock.advance(20000); assert.equal(closing().length, 2); assert.equal(h.clock.tasks.size, 0);
  c.restartToIntro(); assert.equal(h.el('completion').open, false); assert.equal(h.el('screen-heart').classList.contains('hidden'), false);
});

test('Stage One keeps five-second breathing, independent second countdowns and the three indicator delays', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startWithDuration(900);
  assert.equal(h.el('breath-label').textContent, 'Inhale'); assert.equal(h.el('breath-cd').textContent, '5');
  assert.equal(h.el('breath-ball').classList.contains('inhale-state'), true);
  h.clock.advance(399); assert.equal(h.el('ci-breath').classList.contains('active'), false);
  h.clock.advance(1); assert.equal(h.el('ci-breath').classList.contains('active'), true);
  h.clock.advance(600); assert.equal(Number(h.el('breath-cd').textContent), 4); assert.equal(h.el('session-timer').textContent, '14:59');
  h.clock.advance(2999); assert.equal(h.el('ci-heart').classList.contains('active'), false);
  h.clock.advance(1); assert.equal(h.el('ci-heart').classList.contains('active'), true);
  h.clock.advance(999); assert.equal(h.el('breath-label').textContent, 'Inhale');
  h.clock.advance(1); assert.equal(h.el('breath-label').textContent, 'Exhale'); assert.equal(h.el('breath-cd').textContent, '5');
  assert.equal(h.el('breath-ball').classList.contains('inhale-state'), false);
  assert.equal(h.el('phase-text').textContent, h.evaluate('PHASES.early.exhale.text'));
  h.clock.advance(3999); assert.equal(h.el('ci-feeling').classList.contains('active'), false);
  h.clock.advance(1); assert.equal(h.el('ci-feeling').classList.contains('active'), true);
  h.clock.advance(1000); assert.equal(h.el('breath-label').textContent, 'Inhale');
  assert.deepEqual(h.bells.slice(0, 3).map(bell => [bell.at, bell.fund]), [[0, 392], [5000, 293.66], [10000, 392]]);
  assert.equal(h.el('progress-fill').style.width, '1.11%');
});

test('Stage One thirds are relative to total time and refresh only at the next breathing transition', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  for (const total of [900, 1800, 3600, 7200, 10800]) {
    c.s1.total = total;
    for (const [fractionRemaining, expected] of [[0.6701, 'early'], [0.6699, 'middle'], [0.3401, 'middle'], [0.3399, 'late']]) {
      c.s1.rem = total * fractionRemaining; assert.equal(c.s1PhaseKey(), expected);
    }
  }
  c.startWithDuration(900); h.clock.advance(298000);
  assert.equal(c.s1PhaseKey(), 'middle'); assert.equal(h.el('phase-step-label').textContent, 'Step 1 · Heart-Focused Breathing');
  h.clock.advance(2000); assert.equal(h.el('phase-step-label').textContent, 'Step 2 · Heart Feeling');
  h.clock.advance(300000); assert.equal(h.el('phase-step-label').textContent, 'Step 3 · Deepen');
  assert.equal(h.el('phase-text').textContent, h.evaluate('PHASES.late.inhale.text'));
});

test('Stage One End cancels every breathing and indicator callback without completion bells', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startWithDuration(900); h.clock.advance(100); c.endSession(); const count = h.bells.length;
  h.clock.advance(20000);
  assert.equal(c.s1.rem, 900); assert.equal(h.bells.length, count); assert.equal(h.clock.tasks.size, 0);
  assert.equal(h.el('s1-start').classList.contains('is-hidden'), false); assert.equal(h.el('s1-live').classList.contains('is-hidden'), true);
  for (const id of ['ci-breath', 'ci-heart', 'ci-feeling']) assert.equal(h.el(id).classList.contains('active'), false);
  assert.equal(h.el('completion').open, false);
});

for (const seconds of [900, 1800, 3600]) test(`Stage Two rotates for the complete ${seconds}-second session, independently of its step timer`, () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startStage2WithDuration(seconds);
  assert.equal(c.s2.lastDim, 0); assert.equal(c.s2.stepRem, 30); assert.equal(c.s2.rem, seconds);
  assert.equal(h.el('s2s-countdown').textContent, '0:30');
  h.clock.advance(seconds * 1000 - 1);
  assert.equal(c.s2.rem, 1); assert.equal(h.el('stage2-completion').open, false);
  assert.equal(h.bells.filter(b => b.decay === 3.3).length, seconds / 30, 'all seven questions keep rotating, including after one full cycle');
  h.clock.advance(1);
  assert.equal(c.s2.active, false); assert.equal(c.s2.tick, null); assert.equal(c.s2.rem, 0);
  assert.equal(h.el('s2s-timer').textContent, '00:00'); assert.equal(h.el('s2s-progress-fill').style.width, '100.00%');
  assert.equal(h.el('stage2-completion').open, true);
  h.clock.advance(3000);
  assert.deepEqual(h.bells.filter(b => b.decay > 8), [{ at: seconds * 1000, fund: 392, peak: 0.13, decay: 8.5 }, { at: (seconds + 3) * 1000, fund: 293.66, peak: 0.11, decay: 9.5 }]);
  h.clock.advance(30000); assert.equal(h.clock.tasks.size, 0);
  c.restartStage2ToIntro(); assert.equal(h.el('stage2-completion').open, false); assert.equal(h.el('screen-heart').classList.contains('hidden'), false);
});

test('Stage Two displays all seven exact questions, parity bells and wrap-around chip states every thirty seconds', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startStage2WithDuration(900);
  const chips = h.document.querySelectorAll('#s2s-chain .s2s-chip'), dimensions = h.evaluate('S2_DIMENSIONS');
  assert.equal(chips.length, 7);
  h.clock.advance(299); assert.equal(h.el('s2s-center').classList.contains('fading'), true);
  h.clock.advance(1); assert.equal(h.el('s2s-center').textContent, 'LOCATION');
  h.clock.advance(19); assert.equal(h.el('s2s-prompt').classList.contains('fading'), true);
  h.clock.advance(1); assert.equal(h.el('s2s-prompt').innerHTML, dimensions[0].prompt);
  for (let step = 0; step < 9; step++) {
    const index = step % 7;
    assert.equal(c.s2.lastDim, index); assert.equal(h.el('s2s-center').textContent, dimensions[index].label);
    assert.equal(h.el('s2s-phase-label').textContent, `Step ${index + 1} / 7`);
    assert.equal(h.el('s2s-prompt').innerHTML, dimensions[index].prompt);
    chips.forEach((chip, i) => { assert.equal(chip.classList.contains('active'), i === index); assert.equal(chip.classList.contains('done'), i < index); });
    assert.equal(h.bells[step].at, step * 30000); assert.equal(h.bells[step].fund, index % 2 ? 293.66 : 392);
    if (step < 8) h.clock.advance(30000);
  }
  assert.equal(c.s2.rem, 660); assert.equal(h.el('s2s-progress-fill').style.width, '26.67%');
});

test('re-reading never changes either timer or plays a bell, and the next scheduled step exits peek', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startStage2WithDuration(900); h.clock.advance(7000); const bells = h.bells.length;
  c.peekStage2Dimension(5); h.clock.advance(320);
  assert.equal(h.el('s2s-center').textContent, 'COHERENCE'); assert.equal(c.s2.lastDim, 0); assert.equal(c.s2.stepRem, 23);
  assert.equal(h.document.querySelector('[data-dim="5"]').classList.contains('peek'), true); assert.equal(h.bells.length, bells);
  h.clock.advance(3680); assert.equal(c.s2.rem, 889); assert.equal(c.s2.stepRem, 19);
  c.peekStage2Dimension(5); h.clock.advance(320); assert.equal(c.s2.peek, null); assert.equal(h.el('s2s-center').textContent, 'LOCATION'); assert.equal(h.bells.length, bells);
  c.peekStage2Dimension(6); h.clock.advance(18680);
  assert.equal(c.s2.peek, null); assert.equal(c.s2.lastDim, 1); assert.equal(c.s2.stepRem, 30); assert.equal(c.s2.rem, 870);
  assert.equal(h.document.querySelectorAll('.s2s-chip').some(chip => chip.classList.contains('peek')), false);
  h.clock.advance(320); assert.equal(h.el('s2s-center').textContent, 'QUALITY'); assert.equal(h.bells.length, bells + 1);
});

test('rapid peeks keep only the latest prompt, and End prevents delayed writes into the start screen', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startStage2WithDuration(900); h.clock.advance(1000);
  c.peekStage2Dimension(1); h.clock.advance(100); c.peekStage2Dimension(4); h.clock.advance(100); c.peekStage2Dimension(6); h.clock.advance(320);
  assert.equal(h.el('s2s-center').textContent, 'MEANING-TONE'); assert.equal(h.el('s2s-prompt').innerHTML, h.evaluate('S2_DIMENSIONS[6].prompt'));
  c.peekStage2Dimension(0); c.endStage2Session(); const prompt = h.el('s2s-prompt').innerHTML, rem = c.s2.rem, count = h.bells.length;
  h.clock.advance(35000); assert.equal(h.el('s2s-prompt').innerHTML, prompt); assert.equal(c.s2.rem, rem); assert.equal(h.bells.length, count);
  assert.equal(h.clock.tasks.size, 0); assert.equal(h.el('s2-start').classList.contains('is-hidden'), false);
});

test('screen changes and pagehide stop both stages and cancel completion bells', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  c.startWithDuration(900); h.clock.advance(100); c.showStage2Preview(); const rem = c.s1.rem;
  h.clock.advance(10000); assert.equal(c.s1.rem, rem); assert.equal(c.s1.active, false);
  c.startStage2WithDuration(900); h.clock.advance(30000); c.showInstructions(); assert.equal(c.s2.active, false);
  c.startWithDuration(900); h.clock.advance(900000); c.restartToIntro(); const count = h.bells.length;
  h.clock.advance(4000); assert.equal(h.bells.length, count, 'return cancels the pending second completion bell');
  c.startStage2WithDuration(900); c.peekStage2Dimension(3); h.emit('pagehide'); const afterExit = h.bells.length;
  h.clock.advance(40000); assert.equal(h.bells.length, afterExit); assert.equal(h.clock.tasks.size, 0); assert.equal(c.s1.active, false); assert.equal(c.s2.active, false);
});

test('reduced motion keeps the exercise cadence and source prompts while skipping text fades', () => {
  const h = harness({ session: true, silentBells: true, reducedMotion: true }), c = h.context;
  c.startStage2WithDuration(900); assert.equal(h.el('s2s-center').textContent, 'LOCATION');
  assert.equal(h.el('s2s-prompt').innerHTML, h.evaluate('S2_DIMENSIONS[0].prompt'));
  h.clock.advance(30000); assert.equal(h.el('s2s-center').textContent, 'QUALITY'); assert.equal(c.s2.stepRem, 30);
  c.startWithDuration(900); h.clock.advance(5000); assert.equal(h.el('breath-label').textContent, 'Exhale'); assert.equal(c.s1.rem, 895);
});

test('real page controls invoke the supplied actions and native completion dismissal returns to Heart', () => {
  const h = harness({ session: true, silentBells: true }), c = h.context;
  const click = selector => { const target = h.document.querySelector(selector); assert.ok(target, selector); h.document.dispatchEvent({ type: 'click', target }); };
  click('[data-call="showInstructions"]'); assert.equal(h.el('screen-instructions').classList.contains('hidden'), false);
  click('#s1-start [data-call="startWithDuration"][data-value="900"]'); assert.equal(c.s1.active, true);
  click('#s1-live [data-call="endSession"]'); assert.equal(c.s1.active, false);
  c.restartToIntro(); click('[data-call="showStage2Preview"]');
  click('#s2-start [data-call="startStage2WithDuration"][data-value="900"]');
  click('[data-call="peekStage2Dimension"][data-value="4"]'); assert.equal(c.s2.peek, 4);
  h.clock.advance(900000); assert.equal(h.el('stage2-completion').open, true);
  let prevented = false; h.el('stage2-completion').dispatchEvent({ type: 'cancel', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.el('stage2-completion').open, false); assert.equal(h.el('screen-heart').classList.contains('hidden'), false);
});
