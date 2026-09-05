export const CBT_VERSION = "2.0.0";
export const ACTIVE_SESSION_KEY = "dreamunity:cbt:active:v2";
export const RESUME_SNAPSHOT_KEY = "dreamunity:cbt:resume:v2";
export const PREFERENCES_KEY = "dreamunity:cbt:preferences:v2";
export const PROGRESS_KEY = "dreamunity:cbt:progress:v2";

export const SCENARIO_SCHEMA = Object.freeze({
  version: "cbt-causal-world/1",
  required: ["id", "familyId", "variantId", "sourceObjects", "causes", "forecasts", "testSlots", "outcome", "evidenceRows", "updateClaims", "actions", "transfer"],
  invariants: ["sources-before-claims", "variant-locked-before-entry", "prediction-before-result", "authored-consequence-only", "identity-never-outcome-variable"]
});

const phaseFor = (id) => {
  if (["MF8-01", "MF8-02", "MF8-03", "MF8-04", "MF8-05", "MF8-06", "MF8-07"].includes(id)) return "trace";
  if (["MF8-08", "MF8-09", "MF8-10", "MF8-11", "MF8-12"].includes(id)) return "test";
  if (["MF8-13", "MF8-14", "MF8-15", "MF8-16", "MF8-17", "MF12-22", "MF12-23"].includes(id)) return "update";
  if (["MF8-18", "MF8-19", "MF12-24", "MF12-25"].includes(id)) return "transfer";
  return "close";
};

const eightMinuteBudgets = [
  ["MF8-01", 15], ["MF8-02", 20], ["MF8-03", 15], ["MF8-04", 30], ["MF8-05", 20],
  ["MF8-06", 25], ["MF8-07", 30], ["MF8-08", 15], ["MF8-09", 30], ["MF8-10", 30],
  ["MF8-11", 30], ["MF8-12", 15], ["MF8-13", 15], ["MF8-14", 25], ["MF8-15", 25],
  ["MF8-16", 20], ["MF8-17", 30], ["MF8-18", 15], ["MF8-19", 35], ["MF8-20", 20],
  ["MF8-21", 20]
];

const fourMinuteBudgets = [
  ["MF8-01", 7], ["MF8-02", 8],
  ["MF8-04", 18], ["MF8-06", 10], ["MF8-07", 12],
  ["MF8-09", 20], ["MF8-10", 15],
  ["MF8-11", 20], ["MF8-12", 8], ["MF8-13", 12],
  ["MF8-14", 10], ["MF8-15", 18], ["MF8-16", 12],
  ["MF8-17", 30],
  ["MF8-18", 5], ["MF8-19", 20],
  ["MF8-21", 15]
];

const twelveMinuteIds = [
  ...eightMinuteBudgets.slice(0, 17),
  ["MF12-22", 80],
  ["MF12-23", 60],
  ...eightMinuteBudgets.slice(17, 19),
  ["MF12-24", 60],
  ["MF12-25", 40],
  ...eightMinuteBudgets.slice(19)
];

const optionalIds = new Set(["MF8-17", "MF12-22", "MF12-23", "MF12-25"]);

const toPlan = (rows) => rows.map(([id, budget]) => ({
  id,
  budget,
  phase: phaseFor(id),
  optional: optionalIds.has(id)
}));

export const SESSION_PLANS = Object.freeze({
  4: toPlan(fourMinuteBudgets),
  8: toPlan(eightMinuteBudgets),
  12: toPlan(twelveMinuteIds)
});

export const SCREEN_TITLES = Object.freeze({
  "MF8-01": "Enter the fictional case",
  "MF8-02": "Inspect what is present",
  "MF8-03": "Make a private first pass",
  "MF8-04": "Separate what is shown from what is added",
  "MF8-05": "Inspect the distinction",
  "MF8-06": "Set the evidence boundary",
  "MF8-07": "Trace the cognitive–behavioural loop",
  "MF8-08": "Form another explanation",
  "MF8-09": "Construct a distinct model",
  "MF8-10": "Make the models predict",
  "MF8-11": "Build a bounded test",
  "MF8-12": "Lock the expectation",
  "MF8-13": "Reveal the result",
  "MF8-14": "Map evidence to claims",
  "MF8-15": "Update selectively",
  "MF8-16": "Choose the next action—and stop",
  "MF8-17": "Contrast: when broader concern is accurate",
  "MF8-18": "Transfer to a new surface",
  "MF8-19": "Apply the method independently",
  "MF8-20": "Rebuild the compact method",
  "MF8-21": "Complete the session",
  "MF12-22": "Run a controlled counterfactual",
  "MF12-23": "Audit source independence",
  "MF12-24": "Resist unsupported reassurance",
  "MF12-25": "Return to an earlier prediction"
});

