import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../exercises/heart/practice.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'practice.js' });
const H = context.HeartPractice;
const plain = value => JSON.parse(JSON.stringify(value));

test('breath plans preserve all lengths, stage boundaries and the chosen pace through completion', () => {
  for (const length of [180, 300, 600, 900, 1800, 3600, 7200, 10800]) {
    for (const pace of [5, 4, 0]) {
      const plan = H.makeBreathPlan(length, { pace });
      const firstBoundary = Math.round(length * .33);
      const secondBoundary = Math.round(length * .66);
      assert.equal(plan.kind, 'breath');
      assert.equal(plan.totalSeconds, length);
      assert.deepEqual(plain(plan.map(step => step.seconds)), [firstBoundary, secondBoundary - firstBoundary, length - secondBoundary]);
      assert.deepEqual(plain(plan.map(step => step.pace)), [pace, pace, pace]);
      const state = H.createSession(plan, 100);
      for (const [boundary, index] of [[firstBoundary, 1], [secondBoundary, 2]]) {
        H.advance(state, 100 + boundary * 1000 - 1);
        assert.equal(state.index, index - 1, 'the prior stage lasts until its precise boundary');
        H.advance(state, 100 + boundary * 1000);
        assert.equal(state.index, index);
        assert.equal(state.stepElapsedMs, 0);
        assert.equal(H.elapsedSeconds(state), boundary, 'stage changes preserve total breath time');
        assert.equal(H.currentStep(state).pace, pace, 'a later stage does not silently remove pacing');
      }
      H.advance(state, 100 + length * 1000 - 1);
      assert.equal(state.status, 'running');
      H.advance(state, 100 + length * 1000);
      assert.equal(state.status, 'complete');
      assert.equal(H.elapsedSeconds(state), length);
      assert.equal(H.remainingSeconds(state), 0);
      assert.equal(H.currentStep(state), null);
      assert.equal(H.summary(state).completed, true);
    }
  }
});

test('love, gratitude, appreciation and compassion each retain simultaneous felt emotion and heart attention', () => {
  const invitations = new Set();
  for (const feeling of ['love', 'gratitude', 'appreciation', 'compassion']) {
    const plan = H.makeBreathPlan(900, { feeling });
    invitations.add(plan[1].prompt);
    for (const step of plan) {
      for (const cue of [step.prompt, step.inhale, step.exhale]) {
        assert.match(cue, new RegExp(feeling + '|the feeling'));
        assert.match(cue, /heart|chest/i, `${feeling} must remain paired with heart-area attention`);
      }
      assert.ok(step.question.length > 0, 'every stage retains a deeper inquiry');
    }
    assert.match(plan[1].prompt, /feeling itself|felt experience|felt response/i);
    assert.match(plan[2].prompt, /deeper|steadier|stronger/i);
    const comparison = H.makeComparePlan({ feeling });
    for (const block of comparison.filter(step => step.condition === 'care' && !step.wait)) {
      assert.match(block.prompt, /felt emotion and heart-area attention together/);
      assert.match(block.title, new RegExp(feeling));
    }
  }
  assert.equal(invitations.size, 4, 'each selected feeling has its own invitation');
  const breathingOnly = H.makeBreathPlan(900, { kindness: false });
  assert.ok(breathingOnly.every(step => /do not deliberately add a feeling/.test(step.prompt)));
});

