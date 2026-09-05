import {
  ACTIVE_SESSION_KEY,
  CBT_VERSION,
  GOLD,
  PREFERENCES_KEY,
  PROGRESS_KEY,
  RESUME_SNAPSHOT_KEY,
  SCREEN_SKILLS,
  SCREEN_TITLES,
  SESSION_PLANS,
  SKILLS,
  advanceSession,
  compactActiveSnapshot,
  createSession,
  evaluateAction,
  evaluateContrast,
  evaluateCounterfactual,
  evaluateEvidence,
  evaluateLoop,
  evaluateModel,
  evaluatePredictions,
  evaluateReassurance,
  evaluateRetrieval,
  evaluateReturnSignal,
  evaluateScope,
  evaluateSort,
  evaluateSourceAudit,
  evaluateTest,
  evaluateTransfer,
  evaluateUpdate,
  markScreenResponse,
  mergeSessionIntoProgress,
  recordEvaluation,
  resolveCausalWorld,
  safePreferences,
  safeProgress,
  selectNextFamily,
  sessionSummary
} from "./engine.js?v=cbt-v2-1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const screen = $("#screen");
const sessionRail = $("#sessionRail");
const topActions = $("#topActions");
const referenceTray = $("#referenceTray");
const referenceButton = $("#referenceButton");
const timerText = $("#timerText");
const timerArc = $("#timerArc");
const timerButton = $("#timerButton");
const screenCount = $("#screenCount");
const toast = $("#toast");
const identity = $(".identity");
const RETURN_URL = "../../?return=machine-mind-model&focus=model";
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 18;

let preferences = safePreferences(readJSON(localStorage, PREFERENCES_KEY));
let progress = safeProgress(readJSON(localStorage, PROGRESS_KEY));
let session = null;
let selectedDuration = preferences.duration;
let activeMark = null;
let timerHandle = null;
let lastSnapshotSecond = -1;
let currentModal = null;
let focusBeforeModal = null;
let resumeAfterModal = false;
let toastHandle = null;
let audioContext = null;

const HELP = {
  "MF8-03": "Example: “The light is off” is visible. “The machine is broken” is an added explanation.",
  "MF8-04": "Keep exact source content in Shown. Put motives, identity judgments and future forecasts in Added.",
  "MF8-05": "Repair only the highlighted statement. Correct placements remain intact.",
  "MF8-06": "The target is not the smallest possible conclusion. It is the broadest conclusion the current evidence supports.",
  "MF8-07": "Select one node, then the node it leads to. Ask what information the action prevented Ari from learning.",
  "MF8-08": "A genuinely different model changes the cause and implies at least one different observation.",
  "MF8-09": "Build a cause that fits the marks, choose its supported scope, then identify what it cannot yet establish.",
  "MF8-10": "A useful prediction is visible and could differ between the models. Likely, Possible and Unlikely do not need to total 100%.",
  "MF8-11": "A clean test has a relevant source, one bounded action, an observable result and a stopping point.",
  "MF8-14": "Evidence can establish a local fact, change a claim’s weight, or leave a claim open. It cannot reveal unavailable private thoughts.",
  "MF8-15": "Preserve measured problems. Narrow conclusions that became too broad. Remove identity claims that no evidence measured.",
  "MF8-16": "Further checking is useful only when it could change the decision. Otherwise act on what is established and stop.",
  "MF8-19": "Keep the failed 38°C condition, avoid making it universal, and choose a test that distinguishes model failure from sensor error.",
  "MF8-20": "Prediction must come before result; the result can then change the model; action or stopping completes the cycle.",
  "MF12-22": "A counterfactual changes one condition. Preserve every fact that condition did not alter.",
  "MF12-23": "Three reports copied from one record are one evidential origin, not three independent confirmations.",
  "MF12-24": "Accuracy is symmetrical: do not erase supported bad news and do not accept comforting claims without evidence.",
  "MF12-25": "Compare the later result with the prediction locked earlier. Do not rewrite the earlier forecast."
};

function readJSON(storage, key) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function writeJSON(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStored(storage, key) {
  try { storage.removeItem(key); } catch { /* storage remains optional */ }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  })[character]);
}

function applyPreferences() {
  document.documentElement.style.setProperty("--text-scale", String(preferences.textScale / 100));
  document.body.dataset.motion = preferences.motion;
  document.body.dataset.contrast = preferences.contrast;
  document.body.dataset.timeDisplay = preferences.timeDisplay;
  writeJSON(localStorage, PREFERENCES_KEY, preferences);
  updateTimer();
}

function newSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function currentElapsed() {
  if (!session) return 0;
  return session.elapsedActiveMs + (activeMark === null ? 0 : performance.now() - activeMark);
}

function remainingSeconds() {
  if (!session) return selectedDuration * 60;
  return Math.max(0, session.duration * 60 - currentElapsed() / 1000);
}

function resumeClock() {
  if (!session || session.completed || activeMark !== null) return;
  session.paused = false;
  activeMark = performance.now();
  ensureTimer();
  updateTimer();
}

function pauseClock() {
  if (!session) return;
  if (activeMark !== null) {
    session.elapsedActiveMs += performance.now() - activeMark;
    activeMark = null;
  }
  session.paused = true;
  saveActiveSession();
  updateTimer();
}

function stopClock() {
  pauseClock();
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function ensureTimer() {
  if (timerHandle) return;
  timerHandle = window.setInterval(() => {
    updateTimer();
    const second = Math.floor(currentElapsed() / 1000);
    if (second !== lastSnapshotSecond && second % 5 === 0) {
      lastSnapshotSecond = second;
      saveActiveSession();
    }
  }, 500);
}

function updateTimer() {
  if (!timerText || !timerArc) return;
  const total = (session?.duration || selectedDuration) * 60;
  const remaining = session ? remainingSeconds() : total;
  const ratio = Math.max(0, Math.min(1, remaining / total));
  timerArc.style.strokeDasharray = String(TIMER_CIRCUMFERENCE);
  timerArc.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - ratio));

  if (!session) {
    timerText.textContent = `${selectedDuration} min`;
    return;
  }
  if (preferences.pacing === "pace") {
    timerText.textContent = "Pace";
    timerArc.style.strokeDashoffset = "0";
    return;
  }
  if (remaining <= 0) {
    timerText.textContent = "Finish step";
    timerButton.setAttribute("aria-label", "Nominal time complete. Finish this step; nothing will be submitted automatically.");
    return;
  }
  if (preferences.timeDisplay === "hidden") {
    timerText.textContent = "Hidden";
    timerArc.style.opacity = "0";
    timerButton.setAttribute("aria-label", "Time hidden. Activate to change the time display.");
    return;
  }
  timerArc.style.opacity = "1";
  if (preferences.timeDisplay === "exact") {
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    timerText.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  } else {
    timerText.textContent = remaining < 60 ? "<1 min" : `${Math.ceil(remaining / 60)} min`;
  }
  timerButton.setAttribute("aria-label", `${Math.ceil(remaining)} seconds in the selected practice envelope. Activate to change the time display.`);
}

function saveActiveSession() {
  if (!session || session.completed) return true;
  const snapshot = compactActiveSnapshot({ ...session, elapsedActiveMs: currentElapsed() });
  return writeJSON(sessionStorage, ACTIVE_SESSION_KEY, snapshot);
}

function loadActiveSession() {
  let candidate = readJSON(sessionStorage, ACTIVE_SESSION_KEY);
  if (candidate.version !== CBT_VERSION) {
    candidate = readJSON(localStorage, RESUME_SNAPSHOT_KEY);
    if (candidate.expiresAt && Date.parse(candidate.expiresAt) <= Date.now()) {
      removeStored(localStorage, RESUME_SNAPSHOT_KEY);
      return null;
    }
  }
  if (candidate.version !== CBT_VERSION || !Array.isArray(candidate.plan) || !SCREEN_TITLES[candidate.screenId]) return null;
  return candidate;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastHandle);
  toastHandle = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function cue(success = true) {
  if (!preferences.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = success ? 520 : 330;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.17);
  } catch { /* sound is optional */ }
}

function screenHeader(kicker, title, lead) {
  const skill = session ? SCREEN_SKILLS[session.screenId] : null;
  const assistance = skill ? session.assistance?.[skill] || 1 : 1;
  const displayKicker = assistance >= 4 && kicker.includes(" · ") ? kicker.split(" · ")[0] : kicker;
  return `<header class="screen-header"><p class="screen-kicker">${escapeHTML(displayKicker)}</p><h2 class="screen-title" tabindex="-1">${escapeHTML(title)}</h2>${lead ? `<p class="screen-lead">${lead}</p>` : ""}</header>`;
}

function setScreen(content, { help = "", focus = true } = {}) {
  screen.innerHTML = content;
  screen.dataset.help = help;
  if (focus) requestAnimationFrame(() => ($("h2", screen) || screen).focus({ preventScroll: true }));
}

function setInteractiveShell(active) {
  sessionRail.hidden = !active;
  topActions.hidden = !active;
  identity.classList.toggle("is-compact", active);
  document.body.dataset.session = active ? "active" : "opening";
}

