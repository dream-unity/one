import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const read = name => readFile(new URL(`../exercises/heart/${name}`, import.meta.url), 'utf8');
const audioSource = await read('audio.js');
const html = await read('index.html');
const sessionSource = await read('session.js');
const practiceSource = await read('practice.js');
const plain = value => JSON.parse(JSON.stringify(value));

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
const decode = value => value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, name) => {
  if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
  if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', ndash: '–', mdash: '—' })[name] ?? all;
});
class DOMEvent {
  constructor(type, options = {}) { Object.assign(this, { type, bubbles: false, cancelable: true, defaultPrevented: false }, options); }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}
class Element {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase(); this.attributes = { ...attrs }; this.children = []; this._text = '';
    this.dataset = new Proxy({}, {
      get: (_, key) => this.attributes[`data-${String(key).replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`],
      set: (_, key, value) => { this.attributes[`data-${String(key).replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`] = String(value); return true; }
    });
    this.classList = new Classes(); this.classList.add(...(attrs.class || '').split(/\s+/).filter(Boolean));
    this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } }; this.listeners = new Map();
    this.value = attrs.value || ''; this.checked = Object.hasOwn(attrs, 'checked'); this.open = false;
  }
  get id() { return this.attributes.id || ''; }
  set id(value) { this.attributes.id = value; }
  get className() { return [...this.classList.values].join(' '); }
  set className(value) { this.classList.values = new Set(value.split(/\s+/).filter(Boolean)); }
  get disabled() { return Object.hasOwn(this.attributes, 'disabled'); }
  set disabled(value) { value ? this.attributes.disabled = '' : delete this.attributes.disabled; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
  get innerHTML() { return this.textContent; }
  set innerHTML(value) { this.textContent = decode(String(value).replace(/<[^>]*>/g, '')); }
  get hidden() { return Object.hasOwn(this.attributes, 'hidden'); }
  set hidden(value) { value ? this.attributes.hidden = '' : delete this.attributes.hidden; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.className = String(value); }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, callback) { this.listeners.set(name, [...this.listeners.get(name) || [], callback]); }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const callback of this.listeners.get(event.type) || []) callback(event);
    if (event.bubbles && !event.stopped) this.parentElement?.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  click() {
    if (this.disabled) return;
    if (this.tagName === 'SUMMARY' && this.parentElement?.tagName === 'DETAILS') this.parentElement.open = !this.parentElement.open;
    const checkbox = this.tagName === 'INPUT' && this.getAttribute('type') === 'checkbox';
    if (checkbox) this.checked = !this.checked;
    this.dispatchEvent(new DOMEvent('click', { bubbles: true }));
    if (checkbox) { this.dispatchEvent(new DOMEvent('input', { bubbles: true })); this.dispatchEvent(new DOMEvent('change', { bubbles: true })); }
  }
  appendChild(child) { child.parentElement?.removeChild(child); child.parentElement = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(typeof child === 'string' ? Object.assign(new Element('text'), { textContent: child }) : child)); }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentElement = null; return child; }
  replaceChildren(...children) { this.textContent = ''; this.append(...children); }
  remove() { this.parentElement?.removeChild(this); }
  contains(child) { return child === this || this.children.some(item => item.contains(child)); }
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
    if (own.includes(':checked') && !this.checked) return false;
    return true;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { this.focused = true; let root = this; while (root.parentElement) root = root.parentElement; root.activeElement = this; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function documentFixture() {
  // Parses the actual checked-in page rather than maintaining a second copy of
  // its controls. This small DOM model covers controller events, not layout.
  const doc = new Element('document'), stack = [doc];
  const voids = new Set(['meta', 'link', 'input', 'br', 'hr', 'img']);
  let previousEnd = 0;
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)) {
    stack.at(-1)._text += decode(html.slice(previousEnd, match.index).replace(/<!--[\s\S]*?-->/g, ''));
    previousEnd = match.index + match[0].length;
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) { const index = stack.findLastIndex(el => el.tagName === tag.toUpperCase()); if (index > 0) stack.length = index; continue; }
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m => [m[1], decode(m[2] ?? m[3] ?? m[4] ?? '')]));
    const el = new Element(tag, attrs); el.parentElement = stack.at(-1); el.parentElement.children.push(el);
    if (!voids.has(tag)) stack.push(el);
  }
  const staticIds = new Map(doc.querySelectorAll('*').filter(el => el.id).map(el => [el.id, el]));
  doc.getElementById = id => staticIds.get(id) || doc.querySelectorAll('*').find(el => el.id === id) || null;
  doc.createElement = tag => new Element(tag);
  doc.createTextNode = value => Object.assign(new Element('text'), { textContent: value });
  doc.createDocumentFragment = () => new Element('fragment');
  doc.body = doc.querySelector('body'); doc.documentElement = doc.querySelector('html');
  doc.visibilityState = 'visible';
  Object.defineProperty(doc, 'hidden', { get: () => doc.visibilityState === 'hidden' });
  return doc;
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

