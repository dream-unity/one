import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  ACTIVE_SESSION_KEY,
  FAMILIES,
  GOLD,
  PREFERENCES_KEY,
  PROGRESS_KEY,
  RESUME_SNAPSHOT_KEY,
  SCENARIO_SCHEMA,
  SESSION_PLANS,
  advanceSession,
  assistanceLevelFor,
  chooseNextSkill,
  createSession,
  evaluateAction,
  evaluateEvidence,
  evaluateModel,
  evaluateReassurance,
  evaluateScope,
  evaluateSort,
  evaluateTest,
  evaluateTransfer,
  evaluateUpdate,
  lockCausalWorld,
  mergeSessionIntoProgress,
  recordEvaluation,
  resolveCausalWorld,
  safeProgress,
  selectNextFamily,
  totalBudget
} from "../exercises/cbt/engine.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("CBT is the visible Model experience and the former URL remains compatible", async () => {
  const [html, app, engine, navigation, legacy] = await Promise.all([
    read("exercises/cbt/index.html"),
    read("exercises/cbt/app.js"),
    read("exercises/cbt/engine.js"),
    read("portal-subnav.js"),
    read("exercises/model-forge/index.html")
  ]);
  assert.match(html, /Cognitive Behavioural Therapy \(CBT\)/);
  assert.match(html, /CBT is a structured way to examine how a situation/);
  assert.match(navigation, /new URL\("\.\/exercises\/cbt\/"/);
  assert.match(navigation, /machine-mind-model/);
  assert.match(legacy, /url=\.\.\/cbt\//);
  assert.doesNotMatch(`${html}\n${app}\n${engine}\n${navigation}\n${legacy}`, /Model Forge/i);
});

test("the three session envelopes are exact complete cycles", () => {
  const expected = new Map([[4, [17, 240]], [8, [21, 480]], [12, [25, 720]]]);
  for (const [duration, [screens, seconds]] of expected) {
    const plan = SESSION_PLANS[duration];
    assert.equal(plan.length, screens);
    assert.equal(totalBudget(plan), seconds);
    assert.equal(plan[0].id, "MF8-01");
    assert.equal(plan.at(-1).id, "MF8-21");
    for (const requiredPhase of ["trace", "test", "update", "transfer", "close"]) {
      assert.ok(plan.some((item) => item.phase === requiredPhase), `${duration} minutes omits ${requiredPhase}`);
    }
  }
});

test("a repair replaces optional four-minute variation without removing transfer or closure", () => {
  const session = createSession({ duration: 4, pacing: "clock" });
  session.attempts["MF8-04"] = 2;
  session.cursor = session.plan.findIndex((item) => item.id === "MF8-16");
  assert.equal(advanceSession(session, Infinity), "MF8-18");
  assert.ok(!session.plan.some((item) => item.id === "MF8-17"));
  assert.ok(session.plan.some((item) => item.id === "MF8-19"));
  assert.equal(session.plan.at(-1).id, "MF8-21");
});

test("the authored causal world rewards evidence accuracy rather than reassurance", () => {
  const placements = Object.fromEntries(GOLD.sortCards.map((card) => [card.id, card.target]));
  const evidence = Object.fromEntries(GOLD.evidenceRows.map((row) => [row.id, row.target]));
  const updates = Object.fromEntries(GOLD.updateClaims.map((claim) => [claim.id, claim.target]));

  assert.ok(evaluateSort(placements).pass);
  assert.ok(evaluateScope(0).pass);
  assert.ok(!evaluateScope(4).pass);
  assert.ok(evaluateModel({ cause: "threshold", scope: "parts", unknowns: ["reviewer-opinion"] }).pass);
  assert.ok(!evaluateModel({ cause: "broad-concern", scope: "role", unknowns: [] }).pass);
  assert.ok(evaluateTest({ source: "reviewer", action: "ask-criteria", result: "specific-scope", stop: "one-answer" }).pass);
  assert.ok(!evaluateTest({ source: "team-rumours", action: "ask-approval", result: "reassurance", stop: "until-certain" }).pass);
  assert.ok(evaluateEvidence(evidence).pass);
  assert.ok(evaluateUpdate(updates).pass);
  assert.ok(evaluateAction("revise-two", true).pass);
  assert.ok(evaluateTransfer({ scope: "Failed at 38°C", test: "Independently check the sensor" }).pass);
  assert.ok(evaluateReassurance({ problem: "keep", identity: "open", action: "redesign" }).pass);
  assert.ok(!evaluateReassurance({ problem: "remove", identity: "negative", action: "minimise" }).pass);
});

test("the causal-world engine locks truth before action and reveals authored outcomes only", () => {
  assert.equal(SCENARIO_SCHEMA.version, "cbt-causal-world/1");
  assert.ok(SCENARIO_SCHEMA.invariants.includes("identity-never-outcome-variable"));
  const lock = lockCausalWorld(GOLD);
  const cleanTest = { source: "requirements-log", action: "compare-versions", result: "rule-changed", stop: "one-record" };
  const first = resolveCausalWorld(lock, cleanTest);
  const repeated = resolveCausalWorld(lock, { ...cleanTest });
  assert.deepEqual(first, repeated);
  assert.equal(first.branch, "authored-outcome");
  assert.deepEqual(first.consequence, GOLD.outcome);

  const contaminated = resolveCausalWorld(lock, { source: "team-rumours", action: "accuse", result: "reassurance", stop: "until-certain" });
  assert.equal(contaminated.branch, "repair-required");
  assert.deepEqual(contaminated.consequence, []);
  assert.throws(() => resolveCausalWorld({ ...lock, variantId: "rewritten", lockId: "rewritten" }, cleanTest));
});