function updateSessionRail() {
  if (!session) return;
  const item = session.plan[session.cursor];
  const phases = ["trace", "test", "update", "transfer"];
  const currentIndex = phases.indexOf(item?.phase);
  $$('[data-phase]', sessionRail).forEach((node) => {
    const index = phases.indexOf(node.dataset.phase);
    node.classList.toggle("is-active", index === currentIndex);
    node.classList.toggle("is-complete", currentIndex > index || item?.phase === "close");
  });
  screenCount.textContent = `${session.cursor + 1} of ${session.plan.length}`;
  updateTimer();
}

function beginSession() {
  preferences = safePreferences({ ...preferences, duration: selectedDuration });
  applyPreferences();
  session = createSession(preferences, newSessionId(), progress);
  setInteractiveShell(true);
  referenceTray.hidden = true;
  renderCurrent();
  window.setTimeout(resumeClock, preferences.motion === "standard" ? 160 : 0);
}

function resumeSession(snapshot) {
  session = snapshot;
  session.preferences = safePreferences(snapshot.preferences);
  preferences = session.preferences;
  selectedDuration = session.duration;
  removeStored(localStorage, RESUME_SNAPSHOT_KEY);
  applyPreferences();
  setInteractiveShell(true);
  renderCurrent();
  resumeClock();
}

function renderOpening() {
  stopClock();
  session = null;
  setInteractiveShell(false);
  referenceTray.hidden = true;
  const resumable = loadActiveSession();
  const nextFamily = progress.enabled ? selectNextFamily(progress, preferences.intensity) : null;
  setScreen(`
    ${screenHeader("Choose a complete practice cycle", "Practice the next move", "Time shapes the amount of practice—not correctness. Every session uses a fictional case, includes a changed-context check, and can be paused or hidden.")}
    <div class="opening-mark" aria-hidden="true"></div>
    <div class="opening-method"><span>Trace</span><i></i><span>Test</span><i></i><span>Update</span><i></i><span>Act or stop</span></div>
    ${resumable ? `<div class="feedback"><div><strong>Paused practice available</strong><p>${escapeHTML(GOLD.title)} · ${resumable.duration}-minute plan · answers remain hidden until you resume.</p></div></div>
      <div class="button-row"><button class="primary-button" id="resumeSession">Resume practice</button><button class="text-button" id="forgetSession">Forget paused practice</button></div>` : ""}
    <div class="duration-grid" role="radiogroup" aria-label="Choose session length">
      <button class="duration-card" type="button" role="radio" data-duration="4" aria-checked="${selectedDuration === 4}"><small>Focus</small><strong>4 min</strong><p>One narrow but complete trace, test, update and transfer cycle.</p></button>
      <button class="duration-card" type="button" role="radio" data-duration="8" aria-checked="${selectedDuration === 8}"><small>Complete cycle</small><strong>8 min</strong><p>The gold-standard session with contrast, transfer and retrieval.</p></button>
      <button class="duration-card" type="button" role="radio" data-duration="12" aria-checked="${selectedDuration === 12}"><small>Deep practice</small><strong>12 min</strong><p>Adds counterfactuals, source audit and an unannounced return.</p></button>
    </div>
    ${nextFamily ? `<p class="screen-lead">Local next target: <strong>${escapeHTML(SKILLS[progress.nextTarget] || SKILLS.source)}</strong> through ${escapeHTML(nextFamily.title)}. Nothing has left this device.</p>` : ""}
    <div class="button-row"><button class="primary-button" id="beginButton">Begin fictional practice</button><button class="secondary-button" id="settingsButton">Settings</button><a class="text-button centred" href="${RETURN_URL}">Return to Mind</a></div>
    <details class="theory-details"><summary>How this CBT exercise works</summary><p>Keep the event separate from the claim added to it. Turn competing explanations into observable predictions. Run a bounded test, update only what the result changes, then choose a useful action—or stop checking.</p></details>
    <details class="theory-details"><summary>Privacy and saved data</summary><p>This page has no account, analytics, external model, camera, microphone or personal-text field. Display preferences stay in this browser. A paused attempt stays in this tab’s session storage. Skill progress is saved locally only after you opt in, and can be erased in Settings.</p></details>
  `, { focus: false });

  $$('[data-duration]', screen).forEach((button) => {
    button.addEventListener("click", () => {
      selectedDuration = Number(button.dataset.duration);
      $$('[data-duration]', screen).forEach((candidate) => candidate.setAttribute("aria-checked", String(candidate === button)));
      updateTimer();
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const durations = [4, 8, 12];
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      const index = (durations.indexOf(selectedDuration) + direction + durations.length) % durations.length;
      const next = $(`[data-duration="${durations[index]}"]`, screen);
      next.click();
      next.focus();
    });
  });
  $("#beginButton")?.addEventListener("click", beginSession);
  $("#settingsButton")?.addEventListener("click", () => openSettings());
  $("#resumeSession")?.addEventListener("click", () => resumeSession(resumable));
  $("#forgetSession")?.addEventListener("click", () => { removeStored(sessionStorage, ACTIVE_SESSION_KEY); removeStored(localStorage, RESUME_SNAPSHOT_KEY); renderOpening(); });
}

function renderCurrent() {
  if (!session) return renderOpening();
  const item = session.plan[session.cursor];
  if (!item) return renderCompletion();
  session.screenId = item.id;
  setInteractiveShell(true);
  updateSessionRail();
  const renderer = renderers[item.id];
  if (!renderer) throw new Error(`No CBT screen renderer for ${item.id}`);
  renderer();
  saveActiveSession();
}

function advance() {
  if (!session) return;
  if (session.cursor >= session.plan.length - 1) return renderCompletion();
  advanceSession(session, remainingSeconds());
  cue(true);
  renderCurrent();
}

function lockAnswers() {
  $$('[data-answer], .task-surface button, .task-surface select, .task-surface input', screen).forEach((control) => { control.disabled = true; });
}

function feedbackHTML(kind, title, message) {
  return `<div class="feedback ${kind === "success" ? "is-success" : kind === "repair" ? "is-repair" : ""}"><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div></div>`;
}

function presentEvaluation(evaluation, response, options = {}) {
  const screenId = options.screenId || session.screenId;
  markScreenResponse(session, screenId, response);
  const supportUsed = Boolean(session.supportUsed[screenId]);
  const record = recordEvaluation(session, screenId, evaluation, supportUsed);
  const feedbackArea = $("#feedbackArea");
  if (!feedbackArea) return;

  if (evaluation.pass) {
    lockAnswers();
    feedbackArea.innerHTML = `${feedbackHTML("success", record.repaired ? "Repaired" : "Evidence aligned", evaluation.success)}<div class="button-row"><button class="primary-button" id="continueAfterFeedback">Continue</button></div>`;
    $("#continueAfterFeedback").addEventListener("click", options.onSuccess || advance);
    cue(true);
    saveActiveSession();
    return;
  }

  options.markDefects?.(evaluation.defects);
  if (record.demonstrated) {
    const demonstratedResponse = options.demonstrate?.();
    if (demonstratedResponse !== undefined) markScreenResponse(session, screenId, demonstratedResponse);
    lockAnswers();
    feedbackArea.innerHTML = `${feedbackHTML("", "Watch the distinction once", `${evaluation.repair} The completed operation is recorded as supported, not independent.`)}<div class="button-row"><button class="primary-button" id="continueAfterFeedback">Continue</button></div>`;
    $("#continueAfterFeedback").addEventListener("click", options.onSuccess || advance);
  } else {
    feedbackArea.innerHTML = feedbackHTML("repair", "Change one thing", evaluation.repair);
    cue(false);
  }
  saveActiveSession();
}

function renderArrival() {
  setScreen(`
    ${screenHeader("A fictional practice case", GOLD.title, "Inspect the review. No personal response or disclosure is requested.")}
    <div class="scene-panel task-surface">
      <div class="scene-panel-top"><span>Prototype P-17 · Review surface</span><b>Two marks</b></div>
      <div class="prototype-visual" aria-label="Prototype diagram with two components marked for review">
        <div class="prototype-body"><span class="marked-part marked-a"></span><span class="marked-part marked-b"></span></div>
        <span class="prototype-caption">Two components are marked with neutral review outlines</span>
      </div>
    </div>
    <div class="button-row"><button class="primary-button" id="inspectButton">Inspect the review</button></div>
  `);
  $("#inspectButton").addEventListener("click", advance);
}

function renderObserve() {
  setScreen(`
    ${screenHeader("Trace · Source first", "What is present in the scene?", "The source material and Ari’s first conclusion are separate objects. The conclusion may be understandable without being established.")}
    <div class="source-grid task-surface">
      ${GOLD.sourceObjects.map((source) => `<article class="source-card"><small>${escapeHTML(source.label)}</small><strong>${escapeHTML(source.text)}</strong></article>`).join("")}
    </div>
    <div class="interpretation-card"><small>Ari’s first conclusion</small><p>“${escapeHTML(GOLD.interpretation)}”</p></div>
    <div class="button-row"><button class="primary-button" id="observeContinue">Continue</button></div>
  `);
  $("#observeContinue").addEventListener("click", advance);
}