function harness({ session = false, initialState = 'running', panning = true, silentBells = false, reducedMotion = false, unavailableAudio = false, rejectResume = false } = {}) {
  const clock = new Clock(), document = documentFixture(), contexts = [], events = new Map(), bells = [], externalCalls = [];
  class AudioContext {
    constructor() { this.state = initialState; this.sampleRate = 8000; this.nodes = []; this.buffers = []; this.destination = new AudioNode('destination'); contexts.push(this); if (!panning) this.createStereoPanner = undefined; }
    get currentTime() { return clock.now / 1000; }
    resume() { this.resumes = (this.resumes || 0) + 1; if (rejectResume) return Promise.reject(new Error('audio blocked')); this.state = 'running'; return Promise.resolve(); }
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
    console, document, AudioContext: unavailableAudio ? undefined : AudioContext, Element, HTMLElement: Element, URL, URLSearchParams, Event: DOMEvent,
    setTimeout: (fn, ms = 0) => clock.schedule(fn, ms), clearTimeout: id => clock.clear(id),
    setInterval: (fn, ms) => clock.schedule(fn, ms, true), clearInterval: id => clock.clear(id),
    requestAnimationFrame: fn => clock.schedule(() => fn(clock.now), 16), cancelAnimationFrame: id => clock.clear(id),
    performance: { now: () => clock.now }, scrollTo() {},
    matchMedia: () => ({ matches: reducedMotion }),
    location: { href: 'https://dreamunity.one/exercises/heart/' },
    localStorage: { getItem: key => { externalCalls.push(['storage-read', key]); return null; }, setItem: (key, value) => externalCalls.push(['storage-write', key, value]) },
    sessionStorage: { getItem: key => { externalCalls.push(['session-read', key]); return null; }, setItem: (key, value) => externalCalls.push(['session-write', key, value]) },
    fetch: (...args) => { externalCalls.push(['fetch', ...args]); throw new Error('Practice must not transmit answers'); },
    navigator: { sendBeacon: (...args) => { externalCalls.push(['beacon', ...args]); return true; } },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    addEventListener(name, fn) { events.set(name, [...events.get(name) || [], fn]); },
    dispatchEvent(event) { for (const fn of events.get(event.type) || []) fn(event); },
  });
  context.window = context; context.globalThis = context;
  vm.runInContext(audioSource, context, { filename: 'heart/audio.js' });
  if (silentBells) { context.bowl = (fund, peak, decay) => { bells.push({ at: clock.now, fund, peak, decay }); return true; }; context.setWave(0); }
  if (session) {
    vm.runInContext(practiceSource, context, { filename: 'heart/practice.js' });
    vm.runInContext(sessionSource, context, { filename: 'heart/session.js' });
  }
  return {
    context, clock, document, contexts, bells, externalCalls,
    el: id => document.getElementById(id),
    click: selector => { const element = document.querySelector(selector); assert.ok(element, `Missing control ${selector}`); element.click(); return element; },
    input: (selector, value) => { const element = document.querySelector(selector); assert.ok(element, `Missing input ${selector}`); element.value = String(value); element.dispatchEvent(new DOMEvent('input', { bubbles: true })); },
    visibility: state => { document.visibilityState = state; document.dispatchEvent(new DOMEvent('visibilitychange')); },
    evaluate: expression => vm.runInContext(expression, context),
    emit: type => context.dispatchEvent(new DOMEvent(type))
  };
}

