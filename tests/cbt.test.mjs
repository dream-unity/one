import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

// CBT_TEST_ROOT is only needed when running this review copy outside tests/.
const root = process.env.CBT_TEST_ROOT
  ? pathToFileURL(`${process.env.CBT_TEST_ROOT.replace(/\/$/, '')}/`)
  : new URL('../', import.meta.url);
const engine = await import(new URL('exercises/cbt/engine.js', root));
const { TRANSFER_CASES } = await import(new URL('exercises/cbt/scenarios.js', root));
const {
  VERSION, VARIANTS, WORLDS, EVIDENCE, ORIGINAL, SORT_CARDS, LOOP, STAGES,
  createSession, probeResult, executeProbe, knowledgeFrom, warrantedStatement,
  inspectTargets, evaluateSort, evaluateScope, evaluateLoop, evaluatePrediction,
  evaluateInspect, evaluateUpdate, evaluateAction, evaluateTransfer, recordAttempt,
  safeProgress, mergeProgress, assistanceFor, selectCases, completionSummary,
  planFor, nextStage
} = engine;
const read = name => readFile(new URL(name, root), 'utf8');
const make = (variant = 'local', extra = {}) => createSession({ variant, cases: TRANSFER_CASES, now: 1_800_000_000_000, ...extra });
const commitPrediction = session => { session.prediction = { model: ['units'], forecast: 'units', counter: 'history' }; };
const observed = (variant, probe = 'clarify') => { const session = make(variant); commitPrediction(session); executeProbe(session, probe); return session; };
const action = { dots: 4, colour: 'blue', columns: 4, practice: 3, question: 'criteria', returnWhen: 'new-or-review' };
const withRandom = (value, fn) => { const old = Math.random; Math.random = () => value; try { return fn(); } finally { Math.random = old; } };

test('all 24 world/action combinations release only their authored source records', () => {
  const direct = {
    local: { rubric: ['L1', 'L2'], clarify: ['L1', 'L2', 'L3'] },
    broader: { rubric: ['B1'], clarify: ['B1', 'B2', 'B3'] },
    mixed: { rubric: ['M1', 'M2'], clarify: ['M1', 'M2', 'M3', 'M4'] },
    unresolved: { rubric: ['U2'], clarify: ['U2', 'U3'] }
  };
  const other = { reassure: ['R1'], cosmetic: ['C1'], accuse: ['A1'], wait: ['W1'] };
  assert.deepEqual(VARIANTS, Object.keys(direct));
  for (const [variant, tests] of Object.entries(direct)) {
    for (const [probe, expected] of Object.entries({ ...tests, ...other })) {
      const response = probeResult(WORLDS[variant], probe);
      assert.deepEqual(response.ids, expected, `${variant}/${probe} released the wrong evidence`);
      assert.ok(response.effect.length > 10 && response.source.length > 3);
      assert.ok(response.ids.every(id => EVIDENCE[id]));
    }
  }
  assert.throws(() => probeResult(WORLDS.local, 'invent-a-reply'), /choice could not be found/);
  assert.throws(() => probeResult({ id: 'invent-a-world' }, 'clarify'), /story could not be opened/);
});

test('a forecast is required before a consequence appears; failure leaves state untouched', () => {
  const session = make('mixed');
  assert.throws(() => executeProbe(session, 'clarify'), /expect to find before you look/);
  assert.deepEqual(session.evidence, []);
  assert.deepEqual(session.probes, []);
  commitPrediction(session);
  assert.deepEqual(executeProbe(session, 'rubric').ids, ['M1', 'M2']);
});

test('the initial world survives a contaminated probe and its single focused repair', () => {
  for (const variant of VARIANTS) {
    const session = make(variant), locked = session.world;
    assert.ok(Object.isFrozen(locked) && Object.isFrozen(locked.full) && Object.isFrozen(locked.rubric));
    const before = structuredClone(locked);
    commitPrediction(session);
    executeProbe(session, 'accuse');
    assert.deepEqual(session.evidence, ['A1']);
    executeProbe(session, 'clarify');
    assert.equal(session.world, locked);
    assert.deepEqual(session.world, before);
    assert.deepEqual(session.evidence, ['A1', ...before.full]);
    const evidenceBeforeThird = [...session.evidence];
    assert.throws(() => executeProbe(session, 'clarify'), /You have tried twice/);
    assert.deepEqual(session.evidence, evidenceBeforeThird);
    assert.equal(session.probes.length, 2);
  }
});