test('the full body map cycles all seven dimensions every 30 seconds at every original length', () => {
  const dimensions = ['location', 'quality', 'intensity', 'motion', 'direction', 'alignment', 'valence'];
  for (const length of [900, 1800, 3600]) {
    const plan = H.makeBodyPlan(length);
    assert.equal(plan.kind, 'body');
    assert.equal(plan.totalSeconds, length);
    assert.equal(plan.length, length / 30);
    assert.equal(new Set(plan.map(step => step.id)).size, plan.length);
    const state = H.createSession(plan);
    for (let index = 0; index < plan.length; index++) {
      const step = H.currentStep(state);
      assert.equal(step.key, dimensions[index % 7]);
      assert.equal(step.dimension, index % 7);
      assert.equal(step.round, Math.floor(index / 7) + 1);
      assert.equal(step.seconds, 30);
      assert.equal(step.pace, 0);
      assert.ok(!step.wait);
      assert.ok(step.question.length > 0);
      H.advance(state, (index + 1) * 30_000 - 1);
      assert.equal(H.currentStep(state).id, step.id);
      H.advance(state, (index + 1) * 30_000);
    }
    assert.equal(state.status, 'complete', 'private reflection never requires entering an answer');
    assert.equal(state.answers.length, 0);
    assert.equal(state.completedStepIds.length, plan.length);
    assert.equal(H.elapsedSeconds(state), length);
  }
  const plan = H.makeBodyPlan(900);
  assert.deepEqual(plain(plan[2].choices.map(choice => choice.value)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'unclear']);
  assert.deepEqual(plain(plan[6].choices.map(choice => choice.value)), ['pleasant', 'unpleasant', 'neutral', 'mixed', 'unclear']);
  const state = H.createSession(plan);
  H.advance(state, 60_000); H.answer(state, 10);
  assert.equal(state.answers[0].value, 10);
  H.advance(state, 180_000); H.answer(state, 'mixed');
  assert.equal(state.answers[1].value, 'mixed');
});

test('the extra body check retains eight 30-second steps per round and optional choices', () => {
  for (const length of [240, 480, 720]) {
    const plan = H.makeBodyCheckPlan(length);
    assert.equal(plan.kind, 'body');
    assert.equal(plan.totalSeconds, length);
    assert.equal(plan.length, length / 30);
    assert.ok(plan.every(step => step.seconds === 30 && step.pace === 0 && !step.wait));
    assert.equal(new Set(plan.map(step => step.id)).size, plan.length);
    for (let round = 1; round <= length / 240; round += 1) {
      const steps = plan.filter(step => step.round === round);
      assert.equal(steps.length, 8);
      assert.deepEqual(plain(steps[2].choices.map(choice => choice.value)), [0, 1, 2, 3, 4, 'unclear']);
      assert.equal(steps[2].choices[2].label, 'Medium', 'strength is distinct from perceptual clarity');
      assert.deepEqual(plain(steps[3].choices.map(choice => choice.value)), ['low', 'mid', 'high', 'unclear']);
      assert.deepEqual(plain(steps[5].choices.map(choice => choice.value)), ['same', 'changed', 'unclear']);
    }
    const state = H.createSession(plan);
    H.advance(state, length * 1000);
    assert.equal(state.status, 'complete', 'every check can pass without a personal answer');
    assert.equal(state.answers.length, 0);
    assert.equal(state.completedStepIds.length, plan.length);
  }
});

test('comparison balances both condition orders and keeps an equal paced dose', () => {
  for (const first of ['breath', 'care']) {
    for (const pace of [5, 4, 0]) {
      const plan = H.makeComparePlan({ first, pace });
      const other = first === 'breath' ? 'care' : 'breath';
      const blocks = plan.filter(step => !step.wait);
      assert.equal(plan.kind, 'compare');
      assert.equal(plan.totalSeconds, 240);
      assert.deepEqual(plain(blocks.map(step => step.condition)), [first, other, other, first]);
      assert.deepEqual(plain(blocks.map(step => step.round)), [1, 2, 3, 4]);
      assert.ok(blocks.every(step => step.pace === pace && step.seconds === 60));
      assert.equal(blocks.filter(step => step.condition === 'care').reduce((sum, step) => sum + step.seconds, 0), 120);
      assert.equal(blocks.filter(step => step.condition === 'breath').reduce((sum, step) => sum + step.seconds, 0), 120);
      assert.equal(plan.filter(step => step.wait).length, 5);
      assert.ok(plan.filter(step => step.wait).every(step => step.seconds === 0 && step.choices.some(choice => choice.value === 'skip')));
      assert.match(plan[0].prompt, /Which way do you think will feel easier/);
      for (const rating of plan.filter(step => step.wait && step.condition)) {
        assert.equal(rating.title, 'How easy did that feel?');
        assert.deepEqual(plain(rating.choices.slice(0, 5).map(choice => choice.label)), ['Very hard', 'A bit hard', 'In between', 'Quite easy', 'Very easy']);
      }
    }
  }
});