function renderPrivatePass() {
  setScreen(`
    ${screenHeader("Trace · Private rehearsal", "Keep only what is present", "Take the time you need. Think privately; the exercise never asks what passed through your mind.")}
    <div class="private-prompt task-surface"><div class="breath-mark" aria-hidden="true"></div><p>What did the source actually show?</p><span>Ready is available immediately. Waiting is not scored.</span></div>
    <div class="button-row"><button class="primary-button" id="privateReady">Ready</button><button class="secondary-button" id="privateHelp">Show a neutral example</button></div>
  `, { help: HELP["MF8-03"] });
  $("#privateReady").addEventListener("click", advance);
  $("#privateHelp").addEventListener("click", openHelp);
}

function renderSort() {
  const placements = { ...(session.responses["MF8-04"]?.placements || {}) };
  const defects = new Set(session.responses["MF8-04"]?.defects || []);
  let selected = null;
  setScreen(`
    ${screenHeader("Trace · Sort", "Separate what is shown from what is added", "Move every statement. Drag, tap a statement then a destination, or use Enter. Nothing is judged until Commit.")}
    <div class="sort-layout task-surface">
      <div class="card-tray" id="cardTray" aria-label="Unplaced statements"></div>
      <div class="bins">
        <div class="bin" data-bin="shown" role="button" tabindex="0" aria-label="Shown: place the selected statement here"><h3>Shown</h3><p>Visible in a supplied source</p><div class="bin-items" id="shownItems"></div></div>
        <div class="bin" data-bin="added" role="button" tabindex="0" aria-label="Added: place the selected statement here"><h3>Added</h3><p>Interpretation, motive, identity or forecast</p><div class="bin-items" id="addedItems"></div></div>
      </div>
    </div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="secondary-button" id="sortUndo">Undo last move</button><button class="primary-button" id="sortCommit">Commit placement</button></div>
  `, { help: HELP["MF8-04"] });
  const history = [];

  const place = (id, zone) => {
    if (!id) return;
    history.push({ id, from: placements[id] || null });
    placements[id] = zone;
    selected = null;
    defects.delete(id);
    refresh();
  };

  const refresh = () => {
    $("#cardTray").innerHTML = GOLD.sortCards.filter((card) => !placements[card.id]).map((card) => `<button class="statement-card ${selected === card.id ? "is-selected" : ""} ${defects.has(card.id) ? "has-defect" : ""}" type="button" draggable="true" data-card="${card.id}" aria-pressed="${selected === card.id}" aria-label="${escapeHTML(card.text)}. Select, or press Left Arrow for Shown and Right Arrow for Added.">${escapeHTML(card.text)}</button>`).join("");
    for (const zone of ["shown", "added"]) {
      $(`#${zone}Items`).innerHTML = GOLD.sortCards.filter((card) => placements[card.id] === zone).map((card) => `<div class="placed-statement ${defects.has(card.id) ? "has-defect" : ""}">${escapeHTML(card.text)}<button type="button" data-remove="${card.id}" aria-label="Return ${escapeHTML(card.text)} to the tray">×</button></div>`).join("");
    }
    $("#sortCommit").disabled = Object.keys(placements).length !== GOLD.sortCards.length;
    $$('[data-card]', screen).forEach((card) => {
      card.addEventListener("click", () => {
        selected = selected === card.dataset.card ? null : card.dataset.card;
        refresh();
      });
      card.addEventListener("keydown", (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        place(card.dataset.card, event.key === 'ArrowLeft' ? 'shown' : 'added');
      });
      card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", card.dataset.card));
    });
    $$('[data-remove]', screen).forEach((button) => button.addEventListener("click", () => {
      history.push({ id: button.dataset.remove, from: placements[button.dataset.remove] });
      delete placements[button.dataset.remove];
      defects.delete(button.dataset.remove);
      refresh();
    }));
  };
  refresh();
  $$('[data-bin]', screen).forEach((bin) => {
    bin.addEventListener("click", () => place(selected, bin.dataset.bin));
    bin.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); place(selected, bin.dataset.bin); } });
    bin.addEventListener("dragover", (event) => { event.preventDefault(); bin.classList.add("dragover"); });
    bin.addEventListener("dragleave", () => bin.classList.remove("dragover"));
    bin.addEventListener("drop", (event) => { event.preventDefault(); bin.classList.remove("dragover"); place(event.dataTransfer.getData("text/plain"), bin.dataset.bin); });
  });
  $("#sortUndo").addEventListener("click", () => {
    const move = history.pop();
    if (!move) return showToast("Nothing to undo");
    if (move.from) placements[move.id] = move.from; else delete placements[move.id];
    refresh();
  });
  $("#sortCommit").addEventListener("click", () => {
    const evaluation = evaluateSort(placements);
    const hasInspectionScreen = session.plan.some((item) => item.id === "MF8-05");
    session.responses["MF8-04"] = { placements: { ...placements }, defects: evaluation.defects };
    if (hasInspectionScreen) {
      recordEvaluation(session, "MF8-04", evaluation, Boolean(session.supportUsed["MF8-04"]));
      advance();
      return;
    }
    presentEvaluation(evaluation, { placements: { ...placements } }, {
      markDefects: (ids) => { ids.forEach((id) => defects.add(id)); refresh(); },
      demonstrate: () => { GOLD.sortCards.forEach((card) => { placements[card.id] = card.target; }); refresh(); return { placements: { ...placements } }; }
    });
  });
}

function renderSortInspection() {
  const stored = session.responses["MF8-04"] || { placements: {} };
  const placements = { ...stored.placements };
  let evaluation = evaluateSort(placements);
  const defects = () => GOLD.sortCards.filter((card) => placements[card.id] !== card.target);
  const inspectionBody = () => evaluation.pass
    ? `<div class="feedback is-success"><div><strong>Source preserved</strong><p>A conclusion can be plausible without being shown. The request may matter; the wider judgment is not contained in it.</p></div></div>`
    : `<div class="mapping-grid task-surface">${defects().map((card) => `<div class="mapping-row has-defect"><span>${escapeHTML(card.text)}</span><div class="compact-options"><button type="button" data-repair="${card.id}:shown">Shown</button><button type="button" data-repair="${card.id}:added">Added</button></div></div>`).join("")}</div>`;
  setScreen(`
    ${screenHeader("Trace · Inspect", evaluation.pass ? "A conclusion may be plausible without being shown" : "Change only what the source does not establish", evaluation.pass ? "You kept the visible review separate from the conclusions built around it." : "Correct placements are preserved. Repair only the highlighted statement.")}
    <div id="inspectionSurface">${inspectionBody()}</div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="inspectionContinue">${evaluation.pass ? "Continue" : "Commit repair"}</button></div>
  `, { help: HELP["MF8-05"] });
  $$('[data-repair]', screen).forEach((button) => button.addEventListener("click", () => {
    const [id, zone] = button.dataset.repair.split(":");
    placements[id] = zone;
    button.closest(".mapping-row").querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
  }));
  $("#inspectionContinue").addEventListener("click", () => {
    if (evaluation.pass) return advance();
    evaluation = evaluateSort(placements);
    session.responses["MF8-04"] = { placements: { ...placements }, defects: evaluation.defects };
    presentEvaluation(evaluation, { placements: { ...placements } }, {
      screenId: "MF8-04",
      demonstrate: () => { GOLD.sortCards.forEach((card) => { placements[card.id] = card.target; }); return { placements: { ...placements } }; },
      onSuccess: advance
    });
  });
}

function renderScope() {
  const assistance = session.assistance?.scope || 1;
  let selected = Number(session.responses["MF8-06"]?.selected ?? (assistance >= 3 ? -1 : 2));
  setScreen(`
    ${screenHeader("Trace · Scope", "How far does the current evidence reach?", "Select the broadest conclusion supported now. A wider concern can remain possible without being treated as established.")}
    <div class="scope-surface task-surface"><div class="scope-bands" role="radiogroup" aria-label="Conclusion scope"></div><div class="scope-controls"><button type="button" id="scopeIn" aria-label="Move scope inward">−</button><button type="button" id="scopeOut" aria-label="Move scope outward">+</button></div></div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="scopeCommit">Commit boundary</button></div>
  `, { help: HELP["MF8-06"] });
  const refresh = () => {
    $(".scope-bands").innerHTML = GOLD.scopeBands.map((band, index) => `<button class="scope-band" type="button" role="radio" data-scope="${index}" aria-checked="${selected === index}"><span class="scope-index">${index + 1}</span><strong>${escapeHTML(band)}</strong><small>${index === 0 ? "Event" : index === 1 ? "Task" : index === 2 ? "Ability" : index === 3 ? "Identity" : "Future"}</small></button>`).join("");
    $("#scopeCommit").disabled = selected < 0;
    $$('[data-scope]', screen).forEach((button) => {
      button.addEventListener("click", () => { selected = Number(button.dataset.scope); refresh(); });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        selected = Math.max(0, Math.min(GOLD.scopeBands.length - 1, selected + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1)));
        refresh();
        $(`[data-scope="${selected}"]`, screen)?.focus();
      });
    });
  };
  refresh();
  $("#scopeIn").addEventListener("click", () => { selected = Math.max(0, selected - 1); refresh(); });
  $("#scopeOut").addEventListener("click", () => { selected = Math.min(GOLD.scopeBands.length - 1, selected + 1); refresh(); });
  $("#scopeCommit").addEventListener("click", () => presentEvaluation(evaluateScope(selected), { selected }, {
    markDefects: () => $(`[data-scope="${selected}"]`, screen)?.classList.add("has-defect"),
    demonstrate: () => { selected = 0; refresh(); return { selected }; }
  }));
}