export const SCREEN_SKILLS = Object.freeze({
  "MF8-04": "separate", "MF8-05": "separate", "MF8-06": "scope", "MF8-07": "connect",
  "MF8-09": "model", "MF8-10": "predict", "MF8-11": "test", "MF8-14": "source",
  "MF8-15": "update", "MF8-16": "respond", "MF8-17": "scope", "MF8-19": "transfer",
  "MF8-20": "transfer", "MF12-22": "model", "MF12-23": "source", "MF12-24": "update",
  "MF12-25": "transfer"
});

export const SKILLS = Object.freeze({
  separate: "Separate observation from added claim",
  connect: "Connect meaning, response and consequence",
  scope: "Match conclusion reach to evidence reach",
  model: "Construct a materially different explanation",
  predict: "Specify observable, discriminating forecasts",
  test: "Build a relevant, bounded and clean test",
  source: "Track source independence and relevance",
  update: "Revise only by the amount evidence warrants",
  respond: "Choose a proportionate practical response",
  stop: "Recognise when more checking adds no value",
  select: "Choose the needed operation without a label",
  transfer: "Apply the operation in a changed setting"
});

export const EVIDENCE_STATES = Object.freeze([
  "unseen", "demonstrated", "supported", "constructive", "independent", "transferred", "returned"
]);

export const FAMILIES = Object.freeze([
  { id: "revised-prototype", title: "The Revised Prototype", surface: "Criticism and scope", variants: ["technical fault", "changed requirement", "broader concern"], operations: ["separate", "scope", "model", "test", "update"], twin: "Greenhouse Trial", intensity: "gentle" },
  { id: "silent-relay", title: "The Silent Relay", surface: "Ambiguous delayed reply", variants: ["workload", "transmission fault", "deliberate withdrawal"], operations: ["model", "predict", "test", "stop"], twin: "Delayed sensor report", intensity: "gentle" },
  { id: "greenhouse-trial", title: "The Greenhouse Trial", surface: "One condition fails", variants: ["model limit", "sensor fault", "uncontrolled variable"], operations: ["scope", "test", "update"], twin: "Component under load", intensity: "gentle" },
  { id: "echo-reports", title: "Echo Reports", surface: "Repeated evidence", variants: ["one origin repeated", "independent corroboration", "mixed reliability"], operations: ["connect", "source", "update"], twin: "Duplicated system alerts", intensity: "gentle" },
  { id: "cancelled-crossing", title: "The Cancelled Crossing", surface: "Plan changes", variants: ["weather", "resource conflict", "intentional exclusion"], operations: ["model", "test", "respond"], twin: "Cancelled meeting", intensity: "standard" },
  { id: "perfect-launch", title: "The Perfect Launch", surface: "Rigid rule", variants: ["exploratory draft", "routine release", "safety-critical task"], operations: ["connect", "model", "respond"], twin: "Rough creative draft", intensity: "gentle" },
  { id: "alarm-gate", title: "The Alarm Gate", surface: "Potential danger", variants: ["true fault", "faulty sensor", "unresolved"], operations: ["source", "respond", "stop"], twin: "Generic safety warning", intensity: "standard" },
  { id: "empty-seat", title: "The Empty Seat", surface: "Possible exclusion", variants: ["capacity limit", "late update", "deliberate exclusion"], operations: ["separate", "model", "respond"], twin: "Missing permission", intensity: "standard" },
  { id: "resource-counter", title: "The Resource Counter", surface: "Loss after mixed results", variants: ["ordinary variance", "process defect", "changing conditions"], operations: ["predict", "update"], twin: "Navigation series", intensity: "gentle" },
  { id: "contaminated-probe", title: "The Contaminated Probe", surface: "Test changes response", variants: ["neutral response", "probe-induced response", "pre-existing hostility"], operations: ["test", "update"], twin: "Machine calibration", intensity: "standard" },
  { id: "false-dawn", title: "False Dawn", surface: "Comforting explanation", variants: ["supported good news", "wishful claim", "partial reassurance"], operations: ["source", "update"], twin: "Early success signal", intensity: "gentle" },
  { id: "second-review", title: "The Second Review", surface: "Concern becomes broad", variants: ["local issue", "systemic issue", "role mismatch"], operations: ["scope", "respond", "stop"], twin: "Shared-cause faults", intensity: "standard" },
  { id: "closed-loop", title: "The Closed Loop", surface: "Repeated checking", variants: ["changed source", "unchanged source", "decision already sufficient"], operations: ["stop", "respond"], twin: "Repeated status refresh", intensity: "gentle" },
  { id: "paired-worlds", title: "Paired Worlds", surface: "Same cue, different causes", variants: ["operational", "interpersonal", "measurement"], operations: ["predict", "test", "transfer"], twin: "Matched opening scenes", intensity: "standard" },
  { id: "return-signal", title: "The Return Signal", surface: "Evidence arrives later", variants: ["confirmed", "weakened", "inconclusive"], operations: ["update", "stop", "transfer"], twin: "Any prior family", intensity: "gentle" }
]);

