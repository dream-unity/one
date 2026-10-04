import test from 'node:test';
import assert from 'node:assert/strict';
import { createDictation } from '../prototype/conversation/dictation.js';

const result = (text, isFinal = true) => Object.assign([{ transcript: text }], { isFinal });
function fixture(t, options = {}) {
  const ownerDocument = new EventTarget();
  ownerDocument.hidden = false; ownerDocument.defaultView = new EventTarget();
  const instances = [], states = [], words = [];
  class Recognition {
    starts = 0; aborts = 0;
    constructor() { instances.push(this); }
    start() { this.starts++; }
    abort() { this.aborts++; }
  }
  const dictation = createDictation({ Recognition, ownerDocument, isSecureContext: true,
    onState: state => states.push(state), onResult: text => words.push(text), ...options });
  t.after(() => dictation.dispose());
  return { dictation, ownerDocument, instances, states, words, Recognition };
}

test('native dictation starts synchronously without a backend, media preflight, or automatic activation', t => {
  const h = fixture(t);
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('No backend may be contacted'); });
  assert.equal(h.instances.length, 0);
  assert.equal(h.dictation.getState().status, 'idle');
  const started = h.dictation.start();
  assert.equal(started.status, 'starting'); assert.equal(started.active, true);
  assert.equal(h.instances[0].starts, 1, 'start executes before the public call returns');
  assert.equal(h.instances[0].lang, 'en-AU');
  assert.equal(h.instances[0].continuous, false);
  assert.equal(h.instances[0].interimResults, false);
  h.dictation.start(); assert.equal(h.instances.length, 1);
  h.instances[0].onstart();
  assert.equal(h.dictation.getState().status, 'listening');
  assert.equal(fetch.mock.callCount(), 0);
});

test('only final results are committed and repeated final indexes are ignored', t => {
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0];
  recognition.onstart();
  recognition.onresult({ resultIndex: 0, results: [result('unfinished', false)] });
  assert.deepEqual(h.words, []);
  const final = { resultIndex: 0, results: [result(' Open the manifesto. ')] };
  recognition.onresult(final); recognition.onresult(final);
  recognition.onresult({ resultIndex: 1, results: [final.results[0], result('Another thought.')] });
  recognition.onresult({ resultIndex: 0, results: [final.results[0], result('Another thought.')] });
  assert.deepEqual(h.words, ['Open the manifesto.', 'Another thought.']);
  assert.equal(h.dictation.getState().active, true);
  recognition.onend();
  assert.equal(h.dictation.getState().status, 'stopped');
  assert.equal(h.dictation.getState().active, false);
  assert.match(h.dictation.getState().message, /Review your words/);
  assert.equal(recognition.aborts, 0, 'natural completion is already quiescent');
  assert.equal(recognition.starts, 1, 'normal end never restarts recognition');
});

test('Stop invalidates its owner before synchronous abort callbacks or late permission success', t => {
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0];
  recognition.abort = function () {
    this.aborts++; this.onstart();
    this.onresult({ resultIndex: 0, results: [result('late words')] });
    this.onerror({ error: 'network' }); this.onend();
  };
  h.dictation.stop();
  assert.equal(recognition.aborts, 1); assert.deepEqual(h.words, []);
  assert.equal(h.dictation.getState().status, 'stopped');
  assert.equal(h.dictation.getState().active, false);
  assert.equal(h.states.some(state => state.status === 'listening'), false);
});

test('callbacks from an old capture cannot end or write into a manually started replacement', t => {
  const h = fixture(t); h.dictation.start(); const first = h.instances[0];
  h.dictation.stop(); h.dictation.start(); const current = h.instances[1]; current.onstart();
  first.onstart(); first.onresult({ resultIndex: 0, results: [result('old')] });
  first.onerror({ error: 'not-allowed' }); first.onend();
  assert.equal(h.dictation.getState().status, 'listening'); assert.deepEqual(h.words, []);
  assert.equal(first.aborts, 2, 'late start must abort the stale native capture again');
  current.onresult({ resultIndex: 0, results: [result('current')] });
  assert.deepEqual(h.words, ['current']); assert.equal(current.aborts, 0);
});

test('hiding the document aborts dictation and becoming visible does not restart it', t => {
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0]; recognition.onstart();
  h.ownerDocument.hidden = true; h.ownerDocument.dispatchEvent(new Event('visibilitychange'));
  assert.equal(recognition.aborts, 1); assert.equal(h.dictation.getState().active, false);
  h.ownerDocument.hidden = false; h.ownerDocument.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.instances.length, 1); assert.equal(recognition.starts, 1);
  recognition.onresult({ resultIndex: 0, results: [result('hidden')] }); assert.deepEqual(h.words, []);
});

test('a hidden tab cannot begin dictation and pagehide cancels a later owned capture', t => {
  const h = fixture(t); h.ownerDocument.hidden = true; h.dictation.start();
  assert.equal(h.instances.length, 0); assert.equal(h.dictation.getState().active, false);
  h.ownerDocument.hidden = false; h.dictation.start(); const recognition = h.instances[0];
  h.ownerDocument.defaultView.dispatchEvent(new Event('pagehide'));
  assert.equal(recognition.aborts, 1); assert.equal(h.dictation.getState().active, false);
  recognition.onstart(); assert.equal(h.dictation.getState().status, 'stopped');
});

