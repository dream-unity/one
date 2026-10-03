import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionExecutor, observedView } from '../prototype/actions.js';
import { initialState, reduceState, DESTINATIONS, parseLocalIntention } from '../prototype/state.js';

let nextId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fixture(overrides = {}, destination = 'unity') {
  let state = initialState(destination);
  const receipts = [], effects = [];
  const dispatch = event => { state = reduceState(state, event); };
  const executor = createActionExecutor({ getState: () => state,
    async navigate(destination, { back }) { effects.push(destination); dispatch({ type: 'navigate', destination, back }); return DESTINATIONS[destination]; },
    focus(world) { effects.push(world); dispatch({ type: 'focus', world }); },
    reflect(worlds, summary) { dispatch({ type: 'reflection', worlds, summary }); },
    earth: { async command() { return { status: 'noop', code: 'VIEW_OBSERVED', message: 'Current view: 12.0000, 34.0000; style normal.' }; } },
    async proposeMemory() {}, onResult(request, result) { receipts.push(result); }, ...overrides });
  const request = tool => ({ version: 1, sessionId: uuid(), turnId: uuid(), requestId: uuid(), routeEpoch: state.routeEpoch,
    consentEpoch: state.consentEpoch, memoryRevision: state.memoryRevision, tool });
  return { executor, request, dispatch, effects, receipts, get state() { return state; } };
}
const navigateTo = destination => ({ name: 'navigate', args: { destination } });
const readEarth = { name: 'earth_get_view', args: {} };
const proposal = { name: 'propose_memory', args: { proposal: { operation: 'create_node', kind: 'goal', title: 'A deliberate goal', text: 'An exact proposed note.' } } };

test('owned navigation receipts include the observed destination and advance exactly one route', async () => {
  const h = fixture(); const request = h.request(navigateTo('earth'));
  const result = await h.executor.execute(request);
  assert.equal(result.status, 'applied'); assert.equal(result.routeEpoch, request.routeEpoch);
  assert.equal(result.observedState.destination, 'earth'); assert.equal(h.state.routeEpoch, 1);
  assert.deepEqual(result.observedState, observedView(h.state));
});

test('a returned navigation object does not establish arrival at an unobserved destination', async () => {
  const h = fixture({ navigate: async () => DESTINATIONS.earth });
  const result = await h.executor.execute(h.request(navigateTo('earth')));
  assert.equal(result.status, 'superseded'); assert.equal(result.observedState.destination, 'unity');
});

test('a cancelled Earth navigation reports the displayed destination without claiming the old view was retained', async () => {
  let h;
  h = fixture({ navigate: async () => { h.dispatch({ type: 'navigate', destination: 'earth' }); return null; } });
  const result = await h.executor.execute(h.request(navigateTo('earth')));
  assert.equal(result.status, 'cancelled'); assert.equal(result.observedState.destination, 'earth');
  assert.doesNotMatch(result.message, /retained/);
});

test('focus and reflection success require their real reducer state', async () => {
  const h = fixture({ focus() {}, reflect() {} });
  assert.equal((await h.executor.execute(h.request({ name: 'focus_world', args: { world: 'maker' } }))).code, 'FOCUS_UNCONFIRMED');
  assert.equal((await h.executor.execute(h.request({ name: 'set_scene_reflection', args: { worlds: ['world'], summary: 'Perhaps a project.', provisional: true } }))).code, 'REFLECTION_UNCONFIRMED');
});

test('explicit focus replaces a provisional interpretation in the real reducer', async () => {
  const h = fixture(); h.dispatch({ type: 'reflection', worlds: ['machine'], summary: 'Perhaps a question.' });
  const result = await h.executor.execute(h.request({ name: 'focus_world', args: { world: 'maker' } }));
  assert.equal(result.status, 'applied'); assert.equal(h.state.worldFocus, 'maker'); assert.equal(h.state.reflection, null);
});

test('exact requests for restricted worlds focus their meaning without exposing an activity route', async () => {
  for (const world of ['machine', 'maker']) {
    const h = fixture();
    for (const command of [`Open Dream ${world}.`, `show dream ${world}`, `visit dream ${world}`, `go to dream ${world}`, `take me to dream ${world}`]) {
      const tool = parseLocalIntention(command);
      assert.deepEqual(tool, { name: 'focus_world', args: { world } });
      const result = await h.executor.execute(h.request(tool));
      assert.equal(result.status, 'applied'); assert.equal(result.observedState.destination, 'unity');
      assert.match(result.message, /Activities retain their current access status/);
    }
  }
  for (const text of ['"Open Dream Machine"', 'If I say open Dream Maker', 'do not open Dream Machine',
    'open Dream Machine and Earth', 'open Dream Maker games', 'open machine', 'open maker']) {
    assert.equal(parseLocalIntention(text), null);
  }
});

test('stale route, consent and revision are rejected before any side effect', async () => {
  for (const field of ['routeEpoch', 'consentEpoch', 'memoryRevision']) {
    const h = fixture(); const request = h.request(navigateTo('earth')); request[field]++;
    const result = await h.executor.execute(request);
    assert.equal(result.status, 'superseded'); assert.equal(result.code, 'STALE_AUTHORITY'); assert.deepEqual(h.effects, []);
  }
});

