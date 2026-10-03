import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversation } from '../prototype/conversation/controller.js';
import { boundedHistory, readFiniteSSE, serviceResponse } from '../prototype/conversation/text.js';

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
    const track = new EventTarget(); Object.assign(track, { kind: 'audio', readyState: 'live', stopped: false, stop() { this.stopped = true; this.readyState = 'ended'; } }); tracks.push(track);
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  }
  class Channel extends EventTarget {
    readyState = 'connecting'; sent = [];
    send(value) { const event = JSON.parse(value); if (options.sendFailure || options.failEvent?.(event)) throw options.sendFailure || new DOMException('selective send failure', 'OperationError'); this.sent.push(event); }
    close() { this.readyState = 'closed'; }
    receive(value) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })); }
  }
  class Peer extends EventTarget {
    connectionState = 'new'; replaced = []; channel = new Channel();
    constructor() { super(); peers.push(this); }
    addTrack(track) { this.track = track; return { replaceTrack: async value => { this.replaced.push(value); this.track = value; if (options.replaceTrack) await options.replaceTrack(value); } }; }
    createDataChannel() { return this.channel; }
    async createOffer() { if (options.createOffer) await options.createOffer(); return { sdp: 'v=0\r\n' }; }
    async setLocalDescription() { if (options.setLocalDescription) await options.setLocalDescription(); }
    async setRemoteDescription() { if (options.setRemoteDescription) await options.setRemoteDescription(); this.connectionState = 'connected'; this.channel.readyState = 'open'; this.channel.dispatchEvent(new Event('open')); this.dispatchEvent(new Event('connectionstatechange')); }
    close() { this.connectionState = 'closed'; }
    restartIce() { this.restarted = true; }
  }
  const doc = new EventTarget(); doc.hidden = false; const win = new EventTarget();
  const audio = { srcObject: null, muted: false, autoplay: false, paused: false, removed: false, async play() { this.paused = false; if (options.audioPlay) await options.audioPlay(); }, pause() { this.paused = true; }, remove() { this.removed = true; } };
  async function fetcher(url, init = {}) {
    const path = new URL(url).pathname; const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ path, body, init });
    if (options.fetch) { const value = await options.fetch(path, body, init); if (value) return value; }
    if (path.endsWith('/access')) return Response.json({ version: 1, accessToken: 'private-token', expiresAt: '2026-10-03T03:00:00Z', canonVersion: currentContext.canonVersion });
    if (path.endsWith('/status')) return Response.json({ version: 1, enabled: true, ready: true, access: 'invite', voiceConfigured: true, textConfigured: true, reason: null, reasonCodes: [] });
    if (path.endsWith('/realtime')) return Response.json({ version: 1, sessionId: id(500), transport: { type: 'webrtc', sdp: 'answer' }, closeToken: 'close-only', clientDeadlineAt: '2026-10-03T02:12:00Z' });
    if (path.endsWith('/sessions/close')) return Response.json({ version: 1, status: 'closed' });
    if (path.endsWith('/knowledge')) return Response.json({ version: 1, chunks: [{ id: 'manifesto-practice', sourceId: 'manifesto', title: 'Practice', text: 'Real source passage.', claimType: 'philosophy', sha256: 'a'.repeat(64) }] });
    if (path.endsWith('/turns') && body.kind === 'cancel') return Response.json({ version: 1, status: 'cancelled' });
    if (path.endsWith('/turns')) return stream([['text.delta', { turnId: body.turnId, text: 'Actual ' }], ['turn.complete', { turnId: body.turnId, text: 'Actual reply' }]]);
    return Response.json({ version: 1, ready: false, reason: 'SERVICE_NOT_READY' });
  }
  const conversation = createConversation({ fetch: fetcher, randomUUID: () => id(next++), now: () => Date.parse('2026-10-03T02:00:00Z'),
    mediaDevices: options.mediaDevices === null ? null : { getUserMedia: options.getUserMedia || (async () => captureStream()) }, PeerConnection: options.PeerConnection === null ? null : Peer, createAudio: () => audio,
    isSecureContext: options.isSecureContext ?? true,
    document: doc, window: win, getContext: () => currentContext, onEvent: value => events.push(value),
    onAction: options.onAction || (async request => ({ version: 1, requestId: request.requestId, routeEpoch: currentContext.routeEpoch, status: 'applied', code: 'APPLIED', message: 'Observed', observedState: currentContext.uiContext })),
    ensureMediaQuiet: options.ensureMediaQuiet || (async () => true), setTimer: (fn, delay) => { const key = ++timerId; timers.set(key, { fn, delay }); return key; }, clearTimer: key => timers.delete(key) });
  return { conversation, requests, events, tracks, peers, timers, doc, win, audio, currentContext, captureStream };
}
async function authorized(options) { const value = harness(options); await value.conversation.access('a'.repeat(24)); return value; }
async function spokenTurn(dc, itemId, transcript = 'Open the requested destination.') {
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: itemId });
  dc.receive({ type: 'input_audio_buffer.speech_stopped', item_id: itemId });
  dc.receive({ type: 'input_audio_buffer.committed', item_id: itemId });
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: itemId, transcript }); await tick();
}
async function responseCreated(dc, responseId, request = dc.sent.findLast(event => event.type === 'response.create')) {
  assert.ok(request?.response?.metadata?.unity_response, 'An owned response.create must precede response.created');
  dc.receive({ type: 'response.created', response: { id: responseId, metadata: request.response.metadata } }); await tick();
}


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
  const h = await authorized({ getUserMedia: () => permission }); const starting = h.conversation.startVoice(); await tick();
  await h.conversation.stop(); const lateStream = h.captureStream(); grant(lateStream); await starting; await tick();
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
  assert.equal(h.conversation.getState().voice, 'paused-media'); assert.equal(h.conversation.getState().mode, 'media');
  assert.equal(h.peers[0].connectionState, 'connected');
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
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'pending-intent' });
  dc.receive({ type: 'input_audio_buffer.committed', item_id: 'pending-intent' }); await tick();
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
  dc.receive({ type: 'input_audio_buffer.committed', item_id: 'new-spoken' }); await tick(); await responseCreated(dc, 'new-spoken-response');
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
  dc.receive({ type: 'input_audio_buffer.committed', item_id: 'after-timeout' }); await tick(); await responseCreated(dc, 'after-timeout-response');
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
  await spokenTurn(dc, 'input-response-1'); await responseCreated(dc, 'response-1');
  dc.receive({ type: 'response.function_call_arguments.delta', delta: '{"destination":' }); await tick(); assert.equal(called, 0);
  dc.receive({ type: 'response.done', response: { id: 'response-1', status: 'completed', output: [{ type: 'function_call', call_id: 'call-1', name: 'navigate', arguments: '{"destination":"dream-world"}' }] } }); await tick();
  assert.equal(called, 1); assert.ok(dc.sent.some(value => value.item?.call_id === 'call-1' && JSON.parse(value.item.output).code === 'NAVIGATED'));
  dc.receive({ type: 'response.done', response: { id: 'response-1', status: 'completed', output: [{ type: 'function_call', call_id: 'call-1', name: 'navigate', arguments: '{"destination":"dream-world"}' }] } }); await tick(); assert.equal(called, 1);
  await h.conversation.exit();
});