test('bell volume is remembered separately for all seven options and 150% means 2.5 times gain', () => {
  const h = harness(), c = h.context;
  assert.equal(c.WAVE_HZ, 10); assert.equal(c.WAVE_ON, true);
  for (const hz of [0, 1, 2, 3, 8, 10, 12]) {
    c.setWave(hz); assert.equal(c.bellVol(), hz > 0 && hz < 5 ? 0.48 : 1);
    for (const button of h.document.querySelectorAll('.rate-btn')) {
      assert.equal(button.getAttribute('aria-pressed'), String(Number(button.dataset.hz) === hz));
      assert.equal(button.classList.contains('on'), Number(button.dataset.hz) === hz);
    }
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

function closeBells(h) { return h.bells.filter(bell => bell.decay > 8); }
function start(h, kind, seconds) {
  h.click(`[data-open="${kind}"]`);
  if (seconds) h.click(`[data-duration="${kind}"][data-seconds="${seconds}"]`);
  h.click(`#start-${kind}`);
  assert.equal(h.el('screen-session').hidden, false);
}
function choose(h, value) { return h.click(`#step-choices [data-choice="${value}"]`); }
function compareStart(h) {
  h.click('[data-open="breath"]'); h.click('#start-compare');
  assert.equal(h.el('continue-step').disabled, true);
}

// These tests operate through the page's real controls and rendered output.
// The engine's separate tests cover every plan duration and state transition.
test('both entry buttons open their own setup; every visible duration starts the selected time', () => {
  const h = harness({ session: true, silentBells: true });
  assert.equal(h.el('screen-heart').hidden, false);
  for (const [kind, lengths] of [['breath', [180, 300, 600, 900]], ['body', [240, 480, 720]]]) {
    for (const seconds of lengths) {
      start(h, kind, seconds);
      assert.equal(h.el('session-timer').textContent, `${String(seconds / 60).padStart(2, '0')}:00`);
      assert.equal(h.el('session-progress').value, 0);
      h.click('#end-session'); h.click('#forget-session');
      assert.equal(h.el('screen-heart').hidden, false);
      assert.equal(h.clock.tasks.size, 0);
    }
  }
});

test('breathing guide follows the selected pace and live own-breath stops pacing without stopping practice', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'breath', 180);
  assert.equal(h.el('breath-word').textContent, 'Breathe in');
  assert.equal(h.el('breath-count').textContent, '5');
  h.clock.advance(5000);
  assert.equal(h.el('breath-word').textContent, 'Breathe out');
  assert.equal(h.el('session-timer').textContent, '02:55');
  assert.deepEqual(h.bells.map(bell => [bell.at, bell.fund]), [[0, 392], [5000, 293.66]]);
  h.click('#own-breath');
  assert.equal(h.el('breath-word').textContent, 'Your own breath');
  assert.equal(h.el('breath-ball').classList.contains('is-paced'), false);
  const count = h.bells.length;
  h.clock.advance(20000);
  assert.equal(h.el('session-timer').textContent, '02:35');
  assert.equal(h.bells.length, count, 'no timed breath bells after choosing an ordinary breath');
  h.click('#end-session');
  assert.equal(closeBells(h).length, 0);
});

test('the kind-wish option changes the middle step and the final step releases the breath guide', () => {
  const h = harness({ session: true, silentBells: true });
  h.click('[data-open="breath"]'); h.click('[data-duration="breath"][data-seconds="180"]');
  assert.equal(h.el('add-care').checked, true);
  h.click('#add-care'); h.click('[data-pace="4"]'); h.click('#start-breath');
  assert.equal(h.el('breath-count').textContent, '4');
  h.clock.advance(60000);
  assert.equal(h.el('step-title').textContent, 'Stay with your breath');
  h.clock.advance(60000);
  assert.equal(h.el('breath-word').textContent, 'Your own breath');
  assert.equal(h.el('own-breath').hidden, true);
  h.click('#end-session'); h.click('#try-again'); h.click('#add-care'); h.click('#start-breath');
  h.clock.advance(60000);
  assert.equal(h.el('step-title').textContent, 'Try a kind wish');
});

test('with a child selects a short unpaced breath and restores the earlier adult settings when unchecked', () => {
  const h = harness({ session: true, silentBells: true });
  h.click('[data-open="breath"]'); h.click('[data-pace="4"]');
  h.click('[data-duration="breath"][data-seconds="600"]'); h.click('#with-child');
  assert.equal(h.el('with-child').checked, true);
  assert.equal(h.document.querySelector('[data-pace="0"]').getAttribute('aria-pressed'), 'true');
  for (const pace of [4, 5]) assert.equal(h.document.querySelector(`[data-pace="${pace}"]`).disabled, true);
  h.click('[data-pace="5"]'); h.click('#start-breath');
  assert.equal(h.el('session-timer').textContent, '03:00');
  assert.equal(h.el('breath-word').textContent, 'Your own breath');
  assert.equal(h.el('breath-count').textContent, '');
  h.clock.advance(10000); assert.equal(h.bells.length, 0);
  h.click('#end-session'); h.click('#try-again'); h.click('#with-child'); h.click('#start-breath');
  assert.equal(h.el('session-timer').textContent, '10:00');
  assert.equal(h.el('breath-count').textContent, '4');
});

test('Pause and Look around stop time and sound, keep the same step, and need an explicit resume', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'body', 240); h.clock.advance(12000);
  const title = h.el('step-title').textContent, timer = h.el('session-timer').textContent;
  h.click('#pause-session');
  assert.equal(h.el('pause-dialog').open, true); assert.equal(h.clock.tasks.size, 0);
  const cancelled = new DOMEvent('cancel'); h.el('pause-dialog').dispatchEvent(cancelled);
  assert.equal(cancelled.defaultPrevented, true); assert.equal(h.el('pause-dialog').open, true);
  const bells = h.bells.length;
  h.clock.advance(60000);
  assert.equal(h.el('session-timer').textContent, timer); assert.equal(h.bells.length, bells);
  h.click('#resume-session');
  assert.equal(h.el('pause-dialog').open, false); assert.equal(h.el('step-title').textContent, title);
  h.clock.advance(1000); assert.equal(h.el('session-timer').textContent, '03:47');
  h.click('#look-around');
  assert.equal(h.el('pause-title').textContent, 'Look around');
  assert.equal(h.el('pause-dialog').open, true); assert.equal(h.clock.tasks.size, 0);
  h.click('#finish-paused');
  assert.equal(h.el('screen-finish').hidden, false); assert.equal(h.el('pause-dialog').open, false);
  assert.equal(closeBells(h).length, 0);
});

