import { createInkClock, INK_RINGS, INK_CYCLE } from '../symbol-motion.js';

const WORLD_IDS = new Set(['machine', 'maker', 'world']);

/**
 * The ink clock belongs to this scene's lifetime, not to the conversation.
 * The browser composites decoded artwork; no canvas, render loop or WebGL is
 * required. Semantic changes never recreate an animation or reset its phase.
 * @param {HTMLElement} element
 */
export function createScene(element) {
  if (!element?.querySelector) throw new TypeError('A scene element is required.');
  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument.defaultView;
  const layer = element.querySelector('[data-ink-layer]');
  const summaryNode = element.querySelector('#scene-focus-summary');
  const controls = [...ownerDocument.querySelectorAll('[data-focus-world]')];
  const paths = [...element.querySelectorAll('[data-meaning-path]')];
  const motionButton = ownerDocument.getElementById('motion-toggle');
  const reducedMotion = ownerWindow.matchMedia('(prefers-reduced-motion: reduce)');
  const clock = createInkClock(() => ownerWindow.performance.now());
  let animations = [];
  let active = true;
  let pausedByUser = false;
  let disposed = false;
  let envelope = 0;

  function syncMotion() {
    if (disposed) return;
    const paused = !active || pausedByUser || reducedMotion.matches || ownerDocument.hidden;
    clock.setPaused(paused);
    const motion = clock.read();
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = motion.seconds * 1000;
      if (!paused) animation.play();
    }
    element.dataset.motion = paused ? 'paused' : 'running';
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(pausedByUser));
      motionButton.textContent = pausedByUser ? 'Resume motion' : reducedMotion.matches ? 'Reduced motion' : 'Pause motion';
      motionButton.disabled = reducedMotion.matches;
    }
  }

  function setFocus(worlds = [], summary = '') {
    if (disposed) return;
    const requested = Array.isArray(worlds) ? worlds : [worlds];
    const selected = new Set(requested.filter((world) => WORLD_IDS.has(world)));
    for (const control of controls) {
      const focused = selected.has(control.dataset.focusWorld);
      control.dataset.focused = String(focused);
      control.setAttribute('aria-pressed', String(focused));
    }
    for (const path of paths) path.dataset.focused = String(selected.has(path.dataset.meaningPath));
    if (summaryNode) summaryNode.textContent = typeof summary === 'string' && summary.trim()
      ? summary.trim().slice(0, 240)
      : 'Three worlds, one life.';
    element.dataset.hasFocus = String(selected.size > 0);
  }

  /** Audio activity is only a small local signal, never an emotional score. */
  function setSpeaking(level = 0) {
    if (disposed) return;
    const amount = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    envelope = amount === 0 || !active ? 0 : envelope * .7 + amount * .3;
    element.style.setProperty('--speech-level', String(Number(envelope.toFixed(3))));
    element.dataset.speaking = String(envelope > .015 && active && !ownerDocument.hidden);
  }

  function setActive(value) {
    if (disposed) return;
    active = Boolean(value);
    if (!active) setSpeaking(0);
    syncMotion();
  }

  function onVisibility() {
    if (ownerDocument.hidden) setSpeaking(0);
    syncMotion();
  }

  function onMotionToggle() {
    pausedByUser = !pausedByUser;
    syncMotion();
  }

  async function installInk() {
    if (!layer || typeof element.animate !== 'function') return;
    const fragments = ownerDocument.createDocumentFragment();
    const images = [];
    for (let index = 0; index < INK_RINGS.length; index += 1) {
      const ring = INK_RINGS[index];
      const band = ownerDocument.createElement('div');
      band.className = 'scene-ink-band';
      band.style.left = `${(ring.cx - ring.outer) / 1254 * 100}%`;
      band.style.top = `${(ring.cy - ring.outer) / 1254 * 100}%`;
      band.style.width = band.style.height = `${ring.outer * 2 / 1254 * 100}%`;
      const maskUrl = new URL(`../assets/symbol-mask-${index}.png`, import.meta.url).href;
      band.style.maskImage = band.style.webkitMaskImage = `url("${maskUrl}")`;
      const mask = new ownerWindow.Image();
      mask.src = maskUrl;
      const image = ownerDocument.createElement('img');
      image.className = 'scene-ink-turn';
      image.alt = '';
      image.draggable = false;
      image.width = image.height = ring.outer * 2;
      image.src = new URL(`../assets/symbol-ring-${index}.webp`, import.meta.url).href;
      band.append(image);
      fragments.append(band);
      images.push(mask, image);
    }
    try {
      await Promise.all(images.map((image) => image.decode()));
      if (disposed) return;
      layer.append(fragments);
      animations = [...layer.querySelectorAll('.scene-ink-turn')].map((image) => image.animate(
        [{ transform:'rotate(0deg)' }, { transform:'rotate(360deg)' }],
        { duration:INK_CYCLE * 1000, iterations:Infinity, easing:'linear' },
      ));
      element.dataset.renderMode = 'ink';
      syncMotion();
    } catch {
      // The already-visible original drawing is the complete fallback.
      if (!disposed) element.dataset.renderMode = 'static';
    }
  }

  ownerDocument.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', syncMotion);
  motionButton?.addEventListener('click', onMotionToggle);
  element.dataset.renderMode = 'static';
  setFocus([], '');
  syncMotion();
  void installInk();

  return {
    setFocus,
    setSpeaking,
    setActive,
    dispose() {
      if (disposed) return;
      disposed = true;
      ownerDocument.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', syncMotion);
      motionButton?.removeEventListener('click', onMotionToggle);
      animations.forEach((animation) => animation.cancel());
      animations = [];
      layer?.replaceChildren();
      element.style.removeProperty('--speech-level');
      element.dataset.speaking = 'false';
      element.dataset.motion = 'paused';
    },
  };
}