test('voice knowledge lookup returns actual complete service source chunks to the model', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  await spokenTurn(dc, 'input-knowledge'); await responseCreated(dc, 'knowledge');
  dc.receive({ type: 'response.done', response: { id: 'knowledge', status: 'completed', output: [{ type: 'function_call', call_id: 'knowledge-call', name: 'lookup_knowledge', arguments: '{"query":"practice","topics":[]}' }] } }); await tick();
  const output = dc.sent.find(value => value.item?.call_id === 'knowledge-call');
  assert.equal(JSON.parse(output.item.output).chunks[0].text, 'Real source passage.'); assert.equal(h.events.some(value => value.type === 'action-result'), false);
  await h.conversation.exit();
});

test('stale in-flight action completion cannot create an old provider response after Stop', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; }); let request;
  const h = await authorized({ onAction: async value => { request = value; return pending; } }); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  await spokenTurn(dc, 'input-old'); await responseCreated(dc, 'old');
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
  await spokenTurn(dc, 'input-partial'); await responseCreated(dc, 'partial');
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


test('Stage4: an unsolicited response cannot acquire action authority from the newest utterance', async () => {
  let actions = 0; const h = await authorized({ onAction: async request => { actions++; return { version: 1, requestId: request.requestId, routeEpoch: 0, status: 'applied', code: 'APPLIED', message: '', observedState: null }; } });
  await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'current' });
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'current', transcript: 'Tell me about the manifesto.' }); await tick();
  dc.receive({ type: 'response.created', response: { id: 'obsolete-unowned-response' } });
  dc.receive({ type: 'response.done', response: { id: 'obsolete-unowned-response', status: 'completed', output: [{ type: 'function_call', call_id: 'obsolete-call', name: 'navigate', arguments: '{"destination":"earth"}' }] } }); await tick();
  assert.equal(actions, 0); await h.conversation.exit();
});

test('Stage4: Stop closes the peer and requests hangup before a stalled replaceTrack resolves', async () => {
  const h = await authorized({ replaceTrack: () => new Promise(() => {}) }); await h.conversation.startVoice();
  const stopping = h.conversation.stop(); await tick();
  assert.equal(h.peers[0].connectionState, 'closed');
  assert.equal(h.requests.filter(request => request.path.endsWith('/sessions/close')).length, 1);
  await stopping; await h.conversation.exit();
});

test('Stage4: finite stream abort releases a stalled reader without requiring another chunk', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const controller = new AbortController(); const reading = readFiniteSSE(response, () => {}, controller.signal);
  const rejection = assert.rejects(reading, { name: 'AbortError' }); controller.abort(); await tick();
  assert.equal(cancelled, true); await rejection;
});

test('Stage4: text completion followed by a conflicting event cannot become replay history', async () => {
  const h = await authorized({ fetch: (path, body) => body?.kind === 'start' ? stream([
    ['turn.complete', { turnId: body.turnId, text: 'Do not replay malformed completion' }],
    ['text.delta', { turnId: body.turnId, text: 'conflict' }],
  ]) : null });
  await assert.rejects(h.conversation.sendText('test'), { code: 'INVALID_STREAM' });
  assert.equal(h.conversation.getState().transcript.some(item => item.role === 'assistant' && item.final), false);
  await h.conversation.startVoice();
  assert.equal(h.peers[0].channel.sent.some(event => event.item?.content?.[0]?.text === 'Do not replay malformed completion'), false);
  await h.conversation.exit();
});


test('Stage4: only current committed and transcribed voice input creates an attributed response', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
  dc.receive({ type: 'input_audio_buffer.speech_started', item_id: 'one' });
  dc.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'Tell me about the world.' }); await tick();
  assert.equal(dc.sent.filter(event => event.type === 'response.create').length, 0);
  dc.receive({ type: 'input_audio_buffer.committed', item_id: 'one' }); await tick();
  assert.equal(dc.sent.filter(event => event.type === 'response.create').length, 1);
  const oldRequest = dc.sent.findLast(event => event.type === 'response.create');
  await spokenTurn(dc, 'two', 'A new question.');
  dc.receive({ type: 'response.created', response: { id: 'old-arrives-late', metadata: oldRequest.response.metadata } }); await tick();
  assert.equal(h.audio.muted, true);
  assert.ok(dc.sent.some(event => event.type === 'response.cancel' && event.response_id === 'old-arrives-late'));
  await responseCreated(dc, 'current-response'); assert.equal(h.audio.muted, false);
  await h.conversation.exit();
});