test('background time is excluded and bringing the page back never silently resumes', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'breath', 180); h.clock.advance(11000);
  const before = h.el('session-timer').textContent;
  h.visibility('hidden');
  assert.equal(h.el('pause-dialog').open, true); assert.equal(h.clock.tasks.size, 0);
  const count = h.bells.length;
  h.clock.advance(3600000); h.click('#resume-session');
  assert.equal(h.el('pause-dialog').open, true); assert.equal(h.bells.length, count);
  assert.equal(h.el('session-timer').textContent, before);
  h.visibility('visible'); h.clock.advance(2000);
  assert.equal(h.el('pause-dialog').open, true); assert.equal(h.el('session-timer').textContent, before);
  h.click('#resume-session'); h.clock.advance(1000);
  assert.equal(h.el('session-timer').textContent, '02:48');
});

test('comparison waits for an explicit prediction and each rating, including zero, unclear and skip', () => {
  const h = harness({ session: true, silentBells: true });
  compareStart(h);
  h.click('#continue-step'); h.clock.advance(120000);
  assert.equal(h.el('session-timer').textContent, '04:00');
  assert.match(h.el('session-step').textContent, /^Step 1 of 9\b/);
  assert.equal(h.clock.tasks.size, 0); assert.equal(h.bells.length, 0);
  choose(h, 'same'); assert.equal(h.el('continue-step').disabled, false);
  h.click('#continue-step');
  for (const [index, value] of [0, 2, 'unclear', 'skip'].entries()) {
    h.clock.advance(60000);
    assert.equal(h.el('continue-step').hidden, false); assert.equal(h.el('continue-step').disabled, true);
    assert.equal(h.el('breath-visual').hidden, true); assert.equal(h.clock.tasks.size, 0);
    const remaining = h.el('session-timer').textContent;
    h.clock.advance(45000);
    assert.equal(h.el('session-timer').textContent, remaining);
    choose(h, value);
    assert.equal(h.el('continue-step').disabled, false, `round ${index + 1} accepts ${value}`);
    h.click('#continue-step');
  }
  assert.equal(h.el('screen-finish').hidden, false);
  assert.equal(h.el('finish-summary').textContent, 'You practised for 04:00.');
  const results = h.el('finish-results').textContent;
  assert.match(results, /1 of 5/); assert.match(results, /3 of 5/); assert.match(results, /Not clear/); assert.match(results, /Skipped/);
  assert.equal(h.el('finish-results').children.length, 5, 'one prediction and four reports, no derived medical score');
  assert.doesNotMatch(results, /winner|coherence|vagal|hormone|accuracy|brainwave|improved|percent/i);
  assert.equal(closeBells(h).length, 1); h.clock.advance(3000); assert.equal(closeBells(h).length, 2);
  h.clock.advance(30000); assert.equal(closeBells(h).length, 2); assert.equal(h.clock.tasks.size, 0);
  assert.deepEqual(h.externalCalls, []);
});

