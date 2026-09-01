const TRACK_URL = "./assets/audio/dream-maker-eye.mp3";
const TARGET_VOLUME = 0.3;
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 650;

export class UnityAudio {
  constructor() {
    this.player = null;
    this.enabled = false;
    this.fadeFrame = 0;
  }

  async toggle() {
    if (!this.player) this.#build();

    this.enabled = !this.enabled;
    window.cancelAnimationFrame(this.fadeFrame);

    if (this.enabled) {
      try {
        await this.player.play();
      } catch (error) {
        this.enabled = false;
        throw new Error("Dream Maker Eye could not begin playback.", { cause: error });
      }

      if (!this.enabled) {
        this.player.pause();
        return false;
      }

      this.#fadeTo(TARGET_VOLUME, FADE_IN_MS);
    } else {
      this.#fadeTo(0, FADE_OUT_MS, () => {
        if (!this.enabled) this.player.pause();
      });
    }

    return this.enabled;
  }

  #build() {
    this.player = new Audio(TRACK_URL);
    this.player.loop = true;
    this.player.preload = "metadata";
    this.player.volume = 0;
    this.player.playsInline = true;
  }

  #fadeTo(target, duration, onComplete) {
    const initial = this.player.volume;
    const startedAt = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.player.volume = initial + (target - initial) * eased;

      if (progress < 1) {
        this.fadeFrame = window.requestAnimationFrame(step);
      } else {
        this.fadeFrame = 0;
        onComplete?.();
      }
    };

    this.fadeFrame = window.requestAnimationFrame(step);
  }
}