test('returned evidence arrays cannot rewrite the underlying world and duplicate cards are not new evidence', () => {
  const result = probeResult(WORLDS.mixed, 'rubric');
  result.ids.push('B2');
  assert.deepEqual(probeResult(WORLDS.mixed, 'rubric').ids, ['M1', 'M2']);
  const session = observed('local', 'rubric');
  executeProbe(session, 'clarify');
  assert.deepEqual(session.evidence, ['L1', 'L2', 'L3']);
});

test('hidden broader history never enters a rubric-only inference', () => {
  const broader = observed('broader', 'rubric');
  const mixed = observed('mixed', 'rubric');
  assert.deepEqual(broader.evidence, ['B1']);
  assert.equal(knowledgeFrom(broader.evidence).state, 'partial');
  assert.equal(knowledgeFrom(mixed.evidence).state, 'local');
  for (const session of [broader, mixed]) {
    assert.equal(knowledgeFrom(session.evidence).repeated, false);
    assert.equal(inspectTargets(session.evidence).find(t => t.id === 'pattern').answer, 'open');
    assert.equal(evaluateInspect(session.evidence, { units: 'supported', pattern: 'supported', identity: 'unsupported' }).pass, false);
  }
  executeProbe(mixed, 'clarify');
  assert.equal(knowledgeFrom(mixed.evidence).state, 'mixed');
  assert.equal(knowledgeFrom(mixed.evidence).repeated, true);
});

test('reassurance, accusation, cosmetic changes and waiting do not settle the original question', () => {
  for (const variant of VARIANTS) for (const probe of ['reassure', 'accuse', 'cosmetic', 'wait']) {
    const session = observed(variant, probe), knowledge = knowledgeFrom(session.evidence);
    assert.equal(knowledge.state, 'unresolved', `${variant}/${probe}`);
    assert.equal(knowledge.nonDiagnostic, true);
    assert.equal(knowledge.scopeOpen, true);
    assert.equal(evaluateInspect(session.evidence, { units: 'open', pattern: 'open', identity: 'unsupported' }).pass, true);
  }
  assert.equal(knowledgeFrom(['M4']).repeated, false, 'a summary is not an additional historical observation');
});

test('updates preserve the original fact and distinguish all five visible evidence states', () => {
  const expectations = [
    ['local', 'clarify', 'local', 'Two parts need a change. I still do not know what they think about Ari’s other work.'],
    ['broader', 'clarify', 'broader', 'Ari has missed a dot before. Counting dots needs practice. This does not mean Ari can never learn.'],
    ['mixed', 'clarify', 'mixed', 'The box rule changed, and Ari has missed a dot before. Both things need care.'],
    ['broader', 'rubric', 'partial', 'Part A needs another blue dot. I still need to ask about Part B and Ari’s other work.'],
    ['unresolved', 'clarify', 'unresolved', 'Two parts were marked. I still do not know why, or whether other work needs care too.']
  ];
  for (const [variant, probe, state, text] of expectations) {
    const session = observed(variant, probe);
    assert.equal(knowledgeFrom(session.evidence).state, state);
    assert.equal(warrantedStatement(session.evidence), text);
    assert.equal(evaluateUpdate(session, 'keep', text).pass, true);
    assert.equal(evaluateUpdate(session, 'remove', text).pass, false);
    for (const other of expectations.map(row => row[3]).filter(other => other !== text)) {
      assert.equal(evaluateUpdate(session, 'keep', other).pass, false, `${state} incorrectly accepted another evidence state`);
    }
    assert.deepEqual(session.original, ORIGINAL, 'checking an update must not rewrite the committed original');
  }
});

