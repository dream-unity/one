const TRACK_URL = new URL(
  "./assets/audio/dream-maker-eye.mp3?v=b23033e55592",
  import.meta.url
).href;

const TARGET_VOLUME = 0.3;
const PLAYBACK_TIMEOUT_MS = 12_000;

const STATES = {
  off: {
    text: "OFF",
    label: "Turn Dream Maker Eye on",
    pressed: false,
    busy: false
  },
  loading: {
    text: "…",
    label: "Loading Dream Maker Eye; activate to cancel",
    pressed: false,
    busy: true
  },
  on: {
    text: "ON",
    label: "Turn Dream Maker Eye off",
    pressed: true,
    busy: false
  },
  retry: {
    text: "RETRY",
    label: "Retry Dream Maker Eye",
    pressed: false,
    busy: false
  }
};

export class DreamUnityAudioController {
  constructor(button, options = {}) {
    if (!button) throw new Error("The Dream Unity music control is missing.");

    this.button = button;
    this.label = button.querySelector("strong");
    this.createAudio = options.createAudio || (() => new Audio());
    this.setTimer = options.setTimer || ((callback, delay) => setTimeout(callback, delay));
    this.clearTimer = options.clearTimer || ((timer) => clearTimeout(timer));
    this.timeoutMs = options.timeoutMs || PLAYBACK_TIMEOUT_MS;
    this.warn = options.warn || ((...messages) => console.warn(...messages));
    this.player = null;
    this.state = "off";
    this.operation = 0;
    this.timeout = null;
    this.wantsPlayback = false;
    this.lastError = null;

    this.button.addEventListener("click", (event) => {
      // The restored bundle still contains its original procedural-audio fallback.
      // Capture and stop this one event so the replacement never requires a
      // visualization rebuild and can never interfere with scene initialization.
      event.stopImmediatePropagation();
      void this.toggle();
    }, { capture: true });
    this.#setState("off");
  }

  toggle() {
    if (this.state === "loading" || this.state === "on") {
      this.stop();
      return Promise.resolve(false);
    }
    return this.start();
  }

  async start() {
    const shouldRecreatePlayer = this.state === "retry";
    const operation = ++this.operation;
    this.wantsPlayback = true;
    this.lastError = null;
    this.#setState("loading");

    if (shouldRecreatePlayer) this.#disposePlayer();

    let player;
    let playResult;
    try {
      player = this.#ensurePlayer();
      // Calling play synchronously inside the click turn preserves browser user activation.
      playResult = player.play();
    } catch (error) {
      this.#fail(error, operation);
      return false;
    }

    let rejectTimeout;
    const timedOut = new Promise((_, reject) => {
      rejectTimeout = reject;
      this.timeout = this.setTimer(
        () => reject(new Error("Dream Maker Eye took too long to begin playback.")),
        this.timeoutMs
      );
    });

    try {
      await Promise.race([Promise.resolve(playResult), timedOut]);
      this.#clearPlaybackTimeout();
      rejectTimeout = null;

      if (operation !== this.operation || !this.wantsPlayback) {
        player.pause();
        return false;
      }

      this.#setState("on");
      return true;
    } catch (error) {
      this.#fail(error, operation);
      return false;
    } finally {
      rejectTimeout = null;
    }
  }

  stop() {
    this.operation += 1;
    this.wantsPlayback = false;
    this.#clearPlaybackTimeout();
    this.player?.pause();
    this.#setState("off");
  }

  #ensurePlayer() {
    if (this.state === "retry") this.#disposePlayer();
    if (this.player) return this.player;

    const player = this.createAudio();
    player.loop = true;
    player.preload = "none";
    player.playsInline = true;
    player.volume = TARGET_VOLUME;
    player.src = TRACK_URL;
    player.addEventListener?.("error", () => {
      if (this.player !== player || !this.wantsPlayback) return;
      const mediaError = player.error;
      const reason = mediaError?.message || `Media error ${mediaError?.code || "unknown"}`;
      this.#fail(new Error(reason), this.operation);
    });
    this.player = player;
    return player;
  }

  #disposePlayer() {
    const player = this.player;
    this.player = null;
    if (!player) return;

    player.pause();
    if (typeof player.removeAttribute === "function") {
      player.removeAttribute("src");
      player.load?.();
    }
  }

  #fail(error, operation) {
    if (operation !== this.operation) return;

    this.operation += 1;
    this.wantsPlayback = false;
    this.lastError = error instanceof Error ? error : new Error(String(error));
    this.#clearPlaybackTimeout();
    this.player?.pause();
    this.#setState("retry");
    this.warn("Dream Maker Eye playback is unavailable; the control remains retryable.", this.lastError);
  }

  #clearPlaybackTimeout() {
    if (this.timeout === null) return;
    this.clearTimer(this.timeout);
    this.timeout = null;
  }

  #setState(state) {
    const presentation = STATES[state];
    this.state = state;
    this.button.disabled = false;
    this.button.dataset.audioState = state;
    this.button.setAttribute("aria-pressed", String(presentation.pressed));
    this.button.setAttribute("aria-busy", String(presentation.busy));
    this.button.setAttribute("aria-label", presentation.label);
    if (this.label) this.label.textContent = presentation.text;
  }
}

if (typeof document !== "undefined") {
  const button = document.getElementById("sound-toggle");
  if (button) globalThis.__DREAM_UNITY_AUDIO__ = new DreamUnityAudioController(button);
}