export const GOLD = Object.freeze({
  id: "revised-prototype-v2",
  familyId: "revised-prototype",
  title: "The Revised Prototype",
  variantId: "technical-plus-changed-rule",
  sourceObjects: [
    { label: "Review note", text: "“These need work.”" },
    { label: "Prototype diagram", text: "Two components are marked." },
    { label: "Schedule", text: "Review due: 16:00." }
  ],
  interpretation: "They’ve realised I don’t belong here.",
  sortCards: [
    { id: "note", text: "“These need work.”", target: "shown" },
    { id: "marks", text: "Two parts are marked.", target: "shown" },
    { id: "deadline", text: "Review is due at 16:00.", target: "shown" },
    { id: "whole", text: "The team rejected the whole prototype.", target: "added" },
    { id: "dislike", text: "The reviewer dislikes Ari.", target: "added" },
    { id: "improve", text: "Ari cannot improve.", target: "added" },
    { id: "belong", text: "Ari does not belong.", target: "added" }
  ],
  scopeBands: [
    "Two marked components",
    "The complete prototype",
    "Ari’s design ability",
    "Ari’s place on the team",
    "Ari’s future"
  ],
  loopNodes: [
    { id: "meaning", label: "Meaning", text: "I don’t belong." },
    { id: "response", label: "Feeling + body", text: "Embarrassment and apprehension." },
    { id: "action", label: "Action", text: "Delay showing a revision." },
    { id: "missing", label: "Information blocked", text: "No clarification is obtained." },
    { id: "uncertainty", label: "Consequence", text: "Uncertainty remains." },
    { id: "return", label: "Meaning returns", text: "Maybe they reject everything I do." }
  ],
  loopLinks: ["meaning>response", "response>action", "action>missing", "missing>uncertainty", "uncertainty>return"],
  causes: [
    { id: "threshold", text: "A specific technical threshold was missed." },
    { id: "changed-rule", text: "A requirement changed after the prototype was built." },
    { id: "broad-concern", text: "There is a wider confidence concern." }
  ],
  modelScopes: [
    { id: "parts", text: "The two marked components" },
    { id: "prototype", text: "The complete prototype" },
    { id: "role", text: "Ari’s role" }
  ],
  unknowns: [
    { id: "reviewer-opinion", text: "The reviewer’s broader opinion" },
    { id: "other-components", text: "Whether unmarked components passed" },
    { id: "requirement-version", text: "Which requirement version was used" }
  ],
  forecasts: [
    { id: "threshold-named", text: "A measurable threshold is named.", target: "alternate", band: "likely" },
    { id: "record-changed", text: "The requirements record shows a recent change.", target: "alternate", band: "possible" },
    { id: "beyond-parts", text: "Concerns extend beyond the two marked components.", target: "original", band: "possible" }
  ],
  testSlots: {
    source: [
      { id: "reviewer", text: "Reviewer" },
      { id: "requirements-log", text: "Requirements log" },
      { id: "team-rumours", text: "Team rumours" }
    ],
    action: [
      { id: "ask-criteria", text: "Ask which requirement each mark refers to" },
      { id: "compare-versions", text: "Compare the build and current requirement versions" },
      { id: "ask-approval", text: "Ask whether everyone approves of Ari" },
      { id: "accuse", text: "Accuse the reviewer of rejection" },
      { id: "restart-all", text: "Restart every component" }
    ],
    result: [
      { id: "specific-scope", text: "Whether the answer names specific parts or extends wider" },
      { id: "rule-changed", text: "Whether the relevant requirement changed" },
      { id: "reassurance", text: "Whether Ari feels reassured" }
    ],
    stop: [
      { id: "one-answer", text: "Stop after one direct answer" },
      { id: "one-record", text: "Stop after the two versions are compared" },
      { id: "until-certain", text: "Keep checking until completely certain" },
      { id: "none", text: "No stopping point" }
    ]
  },
  outcome: [
    "Component B exceeds the vibration tolerance by 4 mm.",
    "Requirement R-17 changed yesterday.",
    "All unmarked components passed this review.",
    "Submit the two revisions for recheck."
  ],
  evidenceRows: [
    { id: "measurement", text: "Component B exceeds tolerance by 4 mm.", target: "establishes" },
    { id: "requirement", text: "R-17 changed yesterday.", target: "establishes" },
    { id: "unmarked", text: "Every unmarked component passed.", target: "changes" },
    { id: "private-opinion", text: "The reviewer’s complete personal opinion.", target: "open" }
  ],
  updateClaims: [
    { id: "components", text: "Two components need revision.", target: "keep" },
    { id: "fault", text: "Component B missed a measured threshold.", target: "keep" },
    { id: "rule", text: "The relevant requirement changed.", target: "keep" },
    { id: "prototype-rejected", text: "The entire prototype was rejected.", target: "narrow" },
    { id: "opinion", text: "The reviewer’s broader opinion is known.", target: "open" },
    { id: "cannot-improve", text: "Ari cannot improve.", target: "remove" },
    { id: "identity", text: "Ari does not belong.", target: "remove" }
  ],
  actions: [
    { id: "revise-two", text: "Revise the two marked components under R-17, then resubmit once." },
    { id: "restart-everything", text: "Restart every component." },
    { id: "repeat-respect", text: "Ask repeatedly whether everyone respects Ari." },
    { id: "investigate-opinion", text: "Continue investigating the team’s private opinion." }
  ],
  transfer: {
    title: "The Greenhouse Trial",
    facts: ["Two controlled trials pass.", "The 38°C trial fails.", "An automated note says: “The growth model is useless.”"],
    tools: ["inspect", "scope", "test", "update", "act"],
    scopes: ["Failed at 38°C", "Fails at every temperature", "Useless in all settings"],
    tests: ["Repeat 38°C under the same controls", "Independently check the sensor", "Change every variable", "Ignore the failed condition"]
  },
  method: [
    { id: "event", text: "Keep the event" },
    { id: "claim", text: "Find the added claim" },
    { id: "predict", text: "Make it predict" },
    { id: "test", text: "Test it cleanly" },
    { id: "update", text: "Change only what the result changes" },
    { id: "act", text: "Act or stop" }
  ]
});