test('Stage4: typed response timeout revokes even a previously accepted response action', async () => {
  let actions = 0; const h = await authorized({ onAction: async () => { actions++; throw new Error('Must not execute'); } });
  await h.conversation.startVoice(); const dc = h.peers[0].channel;
  const sending = h.conversation.sendText('Open Earth'); await responseCreated(dc, 'typed-timeout');
  const timeout = [...h.timers.values()].find(timer => timer.delay === 50000); timeout.fn();
  assert.equal((await sending).status, 'incomplete');
  dc.receive({ type: 'response.done', response: { id: 'typed-timeout', status: 'completed', output: [{ type: 'function_call', call_id: 'late-typed-call', name: 'navigate', arguments: '{"destination":"earth"}' }] } }); await tick();
  assert.equal(actions, 0); assert.equal(h.audio.muted, true); await h.conversation.exit();
});

test('Stage4: late permission continuation between capture and assignment cannot leak a microphone', async () => {
  let grant; const permission = new Promise(resolve => { grant = resolve; });
  const h = await authorized({ getUserMedia: () => permission }); const starting = h.conversation.startVoice(); await tick();
  grant(h.captureStream()); let stopping;
  queueMicrotask(() => { stopping = h.conversation.stop(); });
  await starting; await stopping;
  assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers.length, 0); await h.conversation.exit();
});

test('Stage4: Stop during asynchronous SDP offer prevents a new paid request', async () => {
  let finish; const offering = new Promise(resolve => { finish = resolve; });
  const h = await authorized({ createOffer: () => offering }); const starting = h.conversation.startVoice(); await tick();
  await h.conversation.stop(); finish(); await starting;
  assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false);
  assert.ok(h.tracks.every(track => track.stopped)); await h.conversation.exit();
});

test('Stage4: Resume on an ended data channel closes the old session without recursive deadlock or paid restart', async () => {
  const h = await authorized(); await h.conversation.startVoice(); await h.conversation.enterMedia(); h.peers[0].channel.readyState = 'closed';
  await assert.rejects(h.conversation.resumeVoice(), { code: 'VOICE_RECONNECT_REQUIRED' });
  assert.equal(h.peers[0].connectionState, 'closed'); assert.equal(h.peers.length, 1); assert.equal(h.tracks.length, 1);
  await h.conversation.exit();
});

test('Stage4: Resume while already listening never acquires a second microphone', async () => {
  const h = await authorized(); await h.conversation.startVoice(); await h.conversation.resumeVoice();
  assert.equal(h.tracks.length, 1); await h.conversation.exit(); assert.ok(h.tracks.every(track => track.stopped));
});

test('Stage4: a cancelled text request failing late cannot overwrite the current successful turn', async () => {
  let fail; const old = new Promise((resolve, reject) => { fail = reject; });
  const h = await authorized({ fetch: (path, body) => body?.message === 'old' ? old : null });
  const oldSending = h.conversation.sendText('old'); await tick(); await h.conversation.sendText('new');
  fail(new Error('Old network failure')); assert.equal((await oldSending).status, 'cancelled');
  assert.equal(h.conversation.getState().error, null); assert.equal(h.conversation.getState().transcript.at(-1).text, 'Actual reply'); await h.conversation.exit();
});

test('Stage4: an action in a malformed finite stream is rejected before execution', async () => {
  let actions = 0;
  const h = await authorized({ onAction: async () => { actions++; throw new Error('Must not execute'); }, fetch: (path, body) => {
    if (body?.kind !== 'start') return null;
    const action = { version: 1, sessionId: id(400), turnId: body.turnId, requestId: id(401), routeEpoch: 0, consentEpoch: 0, memoryRevision: 0, tool: { name: 'navigate', args: { destination: 'earth' } } };
    return stream([['action.request', { turnId: body.turnId, action, actionId: action.requestId, continuationToken: 'signed' }], ['turn.complete', { turnId: body.turnId, text: 'Conflicting completion' }]]);
  } });
  await assert.rejects(h.conversation.sendText('Open Earth'), { code: 'INVALID_STREAM' }); assert.equal(actions, 0); await h.conversation.exit();
});

test('Stage5: unavailable or undeployed service never asks for a microphone', async () => {
  for (const response of [
    Response.json({ version: 1, enabled: false, ready: false, access: 'invite', voiceConfigured: false, textConfigured: false, reason: 'SERVICE_NOT_READY', reasonCodes: ['AI_DISABLED', 'PROVIDER_NOT_CONFIGURED'] }),
    new Response('<html>missing</html>', { status: 404 }),
    Response.json({ version: 1, ready: true }),
  ]) {
    let captures = 0;
    const h = await authorized({ getUserMedia: async () => { captures++; throw new Error('must not capture'); }, fetch: path => path.endsWith('/status') ? response : null });
    await assert.rejects(h.conversation.startVoice());
    assert.equal(captures, 0); assert.equal(h.peers.length, 0);
    assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false);
    assert.equal(h.conversation.getState().service.phase, 'unavailable');
    assert.notEqual(h.conversation.getState().error.code, 'ACCESS_REQUIRED');
    await h.conversation.exit();
  }
});

test('Stage5: a status retry observes a later corrected deployment without retaining an unavailable cache', async () => {
  let enabled = false;
  const h = await authorized({ fetch: path => path.endsWith('/status') && !enabled ? new Response('old deployment', { status: 404 }) : null });
  await assert.rejects(h.conversation.getStatus(), { code: 'SERVICE_DEPLOYMENT_MISSING' });
  assert.equal(h.conversation.getState().service.code, 'SERVICE_DEPLOYMENT_MISSING');
  enabled = true; await h.conversation.getStatus(); assert.equal(h.conversation.getState().service.phase, 'available');
  await h.conversation.startVoice(); assert.equal(h.tracks.length, 1); await h.conversation.exit();
});