test('dispose aborts capture, detaches lifecycle listeners, and permanently rejects restart', t => {
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0];
  h.dictation.dispose(); const statesAfterDispose = h.states.length;
  h.ownerDocument.hidden = true; h.ownerDocument.dispatchEvent(new Event('visibilitychange'));
  h.ownerDocument.defaultView.dispatchEvent(new Event('pagehide'));
  recognition.onstart(); recognition.onresult({ resultIndex: 0, results: [result('after exit')] }); recognition.onend();
  h.dictation.start(); h.dictation.dispose();
  assert.equal(h.states.length, statesAfterDispose); assert.equal(recognition.aborts, 2);
  assert.equal(h.instances.length, 1); assert.deepEqual(h.words, []);
});

test('a stalled permission/start sequence times out, aborts, and ignores late callbacks', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0];
  t.mock.timers.tick(15000);
  assert.equal(h.dictation.getState().status, 'failed'); assert.equal(h.dictation.getState().active, false);
  assert.equal(recognition.aborts, 1); assert.match(h.dictation.getState().message, /permission/);
  recognition.onstart(); recognition.onresult({ resultIndex: 0, results: [result('too late')] });
  assert.equal(recognition.aborts, 2, 'permission success after timeout is stopped again');
  t.mock.timers.tick(120000); assert.deepEqual(h.words, []); assert.equal(h.instances.length, 1);
});

test('listening has a fixed deadline even if start notifications repeat', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0]; recognition.onstart();
  t.mock.timers.tick(30000); recognition.onstart(); t.mock.timers.tick(29999);
  assert.equal(h.dictation.getState().active, true);
  t.mock.timers.tick(1); assert.equal(h.dictation.getState().status, 'stopped');
  assert.equal(h.dictation.getState().active, false); assert.equal(recognition.aborts, 1);
  assert.match(h.dictation.getState().message, /one-minute limit/);
  assert.equal(recognition.starts, 1);
});

test('natural end cancels watchdogs and late final results without restarting', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = fixture(t); h.dictation.start(); const recognition = h.instances[0]; recognition.onstart(); recognition.onend();
  const settled = h.dictation.getState(); t.mock.timers.tick(120000);
  recognition.onresult({ resultIndex: 0, results: [result('after end')] });
  assert.deepEqual(h.dictation.getState(), settled); assert.deepEqual(h.words, []);
  assert.equal(recognition.aborts, 0); assert.equal(h.instances.length, 1);
});

test('recognition failures are actionable and always abort the current owner', async t => {
  for (const [code, message] of [
    ['not-allowed', /permission.*settings/i], ['service-not-allowed', /disabled.*service/i],
    ['audio-capture', /microphone.*connected/i], ['network', /connection/i], ['no-speech', /No speech/i],
    ['language-not-supported', /does not support this language/i], ['unknown', /could not start/i],
  ]) {
    await t.test(code, t => {
      const h = fixture(t); h.dictation.start(); const recognition = h.instances[0]; recognition.onerror({ error: code });
      assert.equal(h.dictation.getState().active, false); assert.equal(recognition.aborts, 1);
      assert.match(h.dictation.getState().message, message);
      assert.match(h.dictation.getState().message, /keyboard’s microphone/);
      const settled = h.dictation.getState(); recognition.onend(); assert.deepEqual(h.dictation.getState(), settled);
      assert.equal(h.instances.length, 1);
    });
  }
});

test('unsupported or insecure environments expose keyboard fallback without constructing recognition', t => {
  const unsupported = fixture(t, { Recognition: undefined });
  assert.equal(unsupported.dictation.getState().status, 'unavailable');
  assert.equal(unsupported.dictation.getState().supported, false);
  assert.match(unsupported.dictation.getState().message, /keyboard’s microphone/);
  unsupported.dictation.start(); assert.equal(unsupported.instances.length, 0);
  const insecure = fixture(t, { isSecureContext: false });
  insecure.dictation.start(); assert.equal(insecure.instances.length, 0);
  assert.equal(insecure.dictation.getState().status, 'unavailable');
  assert.match(insecure.dictation.getState().message, /HTTPS/);
});

test('default feature detection accepts both standard and prefixed browser constructors', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    let starts = 0;
    class Recognition { start() { starts++; } abort() {} }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { [name]: Recognition } });
    const dictation = createDictation({ isSecureContext: true });
    assert.equal(dictation.getState().supported, true); dictation.start(); assert.equal(starts, 1); dictation.dispose();
  }
});

test('synchronous permission failures are reported without leaving an owned microphone', t => {
  class DeniedRecognition {
    aborts = 0;
    start() { throw Object.assign(new Error('private browser diagnostic'), { name: 'NotAllowedError' }); }
    abort() { this.aborts++; }
  }
  const h = fixture(t, { Recognition: DeniedRecognition });
  assert.doesNotThrow(() => h.dictation.start());
  assert.equal(h.dictation.getState().status, 'failed'); assert.equal(h.dictation.getState().active, false);
  assert.match(h.dictation.getState().message, /permission/);
  assert.doesNotMatch(h.dictation.getState().message, /private browser diagnostic/);
});

test('reentrant Stop from result delivery prevents subsequent results in the same callback', t => {
  const words = []; let dictation;
  const h = fixture(t, { onResult(text) { words.push(text); dictation.stop(); } }); dictation = h.dictation;
  dictation.start(); const recognition = h.instances[0]; recognition.onstart();
  recognition.onresult({ resultIndex: 0, results: [result('first'), result('must not commit')] });
  assert.deepEqual(words, ['first']); assert.equal(recognition.aborts, 1); assert.equal(dictation.getState().active, false);
});
