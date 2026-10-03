import { validateContract } from '../validate.js';
import { ConversationError, boundedHistory, connectionFailure, microphoneFailure, readFiniteSSE, serviceResponse, utf8Bytes, validateServiceStatus } from './text.js';

const DEFAULT_DEADLINE = 12 * 60 * 1000;
const DEFAULT_IDLE = 90 * 1000;
const safeInteger = value => Number.isSafeInteger(value) && value >= 0;
const clone = value => JSON.parse(JSON.stringify(value));
const sameView = (left, right) => Boolean(left && right && left.destination === right.destination && left.worldFocus === right.worldFocus
  && (left.earth === null && right.earth === null || left.earth && right.earth
    && left.earth.globe === right.earth.globe && left.earth.restore === right.earth.restore && left.earth.mediaMode === right.earth.mediaMode));

/** Browser-owned conversation. Secrets and transcripts are held only in this instance. */
export function createConversation(options = {}) {
  const {
    baseUrl = 'https://dream-unity-runtime.vercel.app', getContext = () => ({}),
    onEvent = () => {}, onState = () => {}, onAction = async () => { throw new ConversationError('ACTION_UNAVAILABLE', 'This action is unavailable.'); },
    ensureMediaQuiet = async () => false,
    fetch: fetcher = globalThis.fetch?.bind(globalThis),
    mediaDevices = globalThis.navigator?.mediaDevices,
    PeerConnection = globalThis.RTCPeerConnection,
    document: ownerDocument = globalThis.document,
    window: ownerWindow = globalThis.window,
    isSecureContext = globalThis.isSecureContext,
    createAudio = () => ownerDocument?.createElement('audio'),
    randomUUID = () => globalThis.crypto.randomUUID(),
    now = () => Date.now(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout,
  } = options;
  const origin = new URL(baseUrl).origin;
  const endpoint = path => `${origin}/api/unity/${path}`;
  const logicalSessionId = randomUUID(); const conversationId = randomUUID();
  let state = { mode: 'conversation', voice: 'idle', text: 'idle', authorized: false, expiresAt: null, error: null, transcript: [], service: { phase: 'unknown', ready: false, code: null, message: null, reasonCodes: [] } };
  let token = null; let tokenExpiry = 0; let generation = 0; let turnEpoch = 0; let disposed = false;
  let captureEpoch = 0; let resumePromise = null; let accessAttempt = 0; let accessAbort = null; let currentInputItemId = null;
  let peer = null; let channel = null; let sender = null; let microphone = null; let audio = null; let remoteStream = null;
  let ownedCall = null; let voicePromise = null; let voiceAbort = null; let activeTurn = null;
  let deadlineTimer = null; let idleTimer = null; let connectionTimer = null; let recoveryTimer = null;
  let recoveryUsed = false; let voiceIdentity = null; let pendingVoiceText = null; let currentVoiceOwner = null;
  const responseOwners = new Map(); const responseRequests = new Map(); const voiceItems = new Map(); const executedCalls = new Set(); const controlEvents = new Set();
  const replay = []; const actions = new Set(); const timers = new Set();
  const captureWaits = new Set(); const statusAborts = new Set(); let statusAttempt = 0;

  function emit(value) { try { onEvent(value); } catch { /* UI cannot weaken cleanup. */ } }
  function snapshot() { return clone({ ...state, authorized: Boolean(token && now() < tokenExpiry && !disposed), transcript: state.transcript.map(item => ({ ...item })) }); }
  function update(patch) { state = { ...state, ...patch }; try { onState(snapshot()); } catch { /* consumer isolation */ } }
  function error(errorValue) {
    const value = { code: errorValue?.code || 'CONNECTION_ERROR', message: (errorValue?.message || 'The conversation could not connect.').slice(0, 400), retryable: errorValue?.retryable === true };
    const serviceFailure = ['SERVICE_NOT_READY', 'SERVICE_DEPLOYMENT_MISSING', 'NETWORK_UNAVAILABLE', 'INVALID_STATUS', 'SERVICE_STATUS_TIMEOUT', 'ACCESS_TIMEOUT',
      'ADMISSION_UNAVAILABLE', 'ADMISSION_CONFIGURATION_ERROR', 'MODEL_UNAVAILABLE', 'PROVIDER_CONFIGURATION_ERROR', 'PROVIDER_QUOTA_EXHAUSTED', 'PROVIDER_UNAVAILABLE'].includes(value.code);
    update({ error: value, ...(serviceFailure ? { service: { ...state.service, phase: 'unavailable', ready: false, code: value.code, message: value.message } } : {}) });
    emit({ type: 'error', ...value }); return value;
  }
  function context() {
    const value = getContext() || {};
    const memories = value.consentedMemories || [];
    const memoryCharacters = Array.isArray(memories) ? memories.reduce((total, record) => total + ['title', 'text', 'label'].reduce((count, field) => count + (typeof record?.[field] === 'string' ? [...record[field]].length : 0), 0), 0) : Infinity;
    if (!Array.isArray(memories) || memories.length > 6 || memoryCharacters > 2500) throw new ConversationError('MEMORY_CONTEXT_LIMIT', 'Select at most six saved notes with 2,500 total text characters.');
    return { routeEpoch: safeInteger(value.routeEpoch) ? value.routeEpoch : 0,
      consentEpoch: safeInteger(value.consentEpoch) ? value.consentEpoch : 0,
      memoryRevision: safeInteger(value.memoryRevision) ? value.memoryRevision : 0,
      canonVersion: value.canonVersion || 'published-manifesto/1',
      uiContext: clone(value.uiContext || { destination: 'unity', worldFocus: null, earth: null }),
      consentedMemories: clone(memories) };
  }
  function contextMatches(owned) {
    const live = context();
    return owned.consentEpoch === live.consentEpoch && owned.memoryRevision === live.memoryRevision;
  }
  function authorize() {
    if (disposed) throw new ConversationError('SESSION_EXITED', 'Start a fresh visit to reconnect.');
    if (!token || now() >= tokenExpiry) {
      token = null; update({ authorized: false, expiresAt: null });
      const failure = new ConversationError('ACCESS_REQUIRED', 'Enter a valid private preview invite to connect.'); error(failure); throw failure;
    }
  }
  async function request(path, body, signal, useAuth = true, keepalive = false) {
    if (useAuth) authorize();
    const requestToken = token;
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth) headers.Authorization = `Bearer ${token}`;
    const serialized = JSON.stringify(body);
    const limit = ['access', 'sessions/close'].includes(path) ? 2048 : path === 'knowledge' ? 4096 : 65536;
    if (utf8Bytes(serialized) > limit) throw new ConversationError('BODY_LIMIT', 'This request exceeds the service size limit.');
    let response;
    try { response = await fetcher(endpoint(path), { method: 'POST', headers, body: serialized, signal, credentials: 'omit', cache: 'no-store', keepalive }); }
    catch (failure) { throw connectionFailure(failure); }
    try { return await serviceResponse(response); }
    catch (failure) {
      if (useAuth && failure.code === 'ACCESS_DENIED' && requestToken === token) {
        token = null; tokenExpiry = 0; update({ authorized: false, expiresAt: null });
        // Reject only this request's bearer. An old response must never revoke a
        // newer invitation, and the close-only capability still cleans up voice.
        error(failure); closeVoice('revoked').catch(() => {});
      }
      throw failure;
    }
  }
  function registerTimer(callback, delay) {
    const timer = setTimer(() => { timers.delete(timer); callback(); }, delay); timers.add(timer); return timer;
  }
  function dropTimer(timer) { if (timer != null) { clearTimer(timer); timers.delete(timer); } }
  async function captureOperation(operation) {
    let timer; let cancel;
    try {
      return await Promise.race([operation, new Promise((resolve, reject) => {
        cancel = () => reject(new ConversationError('ACTIVATION_CANCELLED', 'Microphone activation was cancelled.'));
        captureWaits.add(cancel);
        timer = registerTimer(() => reject(new ConversationError('VOICE_SETUP_TIMEOUT', 'This browser did not finish updating the voice connection. Microphone capture has stopped. Choose Speak to retry or continue by writing.', true)), 15000);
      })]);
    } finally { dropTimer(timer); if (cancel) captureWaits.delete(cancel); }
  }
  async function voiceSetup(operation, signal) {
    let timer; let cancel;
    try {
      return await Promise.race([operation, new Promise((resolve, reject) => {
        cancel = () => reject(new DOMException('Cancelled', 'AbortError'));
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        timer = registerTimer(() => reject(new ConversationError('VOICE_SETUP_TIMEOUT', 'This browser did not finish preparing the voice connection. Microphone capture has stopped. Choose Speak to retry or continue by writing.', true)), 15000);
      })]);
    } finally { dropTimer(timer); if (cancel) signal.removeEventListener('abort', cancel); }
  }
  function activity() {
    dropTimer(idleTimer);
    if (ownedCall) idleTimer = registerTimer(() => { closeVoice('expired'); emit({ type: 'voice-expired', reason: 'idle' }); }, DEFAULT_IDLE);
  }
  function publishTranscript(role, text, final, source, id = randomUUID(), owned = context(), alreadySynced = false) {
    if (typeof text !== 'string' || utf8Bytes(text) > 8192) throw new ConversationError('OUTPUT_LIMIT', 'A conversation message exceeded the allowed size.');
    const existing = state.transcript.findIndex(item => item.id === id);
    const item = { id, role, text, final, source };
    const transcript = [...state.transcript]; if (existing >= 0) transcript[existing] = item; else transcript.push(item);
    update({ transcript }); emit({ type: 'transcript', ...item });
    if (final && text && !replay.some(record => record.id === id)) replay.push({ ...item, ...owned, replayEligible: true, syncedVoiceId: alreadySynced ? voiceIdentity : null });
    return id;
  }
  function send(event) {
    if (channel?.readyState !== 'open') return false;
    const eventId = randomUUID();
    if (['response.cancel', 'output_audio_buffer.clear', 'input_audio_buffer.clear'].includes(event.type)) {
      if (controlEvents.size >= 64) controlEvents.delete(controlEvents.values().next().value);
      controlEvents.add(eventId);
    }
    try { channel.send(JSON.stringify({ event_id: eventId, ...event })); return true; }
    catch { emit({ type: 'control-unconfirmed', code: 'TRANSPORT_WRITE_FAILED' }); return false; }
  }
  function sendRequired(event) {
    if (send(event)) return true;
    error(new ConversationError('VOICE_RECONNECT_REQUIRED', 'The voice connection cannot send your request. Choose Speak to reconnect, or continue by writing.', true));
    closeVoice('transport-failed'); return false;
  }
  function silence() {
    send({ type: 'response.cancel' }); send({ type: 'output_audio_buffer.clear' }); send({ type: 'input_audio_buffer.clear' });
    if (audio) { audio.muted = true; audio.pause?.(); audio.srcObject = null; }
  }
  function restorePlayback(expectedGeneration) {
    if (expectedGeneration !== generation || disposed || state.mode !== 'conversation' || !microphone || !audio) return;
    audio.srcObject = remoteStream; audio.muted = false;
    audio.play?.().catch(() => {
      if (expectedGeneration === generation && state.mode === 'conversation' && microphone) emit({ type: 'playback-blocked' });
    });
  }
  async function releaseCapture() {
    const current = microphone; microphone = null;
    if (current) for (const track of current.getTracks()) track.stop();
    if (sender?.replaceTrack) await captureOperation(sender.replaceTrack(null));
  }
  function invalidateActions() { for (const action of actions) action.abort(); actions.clear(); }
  function invalidateTurn() {
    turnEpoch++; invalidateActions();
    responseRequests.clear(); responseOwners.clear();
    if (activeTurn) {
      const old = activeTurn; activeTurn = null; old.abort.abort(); dropTimer(old.timer);
      request('turns', { version: 1, kind: 'cancel', requestId: randomUUID(), turnId: old.id }, undefined, true, true).catch(() => {});
    }
    if (pendingVoiceText) { dropTimer(pendingVoiceText.timer); pendingVoiceText.resolve({ status: 'cancelled' }); pendingVoiceText = null; }
    dropTimer(currentVoiceOwner?.inputTimer); currentVoiceOwner?.inputGate?.resolve(false); currentVoiceOwner = null; currentInputItemId = null;
    update({ text: 'idle' });
  }
  async function closeOwned(call, reason) {
    if (!call) return;
    const body = { version: 1, sessionId: call.sessionId, closeToken: call.closeToken, reason };
    const abort = new AbortController(); let deadline;
    try {
      validateContract('session-close', body);
      const result = await Promise.race([
        (async () => (await request('sessions/close', body, abort.signal, false, true)).json())(),
        new Promise((resolve, reject) => {
          deadline = registerTimer(() => { reject(new ConversationError('CLOSE_UNCONFIRMED', 'Remote voice closure could not be confirmed.')); abort.abort(); }, 12000);
        }),
      ]);
      emit({ type: 'session-closed', sessionId: call.sessionId, status: result.status });
    } catch { emit({ type: 'session-closed', sessionId: call.sessionId, status: 'closing_unconfirmed' }); }
    finally { dropTimer(deadline); }
  }
  async function closeVoice(reason = 'stop') {
    generation++; captureEpoch++; resumePromise = null; currentInputItemId = null;
    accessAbort?.abort(); accessAbort = null;
    for (const cancel of captureWaits) cancel();
    voiceAbort?.abort(); voiceAbort = null; voicePromise = null;
    invalidateTurn(); silence();
    const call = ownedCall; ownedCall = null;
    const oldPeer = peer; const oldChannel = channel; const oldAudio = audio;
    const oldSender = sender; const oldMicrophone = microphone;
    peer = null; channel = null; sender = null; microphone = null; audio = null; remoteStream = null;
    if (oldMicrophone) for (const track of oldMicrophone.getTracks()) track.stop();
    for (const timer of [deadlineTimer, idleTimer, connectionTimer, recoveryTimer]) dropTimer(timer);
    deadlineTimer = idleTimer = connectionTimer = recoveryTimer = null;
    responseOwners.clear(); voiceItems.clear(); executedCalls.clear(); controlEvents.clear(); voiceIdentity = null;
    update({ voice: reason === 'expired' ? 'expired' : reason === 'transport-failed' ? 'failed' : 'paused' });
    emit({ type: 'stopped', reason });
    // Track stop and peer closure must not wait for browser sender settlement.
    if (oldSender?.replaceTrack) oldSender.replaceTrack(null).catch(() => {});
    oldChannel?.close?.(); oldPeer?.close?.();
    if (oldAudio) { oldAudio.srcObject = null; oldAudio.remove?.(); }
    await closeOwned(call, reason);
  }
  function ownerValid(owned) { return !disposed && owned.generation === generation && owned.turnEpoch === turnEpoch && contextMatches(owned); }
  function readinessMessage(status) {
    if (status.reasonCodes?.includes('AI_DISABLED')) return 'Private AI conversation is turned off. The site owner needs to finish its configuration and enable it. You can explore the views and your own notes.';
    if (status.reasonCodes?.includes('PROVIDER_NOT_CONFIGURED')) return 'The AI provider is not configured for this private preview. The site owner needs to finish its setup. You can explore the views and your own notes.';
    return 'AI conversation is awaiting private service configuration. You can explore the views and your own notes.';
  }
  async function getStatus({ signal } = {}) {
    if (disposed) throw new ConversationError('SESSION_EXITED', 'Start a fresh visit to reconnect.');
    const attempt = ++statusAttempt; const abort = new AbortController(); let deadline;
    const previousService = { ...state.service, phase: state.service.ready ? 'available' : state.service.code ? 'unavailable' : 'unknown' };
    statusAborts.add(abort);
    const onAbort = () => abort.abort(); signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) abort.abort();
    update({ service: { ...state.service, phase: 'checking' } });
    try {
      const result = await Promise.race([
        (async () => {
          let response;
          try { response = await fetcher(endpoint('status'), { credentials: 'omit', cache: 'no-store', signal: abort.signal }); }
          catch (failure) { throw connectionFailure(failure); }
          response = await serviceResponse(response);
          const raw = await response.text();
          if (utf8Bytes(raw) > 8192) throw new ConversationError('INVALID_STATUS', 'The conversation service returned an oversized status.');
          let value; try { value = JSON.parse(raw); } catch { throw new ConversationError('INVALID_STATUS', 'The conversation service returned an incompatible status. Retry after the service has been updated.'); }
          return validateServiceStatus(value);
        })(),
        new Promise((resolve, reject) => {
          abort.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
          if (abort.signal.aborted) reject(new DOMException('Cancelled', 'AbortError'));
          deadline = registerTimer(() => { reject(new ConversationError('SERVICE_STATUS_TIMEOUT', 'The conversation service did not answer its availability check. Check your connection and retry.', true)); abort.abort(); }, 8000);
        }),
      ]);
      if (attempt === statusAttempt && !disposed && !signal?.aborted) {
        update({ service: { phase: result.ready ? 'available' : 'unavailable', ready: result.ready, code: result.ready ? null : 'SERVICE_NOT_READY', message: result.ready ? null : readinessMessage(result), reasonCodes: result.reasonCodes || [] } });
        emit({ type: 'service-status', status: result });
      }
      return result;
    } catch (failure) {
      if (attempt === statusAttempt && !disposed && !signal?.aborted && failure.name !== 'AbortError') {
        update({ service: { phase: 'unavailable', ready: false, code: failure.code || 'NETWORK_UNAVAILABLE', message: failure.message, reasonCodes: [] } });
      } else if (attempt === statusAttempt && !disposed) update({ service: previousService });
      throw failure;
    } finally { dropTimer(deadline); statusAborts.delete(abort); signal?.removeEventListener('abort', onAbort); }
  }
  async function executeAction(requestValue, owned, source) {
    validateContract('action-request', requestValue);
    if (!ownerValid(owned)) throw new ConversationError('STALE_ACTION', 'The action no longer belongs to the current turn.');
    const controller = new AbortController(); actions.add(controller);
    let result;
    try { result = await onAction(requestValue, { signal: controller.signal, source }); }
    catch (failure) {
      result = { version: 1, requestId: requestValue.requestId, routeEpoch: context().routeEpoch, status: controller.signal.aborted ? 'cancelled' : 'failed', code: failure.code || 'ACTION_FAILED', message: (failure.message || 'The action failed.').slice(0, 400), observedState: null };
    } finally { actions.delete(controller); }
    validateContract('action-result', result);
    if (result.requestId !== requestValue.requestId || !ownerValid(owned) || controller.signal.aborted) throw new ConversationError('STALE_ACTION', 'The action result is no longer current.');
    const live = context();
    const observedMatches = sameView(result.observedState, live.uiContext);
    if (result.status === 'applied' && observedMatches && ['navigate', 'return_to_previous'].includes(requestValue.tool.name)
      && result.routeEpoch === requestValue.routeEpoch && live.routeEpoch === owned.routeEpoch + 1
      && (requestValue.tool.name !== 'navigate' || requestValue.tool.args.destination === live.uiContext.destination)) {
      // Only an owned, observed navigation advances this same user's tool chain.
      owned.routeEpoch = live.routeEpoch; owned.uiContext = clone(live.uiContext);
    } else if (result.status === 'applied' && observedMatches && live.routeEpoch === owned.routeEpoch) {
      owned.uiContext = clone(live.uiContext);
    }
    emit({ type: 'action-result', request: requestValue, result });
    if (['applied', 'noop', 'blocked', 'rejected', 'failed', 'unknown'].includes(result.status)) {
      replay.push({ id: randomUUID(), role: 'assistant', text: `Application action receipt: ${JSON.stringify({ tool: requestValue.tool, result })}`, final: true, source, replayEligible: true, ...context(), syncedVoiceId: source === 'voice' ? voiceIdentity : null });
    }
    return result;
  }
  function newOwner() { return { ...context(), generation, turnEpoch, turnId: randomUUID() }; }
  function providerOwner(event) { return responseOwners.get(event.response_id) || responseOwners.get(event.response?.id); }
  function requestVoiceResponse(owned) {
    if (!ownerValid(owned) || currentVoiceOwner !== owned || state.mode !== 'conversation' || !microphone) return false;
    const requestId = randomUUID(); responseRequests.set(requestId, owned);
    if (!sendRequired({ type: 'response.create', response: { metadata: { unity_response: requestId } } })) {
      responseRequests.delete(requestId);
      return false;
    }
    return true;
  }
  function confirmVoiceInput(owned) {
    if (!owned || !ownerValid(owned) || owned.inputRequested || !owned.inputCommitted || !owned.inputConfirmed) return;
    owned.inputRequested = true; dropTimer(owned.inputTimer);
    syncReplay(); requestVoiceResponse(owned);
  }
  async function providerAction(item, owned) {
    if (!item.call_id || executedCalls.has(item.call_id) || !ownerValid(owned) || state.mode !== 'conversation') return;
    executedCalls.add(item.call_id);
    // ASR owns the intent gate even for invalid arguments: no function output or
    // fresh response can outrun a late explicit Stop transcription.
    if (owned.inputGate) {
      let gateTimer;
      const confirmed = await Promise.race([owned.inputGate.promise, new Promise(resolve => { gateTimer = registerTimer(() => resolve(false), 3000); })]);
      dropTimer(gateTimer);
      if (!ownerValid(owned) || state.mode !== 'conversation') return false;
      if (!confirmed) {
        error(new ConversationError('VOICE_INTENT_UNCONFIRMED', 'The spoken intent could not be confirmed. Repeat your request or use text.'));
        update({ voice: 'listening', text: 'idle' });
        if (pendingVoiceText) { dropTimer(pendingVoiceText.timer); pendingVoiceText.resolve({ status: 'blocked' }); pendingVoiceText = null; }
        return false;
      }
    }
    let tool;
    try { tool = { name: item.name, args: JSON.parse(item.arguments) }; validateContract('tool-call', tool); }
    catch {
      return sendRequired({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify({ status: 'rejected', code: 'INVALID_TOOL', message: 'This tool call did not match the allowed schema.' }) } });
    }
    const requestValue = { version: 1, sessionId: logicalSessionId, turnId: owned.turnId, requestId: randomUUID(),
      routeEpoch: owned.routeEpoch, consentEpoch: owned.consentEpoch, memoryRevision: owned.memoryRevision, tool };
    try {
      if (tool.name === 'lookup_knowledge') {
        const controller = new AbortController(); actions.add(controller);
        try {
          const result = await lookupKnowledge(tool.args.query, tool.args.topics, controller.signal);
          if (!ownerValid(owned) || controller.signal.aborted || state.mode !== 'conversation') return false;
          return sendRequired({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(result) } });
        } finally { actions.delete(controller); }
      }
      const result = await executeAction(requestValue, owned, 'voice');
      if (ownerValid(owned) && state.mode === 'conversation') {
        return sendRequired({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(result) } });
      }
    } catch (failure) { if (ownerValid(owned) && failure.code !== 'STALE_ACTION') error(failure); }
  }
  async function providerEvent(event, expectedGeneration) {
    if (expectedGeneration !== generation || disposed || typeof event?.type !== 'string') return;
    if (event.type === 'error') {
      if (controlEvents.has(event.error?.event_id)) {
        controlEvents.delete(event.error.event_id); emit({ type: 'control-unconfirmed', code: event.error?.code || 'CONTROL_UNCONFIRMED' }); return;
      }
      error(new ConversationError(event.error?.code || 'PROVIDER_ERROR', event.error?.message || 'The voice service returned an error.'));
      if (pendingVoiceText) { dropTimer(pendingVoiceText.timer); pendingVoiceText.resolve({ status: 'failed' }); pendingVoiceText = null; }
      invalidateTurn(); silence(); update({ voice: state.voice === 'recovering' ? 'recovering' : microphone ? 'listening' : state.voice });
      return;
    }
    if (state.voice === 'recovering') return;
    if (state.mode !== 'conversation' || !microphone) {
      if (event.type === 'response.created') silence();
      return;
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      invalidateTurn(); currentInputItemId = event.item_id || null; currentVoiceOwner = newOwner();
      if (currentInputItemId) {
        let resolve;
        const promise = new Promise(finish => { resolve = finish; });
        currentVoiceOwner.inputGate = { id: currentInputItemId, promise, resolve };
      }
      send({ type: 'response.cancel' }); send({ type: 'output_audio_buffer.clear' });
      activity(); update({ voice: 'listening' }); emit({ type: 'interruption' });
      if (audio) { audio.muted = true; audio.pause?.(); audio.srcObject = null; }
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      activity(); update({ voice: 'thinking' });
    } else if (event.type === 'input_audio_buffer.committed') {
      if (!currentInputItemId || event.item_id !== currentInputItemId || !currentVoiceOwner) return;
      const owned = currentVoiceOwner; owned.inputCommitted = true;
      if (!owned.inputConfirmed && !owned.inputTimer) owned.inputTimer = registerTimer(() => {
        if (!ownerValid(owned) || owned.inputConfirmed) return;
        invalidateTurn(); silence(); update({ voice: 'listening' });
        error(new ConversationError('VOICE_INTENT_UNCONFIRMED', 'The spoken intent could not be confirmed. Repeat your request or use text.'));
      }, 3000);
      confirmVoiceInput(owned);
    } else if (event.type === 'response.created') {
      const responseId = event.response?.id; const requestId = event.response?.metadata?.unity_response;
      const owned = responseRequests.get(requestId);
      // Provider response IDs cannot mint current user authority. The server
      // disables automatic VAD responses; every request carries our nonce.
      if (!owned || !ownerValid(owned) || owned !== currentVoiceOwner || typeof responseId !== 'string') {
        if (typeof responseId === 'string') send({ type: 'response.cancel', response_id: responseId });
        return;
      }
      responseRequests.delete(requestId); responseOwners.set(responseId, owned); owned.playbackAccepted = true;
      restorePlayback(expectedGeneration); update({ voice: 'thinking' });
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      if (!currentInputItemId || event.item_id !== currentInputItemId || !currentVoiceOwner || !ownerValid(currentVoiceOwner) || currentVoiceOwner.inputConfirmed) return;
      const id = voiceItems.get(`user:${event.item_id}`) || randomUUID(); voiceItems.set(`user:${event.item_id}`, id);
      publishTranscript('user', event.transcript || '', true, 'voice', id, context(), true); activity();
      if (event.item_id === currentInputItemId && /^(?:please )?(?:stop|stop listening|stop talking|be quiet)(?: please)?[.!?]*$/i.test((event.transcript || '').trim())) {
        emit({ type: 'spoken-stop' }); await closeVoice('stop'); return;
      }
      if (!(event.transcript || '').trim()) return;
      if (currentVoiceOwner?.inputGate?.id === event.item_id) currentVoiceOwner.inputGate.resolve(true);
      currentVoiceOwner.inputConfirmed = true; confirmVoiceInput(currentVoiceOwner);
    } else if (event.type === 'conversation.item.input_audio_transcription.failed') {
      if (!currentInputItemId || event.item_id !== currentInputItemId) return;
      invalidateTurn(); silence(); update({ voice: 'listening' });
      error(new ConversationError('VOICE_INTENT_UNCONFIRMED', 'The spoken intent could not be confirmed. Repeat your request or use text.'));
    } else if (['response.output_audio_transcript.delta', 'response.output_text.delta'].includes(event.type)) {
      const owned = providerOwner(event); if (!owned || !ownerValid(owned)) return;
      const key = `assistant:${event.item_id}`; const record = voiceItems.get(key) || { id: randomUUID(), text: '' };
      record.text += typeof event.delta === 'string' ? event.delta : ''; record.responseId = event.response_id; voiceItems.set(key, record);
      publishTranscript('assistant', record.text, false, 'voice', record.id, owned); update({ voice: 'speaking' });
    } else if (['response.output_audio_transcript.done', 'response.output_text.done'].includes(event.type)) {
      const owned = providerOwner(event); if (!owned || !ownerValid(owned)) return;
      const key = `assistant:${event.item_id}`; const record = voiceItems.get(key) || { id: randomUUID(), text: '' };
      const text = event.transcript ?? event.text ?? record.text;
      publishTranscript('assistant', text, false, 'voice', record.id, owned); voiceItems.set(key, { ...record, text, responseId: event.response_id });
    } else if (event.type === 'response.done') {
      const owned = providerOwner(event); if (!owned || !ownerValid(owned)) return;
      responseOwners.delete(event.response.id);
      if (event.response?.status === 'completed') {
        for (const record of voiceItems.values()) {
          if (record?.responseId === event.response.id && record.text) publishTranscript('assistant', record.text, true, 'voice', record.id, owned, true);
        }
      }
      const calls = event.response?.output?.filter(item => item.type === 'function_call') || [];
      if (calls.length && event.response?.status === 'completed') {
        owned.toolRounds = (owned.toolRounds || 0) + 1;
        if (owned.toolRounds > 3 || calls.length > 3) {
          error(new ConversationError('TOOL_BUDGET', 'This voice turn reached its action limit. Please continue in a new turn.')); update({ voice: 'listening', text: 'idle' });
          if (pendingVoiceText) { dropTimer(pendingVoiceText.timer); pendingVoiceText.resolve({ status: 'blocked' }); pendingVoiceText = null; }
          return;
        }
        let continuation = false;
        for (const item of calls) continuation = await providerAction(item, owned) || continuation;
        if (continuation) requestVoiceResponse(owned);
        else if (ownerValid(owned) && currentVoiceOwner === owned) {
          update({ voice: 'listening', text: 'idle' });
          if (pendingVoiceText) { dropTimer(pendingVoiceText.timer); pendingVoiceText.resolve({ status: 'failed' }); pendingVoiceText = null; }
        }
      }
      else {
        const status = event.response?.status;
        if (status !== 'completed') error(new ConversationError(status === 'cancelled' ? 'VOICE_REPLY_CANCELLED' : status === 'incomplete' ? 'VOICE_REPLY_INCOMPLETE' : 'VOICE_REPLY_FAILED',
          status === 'cancelled' ? 'That voice reply was cancelled. You can repeat your question or continue by writing.'
            : status === 'incomplete' ? 'The voice reply did not finish. You can repeat your question or continue by writing.'
              : 'The voice service could not complete that reply. You can repeat your question or continue by writing.', true));
        update({ voice: 'listening', text: 'idle' }); activity();
        if (pendingVoiceText) { dropTimer(pendingVoiceText.timer); pendingVoiceText.resolve({ status: ['completed', 'cancelled', 'incomplete'].includes(status) ? status : 'failed' }); pendingVoiceText = null; }
      }
    }
  }
  function syncReplay() {
    const live = context();
    const eligible = replay.filter(record => record.final && record.replayEligible && record.syncedVoiceId !== voiceIdentity && contextMatches(record) && utf8Bytes(record.text) <= 8192);
    const selected = []; let bytes = 0;
    for (let index = eligible.length - 1; index >= 0 && selected.length < 12; index--) {
      const record = eligible[index]; const size = utf8Bytes(record.text);
      if (bytes + size > 24 * 1024) break;
      selected.unshift(record); bytes += size;
    }
    // A bounded replay never introduces older omitted messages on a later Resume.
    for (const record of eligible) if (!selected.includes(record)) record.syncedVoiceId = voiceIdentity;
    for (const record of selected) {
      const item = { type: 'message', role: record.role, content: [{ type: record.role === 'user' ? 'input_text' : 'output_text', text: record.text }] };
      if (sendRequired({ type: 'conversation.item.create', item })) record.syncedVoiceId = voiceIdentity;
      else break;
    }
    return live;
  }
  async function capture(expectedGeneration, expectedCaptureEpoch = captureEpoch) {
    if (isSecureContext === false) throw new ConversationError('MICROPHONE_HTTPS_REQUIRED', 'Microphone access requires a secure page. Open the HTTPS site directly, then choose Speak.');
    if (!mediaDevices?.getUserMedia) throw new ConversationError('MICROPHONE_UNAVAILABLE', 'This browser cannot access a microphone. Open the HTTPS site in a supported browser or continue by writing.');
    if (ownerDocument?.permissionsPolicy?.allowsFeature?.('microphone') === false) throw new ConversationError('MICROPHONE_POLICY_BLOCKED', 'This page is not allowed to use the microphone. Open the HTTPS site directly in a supported browser and check its microphone permission.');
    const stillOwned = () => expectedGeneration === generation && expectedCaptureEpoch === captureEpoch && !disposed && state.mode === 'conversation' && !ownerDocument?.hidden;
    if (!stillOwned()) throw new ConversationError('ACTIVATION_CANCELLED', 'Microphone activation was cancelled.');
    let waiting = true; let timeout; let cancel;
    const stopStream = stream => { for (const track of stream?.getTracks?.() || []) track.stop(); };
    try {
      const stream = await new Promise((resolve, reject) => {
        const fail = failure => { if (waiting) { waiting = false; reject(failure); } };
        cancel = () => fail(new ConversationError('ACTIVATION_CANCELLED', 'Microphone activation was cancelled.'));
        captureWaits.add(cancel);
        timeout = registerTimer(() => fail(new ConversationError('MICROPHONE_PERMISSION_TIMEOUT', 'Microphone activation is still awaiting the browser. Check its permission prompt, then choose Speak again. Any late microphone grant from this attempt will be released.')), 30000);
        Promise.resolve().then(() => {
          if (!waiting || !stillOwned()) throw new ConversationError('ACTIVATION_CANCELLED', 'Microphone activation was cancelled.');
          return mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        }).then(stream => {
          if (!waiting || !stillOwned()) { stopStream(stream); cancel(); return; }
          waiting = false; resolve(stream);
        }, failure => fail(microphoneFailure(failure)));
      });
      if (!stillOwned()) { stopStream(stream); throw new ConversationError('ACTIVATION_CANCELLED', 'Microphone activation was cancelled.'); }
      const track = stream?.getAudioTracks?.()[0];
      if (!track || track.readyState !== 'live') { stopStream(stream); throw new ConversationError('MICROPHONE_NOT_FOUND', 'No active microphone was returned. Connect or enable a microphone, then choose Speak again.'); }
      track.addEventListener?.('ended', () => {
        if (microphone !== stream || !stillOwned()) return;
        error(new ConversationError('MICROPHONE_ENDED', 'The microphone disconnected or its permission was withdrawn. Check your device and site permission, then choose Speak again.'));
        closeVoice('transport-failed');
      }, { once: true });
      return stream;
    } finally { waiting = false; dropTimer(timeout); if (cancel) captureWaits.delete(cancel); }
  }
  async function startVoice() {
    if (voicePromise) return voicePromise;
    if (microphone && peer?.connectionState === 'connected' && channel?.readyState === 'open') {
      if (currentVoiceOwner?.playbackAccepted && ownerValid(currentVoiceOwner)) restorePlayback(generation);
      return snapshot();
    }
    if (peer && ownedCall) return resumeVoice();
    authorize();
    if (!PeerConnection) { const failure = new ConversationError('VOICE_UNAVAILABLE', 'This browser cannot use live voice. Open the site in a supported browser or continue by writing.'); error(failure); throw failure; }
    if (state.mode === 'media') throw new ConversationError('MEDIA_ACTIVE', 'Pause media before resuming voice.');
    invalidateTurn();
    const expectedGeneration = ++generation; const expectedCaptureEpoch = ++captureEpoch; const owned = context();
    voiceAbort = new AbortController(); const signal = voiceAbort.signal;
    update({ voice: 'checking', error: null });
    const promise = (async () => {
      try {
        const status = await getStatus({ signal });
        if (expectedGeneration !== generation || expectedCaptureEpoch !== captureEpoch || signal.aborted || disposed) return snapshot();
        if (!status.ready) throw new ConversationError('SERVICE_NOT_READY', readinessMessage(status));
        authorize();
        update({ voice: 'permission' });
        const stream = await capture(expectedGeneration, expectedCaptureEpoch);
        if (expectedGeneration !== generation || expectedCaptureEpoch !== captureEpoch || disposed || state.mode !== 'conversation') {
          for (const track of stream.getTracks()) track.stop(); return snapshot();
        }
        microphone = stream;
        peer = new PeerConnection(); const currentPeer = peer; voiceIdentity = randomUUID(); recoveryUsed = false;
        audio = createAudio(); if (!audio) throw new ConversationError('AUDIO_UNAVAILABLE', 'This browser cannot play voice output.');
        audio.autoplay = true; audio.playsInline = true; audio.muted = true;
        currentPeer.addEventListener('track', event => {
          if (expectedGeneration !== generation) return;
          remoteStream = event.streams?.[0];
          if (microphone && state.mode === 'conversation') { audio.srcObject = remoteStream; audio.play?.().catch(() => { if (expectedGeneration === generation && microphone && state.mode === 'conversation') emit({ type: 'playback-blocked' }); }); }
        });
        sender = currentPeer.addTrack(microphone.getAudioTracks()[0], microphone);
        channel = currentPeer.createDataChannel('oai-events'); const currentChannel = channel;
        const transportEnded = () => {
          if (expectedGeneration !== generation || disposed) return;
          error(new ConversationError('VOICE_RECONNECT_REQUIRED', 'The voice connection ended. Check your connection, then choose Speak to reconnect.', true));
          closeVoice('transport-failed');
        };
        currentChannel.addEventListener('close', transportEnded); currentChannel.addEventListener('error', transportEnded);
        currentChannel.addEventListener('message', message => {
          if (expectedGeneration !== generation || disposed) return;
          if (utf8Bytes(message.data) > 128 * 1024) { error(new ConversationError('EVENT_LIMIT', 'Voice returned an oversized event.')); closeVoice('transport-failed'); return; }
          let event; try { event = JSON.parse(message.data); } catch { return; }
          providerEvent(event, expectedGeneration).catch(failure => { error(failure); });
        });
        currentPeer.addEventListener('connectionstatechange', () => {
          if (expectedGeneration !== generation) return;
          if (currentPeer.connectionState === 'connected') {
            dropTimer(recoveryTimer); recoveryTimer = null;
            if (state.voice === 'recovering') { update({ voice: microphone ? 'listening' : 'paused-media' }); emit({ type: 'voice-recovery', status: 'recovered' }); }
          }
          if (currentPeer.connectionState === 'disconnected' && !recoveryUsed && !ownerDocument?.hidden && microphone) {
            // Give this existing peer one bounded chance to recover its transport.
            // restartIce would require a documented same-call SDP renegotiation;
            // never create another paid call to simulate a reconnect.
            recoveryUsed = true; invalidateTurn(); silence(); update({ voice: 'recovering' }); emit({ type: 'voice-recovery', status: 'waiting' });
            recoveryTimer = registerTimer(() => { if (currentPeer.connectionState !== 'connected') transportEnded(); }, 5000);
          } else if (['failed', 'closed', 'disconnected'].includes(currentPeer.connectionState)) { transportEnded(); }
        });
        update({ voice: 'connecting' });
        const offer = await voiceSetup(currentPeer.createOffer(), signal);
        if (expectedGeneration !== generation || expectedCaptureEpoch !== captureEpoch || signal.aborted) {
          if (expectedGeneration === generation) await closeVoice('stop'); return snapshot();
        }
        await voiceSetup(currentPeer.setLocalDescription(offer), signal);
        if (expectedGeneration !== generation || expectedCaptureEpoch !== captureEpoch || signal.aborted) {
          if (expectedGeneration === generation) await closeVoice('stop'); return snapshot();
        }
        const body = { version: 1, requestId: randomUUID(), attemptId: randomUUID(), sdp: offer.sdp, locale: 'en-AU', canonVersion: owned.canonVersion, consentEpoch: owned.consentEpoch, consentedMemories: owned.consentedMemories };
        validateContract('realtime-start', body);
        const creationAbort = voiceAbort; let creationTimer; let cancelCreation;
        const creating = (async () => {
          const result = await (await request('realtime', body, signal)).json();
          if (result.version !== 1 || typeof result.sessionId !== 'string' || !result.closeToken || result.transport?.type !== 'webrtc' || typeof result.transport.sdp !== 'string') {
            if (typeof result.sessionId === 'string' && typeof result.closeToken === 'string') closeOwned({ sessionId: result.sessionId, closeToken: result.closeToken }, 'revoked');
            throw new ConversationError('INVALID_SESSION', 'The voice service returned an invalid session.');
          }
          if (expectedGeneration !== generation || signal.aborted || !contextMatches(owned)) {
            await closeOwned({ sessionId: result.sessionId, closeToken: result.closeToken }, 'revoked');
            throw new ConversationError('ACTIVATION_CANCELLED', 'Voice activation was cancelled.');
          }
          return result;
        })();
        let result;
        try {
          result = await Promise.race([creating, new Promise((resolve, reject) => {
            cancelCreation = () => reject(new DOMException('Cancelled', 'AbortError'));
            signal.addEventListener('abort', cancelCreation, { once: true });
            if (signal.aborted) cancelCreation();
            creationTimer = registerTimer(() => { reject(new ConversationError('VOICE_START_TIMEOUT', 'The voice service did not finish connecting. Microphone capture has stopped. Check your connection before choosing Speak again.', true)); creationAbort.abort(); }, 35000);
          })]);
        } finally { dropTimer(creationTimer); if (cancelCreation) signal.removeEventListener('abort', cancelCreation); }
        const call = { sessionId: result.sessionId, closeToken: result.closeToken };
        if (expectedGeneration !== generation || !contextMatches(owned)) {
          if (expectedGeneration === generation) await closeVoice('revoked');
          await closeOwned(call, 'revoked'); return snapshot();
        }
        ownedCall = call;
        await voiceSetup(currentPeer.setRemoteDescription({ type: 'answer', sdp: result.transport.sdp }), signal);
        if (expectedGeneration !== generation || signal.aborted) return snapshot();
        await new Promise((resolve, reject) => {
          let finished = false;
          const complete = () => {
            if (!finished && currentChannel.readyState === 'open' && currentPeer.connectionState === 'connected') { finished = true; dropTimer(connectionTimer); resolve(); }
          };
          currentChannel.addEventListener('open', complete); currentPeer.addEventListener('connectionstatechange', complete);
          connectionTimer = registerTimer(() => { finished = true; reject(new ConversationError('CONNECT_TIMEOUT', 'Voice did not connect. Use text or deliberately retry.')); }, 15000);
          signal.addEventListener('abort', () => { if (!finished) { finished = true; reject(new DOMException('Cancelled', 'AbortError')); } }, { once: true }); complete();
        });
        if (expectedGeneration !== generation) return snapshot();
        syncReplay();
        if (expectedGeneration !== generation) return snapshot();
        const serverDeadline = Date.parse(result.clientDeadlineAt);
        deadlineTimer = registerTimer(() => { closeVoice('expired'); emit({ type: 'voice-expired', reason: 'duration' }); }, Math.max(0, Math.min(DEFAULT_DEADLINE, Number.isFinite(serverDeadline) ? serverDeadline - now() : DEFAULT_DEADLINE)));
        activity();
        if (expectedCaptureEpoch === captureEpoch && microphone && state.mode === 'conversation') { update({ voice: 'listening' }); emit({ type: 'voice-ready' }); }
        else update({ voice: state.mode === 'media' ? 'paused-media' : 'paused' });
        return snapshot();
      } catch (failure) {
        if (expectedGeneration === generation) {
          if (failure.code === 'ACTIVATION_CANCELLED') await closeVoice('stop');
          else { error(failure); await closeVoice('transport-failed'); }
        }
        if (failure.code === 'ACTIVATION_CANCELLED' || failure.name === 'AbortError') return snapshot();
        throw failure;
      } finally { if (voicePromise === promise) voicePromise = null; }
    })();
    voicePromise = promise; return promise;
  }
  async function sendText(message) {
    authorize();
    if (typeof message !== 'string' || !message.trim() || utf8Bytes(message) > 8192 || [...message].length > 8192) throw new ConversationError('MESSAGE_LIMIT', 'Write a message of at most 8 KiB.');
    invalidateTurn(); silence();
    const owned = newOwner(); const history = boundedHistory(replay, owned.consentEpoch, owned.memoryRevision);
    activity();
    update({ text: 'thinking', error: null });
    if (state.mode === 'conversation' && microphone && channel?.readyState === 'open') {
      syncReplay(); if (!ownerValid(owned)) return { status: 'cancelled' };
      publishTranscript('user', message, true, 'text', randomUUID(), owned, true);
      currentVoiceOwner = owned;
      return new Promise(resolve => {
        const timer = registerTimer(() => {
          if (pendingVoiceText?.owned === owned) { pendingVoiceText = null; invalidateTurn(); silence(); update({ text: 'idle', voice: 'listening' }); resolve({ status: 'incomplete' }); }
        }, 50000);
        pendingVoiceText = { resolve, owned, timer };
        if (sendRequired({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: message }] } })) requestVoiceResponse(owned);
      });
    }
    publishTranscript('user', message, true, 'text', randomUUID(), owned);
    const abort = new AbortController(); const turn = { id: owned.turnId, abort, timer: null }; activeTurn = turn;
    turn.timer = registerTimer(() => abort.abort(), 50000);
    const assistantId = randomUUID(); let text = ''; let completed = false;
    let body = { version: 1, kind: 'start', requestId: randomUUID(), turnId: owned.turnId, conversationId,
      turnEpoch, routeEpoch: owned.routeEpoch, consentEpoch: owned.consentEpoch, memoryRevision: owned.memoryRevision,
      message, history, uiContext: owned.uiContext, consentedMemories: owned.consentedMemories };
    try {
      for (let round = 0; round < 3; round++) {
        if (!ownerValid(owned) || abort.signal.aborted) return { status: 'cancelled' };
        validateContract('text-turn', body); let continuation = null;
        const response = await request('turns', body, abort.signal);
        await readFiniteSSE(response, async (name, value) => {
          if (!ownerValid(owned) || abort.signal.aborted || value.turnId !== turn.id) throw new ConversationError('STALE_TURN', 'The text reply is no longer current.');
          if (continuation || completed) throw new ConversationError('INVALID_STREAM', 'The text turn returned events after its terminal event.');
          if (name === 'text.delta') {
            if (typeof value.text !== 'string') throw new ConversationError('INVALID_STREAM', 'Invalid text delta.');
            text += value.text; publishTranscript('assistant', text, false, 'text', assistantId, owned);
          } else if (name === 'turn.complete') {
            if (continuation || completed) throw new ConversationError('INVALID_STREAM', 'The text turn returned conflicting completion events.');
            if (typeof value.text !== 'string') throw new ConversationError('INVALID_STREAM', 'Invalid completed text.');
            text = value.text; completed = true;
          } else if (name === 'turn.error') { throw new ConversationError(value.code || 'TURN_FAILED', value.message || 'The text turn failed.', value.retryable); }
          else if (name === 'action.request') {
            if (continuation || completed || value.actionId !== value.action?.requestId || typeof value.continuationToken !== 'string') throw new ConversationError('INVALID_ACTION', 'Invalid action continuation.');
            validateContract('action-request', value.action);
            if (value.action.turnId !== turn.id || value.action.consentEpoch !== owned.consentEpoch || value.action.memoryRevision !== owned.memoryRevision || value.action.routeEpoch !== owned.routeEpoch) throw new ConversationError('INVALID_ACTION', 'The action ownership does not match its text turn.');
            continuation = value;
          }
        }, abort.signal);
        if (completed) { publishTranscript('assistant', text, true, 'text', assistantId, owned); activity(); return { status: 'completed', text }; }
        if (!continuation) throw new ConversationError('INCOMPLETE_TURN', 'The text turn ended without a complete reply.');
        const result = await executeAction(continuation.action, owned, 'text');
        body = { version: 1, kind: 'result', requestId: randomUUID(), turnId: turn.id, actionId: continuation.actionId, continuationToken: continuation.continuationToken, result };
      }
      throw new ConversationError('TOOL_BUDGET', 'This turn reached its action limit. Please continue in a new message.');
    } catch (failure) {
      if (!ownerValid(owned) || abort.signal.aborted || failure.name === 'AbortError' || failure.code === 'STALE_TURN' || failure.code === 'STALE_ACTION') return { status: 'cancelled' };
      error(failure); throw failure;
    } finally {
      dropTimer(turn.timer);
      if (activeTurn === turn) {
        activeTurn = null; update({ text: 'idle' });
        if (!completed) request('turns', { version: 1, kind: 'cancel', requestId: randomUUID(), turnId: turn.id }, undefined, true, true).catch(() => {});
      }
    }
  }
  async function enterMedia() {
    const expectedCaptureEpoch = ++captureEpoch; resumePromise = null;
    for (const cancel of captureWaits) cancel();
    update({ mode: 'media' }); invalidateTurn(); silence();
    try { await releaseCapture(); }
    catch (failure) {
      if (expectedCaptureEpoch !== captureEpoch || disposed) throw new ConversationError('MEDIA_REQUEST_SUPERSEDED', 'This media activation was superseded.');
      error(failure);
      // closeVoice invalidates both owners synchronously. Its remote receipt may
      // arrive after a deliberate Resume, so retain this cleanup's own stamps.
      const closingGeneration = generation + 1; const closingCaptureEpoch = captureEpoch + 1;
      await closeVoice('transport-failed');
      if (generation !== closingGeneration || captureEpoch !== closingCaptureEpoch || state.mode !== 'media' || disposed) {
        throw new ConversationError('MEDIA_REQUEST_SUPERSEDED', 'This media activation was superseded.');
      }
      // Physical capture was already stopped. Closing a stalled sender also
      // makes it safe to reveal media controls without preserving a broken peer.
      return snapshot();
    }
    if (expectedCaptureEpoch !== captureEpoch || state.mode !== 'media' || disposed) throw new ConversationError('MEDIA_REQUEST_SUPERSEDED', 'This media activation was superseded.');
    update({ voice: ownedCall ? 'paused-media' : 'paused' }); emit({ type: 'voice-paused', reason: 'media' }); return snapshot();
  }
  async function resumeVoice() {
    if (resumePromise) return resumePromise;
    authorize();
    if (state.mode === 'conversation' && microphone && peer?.connectionState === 'connected' && channel?.readyState === 'open') return snapshot();
    if (peer && ownedCall && (channel?.readyState !== 'open' || peer.connectionState !== 'connected')) {
      const failure = new ConversationError('VOICE_RECONNECT_REQUIRED', 'The voice connection ended. Select Speak to start a new connection.');
      error(failure); await closeVoice('transport-failed'); throw failure;
    }
    const expectedGeneration = generation; const expectedCaptureEpoch = ++captureEpoch;
    const stillOwned = () => !disposed && expectedGeneration === generation && expectedCaptureEpoch === captureEpoch;
    const promise = (async () => {
      // Establish the shared promise before any synchronously failing consumer callback.
      await Promise.resolve();
      let stream = null;
      try {
        if (state.mode === 'media') {
          const quiet = await captureOperation(ensureMediaQuiet());
          if (!stillOwned()) return snapshot();
          if (quiet !== true && quiet?.status !== 'quiet') throw new ConversationError('MEDIA_NOT_QUIET', 'Pause or close all media before resuming voice.');
        }
        if (!stillOwned()) return snapshot();
        update({ mode: 'conversation' });
        if (!ownedCall || !peer || channel?.readyState !== 'open') return await startVoice();
        update({ voice: 'checking', error: null });
        const status = await getStatus({ signal: voiceAbort?.signal });
        if (!stillOwned() || state.mode !== 'conversation') return snapshot();
        if (!status.ready) throw new ConversationError('SERVICE_NOT_READY', readinessMessage(status));
        authorize();
        update({ voice: 'permission', error: null }); syncReplay();
        stream = await capture(expectedGeneration, expectedCaptureEpoch);
        if (!stillOwned() || state.mode !== 'conversation') { for (const track of stream.getTracks()) track.stop(); return snapshot(); }
        const ownedSender = sender; microphone = stream;
        await captureOperation(ownedSender.replaceTrack(stream.getAudioTracks()[0]));
        if (!stillOwned() || state.mode !== 'conversation') { for (const track of stream.getTracks()) track.stop(); if (microphone === stream) microphone = null; return snapshot(); }
        if (audio) {
          audio.srcObject = remoteStream; audio.muted = false;
          await captureOperation(Promise.resolve(audio.play?.()).catch(() => emit({ type: 'playback-blocked' })));
        }
        if (!stillOwned() || state.mode !== 'conversation') { for (const track of stream.getTracks()) track.stop(); if (microphone === stream) microphone = null; return snapshot(); }
        activity(); update({ voice: 'listening' }); return snapshot();
      } catch (failure) {
        if (stream) for (const track of stream.getTracks()) track.stop();
        if (!stillOwned() || failure.code === 'ACTIVATION_CANCELLED') return snapshot();
        if (microphone === stream) microphone = null;
        error(failure);
        if (stream || failure.code === 'VOICE_SETUP_TIMEOUT') await closeVoice('transport-failed');
        else update({ voice: 'paused' });
        throw failure;
      } finally { if (resumePromise === promise) resumePromise = null; }
    })();
    resumePromise = promise; return promise;
  }
  async function revokeContext() {
    for (const record of replay) record.replayEligible = false;
    await closeVoice('revoked'); emit({ type: 'context-revoked' }); return snapshot();
  }
  async function clearConversation() {
    for (const record of replay) record.replayEligible = false;
    const closing = closeVoice('revoked'); replay.splice(0); update({ transcript: [] });
    emit({ type: 'cleared' }); await closing; return snapshot();
  }
  async function stop() { await closeVoice('stop'); return snapshot(); }
  async function exit() {
    if (disposed) return snapshot(); disposed = true;
    for (const abort of statusAborts) abort.abort();
    await closeVoice('exit'); token = null; tokenExpiry = 0;
    ownerDocument?.removeEventListener('visibilitychange', onVisibility); ownerWindow?.removeEventListener('pagehide', onPageHide);
    for (const timer of timers) clearTimer(timer); timers.clear(); update({ authorized: false, expiresAt: null, voice: 'closed' }); return snapshot();
  }
  function onVisibility() { if (ownerDocument?.hidden) { closeVoice('hidden'); emit({ type: 'voice-paused', reason: 'hidden' }); } }
  function onPageHide() { closeVoice('exit'); }
  async function lookupKnowledge(query, topics = [], signal) {
    const body = { version: 1, canonVersion: context().canonVersion, query, topics }; validateContract('knowledge-request', body);
    const value = await (await request('knowledge', body, signal)).json();
    if (value.version !== 1 || !Array.isArray(value.chunks) || value.chunks.length > 3 || utf8Bytes(JSON.stringify(value)) > 64 * 1024
      || value.chunks.some(chunk => typeof chunk.text !== 'string' || typeof chunk.sourceId !== 'string' || typeof chunk.title !== 'string')) {
      throw new ConversationError('INVALID_KNOWLEDGE', 'The knowledge service returned invalid source material.');
    }
    emit({ type: 'knowledge', result: value }); return value;
  }
  ownerDocument?.addEventListener('visibilitychange', onVisibility); ownerWindow?.addEventListener('pagehide', onPageHide);
  return {
    getState: snapshot, startVoice, sendText, stop, enterMedia, resumeVoice, revokeContext, clearConversation, exit, lookupKnowledge,
    getStatus,
    async access(inviteCode) {
      if (disposed) throw new ConversationError('SESSION_EXITED', 'Start a fresh visit to reconnect.');
      const attempt = ++accessAttempt; const expectedGeneration = generation;
      const body = { version: 1, inviteCode }; validateContract('access', body);
      accessAbort?.abort(); const abort = new AbortController(); accessAbort = abort; let deadline; let cancel;
      try {
        const value = await Promise.race([
          (async () => (await request('access', body, abort.signal, false)).json())(),
          new Promise((resolve, reject) => {
            cancel = () => reject(new ConversationError('ACCESS_CANCELLED', 'Invite activation was cancelled.'));
            abort.signal.addEventListener('abort', cancel, { once: true });
            deadline = registerTimer(() => { reject(new ConversationError('ACCESS_TIMEOUT', 'The invitation service did not finish connecting. Check your connection and try your invitation again.', true)); abort.abort(); }, 15000);
          }),
        ]);
        if (disposed || generation !== expectedGeneration || attempt !== accessAttempt) throw new ConversationError('ACCESS_CANCELLED', 'Invite activation was cancelled.');
        const expiresAt = Date.parse(value?.expiresAt);
        if (value?.version !== 1 || typeof value.accessToken !== 'string' || !Number.isFinite(expiresAt) || expiresAt <= now()) throw new ConversationError('INVALID_ACCESS', 'The invite service returned invalid access.');
        token = value.accessToken; tokenExpiry = expiresAt;
        update({ authorized: true, expiresAt: value.expiresAt, error: null }); return { ...value, accessToken: undefined };
      } catch (failure) {
        if (!disposed && generation === expectedGeneration && attempt === accessAttempt && failure.code !== 'ACCESS_CANCELLED') error(failure);
        throw failure;
      } finally {
        dropTimer(deadline); if (cancel) abort.signal.removeEventListener('abort', cancel);
        if (accessAbort === abort) accessAbort = null;
      }
    },
  };
}