test('Stage5: bounded status wait and Stop during preflight cannot acquire capture after late readiness', async () => {
  for (const kind of ['stop', 'timeout']) {
    let ready; let captures = 0;
    const pending = new Promise(resolve => { ready = resolve; });
    const h = await authorized({ getUserMedia: async () => { captures++; return h.captureStream(); }, fetch: path => path.endsWith('/status') ? pending : null });
    const starting = h.conversation.startVoice(); await tick();
    if (kind === 'timeout') {
      const rejected = assert.rejects(starting, { code: 'SERVICE_STATUS_TIMEOUT' });
      const timeout = [...h.timers.values()].find(value => value.delay === 8000); assert.ok(timeout); timeout.fn(); await rejected;
    } else { await h.conversation.stop(); await starting; }
    ready(Response.json({ version: 1, enabled: true, ready: true, access: 'invite', voiceConfigured: true, textConfigured: true, reason: null })); await tick();
    assert.equal(captures, 0); assert.equal(h.peers.length, 0); assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false);
    await h.conversation.exit();
  }
});

test('Stage5: microphone platform errors offer accurate recoveries without creating a paid call', async () => {
  for (const [name, code] of [
    ['NotAllowedError', 'MICROPHONE_PERMISSION_BLOCKED'], ['SecurityError', 'MICROPHONE_POLICY_BLOCKED'],
    ['NotFoundError', 'MICROPHONE_NOT_FOUND'], ['NotReadableError', 'MICROPHONE_BUSY'], ['AbortError', 'MICROPHONE_INTERRUPTED'],
    ['OverconstrainedError', 'MICROPHONE_CONSTRAINTS'], ['InvalidStateError', 'MICROPHONE_PAGE_INACTIVE'],
  ]) {
    const h = await authorized({ getUserMedia: () => Promise.reject(new DOMException('native detail', name)) });
    await assert.rejects(h.conversation.startVoice(), { code });
    assert.equal(h.conversation.getState().error.code, code); assert.equal(h.conversation.getState().voice, 'failed');
    assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false); await h.conversation.exit();
  }
});

test('Stage5: insecure, unsupported, and policy-blocked microphone environments do not request permission', async () => {
  for (const [option, code] of [[{ isSecureContext: false }, 'MICROPHONE_HTTPS_REQUIRED'], [{ mediaDevices: null }, 'MICROPHONE_UNAVAILABLE'], [{ PeerConnection: null }, 'VOICE_UNAVAILABLE'], [{}, 'MICROPHONE_POLICY_BLOCKED']]) {
    let captures = 0;
    const h = await authorized({ ...option, getUserMedia: () => { captures++; throw new Error('must not capture'); } });
    if (code === 'MICROPHONE_POLICY_BLOCKED') h.doc.permissionsPolicy = { allowsFeature: () => false };
    await assert.rejects(h.conversation.startVoice(), { code }); assert.equal(captures, 0);
    assert.equal(h.conversation.getState().error.code, code); assert.equal(h.conversation.getState().voice, 'failed'); await h.conversation.exit();
  }
});

test('Stage5: unanswered microphone permission times out and a late grant is physically released', async () => {
  let grant; const pending = new Promise(resolve => { grant = resolve; });
  const h = await authorized({ getUserMedia: () => pending });
  const starting = h.conversation.startVoice(); const rejected = assert.rejects(starting, { code: 'MICROPHONE_PERMISSION_TIMEOUT' }); await tick();
  const timeout = [...h.timers.values()].find(value => value.delay === 30000); assert.ok(timeout); timeout.fn(); await rejected;
  grant(h.captureStream()); await tick(); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false); await h.conversation.exit();
});

test('Stage5: capture must contain an active audio track before a paid call can start', async () => {
  for (const ended of [false, true]) {
    let supplied;
    const h = await authorized({ getUserMedia: () => {
      supplied = h.captureStream(); if (ended) supplied.getTracks()[0].readyState = 'ended';
      return ended ? supplied : { getTracks: supplied.getTracks, getAudioTracks: () => [] };
    } });
    await assert.rejects(h.conversation.startVoice(), { code: 'MICROPHONE_NOT_FOUND' });
    assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false); await h.conversation.exit();
  }
});

test('Stage5: a disconnected microphone closes the owned voice connection instead of claiming listening', async () => {
  const h = await authorized(); await h.conversation.startVoice();
  h.tracks[0].readyState = 'ended'; h.tracks[0].dispatchEvent(new Event('ended')); await tick();
  assert.equal(h.conversation.getState().error.code, 'MICROPHONE_ENDED'); assert.equal(h.conversation.getState().voice, 'failed');
  assert.equal(h.peers[0].connectionState, 'closed'); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(h.requests.filter(request => request.path.endsWith('/sessions/close')).length, 1); await h.conversation.exit();
});

test('Stage5: data-channel termination closes capture and preserves text as a deliberate next action', async () => {
  for (const event of ['close', 'error']) {
    const h = await authorized(); await h.conversation.startVoice(); h.peers[0].channel.dispatchEvent(new Event(event)); await tick();
    assert.equal(h.conversation.getState().voice, 'failed'); assert.equal(h.conversation.getState().error.code, 'VOICE_RECONNECT_REQUIRED');
    assert.ok(h.tracks.every(track => track.stopped)); await h.conversation.sendText('Use text after a connection failure');
    assert.equal(h.conversation.getState().transcript.at(-1).text, 'Actual reply'); await h.conversation.exit();
  }
});

test('Stage5: one bounded transport recovery is explicit and a repeated disconnection releases capture', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const peer = h.peers[0];
  peer.connectionState = 'disconnected'; peer.dispatchEvent(new Event('connectionstatechange'));
  assert.equal(h.conversation.getState().voice, 'recovering'); assert.equal(h.audio.muted, true);
  peer.connectionState = 'connected'; peer.dispatchEvent(new Event('connectionstatechange'));
  assert.equal(h.conversation.getState().voice, 'listening');
  assert.equal([...h.timers.values()].some(timer => timer.delay === 5000), false);
  peer.connectionState = 'disconnected'; peer.dispatchEvent(new Event('connectionstatechange')); await tick();
  assert.equal(h.conversation.getState().voice, 'failed'); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(h.requests.filter(request => request.path.endsWith('/realtime')).length, 1); await h.conversation.exit();
});