test('wait gates discard excess time, require an answer and accept zero, unclear and skip', () => {
  const state = H.createSession(H.makeComparePlan({ first: 'care' }));
  H.advance(state, 1_000_000);
  assert.equal(state.status, 'waiting');
  assert.equal(H.elapsedSeconds(state), 0);
  H.continueStep(state, 1_000_000);
  assert.equal(state.index, 0);
  H.answer(state, 'skip');
  H.continueStep(state, 1_000_000);
  assert.equal(state.status, 'running');
  let now = 1_000_000;
  const ratings = [0, 'unclear', 'skip', 4];
  for (let round = 0; round < 4; round += 1) {
    now += 3_600_000;
    H.advance(state, now);
    assert.equal(state.status, 'waiting');
    assert.equal(H.elapsedSeconds(state), (round + 1) * 60);
    const id = H.currentStep(state).id;
    H.continueStep(state, now, id);
    assert.equal(H.currentStep(state).id, id, 'an unanswered rating cannot pass');
    H.answer(state, ratings[round], id);
    H.continueStep(state, now, id);
  }
  const report = H.summary(state);
  assert.equal(state.status, 'complete');
  assert.equal(report.elapsedSeconds, 240);
  assert.equal(report.totalSeconds, 240);
  assert.equal(report.kind, 'compare');
  assert.deepEqual(plain(report.answers.map(record => record.value)), ['skip', ...ratings]);
  assert.deepEqual(plain(report.answers.slice(1).map(record => record.condition)), ['care', 'breath', 'breath', 'care']);
  assert.ok(report.order.every(block => block.completed));
});

test('pause excludes a large hidden interval and preserves exact partial-second time', () => {
  const state = H.createSession(H.makeBreathPlan(180), 10);
  H.advance(state, 10_260);
  H.pause(state, 15_760);
  assert.equal(H.elapsedSeconds(state), 15.75);
  assert.equal(state.status, 'paused');
  H.advance(state, 100_000_000);
  assert.equal(H.elapsedSeconds(state), 15.75);
  H.answer(state, 0);
  H.continueStep(state, 100_000_000);
  assert.equal(state.status, 'paused');
  H.resume(state, 100_001_000);
  H.advance(state, 100_005_250);
  assert.equal(state.status, 'running');
  assert.equal(H.elapsedSeconds(state), 20);
  assert.equal(H.remainingSeconds(state), 160);
});

test('pausing an answered wait restores the wait and does not start the next block', () => {
  const state = H.createSession(H.makeComparePlan());
  H.answer(state, 'same');
  H.pause(state, 100);
  H.resume(state, 900_000);
  assert.equal(state.status, 'waiting');
  assert.equal(state.index, 0);
  assert.equal(H.elapsedSeconds(state), 0);
  H.continueStep(state, 900_000);
  H.advance(state, 905_000);
  assert.equal(H.elapsedSeconds(state), 5);
});

test('a pause landing at a timed boundary preserves the next wait', () => {
  const state = H.createSession(H.makeComparePlan());
  H.answer(state, 'breath');
  H.continueStep(state, 0);
  H.pause(state, 60_000);
  assert.equal(state.status, 'paused');
  assert.equal(state.pausedStatus, 'waiting');
  H.resume(state, 99_000);
  assert.equal(state.status, 'waiting');
  assert.equal(H.elapsedSeconds(state), 60);
});