test('pre-aborted and immediately stopped queued operations cannot execute', async () => {
  const h = fixture(); const controller = new AbortController(); controller.abort();
  assert.equal((await h.executor.execute(h.request(navigateTo('earth')), { signal: controller.signal })).status, 'cancelled');
  const queued = h.executor.execute(h.request(navigateTo('earth'))); h.executor.cancel();
  assert.equal((await queued).status, 'cancelled'); assert.deepEqual(h.effects, []);
});

test('concurrent duplicate requests share one effect and one result notification; replay copies are isolated', async () => {
  const gate = deferred(), started = deferred(); let calls = 0;
  const h = fixture({ earth: { async command() { calls++; started.resolve(); return gate.promise; } } }, 'earth');
  const request = h.request(readEarth), first = h.executor.execute(request), duplicate = h.executor.execute(structuredClone(request));
  await started.promise; gate.resolve({ status: 'noop', code: 'VIEW_OBSERVED', message: 'Current view observed.' });
  const [a, b] = await Promise.all([first, duplicate]); assert.deepEqual(a, b); assert.equal(calls, 1); assert.equal(h.receipts.length, 1);
  a.observedState.destination = 'unity'; const replay = await h.executor.execute(request);
  assert.equal(replay.observedState.destination, 'earth'); assert.equal(calls, 1);
});

test('pending duplicate ownership survives pressure from more than 128 completed requests', async () => {
  const gate = deferred(), started = deferred(); let calls = 0;
  const h = fixture({ earth: { async command() { calls++; started.resolve(); return gate.promise; } } }, 'earth');
  const request = h.request(readEarth), first = h.executor.execute(request); await started.promise;
  for (let i = 0; i < 132; i++) await h.executor.execute(h.request({ name: 'focus_world', args: { world: 'world' } }));
  const duplicate = h.executor.execute(request); gate.resolve({ status: 'noop', code: 'VIEW_OBSERVED', message: 'Observed.' });
  await Promise.all([first, duplicate]); assert.equal(calls, 1);
});

test('completed requests retain the same receipt and never repeat their effect after cache pressure', async () => {
  const h = fixture(); const request = h.request({ name: 'focus_world', args: { world: 'maker' } });
  const original = await h.executor.execute(request);
  for (let i = 0; i < 132; i++) await h.executor.execute(h.request({ name: 'focus_world', args: { world: 'world' } }));
  const before = h.effects.length;
  assert.deepEqual(await h.executor.execute(request), original);
  assert.equal(h.effects.length, before); assert.equal(h.state.worldFocus, 'world');
});

test('request retries are identical when JSON object fields arrive in a different order', async () => {
  const h = fixture(); const request = h.request(navigateTo('manifesto'));
  const original = await h.executor.execute(request);
  const reordered = Object.fromEntries(Object.entries(request).reverse());
  reordered.tool = { args: { destination: 'manifesto' }, name: 'navigate' };
  assert.deepEqual(await h.executor.execute(reordered), original);
  assert.deepEqual(h.effects, ['manifesto']);
});

test('the finite visit budget blocks new operations while preserving all admitted replay identities', async () => {
  const h = fixture(); const first = h.request({ name: 'focus_world', args: { world: 'maker' } });
  const original = await h.executor.execute(first);
  for (let i = 1; i < 4096; i++) await h.executor.execute(h.request({ name: 'focus_world', args: { world: 'world' } }));
  const blocked = await h.executor.execute(h.request({ name: 'focus_world', args: { world: 'machine' } }));
  assert.equal(blocked.status, 'blocked'); assert.equal(blocked.code, 'VISIT_ACTION_LIMIT');
  assert.deepEqual(await h.executor.execute(first), original); assert.equal(h.effects.length, 4096);
});

test('reusing a request ID for another operation never dispatches the second operation', async () => {
  const gate = deferred(); let calls = 0;
  const h = fixture({ earth: { command() { calls++; return gate.promise; } } }, 'earth');
  const request = h.request(readEarth), first = h.executor.execute(request);
  const different = structuredClone(request); different.tool = { name: 'earth_zoom_to_globe', args: {} };
  const result = await h.executor.execute(different); assert.equal(result.code, 'REQUEST_ID_REUSE');
  gate.resolve({ status: 'noop', code: 'VIEW_OBSERVED', message: 'Observed.' }); await first; assert.equal(calls, 1);
});

test('Stop settles a non-cooperating dispatched Earth operation as unknown and aborts its signal', async () => {
  const started = deferred(); let signal;
  const h = fixture({ earth: { command(tool, turnId, options) { signal = options.signal; started.resolve(); return new Promise(() => {}); } } }, 'earth');
  const operation = h.executor.execute(h.request({ name: 'earth_zoom_to_globe', args: {} })); await started.promise;
  h.executor.cancel(); const result = await operation;
  assert.equal(signal.aborted, true); assert.equal(result.status, 'unknown'); assert.equal(result.code, 'ACTION_OUTCOME_UNKNOWN');
  assert.equal(result.observedState.destination, 'earth');
});