function renderLoop() {
  const response = session.responses["MF8-07"] || {};
  const links = [...(response.links || [])];
  let selectedNode = null;
  let missingInformation = response.missingInformation || "";
  setScreen(`
    ${screenHeader("Trace · Link", "Build the cognitive–behavioural loop", "Select one node, then what it leads to. The supplied feeling is not being judged; the task is to trace what follows.")}
    <div class="link-surface task-surface">
      <div class="node-grid">${GOLD.loopNodes.map((node) => `<button class="causal-node" type="button" data-node="${node.id}" aria-pressed="false"><small>${escapeHTML(node.label)}</small><strong>${escapeHTML(node.text)}</strong></button>`).join("")}</div>
      <div class="connection-list" id="connectionList" aria-live="polite"></div>
      <fieldset class="missing-info"><legend>What information did Ari’s response prevent?</legend><div class="compact-options"><button type="button" data-missing="approval">Whether everyone approves of Ari</button><button type="button" data-missing="specific-reason">The specific reason for the marks</button><button type="button" data-missing="future">Ari’s entire future</button></div></fieldset>
    </div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="loopCommit">Commit the loop</button></div>
  `, { help: HELP["MF8-07"] });

  const refresh = () => {
    $$('[data-node]', screen).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.node === selectedNode));
      button.classList.toggle("is-used", links.some((link) => link.includes(button.dataset.node)));
    });
    const list = $("#connectionList");
    list.innerHTML = links.length ? links.map((link) => {
      const [from, to] = link.split(">");
      const fromNode = GOLD.loopNodes.find((node) => node.id === from);
      const toNode = GOLD.loopNodes.find((node) => node.id === to);
      return `<span class="connection-chip">${escapeHTML(fromNode?.label || from)} → ${escapeHTML(toNode?.label || to)}<button type="button" data-remove-link="${link}" aria-label="Remove ${escapeHTML(fromNode?.label || from)} to ${escapeHTML(toNode?.label || to)}">×</button></span>`;
    }).join("") : "<p>No links yet. Select a source node, then a destination node.</p>";
    $$('[data-remove-link]', list).forEach((button) => button.addEventListener("click", () => {
      links.splice(links.indexOf(button.dataset.removeLink), 1);
      refresh();
    }));
    $$('[data-missing]', screen).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.missing === missingInformation)));
  };
  $$('[data-node]', screen).forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.node;
    if (!selectedNode) selectedNode = id;
    else if (selectedNode === id) selectedNode = null;
    else {
      const link = `${selectedNode}>${id}`;
      if (!links.includes(link)) links.push(link);
      selectedNode = null;
    }
    refresh();
  }));
  $$('[data-missing]', screen).forEach((button) => button.addEventListener("click", () => { missingInformation = button.dataset.missing; refresh(); }));
  refresh();
  $("#loopCommit").addEventListener("click", () => presentEvaluation(evaluateLoop(links, missingInformation), { links: [...links], missingInformation }, {
    demonstrate: () => { links.splice(0, links.length, ...GOLD.loopLinks); missingInformation = "specific-reason"; refresh(); return { links: [...links], missingInformation }; }
  }));
}

function renderPrivateModel() {
  setScreen(`
    ${screenHeader("Test · Private rehearsal", "Form another explanation", "Create a different cause that could fit the same marks. It does not need to be comforting.")}
    <div class="private-prompt task-surface"><div class="breath-mark" aria-hidden="true"></div><p>What other mechanism could produce the same review?</p><span>A different wording is not yet a different model.</span></div>
    <div class="button-row"><button class="primary-button" id="modelReady">Ready</button><button class="secondary-button" id="modelHelp">What counts as different?</button></div>
  `, { help: HELP["MF8-08"] });
  $("#modelReady").addEventListener("click", advance);
  $("#modelHelp").addEventListener("click", openHelp);
}

function renderModelBuilder() {
  const model = { cause: "", scope: "", unknowns: [], ...(session.responses["MF8-09"] || {}) };
  setScreen(`
    ${screenHeader("Test · Model", "Construct a distinct explanation", "Choose a causal mechanism, its current scope, and at least one question the evidence leaves unresolved.")}
    <div class="builder task-surface">
      <div class="builder-row"><span class="builder-label">Cause</span><div class="segment-grid">${GOLD.causes.map((item) => `<button class="segment" type="button" data-model-cause="${item.id}">${escapeHTML(item.text)}</button>`).join("")}</div></div>
      <div class="builder-row"><span class="builder-label">Scope</span><div class="segment-grid">${GOLD.modelScopes.map((item) => `<button class="segment" type="button" data-model-scope="${item.id}">${escapeHTML(item.text)}</button>`).join("")}</div></div>
      <div class="builder-row"><span class="builder-label">Still unresolved</span><div class="segment-grid">${GOLD.unknowns.map((item) => `<button class="segment" type="button" data-model-unknown="${item.id}">${escapeHTML(item.text)}</button>`).join("")}</div></div>
    </div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="modelCommit">Commit model</button></div>
  `, { help: HELP["MF8-09"] });
  const refresh = () => {
    $$('[data-model-cause]', screen).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.modelCause === model.cause)));
    $$('[data-model-scope]', screen).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.modelScope === model.scope)));
    $$('[data-model-unknown]', screen).forEach((button) => button.setAttribute("aria-pressed", String(model.unknowns.includes(button.dataset.modelUnknown))));
    $("#modelCommit").disabled = !model.cause || !model.scope || model.unknowns.length === 0;
  };
  $$('[data-model-cause]', screen).forEach((button) => button.addEventListener("click", () => { model.cause = button.dataset.modelCause; refresh(); }));
  $$('[data-model-scope]', screen).forEach((button) => button.addEventListener("click", () => { model.scope = button.dataset.modelScope; refresh(); }));
  $$('[data-model-unknown]', screen).forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.modelUnknown;
    model.unknowns = model.unknowns.includes(id) ? model.unknowns.filter((value) => value !== id) : [...model.unknowns, id];
    refresh();
  }));
  refresh();
  $("#modelCommit").addEventListener("click", () => presentEvaluation(evaluateModel(model), { ...model }, {
    demonstrate: () => { model.cause = "threshold"; model.scope = "parts"; model.unknowns = ["reviewer-opinion"]; refresh(); return { ...model }; }
  }));
}

function renderPredictions() {
  const forecasts = structuredCloneSafe(session.responses["MF8-10"] || {});
  setScreen(`
    ${screenHeader("Test · Predict", "Make the models risk different observations", "Attach each possible observation to the model that would expect it more strongly, then choose a coarse confidence band.")}
    <div class="forecast-table task-surface">
      ${GOLD.forecasts.map((forecast) => `<div class="forecast-row" data-forecast-row="${forecast.id}"><strong>${escapeHTML(forecast.text)}</strong><div class="compact-options" aria-label="Model"><button type="button" data-forecast-target="${forecast.id}:original">Original broad model</button><button type="button" data-forecast-target="${forecast.id}:alternate">Constructed local model</button></div><div class="compact-options" aria-label="Confidence"><button type="button" data-forecast-band="${forecast.id}:likely">Likely</button><button type="button" data-forecast-band="${forecast.id}:possible">Possible</button><button type="button" data-forecast-band="${forecast.id}:unlikely">Unlikely</button></div></div>`).join("")}
    </div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="predictionCommit">Lock forecasts</button></div>
  `, { help: HELP["MF8-10"] });
  const refresh = () => {
    $$('[data-forecast-target]', screen).forEach((button) => { const [id,value] = button.dataset.forecastTarget.split(":"); button.setAttribute("aria-pressed", String(forecasts[id]?.target === value)); });
    $$('[data-forecast-band]', screen).forEach((button) => { const [id,value] = button.dataset.forecastBand.split(":"); button.setAttribute("aria-pressed", String(forecasts[id]?.band === value)); });
    $("#predictionCommit").disabled = GOLD.forecasts.some((item) => !forecasts[item.id]?.target || !forecasts[item.id]?.band);
  };
  $$('[data-forecast-target]', screen).forEach((button) => button.addEventListener("click", () => { const [id,value] = button.dataset.forecastTarget.split(":"); forecasts[id] = { ...(forecasts[id] || {}), target:value }; refresh(); }));
  $$('[data-forecast-band]', screen).forEach((button) => button.addEventListener("click", () => { const [id,value] = button.dataset.forecastBand.split(":"); forecasts[id] = { ...(forecasts[id] || {}), band:value }; refresh(); }));
  refresh();
  $("#predictionCommit").addEventListener("click", () => presentEvaluation(evaluatePredictions(forecasts), forecasts, {
    demonstrate: () => { GOLD.forecasts.forEach((item) => { forecasts[item.id] = { target:item.target, band:item.band }; }); refresh(); return structuredCloneSafe(forecasts); }
  }));
}