test('the practical check validates dot count, colour, boxes, practice and a bounded return condition', () => {
  for (const variant of VARIANTS) assert.equal(evaluateAction(observed(variant).evidence, action).pass, true);
  const mixed = observed('mixed').evidence;
  for (const [field, wrong, defect] of [['colour', 'red', 'units'], ['dots', 3, 'units'], ['columns', 3, 'layout'], ['practice', 4, 'practice'], ['returnWhen', 'certain', 'stopping']]) {
    const result = evaluateAction(mixed, { ...action, [field]: wrong });
    assert.equal(result.pass, false, `wrong ${field} passed`);
    assert.ok(result.defects.includes(defect));
  }
  assert.equal(evaluateAction(mixed, { ...action, dots: '4', columns: '4', practice: '3' }).pass, true, 'control strings represent the same counts');
});

test('missing criteria require a question, while unobserved criteria are never certified as corrected', () => {
  const partial = observed('broader', 'rubric').evidence;
  assert.equal(evaluateAction(partial, { ...action, question: 'approve' }).pass, false);
  assert.equal(evaluateAction(partial, { ...action, columns: undefined, practice: undefined }).pass, true);
  const unresolved = observed('unresolved').evidence;
  assert.equal(evaluateAction(unresolved, { question: 'criteria', returnWhen: 'new-or-review' }).pass, true);
  assert.equal(evaluateAction(unresolved, { question: 'approve', returnWhen: 'new-or-review' }).pass, false);
  assert.equal(knowledgeFrom(unresolved).units, false);
  assert.equal(knowledgeFrom(unresolved).layout, false);
  const local = observed('local').evidence;
  assert.equal(evaluateAction(local, { ...action, question: undefined, practice: undefined }).pass, true);
});

test('source attribution and causal ordering reject unsupported additions', () => {
  const correct = Object.fromEntries(SORT_CARDS.map(c => [c.id, c.source]));
  assert.equal(evaluateSort(correct).pass, true);
  assert.equal(evaluateSort({ ...correct, feeling: 'unshown' }).pass, false, 'the explicitly supplied feeling is an observation about the character');
  assert.equal(evaluateSort({ ...correct, judgment: 'message' }).pass, false);
  assert.equal(evaluateScope('panels').pass, true);
  assert.equal(evaluateScope('identity').pass, false);
  const order = LOOP.map(t => t.id);
  assert.equal(evaluateLoop(order).pass, true);
  assert.equal(evaluateLoop([...order, 'meaning']).pass, false, 'extra links cannot be smuggled into a correct chain');
  assert.equal(evaluateLoop([...order].reverse()).pass, false);
});

test('a prediction follows the constructed cause; overlapping explanations are allowed', () => {
  assert.equal(evaluatePrediction(['units'], 'units', 'history').pass, true);
  assert.equal(evaluatePrediction(['units'], 'rule', 'history').pass, false);
  assert.equal(evaluatePrediction(['rule'], 'rule', 'history').pass, true);
  assert.equal(evaluatePrediction(['rule', 'skill'], 'skill', 'history').pass, true);
  assert.equal(evaluatePrediction(['rule', 'skill'], 'rule', 'history').pass, true);
  assert.equal(evaluatePrediction(['units'], 'units', 'calm').pass, false);
  assert.equal(evaluatePrediction(['units'], 'tone', 'history').pass, false);
});

test('24 complete transfer cases form 12 contrasting families with resolvable action/reason contracts', () => {
  assert.equal(TRANSFER_CASES.length, 24);
  assert.equal(new Set(TRANSFER_CASES.map(c => c.id)).size, 24);
  const families = new Map();
  for (const c of TRANSFER_CASES) {
    families.set(c.family, (families.get(c.family) || 0) + 1);
    for (const field of ['id', 'family', 'title', 'scene', 'claim', 'skill', 'principle', 'explanation']) assert.ok(typeof c[field] === 'string' && c[field].trim(), `${c.id}: missing ${field}`);
    assert.ok(c.facts.length >= 2 && c.facts.every(f => typeof f === 'string' && f.trim()));
    assert.equal(new Set(c.options.map(o => o.id)).size, c.options.length);
    assert.equal(new Set(c.reasons.map(r => r.id)).size, c.reasons.length);
    assert.ok(c.options.some(o => o.valid) && c.options.some(o => !o.valid), `${c.id}: no discrimination task`);
    for (const o of c.options) {
      assert.ok(o.label.length > 5 && o.effect.length > 5);
      assert.equal(typeof o.valid, 'boolean');
      assert.ok(Array.isArray(o.reasonIds));
      assert.ok(o.reasonIds.every(id => c.reasons.some(r => r.id === id)), `${c.id}/${o.id}: missing reason reference`);
      if (o.valid) assert.ok(o.reasonIds.length > 0, `${c.id}/${o.id}: valid action has no defensible rationale`);
    }
  }
  assert.equal(families.size, 12);
  assert.ok([...families.values()].every(n => n === 2));
});