test('invalid and stale choice values cannot alter answers or advance a card', () => {
  const state = H.createSession(H.makeComparePlan());
  const prediction = H.currentStep(state).id;
  for (const invalid of [0, '', false, null, undefined, NaN, Infinity, {}, 'missing']) H.answer(state, invalid);
  assert.equal(state.answers.length, 0);
  H.answer(state, 'care', 'old-card');
  assert.equal(state.answers.length, 0);
  H.answer(state, 'care', prediction);
  H.answer(state, 'same', prediction);
  assert.equal(state.answers.length, 1, 'changing the current choice replaces the record');
  H.continueStep(state, 0, 'old-card');
  assert.equal(state.status, 'waiting');
  H.continueStep(state, 0, prediction);
  H.advance(state, 60_000);
  const rating = H.currentStep(state).id;
  H.answer(state, '0', rating);
  assert.equal(state.answers.length, 1, 'the numeric choice is not the string zero');
  H.answer(state, 0, rating);
  H.continueStep(state, 60_000, rating);
  H.advance(state, 120_000);
  H.answer(state, 0, rating);
  H.continueStep(state, 120_000, rating);
  assert.equal(state.status, 'waiting', 'a stale click cannot answer the next identical rating');
  assert.equal(state.answers.length, 2);
});

test('time is finite and monotonic; stale time cannot rewind or resume a session', () => {
  const state = H.createSession(H.makeBodyCheckPlan(240), 100);
  H.advance(state, 1000);
  for (const time of [-1, 0, 999, NaN, Infinity, -Infinity, '2000', undefined]) {
    H.advance(state, time);
    H.pause(state, time);
    assert.equal(state.status, 'running');
    assert.equal(state.lastNow, 1000);
    assert.equal(H.elapsedSeconds(state), .9);
  }
  H.pause(state, 1000);
  H.resume(state, 999);
  H.resume(state, Infinity);
  assert.equal(state.status, 'paused');
  H.resume(state, 1000);
  assert.equal(state.status, 'running');
  assert.throws(() => H.createSession(H.makeBodyCheckPlan(240), -1));
  assert.throws(() => H.createSession(H.makeBodyCheckPlan(240), Infinity));
});

test('ending early records only actual time and never marks unvisited steps complete', () => {
  const state = H.createSession(H.makeBodyCheckPlan(240));
  H.advance(state, 75_000);
  H.answer(state, 0);
  H.finish(state);
  const report = H.summary(state);
  assert.equal(report.label, 'Ended early');
  assert.equal(report.completed, false);
  assert.equal(report.elapsedSeconds, 75);
  assert.equal(report.remainingSeconds, 165);
  assert.equal(report.completedStepIds.length, 2);
  assert.equal(report.answers[0].value, 0);
  assert.equal(H.currentStep(state), null);
  H.advance(state, 1_000_000);
  H.pause(state, 1_000_000);
  H.resume(state, 1_000_000);
  H.answer(state, 4);
  H.continueStep(state, 1_000_000);
  assert.deepEqual(plain(H.summary(state)), plain(report));
});

test('completed sessions stay completed and partial comparison summaries identify unfinished blocks', () => {
  const complete = H.createSession(H.makeBreathPlan(180));
  H.advance(complete, 180_000);
  H.finish(complete);
  H.advance(complete, 200_000);
  assert.equal(H.summary(complete).label, 'Completed');
  const partial = H.createSession(H.makeComparePlan());
  H.answer(partial, 'unclear');
  H.continueStep(partial, 0);
  H.advance(partial, 60_000);
  H.finish(partial);
  assert.deepEqual(plain(H.summary(partial).order.map(block => block.completed)), [true, false, false, false]);
  assert.equal(H.summary(partial).answers.length, 1);
});