test('Stage5: recovery deadline closes the existing call without creating a replacement', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const peer = h.peers[0];
  peer.connectionState = 'disconnected'; peer.dispatchEvent(new Event('connectionstatechange'));
  const timeout = [...h.timers.values()].find(timer => timer.delay === 5000); assert.ok(timeout); timeout.fn(); await tick();
  assert.equal(h.conversation.getState().voice, 'failed'); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(h.requests.filter(request => request.path.endsWith('/realtime')).length, 1); await h.conversation.exit();
});

test('Stage5: Resume never reacquires a microphone on a disconnected owned peer', async () => {
  const h = await authorized(); await h.conversation.startVoice(); await h.conversation.enterMedia();
  h.peers[0].connectionState = 'disconnected';
  await assert.rejects(h.conversation.resumeVoice(), { code: 'VOICE_RECONNECT_REQUIRED' });
  assert.equal(h.tracks.length, 1); assert.equal(h.peers[0].connectionState, 'closed'); await h.conversation.exit();
});

test('Stage5: throwing data-channel writes cannot obstruct physical Stop cleanup or hangup', async () => {
  const h = await authorized({ sendFailure: new DOMException('buffer full', 'OperationError') }); await h.conversation.startVoice();
  await h.conversation.stop(); assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed');
  assert.equal(h.requests.filter(request => request.path.endsWith('/sessions/close')).length, 1); await h.conversation.exit();
});

test('Stage5: network and service errors explain the failure without exposing platform details', async () => {
  const h = await authorized({ fetch: path => path.endsWith('/status') ? Promise.reject(new TypeError('internal host and token detail')) : null });
  await assert.rejects(h.conversation.getStatus(), { code: 'NETWORK_UNAVAILABLE' });
  assert.match(h.conversation.getState().service.message, /Check your connection/);
  assert.equal(h.conversation.getState().service.message.includes('token detail'), false); await h.conversation.exit();
  await assert.rejects(serviceResponse(Response.json({ code: 'SERVICE_NOT_READY', message: 'SERVICE_NOT_READY' }, { status: 503 })), failure => failure.code === 'SERVICE_NOT_READY' && failure.message.includes('configuration'));
});

test('Stage5: late paid creation after Stop or a creation deadline is closed without reviving capture', async () => {
  for (const ending of ['stop', 'timeout']) {
    let complete; const pending = new Promise(resolve => { complete = resolve; });
    const h = await authorized({ fetch: path => path.endsWith('/realtime') ? pending : null });
    const starting = h.conversation.startVoice(); await tick();
    assert.equal(h.tracks.length, 1);
    if (ending === 'stop') { await h.conversation.stop(); await starting; }
    else {
      const rejection = assert.rejects(starting, { code: 'VOICE_START_TIMEOUT' });
      const timeout = [...h.timers.values()].find(timer => timer.delay === 35000); assert.ok(timeout); timeout.fn(); await rejection;
      assert.equal(h.conversation.getState().error.code, 'VOICE_START_TIMEOUT');
    }
    assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed');
    complete(Response.json({ version: 1, sessionId: id(501), transport: { type: 'webrtc', sdp: 'late-answer' }, closeToken: 'late-close', clientDeadlineAt: '2026-10-03T02:12:00Z' })); await tick();
    assert.equal(h.peers[0].connectionState, 'closed'); assert.ok(h.tracks.every(track => track.stopped));
    const closed = h.requests.filter(request => request.path.endsWith('/sessions/close'));
    assert.equal(closed.length, 1); assert.equal(closed[0].body.sessionId, id(501)); await h.conversation.exit();
  }
});

test('Stage5: a failed response write ends the owned call instead of leaving a typed turn thinking', async () => {
  const h = await authorized({ sendFailure: new DOMException('buffer full', 'OperationError') }); await h.conversation.startVoice();
  assert.equal((await h.conversation.sendText('My new question')).status, 'cancelled');
  assert.equal(h.conversation.getState().error.code, 'VOICE_RECONNECT_REQUIRED'); assert.equal(h.conversation.getState().text, 'idle');
  assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed'); await h.conversation.exit();
});

test('unavailable service on Resume releases the retained call and permits a fresh retry after recovery', async () => {
  let available = true;
  const h = await authorized({ fetch: path => path.endsWith('/status') && !available ? Response.json({ version: 1, enabled: false, ready: false, access: 'invite', voiceConfigured: true, textConfigured: true, reason: 'SERVICE_NOT_READY', reasonCodes: ['AI_DISABLED'] }) : null });
  await h.conversation.startVoice(); await h.conversation.enterMedia(); available = false;
  await assert.rejects(h.conversation.resumeVoice(), { code: 'SERVICE_NOT_READY' });
  assert.equal(h.tracks.length, 1); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(h.conversation.getState().service.phase, 'unavailable'); assert.equal(h.conversation.getState().voice, 'failed');
  assert.equal(h.peers[0].connectionState, 'closed');
  assert.equal(h.requests.filter(request => request.path.endsWith('/sessions/close')).length, 1);
  available = true; await h.conversation.startVoice();
  assert.equal(h.conversation.getState().voice, 'listening'); assert.equal(h.conversation.getState().error, null);
  assert.equal(h.peers.length, 2); assert.equal(h.tracks.filter(track => !track.stopped).length, 1);
  await h.conversation.exit();
});

test('cleanup before voice or after a failed attempt never invents a paused microphone', async () => {
  const h = await authorized({ getUserMedia: () => Promise.reject(new DOMException('permission blocked', 'NotAllowedError')) });
  await h.conversation.stop(); assert.equal(h.conversation.getState().voice, 'idle');
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); await tick();
  assert.equal(h.conversation.getState().voice, 'idle');
  h.doc.hidden = false;
  await assert.rejects(h.conversation.startVoice(), { code: 'MICROPHONE_PERMISSION_BLOCKED' });
  await h.conversation.stop();
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); await tick();
  assert.equal(h.conversation.getState().voice, 'failed');
  assert.equal(h.conversation.getState().error.code, 'MICROPHONE_PERMISSION_BLOCKED');
  assert.equal(h.requests.some(request => request.path.endsWith('/realtime')), false);
  await h.conversation.exit();
});