export const safePreferences = (value = {}) => ({
  duration: [4, 8, 12].includes(Number(value.duration)) ? Number(value.duration) : 8,
  pacing: value.pacing === "pace" ? "pace" : "clock",
  timeDisplay: ["arc", "exact", "hidden"].includes(value.timeDisplay) ? value.timeDisplay : "arc",
  motion: ["standard", "reduced", "static"].includes(value.motion) ? value.motion : "standard",
  textScale: [100, 125, 150, 200].includes(Number(value.textScale)) ? Number(value.textScale) : 100,
  contrast: value.contrast === "high" ? "high" : "standard",
  sound: value.sound === true,
  intensity: value.intensity === "gentle" ? "gentle" : "standard"
});

export function lockCausalWorld(scenario = GOLD) {
  for (const field of SCENARIO_SCHEMA.required) {
    if (scenario[field] === undefined) throw new Error(`Scenario is missing ${field}`);
  }
  return Object.freeze({
    schemaVersion: SCENARIO_SCHEMA.version,
    scenarioId: scenario.id,
    familyId: scenario.familyId,
    variantId: scenario.variantId,
    lockId: `${scenario.id}:${scenario.variantId}`
  });
}

export function resolveCausalWorld(lock, test = {}) {
  const expected = lockCausalWorld(GOLD);
  if (!lock || lock.schemaVersion !== expected.schemaVersion || lock.lockId !== expected.lockId) {
    throw new Error("Causal world lock does not match an authored scenario variant");
  }
  const evaluation = evaluateTest(test);
  return Object.freeze({
    lockId: expected.lockId,
    branch: evaluation.pass ? "authored-outcome" : "repair-required",
    consequence: Object.freeze(evaluation.pass ? [...GOLD.outcome] : []),
    evidenceAvailable: evaluation.pass
  });
}

