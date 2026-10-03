import test from 'node:test';
import assert from 'node:assert/strict';
import { createEarthAdapter, EARTH_ORIGIN } from '../prototype/earth/adapter.js';

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const tick = () => new Promise(resolve => setImmediate(resolve));
const readiness = { app: 'ready', globe: 'ready', restore: 'none', providers: [] };
const hello = { buildCommit: 'a'.repeat(40), capabilities: {
  tools: ['earth_fly_to_location', 'earth_zoom_to_globe', 'earth_get_view'], suspension: true, mediaPreflight: true,
} };
const observed = { status: 'applied', code: 'VIEW_OBSERVED', message: 'The real view changed.', snapshot: null };

function fixture(t) {
  const win = new EventTarget(); const frames = []; const states = []; let next = 1;
  const host = { children: [], replaceChildren(frame) { this.children = [frame]; } };
  class Frame extends EventTarget {
    removed = false; src = ''; sent = [];
    contentWindow = { postMessage: (data, origin) => { this.sent.push({ data, origin }); } };
    remove() { this.removed = true; if (host.children.includes(this)) host.children = []; }
  }
  const adapter = createEarthAdapter({ host, window: win, uuid: () => id(next++),
    frameFactory() { const frame = new Frame(); frames.push(frame); return frame; }, onState: value => states.push(value) });
  t.after(() => adapter.close());
  function receive(frame, kind, payload, options = {}) {
    const init = frame.sent.find(item => item.data.kind === 'INIT')?.data;
    assert.ok(init, 'the owned frame must receive its INIT challenge first');
    const data = { channel: 'dream-unity:earth', version: 1, bridgeId: init.bridgeId,
      epoch: init.epoch, requestId: id(next++), kind, payload, ...options.envelope };
    win.dispatchEvent(Object.assign(new Event('message'), {
      data, origin: options.origin || EARTH_ORIGIN, source: options.source || frame.contentWindow,
    }));
  }
  function begin(epoch = 1, signal) {
    const promise = adapter.open(epoch, { signal }); const frame = frames.at(-1);
    frame.dispatchEvent(new Event('load')); return { promise, frame };
  }
  async function finish(owner) {
    receive(owner.frame, 'HELLO', hello); await tick();
    assert.ok(owner.frame.sent.some(item => item.data.kind === 'START'));
    receive(owner.frame, 'READY', readiness); await owner.promise; return owner.frame;
  }
  return { adapter, frames, states, host, begin, finish, receive };
}

test('only the challenged current origin, window and epoch can complete opening', async t => {
  const h = fixture(t); const owner = h.begin(); let finished = false;
  owner.promise.then(() => { finished = true; });
  for (const options of [{ origin: 'https://example.com' }, { source: {} },
    { envelope: { bridgeId: id(999) } }, { envelope: { epoch: 0 } }]) {
    h.receive(owner.frame, 'HELLO', hello, options); h.receive(owner.frame, 'READY', readiness, options);
  }
  await tick(); assert.equal(finished, false); assert.equal(h.adapter.getState().capabilities, null);
  // A READY message cannot skip HELLO and the parent's START phase.
  h.receive(owner.frame, 'READY', readiness); await tick(); assert.equal(finished, false);
  await h.finish(owner); assert.equal(finished, true);
  assert.ok(owner.frame.sent.every(item => item.origin === EARTH_ORIGIN));
});

test('same-epoch duplicate work shares its live owner and late signal expiry preserves a ready document', async t => {
  const h = fixture(t); const controller = new AbortController(); const owner = h.begin(1, controller.signal);
  const duplicate = h.adapter.open(1, { signal: controller.signal });
  assert.equal(duplicate, owner.promise); assert.equal(h.frames.length, 1);
  await h.finish(owner); await duplicate; controller.abort(); await tick();
  assert.equal(owner.frame.removed, false); assert.equal(h.adapter.getState().active, true);
  assert.equal(h.adapter.getState().readiness.app, 'ready');
});

test('abort immediately removes its owned opening and an aborted owner is never reused', async t => {
  const h = fixture(t); const controller = new AbortController(); const owner = h.begin(1, controller.signal);
  const failed = assert.rejects(owner.promise, { code: 'CANCELLED' }); controller.abort();
  assert.equal(owner.frame.removed, true); assert.equal(owner.frame.src, 'about:blank');
  const replacement = h.begin(1); assert.notEqual(replacement.frame, owner.frame);
  await h.finish(replacement); await failed; await tick();
  assert.equal(replacement.frame.removed, false); assert.equal(h.adapter.getState().active, true);
  await assert.rejects(h.adapter.open(2, { signal: controller.signal }), { code: 'CANCELLED' });
  assert.equal(h.frames.length, 2); assert.equal(replacement.frame.removed, false);
});