test('a microphone permission failure on Resume closes the call and preserves its truthful failure state', async () => {
  let captures = 0;
  const h = await authorized({ getUserMedia: () => ++captures === 1 ? h.captureStream() : Promise.reject(new DOMException('permission blocked', 'NotAllowedError')) });
  await h.conversation.startVoice(); await h.conversation.enterMedia();
  await assert.rejects(h.conversation.resumeVoice(), { code: 'MICROPHONE_PERMISSION_BLOCKED' });
  assert.equal(h.conversation.getState().voice, 'failed'); assert.equal(h.conversation.getState().mode, 'conversation');
  assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed');
  assert.equal(h.requests.filter(request => request.path.endsWith('/sessions/close')).length, 1);
  await h.conversation.stop(); assert.equal(h.conversation.getState().voice, 'failed');
  await h.conversation.exit();
});

test('Stage5: a failed typed user-item write cannot authorize a provider response', async () => {
  const h = await authorized({ failEvent: event => event.item?.role === 'user' }); await h.conversation.startVoice();
  const dc = h.peers[0].channel; assert.equal((await h.conversation.sendText('Current question')).status, 'cancelled');
  assert.equal(dc.sent.some(event => event.type === 'response.create'), false);
  assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.conversation.getState().voice, 'failed'); await h.conversation.exit();
});

test('Stage5: an unsent function output cannot trigger a provider tool continuation', async () => {
  for (const tool of [{ name: 'navigate', arguments: '{"destination":"dream-world"}' }, { name: 'lookup_knowledge', arguments: '{"query":"practice","topics":[]}' }, { name: 'navigate', arguments: 'invalid-json' }]) {
    const h = await authorized({ failEvent: event => event.item?.type === 'function_call_output' }); await h.conversation.startVoice(); const dc = h.peers[0].channel;
    await spokenTurn(dc, 'input-item'); await responseCreated(dc, 'response'); const before = dc.sent.filter(event => event.type === 'response.create').length;
    dc.receive({ type: 'response.done', response: { id: 'response', status: 'completed', output: [{ type: 'function_call', call_id: 'call', ...tool }] } }); await tick();
    assert.equal(dc.sent.filter(event => event.type === 'response.create').length, before);
    assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.conversation.getState().voice, 'failed'); await h.conversation.exit();
  }
});

test('Stage5: malformed SDP with valid close credentials still releases the created backend call', async () => {
  const h = await authorized({ fetch: path => path.endsWith('/realtime') ? Response.json({ version: 1, sessionId: id(502), closeToken: 'malformed-close', transport: { type: 'webrtc', sdp: null } }) : null });
  await assert.rejects(h.conversation.startVoice(), { code: 'INVALID_SESSION' });
  const close = h.requests.find(request => request.path.endsWith('/sessions/close'));
  assert.equal(close.body.sessionId, id(502)); assert.ok(h.tracks.every(track => track.stopped)); await h.conversation.exit();
});

test('Stage5: provider errors during bounded recovery cannot claim disconnected capture is listening', async () => {
  const h = await authorized(); await h.conversation.startVoice(); const peer = h.peers[0];
  peer.connectionState = 'disconnected'; peer.dispatchEvent(new Event('connectionstatechange'));
  peer.channel.receive({ type: 'error', error: { code: 'PROVIDER_ERROR', message: 'Request failed' } }); await tick();
  assert.equal(h.conversation.getState().voice, 'recovering'); assert.ok([...h.timers.values()].some(timer => timer.delay === 5000));
  await h.conversation.exit();
});

test('Stage5: stalled browser SDP setup has a deadline and cannot leave microphone capture active', async () => {
  for (const stage of ['createOffer', 'setLocalDescription', 'setRemoteDescription']) {
    let finish; const pending = new Promise(resolve => { finish = resolve; });
    const h = await authorized({ [stage]: () => pending }); const starting = h.conversation.startVoice();
    const rejected = assert.rejects(starting, { code: 'VOICE_SETUP_TIMEOUT' }); await tick();
    const timeout = [...h.timers.values()].find(timer => timer.delay === 15000); assert.ok(timeout); timeout.fn(); await rejected;
    assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed');
    const creates = h.requests.filter(request => request.path.endsWith('/realtime')).length;
    assert.equal(creates, stage === 'setRemoteDescription' ? 1 : 0);
    finish(); await tick(); assert.ok(h.tracks.every(track => track.stopped));
    assert.equal(h.requests.filter(request => request.path.endsWith('/realtime')).length, creates);
    await h.conversation.exit();
  }
});

test('Stage5: cancelling a preflight clears checking and Exit settles a standalone stalled status read', async () => {
  const h = await authorized({ fetch: path => path.endsWith('/status') ? new Promise(() => {}) : null });
  const starting = h.conversation.startVoice(); await tick(); await h.conversation.stop(); await starting;
  assert.notEqual(h.conversation.getState().service.phase, 'checking');
  const checking = h.conversation.getStatus(); const rejected = assert.rejects(checking, { name: 'AbortError' });
  await h.conversation.exit(); await rejected; assert.equal(h.timers.size, 0);
});

test('Astra: a stalled remote close cannot indefinitely block Stop, Clear or Exit', async () => {
  for (const operation of ['stop', 'clearConversation', 'exit']) {
    let complete;
    const h = await authorized({ fetch: path => path.endsWith('/sessions/close') ? new Promise(resolve => { complete = resolve; }) : null });
    await h.conversation.sendText('A temporary conversation'); await h.conversation.startVoice();
    const ending = h.conversation[operation](); await tick();
    assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed');
    const timeout = [...h.timers.values()].find(timer => timer.delay === 12000); assert.ok(timeout); timeout.fn();
    await ending;
    assert.equal(h.requests.find(request => request.path.endsWith('/sessions/close')).init.signal.aborted, true);
    assert.equal(h.events.filter(event => event.type === 'session-closed').at(-1).status, 'closing_unconfirmed');
    if (operation === 'clearConversation') assert.deepEqual(h.conversation.getState().transcript, []);
    if (operation === 'exit') assert.equal(h.conversation.getState().authorized, false);
    complete(Response.json({ version: 1, status: 'closed' })); await tick();
    assert.equal(h.events.filter(event => event.type === 'session-closed').length, 1);
    await h.conversation.exit(); assert.equal(h.timers.size, 0);
  }
});