test('every transfer action requires its own defensible reason; an attractive reason cannot rescue a wrong action', () => {
  for (const c of TRANSFER_CASES) {
    for (const o of c.options) for (const r of c.reasons) {
      assert.equal(evaluateTransfer(c, o.id, r.id).pass, o.valid && o.reasonIds.includes(r.id), `${c.id}/${o.id}/${r.id}`);
    }
    assert.equal(evaluateTransfer(c, 'absent-action', c.reasons[0].id).pass, false);
    assert.equal(evaluateTransfer(c, c.options.find(o => o.valid).id, 'absent-reason').pass, false);
  }
});

test('first independent attempts remain separate from successful repairs and familiar cue recall', () => {
  const session = make();
  recordAttempt(session, { stage: 'transfer', skill: 'scope', pass: false, mode: 'independent', caseId: 'prototype-local', answer: { move: 'a', reason: 'r1' }, now: 100 });
  recordAttempt(session, { stage: 'transfer', skill: 'scope', pass: true, mode: 'repair', caseId: 'prototype-local', answer: { move: 'b', reason: 'r2' }, now: 101 });
  recordAttempt(session, { stage: 'close', skill: 'retrieval', pass: true, mode: 'guided', answer: ['fact', 'test', 'update'], now: 102 });
  const summary = completionSummary(session);
  assert.equal(summary.independentAttempts, 1);
  assert.equal(summary.independentSuccesses, 0);
  assert.equal(summary.repairs, 1);
  assert.equal(summary.complete, false);
  const progress = mergeProgress({}, session);
  assert.deepEqual(progress.records.map(r => [r.skill, r.pass, r.mode]), [['scope', false, 'independent'], ['scope', true, 'repair'], ['retrieval', true, 'guided']]);
  assert.deepEqual(progress.used, ['prototype-local']);
});

test('preserved attempt answers are snapshots rather than references to a later mutable response', () => {
  const session = make(), answer = { move: 'a', model: ['units'] };
  recordAttempt(session, { stage: 'transfer', skill: 'scope', pass: false, mode: 'independent', caseId: 'prototype-local', answer });
  answer.move = 'b'; answer.model.push('skill');
  assert.deepEqual(session.attempts[0].answer, { move: 'a', model: ['units'] });
});

test('support fades after independent success in distinct cases and returns after difficulty', () => {
  const rec = (caseId, pass = true, mode = 'independent') => ({ skill: 'scope', caseId, pass, mode, at: 100 });
  assert.equal(assistanceFor({ records: [rec('same'), rec('same')] }, 'scope'), 'guided');
  assert.equal(assistanceFor({ records: [rec('one'), rec('two', true, 'repair')] }, 'scope'), 'guided');
  assert.equal(assistanceFor({ records: [rec('one'), rec('two')] }, 'scope'), 'faded');
  assert.equal(assistanceFor({ records: [rec('one'), rec('two'), rec('three', false)] }, 'scope'), 'guided');
  assert.equal(assistanceFor({ records: [rec('one'), rec('two')] }, 'prediction'), 'guided');
});