test('waiting choices survive a pause without starting the next timed round', () => {
  const h = harness({ session: true, silentBells: true });
  compareStart(h); choose(h, 'unclear');
  h.click('#pause-session'); h.clock.advance(15000); h.click('#resume-session');
  assert.equal(h.el('continue-step').disabled, false);
  assert.match(h.el('session-step').textContent, /^Step 1 of 9\b/); assert.equal(h.clock.tasks.size, 0);
  assert.equal(h.document.querySelector('[data-choice="unclear"]').getAttribute('aria-pressed'), 'true');
  h.click('#continue-step'); assert.match(h.el('session-step').textContent, /^Step 2 of 9\b/);
});

test('old choice clicks cannot answer a later step or reopen a finished session', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'body', 240); h.clock.advance(60000);
  const stale = h.document.querySelector('[data-choice="0"]'); assert.ok(stale);
  h.clock.advance(30000); stale.click();
  assert.equal(h.el('step-title').textContent, 'How sure are you?');
  assert.equal(h.el('step-feedback').textContent, '');
  choose(h, 'high'); h.click('#end-session');
  assert.match(h.el('finish-results').textContent, /Very sure/);
  assert.doesNotMatch(h.el('finish-results').textContent, /None|How strong/);
  stale.click(); assert.equal(h.el('screen-finish').hidden, false);
});

test('Go further reveals one question without restarting practice or recording private text', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'body', 240); h.clock.advance(1000);
  const question = h.el('step-question').textContent;
  h.click('#deeper-step summary'); assert.equal(h.el('deeper-step').open, true);
  assert.ok(question.length > 0); assert.equal(h.el('session-timer').textContent, '03:59');
  h.clock.advance(29000);
  assert.equal(h.el('deeper-step').open, false, 'the next step starts with its optional question collapsed');
  assert.notEqual(h.el('step-question').textContent, question);
  assert.equal(h.document.querySelectorAll('textarea,input[type="text"],input[type="email"]').length, 0);
  assert.deepEqual(h.externalCalls, []);
});

test('natural completion plays one closing pair; early Finish plays none; leaving cancels a pending pair', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'breath', 180); h.clock.advance(180000);
  assert.equal(h.el('finish-title').textContent, 'Practice finished'); assert.equal(closeBells(h).length, 1);
  h.click('#forget-session'); h.clock.advance(4000);
  assert.equal(closeBells(h).length, 1, 'return cancels the second completion strike');
  start(h, 'body', 240); h.clock.advance(1000); h.click('#end-session');
  assert.equal(h.el('finish-title').textContent, 'You finished here');
  h.clock.advance(30000); assert.equal(closeBells(h).length, 1); assert.equal(h.clock.tasks.size, 0);
});