test("failure branches repair precisely and never masquerade as independent success", () => {
  const session = createSession({ duration: 8 });
  const failed = evaluateScope(4);
  assert.deepEqual(recordEvaluation(session, "MF8-06", failed), {
    attempts: 1, demonstrated: false, status: "repair", grade: 0
  });
  assert.deepEqual(recordEvaluation(session, "MF8-06", failed), {
    attempts: 2, demonstrated: true, status: "demonstrated", grade: 1
  });
  const repaired = recordEvaluation(session, "MF8-06", evaluateScope(0));
  assert.equal(repaired.status, "supported");
  assert.equal(repaired.grade, 1);
});

test("adaptive selection is local, bounded and based on task evidence", () => {
  const blank = safeProgress({ enabled: true });
  const target = chooseNextSkill(blank);
  assert.ok(typeof target === "string" && target.length > 0);
  const family = selectNextFamily({ ...blank, nextTarget: target }, "gentle");
  assert.ok(family.operations.includes(chooseNextSkill(blank)));
  assert.equal(family.intensity, "gentle");
  assert.equal(FAMILIES.length, 15);
  assert.equal(new Set(FAMILIES.map((item) => item.id)).size, 15);
  assert.ok(FAMILIES.every((item) => item.variants.length >= 3 && item.twin));
});

test("reasoning assistance fades only after distinct unassisted variants", () => {
  const first = createSession({ duration: 8 });
  first.variantId = "variant-a";
  first.outcomes.scope = { grade: 2, status: "independent", supportUsed: false };
  let adaptive = mergeSessionIntoProgress({ enabled: true }, first);
  assert.equal(adaptive.skills.scope.supportLevel, 1);

  const repeat = createSession({ duration: 8 });
  repeat.variantId = "variant-a";
  repeat.outcomes.scope = { grade: 2, status: "independent", supportUsed: false };
  adaptive = mergeSessionIntoProgress(adaptive, repeat);
  assert.equal(adaptive.skills.scope.supportLevel, 1, "repeating one answer key must not fade support");

  const changed = createSession({ duration: 8 });
  changed.variantId = "variant-b";
  changed.outcomes.scope = { grade: 2, status: "independent", supportUsed: false };
  adaptive = mergeSessionIntoProgress(adaptive, changed);
  assert.equal(adaptive.skills.scope.supportLevel, 2);
  assert.equal(assistanceLevelFor(adaptive, "scope"), 2);
  assert.equal(createSession({ duration: 8 }, "guided", adaptive).assistance.scope, 2);
});

test("privacy and safety boundaries are enforced by the static implementation", async () => {
  const [html, app, engine] = await Promise.all([
    read("exercises/cbt/index.html"), read("exercises/cbt/app.js"), read("exercises/cbt/engine.js")
  ]);
  assert.match(html, /Fictional material only\. Not diagnosis, crisis support, or a substitute for professional care\./);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(`${html}\n${app}`, /<textarea|contenteditable|type=["']text["']/i);
  assert.doesNotMatch(`${app}\n${engine}`, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|getUserMedia|mediaDevices|clipboard/i);
  assert.equal(ACTIVE_SESSION_KEY, "dreamunity:cbt:active:v2");
  assert.equal(PREFERENCES_KEY, "dreamunity:cbt:preferences:v2");
  assert.equal(PROGRESS_KEY, "dreamunity:cbt:progress:v2");
  assert.equal(RESUME_SNAPSHOT_KEY, "dreamunity:cbt:resume:v2");
  assert.match(app, /Remember practice progress on this device/i);
  assert.match(app, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(html, /Erase saved practice data/);
  assert.match(app, /No global score, speed bonus or personality judgment is produced/);
});

test("touch, keyboard, motion and target-size equivalents are present", async () => {
  const [html, app, css] = await Promise.all([
    read("exercises/cbt/index.html"), read("exercises/cbt/app.js"), read("exercises/cbt/styles.css")
  ]);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /class="skip-link"/);
  assert.match(app, /data-bin="shown"[\s\S]*role="button"[\s\S]*tabindex="0"/);
  assert.match(app, /addEventListener\("keydown"/);
  assert.match(app, /addEventListener\("dragstart"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.ok((css.match(/(?:min-height|height):\s*44px/g) || []).length >= 10);
});

test("the clock never submits or marks an active answer when nominal time expires", async () => {
  const app = await read("exercises/cbt/app.js");
  const expiryBranch = app.match(/if \(remaining <= 0\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(expiryBranch, /Finish step/);
  assert.doesNotMatch(expiryBranch, /\b(?:advance|click|submit|recordEvaluation)\s*\(/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /openPause\(true\)/);
});