export function createSession(preferences = {}, sessionId = "local-session", progressValue = {}) {
  const clean = safePreferences(preferences);
  const localProgress = safeProgress(progressValue);
  const assistance = Object.fromEntries(Object.keys(SKILLS).map((skill) => [skill, assistanceLevelFor(localProgress, skill)]));
  return {
    version: CBT_VERSION,
    sessionId,
    scenarioId: GOLD.id,
    familyId: GOLD.familyId,
    variantId: GOLD.variantId,
    worldLock: lockCausalWorld(GOLD),
    duration: clean.duration,
    preferences: clean,
    plan: SESSION_PLANS[clean.duration].map((item) => ({ ...item })),
    cursor: 0,
    screenId: SESSION_PLANS[clean.duration][0].id,
    elapsedActiveMs: 0,
    timeDebt: 0,
    paused: false,
    completed: false,
    sceneChanged: false,
    assistance,
    supportUsed: {},
    attempts: {},
    responses: {},
    outcomes: {},
    startedAt: new Date().toISOString()
  };
}

export const totalBudget = (plan) => plan.reduce((sum, item) => sum + item.budget, 0);

export function evaluateSort(placements = {}) {
  const defects = GOLD.sortCards.filter((card) => placements[card.id] !== card.target).map((card) => card.id);
  return resultFrom(defects, "separate", "You kept the visible review separate from the conclusions built around it.",
    "The review does not state every judgment built around it. Move only the highlighted card.");
}

export function evaluateScope(selectedIndex) {
  const pass = Number(selectedIndex) === 0;
  return resultFrom(pass ? [] : ["scope"], "scope", "You kept the conclusion at the size of the evidence.",
    Number(selectedIndex) < 0 ? "Two components are visibly marked. Keep that problem." : "The review names two components; it does not reach Ari’s identity or future.");
}

export function evaluateLoop(links = [], missingInformation = "") {
  const linkSet = new Set(links);
  const defects = GOLD.loopLinks.filter((link) => !linkSet.has(link));
  if (missingInformation !== "specific-reason") defects.push("missing-information");
  return resultFrom(defects, "connect", "The delay briefly avoids the review, but it preserves the uncertainty feeding the conclusion.",
    defects.includes("missing-information") ? "The response prevented Ari from learning the specific reason for the marks." : "Trace the next missing connection; the consequence maintains uncertainty rather than proving rejection.");
}

export function evaluateModel(model = {}) {
  const validCause = ["threshold", "changed-rule"].includes(model.cause);
  const validScope = model.scope === "parts";
  const unresolved = Array.isArray(model.unknowns) && model.unknowns.includes("reviewer-opinion");
  const defects = [];
  if (!validCause) defects.push("cause");
  if (!validScope) defects.push("scope");
  if (!unresolved) defects.push("unknown");
  return resultFrom(defects, "model", "This model changes the proposed cause, not merely the wording, and keeps the wider opinion unresolved.",
    !validCause ? "Build a different causal mechanism, not a reassuring synonym." : !validScope ? "Keep the model compatible with the two visible marks." : "Mark what this model still cannot tell you.");
}

export function evaluatePredictions(forecasts = {}) {
  const defects = GOLD.forecasts.filter((item) => {
    const response = forecasts[item.id];
    return !response || response.target !== item.target || response.band === "unlikely";
  }).map((item) => item.id);
  return resultFrom(defects, "predict", "The models now risk different observations. New evidence can change them.",
    "Make each forecast observable and specify which model would expect it more strongly.");
}

export function evaluateTest(test = {}) {
  const canonicalReviewer = test.source === "reviewer" && test.action === "ask-criteria" && test.result === "specific-scope" && test.stop === "one-answer";
  const canonicalRecord = test.source === "requirements-log" && test.action === "compare-versions" && test.result === "rule-changed" && test.stop === "one-record";
  const defects = [];
  if (!["reviewer", "requirements-log"].includes(test.source)) defects.push("source");
  if (!["ask-criteria", "compare-versions"].includes(test.action)) defects.push("action");
  if (!["specific-scope", "rule-changed"].includes(test.result)) defects.push("result");
  if (!["one-answer", "one-record"].includes(test.stop)) defects.push("stop");
  if (!canonicalReviewer && !canonicalRecord && defects.length === 0) defects.push("coherence");
  const repair = test.action === "ask-approval" ? "Approval does not separate the models. Ask for a criterion or check the requirement record."
    : test.action === "accuse" ? "An accusation may create the defensiveness it is meant to measure. Use a neutral probe."
      : test.action === "restart-all" ? "Changing everything hides which cause mattered. Change or inspect one thing."
        : defects.includes("stop") ? "Define the point at which this test has done its job." : "Make the source, action and observable result form one coherent test.";
  return resultFrom(defects, "test", "This test can distinguish specific criteria from a wider judgment, and it has a stopping point.", repair);
}