test('a finite deadline settles an adapter that ignores cancellation', async () => {
  let deadline, cleared = false; const started = deferred();
  const h = fixture({ setTimer(callback) { deadline = callback; return 42; }, clearTimer(id) { assert.equal(id, 42); cleared = true; },
    navigate() { started.resolve(); return new Promise(() => {}); } });
  const operation = h.executor.execute(h.request(navigateTo('manifesto'))); await started.promise; deadline();
  assert.equal((await operation).status, 'cancelled'); assert.equal(cleared, true);
});

test('route, consent, revision or turn changes during a pending proposal cannot produce an applied receipt', async () => {
  for (const change of [
    { type: 'navigate', destination: 'manifesto' },
    { type: 'memory', consentEpoch: 1, revision: 0 },
    { type: 'memory', consentEpoch: 0, revision: 1 },
    { type: 'interrupt' },
  ]) {
    const gate = deferred(), started = deferred();
    const h = fixture({ proposeMemory() { started.resolve(); return gate.promise; } });
    const operation = h.executor.execute(h.request(proposal)); await started.promise; h.dispatch(change); gate.resolve();
    const result = await operation; assert.equal(result.status, 'superseded'); assert.deepEqual(result.observedState, observedView(h.state));
  }
});

test('memory proposal success requires the exact observed candidate and its local ownership', async () => {
  const pending = (candidate, request) => ({ proposalId: uuid(), turnId: request.turnId,
    consentEpoch: request.consentEpoch, revision: request.memoryRevision, proposal: structuredClone(candidate) });
  const valid = fixture({ proposeMemory: async (candidate, request) => pending(candidate, request) });
  const result = await valid.executor.execute(valid.request(proposal));
  assert.equal(result.status, 'applied'); assert.equal(result.code, 'MEMORY_PROPOSED');
  assert.match(result.message, /Nothing has been saved/);
  for (const alter of [() => undefined, value => ({ ...value, proposalId: 'not-a-uuid' }),
    value => ({ ...value, turnId: uuid() }), value => ({ ...value, consentEpoch: value.consentEpoch + 1 }),
    value => ({ ...value, revision: value.revision + 1 }),
    value => ({ ...value, proposal: { ...value.proposal, text: 'A different candidate.' } })]) {
    const h = fixture({ proposeMemory: async (candidate, request) => alter(pending(candidate, request)) });
    const failed = await h.executor.execute(h.request(proposal));
    assert.equal(failed.status, 'failed'); assert.equal(failed.code, 'MEMORY_PROPOSAL_UNCONFIRMED');
  }
});

test('an Earth result from an old route is superseded and does not claim its effect in the new view', async () => {
  const gate = deferred(), started = deferred();
  const h = fixture({ earth: { command() { started.resolve(); return gate.promise; } } }, 'earth');
  const operation = h.executor.execute(h.request(readEarth)); await started.promise; h.dispatch({ type: 'navigate', destination: 'unity' });
  gate.resolve({ status: 'applied', code: 'ARRIVED', message: 'Camera arrived.' });
  const result = await operation; assert.equal(result.status, 'superseded'); assert.equal(result.observedState.earth, null);
});

test('Earth unknown outcomes and actual readback messages pass through without becoming successful effects', async () => {
  const h = fixture({ earth: { command() { throw Object.assign(new Error('Interrupted after dispatch.'), { code: 'ACTION_OUTCOME_UNKNOWN' }); } } }, 'earth');
  assert.equal((await h.executor.execute(h.request(readEarth))).status, 'unknown');
  const readback = fixture({}, 'earth'); const result = await readback.executor.execute(readback.request(readEarth));
  assert.equal(result.status, 'noop'); assert.equal(result.code, 'VIEW_OBSERVED'); assert.match(result.message, /12\.0000, 34\.0000; style normal/);
});

test('request ownership is copied before asynchronous execution and reporting cannot falsify its receipt', async () => {
  const h = fixture({ onResult(request, result) { result.status = 'failed'; throw new Error('UI failure'); } });
  const request = h.request(navigateTo('manifesto')); const pending = h.executor.execute(request); request.tool.args.destination = 'earth';
  const result = await pending; assert.equal(result.status, 'applied'); assert.equal(result.observedState.destination, 'manifesto');
});

test('native and non-Error consumer failures yield bounded cached receipts and release action resources', async () => {
  for (const failure of [new DOMException('Native storage failed.', 'QuotaExceededError'), null,
    Object.assign(new Error('Long failure.'), { code: 'x'.repeat(100) })]) {
    let calls = 0, cleared = 0;
    const h = fixture({ focus() { calls++; throw failure; }, setTimer() { return 1; }, clearTimer() { cleared++; } });
    const request = h.request({ name: 'focus_world', args: { world: 'maker' } });
    const result = await h.executor.execute(request);
    assert.equal(result.status, 'failed'); assert.equal(result.code, 'ACTION_FAILED');
    assert.deepEqual(await h.executor.execute(request), result); assert.equal(calls, 1); assert.equal(cleared, 1);
  }
});