function structuredCloneSafe(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
}

function renderTestBuilder() {
  const test = { ...(session.responses["MF8-11"] || {}) };
  const labels = { source: "Source", action: "Action", result: "Observable result", stop: "Stop point" };
  setScreen(`
    ${screenHeader("Test · Experiment", "Build one useful, bounded test", "The test should obtain decision-relevant information without manufacturing the result or checking forever.")}
    <div class="test-instrument task-surface">
      ${Object.entries(GOLD.testSlots).map(([slot, options]) => `<div class="test-slot"><h3>${labels[slot]}</h3><select id="test-${slot}" aria-label="${labels[slot]}"><option value="">Choose…</option>${options.map((option) => `<option value="${option.id}">${escapeHTML(option.text)}</option>`).join("")}</select></div>`).join("")}
    </div>
    <p class="instrument-line">Source → one action → one observable difference → one stopping point</p>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="testCommit">Commit test</button></div>
  `, { help: HELP["MF8-11"] });
  for (const slot of Object.keys(GOLD.testSlots)) {
    const select = $(`#test-${slot}`);
    select.value = test[slot] || "";
    select.addEventListener("change", () => { test[slot] = select.value; refresh(); });
  }
  const refresh = () => { $("#testCommit").disabled = Object.keys(GOLD.testSlots).some((slot) => !test[slot]); };
  refresh();
  $("#testCommit").addEventListener("click", () => presentEvaluation(evaluateTest(test), { ...test }, {
    markDefects: (ids) => ids.forEach((id) => $(`#test-${id}`)?.classList.add("has-defect")),
    demonstrate: () => {
      Object.assign(test, { source:"reviewer", action:"ask-criteria", result:"specific-scope", stop:"one-answer" });
      for (const slot of Object.keys(GOLD.testSlots)) $(`#test-${slot}`).value = test[slot];
      return { ...test };
    }
  }));
}

function selectedTestText() {
  const test = session.responses["MF8-11"] || {};
  const find = (slot) => GOLD.testSlots[slot].find((item) => item.id === test[slot])?.text || "Not selected";
  return { source:find("source"), action:find("action"), result:find("result"), stop:find("stop") };
}

function renderLock() {
  const test = selectedTestText();
  setScreen(`
    ${screenHeader("Test · Precommitment", "Lock the expectation before the result", "Your forecast remains inspectable after the reveal. Going back once is allowed and is not an error.")}
    <div class="lock-panel task-surface"><dl><dt>Source</dt><dd>${escapeHTML(test.source)}</dd><dt>Action</dt><dd>${escapeHTML(test.action)}</dd><dt>Observable result</dt><dd>${escapeHTML(test.result)}</dd><dt>Stopping point</dt><dd>${escapeHTML(test.stop)}</dd></dl></div>
    <div class="button-row"><button class="secondary-button" id="backToTest">Review test</button><button class="primary-button" id="lockRun">Lock and run</button></div>
  `, { help: HELP["MF8-12"] });
  $("#backToTest").addEventListener("click", () => {
    const index = session.plan.findIndex((item) => item.id === "MF8-11");
    if (index >= 0) { session.cursor = index; session.screenId = "MF8-11"; renderCurrent(); }
  });
  $("#lockRun").addEventListener("click", () => {
    session.responses["MF8-12"] = { locked:true, variantId:session.variantId, lockId:session.worldLock.lockId };
    advance();
  });
}

function renderResult() {
  const resolution = resolveCausalWorld(session.worldLock, session.responses["MF8-11"]);
  if (!resolution.evidenceAvailable) {
    setScreen(`
      ${screenHeader("Test · Repair required", "The result remains sealed", "A consequence is revealed only after a relevant, bounded test is complete. Return to the test and repair the highlighted component.")}
      <div class="button-row"><button class="primary-button" id="repairTest">Return to the test</button></div>
    `);
    $("#repairTest").addEventListener("click", () => {
      session.cursor = session.plan.findIndex((item) => item.id === "MF8-11");
      renderCurrent();
    });
    return;
  }
  setScreen(`
    ${screenHeader("Update · Authored result", "What the test reveals", "The result was locked before your choice. Read the evidence before evaluating any conclusion.")}
    <div class="result-panel task-surface"><div class="result-panel-header">Result · Prototype P-17 · Locked world</div><ul class="result-list">${resolution.consequence.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></div>
    <div class="button-row"><button class="primary-button" id="examineResult">Examine the evidence</button></div>
  `);
  $("#examineResult").addEventListener("click", advance);
}

function renderEvidenceMap() {
  const mapping = { ...(session.responses["MF8-14"] || {}) };
  setScreen(`
    ${screenHeader("Update · Evidence", "What does each result change?", "Classify the reach of each item. Direct facts may settle local causes while other claims remain open.")}
    <div class="mapping-grid task-surface">${GOLD.evidenceRows.map((row) => `<div class="mapping-row" data-map-row="${row.id}"><span>${escapeHTML(row.text)}</span><div class="compact-options"><button type="button" data-map="${row.id}:establishes">Establishes</button><button type="button" data-map="${row.id}:changes">Changes weight</button><button type="button" data-map="${row.id}:open">Leaves open</button></div></div>`).join("")}</div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="evidenceCommit">Commit evidence map</button></div>
  `, { help: HELP["MF8-14"] });
  const refresh = () => {
    $$('[data-map]', screen).forEach((button) => { const [id,value] = button.dataset.map.split(":"); button.setAttribute("aria-pressed", String(mapping[id] === value)); });
    $("#evidenceCommit").disabled = GOLD.evidenceRows.some((row) => !mapping[row.id]);
  };
  $$('[data-map]', screen).forEach((button) => button.addEventListener("click", () => { const [id,value] = button.dataset.map.split(":"); mapping[id] = value; refresh(); }));
  refresh();
  $("#evidenceCommit").addEventListener("click", () => presentEvaluation(evaluateEvidence(mapping), mapping, {
    markDefects: (ids) => ids.forEach((id) => $(`[data-map-row="${id}"]`, screen)?.classList.add("has-defect")),
    demonstrate: () => { GOLD.evidenceRows.forEach((row) => { mapping[row.id] = row.target; }); refresh(); return { ...mapping }; }
  }));
}

function renderUpdate() {
  const updates = { ...(session.responses["MF8-15"] || {}) };
  const choices = [
    ["keep", "Keep"], ["narrow", "Narrow"], ["open", "Leave open"], ["remove", "Remove"]
  ];
  setScreen(`
    ${screenHeader("Update · Selective revision", "Change only what the result changes", "Keep the measured problems. Adjust each remaining claim independently; the original state stays visible for comparison.")}
    <div class="update-grid task-surface">${GOLD.updateClaims.map((claim) => `<div class="update-row" data-update-row="${claim.id}"><span>${escapeHTML(claim.text)}</span><div class="compact-options">${choices.map(([value,label]) => `<button type="button" data-update="${claim.id}:${value}">${label}</button>`).join("")}</div></div>`).join("")}</div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="updateCommit">Commit revised model</button></div>
  `, { help: HELP["MF8-15"] });
  const refresh = () => {
    $$('[data-update]', screen).forEach((button) => { const [id,value] = button.dataset.update.split(":"); button.setAttribute("aria-pressed", String(updates[id] === value)); });
    $("#updateCommit").disabled = GOLD.updateClaims.some((claim) => !updates[claim.id]);
  };
  $$('[data-update]', screen).forEach((button) => button.addEventListener("click", () => { const [id,value] = button.dataset.update.split(":"); updates[id] = value; refresh(); }));
  refresh();
  $("#updateCommit").addEventListener("click", () => presentEvaluation(evaluateUpdate(updates), updates, {
    markDefects: (ids) => ids.forEach((id) => $(`[data-update-row="${id}"]`, screen)?.classList.add("has-defect")),
    demonstrate: () => { GOLD.updateClaims.forEach((claim) => { updates[claim.id] = claim.target; }); refresh(); return { ...updates }; }
  }));
}

function renderAction() {
  let actionId = session.responses["MF8-16"]?.actionId || "";
  let stopped = Boolean(session.responses["MF8-16"]?.stopped);
  setScreen(`
    ${screenHeader("Update · Act or stop", "What is useful now?", "Choose one proportionate next action, then decide whether further checking can still change the decision.")}
    <div class="option-grid task-surface">${GOLD.actions.map((action) => `<button class="option-card" type="button" data-action="${action.id}" aria-pressed="false"><strong>${escapeHTML(action.text)}</strong></button>`).join("")}</div>
    <div class="save-choice task-surface"><label><input type="checkbox" id="enoughCheck" /> <span>Enough for now. The available evidence is sufficient for this next step.</span></label></div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="actionCommit">Commit action</button></div>
  `, { help: HELP["MF8-16"] });
  const refresh = () => {
    $$('[data-action]', screen).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.action === actionId)));
    $("#enoughCheck").checked = stopped;
    $("#actionCommit").disabled = !actionId;
  };
  $$('[data-action]', screen).forEach((button) => button.addEventListener("click", () => { actionId = button.dataset.action; refresh(); }));
  $("#enoughCheck").addEventListener("change", (event) => { stopped = event.target.checked; });
  refresh();
  $("#actionCommit").addEventListener("click", () => presentEvaluation(evaluateAction(actionId, stopped), { actionId, stopped }, {
    demonstrate: () => { actionId = "revise-two"; stopped = true; refresh(); return { actionId, stopped }; }
  }));
}