test('mute cancels active audio and pending test cues while practice keeps time', () => {
  const h = harness({ session: true });
  h.click('[data-open="breath"]'); h.click('[data-call="testBell"]');
  assert.equal(h.context._heartCueTimers.size, 1);
  h.click('#start-breath');
  assert.equal(h.context._heartCueTimers.size, 0, 'new session cancels the preview second bell');
  assert.equal(h.context.getHeartAudioState().soundActive, true);
  h.click('#sound-toggle');
  assert.equal(h.el('sound-toggle').textContent, 'Use sound');
  assert.equal(h.el('sound-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(h.context.getHeartAudioState().soundActive, false);
  const count = h.contexts[0].nodes.length;
  h.clock.advance(10000); assert.equal(h.contexts[0].nodes.length, count);
  assert.equal(h.el('session-timer').textContent, '04:50');
  h.click('#sound-toggle'); assert.equal(h.context.getHeartAudioState().padActive, true);
  h.click('#end-session'); h.click('#forget-session');
  assert.equal(h.context.getHeartAudioState().soundActive, false); assert.equal(h.clock.tasks.size, 0);
});

test('unavailable or blocked sound never prevents practice, pause, or finishing', async () => {
  for (const options of [{ unavailableAudio: true }, { initialState: 'suspended', rejectResume: true }]) {
    const h = harness({ session: true, ...options });
    start(h, 'breath', 180);
    for (let turn = 0; turn < 6; turn++) await Promise.resolve();
    assert.equal(h.context.getHeartAudioState().soundActive, false);
    h.clock.advance(1000); assert.equal(h.el('session-timer').textContent, '02:59');
    h.click('#pause-session'); h.clock.advance(10000); h.click('#resume-session');
    h.clock.advance(1000); assert.equal(h.el('session-timer').textContent, '02:58');
    h.click('#end-session'); assert.equal(h.el('screen-finish').hidden, false);
    h.click('#forget-session'); assert.equal(h.clock.tasks.size, 0);
  }
});

test('return, restart and pagehide clear answers, reflections and all owned cues', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'body', 240); h.clock.advance(60000); choose(h, 0); h.click('#end-session');
  assert.match(h.el('finish-results').textContent, /None/);
  h.click('[data-feeling="less"]'); assert.ok(h.el('finish-response').textContent.length > 0);
  h.click('#try-again');
  assert.equal(h.el('finish-results').children.length, 0); assert.equal(h.el('finish-response').textContent, '');
  assert.ok(h.document.querySelectorAll('[data-feeling]').every(button => button.getAttribute('aria-pressed') === 'false'));
  h.click('#start-body'); h.clock.advance(60000); choose(h, 1);
  h.emit('pagehide'); const count = h.bells.length;
  h.clock.advance(300000);
  assert.equal(h.el('screen-heart').hidden, false); assert.equal(h.el('step-choices').children.length, 0);
  assert.equal(h.el('finish-results').children.length, 0); assert.equal(h.bells.length, count);
  assert.equal(h.clock.tasks.size, 0); assert.deepEqual(h.externalCalls, []);
  start(h, 'body', 240); h.click('#end-session'); assert.equal(h.el('finish-results').textContent, '');
});

test('both exercises link their research, keep valid return navigation, and expose no physiological score output', () => {
  const document = documentFixture();
  for (const id of ['screen-breath', 'screen-body']) {
    const references = document.getElementById(id).querySelectorAll('a[href]');
    assert.ok(references.length > 0, `${id} offers research links`);
    for (const link of references) {
      assert.equal(new URL(link.getAttribute('href')).protocol, 'https:');
      if (link.getAttribute('target') === '_blank') assert.match(link.getAttribute('rel'), /noopener/);
    }
  }
  assert.equal(document.querySelector('.heart-home').getAttribute('href'), '../../?return=machine-heart');
  assert.equal(document.querySelectorAll('iframe').length, 0);
  const scoreFields = document.querySelectorAll('output,progress').map(node => node.id || node.className);
  assert.ok(scoreFields.every(name => name === 'session-progress' || name === 'bell-vol-val'));
  assert.equal(document.getElementById('session-timer').getAttribute('role'), 'timer');
  assert.equal(document.getElementById('pause-dialog').getAttribute('aria-describedby'), 'pause-message');
});

test('hiding the page at the completion boundary cannot trigger background completion bells', () => {
  const h = harness({ session: true, silentBells: true });
  start(h, 'breath', 180); h.clock.advance(179750);
  // Simulate visibilitychange arriving before the interval queued at the same
  // deadline, as can happen when a browser backgrounds a page.
  h.clock.now += 250; h.visibility('hidden');
  assert.equal(h.el('screen-finish').hidden, false);
  assert.equal(closeBells(h).length, 0); assert.equal(h.clock.tasks.size, 0);
  h.clock.advance(10000); h.visibility('visible');
  assert.equal(closeBells(h).length, 0);
});

test('comparison reports changes to pace, sound and pauses alongside raw answers', () => {
  const h = harness({ session: true, silentBells: true });
  compareStart(h); choose(h, 'skip'); h.click('#continue-step');
  h.clock.advance(5000); h.click('#pause-session'); h.click('#resume-session');
  h.click('#own-breath'); h.click('#sound-toggle');
  h.clock.advance(55000); choose(h, 0); h.click('#end-session');
  const report = h.el('finish-results').textContent;
  assert.match(report, /1 of 5/);
  assert.match(report, /Pauses: 1/); assert.match(report, /Sound changes: 1/); assert.match(report, /Breath guide changes: 1/);
  assert.equal(closeBells(h).length, 0);
  assert.deepEqual(h.externalCalls, []);
});
