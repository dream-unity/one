import { Clock } from './core.js';
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const seed = () => {
  const a = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a);
  else a[0] = Date.now();
  return a[0];
};
export const fmt = s => { const whole = Math.ceil(Math.max(0, s)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; };
export const button = (id, text, primary = false) => `<button type="button" id="${id}" class="${primary ? 'primary' : 'secondary'}">${text}</button>`;
export const slider = (id, label, value, min, max, step = 1, unit = '') => `<label class="slider-label" for="${id}"><span>${label}</span><output id="${id}-value" for="${id}">${value}${unit}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
export function bindSlider(id, fn, format = v => v) {
  const node = $('#' + id);
  const update = () => { const value = Number(node.value); $('#' + id + '-value').textContent = format(value); fn(value); };
  node.addEventListener('input', update);
  return update;
}
export function announce(message, kind = '') {
  const node = $('#feedback');
  node.textContent = message;
  node.dataset.kind = kind;
}
export function research({ question, finding, model, limits, sources, maths = '' }) {
  $('#research').innerHTML = `<summary>Go deeper · ${esc(question)}</summary><div class="research-body"><div><h3>What we know</h3><p>${finding}</p></div><div><h3>What happens here</h3><p>${model}</p>${maths ? `<p class="formula">${maths}</p>` : ''}</div><div><h3>What this cannot tell us</h3><p>${limits}</p></div><div><h3>Read the source</h3>${sources.map(([name, href]) => `<p><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(name)} <span class="sr-only">(opens a new tab)</span>↗</a></p>`).join('')}</div></div>`;
}
// An explicit play/pause controller. Inactive tabs always need deliberate resumption.
export function animation(update, onPause = () => {}) {
  let running = false, frame = 0, last = null, remainder = 0, disposed = false;
  const tick = now => {
    if (!running) return;
    const delta = last === null ? 0 : Math.min((now - last) / 1000, .1);
    last = now; remainder += delta;
    while (remainder >= 1 / 60) { if (update(1 / 60) === false) { pause(); return; } remainder -= 1 / 60; }
    frame = requestAnimationFrame(tick);
  };
  const pause = () => { const was = running; running = false; cancelAnimationFrame(frame); last = null; remainder = 0; if (was) onPause(); };
  const play = () => { if (!running && !disposed) { running = true; last = null; frame = requestAnimationFrame(tick); } };
  const hidden = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', pause);
  const dispose = () => { pause(); disposed = true; document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pause); };
  return { play, pause, dispose, get running() { return running; } };
}
export function session(duration, update, done) {
  const clock = new Clock(duration);
  let timer = null, notified = false;
  const paint = () => {
    clock.tick(performance.now()); update(clock);
    if (clock.done && !notified) { notified = true; clearInterval(timer); timer = null; done(); }
  };
  const pause = () => { clock.pause(performance.now()); clearInterval(timer); timer = null; update(clock); };
  const play = () => { if (clock.done) { paint(); return; } clock.start(performance.now()); clearInterval(timer); timer = setInterval(paint, 100); paint(); };
  const hidden = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', pause);
  const dispose = () => { pause(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pause); };
  return { clock, play, pause, dispose };
}
let audioContext;
export function tone(frequency = 440, duration = .1) {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    audioContext.resume().catch(() => {});
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    const now = audioContext.currentTime;
    osc.type = 'sine'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.025, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(audioContext.destination); osc.start(now); osc.stop(now + duration + .01);
  } catch { /* Audio is optional; every cue also has a visible equivalent. */ }
}