function renderContrast() {
  const bands = ["Only one marked component", "The prototype architecture", "The designer’s entire ability", "The designer’s identity and future"];
  let selected = Number(session.responses["MF8-17"]?.selected ?? 0);
  setScreen(`
    ${screenHeader("Update · Contrast", "When does a broader concern become accurate?", "The surface words are similar, but the evidence is not. Do not learn the hidden rule that criticism must always be local or harmless.")}
    <div class="contrast-card"><small>Second authored world</small><p>Five systems fail the same safety limit. The audit traces them to a shared power architecture. “These need work.”</p></div>
    <div class="scope-bands task-surface" role="radiogroup" aria-label="Supported scope">${bands.map((band,index) => `<button class="scope-band" type="button" role="radio" data-contrast="${index}" aria-checked="${selected === index}"><span class="scope-index">${index + 1}</span><strong>${escapeHTML(band)}</strong><small>${index === 1 ? "Technical system" : index > 1 ? "Person" : "Local"}</small></button>`).join("")}</div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="contrastCommit">Commit scope</button></div>
  `, { help: HELP["MF8-17"] });
  const refresh = () => $$('[data-contrast]', screen).forEach((button) => button.setAttribute("aria-checked", String(Number(button.dataset.contrast) === selected)));
  $$('[data-contrast]', screen).forEach((button) => button.addEventListener("click", () => { selected = Number(button.dataset.contrast); refresh(); }));
  $("#contrastCommit").addEventListener("click", () => presentEvaluation(evaluateContrast(selected), { selected }, {
    demonstrate: () => { selected = 1; refresh(); return { selected }; }
  }));
}

function alternateScene() {
  return session.responses.__alternateScene || "greenhouse";
}

function renderTransferScene() {
  const relay = alternateScene() === "relay";
  const facts = relay
    ? ["A relay request was sent.", "Acknowledgement is delayed.", "The transmission queue has not been checked."]
    : GOLD.transfer.facts;
  const tools = relay ? ["inspect", "model", "source", "test", "stop"] : GOLD.transfer.tools;
  let tool = session.responses["MF8-18"]?.tool || "";
  setScreen(`
    ${screenHeader("Transfer · New surface", relay ? "The Silent Relay" : GOLD.transfer.title, relay ? "The interface and vocabulary have changed. Choose the next cognitive operation without familiar phase labels." : "Two trials pass. One fails at 38°C. Choose the next cognitive operation without familiar phase labels.")}
    <div class="transfer-scene"><div class="greenhouse-visual" aria-hidden="true"><span class="plant plant-a"></span><span class="plant plant-b"></span><span class="plant plant-c"></span></div><div class="transfer-facts">${facts.map((fact) => `<span>${escapeHTML(fact)}</span>`).join("")}</div></div>
    <div class="inline-tools task-surface" role="group" aria-label="Choose a tool">${tools.map((value) => `<button type="button" data-tool="${value}" aria-pressed="${tool === value}">${escapeHTML(value)}</button>`).join("")}</div>
    <div class="button-row"><button class="primary-button" id="transferStart" ${tool ? "" : "disabled"}>Use selected tool</button></div>
  `);
  $$('[data-tool]', screen).forEach((button) => button.addEventListener("click", () => {
    tool = button.dataset.tool;
    $$('[data-tool]', screen).forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    $("#transferStart").disabled = false;
  }));
  $("#transferStart").addEventListener("click", () => { session.responses["MF8-18"] = { tool }; advance(); });
}

function renderTransferAction() {
  const relay = alternateScene() === "relay";
  const scopes = relay ? ["The reply is delayed; motive remains unknown", "The operator deliberately rejected the request", "All future requests will fail"] : GOLD.transfer.scopes;
  const tests = relay ? ["Check the transmission queue or send one neutral status request", "Accuse the operator of refusal", "Repeat the same status check indefinitely", "Assume the system is broken"] : GOLD.transfer.tests;
  const response = { ...(session.responses["MF8-19"] || {}) };
  setScreen(`
    ${screenHeader("Transfer · Independent application", "Decide what the result shows—and what would help next", "Keep the real failure or delay, limit the conclusion, then select a test that can distinguish live causes.")}
    <div class="builder task-surface"><div class="builder-row"><span class="builder-label">Supported scope</span><div class="segment-grid">${scopes.map((value) => `<button class="segment" type="button" data-transfer-scope="${escapeHTML(value)}">${escapeHTML(value)}</button>`).join("")}</div></div><div class="builder-row"><span class="builder-label">Next test</span><div class="segment-grid">${tests.map((value) => `<button class="segment" type="button" data-transfer-test="${escapeHTML(value)}">${escapeHTML(value)}</button>`).join("")}</div></div></div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="transferCommit">Commit transfer</button></div>
  `, { help: HELP["MF8-19"] });
  const refresh = () => {
    $$('[data-transfer-scope]', screen).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.transferScope === response.scope)));
    $$('[data-transfer-test]', screen).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.transferTest === response.test)));
    $("#transferCommit").disabled = !response.scope || !response.test;
  };
  $$('[data-transfer-scope]', screen).forEach((button) => button.addEventListener("click", () => { response.scope = button.dataset.transferScope; refresh(); }));
  $$('[data-transfer-test]', screen).forEach((button) => button.addEventListener("click", () => { response.test = button.dataset.transferTest; refresh(); }));
  refresh();
  $("#transferCommit").addEventListener("click", () => {
    let evaluation;
    if (relay) {
      const pass = response.scope === scopes[0] && response.test === tests[0];
      evaluation = { pass, grade:pass ? 2 : 0, skill:"transfer", defects:pass ? [] : ["transfer"], success:"You kept the delay, left motive unresolved and selected a bounded source check.", repair:"A delay is established; motive is not. Use one source check that could distinguish workload from transmission failure." };
    } else evaluation = evaluateTransfer(response);
    presentEvaluation(evaluation, response, { demonstrate: () => { response.scope = scopes[0]; response.test = tests[0]; refresh(); return { ...response }; } });
  });
}

function renderRetrieval() {
  const expected = GOLD.method.map((item) => item.id);
  const saved = session.responses["MF8-20"]?.order || [];
  const order = [...saved];
  let selected = null;
  setScreen(`
    ${screenHeader("Transfer · Retrieval", "Rebuild the compact CBT method", "Move the six operations into order. Drag or tap a token, then tap a numbered slot.")}
    <div class="method-list task-surface" id="methodList"></div><div class="method-bank task-surface" id="methodBank"></div>
    <div id="feedbackArea"></div>
    <div class="button-row"><button class="primary-button" id="methodCommit">Commit method</button></div>
  `, { help: HELP["MF8-20"] });
  const itemFor = (id) => GOLD.method.find((item) => item.id === id);
  const place = (id, index) => {
    if (!id) return;
    const oldIndex = order.indexOf(id);
    if (oldIndex >= 0) order.splice(oldIndex, 1);
    if (index >= order.length) order.push(id); else order.splice(index, 0, id);
    selected = null;
    refresh();
  };
  const refresh = () => {
    $("#methodList").innerHTML = expected.map((_, index) => `<div class="method-slot" data-method-slot="${index}" role="button" tabindex="0" aria-label="Method position ${index + 1}"><b>${index + 1}</b>${order[index] ? `<button class="method-token" type="button" draggable="true" data-placed-token="${order[index]}">${escapeHTML(itemFor(order[index]).text)}</button>` : `<span>Place an operation</span>`}</div>`).join("");
    $("#methodBank").innerHTML = expected.filter((id) => !order.includes(id)).map((id) => `<button class="method-token ${selected === id ? "is-selected" : ""}" type="button" draggable="true" data-bank-token="${id}" aria-pressed="${selected === id}">${escapeHTML(itemFor(id).text)}</button>`).join("");
    $$('[data-bank-token]', screen).forEach((button) => {
      button.addEventListener("click", () => { selected = selected === button.dataset.bankToken ? null : button.dataset.bankToken; refresh(); });
      button.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", button.dataset.bankToken));
    });
    $$('[data-placed-token]', screen).forEach((button) => {
      button.addEventListener("click", () => { order.splice(order.indexOf(button.dataset.placedToken), 1); selected = button.dataset.placedToken; refresh(); });
      button.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", button.dataset.placedToken));
    });
    $$('[data-method-slot]', screen).forEach((slot) => {
      slot.addEventListener("click", (event) => { if (!event.target.matches('[data-placed-token]')) place(selected, Number(slot.dataset.methodSlot)); });
      slot.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); place(selected, Number(slot.dataset.methodSlot)); } });
      slot.addEventListener("dragover", (event) => event.preventDefault());
      slot.addEventListener("drop", (event) => { event.preventDefault(); place(event.dataTransfer.getData("text/plain"), Number(slot.dataset.methodSlot)); });
    });
    $("#methodCommit").disabled = order.length !== expected.length;
  };
  refresh();
  $("#methodCommit").addEventListener("click", () => presentEvaluation(evaluateRetrieval(order), { order:[...order] }, {
    demonstrate: () => { order.splice(0, order.length, ...expected); refresh(); return { order: [...order] }; }
  }));
}