export function evaluateEvidence(mapping = {}) {
  const defects = GOLD.evidenceRows.filter((row) => mapping[row.id] !== row.target).map((row) => row.id);
  return resultFrom(defects, "source", "The result settles two local causes, weakens the whole-project conclusion and leaves the wider personal judgment unresolved.",
    "Attach each item only to the kind of claim it can actually change.");
}

export function evaluateUpdate(updates = {}) {
  const defects = GOLD.updateClaims.filter((claim) => updates[claim.id] !== claim.target).map((claim) => claim.id);
  const repair = defects.some((id) => ["components", "fault", "rule"].includes(id))
    ? "The measurement and version record establish real local problems. Preserve them."
    : defects.some((id) => ["cannot-improve", "identity"].includes(id))
      ? "Nothing in this result measures Ari’s worth, capacity to improve or place."
      : "The result does not establish that everything is fine, and it does not reveal every private opinion.";
  return resultFrom(defects, "update", "You kept the real problems and removed the unsupported verdict.", repair);
}

export function evaluateAction(actionId, stopped) {
  const defects = [];
  if (actionId !== "revise-two") defects.push("action");
  if (!stopped) defects.push("stop");
  return resultFrom(defects, "respond", "There is enough information for the next step. The wider opinion can remain unresolved.",
    actionId === "restart-everything" ? "The evidence identifies two targets, not every component."
      : actionId === "repeat-respect" ? "Repeated reassurance adds no information needed for the revision."
        : actionId === "investigate-opinion" ? "Another check is not needed to perform the supported repair."
          : "Choose a proportionate action, then deliberately stop.");
}

export function evaluateContrast(scopeIndex) {
  const pass = Number(scopeIndex) === 1;
  return resultFrom(pass ? [] : ["contrast-scope"], "scope", "This evidence supports a broader technical conclusion without becoming an identity verdict.",
    Number(scopeIndex) === 0 ? "Five linked failures justify a broader technical conclusion." : "The audit concerns the architecture, not the whole person or future.");
}

export function evaluateTransfer(response = {}) {
  const scopePass = response.scope === "Failed at 38°C";
  const testPass = ["Repeat 38°C under the same controls", "Independently check the sensor"].includes(response.test);
  const defects = [];
  if (!scopePass) defects.push("scope");
  if (!testPass) defects.push("test");
  return resultFrom(defects, "transfer", "You kept the failed condition, limited the conclusion and chose a test that can distinguish two causes.",
    !scopePass ? "One condition failed; two did not. Keep the 38°C failure without making it universal." : "Choose a test that can distinguish the growth model from the sensor.");
}

export function evaluateRetrieval(order = []) {
  const expected = GOLD.method.map((item) => item.id);
  const defects = expected.filter((id, index) => order[index] !== id);
  return resultFrom(defects, "transfer", "You rebuilt the complete move.",
    "A result can only update a prediction that was made before it arrived.");
}

export function evaluateCounterfactual(response = {}) {
  const pass = response.measurement === "remains" && response.changedRule === "remove" && response.scope === "parts";
  return resultFrom(pass ? [] : ["counterfactual"], "model", "You changed only the branch altered by the counterfactual; the measured fault still remains.",
    "Remove the changed-rule cause, but keep the measurement and its local scope.");
}

export function evaluateSourceAudit(selected = []) {
  const chosen = new Set(selected);
  const pass = chosen.size === 2 && chosen.has("measurement") && chosen.has("requirement-log");
  return resultFrom(pass ? [] : ["sources"], "source", "You retained two decision-relevant sources with different origins.",
    "Repeated summaries from one origin are not independent evidence. Keep the direct measurement and the separate requirement record.");
}