test('superseded opening cleanup and old iframe load/messages cannot destroy a newer frame', async t => {
  const h = fixture(t); const old = h.begin(1); const failed = assert.rejects(old.promise, { code: 'CANCELLED' });
  const current = h.begin(2); const count = current.frame.sent.length;
  old.frame.dispatchEvent(new Event('load')); h.receive(old.frame, 'HELLO', hello); h.receive(old.frame, 'READY', readiness);
  await tick(); assert.equal(current.frame.sent.length, count); assert.equal(current.frame.removed, false);
  await h.finish(current); await failed;
  await assert.rejects(h.adapter.open(1), { code: 'SUPERSEDED' });
  assert.equal(current.frame.removed, false); assert.equal(h.frames.length, 2);
});

test('suspension during the ready phase releases its owner without closing a replacement', async t => {
  const h = fixture(t); const old = h.begin(1); h.receive(old.frame, 'HELLO', hello); await tick();
  const failed = assert.rejects(old.promise, { code: 'CANCELLED' });
  // Route suspension disposes the document after its owned ACK.
  const suspension = h.adapter.suspend(2); const suspend = old.frame.sent.findLast(item => item.data.kind === 'SUSPEND').data;
  h.receive(old.frame, 'ACK', { forKind: 'SUSPEND', active: false }, { envelope: { epoch: suspend.epoch, requestId: suspend.requestId } });
  await suspension; const current = h.begin(3); await h.finish(current); await failed;
  assert.equal(old.frame.removed, true); assert.equal(current.frame.removed, false);
});

test('a failed opening deadline releases only that owner and permits a fresh connection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const h = fixture(t); const old = h.begin(1);
  const failed = assert.rejects(old.promise, { code: 'EARTH_HANDSHAKE_TIMEOUT' });
  t.mock.timers.tick(8000); await failed;
  assert.equal(old.frame.removed, true); assert.equal(h.adapter.getState().readiness.app, 'failed');
  const current = h.begin(2); await h.finish(current);
  assert.equal(current.frame.removed, false); assert.equal(h.adapter.getState().readiness.app, 'ready');
});

test('interrupting a dispatched command waits for CANCEL but cannot claim an unobserved effect was undone', async t => {
  const h = fixture(t); const frame = await h.finish(h.begin()); const controller = new AbortController();
  const command = h.adapter.command({ name: 'earth_fly_to_location', args: { query: 'Paris', viewMode: 'close' } }, id(800), { signal: controller.signal });
  let settled = false; command.then(() => { settled = true; }, () => { settled = true; });
  const rejected = assert.rejects(command, { code: 'ACTION_OUTCOME_UNKNOWN' }); controller.abort(); await tick();
  const cancel = frame.sent.findLast(item => item.data.kind === 'CANCEL').data;
  const original = frame.sent.findLast(item => item.data.kind === 'COMMAND').data;
  assert.equal(cancel.payload.commandRequestId, original.requestId); assert.equal(settled, false);
  h.receive(frame, 'ACK', { forKind: 'SUSPEND', active: true }, { envelope: { requestId: cancel.requestId } }); await tick();
  assert.equal(settled, false, 'an unrelated valid ACK cannot satisfy the CANCEL barrier');
  h.receive(frame, 'ACK', { forKind: 'CANCEL', active: true }, { envelope: { requestId: cancel.requestId } });
  await rejected; assert.equal(settled, true);
});

test('a real RESULT wins while its cancellation barrier is pending and stale results are ignored', async t => {
  const h = fixture(t); const frame = await h.finish(h.begin()); const controller = new AbortController();
  const command = h.adapter.command({ name: 'earth_zoom_to_globe', args: {} }, id(801), { signal: controller.signal });
  let settled = false; command.then(() => { settled = true; }); controller.abort();
  const original = frame.sent.findLast(item => item.data.kind === 'COMMAND').data;
  const cancel = frame.sent.findLast(item => item.data.kind === 'CANCEL').data;
  h.receive(frame, 'RESULT', observed, { envelope: { epoch: 0, requestId: original.requestId } }); await tick(); assert.equal(settled, false);
  h.receive(frame, 'RESULT', observed, { source: {}, envelope: { requestId: original.requestId } }); await tick(); assert.equal(settled, false);
  h.receive(frame, 'RESULT', observed, { envelope: { requestId: original.requestId } });
  assert.deepEqual(await command, observed);
  h.receive(frame, 'ACK', { forKind: 'CANCEL', active: true }, { envelope: { requestId: cancel.requestId } }); await tick();
  assert.equal(h.adapter.getState().active, true);
});

test('missing cancellation acknowledgement remains unknown after a bounded deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const h = fixture(t); const frame = await h.finish(h.begin()); const controller = new AbortController();
  const command = h.adapter.command({ name: 'earth_get_view', args: {} }, id(802), { signal: controller.signal });
  const rejected = assert.rejects(command, { code: 'ACTION_OUTCOME_UNKNOWN' }); controller.abort();
  assert.equal(frame.sent.at(-1).data.kind, 'CANCEL'); t.mock.timers.tick(2000); await rejected;
});