function renderCounterfactual() {
  const response = { ...(session.responses["MF12-22"] || {}) };
  const rows = [
    ["measurement", "The 4 mm tolerance failure", [["remains","Remains"],["remove","Disappears"]]],
    ["changedRule", "The changed-requirement cause", [["keep","Keep"],["remove","Remove"]]],
    ["scope", "Supported scope", [["parts","Two components"],["prototype","Whole prototype"],["identity","Ari’s identity"]]]
  ];
  setScreen(`
    ${screenHeader("Deep practice · Counterfactual", "Change one condition, preserve everything else", "Replay the same world except Requirement R-17 did not change yesterday. What should move in the model?")}
    <div class="mapping-grid task-surface">${rows.map(([key,label,options]) => `<div class="mapping-row"><span>${label}</span><div class="compact-options">${options.map(([value,text]) => `<button type="button" data-counter="${key}:${value}">${text}</button>`).join("")}</div></div>`).join("")}</div>
    <div id="feedbackArea"></div><div class="button-row"><button class="primary-button" id="counterCommit">Commit counterfactual</button></div>
  `, { help: HELP["MF12-22"] });
  const refresh = () => {
    $$('[data-counter]', screen).forEach((button) => { const [key,value] = button.dataset.counter.split(":"); button.setAttribute("aria-pressed", String(response[key] === value)); });
    $("#counterCommit").disabled = rows.some(([key]) => !response[key]);
  };
  $$('[data-counter]', screen).forEach((button) => button.addEventListener("click", () => { const [key,value] = button.dataset.counter.split(":"); response[key] = value; refresh(); }));
  refresh();
  $("#counterCommit").addEventListener("click", () => presentEvaluation(evaluateCounterfactual(response), response, {
    demonstrate: () => { Object.assign(response,{measurement:"remains",changedRule:"remove",scope:"parts"}); refresh(); return { ...response }; }
  }));
}

function renderSourceAudit() {
  const selected = new Set(session.responses["MF12-23"]?.selected || []);
  const sources = [
    ["measurement","Direct tolerance measurement","Independent instrument"],
    ["summary-a","Review dashboard summary","Copies the measurement"],
    ["summary-b","Team digest","Copies the same dashboard"],
    ["requirement-log","Requirements version log","Independent record"]
  ];
  setScreen(`
    ${screenHeader("Deep practice · Source audit", "Which sources add independent information?", "Select only the sources with distinct origins that directly bear on the causal model.")}
    <div class="option-grid task-surface">${sources.map(([id,title,note]) => `<button class="option-card" type="button" data-source-audit="${id}" aria-pressed="${selected.has(id)}"><small>${escapeHTML(note)}</small><strong>${escapeHTML(title)}</strong></button>`).join("")}</div>
    <div id="feedbackArea"></div><div class="button-row"><button class="primary-button" id="sourceCommit">Commit sources</button></div>
  `, { help: HELP["MF12-23"] });
  $$('[data-source-audit]', screen).forEach((button) => button.addEventListener("click", () => { const id=button.dataset.sourceAudit; if(selected.has(id)) selected.delete(id); else selected.add(id); button.setAttribute("aria-pressed",String(selected.has(id))); }));
  $("#sourceCommit").addEventListener("click", () => presentEvaluation(evaluateSourceAudit([...selected]), {selected:[...selected]}, {
    demonstrate: () => { selected.clear(); selected.add("measurement"); selected.add("requirement-log"); $$('[data-source-audit]',screen).forEach((button)=>button.setAttribute("aria-pressed",String(selected.has(button.dataset.sourceAudit)))); return { selected: [...selected] }; }
  }));
}

function renderReassurance() {
  const response = { ...(session.responses["MF12-24"] || {}) };
  const rows = [
    ["problem","Five linked safety failures",[["keep","Keep as established"],["remove","Explain away"]]],
    ["identity","Designer identity conclusion",[["open","Leave unsupported/open"],["negative","Treat as proven"]]],
    ["action","Practical response",[["redesign","Redesign the architecture"],["minimise","Proceed unchanged"]]]
  ];
  setScreen(`
    ${screenHeader("Deep practice · Outcome independence", "Accuracy is not the most comforting answer", "In this authored branch, five linked safety failures are confirmed. Preserve the supported unpleasant conclusion without globalising it.")}
    <div class="mapping-grid task-surface">${rows.map(([key,label,options])=>`<div class="mapping-row"><span>${label}</span><div class="compact-options">${options.map(([value,text])=>`<button type="button" data-reassure="${key}:${value}">${text}</button>`).join("")}</div></div>`).join("")}</div>
    <div id="feedbackArea"></div><div class="button-row"><button class="primary-button" id="reassureCommit">Commit response</button></div>
  `,{help:HELP["MF12-24"]});
  const refresh=()=>{$$('[data-reassure]',screen).forEach((button)=>{const [key,value]=button.dataset.reassure.split(":");button.setAttribute("aria-pressed",String(response[key]===value));});$("#reassureCommit").disabled=rows.some(([key])=>!response[key]);};
  $$('[data-reassure]',screen).forEach((button)=>button.addEventListener("click",()=>{const [key,value]=button.dataset.reassure.split(":");response[key]=value;refresh();}));
  refresh();
  $("#reassureCommit").addEventListener("click",()=>presentEvaluation(evaluateReassurance(response),response,{demonstrate:()=>{Object.assign(response,{problem:"keep",identity:"open",action:"redesign"});refresh();return {...response};}}));
}

function renderReturnSignal() {
  let answer = session.responses["MF12-25"]?.answer || "";
  const options = [
    ["everything-proven","Every original conclusion is now proven"],
    ["local-stronger-identity-open","The local technical model is stronger; the identity claim remains open"],
    ["nothing-learned","The result changed nothing"],
    ["everything-fine","The result proves everything is fine"]
  ];
  setScreen(`
    ${screenHeader("Deep practice · Unannounced return", "Return to the prediction locked earlier", "The test named a threshold and a changed requirement. What is now justified without hindsight rewriting?")}
    <div class="option-grid task-surface">${options.map(([value,text])=>`<button class="option-card" type="button" data-return-answer="${value}" aria-pressed="${answer===value}"><strong>${escapeHTML(text)}</strong></button>`).join("")}</div>
    <div id="feedbackArea"></div><div class="button-row"><button class="primary-button" id="returnCommit" ${answer?"":"disabled"}>Commit return</button></div>
  `,{help:HELP["MF12-25"]});
  $$('[data-return-answer]',screen).forEach((button)=>button.addEventListener("click",()=>{answer=button.dataset.returnAnswer;$$('[data-return-answer]',screen).forEach((candidate)=>candidate.setAttribute("aria-pressed",String(candidate===button)));$("#returnCommit").disabled=false;}));
  $("#returnCommit").addEventListener("click",()=>presentEvaluation(evaluateReturnSignal(answer),{answer},{demonstrate:()=>{answer="local-stronger-identity-open";return {answer};}}));
}

function renderCompletion() {
  if (!session) return renderOpening();
  session.completed = true;
  stopClock();
  removeStored(sessionStorage, ACTIVE_SESSION_KEY);
  removeStored(localStorage, RESUME_SNAPSHOT_KEY);
  const summary = sessionSummary(session);
  const nextFamily = selectNextFamily(mergeSessionIntoProgress(progress, session), preferences.intensity);
  setScreen(`
    ${screenHeader("Session complete", "You completed a CBT practice cycle", "No global score, speed bonus or personality judgment is produced. Only the operations actually demonstrated are reported.")}
    <div class="completion-card">
      <div class="completion-gem" aria-hidden="true"><span>✓</span></div>
      <div class="summary-list">${summary.length ? summary.map((item)=>`<div class="summary-item"><strong>${escapeHTML(item.verb)}</strong><span>${escapeHTML(item.label)}</span></div>`).join("") : `<div class="summary-item"><strong>Completed</strong><span>You reached the end of the fictional cycle. Skipped operations were not assessed.</span></div>`}</div>
      <div class="save-choice"><label><input type="checkbox" id="rememberProgress" ${progress.enabled?"checked":""}/><span>Remember practice progress on this device</span></label><small>Stores scenario IDs, assistance used and skill-level results in this browser. It never stores a personal story, and you can erase it at any time.</small></div>
      <p class="screen-lead">Next practice target: <strong>${escapeHTML(nextFamily.title)}</strong> · ${escapeHTML(SKILLS[mergeSessionIntoProgress(progress,session).nextTarget] || SKILLS.source)}.</p>
      <div class="button-row"><button class="primary-button" id="doneButton">Done · Return to Mind</button><button class="secondary-button" id="reviewButton">Review this session</button><button class="secondary-button" id="againButton">Repeat this session</button></div>
      <div id="reviewDetails" hidden></div>
    </div>
  `);
  $("#doneButton").addEventListener("click", () => finishAndExit(Boolean($("#rememberProgress").checked)));
  $("#againButton").addEventListener("click", () => {
    if ($("#rememberProgress").checked) saveProgress();
    session = null;
    beginSession();
  });
  $("#reviewButton").addEventListener("click", () => {
    const details = $("#reviewDetails");
    details.hidden = !details.hidden;
    details.innerHTML = `<div class="feedback"><div><strong>Task evidence</strong><p>${Object.entries(session.outcomes).map(([skill,outcome])=>`${SKILLS[skill] || skill}: ${outcome.status}${outcome.supportUsed?" with support":""}`).join(" · ") || "No skill claim was made."}</p></div></div>`;
    $("#reviewButton").textContent = details.hidden ? "Review this session" : "Hide review";
  });
}