test('Astra: stalled Resume sender and playback settle on Stop or their deadline and release capture', async () => {
  for (const stage of ['replaceTrack', 'audioPlay']) for (const ending of ['stop', 'deadline']) {
    let complete; const pending = new Promise(resolve => { complete = resolve; });
    const h = await authorized({ [stage]: stage === 'replaceTrack' ? track => track ? pending : undefined : () => pending });
    await h.conversation.startVoice(); await h.conversation.enterMedia();
    const resuming = h.conversation.resumeVoice();
    const rejection = ending === 'deadline' ? assert.rejects(resuming, { code: 'VOICE_SETUP_TIMEOUT' }) : null;
    await tick(); assert.equal(h.tracks.length, 2); assert.equal(h.tracks[1].stopped, false);
    if (ending === 'stop') { await h.conversation.stop(); await resuming; }
    else { const timeout = [...h.timers.values()].find(timer => timer.delay === 15000); assert.ok(timeout); timeout.fn(); await rejection; }
    assert.ok(h.tracks.every(track => track.stopped)); assert.equal(h.peers[0].connectionState, 'closed');
    complete(); await tick();
    assert.equal(h.audio.srcObject, null); assert.notEqual(h.conversation.getState().voice, 'listening');
    await h.conversation.exit();
  }
});

test('Astra: stalled Media detachment closes the broken peer before media controls can proceed', async () => {
  const h = await authorized({ replaceTrack: track => track ? undefined : new Promise(() => {}) });
  await h.conversation.startVoice(); const media = h.conversation.enterMedia(); await tick();
  assert.ok(h.tracks.every(track => track.stopped));
  const timeout = [...h.timers.values()].find(timer => timer.delay === 15000); assert.ok(timeout); timeout.fn(); await media;
  assert.equal(h.conversation.getState().mode, 'media'); assert.equal(h.peers[0].connectionState, 'closed');
  await h.conversation.exit();
});

test('Astra: delayed Media cleanup cannot acknowledge media after a newer Resume opens live capture', async () => {
  let finishOldClose; let closes = 0; let creations = 0;
  const h = await authorized({ replaceTrack: track => track ? undefined : new Promise(() => {}),
    fetch: path => {
      if (path.endsWith('/realtime')) return Response.json({ version: 1, sessionId: id(500 + creations++), transport: { type: 'webrtc', sdp: 'answer' }, closeToken: 'close-only', clientDeadlineAt: '2026-10-03T02:12:00Z' });
      if (path.endsWith('/sessions/close') && ++closes === 1) return new Promise(resolve => { finishOldClose = resolve; });
    } });
  await h.conversation.startVoice();
  let mediaAcknowledged = false;
  const enteringMedia = h.conversation.enterMedia().then(value => { mediaAcknowledged = true; return value; });
  const rejected = assert.rejects(enteringMedia, { code: 'MEDIA_REQUEST_SUPERSEDED' });
  await tick();
  const timeout = [...h.timers.values()].find(timer => timer.delay === 15000); assert.ok(timeout); timeout.fn(); await tick();
  assert.equal(closes, 1); assert.equal(h.peers[0].connectionState, 'closed'); assert.equal(h.tracks[0].stopped, true);
  await h.conversation.resumeVoice();
  assert.equal(h.peers.length, 2); assert.equal(h.tracks[1].stopped, false);
  assert.equal(h.conversation.getState().mode, 'conversation'); assert.equal(h.conversation.getState().voice, 'listening');
  finishOldClose(Response.json({ version: 1, status: 'closed' })); await rejected;
  assert.equal(mediaAcknowledged, false, 'The obsolete Media callback must not let the shell announce that capture is off.');
  assert.equal(h.conversation.getState().mode, 'conversation'); assert.equal(h.conversation.getState().voice, 'listening');
  assert.equal(h.tracks[1].stopped, false); assert.equal(h.peers[1].connectionState, 'connected');
  await h.conversation.exit(); assert.ok(h.tracks.every(track => track.stopped));
});

test('Astra: rejected session access releases voice and permits a fresh invitation', async () => {
  let denied = true;
  const h = await authorized({ fetch: path => path.endsWith('/knowledge') && denied ? Response.json({ code: 'ACCESS_DENIED' }, { status: 401 }) : null });
  await h.conversation.startVoice();
  await assert.rejects(h.conversation.lookupKnowledge('practice'), { code: 'ACCESS_DENIED' }); await tick();
  assert.equal(h.conversation.getState().authorized, false); assert.ok(h.tracks.every(track => track.stopped));
  assert.equal(h.peers[0].connectionState, 'closed');
  denied = false; await h.conversation.access('b'.repeat(24));
  assert.equal(h.conversation.getState().authorized, true); await h.conversation.sendText('After renewing access');
  await h.conversation.exit();
});

test('Astra: late rejection of an older bearer cannot revoke a newer successful invitation', async () => {
  let rejectOld; let invitations = 0;
  const h = await authorized({ fetch: path => {
    if (path.endsWith('/access')) return Response.json({ version: 1, accessToken: `token-${++invitations}`, expiresAt: '2026-10-03T03:00:00Z' });
    if (path.endsWith('/knowledge')) return new Promise(resolve => { rejectOld = resolve; });
  } });
  const oldRequest = h.conversation.lookupKnowledge('practice');
  const rejected = assert.rejects(oldRequest, { code: 'ACCESS_DENIED' });
  await h.conversation.access('b'.repeat(24));
  rejectOld(Response.json({ code: 'ACCESS_DENIED' }, { status: 401 })); await rejected;
  assert.equal(h.conversation.getState().authorized, true); await h.conversation.sendText('Current access');
  assert.equal(h.requests.find(request => request.body?.kind === 'start').init.headers.Authorization, 'Bearer token-2');
  await h.conversation.exit();
});

