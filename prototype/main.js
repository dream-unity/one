import { initialState, reduceState, DESTINATIONS, parseLocalIntention } from './state.js';
import { createScene } from './scene.js';
import { loadManifesto } from './manifesto-view.js';
import { createEarthAdapter, EARTH_ORIGIN } from './earth/adapter.js';
import { createActionExecutor, observedView } from './actions.js';
import { createMemoryStore, createMemoryController } from './memory/store.js';
import { mountMemoryView } from './memory/view.js';
import { createConversation } from './conversation/controller.mjs';

const $ = id => document.getElementById(id);
let state = initialState(new URL(location.href).searchParams.get('view') || 'unity');
const localSessionId = crypto.randomUUID();
let memory = null, memoryView = null, memoryController = null;
let sharedContext = [], selectedIds = [], serviceStatus = null, conversation = null;
let routeController = null, navigationGeneration = 0, manifestoLoaded = false;
let providerContextRevision = 0, exiting = false;
const transcriptEntries = new Map();
const directSaveControllers = new Set();
const scene = createScene($('unity-scene'));
function dispatch(event) { state = reduceState(state, event); render(); }
function announce(message) { $('announcement').textContent = message; }
function trimTranscript() {
  const container = $('transcript');
  while (container.children.length > 100) container.firstElementChild.remove();
  for (const [id, element] of transcriptEntries) if (!container.contains(element)) transcriptEntries.delete(id);
}
function notice(message, kind = 'notice') {
  const id = crypto.randomUUID(); const item = document.createElement('p');
  item.className = `transcript-entry transcript-entry--${kind}`;
  item.textContent = message;
  $('transcript').querySelector('.empty-state')?.remove(); $('transcript').append(item);
  transcriptEntries.set(id, item);
  trimTranscript();
  announce(message);
}
function transcript(event) {
  $('transcript').querySelector('.empty-state')?.remove();
  let element = transcriptEntries.get(event.id);
  if (!element) {
    element = document.createElement('p'); element.className = `transcript-entry transcript-entry--${event.role}`;
    const label = document.createElement('strong'); label.textContent = event.role === 'user' ? 'You: ' : 'Dream Unity: ';
    element.append(label, document.createElement('span')); $('transcript').append(element);
    transcriptEntries.set(event.id, element);
  }
  element.querySelector('span').textContent = event.text;
  trimTranscript();
}
function showError(error) {
  const message = error?.message || 'This action could not be completed.';
  notice(message, 'error');
}
const guarded = handler => event => Promise.resolve().then(() => handler(event)).catch(showError);
function render() {
  document.body.dataset.view = state.destination;
  document.body.dataset.mode = state.mode;
  document.body.dataset.microphone = state.microphone;
  for (const panel of document.querySelectorAll('[data-view-panel]')) panel.hidden = panel.dataset.viewPanel !== state.destination;
  $('view-heading').hidden = state.destination === 'unity';
  $('view-title').textContent = DESTINATIONS[state.destination].title;
  scene.setActive(state.visible && state.destination === 'unity');
  scene.setFocus(state.reflection?.worlds || (state.worldFocus ? [state.worldFocus] : []), state.reflection?.summary || '');
  $('interpretation-panel').hidden = !state.reflection;
  $('interpretation-text').textContent = state.reflection?.summary || '';
  $('resume-button').hidden = state.mode !== 'media' && !['paused', 'idle', 'failed', 'expired', 'closed'].includes(state.microphone);
  $('resume-button').disabled = !conversation?.getState().authorized;
  const voiceActive = ['listening', 'speaking', 'connected', 'ready'].includes(state.microphone);
  $('voice-label').textContent = voiceActive ? 'Listening' : state.mode === 'media' ? 'Resume' : 'Speak';
  $('voice-start').setAttribute('aria-pressed', String(voiceActive));
  const descriptions = { idle: 'Write an intention, or choose Speak.', listening: 'Listening. Stop releases your microphone.',
    speaking: 'Speaking. You can interrupt or press Stop.', connecting: 'Connecting your conversation…', permission: 'Waiting for microphone permission…', thinking: 'Considering your question…',
    ready: 'Your conversation is ready.', connected: 'Listening. Stop releases your microphone.',
    paused: 'Microphone paused. Choose Resume when ready.', stopped: 'Microphone stopped. You can still write.',
    expired: 'Voice ended. Text and navigation remain available.', failed: 'Voice is unavailable. You can still write.', closed: 'Microphone stopped. You can still write.' };
  $('session-status').textContent = state.mode === 'media' ? 'Media mode. Microphone and AI audio are off. Choose Resume to speak again.' : descriptions[state.microphone] || 'Write an intention, or choose Speak.';
  $('earth-status').textContent = state.earth?.app === 'failed' ? 'Earth could not connect.' : state.earth?.globe === 'ready' ? 'Earth is ready.' : state.earth?.app === 'ready' ? 'Earth is open. Globe and feed availability may vary.' : 'Opening God’s Earth View…';
}
function setUrl(destination, replace = false) {
  const url = new URL(location.href); url.search = destination === 'unity' ? '' : `?view=${destination}`; url.hash = '';
  history[replace ? 'replaceState' : 'pushState']({ destination }, '', url);
}
const earth = createEarthAdapter({ host: $('earth-frame-host'),
  onState(value) {
    dispatch({ type: 'earth', readiness: value });
    $('earth-recovery').hidden = value.app !== 'failed';
  },
  async onMedia() {
    await conversation.enterMedia(); dispatch({ type: 'mode', mode: 'media' }); return true;
  },
  onHome() { navigateFromUser('unity').catch(showError); },
});
async function navigate(destination, { back = false, signal, replace = false } = {}) {
  if (exiting || signal?.aborted || !state.visible) return null;
  if (!Object.hasOwn(DESTINATIONS, destination)) throw new Error('That activity is not available in this prototype.');
  const ownedNavigation = ++navigationGeneration;
  routeController?.abort();
  const ownedController = new AbortController(); routeController = ownedController;
  const cancel = () => ownedController.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const current = () => !exiting && state.visible && ownedNavigation === navigationGeneration && !ownedController.signal.aborted;
  if (destination === state.destination) {
    try {
      if (destination === 'earth' && !earth.getState().active) await openEarth(ownedController.signal);
      if (destination === 'manifesto' && !manifestoLoaded) {
        await loadManifesto($('manifesto-content'), { signal: ownedController.signal });
        if (!current()) return null;
        manifestoLoaded = true;
      }
      return current() ? DESTINATIONS[destination] : null;
    } finally { signal?.removeEventListener('abort', cancel); }
  }
  try {
    if (state.destination === 'earth') {
      const snapshot = await earth.getSnapshot();
      if (!current()) return null;
      if ((!snapshot || snapshot.hasUnsavedState) && !window.confirm('Leave Earth? Its active session will close. Unfinished drawings, projects or forms may not return.')) return null;
    }
    if (!current()) return null;
    memoryController?.invalidate();
    const previous = state.destination;
    dispatch({ type: 'navigate', destination, back }); setUrl(destination, replace);
    if (previous === 'earth') await earth.suspend(state.routeEpoch, 'route-exit');
    if (!current()) return null;
    $('view-status').textContent = ''; $('view-title').focus({ preventScroll: true });
    if (destination === 'manifesto' && !manifestoLoaded) {
      await loadManifesto($('manifesto-content'), { signal: ownedController.signal });
      if (!current()) return null;
      manifestoLoaded = true;
    }
    if (destination === 'earth') await openEarth(ownedController.signal);
    if (destination === 'constellation') await memoryView?.refresh();
    if (!current()) return null;
    announce(`Opened ${DESTINATIONS[destination].title}.`);
    return DESTINATIONS[destination];
  } finally { signal?.removeEventListener('abort', cancel); }
}
async function openEarth(signal) {
  if (exiting || !state.visible || state.destination !== 'earth' || signal?.aborted) return null;
  const openingEpoch = state.routeEpoch;
  $('earth-error').textContent = ''; $('earth-recovery').hidden = true;
  try { return await earth.open(state.routeEpoch, { signal }); }
  catch (error) {
    if (exiting || signal?.aborted || state.destination !== 'earth' || state.routeEpoch !== openingEpoch) return null;
    $('earth-recovery').hidden = false; $('earth-error').textContent = error.message;
    throw error;
  }
}
function focus(world) {
  dispatch({ type: 'focus', world });
  const meaning = { machine: 'Dream Machine: heart, mind and body. Its activities retain restricted access.',
    maker: 'Dream Maker: intention, action and becoming. Its activities retain restricted access.',
    world: 'Dream World: matter, structure and emergence. Earth is available to explore.' };
  $('view-status').textContent = meaning[world]; notice(meaning[world]);
}
const executor = createActionExecutor({ getState: () => state, navigate, focus,
  reflect(worlds, summary) { dispatch({ type: 'reflection', worlds, summary }); }, earth,
  async proposeMemory(proposal, request, { signal }) {
    if (!memoryController) throw new Error('Remembering is not available in this browser.');
    const dataset = await memory.load();
    const ownsProposal = () => !signal.aborted && request.routeEpoch === state.routeEpoch && request.consentEpoch === state.consentEpoch && request.memoryRevision === state.memoryRevision;
    if (!ownsProposal()) throw Object.assign(new Error('Memory proposal cancelled.'), { code: 'CANCELLED' });
    if (!dataset.consent.storageEnabled) throw new Error('Enable remembering before saving a proposed note.');
    if (proposal.operation !== 'create_node' && !dataset.consent.conversationUseEnabled) throw new Error('Share the selected saved records before asking the AI to propose their changes.');
    await memoryController.propose(proposal, { turnId: request.turnId, sharedIds: sharedContext.map(r => r.id),
      consentEpoch: request.consentEpoch, revision: request.memoryRevision, signal });
    if (!ownsProposal()) {
      if (memoryController.getPending()?.turnId === request.turnId) memoryController.invalidate();
      throw Object.assign(new Error('Memory proposal cancelled.'), { code: 'CANCELLED' });
    }
    if (state.destination !== 'constellation') notice('A memory proposal is ready in My constellation. Review its exact wording before saving.');
  },
  onResult(request, result) {
    if (['failed', 'blocked', 'rejected', 'cancelled', 'superseded', 'unknown'].includes(result.status)) notice(result.message);
  },
});
function localRequest(tool) { return { version: 1, sessionId: localSessionId, turnId: crypto.randomUUID(), requestId: crypto.randomUUID(),
  routeEpoch: state.routeEpoch, consentEpoch: state.consentEpoch, memoryRevision: state.memoryRevision, tool }; }
