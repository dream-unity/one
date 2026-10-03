export const DESTINATIONS = Object.freeze({
  unity: { title: 'Dream Unity' },
  manifesto: { title: 'The manifesto' },
  'dream-world': { title: 'Dream World' },
  earth: { title: 'God’s Earth View' },
  'minds-eye': { title: 'God’s Minds Eye View' },
  constellation: { title: 'My constellation' },
});
export const WORLDS = Object.freeze(['machine', 'maker', 'world']);

export function initialState(destination = 'unity') {
  return Object.freeze({
    destination: Object.hasOwn(DESTINATIONS, destination) ? destination : 'unity',
    history: [], routeEpoch: 0, turnEpoch: 0, consentEpoch: 0, memoryRevision: 0,
    worldFocus: null, reflection: null, microphone: 'inactive', mode: 'conversation',
    service: 'checking', earth: null, visible: true,
  });
}

export function reduceState(state, event) {
  switch (event.type) {
    case 'navigate': {
      if (!Object.hasOwn(DESTINATIONS, event.destination)) throw new Error('Destination unavailable');
      if (event.destination === state.destination) return state;
      return Object.freeze({ ...state, destination: event.destination,
        history: event.back ? state.history.slice(0, -1) : [...state.history, state.destination].slice(-24),
        routeEpoch: state.routeEpoch + 1, turnEpoch: state.turnEpoch + 1,
        earth: event.destination === 'earth' ? { globe: 'loading', restore: 'none', mediaMode: state.mode } : state.earth });
    }
    case 'focus': {
      if (!WORLDS.includes(event.world)) throw new Error('Unknown world');
      return Object.freeze({ ...state, worldFocus: event.world, reflection: null });
    }
    case 'reflection':
      return Object.freeze({ ...state, reflection: { worlds: [...event.worlds], summary: event.summary, provisional: true } });
    case 'correct-reflection':
      return Object.freeze({ ...state, reflection: null, turnEpoch: state.turnEpoch + 1 });
    case 'memory':
      return Object.freeze({ ...state, consentEpoch: event.consentEpoch, memoryRevision: event.revision,
        turnEpoch: state.turnEpoch + (event.revoke ? 1 : 0) });
    case 'mode':
      if (!['conversation', 'media'].includes(event.mode)) throw new Error('Unknown input mode');
      return Object.freeze({ ...state, mode: event.mode,
        microphone: event.mode === 'media' ? 'inactive' : state.microphone });
    case 'voice': return Object.freeze({ ...state, microphone: event.status });
    case 'service': return Object.freeze({ ...state, service: event.status });
    case 'earth': return Object.freeze({ ...state, earth: event.readiness });
    case 'visible': return Object.freeze({ ...state, visible: event.visible,
      microphone: event.visible ? state.microphone : 'inactive', turnEpoch: state.turnEpoch + 1 });
    case 'interrupt': return Object.freeze({ ...state, turnEpoch: state.turnEpoch + 1 });
    default: throw new Error('Unknown state transition');
  }
}

export function parseLocalIntention(text) {
  const command = String(text).trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  if (/^return to (unity|home)$/.test(command)) return { name: 'navigate', args: { destination: 'unity' } };
  if (/^(go )?back$|^return$/.test(command)) return { name: 'return_to_previous', args: {} };
  const named = [
    ['earth', '(?:god[’\x27]?s )?earth(?: view)?'],
    ['manifesto', '(?:the )?manifesto'],
    ['dream-world', 'dream world'], ['unity', '(?:dream )?unity|home'],
    ['constellation', '(?:my )?constellation|(?:my )?saved (?:notes|memories)'],
    ['minds-eye', '(?:god[’\x27]?s )?mind[’\x27]?s eye(?: view)?'],
  ];
  for (const [destination, label] of named) {
    if (new RegExp(`^(?:open|show|visit|go to|take me to) (?:${label})$`).test(command)) {
      return { name: 'navigate', args: { destination } };
    }
  }
  for (const world of WORLDS) {
    if (command === `focus ${world}` || command === `focus dream ${world}`) return { name: 'focus_world', args: { world } };
  }
  for (const world of ['machine', 'maker']) {
    if (new RegExp(`^(?:open|show|visit|go to|take me to) dream ${world}$`).test(command)) {
      return { name: 'focus_world', args: { world } };
    }
  }
  return null;
}