test('Astra: operational provider and admission failures replace the configured-ready service status', async () => {
  for (const code of ['ADMISSION_UNAVAILABLE', 'ADMISSION_CONFIGURATION_ERROR', 'MODEL_UNAVAILABLE', 'PROVIDER_QUOTA_EXHAUSTED']) {
    const h = await authorized({ fetch: (path, body) => path.endsWith('/turns') && body.kind === 'start'
      ? Response.json({ code, message: 'The configured service cannot complete this request.' }, { status: 503 }) : null });
    await h.conversation.getStatus(); assert.equal(h.conversation.getState().service.ready, true);
    await assert.rejects(h.conversation.sendText('Current question'), { code });
    assert.equal(h.conversation.getState().service.ready, false); assert.equal(h.conversation.getState().service.code, code);
    await h.conversation.getStatus(); assert.equal(h.conversation.getState().service.ready, true);
    await h.conversation.exit();
  }
});

test('Astra: delayed remote closure from Clear cannot erase a newly started conversation', async () => {
  let complete;
  const h = await authorized({ fetch: path => path.endsWith('/sessions/close') ? new Promise(resolve => { complete = resolve; }) : null });
  await h.conversation.sendText('Old conversation'); await h.conversation.startVoice();
  const clearing = h.conversation.clearConversation();
  assert.deepEqual(h.conversation.getState().transcript, []);
  await h.conversation.sendText('New conversation');
  complete(Response.json({ version: 1, status: 'closed' })); await clearing;
  assert.ok(h.conversation.getState().transcript.some(item => item.text === 'New conversation'));
  await h.conversation.sendText('Continue');
  assert.ok(h.requests.findLast(request => request.body?.kind === 'start').body.history.some(item => item.content === 'New conversation'));
  await h.conversation.exit();
});

test('Astra: stalled invitations settle on Stop, Exit or deadline and cannot restore late authorization', async () => {
  for (const ending of ['stop', 'exit', 'deadline']) {
    let complete;
    const h = harness({ fetch: path => path.endsWith('/access') ? new Promise(resolve => { complete = resolve; }) : null });
    const activation = h.conversation.access('a'.repeat(24));
    const rejected = assert.rejects(activation, { code: ending === 'deadline' ? 'ACCESS_TIMEOUT' : 'ACCESS_CANCELLED' });
    await tick();
    if (ending === 'deadline') { const timeout = [...h.timers.values()].find(timer => timer.delay === 15000); assert.ok(timeout); timeout.fn(); }
    else await h.conversation[ending]();
    await rejected;
    complete(Response.json({ version: 1, accessToken: 'late-private-token', expiresAt: '2026-10-03T03:00:00Z' })); await tick();
    assert.equal(h.conversation.getState().authorized, false); assert.equal(h.tracks.length, 0);
    await h.conversation.exit(); assert.equal(h.timers.size, 0);
  }
});

test('Astra: admission outages during invitation entry replace stale configured-ready guidance', async () => {
  const h = harness({ fetch: path => path.endsWith('/access') ? Response.json({ code: 'ADMISSION_UNAVAILABLE', message: 'The access service is temporarily unavailable.' }, { status: 503 }) : null });
  await h.conversation.getStatus(); assert.equal(h.conversation.getState().service.ready, true);
  await assert.rejects(h.conversation.access('a'.repeat(24)), { code: 'ADMISSION_UNAVAILABLE' });
  assert.equal(h.conversation.getState().service.ready, false); assert.equal(h.conversation.getState().service.code, 'ADMISSION_UNAVAILABLE');
  assert.equal(h.tracks.length, 0); await h.conversation.exit();
});

test('Astra: unsuccessful Realtime replies settle the typed draft with honest failure guidance', async () => {
  for (const status of ['failed', 'cancelled', 'incomplete', undefined]) {
    const h = await authorized(); await h.conversation.startVoice(); const dc = h.peers[0].channel;
    const sending = h.conversation.sendText('My question'); await responseCreated(dc, 'terminal-reply');
    dc.receive({ type: 'response.output_text.delta', response_id: 'terminal-reply', item_id: 'partial-reply', delta: 'Unfinished' });
    dc.receive({ type: 'response.done', response: { id: 'terminal-reply', status, output: [] } });
    assert.equal((await sending).status, status || 'failed'); assert.equal(h.conversation.getState().text, 'idle');
    assert.match(h.conversation.getState().error.code, /^VOICE_REPLY_/);
    assert.ok(h.conversation.getState().transcript.filter(item => item.role === 'assistant').every(item => !item.final));
    await h.conversation.stop(); await h.conversation.startVoice();
    assert.equal(h.peers[1].channel.sent.some(event => event.item?.content?.[0]?.text === 'Unfinished'), false);
    await h.conversation.exit();
  }
});

test('Astra: a failed Realtime tool lookup settles its typed owner without waiting for the turn deadline', async () => {
  const h = await authorized({ fetch: path => path.endsWith('/knowledge') ? Response.json({ code: 'ADMISSION_UNAVAILABLE', message: 'Access service is unavailable.' }, { status: 503 }) : null });
  await h.conversation.startVoice(); const dc = h.peers[0].channel;
  const sending = h.conversation.sendText('Explain the philosophy'); await responseCreated(dc, 'lookup-reply');
  dc.receive({ type: 'response.done', response: { id: 'lookup-reply', status: 'completed', output: [{ type: 'function_call', call_id: 'lookup-failure', name: 'lookup_knowledge', arguments: '{"query":"philosophy","topics":[]}' }] } });
  assert.equal((await sending).status, 'failed'); assert.equal(h.conversation.getState().text, 'idle');
  assert.equal(h.conversation.getState().error.code, 'ADMISSION_UNAVAILABLE');
  assert.equal(dc.sent.filter(event => event.type === 'response.create').length, 1);
  assert.equal([...h.timers.values()].some(timer => timer.delay === 50000), false);
  await h.conversation.exit();
});