test('a new session owns its plan, and reports cannot mutate recorded answers', () => {
  const plan = H.makeComparePlan();
  const state = H.createSession(plan);
  plan[0].choices[0].value = 'changed-outside';
  plan[0].title = 'Changed outside';
  H.answer(state, 'breath');
  assert.equal(state.answers[0].value, 'breath');
  assert.notEqual(H.currentStep(state).title, 'Changed outside');
  const report = H.summary(state);
  report.answers[0].value = 'changed-report';
  report.completedStepIds.push('invented');
  assert.equal(H.summary(state).answers[0].value, 'breath');
  assert.equal(state.completedStepIds.length, 0);
});

test('factories and custom plans reject unsupported lengths, ambiguous choices, and invalid timing', () => {
  for (const length of [0, 15, 179, 240, 720, 10801, '180', NaN, Infinity]) assert.throws(() => H.makeBreathPlan(length));
  for (const length of [0, 180, 240, 480, 720, 10800, '900', NaN, Infinity]) assert.throws(() => H.makeBodyPlan(length));
  for (const length of [0, 180, 241, 900, '240', NaN, Infinity]) assert.throws(() => H.makeBodyCheckPlan(length));
  for (const feeling of ['kindness', 'joy', '', null, 1]) {
    assert.throws(() => H.makeBreathPlan(900, { feeling }));
    assert.throws(() => H.makeComparePlan({ feeling }));
  }
  for (const pace of [1, 6, '5', null, NaN]) {
    assert.throws(() => H.makeBreathPlan(180, { pace }));
    assert.throws(() => H.makeComparePlan({ pace }));
  }
  assert.throws(() => H.makeBreathPlan(180, { kindness: 'yes' }));
  assert.throws(() => H.makeComparePlan({ first: 'random' }));
  const valid = H.makeBodyCheckPlan(240)[0];
  for (const bad of [
    [], [valid, valid], [{ ...valid, seconds: 0 }], [{ ...valid, seconds: .5 }],
    [{ ...valid, seconds: Infinity }], [{ ...valid, seconds: -1 }],
    [{ ...valid, pace: 99 }], [{ ...valid, wait: true }],
    [{ ...valid, seconds: 0, wait: true }], [{ ...valid, choices: [] }],
    [{ ...valid, choices: [{ value: 0, label: 'One' }, { value: 0, label: 'Two' }] }],
    [{ ...valid, choices: [{ value: Infinity, label: 'Infinite' }] }]
  ]) assert.throws(() => H.createSession(bad));
});

test('practice cards retain inquiry and uncertainty without physiological or accuracy promises', () => {
  const plans = [H.makeBreathPlan(10800), H.makeBreathPlan(180, { kindness: false }), H.makeBodyPlan(3600), H.makeBodyCheckPlan(720), H.makeComparePlan()];
  for (const plan of plans) {
    for (const step of plan) {
      assert.ok(step.prompt.length > 0 && step.question.length > 0, `${step.id} needs both a clear action and a deeper question`);
      assert.doesNotMatch(step.prompt, /\b(?:cure|diagnos\w*|trauma release|vagal tone|brain.?wave|unlock|synchroni[sz]e)\b/i);
    }
  }
  const body = H.makeBodyCheckPlan(720);
  assert.ok(body.filter(step => step.choices).every(step => step.choices.some(choice => choice.value === 'unclear')));
  assert.match(body[3].prompt, /different from how strong/);
  assert.match(body[3].prompt, /do not need to guess/);
  assert.match(body[4].prompt, /colour or a sound/);
  assert.notEqual(body[0].question, body[8].question);
  assert.notEqual(body[8].question, body[16].question);
  const report = H.summary(H.createSession(H.makeComparePlan()));
  assert.doesNotMatch(Object.keys(report).join(' '), /average|score|calibration|coherence|accuracy|winner/i);
  assert.doesNotMatch(source, /document\.|window\.|AudioContext|localStorage|fetch\(/);
});
