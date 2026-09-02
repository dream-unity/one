(function (root) {
  "use strict";

  var TRACK_URL = "./assets/audio/dream-maker-eye.mp3?v=b23033e55592";
  var TARGET_VOLUME = 0.3;
  var PLAYBACK_TIMEOUT_MS = 12000;
  var ACTIVATION_EVENTS = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "touchstart",
    "touchend",
    "keydown",
    "click"
  ];

  var STATES = {
    off: {
      text: "OFF",
      label: "Turn Dream Maker Eye on",
      pressed: false,
      busy: false
    },
    starting: {
      text: "AUTO",
      label: "Starting Dream Maker Eye",
      pressed: false,
      busy: true
    },
    blocked: {
      text: "PLAY",
      label: "Play Dream Maker Eye",
      pressed: false,
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

  function defaultWarn() {
    if (!root.console || typeof root.console.warn !== "function") return;
    root.console.warn.apply(root.console, arguments);
  }

  function DreamUnityAudioController(button, options) {
    var self = this;
    options = options || {};

    if (!button) throw new Error("The Dream Unity music control is missing.");

    this.button = button;
    this.label = button.querySelector("strong");
    this.fixedPlayer = options.player || null;
    this.player = this.fixedPlayer;
    this.createAudio = options.createAudio || function () { return new root.Audio(); };
    this.setTimer = options.setTimer || function (callback, delay) { return root.setTimeout(callback, delay); };
    this.clearTimer = options.clearTimer || function (timer) { root.clearTimeout(timer); };
    this.timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : PLAYBACK_TIMEOUT_MS;
    this.warn = options.warn || defaultWarn;
    this.activationTarget = options.activationTarget || root.document || null;
    this.pageTarget = options.pageTarget || root;
    this.visibilityTarget = options.visibilityTarget || root.document || null;
    this.defaultOn = options.defaultOn === true;
    this.state = this.defaultOn ? "starting" : "off";
    this.startOrigin = this.defaultOn ? "autoplay" : "manual";
    this.operation = 0;
    this.timeout = null;
    this.wantsPlayback = this.defaultOn;
    this.lastError = null;
    this.removeActivationListeners = null;
    this.boundPlayer = null;

    this.button.addEventListener("click", function (event) {
      // The restored 3D bundle contains its original procedural-audio handler.
      // Capture this event first so music changes never rebuild or disturb it.
      if (event && typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      self.toggle(true);
    }, true);

    this.onPageShow = function () {
      if (!self.wantsPlayback) return;
      if (self.state === "starting" && self.startOrigin === "autoplay") return;
      self.reconcile();
    };
    this.onVisibilityChange = function () {
      if (!self.wantsPlayback) return;
      if (self.visibilityTarget && self.visibilityTarget.visibilityState === "hidden") return;
      self.reconcile();
    };

    if (this.pageTarget && typeof this.pageTarget.addEventListener === "function") {
      this.pageTarget.addEventListener("pageshow", this.onPageShow, false);
    }
    if (this.visibilityTarget && typeof this.visibilityTarget.addEventListener === "function") {
      this.visibilityTarget.addEventListener("visibilitychange", this.onVisibilityChange, false);
    }

    this.setState(this.state);
  }

  DreamUnityAudioController.prototype.autoplay = function () {
    if (this.state === "on" && this.isActuallyPlaying()) return true;
    this.wantsPlayback = true;
    // Arm recovery before play(). Some engines can leave the initial request
    // pending instead of rejecting immediately.
    this.installActivationFallback();
    return this.start({ allowPolicyArm: true, origin: "autoplay" });
  };

  DreamUnityAudioController.prototype.toggle = function (fromGesture) {
    if (this.state === "on" || (this.state === "starting" && this.startOrigin === "gesture")) {
      this.stop();
      return false;
    }

    // A press during the initial AUTO attempt is a request to start, not to
    // turn a silent intention off. This eliminates the old OFF-then-ON cycle.
    return this.start({
      allowPolicyArm: true,
      fromGesture: fromGesture === true,
      origin: fromGesture === true ? "gesture" : "manual"
    });
  };

  DreamUnityAudioController.prototype.start = function (options) {
    var self = this;
    var player;
    var playResult;
    var operation;
    var fromGesture;
    var allowPolicyArm;
    var origin;
    var recreatePlayer;

    options = options || {};
    fromGesture = options.fromGesture === true;
    allowPolicyArm = options.allowPolicyArm === true;
    origin = options.origin || (fromGesture ? "gesture" : "manual");
    recreatePlayer = this.state === "retry" && !this.fixedPlayer;
    operation = ++this.operation;

    this.wantsPlayback = true;
    this.lastError = null;
    this.startOrigin = origin;
    this.clearPlaybackTimeout();
    // Keep every trusted-event path armed until playback is confirmed. Some
    // mobile engines accept click/touchend but not the earlier pointer event.
    this.installActivationFallback();
    this.setState("starting");

    if (recreatePlayer) this.disposePlayer();

    try {
      player = this.ensurePlayer();
      if (this.isActuallyPlaying(player)) {
        this.confirmPlaying(player);
        return true;
      }

      // Schedule before play(): some older engines can dispatch the playing
      // event synchronously, and that event must cancel this timer.
      this.timeout = this.setTimer(function () {
        if (operation !== self.operation || !self.wantsPlayback) return;
        if (self.isActuallyPlaying(player)) {
          self.confirmPlaying(player);
          return;
        }
        self.markAutoplayBlocked(
          new Error("Dream Maker Eye is waiting for browser playback permission."),
          operation
        );
      }, this.timeoutMs);

      // This call occurs before any asynchronous boundary so a trusted click,
      // touch or key gesture remains valid in every engine that requires one.
      playResult = player.play();
    } catch (error) {
      this.handlePlayFailure(error, operation, allowPolicyArm, origin);
      return false;
    }

    // IE and older WebKit return undefined from play(). Never infer success
    // from that return value; the playing event is the source of truth.
    if (playResult && typeof playResult.then === "function") {
      try {
        playResult.then(function () {
          if (operation !== self.operation || !self.wantsPlayback) return;
          if (self.isActuallyPlaying(player)) self.confirmPlaying(player);
        }, function (error) {
          self.handlePlayFailure(error, operation, allowPolicyArm, origin);
        });
      } catch (error) {
        this.handlePlayFailure(error, operation, allowPolicyArm, origin);
        return false;
      }
    }

    return true;
  };

  DreamUnityAudioController.prototype.stop = function () {
    this.operation += 1;
    this.wantsPlayback = false;
    this.startOrigin = "manual";
    this.clearPlaybackTimeout();
    this.removeActivationFallback();
    if (this.player && typeof this.player.pause === "function") this.player.pause();
    this.setState("off");
  };

  DreamUnityAudioController.prototype.reconcile = function () {
    if (!this.wantsPlayback) {
      this.setState("off");
      return false;
    }
    if (this.isActuallyPlaying()) {
      this.confirmPlaying(this.player);
      return true;
    }
    return this.start({ allowPolicyArm: true, origin: "resume" });
  };

  DreamUnityAudioController.prototype.ensurePlayer = function () {
    var player = this.player;
    var self = this;

    if (!player) {
      player = this.createAudio();
      this.player = player;
    }
    if (!player) throw new Error("This browser could not create an audio player.");

    try { player.autoplay = true; } catch (error) { /* Attribute fallback below. */ }
    try { player.loop = true; } catch (error) { /* The ended fallback remains active. */ }
    try { player.preload = "auto"; } catch (error) { /* Browsers may choose their own preload policy. */ }
    try { player.playsInline = true; } catch (error) { /* Older engines ignore this hint. */ }
    try { player.defaultMuted = false; } catch (error) { /* Older engines may not expose it. */ }
    try { player.muted = false; } catch (error) { /* System or tab mute remains user-controlled. */ }
    try { player.volume = TARGET_VOLUME; } catch (error) { /* iOS owns hardware volume. */ }

    if (typeof player.setAttribute === "function") {
      player.setAttribute("autoplay", "");
      player.setAttribute("loop", "");
      player.setAttribute("preload", "auto");
      player.setAttribute("playsinline", "");
      player.setAttribute("webkit-playsinline", "");
    }

    if (!player.currentSrc && !player.src) player.src = TRACK_URL;

    if (this.boundPlayer !== player && typeof player.addEventListener === "function") {
      player.addEventListener("playing", function () {
        self.confirmPlaying(player);
      }, false);
      player.addEventListener("pause", function () {
        self.handlePause(player);
      }, false);
      player.addEventListener("ended", function () {
        self.handleEnded(player);
      }, false);
      player.addEventListener("error", function () {
        self.handleMediaError(player);
      }, false);
      this.boundPlayer = player;
    }

    return player;
  };

  DreamUnityAudioController.prototype.isActuallyPlaying = function (player) {
    player = player || this.player;
    if (!player) return false;
    if (player.paused !== false || player.ended === true) return false;
    return typeof player.readyState !== "number" || player.readyState >= 2;
  };

  DreamUnityAudioController.prototype.confirmPlaying = function (player) {
    if (player !== this.player || !this.wantsPlayback) return;
    if (!this.isActuallyPlaying(player)) return;
    this.clearPlaybackTimeout();
    this.removeActivationFallback();
    this.setState("on");
  };

  DreamUnityAudioController.prototype.handlePause = function (player) {
    if (player !== this.player) return;
    if (!this.wantsPlayback) {
      this.setState("off");
      return;
    }
    if (this.state === "blocked" || this.state === "retry") return;
    this.clearPlaybackTimeout();
    this.setState("blocked");
    this.installActivationFallback();
  };

  DreamUnityAudioController.prototype.handleEnded = function (player) {
    if (player !== this.player || !this.wantsPlayback) return;
    try { player.currentTime = 0; } catch (error) { /* Some streams are not seekable. */ }
    this.start({ allowPolicyArm: true, origin: "loop" });
  };

  DreamUnityAudioController.prototype.handleMediaError = function (player) {
    var mediaError;
    var reason;
    if (player !== this.player || !this.wantsPlayback) return;
    mediaError = player.error;
    reason = mediaError && mediaError.message
      ? mediaError.message
      : "Media error " + (mediaError && mediaError.code ? mediaError.code : "unknown");
    this.fail(new Error(reason), this.operation);
  };

  DreamUnityAudioController.prototype.handlePlayFailure = function (error, operation, allowPolicyArm, origin) {
    if (operation !== this.operation || !this.wantsPlayback) return;
    if (this.isActuallyPlaying()) {
      this.confirmPlaying(this.player);
      return;
    }
    if (allowPolicyArm && (this.isAutoplayBlocked(error) || origin !== "gesture")) {
      this.markAutoplayBlocked(error, operation);
      return;
    }
    this.fail(error, operation);
  };

  DreamUnityAudioController.prototype.markAutoplayBlocked = function (error, operation) {
    if (operation !== this.operation || !this.wantsPlayback) return;
    this.lastError = error instanceof Error ? error : new Error(String(error));
    this.clearPlaybackTimeout();
    this.setState("blocked");
    this.installActivationFallback();
  };

  DreamUnityAudioController.prototype.installActivationFallback = function () {
    var self = this;
    var activate;

    if (this.removeActivationListeners || !this.activationTarget ||
        typeof this.activationTarget.addEventListener !== "function") return;

    activate = function (event) {
      var key;
      var target;
      if (!self.wantsPlayback || self.state === "on" || (event && event.isTrusted === false)) return;

      key = event && (event.key || event.keyCode);
      if (event && event.type === "keydown" &&
          (key === "Alt" || key === "Control" || key === "Meta" || key === "Shift" ||
           key === "Tab" || key === 16 || key === 17 || key === 18 || key === 91 || key === 9)) return;

      target = event && (event.target || event.srcElement);
      if (target && typeof self.button.contains === "function" && self.button.contains(target)) return;

      self.start({ allowPolicyArm: true, fromGesture: true, origin: "gesture" });
    };

    for (var index = 0; index < ACTIVATION_EVENTS.length; index += 1) {
      this.activationTarget.addEventListener(ACTIVATION_EVENTS[index], activate, true);
    }
    this.removeActivationListeners = function () {
      for (var eventIndex = 0; eventIndex < ACTIVATION_EVENTS.length; eventIndex += 1) {
        if (typeof self.activationTarget.removeEventListener === "function") {
          self.activationTarget.removeEventListener(ACTIVATION_EVENTS[eventIndex], activate, true);
        }
      }
      self.removeActivationListeners = null;
    };
  };

  DreamUnityAudioController.prototype.removeActivationFallback = function () {
    if (typeof this.removeActivationListeners === "function") this.removeActivationListeners();
  };

  DreamUnityAudioController.prototype.disposePlayer = function () {
    var player = this.player;
    this.player = null;
    this.boundPlayer = null;
    if (!player) return;
    if (typeof player.pause === "function") player.pause();
    if (typeof player.removeAttribute === "function") {
      player.removeAttribute("src");
      if (typeof player.load === "function") player.load();
    }
  };

  DreamUnityAudioController.prototype.fail = function (error, operation) {
    if (operation !== this.operation) return;
    this.lastError = error instanceof Error ? error : new Error(String(error));
    this.clearPlaybackTimeout();
    this.removeActivationFallback();
    this.setState("retry");
    this.warn("Dream Maker Eye playback is unavailable; the control remains retryable.", this.lastError);
  };

  DreamUnityAudioController.prototype.isAutoplayBlocked = function (error) {
    var name = error && error.name ? error.name : "";
    var message = name + " " + (error && error.message ? error.message : error || "");
    return name === "NotAllowedError" ||
      /autoplay|user (gesture|interaction)|not allowed|permission/i.test(message);
  };

  DreamUnityAudioController.prototype.clearPlaybackTimeout = function () {
    if (this.timeout === null) return;
    this.clearTimer(this.timeout);
    this.timeout = null;
  };

  DreamUnityAudioController.prototype.setState = function (state) {
    var presentation = STATES[state];
    this.state = state;
    this.button.disabled = false;
    this.button.setAttribute("data-audio-state", state);
    this.button.setAttribute("data-audio-intent", this.wantsPlayback ? "on" : "off");
    this.button.setAttribute("aria-pressed", String(presentation.pressed));
    this.button.setAttribute("aria-busy", String(presentation.busy));
    this.button.setAttribute("aria-label", presentation.label);
    if (this.label) this.label.textContent = presentation.text;
  };

  root.DreamUnityAudioController = DreamUnityAudioController;

  function boot() {
    var button;
    var player;
    var controller;
    if (!root.document || root.__DREAM_UNITY_AUDIO__) return;
    button = root.document.getElementById("sound-toggle");
    if (!button) return;
    player = root.document.getElementById("dream-unity-soundtrack");
    controller = new DreamUnityAudioController(button, {
      defaultOn: true,
      player: player,
      activationTarget: root.document,
      visibilityTarget: root.document,
      pageTarget: root
    });
    root.__DREAM_UNITY_AUDIO__ = controller;
    controller.autoplay();
  }

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot, false);
    } else {
      boot();
    }
  }
}(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this)));