test('case selection responds to practiced IDs and skill gaps while varying families', () => {
  const pool = [
    { id: 'seen', family: 'a', skill: 'scope' },
    { id: 'fresh-scope', family: 'b', skill: 'scope' },
    { id: 'fresh-action', family: 'c', skill: 'action' },
    { id: 'same-family', family: 'b', skill: 'scope' }
  ];
  const progress = { used: ['seen'], records: [{ skill: 'scope', caseId: 'seen', at: 100, pass: false, mode: 'independent' }] };
  const picks = selectCases(pool, progress, 2, () => 0.99);
  assert.equal(picks[0].id, 'fresh-scope');
  assert.equal(picks[1].id, 'fresh-action');
  assert.equal(new Set(picks.map(c => c.family)).size, 2);
});

test('a delayed skill return reserves a different case from the new transfer items', () => {
  const pool = [
    { id: 'fresh-scope', family: 'a', skill: 'scope' },
    { id: 'fresh-action', family: 'b', skill: 'action' },
    { id: 'fresh-source', family: 'c', skill: 'sources' }
  ];
  const now = 1_800_000_000_000;
  const progress = { used: ['old-scope'], records: [{ skill: 'scope', caseId: 'old-scope', at: now - 2 * 86400000, pass: true, mode: 'independent' }] };
  const session = withRandom(0.99, () => createSession({ minutes: 12, cases: pool, progress, now }));
  assert.ok(session.plan.includes('recall'));
  assert.equal(session.cases[2].skill, 'scope');
  assert.notEqual(session.cases[2].id, 'old-scope');
  assert.equal(new Set(session.cases.map(c => c.id)).size, session.cases.length, 'the recall case must not repeat later as an unfamiliar case');
});

test('expiry cannot skip committed inspection, update or practical action', () => {
  for (const minutes of [4, 8, 12]) {
    const session = make('mixed', { minutes });
    commitPrediction(session); executeProbe(session, 'clarify');
    session.cursor = session.plan.indexOf('probe');
    assert.equal(nextStage(session, 0), 'inspect');
    assert.equal(nextStage(session, 0), 'update');
    assert.equal(nextStage(session, 0), 'act');
  }
  const extended = make('local', { minutes: 12 });
  extended.cursor = extended.plan.indexOf('act');
  assert.equal(nextStage(extended, 0), 'transfer', 'optional enrichment is dropped before the main independent case');
  assert.ok(planFor(4).includes('close'));
  assert.equal(planFor(8).reduce((sum, id) => sum + STAGES[id].seconds, 0), 480);
});

test('partial closure never claims a complete cycle or action that was not performed', () => {
  const session = make();
  session.completed = ['arrival', 'probe', 'inspect'];
  let summary = completionSummary(session);
  assert.equal(summary.complete, false); assert.equal(summary.updated, false); assert.equal(summary.acted, false);
  session.completed.push('update');
  summary = completionSummary(session);
  assert.equal(summary.complete, false); assert.equal(summary.updated, true); assert.equal(summary.acted, false);
  session.completed.push('act'); session.actionDone = true;
  summary = completionSummary(session);
  assert.equal(summary.complete, true); assert.equal(summary.acted, true);
});

test('progress keeps only bounded task records, without answers or personal narratives', () => {
  const records = Array.from({ length: 150 }, (_, i) => ({ skill: 'scope', caseId: `case-${i}`, at: i, pass: true, mode: 'independent', answer: 'discard this', story: 'discard this' }));
  const cleaned = safeProgress({ sessions: 5, records, secret: 'discard this' });
  assert.equal(cleaned.version, VERSION); assert.equal(cleaned.records.length, 120);
  assert.ok(cleaned.records.every(r => !('answer' in r) && !('story' in r)));
  assert.equal('secret' in cleaned, false);
  assert.deepEqual(safeProgress(null).records, []);
});

test('the browser clock offers continuation or an honest partial finish rather than submitting', async () => {
  const app = await read('exercises/cbt/app.js');
  const tick = app.slice(app.indexOf('function tick()'), app.indexOf('setInterval(tick'));
  assert.match(tick, /document\.hidden/);
  assert.match(tick, /Add 2 minutes/);
  assert.match(tick, /Stop here/);
  assert.doesNotMatch(tick, /\b(?:submit|markAndNext|executeProbe|evaluateUpdate|recordAttempt)\s*\(/);
});