export function evaluateReassurance(response = {}) {
  const pass = response.problem === "keep" && response.identity === "open" && response.action === "redesign";
  return resultFrom(pass ? [] : ["reassurance"], "update", "You accepted the supported unpleasant conclusion without turning it into a verdict on the designer.",
    "The safety failures require redesign. That does not establish a conclusion about the designer’s identity or future.");
}

export function evaluateReturnSignal(answer) {
  return resultFrom(answer === "local-stronger-identity-open" ? [] : ["return"], "returned",
    "The result strengthened the local technical model while leaving the identity claim open.",
    "Return to the locked forecast: the result distinguishes local causes, but it never measures belonging.");
}

function resultFrom(defects, skill, success, repair) {
  return {
    pass: defects.length === 0,
    grade: defects.length === 0 ? 2 : 0,
    skill,
    defects,
    success,
    repair
  };
}

export function recordEvaluation(session, screenId, evaluation, supportUsed = false) {
  const attempts = (session.attempts[screenId] || 0) + 1;
  session.attempts[screenId] = attempts;
  const demonstrated = !evaluation.pass && attempts >= 2;
  const repaired = evaluation.pass && attempts > 1;
  const status = evaluation.pass ? (supportUsed || repaired ? "supported" : "independent") : demonstrated ? "demonstrated" : "repair";
  const grade = evaluation.pass ? (supportUsed || repaired ? 1 : 2) : demonstrated ? 1 : 0;
  session.outcomes[evaluation.skill] = {
    grade,
    status,
    supportUsed: Boolean(supportUsed),
    repaired,
    screenId
  };
  return { attempts, demonstrated, status, grade };
}

export function advanceSession(session, remainingSeconds = Infinity) {
  const currentId = session.plan[session.cursor]?.id;
  let nextCursor = session.cursor + 1;
  const repairedInFocusEnvelope = session.duration === 4 && Object.values(session.attempts).some((attempts) => attempts > 1);
  if (session.plan[nextCursor]?.id === "MF8-17" && repairedInFocusEnvelope) {
    session.timeDebt += session.plan[nextCursor].budget;
    session.plan.splice(nextCursor, 1);
  }
  if (session.preferences.pacing !== "pace") {
    while (nextCursor < session.plan.length) {
      const candidate = session.plan[nextCursor];
      if (candidate.id === "MF8-17" && remainingSeconds < 95) {
        session.timeDebt += candidate.budget;
        session.plan.splice(nextCursor, 1);
        continue;
      }
      if (candidate.id === "MF12-25" && remainingSeconds < 70) {
        session.timeDebt += candidate.budget;
        session.plan.splice(nextCursor, 1);
        continue;
      }
      break;
    }
  }
  session.cursor = Math.min(nextCursor, session.plan.length - 1);
  session.screenId = session.plan[session.cursor]?.id || currentId;
  return session.screenId;
}

export function markScreenResponse(session, screenId, response) {
  session.responses[screenId] = response;
}

export function compactActiveSnapshot(session) {
  return {
    version: session.version,
    sessionId: session.sessionId,
    scenarioId: session.scenarioId,
    familyId: session.familyId,
    variantId: session.variantId,
    worldLock: session.worldLock?.lockId === lockCausalWorld(GOLD).lockId ? { ...session.worldLock } : lockCausalWorld(GOLD),
    duration: session.duration,
    preferences: safePreferences(session.preferences),
    plan: session.plan.map(({ id, budget, phase, optional }) => ({ id, budget, phase, optional })),
    cursor: session.cursor,
    screenId: session.screenId,
    elapsedActiveMs: Math.max(0, Number(session.elapsedActiveMs) || 0),
    timeDebt: Math.max(0, Number(session.timeDebt) || 0),
    paused: true,
    completed: Boolean(session.completed),
    sceneChanged: Boolean(session.sceneChanged),
    assistance: Object.fromEntries(Object.keys(SKILLS).map((skill) => [skill, Math.max(0, Math.min(6, Number(session.assistance?.[skill]) || 1))])),
    supportUsed: { ...session.supportUsed },
    attempts: { ...session.attempts },
    responses: { ...session.responses },
    outcomes: { ...session.outcomes },
    startedAt: session.startedAt
  };
}