conversation = createConversation({ baseUrl: EARTH_ORIGIN,
  getContext: () => ({ routeEpoch: state.routeEpoch, consentEpoch: state.consentEpoch, memoryRevision: state.memoryRevision,
    canonVersion: serviceStatus?.canonVersion || 'published-manifesto/1', uiContext: observedView(state), consentedMemories: sharedContext }),
  onEvent(event) {
    if (event.type === 'interruption' || event.type === 'spoken-stop' || event.type === 'stopped') {
      interruptLocalWork(); earth.cancelActions().catch(() => {});
    }
    if (event.type === 'transcript') {
      if (event.role === 'user' && event.final) memoryController?.invalidate();
      transcript(event);
    }
    if (event.type === 'error') { showError(event); if (event.code === 'ACCESS_REQUIRED') revealAccess(); }
  },
  onState(value) {
    dispatch({ type: 'voice', status: value.voice }); dispatch({ type: 'mode', mode: value.mode });
    scene.setSpeaking(value.voice === 'speaking' ? 0.7 : 0);
  },
  onAction: (request, options) => executor.execute(request, options),
  ensureMediaQuiet: () => earth.quiet(),
});
function interruptLocalWork() {
  for (const controller of directSaveControllers) controller.abort();
  executor.cancel(); routeController?.abort(); navigationGeneration++; memoryController?.invalidate();
  dispatch({ type: 'interrupt' });
}
function pauseForUserControl() {
  interruptLocalWork();
  // stop() invalidates its provider owners synchronously; remote close can finish later.
  conversation.stop().catch(showError); earth.cancelActions().catch(() => {});
}
function navigateFromUser(destination, options) {
  pauseForUserControl(); return navigate(destination, options);
}
function revealAccess() {
  $('access-panel').hidden = false; $('access-status').textContent = serviceStatus?.ready ? 'Enter your private invitation to connect.' : 'Conversation is awaiting private service configuration.';
  if (serviceStatus?.ready) $('access-invite').focus();
}
async function startVoice() {
  if (!serviceStatus?.ready) { revealAccess(); announce('Voice is awaiting private service configuration. Navigation and notes remain available.'); return; }
  if (!conversation.getState().authorized) { revealAccess(); return; }
  if (state.mode === 'media') await conversation.resumeVoice(); else await conversation.startVoice();
}
async function refreshSelection(ids = selectedIds) {
  const previousContext = sharedContext;
  sharedContext = [];
  selectedIds = [...ids];
  if (!memory) return;
  const version = ++providerContextRevision;
  if (previousContext.length) await conversation.revokeContext();
  if (version !== providerContextRevision) return;
  try {
    const selected = await memory.selectContext(ids);
    if (version !== providerContextRevision) return;
    const changed = JSON.stringify(previousContext) !== JSON.stringify(selected.records);
    sharedContext = selected.records;
    dispatch({ type: 'memory', consentEpoch: selected.consentEpoch, revision: selected.revision });
    if (changed && !previousContext.length && conversation.getState().voice !== 'idle') {
      await conversation.revokeContext(); notice('Saved-note context changed. Your microphone is stopped; choose Speak to start with the current selection.');
    }
  } catch (error) { if (version !== providerContextRevision) return; sharedContext = []; showError(error); }
}
function renderMemory(dataset) {
  $('memory-consent').checked = dataset.consent.storageEnabled;
  $('memory-share-consent').checked = dataset.consent.conversationUseEnabled;
  $('memory-share-consent').disabled = !dataset.consent.storageEnabled;
  $('memory-status').textContent = dataset.consent.storageEnabled ? `${dataset.nodes.length} saved notes and ${dataset.edges.length} connections on this device. ${dataset.consent.conversationUseEnabled ? 'Choose which notes to share with the AI.' : 'Saved notes are not included in conversation.'}` : 'Remembering is off. You can explore without saving.';
  const geometry = $('constellation-geometry'); geometry.replaceChildren();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 640 260'); svg.setAttribute('focusable', 'false');
  const positions = new Map();
  for (const node of dataset.nodes) {
    let hash = 2166136261; for (const ch of node.id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
    const x = 26 + hash % 586, y = 24 + (hash >>> 10) % 210; positions.set(node.id, [x, y]);
  }
  for (const edge of dataset.edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to); if (!a || !b) continue;
    const line = document.createElementNS(svg.namespaceURI, 'line');
    for (const [name, value] of Object.entries({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) line.setAttribute(name, value);
    line.setAttribute('stroke', '#8b7658'); line.setAttribute('stroke-width', '1'); svg.append(line);
  }
  for (const node of dataset.nodes) {
    const [x, y] = positions.get(node.id); const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', node.status === 'active' ? '5' : '3');
    circle.setAttribute('fill', node.status === 'archived' ? '#a99b83' : '#514733'); svg.append(circle);
  }
  geometry.append(svg); geometry.hidden = dataset.nodes.length === 0;
}
async function setupMemory() {
  try {
    memory = createMemoryStore({
      onChange(dataset, info) {
        // Never stamp old selected text with a new persisted revision.
        const hadSharedContext = sharedContext.length > 0;
        sharedContext = []; providerContextRevision++;
        if (!info.initial && hadSharedContext) {
          executor.cancel(); memoryController?.invalidate(); conversation.revokeContext().catch(showError);
        }
        dispatch({ type: 'memory', consentEpoch: dataset.consentEpoch, revision: dataset.revision }); renderMemory(dataset);
        if (!info.initial) refreshSelection().catch(showError);
      },
      onRevoke() {
        sharedContext = []; executor.cancel(); memoryController?.invalidate();
        conversation.revokeContext().catch(showError);
      },
    });
    const dataset = await memory.load(); renderMemory(dataset);
    memoryController = createMemoryController({ store: memory, onPendingChange(proposal) { memoryView?.setProposal(proposal); } });
    memoryView = mountMemoryView($('constellation-list'), { store: memory, controller: memoryController,
      proposalsContainer: $('memory-proposals'), onSelectionChange: ids => refreshSelection(ids) });
    await memoryView.refresh();
  } catch (error) {
    memory = null; $('memory-status').textContent = 'This browser could not open device storage. Nothing will be saved.';
    for (const id of ['memory-consent', 'memory-share-consent', 'memory-revoke', 'memory-clear']) $(id).disabled = true;
  }
}
async function changeConsent() {
  if (!memory) return;
  const current = await memory.load();
  const storageEnabled = $('memory-consent').checked;
  if (!storageEnabled && current.nodes.length && !window.confirm('Turn remembering off and delete the notes stored on this device?')) { renderMemory(current); return; }
  const next = await memory.setConsent({ storageEnabled, conversationUseEnabled: storageEnabled && $('memory-share-consent').checked }, { consentEpoch: current.consentEpoch, revision: current.revision });
  renderMemory(next); await refreshSelection();
}
document.addEventListener('click', event => {
  const element = event.target.closest?.('[data-navigate]');
  if (!element || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigateFromUser(element.dataset.navigate).catch(showError);
});
for (const element of document.querySelectorAll('[data-focus-world]')) element.addEventListener('click', () => {
  if (exiting) return; pauseForUserControl(); focus(element.dataset.focusWorld);
});
$('voice-start').addEventListener('click', () => startVoice().catch(showError));
$('resume-button').addEventListener('click', () => startVoice().catch(showError));
$('stop-button').addEventListener('click', guarded(async () => {
  interruptLocalWork();
  await Promise.allSettled([conversation.stop(), earth.cancelActions()]); announce('Microphone and speaking stopped.');
}));
$('text-toggle').addEventListener('click', () => { $('intention-input').focus(); $('conversation').scrollIntoView({ behavior: 'auto', block: 'nearest' }); });
$('correct-interpretation').addEventListener('click', guarded(async () => {
  interruptLocalWork(); dispatch({ type: 'correct-reflection' }); await conversation.stop();
  notice('That interpretation has been withdrawn. Tell me how you would describe it.'); $('intention-input').focus();
}));
$('intention-form').addEventListener('submit', guarded(async event => {
  event.preventDefault(); const message = $('intention-input').value.trim(); if (!message) return;
  interruptLocalWork();
  earth.cancelActions().catch(() => {});
  if (new TextEncoder().encode(message).length > 8192) { showError(new Error('Please keep this message within 8 KB.')); return; }
  const tool = parseLocalIntention(message);
  if (tool) {
    pauseForUserControl();
    $('intention-input').value = ''; transcript({ id: crypto.randomUUID(), role: 'user', text: message });
    const result = await executor.execute(localRequest(tool)); if (result.status === 'applied' || result.status === 'noop') notice(result.message);
    return;
  }
  const directMemory = /^remember(?: that)?\s+([\s\S]+)$/i.exec(message);
  if (directMemory && memory) {
    pauseForUserControl();
    const saving = new AbortController(); directSaveControllers.add(saving);
    try {
      const dataset = await memory.load();
      if (saving.signal.aborted) return;
      if (dataset.consent.storageEnabled) {
        const text = directMemory[1].trim();
        if ([...text].length > 1200) { showError(new Error('A saved note can contain up to 1,200 characters.')); return; }
        await memory.commitProposal({ operation: 'create_node', kind: 'insight', title: [...text].slice(0, 120).join(''), text },
          { consentEpoch: dataset.consentEpoch, revision: dataset.revision, authorship: 'user', signal: saving.signal });
        if ($('intention-input').value.trim() === message) $('intention-input').value = '';
        transcript({ id: crypto.randomUUID(), role: 'user', text: message }); notice('Saved your exact note on this device.'); return;
      }
    } catch (error) { if (!saving.signal.aborted) showError(error); return; }
    finally { directSaveControllers.delete(saving); }
  }
  if (!serviceStatus?.ready || !conversation.getState().authorized) {
    revealAccess(); announce('AI conversation needs a private invitation and an available service. You can use the visible navigation, or write “Open Earth”.'); return;
  }
  $('intention-input').value = ''; $('send-button').disabled = true;
  try {
    const result = await conversation.sendText(message);
    if (['cancelled', 'incomplete', 'blocked'].includes(result?.status) && !$('intention-input').value) $('intention-input').value = message;
  } catch (error) { if (!$('intention-input').value) $('intention-input').value = message; showError(error); }
  finally { $('send-button').disabled = false; }
}));
$('access-form').addEventListener('submit', async event => {
  event.preventDefault(); const invite = $('access-invite').value; $('access-invite').value = '';
  try { await conversation.access(invite); $('access-panel').hidden = true; notice('Private conversation is ready. Choose Speak or write your question.'); }
  catch (error) { $('access-status').textContent = error.message; }
});
for (const id of ['memory-consent', 'memory-share-consent']) $(id).addEventListener('change', () => changeConsent().catch(showError));
$('memory-revoke').addEventListener('click', guarded(async () => { $('memory-consent').checked = false; $('memory-share-consent').checked = false; await changeConsent(); }));
$('memory-clear').addEventListener('click', guarded(async () => {
  if (!memory || !window.confirm('Delete all saved notes and connections on this device? This cannot be undone.')) return;
  memoryController?.invalidate(); executor.cancel();
  // This confirmed command means all records, including a concurrently completed old-epoch write.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await memory.load();
    try { await memory.clear({ consentEpoch: current.consentEpoch, revision: current.revision }); break; }
    catch (error) { if (error.code !== 'STALE_STATE' || attempt === 2) throw error; }
  }
  selectedIds = []; sharedContext = []; await memoryView.refresh();
}));
$('clear-transcript').addEventListener('click', guarded(async () => {
  executor.cancel(); memoryController?.invalidate(); await conversation.clearConversation(); transcriptEntries.clear(); $('transcript').replaceChildren();
  notice('Conversation cleared for this visit. Saved notes are unchanged.');
}));
$('earth-retry').addEventListener('click', () => navigateFromUser('earth').catch(showError));
$('earth-fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { notice('Fullscreen is unavailable here. You can use Earth at its current size or open it separately.'); }
});
document.addEventListener('fullscreenchange', () => { $('earth-fullscreen').textContent = document.fullscreenElement ? 'Leave fullscreen' : 'Expand Earth'; });
$('exit-link').addEventListener('click', guarded(async event => {
  event.preventDefault(); exiting = true; interruptLocalWork(); dispatch({ type: 'visible', visible: false }); await conversation.exit();
  await earth.suspend(state.routeEpoch + 1, 'exit'); memoryView?.close(); memory?.close(); scene.dispose(); location.href = '../';
}));
$('earth-fallback').addEventListener('click', () => { pauseForUserControl(); earth.quiet().catch(() => {}); });
window.addEventListener('popstate', () => {
  const destination = new URL(location.href).searchParams.get('view') || 'unity';
  navigateFromUser(destination, { back: true, replace: true }).then(answer => { if (!answer) setUrl(state.destination, true); }).catch(error => { setUrl(state.destination, true); showError(error); });
});
document.addEventListener('visibilitychange', async () => {
  dispatch({ type: 'visible', visible: !document.hidden });
  if (document.hidden) {
    interruptLocalWork();
    await Promise.allSettled([conversation.stop(), earth.cancelActions(), earth.quiet()]);
  } else if (state.destination === 'earth' && !earth.getState().active) navigate('earth', { replace: true }).catch(showError);
});
window.addEventListener('pagehide', () => { interruptLocalWork(); conversation.exit().catch(() => {}); earth.close(); memory?.close(); scene.dispose(); });

render(); setupMemory();
conversation.getStatus().then(status => {
  serviceStatus = status;
  dispatch({ type: 'service', status: status.ready ? 'available' : 'unavailable' });
  $('service-status').textContent = status.ready ? 'Private conversation available. Grounded in the published Dream Unity manifesto.' : 'AI conversation is awaiting private service configuration. Explore the views and your own saved notes now.';
}).catch(() => {
  dispatch({ type: 'service', status: 'unavailable' });
  $('service-status').textContent = 'AI conversation could not connect. Explore the views and your own saved notes now.';
});
if (['earth', 'manifesto'].includes(state.destination)) navigate(state.destination, { replace: true }).catch(showError);
