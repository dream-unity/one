export const portals = [
  { id: 'heart', world: 'machine', name: 'Heart', title: 'Feel from the heart', line: 'Breathe gently. Explore love, gratitude and feeling.', type: 'Guided practice', time: '3 min +', href: '../exercises/heart/', next: 'body' },
  { id: 'body', world: 'machine', name: 'Body', title: 'Move and notice', line: 'Explore an easy movement. Find your own rhythm.', type: 'Movement & rhythm', time: '1–3 min', next: 'perceive' },
  { id: 'perceive', world: 'machine', name: 'Mind · Perceive', title: 'Find the quiet signal', line: 'Look at what is here. How sure are you?', type: 'Observation game', time: '8 rounds', next: 'predict' },
  { id: 'model', world: 'machine', name: 'Mind · Model', title: 'Check a thought', line: 'Build an explanation. Test it against a new clue.', type: 'CBT skills practice', time: '4–12 min', href: '../exercises/cbt/', next: 'intend' },
  { id: 'predict', world: 'machine', name: 'Mind · Predict', title: 'Leave room for surprise', line: 'Make a forecast before the next seed opens.', type: 'Probability game', time: '12 rounds', next: 'intend' },
  { id: 'intend', world: 'maker', name: 'Intend', title: 'Give a wish a first step', line: 'Turn something you want into something you can do.', type: 'Plan builder', time: '2 min', next: 'act' },
  { id: 'act', world: 'maker', name: 'Act', title: 'Guide the light', line: 'Push. Let go. Notice. Steer it home.', type: 'Control game & focus timer', time: '3 levels', next: 'become' },
  { id: 'become', world: 'maker', name: 'Become', title: 'Borrow a way of being', line: 'Imagine a small challenge. Rehearse how you meet it.', type: 'Imagination practice', time: '1–3 min', next: 'structure' },
  { id: 'matter', world: 'world', name: 'Matter', title: 'Catch a falling star', line: 'Change a bounce. Follow where the energy goes.', type: 'Physics playground', time: 'Play freely', next: 'structure' },
  { id: 'structure', world: 'world', name: 'Structure', title: 'Keep the light connected', line: 'Weave a network that can survive a broken link.', type: 'Network game & village', time: 'Play freely', next: 'emerge' },
  { id: 'emerge', world: 'world', name: 'Emerge', title: 'Nobody is in charge', line: 'Give each dot simple rules. Watch a flock appear.', type: 'Paired world experiment', time: '20 seconds / run', next: 'heart' }
];
export const worlds = { machine: 'Dream Machine', maker: 'Dream Maker', world: 'Dream World' };
export const portalUrl = (id, base = new URL('./', import.meta.url)) => {
  const p = portals.find(p => p.id === id);
  return new URL(p?.href || `./${p?.id || ''}/`, base).href;
};
export const plans = [
  { id: 'bridge', title: 'Make a paper bridge', wish: 'Build something', result: 'A paper bridge holds one coin.', step: 'Fold one sheet of paper.', cue: 'When my table is clear', obstacle: 'I have no paper', fallback: 'draw a bridge idea instead', icon: '01' },
  { id: 'pattern', title: 'Learn a new pattern', wish: 'Understand something', result: 'I can draw three shapes from memory.', step: 'Look at one shape, then draw it.', cue: 'When I put my book down', obstacle: 'I forget the shape', fallback: 'look again and try just one line', icon: '02' },
  { id: 'kind', title: 'Make a kind moment', wish: 'Help someone', result: 'I offer one small, useful piece of help.', step: 'Think of one kind thing I could offer.', cue: 'When I finish my next small task', obstacle: 'The person wants space', fallback: 'respect their space and leave the offer open', icon: '03' }
];
