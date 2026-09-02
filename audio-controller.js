const TRACK_URL = new URL(
  "./assets/audio/dream-maker-eye.mp3?v=b23033e55592",
  import.meta.url
).href;

const TARGET_VOLUME = 0.3;
const PLAYBACK_TIMEOUT_MS = 12_000;
const ACTIVATION_EVENTS = ["pointerdown", "touchstart", "keydown", "click"];

const STATES = {
  off: {
    text: "OFF",
    label: "Turn Dream Maker Eye on",
    pressed: false,
    busy: false
  },
  starting: {
    text: "ON",
    label: "Turn Dream Maker Eye off",
    pressed: true,
    busy: true
  },
  armed: {
    text: "ON",
    label: "Turn Dream Maker Eye off; playback starts with your first interaction",
    pressed: true,
    busy: false
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
    this.timeoutMs = options.timeoutMs ?? PLAYBACK_TIMEOUT_MS;
    this.warn = options.warn || ((...messages) => console.warn(...messages));
    this.activationTarget = options.activationTarget
      || (typeof document !== "undefined" ? document : null);
    this.defaultOn = options.defaultOn === true;
    this.player = null;
    this.state = this.defaultOn ? "armed" : "off";
    this.operation = 0;
    this.timeout = null;
    this.wantsPlayback = this.defaultOn;
    this.lastError = null;
    this.removeActivationListeners = null;

    this.button.addEventListener("click", (event) => {
      // The restored bundle still contains its original procedural-audio fallback.
      // Capture and stop this one event so the replacement never requires a
      // visualization rebuild and can never interfere with scene initialization.
      event.stopImmediatePropagation();
      void this.toggle();
    }, { capture: true });
    this.#setState(this.state);
  }

  autoplay() {
    if (this.state === "on") return Promise.resolve(true);
    return this.start({ allowPolicyArm: true });
  }

  toggle() {
    if (this.state === "starting" || this.state === "armed" || this.state === "on") {
      this.stop();
      return Promise.resolve(false);
    }
    return this.start();
  }

  async start({ allowPolicyArm = false } = {}) {
    const shouldRecreatePlayer = this.state === "retry";
    const operation = ++this.operation;
    this.wantsPlayback = true;
    this.lastError = null;
    this.#removeActivationFallback();
    this.#setState("starting");

    if (shouldRecreatePlayer) this.#disposePlayer();

    let player;
    let playResult;
    try {
      player = this.#ensurePlayer();
      // This remains synchronous up to play(), preserving a trusted user gesture
      // when start() is retried from the first page interaction.
      playResult = player.play();
    } catch (error) {
      if (allowPolicyArm && this.#isAutoplayBlocked(error)) {
        this.#armForInteraction(error, operation);
      } else {
        this.#fail(error, operation);
      }
      return false;
    }

    const timedOut = new Promise((_, reject) => {
      this.timeout = this.setTimer(
        () => reject(new Error("Dream Maker Eye took too long to begin playback.")),
        this.timeoutMs
      );
    });

    try {
      await Promise.race([Promise.resolve(playResult), timedOut]);
      this.#clearPlaybackTimeout();

      if (operation !== this.operation || !this.wantsPlayback) {
        player.pause();
        return false;
      }

      this.#removeActivationFallback();
      this.#setState("on");
      return true;
    } catch (error) {
      if (allowPolicyArm && this.#isAutoplayBlocked(error)) {
        this.#armForInteraction(error, operation);
      } else {
        this.#fail(error, operation);
      }
      return false;
    }
  }

  stop() {
    this.operation += 1;
    this.wantsPlayback = false;
    this.#clearPlaybackTimeout();
    this.#removeActivationFallback();
    this.player?.pause();
    this.#setState("off");
  }

  #ensurePlayer() {
    if (this.player) return this.player;

    const player = this.createAudio();
    player.loop = true;
    player.preload = "auto";
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

  #armForInteraction(error, operation) {
    if (operation !== this.operation) return;

    this.lastError = error instanceof Error ? error : new Error(String(error));
    this.wantsPlayback = true;
    this.#clearPlaybackTimeout();
    this.player?.pause();
    this.#setState("armed");
    this.#installActivationFallback();
  }

  #installActivationFallback() {
    if (this.removeActivationListeners || !this.activationTarget?.addEventListener) return;

    const activate = (event) => {
      if (!this.wantsPlayback || this.state !== "armed" || event.isTrusted === false) return;
      if (event.type === "keydown" && ["Alt", "Control", "Meta", "Shift", "Tab"].includes(event.key)) return;
      if (this.button.contains?.(event.target)) return;
      void this.start({ allowPolicyArm: true });
    };

    ACTIVATION_EVENTS.forEach((eventName) => {
      const options = eventName === "touchstart" ? { capture: true, passive: true } : true;
      this.activationTarget.addEventListener(eventName, activate, options);
    });
    this.removeActivationListeners = () => {
      ACTIVATION_EVENTS.forEach((eventName) => {
        this.activationTarget.removeEventListener?.(eventName, activate, true);
      });
      this.removeActivationListeners = null;
    };
  }

  #removeActivationFallback() {
    this.removeActivationListeners?.();
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
    this.#removeActivationFallback();
    this.player?.pause();
    this.#setState("retry");
    this.warn("Dream Maker Eye playback is unavailable; the control remains retryable.", this.lastError);
  }

  #isAutoplayBlocked(error) {
    const message = `${error?.name || ""} ${error?.message || error || ""}`;
    return error?.name === "NotAllowedError"
      || /autoplay|user (gesture|interaction)|not allowed/i.test(message);
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
  if (button) {
    const controller = new DreamUnityAudioController(button, { defaultOn: true });
    globalThis.__DREAM_UNITY_AUDIO__ = controller;
    void controller.autoplay();
  }
}