function saveProgress() {
  progress = mergeSessionIntoProgress(progress, session);
  const saved = writeJSON(localStorage, PROGRESS_KEY, progress);
  if (!saved) showToast("Progress was not saved on this device");
  return saved;
}

function finishAndExit(remember) {
  if (remember) saveProgress();
  session.responses = {};
  session.outcomes = {};
  removeStored(sessionStorage, ACTIVE_SESSION_KEY);
  removeStored(localStorage, RESUME_SNAPSHOT_KEY);
  window.location.assign(RETURN_URL);
}

function renderSceneSwap() {
  renderTransferScene();
}

const renderers = {
  "MF8-01": renderArrival,
  "MF8-02": renderObserve,
  "MF8-03": renderPrivatePass,
  "MF8-04": renderSort,
  "MF8-05": renderSortInspection,
  "MF8-06": renderScope,
  "MF8-07": renderLoop,
  "MF8-08": renderPrivateModel,
  "MF8-09": renderModelBuilder,
  "MF8-10": renderPredictions,
  "MF8-11": renderTestBuilder,
  "MF8-12": renderLock,
  "MF8-13": renderResult,
  "MF8-14": renderEvidenceMap,
  "MF8-15": renderUpdate,
  "MF8-16": renderAction,
  "MF8-17": renderContrast,
  "MF8-18": renderTransferScene,
  "MF8-19": renderTransferAction,
  "MF8-20": renderRetrieval,
  "MF8-21": renderCompletion,
  "MF12-22": renderCounterfactual,
  "MF12-23": renderSourceAudit,
  "MF12-24": renderReassurance,
  "MF12-25": renderReturnSignal
};

function openModal(layer, { pause = true } = {}) {
  if (!layer || currentModal) return;
  focusBeforeModal = document.activeElement;
  currentModal = layer;
  resumeAfterModal = Boolean(session && !session.paused && pause);
  if (resumeAfterModal) pauseClock();
  layer.hidden = false;
  requestAnimationFrame(() => $(".modal", layer)?.focus());
}

function closeModal(layer = currentModal) {
  if (!layer) return;
  layer.hidden = true;
  currentModal = null;
  focusBeforeModal?.focus?.({ preventScroll:true });
  if (resumeAfterModal || (layer.id === "pauseModal" && session && !session.completed)) resumeClock();
  resumeAfterModal = false;
}

function openSettings() {
  const layer = $("#settingsModal");
  for (const [name,value] of Object.entries(preferences)) {
    const control = $(`[name="${name}"][value="${value}"]`, layer) || $(`[name="${name}"]`, layer);
    if (!control) continue;
    if (control.type === "checkbox") control.checked = Boolean(value); else control.checked = true;
  }
  openModal(layer);
}

function openHelp() {
  if (!session) return;
  const text = screen.dataset.help || HELP[session.screenId] || "Return to the source, identify the smallest unsupported step, and change only that component.";
  session.supportUsed[session.screenId] = true;
  $("#helpContent").innerHTML = `<p>${escapeHTML(text)}</p><p>Using help changes only the recorded support level for this task. It never lowers access or creates a penalty.</p>`;
  openModal($("#helpModal"));
}

function openPause(fromVisibility = false) {
  if (!session || session.completed) return;
  const layer = $("#pauseModal");
  $("#pauseTitle").textContent = fromVisibility ? "Ready to resume?" : "Leave this session?";
  $(".modal-copy", layer).textContent = fromVisibility ? "The session paused while this page was not visible. No content advanced." : "Leaving does not affect your progress.";
  openModal(layer);
  requestAnimationFrame(() => $("#continueButton").focus());
}

function openSceneChooser() {
  if (!session || session.completed) return;
  openModal($("#sceneModal"));
}

function chooseScene(name) {
  const current = session.screenId;
  session.sceneChanged = true;
  session.responses[current] = { notAssessed:true };
  session.responses.__alternateScene = name;
  const template = SESSION_PLANS[session.duration];
  const tailIds = session.duration === 4 ? ["MF8-18","MF8-19","MF8-21"] : ["MF8-18","MF8-19","MF8-20","MF8-21"];
  const tail = tailIds.map((id) => template.find((item) => item.id === id) || SESSION_PLANS[8].find((item) => item.id === id)).filter(Boolean).map((item) => ({...item}));
  session.plan = [...session.plan.slice(0,session.cursor + 1), ...tail];
  session.cursor += 1;
  session.screenId = session.plan[session.cursor].id;
  closeModal($("#sceneModal"));
  renderSceneSwap();
}

function trapModalFocus(event) {
  if (!currentModal || event.key !== "Tab") return;
  const focusable = $$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])', currentModal).filter((node) => !node.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

referenceButton.addEventListener("click", () => {
  referenceTray.hidden = !referenceTray.hidden;
  referenceButton.setAttribute("aria-expanded", String(!referenceTray.hidden));
  if (!referenceTray.hidden) $("#closeReference").focus();
});
$("#closeReference").addEventListener("click", () => { referenceTray.hidden = true; referenceButton.setAttribute("aria-expanded","false"); referenceButton.focus(); });
$("#changeSceneButton").addEventListener("click", openSceneChooser);
$("#helpButton").addEventListener("click", openHelp);
$("#pauseButton").addEventListener("click", () => openPause(false));
$("#supportButton").addEventListener("click", () => openModal($("#supportModal")));
timerButton.addEventListener("click", () => {
  const values = ["arc","exact","hidden"];
  preferences.timeDisplay = values[(values.indexOf(preferences.timeDisplay) + 1) % values.length];
  if (session) session.preferences.timeDisplay = preferences.timeDisplay;
  applyPreferences();
  showToast(`Time display: ${preferences.timeDisplay}`);
});

$("#saveSettings").addEventListener("click", () => {
  const layer = $("#settingsModal");
  const value = (name) => $(`[name="${name}"]:checked`, layer)?.value;
  preferences = safePreferences({
    ...preferences,
    pacing:value("pacing"),
    timeDisplay:value("timeDisplay"),
    motion:value("motion"),
    textScale:Number(value("textScale")),
    contrast:value("contrast"),
    intensity:value("intensity"),
    sound:$('[name="sound"]',layer).checked,
    duration:selectedDuration
  });
  if (session) session.preferences = preferences;
  applyPreferences();
  closeModal(layer);
});

$("#eraseProgress").addEventListener("click", () => {
  removeStored(localStorage, PROGRESS_KEY);
  progress = safeProgress({});
  showToast("Saved practice progress erased");
});

$$('[data-close-modal]').forEach((button) => button.addEventListener("click", () => closeModal(button.closest(".modal-layer"))));
$("#continueButton").addEventListener("click", () => closeModal($("#pauseModal")));
$("#keepExitButton").addEventListener("click", () => {
  pauseClock();
  const snapshot = compactActiveSnapshot({ ...session, elapsedActiveMs: currentElapsed() });
  snapshot.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const saved = writeJSON(localStorage, RESUME_SNAPSHOT_KEY, snapshot);
  if (!saved) return showToast("This browser could not save the paused session");
  window.location.assign(RETURN_URL);
});
$("#forgetExitButton").addEventListener("click", () => {
  removeStored(sessionStorage, ACTIVE_SESSION_KEY);
  removeStored(localStorage, RESUME_SNAPSHOT_KEY);
  window.location.assign(RETURN_URL);
});
$$('[data-scene]').forEach((button) => button.addEventListener("click", () => chooseScene(button.dataset.scene)));

document.addEventListener("keydown", (event) => {
  trapModalFocus(event);
  if (event.key !== "Escape") return;
  if (currentModal) {
    if (currentModal.id === "pauseModal") closeModal(currentModal);
    else closeModal(currentModal);
    return;
  }
  if (session && !session.completed) openPause(false);
});

document.addEventListener("visibilitychange", () => {
  if (!session || session.completed) return;
  if (document.hidden) {
    pauseClock();
    session.responses.__resumeRequired = true;
  } else if (session.responses.__resumeRequired) {
    delete session.responses.__resumeRequired;
    openPause(true);
  }
});

window.addEventListener("pagehide", () => {
  if (!session || session.completed) return;
  pauseClock();
  saveActiveSession();
});

applyPreferences();
renderOpening();

export { renderOpening, renderCurrent };
