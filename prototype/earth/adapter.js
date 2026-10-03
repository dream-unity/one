import { schemas } from '../contracts.js';
import { validate } from '../validate.js';

export const EARTH_ORIGIN = 'https://november-1st-sable.vercel.app';
const CHILD_KINDS = new Set(['HELLO', 'READY', 'FAILED', 'RESULT', 'ACK', 'SNAPSHOT',
  'MEDIA_FOCUS_REQUEST', 'QUIET_ACK', 'STATUS', 'REQUEST_HOME']);
const EMPTY_READY = { app: 'waiting', globe: 'not-started', restore: 'none', providers: [] };

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function failure(code, message) { return Object.assign(new Error(message), { code }); }

/** All child state is operational data. No credentials, dialogue or saved notes enter this port. */
export function createEarthAdapter({ host, onState = () => {}, onMedia = async () => false,
  onHome = () => {}, window: win = globalThis.window, origin = EARTH_ORIGIN,
  frameFactory = () => win.document.createElement('iframe'), uuid = () => crypto.randomUUID() } = {}) {
  const frameUrl = new URL('/embed/', origin);
  if (frameUrl.origin !== EARTH_ORIGIN && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(frameUrl.origin)) {
    throw new Error('Unapproved Earth origin');
  }
  let frame = null, bridgeId = null, epoch = 0, active = false, capabilities = null;
  let readiness = { ...EMPTY_READY }, snapshot = null, opening = null;
  let intakeStart = 0, intakeCount = 0;
  const pending = new Map();
  const completedMedia = new Set();

  function report() { onState({ ...readiness, capabilities, active, snapshot }); }
  function post(kind, payload = {}, requestId = uuid()) {
    if (!frame?.contentWindow || !bridgeId) throw failure('EARTH_NOT_READY', 'Earth is not connected.');
    const message = { channel: 'dream-unity:earth', version: 1, bridgeId, epoch, requestId, kind, payload };
    const checked = validate(schemas.earthBridge, message);
    if (!checked.valid) throw failure('INVALID_BRIDGE_MESSAGE', 'Earth command could not be validated.');
    frame.contentWindow.postMessage(message, frameUrl.origin);
    return requestId;
  }
  function request(kind, payload, timeout = 5000, { signal } = {}) {
    const requestId = uuid();
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(failure('CANCELLED', 'Action cancelled.'));
      let settled = false, cancelling = false, dispatched = false;
      const cancelAndFinish = async (code, message) => {
        if (settled || cancelling) return;
        cancelling = true;
        if (kind === 'COMMAND' && dispatched) {
          let acknowledged = false;
          try { const ack = await request('CANCEL', { commandRequestId: requestId }, 2000); acknowledged = ack.forKind === 'CANCEL'; } catch {}
          // The abort barrier prevents future old work, but cannot undo an already applied effect.
          if (!settled) finish(failure('ACTION_OUTCOME_UNKNOWN', acknowledged
            ? 'Earth stopped pending work; the final effect of this interrupted action is unconfirmed.'
            : 'Earth action outcome and cancellation could not be confirmed. Do not repeat it blindly.'));
        } else finish(failure(code, message));
      };
      const timer = setTimeout(() => cancelAndFinish('EARTH_TIMEOUT', 'Earth did not acknowledge this action.'), timeout);
      const abort = () => cancelAndFinish('CANCELLED', 'Action cancellation requested.');
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(requestId);
        error ? reject(error) : resolve(value);
      }
      pending.set(requestId, { epoch, kind, finish });
      signal?.addEventListener('abort', abort, { once: true });
      try { post(kind, payload, requestId); dispatched = true; } catch (error) { finish(error); }
    });
  }
  function rejectPending(code = 'SUPERSEDED') {
    for (const item of [...pending.values()]) item.finish(failure(code, 'Earth action no longer belongs to the current view.'));
  }
  function timeoutPromise(promise, ms, code) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(failure(code, 'Earth is taking too long to connect.')), ms); })])
      .finally(() => clearTimeout(timer));
  }
  async function receive(event) {
    if (!frame || event.origin !== frameUrl.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    let size;
    try { size = new TextEncoder().encode(JSON.stringify(data)).length; } catch { return; }
    const now = Date.now();
    if (now - intakeStart >= 1000) { intakeStart = now; intakeCount = 0; }
    if (++intakeCount > 30 || size > 32768 || !validate(schemas.earthBridge, data).valid) return;
    if (!CHILD_KINDS.has(data.kind) || data.bridgeId !== bridgeId || data.epoch !== epoch) return;
    if (data.kind === 'HELLO') { capabilities = data.payload.capabilities; opening?.hello.resolve(data.payload); report(); return; }
    if (data.kind === 'READY' || data.kind === 'STATUS') {
      readiness = data.payload; report();
      if (opening?.phase === 'ready' && readiness.app === 'ready' && readiness.restore !== 'pending') opening.ready.resolve(readiness);
      if (readiness.app === 'failed') opening?.ready.reject(failure('EARTH_START_FAILED', 'Earth could not start.'));
      return;
    }
    if (data.kind === 'FAILED') {
      opening?.ready.reject(failure(data.payload.code, data.payload.message));
      const waiter = pending.get(data.requestId); waiter?.finish(failure(data.payload.code, data.payload.message));
      return;
    }
    if (data.kind === 'MEDIA_FOCUS_REQUEST') {
      if (!active) return;
      const requestBridge = bridgeId, requestEpoch = epoch;
      try {
        const stopped = await onMedia(data.payload.reason);
        if (stopped !== true || requestBridge !== bridgeId || requestEpoch !== epoch || !active) return;
        if (completedMedia.size >= 64) completedMedia.clear();
        completedMedia.add(data.requestId);
        post('MEDIA_FOCUS_GRANTED', { captureStopped: true, outputStopped: true }, data.requestId);
      } catch { /* A failed preflight grants no playback authority. */ }
      return;
    }
    if (data.kind === 'REQUEST_HOME') { if (active) onHome(); return; }
    if (data.kind === 'SNAPSHOT') snapshot = data.payload.snapshot;
    const waiter = pending.get(data.requestId);
    const matches = waiter && (data.kind === 'RESULT' && waiter.kind === 'COMMAND'
      || data.kind === 'ACK' && data.payload.forKind === waiter.kind
      || data.kind === 'SNAPSHOT' && waiter.kind === 'SNAPSHOT_REQUEST'
      || data.kind === 'QUIET_ACK' && waiter.kind === 'QUIET_REQUEST');
    if (matches && waiter.epoch === epoch) waiter.finish(null, data.payload);
  }
  win.addEventListener('message', receive);

  function clearOpening(owner) {
    clearInterval(owner.retry);
    owner.signal?.removeEventListener('abort', owner.abort);
  }
  function ownsFrame(owner) {
    return frame === owner.frame && bridgeId === owner.bridgeId && epoch === owner.epoch;
  }
  function open(nextEpoch, { signal } = {}) {
    if (!Number.isSafeInteger(nextEpoch) || nextEpoch < 0) return Promise.reject(failure('INVALID_EPOCH', 'Earth needs a valid navigation epoch.'));
    if (signal?.aborted) return Promise.reject(failure('CANCELLED', 'Earth opening cancelled.'));
    if (nextEpoch < epoch) return Promise.reject(failure('SUPERSEDED', 'Earth opening belongs to an older view.'));
    // Only the same live owner can share work. A different signal is a new intent.
    if (opening && !opening.cancelled && opening.epoch === nextEpoch && opening.signal === signal) return opening.promise;
    if (!opening && active && frame && nextEpoch === epoch && readiness.app === 'ready') return Promise.resolve(readiness);
    if (frame) destroyFrame();
    const owner = { epoch: nextEpoch, bridgeId: uuid(), frame: null, signal,
      hello: deferred(), ready: deferred(), phase: 'hello', cancelled: false,
      settled: false, abort: null, retry: null, promise: null };
    // Readiness can be rejected before its phase begins; never leave an unhandled waiter.
    owner.hello.promise.catch(() => {}); owner.ready.promise.catch(() => {});
    opening = owner;
    owner.abort = () => {
      if (owner.settled || owner.cancelled) return;
      owner.cancelled = true; clearOpening(owner);
      const error = failure('CANCELLED', 'Earth opening cancelled.');
      owner.hello.reject(error); owner.ready.reject(error);
      if (ownsFrame(owner)) { destroyFrame(owner.frame); readiness = { ...EMPTY_READY }; report(); }
      else if (opening === owner) opening = null;
    };
    signal?.addEventListener('abort', owner.abort, { once: true });
    const outcome = deferred();
    owner.promise = outcome.promise;
    const work = (async () => {
      epoch = nextEpoch; bridgeId = owner.bridgeId; active = true; capabilities = null;
      readiness = { ...EMPTY_READY };
      owner.frame = frameFactory(); frame = owner.frame;
      frame.title = 'God’s Earth View'; frame.className = 'earth-frame';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      // No fullscreen delegation: parent-wrapper fullscreen keeps Stop, Text and Exit accessible.
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; microphone \'none\'; camera \'none\'; geolocation \'none\'';
      frame.addEventListener('load', () => { if (active && ownsFrame(owner)) { try { post('INIT'); } catch {} } });
      host.replaceChildren(frame); frame.src = frameUrl.href;
      report();
      owner.retry = setInterval(() => { if (active && ownsFrame(owner) && !capabilities) { try { post('INIT'); } catch {} } }, 600);
      try {
        await timeoutPromise(owner.hello.promise, 8000, 'EARTH_HANDSHAKE_TIMEOUT');
        if (owner.cancelled || !active || !ownsFrame(owner)) throw failure('CANCELLED', 'Earth opening cancelled.');
        owner.phase = 'ready';
        post('START', { restore: snapshot });
        const value = await timeoutPromise(owner.ready.promise, 20000, 'EARTH_READY_TIMEOUT');
        if (owner.cancelled || !active || !ownsFrame(owner)) throw failure('SUPERSEDED', 'Earth opening superseded.');
        return value;
      } finally { clearOpening(owner); }
    })().catch(error => {
      // A stale promise owns only its old document, never the replacement frame.
      if (ownsFrame(owner)) { destroyFrame(owner.frame); readiness = { ...EMPTY_READY, app: 'failed' }; report(); }
      throw error;
    }).finally(() => {
      owner.settled = true; clearOpening(owner);
      if (opening === owner) opening = null;
    });
    work.then(outcome.resolve, outcome.reject);
    return owner.promise;
  }
  function destroyFrame(expectedFrame = frame) {
    if (expectedFrame !== frame) return;
    const ownedFrame = frame;
    const owner = opening?.frame === ownedFrame ? opening : null;
    if (owner) {
      owner.cancelled = true; clearOpening(owner);
      owner.hello.reject(failure('CANCELLED', 'Earth closed.'));
      owner.ready.reject(failure('CANCELLED', 'Earth closed.'));
      if (opening === owner) opening = null;
    }
    active = false; rejectPending(); frame = null;
    if (ownedFrame) { ownedFrame.src = 'about:blank'; ownedFrame.remove(); }
    bridgeId = null; capabilities = null;
  }
  async function getSnapshot() {
    if (!active || !capabilities) return snapshot;
    try { const result = await request('SNAPSHOT_REQUEST', {}, 2000); snapshot = result.snapshot; } catch { /* Existing validated snapshot is retained. */ }
    return snapshot;
  }
  async function suspend(nextEpoch, reason = 'route-exit') {
    if (!frame) return;
    const ownedFrame = frame;
    rejectPending(); epoch = Math.max(nextEpoch, epoch + 1); active = false;
    try { await request('SUSPEND', { reason }, 1500); } catch { /* Full disposal still stops every child document owner. */ }
    if (frame === ownedFrame) { destroyFrame(); readiness = { ...EMPTY_READY }; report(); }
  }
  return {
    open, getSnapshot, suspend,
    async cancelActions() {
      if (!active || !frame || !capabilities) return true;
      const owned = [...pending.values()].filter(item => item.kind === 'COMMAND');
      try {
        const result = await request('CANCEL', { commandRequestId: null }, 2000);
        for (const item of owned) item.finish(failure('ACTION_OUTCOME_UNKNOWN', 'Earth stopped pending work; its interrupted action outcome is unconfirmed.'));
        return result.forKind === 'CANCEL';
      }
      catch { return false; }
    },
    getState: () => ({ readiness, capabilities, active, snapshot }),
    async command(tool, turnId, { signal } = {}) {
      if (!active || readiness.app !== 'ready' || !capabilities?.tools.includes(tool.name)) {
        return { status: 'blocked', code: 'EARTH_CAPABILITY_UNAVAILABLE', message: 'This Earth control is not available in the current view.', snapshot };
      }
      return request('COMMAND', { turnId, tool }, tool.name.startsWith('earth_fly') ? 20000 : 5000, { signal });
    },
    async quiet() {
      if (!active || !frame) return true;
      const answer = await request('QUIET_REQUEST', {}, 5000);
      return answer.quiet === true && answer.blockedPlayerCount === 0;
    },
    close() { destroyFrame(); win.removeEventListener('message', receive); },
  };
}
