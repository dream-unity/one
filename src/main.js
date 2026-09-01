import { UnityAudio } from "./audio.js";
import { DreamUnityScene } from "./scene.js";

window.__consoleErrors = [];
window.addEventListener("error", (event) => {
  window.__consoleErrors.push(event.message || "Unknown browser error");
});
window.addEventListener("unhandledrejection", (event) => {
  window.__consoleErrors.push(String(event.reason || "Unhandled promise rejection"));
});

const WORLD_COPY = {
  machine: {
    kicker: "THE FIELD OF POSSIBILITY",
    title: "DREAM MACHINE",
    description: "Perception discovers pattern. Models compress experience. Prediction opens realities that do not yet exist.",
    steps: ["PERCEIVE", "MODEL", "PREDICT"],
    color: "#4e91ef"
  },
  maker: {
    kicker: "THE FORCE OF DIRECTION",
    title: "DREAM MAKER",
    description: "Intention values possibility. Action gives it momentum. Becoming makes the creator answerable to what is created.",
    steps: ["INTEND", "ACT", "BECOME"],
    color: "#51bfb4"
  },
  world: {
    kicker: "THE REALM OF CONSEQUENCE",
    title: "DREAM WORLD",
    description: "Matter receives the dream. Structure preserves it. Emergence returns lived consequence to the field of possibility.",
    steps: ["MATTER", "STRUCTURE", "EMERGE"],
    color: "#8e63e8"
  }
};

const boot = document.getElementById("boot");
const bootProgress = document.getElementById("boot-progress");
const bootStatus = document.getElementById("boot-status");
const sceneContainer = document.getElementById("scene");
const fallback = document.getElementById("webgl-fallback");
const information = document.getElementById("information");
const menuToggle = document.getElementById("menu-toggle");
const menuClose = document.getElementById("menu-close");
const soundToggle = document.getElementById("sound-toggle");
const worldPanel = document.getElementById("world-panel");
const worldKicker = document.getElementById("world-kicker");
const worldTitle = document.getElementById("world-title");
const worldDescription = document.getElementById("world-description");
const worldSteps = document.getElementById("world-steps");
const returnUnity = document.getElementById("return-unity");
const instructions = document.querySelector(".instructions");
const portalButtons = [...document.querySelectorAll("[data-world]")];
const portalLabels = [...document.querySelectorAll("[data-portal]")];
const calibrationStatus = document.getElementById("calibration-status");
const harmonyValue = document.getElementById("harmony-value");

const audio = new UnityAudio();
let unityScene;
let bootFallbackTimer;

function setProgress(percent, status) {
  bootProgress.style.width = `${percent}%`;
  if (status) bootStatus.textContent = status;
}

function completeBoot() {
  clearTimeout(bootFallbackTimer);
  setProgress(100, "FIELD CALIBRATION OPTIMAL");
  window.setTimeout(() => boot.classList.add("is-complete"), 340);
}

function showFallback(error) {
  console.error("Dream Unity could not initialize:", error);
  fallback.hidden = false;
  boot.classList.add("is-complete");
  calibrationStatus.textContent = "UNAVAILABLE";
}

function setInformation(open) {
  information.classList.toggle("is-open", open);
  information.setAttribute("aria-hidden", String(!open));
  menuToggle.setAttribute("aria-expanded", String(open));
  if (open) menuClose.focus({ preventScroll: true });
}

function showWorld(key) {
  const copy = WORLD_COPY[key];
  if (!copy) return;
  document.body.dataset.worldSelected = "true";
  portalLabels.forEach((label) => label.classList.toggle("is-active", label.dataset.portal === key));
  worldPanel.style.setProperty("--unity", copy.color);
  worldKicker.textContent = copy.kicker;
  worldTitle.textContent = copy.title;
  worldDescription.textContent = copy.description;
  worldSteps.replaceChildren();
  copy.steps.forEach((step, index) => {
    const label = document.createElement("span");
    label.textContent = step;
    worldSteps.append(label);
    if (index < copy.steps.length - 1) worldSteps.append(document.createElement("i"));
  });
  worldPanel.classList.add("is-visible");
  worldPanel.setAttribute("aria-hidden", "false");
}

function hideWorld() {
  document.body.dataset.worldSelected = "false";
  portalLabels.forEach((label) => label.classList.remove("is-active"));
  worldPanel.classList.remove("is-visible");
  worldPanel.setAttribute("aria-hidden", "true");
}

menuToggle.addEventListener("click", () => setInformation(!information.classList.contains("is-open")));
menuClose.addEventListener("click", () => {
  setInformation(false);
  menuToggle.focus({ preventScroll: true });
});

soundToggle.addEventListener("click", async () => {
  try {
    const enabled = await audio.toggle();
    soundToggle.setAttribute("aria-pressed", String(enabled));
    soundToggle.querySelector("strong").textContent = enabled ? "ON" : "OFF";
    soundToggle.setAttribute("aria-label", enabled ? "Turn ambient music off" : "Turn ambient music on");
  } catch (error) {
    console.warn(error);
    soundToggle.querySelector("strong").textContent = "N/A";
    soundToggle.disabled = true;
  }
});

returnUnity.addEventListener("click", () => {
  unityScene?.resetFocus();
  sceneContainer.querySelector("canvas")?.focus({ preventScroll: true });
});

portalButtons.forEach((button) => {
  button.addEventListener("click", () => {
    unityScene?.focusWorld(button.dataset.world);
  });
});

window.addEventListener("dreamunity:worldfocus", (event) => showWorld(event.detail.key));
window.addEventListener("dreamunity:unityfocus", hideWorld);
window.addEventListener("dreamunity:ready", completeBoot, { once: true });
window.addEventListener("dreamunity:contextlost", () => {
  calibrationStatus.textContent = "RECALIBRATING";
  harmonyValue.textContent = "PAUSED";
});
window.addEventListener("dreamunity:contextrestored", () => {
  calibrationStatus.textContent = "OPTIMAL";
  harmonyValue.textContent = "100%";
});
window.addEventListener("dreamunity:rendererror", (event) => {
  showFallback(new Error(event.detail?.message || "Rendering interrupted"));
});
window.addEventListener("dreamunity:metrics", (event) => {
  const { fps, calls, triangles, profile } = event.detail;
  const harmony = Math.max(0, Math.min(100, Math.round((fps / 60) * 100)));
  harmonyValue.textContent = `${harmony}%`;
  calibrationStatus.textContent = fps >= 48 ? "OPTIMAL" : "ADAPTING";
  document.body.dataset.renderProfile = profile;
  document.body.dataset.renderCalls = String(calls);
  document.body.dataset.renderTriangles = String(triangles);
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (information.classList.contains("is-open")) setInformation(false);
  else if (document.body.dataset.worldSelected === "true") unityScene?.resetFocus();
});

sceneContainer.addEventListener("pointerdown", () => {
  instructions?.classList.add("has-interacted");
}, { once: true });

document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("is-paused", document.hidden);
});

setProgress(18, "FORMING THE UNITY AXIS");

try {
  setProgress(42, "WEAVING CAUSAL ORBITS");
  unityScene = new DreamUnityScene(sceneContainer);
  window.__DREAM_UNITY__ = {
    version: "2.0.0",
    scene: unityScene,
    worlds: Object.keys(WORLD_COPY),
    focus: (world) => unityScene.focusWorld(world),
    reset: () => unityScene.resetFocus(),
    metrics: () => unityScene.getMetrics()
  };
  setProgress(82, "AWAKENING THREE WORLDS");
  bootFallbackTimer = window.setTimeout(completeBoot, 5000);
} catch (error) {
  showFallback(error);
}
