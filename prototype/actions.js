import { schemas } from './wire-contracts.js';
import { assertValid, validate } from './validate.js';

const clone = value => JSON.parse(JSON.stringify(value));
// JSON object member order is not part of an operation's identity.
const canonical = value => value && typeof value === 'object'
  ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  : JSON.stringify(value);
const MAX_VISIT_ACTIONS = 4096;
const failureCode = error => typeof error?.code === 'string' && error.code.length > 0 && error.code.length <= 80
  ? error.code : 'ACTION_FAILED';
export function observedView(state) {
  return { destination: state.destination, worldFocus: state.worldFocus,
    earth: state.destination === 'earth' ? { globe: state.earth?.globe || 'not-started',
      restore: state.earth?.restore || 'none', mediaMode: state.mode } : null };
}

/** The model proposes an operation. This controller verifies authority and reports its real outcome. */
export function createActionExecutor({ getState, navigate, focus, reflect, earth, proposeMemory,
  onResult = () => {}, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout }) {
  const requests = new Map();
  const running = new Set();
  let cancellationEpoch = 0;
  function receipt(request, status, code, message) {
    return assertValid(schemas.actionResult, { version: 1, requestId: request.requestId,
      routeEpoch: request.routeEpoch, status, code, message: String(message).slice(0, 400),
      observedState: observedView(getState()) });
  }
  async function execute(value, { signal, source = 'local' } = {}) {
    assertValid(schemas.actionRequest, value);
    const request = clone(value), fingerprint = canonical(request);
    if (requests.has(request.requestId)) {
      const owned = requests.get(request.requestId);
      if (owned.fingerprint !== fingerprint) return receipt(request, 'rejected', 'REQUEST_ID_REUSE', 'This request ID belongs to a different operation.');
      return clone(await owned.promise);
    }
    // Retain every admitted identity for this visit. Evicting an old completion
    // would turn its delayed retry into a second effect at unchanged epochs.
    if (requests.size >= MAX_VISIT_ACTIONS) {
      return receipt(request, 'blocked', 'VISIT_ACTION_LIMIT', 'This visit has reached its operation limit. Reload the page to start a fresh visit.');
    }
    if ([...requests.values()].filter(item => !item.complete).length >= 128) {
      return receipt(request, 'blocked', 'ACTION_LIMIT', 'Too many operations are pending. Stop them before starting another.');
    }
    // Reserve ownership before calling any consumer, including a synchronous one.
    const owned = { fingerprint, promise: null, complete: false };
    const ownerEpoch = cancellationEpoch;
    owned.promise = Promise.resolve().then(() => run(request, { signal, source, ownerEpoch }));
    requests.set(request.requestId, owned);
    const result = await owned.promise;
    owned.complete = true;
    try { onResult(request, clone(result)); } catch { /* Reporting cannot change an observed receipt. */ }
    return clone(result);
  }
  async function run(request, { signal, ownerEpoch }) {
    const current = getState();
    if (!current.visible) return receipt(request, 'blocked', 'VIEW_INACTIVE', 'The page is inactive. Return before performing an action.');
    if (signal?.aborted || ownerEpoch !== cancellationEpoch) return receipt(request, 'cancelled', 'CANCELLED', 'The operation was cancelled.');
    const permissionsMatch = () => request.consentEpoch === getState().consentEpoch && request.memoryRevision === getState().memoryRevision;
    if (request.routeEpoch !== current.routeEpoch || !permissionsMatch()) {
      return receipt(request, 'superseded', 'STALE_AUTHORITY', 'The view or memory permission changed before this operation.');
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    running.add(controller);
    const tool = request.tool;
    const navigating = tool.name === 'navigate' || tool.name === 'return_to_previous';
    const destination = tool.name === 'navigate' ? tool.args.destination : current.history.at(-1) || 'unity';
    const deadline = (navigating && destination === 'earth') || tool.name.startsWith('earth_fly') ? 30000 : 5000;
    const timer = setTimer(abort, deadline);
    let earthDispatched = false;
    const stillOwned = () => {
      const live = getState();
      return !controller.signal.aborted && live.visible && permissionsMatch() && (navigating
        ? live.destination === destination && [request.routeEpoch, request.routeEpoch + 1].includes(live.routeEpoch)
          && [current.turnEpoch, current.turnEpoch + 1].includes(live.turnEpoch)
        : live.routeEpoch === request.routeEpoch && live.turnEpoch === current.turnEpoch);
    };
    const superseded = () => receipt(request, 'superseded', 'STALE_AUTHORITY', 'The view, turn or memory permission changed during this operation.');
    function waitFor(operation) {
      // Even a non-cooperating consumer cannot leave Stop or a deadline waiting forever.
      let cancel;
      const cancelled = new Promise((_, reject) => {
        cancel = () => reject(Object.assign(new Error('Operation cancelled.'), { code: 'ACTION_ABORTED' }));
        controller.signal.addEventListener('abort', cancel, { once: true });
        if (controller.signal.aborted) cancel();
      });
      return Promise.race([Promise.resolve(operation), cancelled])
        .finally(() => controller.signal.removeEventListener('abort', cancel));
    }
    try {
      let answer;
      switch (tool.name) {
        case 'navigate':
        case 'return_to_previous':
          answer = await waitFor(navigate(destination, { back: tool.name === 'return_to_previous', signal: controller.signal }));
          if (!answer) return receipt(request, 'cancelled', 'NAVIGATION_CANCELLED', 'Opening this view stopped. The displayed view shows the current state.');
          if (!stillOwned()) return superseded();
          return receipt(request, 'applied', 'VIEW_OPENED', getState().destination === 'earth' && getState().earth?.globe === 'failed'
            ? 'Earth’s feed directories opened; the globe is unavailable.'
            : `${tool.name === 'return_to_previous' ? 'Returned to' : 'Opened'} ${answer.title}.`);
        case 'focus_world':
          focus(tool.args.world);
          if (!stillOwned()) return superseded();
          if (getState().worldFocus !== tool.args.world) return receipt(request, 'failed', 'FOCUS_UNCONFIRMED', 'The requested focus could not be observed.');
          return receipt(request, 'applied', 'WORLD_FOCUSED', `Focused the meaning of Dream ${tool.args.world}. Activities retain their current access status.`);
        case 'set_scene_reflection':
          reflect(tool.args.worlds, tool.args.summary);
          if (!stillOwned()) return superseded();
          if (JSON.stringify(getState().reflection?.worlds) !== JSON.stringify(tool.args.worlds) || getState().reflection?.summary !== tool.args.summary) return receipt(request, 'failed', 'REFLECTION_UNCONFIRMED', 'The requested interpretation could not be observed.');
          return receipt(request, 'applied', 'PROVISIONAL_REFLECTION', 'Displayed a possible interpretation. It can be corrected or dismissed.');
        case 'propose_memory':
          answer = await waitFor(proposeMemory(tool.args.proposal, request, { signal: controller.signal }));
          if (!stillOwned()) return superseded();
          if (!answer || !validate({ type: 'string', format: 'uuid' }, answer.proposalId).valid
            || answer.turnId !== request.turnId || answer.consentEpoch !== request.consentEpoch
            || answer.revision !== request.memoryRevision || canonical(answer.proposal) !== canonical(tool.args.proposal)) {
            return receipt(request, 'failed', 'MEMORY_PROPOSAL_UNCONFIRMED', 'The exact memory proposal could not be observed. Nothing has been confirmed as saved.');
          }
          return receipt(request, 'applied', 'MEMORY_PROPOSED', 'A precise memory proposal is awaiting local user confirmation. Nothing has been saved by this proposal.');
        case 'lookup_knowledge':
          return receipt(request, 'blocked', 'SERVICE_LOOKUP_REQUIRED', 'Source lookup is owned by the authenticated conversation service.');
        default:
          if (!tool.name.startsWith('earth_')) return receipt(request, 'rejected', 'UNKNOWN_ACTION', 'This operation is unavailable.');
          if (current.destination !== 'earth') return receipt(request, 'blocked', 'OPEN_EARTH_FIRST', 'Open Earth before using its controls.');
          earthDispatched = true;
          answer = await waitFor(earth.command(tool, request.turnId, { signal: controller.signal }));
          if (!stillOwned()) return superseded();
          return receipt(request, answer.status, answer.code, answer.message);
      }
    } catch (error) {
      if (error?.code === 'ACTION_OUTCOME_UNKNOWN' || controller.signal.aborted && earthDispatched) {
        return receipt(request, 'unknown', 'ACTION_OUTCOME_UNKNOWN', error?.code === 'ACTION_OUTCOME_UNKNOWN' ? error.message
          : 'Earth was interrupted. Its final effect is unconfirmed; read the current view before repeating the action.');
      }
      if (controller.signal.aborted) return receipt(request, 'cancelled', 'CANCELLED', 'This operation stopped or timed out. The displayed view shows the current state.');
      if (!stillOwned() && !navigating) return superseded();
      return receipt(request, 'failed', failureCode(error), typeof error?.message === 'string' ? error.message : 'The requested effect could not be verified.');
    } finally {
      clearTimer(timer); running.delete(controller); signal?.removeEventListener('abort', abort);
    }
  }
  return { execute, cancel() { cancellationEpoch++; for (const controller of running) controller.abort(); } };
}