export function safeProgress(value = {}) {
  const skills = {};
  for (const key of Object.keys(SKILLS)) {
    const incoming = value.skills?.[key];
    if (!incoming) continue;
    skills[key] = {
      state: EVIDENCE_STATES.includes(incoming.state) ? incoming.state : "unseen",
      successes: Math.max(0, Math.min(99, Number(incoming.successes) || 0)),
      supportLevel: Math.max(0, Math.min(6, Number(incoming.supportLevel) || 0)),
      variants: Array.isArray(incoming.variants) ? [...new Set(incoming.variants.filter((id) => typeof id === "string"))].slice(0, 2) : [],
      due: Boolean(incoming.due)
    };
  }
  return {
    enabled: value.enabled === true,
    sessions: Math.max(0, Number(value.sessions) || 0),
    familyRecency: Array.isArray(value.familyRecency) ? value.familyRecency.filter((id) => FAMILIES.some((family) => family.id === id)).slice(0, 4) : [],
    skills,
    nextTarget: typeof value.nextTarget === "string" && SKILLS[value.nextTarget] ? value.nextTarget : "source"
  };
}

export function mergeSessionIntoProgress(previous, session) {
  const progress = safeProgress(previous);
  progress.enabled = true;
  progress.sessions += 1;
  progress.familyRecency = [session.familyId, ...progress.familyRecency.filter((id) => id !== session.familyId)].slice(0, 4);
  for (const [skill, outcome] of Object.entries(session.outcomes)) {
    if (!SKILLS[skill] && skill !== "returned") continue;
    const key = skill === "returned" ? "transfer" : skill;
    const old = progress.skills[key] || { state: "unseen", successes: 0, supportLevel: 1, variants: [], due: false };
    if (outcome.grade === 2) {
      old.successes += 1;
      if (!old.variants.includes(session.variantId)) old.variants.push(session.variantId);
      if (old.variants.length >= 2) {
        old.supportLevel = Math.min(6, old.supportLevel + 1);
        old.variants = [];
      }
      old.state = skill === "returned" ? "returned" : key === "transfer" ? "transferred" : old.supportLevel >= 4 ? "independent" : "constructive";
      old.due = false;
    } else if (outcome.grade === 1) {
      old.state = outcome.status === "demonstrated" ? "demonstrated" : "supported";
      if (outcome.status === "demonstrated") old.supportLevel = Math.max(1, old.supportLevel - 1);
      old.due = true;
    }
    progress.skills[key] = old;
  }
  progress.nextTarget = chooseNextSkill(progress);
  return progress;
}

export function chooseNextSkill(progressValue) {
  const progress = safeProgress(progressValue);
  const priority = Object.keys(SKILLS).map((skill, index) => {
    const evidence = progress.skills[skill] || { state: "unseen", successes: 0, supportLevel: 0, due: false };
    const repairNeed = evidence.due ? 100 : 0;
    const unseen = evidence.state === "unseen" ? 40 : 0;
    const transferGap = ["constructive", "independent"].includes(evidence.state) ? 24 : 0;
    const retrieval = evidence.state === "transferred" ? 18 : 0;
    return { skill, score: repairNeed + unseen + transferGap + retrieval - evidence.successes * 2 - index / 100 };
  });
  priority.sort((a, b) => b.score - a.score);
  return priority[0]?.skill || "source";
}

export function assistanceLevelFor(progressValue, skill) {
  const progress = safeProgress(progressValue);
  const evidence = progress.skills[skill];
  if (!evidence) return 1;
  if (evidence.state === "returned") return 6;
  if (evidence.state === "transferred") return 5;
  return Math.max(1, Math.min(4, Number(evidence.supportLevel) || (evidence.state === "supported" ? 2 : 1)));
}

export function selectNextFamily(progressValue, intensity = "standard") {
  const progress = safeProgress(progressValue);
  const target = chooseNextSkill(progress);
  const recent = new Set(progress.familyRecency.slice(0, 2));
  return FAMILIES
    .filter((family) => family.operations.includes(target))
    .filter((family) => intensity !== "gentle" || family.intensity === "gentle")
    .sort((a, b) => Number(recent.has(a.id)) - Number(recent.has(b.id)) || a.id.localeCompare(b.id))[0] || FAMILIES[0];
}

export function sessionSummary(session) {
  const lines = [];
  const priority = ["separate", "scope", "test", "update", "transfer"];
  for (const skill of priority) {
    const outcome = session.outcomes[skill];
    if (!outcome) continue;
    const verb = outcome.status === "independent" ? "demonstrated" : outcome.repaired ? "repaired" : outcome.status === "supported" ? "completed with support" : "practised";
    lines.push({ skill, verb, label: SKILLS[skill] });
    if (lines.length === 3) break;
  }
  return lines;
}
