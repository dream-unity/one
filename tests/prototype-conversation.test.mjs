import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversation } from '../prototype/conversation/controller.js';
import { boundedHistory, readFiniteSSE } from '../prototype/conversation/text.js';

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const tick = () => new Promise(resolve => setImmediate(resolve));
function stream(events) {
  return new Response(events.map(([name, value]) => `event: ${name}\ndata: ${JSON.stringify({ version: 1, ...value })}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}
function harness(options = {}) {
  const requests = []; const events = []; const tracks = []; const peers = []; const timers = new Map();
  let next = 1; let timerId = 0;
  const currentContext = { routeEpoch: 0, consentEpoch: 0, memoryRevision: 0, canonVersion: 'published-manifesto/1',
    uiContext: { destination: 'unity', worldFocus: null, earth: null }, consentedMemories: [] };
  function captureStream() {
    const track = { kind: 'audio', stopped: false, stop() { this.stopped = true; } }; tracks.push(track);
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  }
  class Channel extends EventTarget {
    readyState = 'connecting'; sent = [];
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 'closed'; }
    receive(value) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })); }
  }
  class Peer extends EventTarget {
    connectionState = 'new'; replaced = []; channel = new Channel();
    constructor() { super(); peers.push(this); }
    addTrack(track) { this.track = track; return { replaceTrack: async value => { this.replaced.push(value); this.track = value; if (options.replaceTrack) await options.replaceTrack(value); } }; }
    createDataChannel() { return this.channel; }
    async createOffer() { return { sdp: 'v=0\r\n' }; }
    async setLocalDescription() {}
    async setRemoteDescription() { this.connectionState = 'connected'; this.channel.readyState = 'open'; this.channel.dispatchEvent(new Event('open')); this.dispatchEvent(new Event('connectionstatechange')); }
    close() { this.connectionState = 'closed'; }
    restartIce() { this.restarted = true; }
  }
  const doc = new EventTarget(); doc.hidden = false; const win = new EventTarget();
  const audio = { srcObject: null, muted: false, autoplay: false, paused: false, removed: false, async play() { this.paused = false; }, pause() { this.paused = true; }, remove() { this.removed = true; } };
  async function fetcher(url, init = {}) {
    const path = new URL(url).pathname; const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ path, body, init });
    if (options.fetch) { const value = await options.fetch(path, body, init); if (value) return value; }
    if (path.endsWith('/access')) return Response.json({ version: 1, accessToken: 'private-token', expiresAt: '2026-10-03T03:00:00Z', canonVersion: currentContext.canonVersion });
    if (path.endsWith('/realtime')) return Response.json({ version: 1, sessionId: id(500), transport: { type: 'webrtc', sdp: 'answer' }, closeToken: 'close-only', clientDeadlineAt: '2026-10-03T02:12:00Z' });
    if (path.endsWith('/sessions/close')) return Response.json({ version: 1, status: 'closed' });
    if (path.endsWith('/knowledge')) return Response.json({ version: 1, chunks: [{ id: 'manifesto-practice', sourceId: 'manifesto', title: 'Practice', text: 'Real source passage.', claimType: 'philosophy', sha256: 'a'.repeat(64) }] });
    if (path.endsWith('/turns') && body.kind === 'cancel') return Response.json({ version: 1, status: 'cancelled' });
    if (path.endsWith('/turns')) return stream([['text.delta', { turnId: body.turnId, text: 'Actual ' }], ['turn.complete', { turnId: body.turnId, text: 'Actual reply' }]]);
    return Response.json({ version: 1, ready: false, reason: 'SERVICE_NOT_READY' });
  }
  const conversation = createConversation({ fetch: fetcher, randomUUID: () => id(next++), now: () => Date.parse('2026-10-03T02:00:00Z'),
    mediaDevices: { getUserMedia: options.getUserMedia || (async () => captureStream()) }, PeerConnection: Peer, createAudio: () => audio,
    document: doc, window: win, getContext: () => currentContext, onEvent: value => events.push(value),
    onAction: options.onAction || (async request => ({ version: 1, requestId: request.requestId, routeEpoch: currentContext.routeEpoch, status: 'applied', code: 'APPLIED', message: 'Observed', observedState: currentContext.uiContext })),
    ensureMediaQuiet: options.ensureMediaQuiet || (async () => true), setTimer: (fn, delay) => { const key = ++timerId; timers.set(key, { fn, delay }); return key; }, clearTimer: key => timers.delete(key) });
  return { conversation, requests, events, tracks, peers, timers, doc, win, audio, currentContext, captureStream };
}
async function authorized(options) { const value = harness(options); await value.conversation.access('a'.repeat(24)); return value; }

test('private bearer stays in closure and text makes a real bounded request', async () => {
  const h = await authorized(); await h.conversation.sendText('Hello');
  const request = h.requests.find(value => value.body?.kind === 'start');
  assert.equal(request.init.headers.Authorization, 'Bearer private-token');
  assert.equal(request.init.credentials, 'omit'); assert.equal(request.body.message, 'Hello');
  assert.equal(h.conversation.getState().transcript.at(-1).text, 'Actual reply');
  assert.equal(JSON.stringify(h.conversation.getState()).includes('private-token'), false);
  await h.conversation.exit();
});

test('Stop closes the owned call, peer, playback and physical microphone tracks', async () => {
  const h = await authorized(); await h.conversation.startVoice(); await h.conversation.stop();
  assert.equal(h.tracks[0].stopped, true); assert.equal(h.peers[0].track, null);
  assert.equal(h.peers[0].connectionState, 'closed'); assert.equal(h.audio.srcObject, null);
  assert.ok(h.peers[0].channel.sent.some(value => value.type === 'output_audio_buffer.clear'));
  const request = h.requests.find(value => value.path.endsWith('/sessions/close'));
  assert.equal(request.body.reason, 'stop'); assert.equal(request.init.headers.Authorization, undefined);
  await h.conversation.exit();
});

test('late microphone permission after Stop is immediately released without creating a paid call', async () => {
  let grant; const permission = new Promise(resolve => { grant = resolve; });
  const h = await authorized({ getUserMedia: () => permission }); const starting = h.conversation.startVoice();
  await h.conversation.stop(); const lateStream = h.captureStream(); grant(lateStream); await starting;
  assert.equal(h.tracks[0].stopped, true); assert.equal(h.requests.some(value => value.path.endsWith('/realtime')), false);
  await h.conversation.exit();
});

test('Media retains quiet transport, uses Responses text and Resume syncs finals without requesting speech', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const peer = h.peers[0];
  await h.conversation.enterMedia(); assert.equal(h.tracks[0].stopped, true); assert.equal(peer.track, null);
  assert.equal(h.requests.some(value => value.path.endsWith('/sessions/close')), false);
  await h.conversation.sendText('New media thought'); const before = peer.channel.sent.length;
  peer.channel.receive({ type: 'response.created', response: { id: 'late' } }); await tick();
  assert.equal(h.conversation.getState().voice, 'paused-media');
  await h.conversation.resumeVoice(); const resumed = peer.channel.sent.slice(before);
  assert.equal(h.peers.length, 1); assert.equal(h.tracks.length, 2);
  assert.ok(resumed.some(value => value.item?.content?.[0]?.text === 'New media thought'));
  assert.equal(resumed.filter(value => value.type === 'response.create').length, 0);
  await h.conversation.exit();
});

test('Resume requires actual media QUIET acknowledgement before reacquiring capture', async () => {
  const h = await authorized({ ensureMediaQuiet: async () => false }); await h.conversation.startVoice(); await h.conversation.enterMedia();
  await assert.rejects(h.conversation.resumeVoice(), { code: 'MEDIA_NOT_QUIET' }); assert.equal(h.tracks.length, 1);
  await h.conversation.exit();
});

test('concurrent Resume shares one capture operation and every track is released on Exit', async () => {
  const h = await authorized(); await h.conversation.startVoice(); await h.conversation.enterMedia();
  await Promise.all([h.conversation.resumeVoice(), h.conversation.resumeVoice()]);
  assert.equal(h.tracks.length, 2); assert.equal(h.tracks.filter(track => !track.stopped).length, 1);
  await h.conversation.exit(); assert.ok(h.tracks.every(track => track.stopped));
});

test('Media supersedes Resume while sender replacement is pending without unmuting or claiming listening', async () => {
  let attach; const attachment = new Promise(resolve => { attach = resolve; });
  const h = await authorized({ replaceTrack: value => value ? attachment : undefined });
  await h.conversation.startVoice(); await h.conversation.enterMedia();
  const resuming = h.conversation.resumeVoice(); await tick(); await h.conversation.enterMedia(); attach(); await resuming;
  assert.equal(h.conversation.getState().mode, 'media'); assert.equal(h.conversation.getState().voice, 'paused-media');
  assert.equal(h.audio.muted, true); assert.ok(h.tracks.every(track => track.stopped)); await h.conversation.exit();
});

test('late invite exchange after Exit cannot restore a bearer or authorized UI state', async () => {
  let grant; const admission = new Promise(resolve => { grant = resolve; });
  const h = harness({ fetch: path => path.endsWith('/access') ? admission : null });
  const activating = h.conversation.access('a'.repeat(24)); await h.conversation.exit();
  grant(Response.json({ version: 1, accessToken: 'late-private-token', expiresAt: '2026-10-03T03:00:00Z' }));
  await assert.rejects(activating, { code: 'ACCESS_CANCELLED' }); assert.equal(h.conversation.getState().authorized, false);
});

test('explicit current spoken Stop releases capture while quoted or historical stop sentences do not', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'quoted' }); await tick();
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'quoted', transcript: 'Yesterday I said stop listening.' }); await tick();
  assert.equal(h.tracks[0].stopped, false);
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'current-stop' }); await tick();
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'current-stop', transcript: 'Stop listening.' }); await tick();
  assert.equal(h.tracks[0].stopped, true); assert.equal(h.peers[0].connectionState, 'closed');
  assert.ok(h.events.some(event => event.type === 'spoken-stop')); await h.conversation.exit();
});

test('a model action arriving before late Stop transcription cannot run through the local intent gate', async () => {
  let actions = 0; const h = await authorized({ onAction: async () => { actions++; throw new Error('Must not execute'); } });
  await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'late-stop' }); await tick();
  dc.receive({ type: 'response.created', response: { id: 'late-stop-response' } }); await tick();
  dc.receive({ type: 'response.done', response: { id: 'late-stop-response', status: 'completed', output: [{ type: 'function_call', call_id: 'late-stop-call', name: 'navigate', arguments: '{"destination":"earth"}' }] } }); await tick();
  assert.equal(actions, 0);
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late-stop', transcript: 'Stop.' }); await tick();
  assert.equal(actions, 0); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(dc.sent.some(value => value.item?.call_id === 'late-stop-call'), false); await h.conversation.exit();
});

test('invalid tools and gate timeout cannot create a model continuation before current ASR final', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'pending-intent' }); await tick();
  dc.receive({ type: 'response.created', response: { id: 'invalid-before-ASR' } }); await tick();
  dc.receive({ type: 'response.done', response: { id: 'invalid-before-ASR', status: 'completed', output: [{ type: 'function_call', call_id: 'invalid-call', name: 'navigate', arguments: 'bad JSON' }] } }); await tick();
  assert.equal(dc.sent.some(value => value.item?.call_id === 'invalid-call'), false);
  const timeout = [...h.timers.values()].find(timer => timer.delay === 3000); assert.ok(timeout); timeout.fn(); await tick();
  assert.equal(dc.sent.some(value => value.item?.call_id === 'invalid-call'), false);
  assert.equal(dc.sent.some(value => value.type === 'response.create'), false);
  assert.ok(h.events.some(event => event.code === 'VOICE_INTENT_UNCONFIRMED')); await h.conversation.exit();
});

test('a fresh current spoken response restores playback after text fallback while Media keeps it muted', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const peer = h.peers[0]; const dc = peer.channel;
  const remote = { remoteAudio: true }; const event = new Event('track'); event.streams = [remote]; peer.dispatchEvent(event);
  dc.readyState = 'connecting'; await h.conversation.sendText('Fallback text'); assert.equal(h.audio.muted, true);
  dc.readyState = 'open'; dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'new-spoken' }); await tick();
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'new-spoken', transcript: 'Tell me about the worlds.' }); await tick();
  dc.receive({ type: 'response.created', response: { id: 'new-spoken-response' } }); await tick();
  assert.equal(h.audio.muted, false); assert.equal(h.audio.srcObject, remote);
  await h.conversation.enterMedia(); dc.receive({ type: 'response.created', response: { id: 'late-media-response' } }); await tick();
  assert.equal(h.audio.muted, true); assert.equal(h.audio.srcObject, null); await h.conversation.exit();
});

test('a spoken response restores its sink after the live typed response timeout releases pending output', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const peer = h.peers[0]; const dc = peer.channel;
  const remote = { remoteAudio: true }; const event = new Event('track'); event.streams = [remote]; peer.dispatchEvent(event);
  const sending = h.conversation.sendText('Typed in the live conversation');
  const timeout = [...h.timers.values()].find(timer => timer.delay === 50000); assert.ok(timeout); timeout.fn();
  assert.equal((await sending).status, 'incomplete'); assert.equal(h.audio.muted, true);
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'after-timeout' }); await tick();
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'after-timeout', transcript: 'A fresh question.' }); await tick();
  dc.receive({ type: 'response.created', response: { id: 'after-timeout-response' } }); await tick();
  assert.equal(h.audio.muted, false); assert.equal(h.audio.srcObject, remote); await h.conversation.exit();
});

test('revocation keeps readable transcript but removes every prior turn from request and voice replay', async () => {
  const h = await authorized(); await h.conversation.sendText('Private prior note');
  h.currentContext.consentEpoch++; await h.conversation.revokeContext(); await h.conversation.sendText('Fresh context');
  const requests = h.requests.filter(value => value.body?.kind === 'start'); assert.deepEqual(requests[1].body.history, []);
  assert.ok(h.conversation.getState().transcript.some(value => value.text === 'Private prior note'));
  await h.conversation.startVoice();
  assert.equal(h.peers[0].channel.sent.some(value => value.item?.content?.[0]?.text === 'Private prior note'), false);
  await h.conversation.exit();
});

test('Clear conversation deletes this visit transcript and replay while leaving note consent untouched', async () => {
  const h = await authorized(); await h.conversation.sendText('Clear this visit'); await h.conversation.clearConversation();
  assert.deepEqual(h.conversation.getState().transcript, []); assert.equal(h.currentContext.consentEpoch, 0);
  assert.ok(h.events.some(value => value.type === 'cleared'));
  await h.conversation.sendText('After clear'); const requests = h.requests.filter(value => value.body?.kind === 'start');
  assert.deepEqual(requests[1].body.history, []); await h.conversation.exit();
});

test('hidden tab stops tracks and does not automatically acquire a new paid call on return', async () => {
  const h = await authorized(); await h.conversation.startVoice(); h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); await tick();
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); await tick();
  assert.equal(h.tracks[0].stopped, true); assert.equal(h.peers.length, 1);
  assert.equal(h.requests.filter(value => value.path.endsWith('/realtime')).length, 1);
  await h.conversation.exit();
});

test('provider tool arguments execute only after a complete response and receive observed results', async () => {
  let called = 0; const h = await authorized({ onAction: async request => { called++; return { version: 1, requestId: request.requestId, routeEpoch: 0, status: 'applied', code: 'NAVIGATED', message: 'Observed world', observedState: { destination: 'dream-world', worldFocus: null, earth: null } }; } });
  await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'response.created', response: { id: 'response-1' } }); await tick();
  dc.receive({ type: 'response.function_call_arguments.delta', delta: '{"destination":' }); await tick(); assert.equal(called, 0);
  dc.receive({ type: 'response.done', response: { id: 'response-1', status: 'completed', output: [{ type: 'function_call', call_id: 'call-1', name: 'navigate', arguments: '{"destination":"dream-world"}' }] } }); await tick();
  assert.equal(called, 1); assert.ok(dc.sent.some(value => value.item?.call_id === 'call-1' && JSON.parse(value.item.output).code === 'NAVIGATED'));
  dc.receive({ type: 'response.done', response: { id: 'response-1', status: 'completed', output: [{ type: 'function_call', call_id: 'call-1', name: 'navigate', arguments: '{"destination":"dream-world"}' }] } }); await tick(); assert.equal(called, 1);
  await h.conversation.exit();
});

test('voice knowledge lookup returns actual complete service source chunks to the model', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'response.created', response: { id: 'knowledge' } }); await tick();
  dc.receive({ type: 'response.done', response: { id: 'knowledge', status: 'completed', output: [{ type: 'function_call', call_id: 'knowledge-call', name: 'lookup_knowledge', arguments: '{"query":"practice","topics":[]}' }] } }); await tick();
  const output = dc.sent.find(value => value.item?.call_id === 'knowledge-call');
  assert.equal(JSON.parse(output.item.output).chunks[0].text, 'Real source passage.'); assert.equal(h.events.some(value => value.type === 'action-result'), false);
  await h.conversation.exit();
});

test('stale in-flight action completion cannot create an old provider response after Stop', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; }); let request;
  const h = await authorized({ onAction: async value => { request = value; return pending; } }); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'response.created', response: { id: 'old' } }); await tick();
  dc.receive({ type: 'response.done', response: { id: 'old', status: 'completed', output: [{ type: 'function_call', call_id: 'old-call', name: 'navigate', arguments: '{"destination":"earth"}' }] } }); await tick();
  await h.conversation.stop(); finish({ version: 1, requestId: request.requestId, routeEpoch: 0, status: 'applied', code: 'LATE', message: '', observedState: null }); await tick();
  assert.equal(dc.sent.some(value => value.item?.call_id === 'old-call'), false);
  await h.conversation.exit();
});

test('text continuation uses fresh HTTP identity and the bound original action request identity', async () => {
  const h = await authorized({ fetch: async (path, body) => {
    if (!path.endsWith('/turns') || body.kind === 'cancel') return null;
    if (body.kind === 'result') return stream([['turn.complete', { turnId: body.turnId, text: 'Navigation observed' }]]);
    const action = { version: 1, sessionId: id(400), turnId: body.turnId, requestId: id(401), routeEpoch: 0, consentEpoch: 0, memoryRevision: 0, tool: { name: 'navigate', args: { destination: 'dream-world' } } };
    return stream([['action.request', { turnId: body.turnId, action, actionId: action.requestId, continuationToken: 'signed-continuation' }]]);
  } });
  await h.conversation.sendText('Open world'); const continuation = h.requests.find(value => value.body?.kind === 'result').body;
  assert.equal(continuation.actionId, id(401)); assert.equal(continuation.result.requestId, id(401)); assert.notEqual(continuation.requestId, id(401));
  assert.equal(h.conversation.getState().transcript.at(-1).text, 'Navigation observed'); await h.conversation.exit();
});

test('an observed navigation advances the owned text action chain to its new route epoch', async () => {
  let h; const seen = [];
  h = await authorized({ fetch: async (path, body) => {
    if (!path.endsWith('/turns') || body.kind === 'cancel') return null;
    if (body.kind === 'result' && body.actionId === id(402)) return stream([['turn.complete', { turnId: body.turnId, text: 'Earth is observed' }]]);
    const second = body.kind === 'result';
    const action = { version: 1, sessionId: id(400), turnId: body.turnId, requestId: id(second ? 402 : 401), routeEpoch: second ? 1 : 0, consentEpoch: 0, memoryRevision: 0,
      tool: second ? { name: 'earth_zoom_to_globe', args: {} } : { name: 'navigate', args: { destination: 'earth' } } };
    return stream([['action.request', { turnId: body.turnId, action, actionId: action.requestId, continuationToken: 'signed-continuation' }]]);
  }, onAction: async request => {
    seen.push(request.routeEpoch);
    if (request.tool.name === 'navigate') {
      h.currentContext.routeEpoch = 1;
      h.currentContext.uiContext = { destination: 'earth', worldFocus: null, earth: { globe: 'ready', restore: 'none', mediaMode: 'conversation' } };
    }
    return { version: 1, requestId: request.requestId, routeEpoch: request.routeEpoch, status: 'applied', code: 'OBSERVED', message: 'Observed', observedState: h.currentContext.uiContext };
  } });
  await h.conversation.sendText('Open Earth, then show the globe'); assert.deepEqual(seen, [0, 1]);
  assert.equal(h.conversation.getState().transcript.at(-1).text, 'Earth is observed'); await h.conversation.exit();
});

test('failed or cancelled voice output stays provisional and cannot reappear in a new session replay', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'response.created', response: { id: 'partial' } }); await tick();
  dc.receive({ type: 'response.output_audio_transcript.done', response_id: 'partial', item_id: 'partial-item', transcript: 'Unfinished answer' }); await tick();
  dc.receive({ type: 'response.done', response: { id: 'partial', status: 'cancelled', output: [] } }); await tick();
  assert.equal(h.conversation.getState().transcript.at(-1).final, false);
  await h.conversation.stop(); await h.conversation.startVoice();
  assert.equal(h.peers[1].channel.sent.some(value => value.item?.content?.[0]?.text === 'Unfinished answer'), false); await h.conversation.exit();
});

test('history byte bounds account for Unicode and only current final consented context', () => {
  const records = Array.from({ length: 20 }, (_, index) => ({ role: 'user', text: '😀'.repeat(1000), final: true, replayEligible: true, consentEpoch: 1, memoryRevision: 2, id: index }));
  const history = boundedHistory(records, 1, 2); assert.ok(history.length <= 6); assert.deepEqual(boundedHistory(records, 2, 2), []);
});

test('finite SSE accepts split CRLF boundaries and rejects unknown executable events', async () => {
  const encoder = new TextEncoder(); const chunks = ['event: turn.complete\r', '\ndata: {"version":1,"turnId":"x","text":"done"}\r', '\n\r\n'];
  const response = new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const events = []; await readFiniteSSE(response, (name, value) => events.push({ name, value })); assert.equal(events[0].name, 'turn.complete');
  await assert.rejects(readFiniteSSE(stream([['execute.raw', { turnId: 'x', script: 'bad' }]]), () => {}), { code: 'INVALID_STREAM' });
});
