// Dream World, model 1. Pure, bounded graph experiments shared by the page and tests.
export const VERSION = 1;
export const BUDGET = 42;
export const POINTS = Object.freeze([
  [12, 57], [24, 25], [49, 15], [76, 25], [49, 50],
  [88, 57], [73, 83], [47, 88], [23, 80]
].map(Object.freeze));
export const COUNT = POINTS.length;
export const SCENARIOS = Object.freeze({
  bridge: { name: 'One bridge breaks', detail: 'Try every bridge, one at a time. Each trial starts fresh.', denominator: 9 },
  island: { name: 'One island sleeps', detail: 'Try every island except the light source. Its bridges disappear too.', denominator: 8 },
  double: { name: 'Two bridges break', detail: 'Try every pair of bridges. Each trial starts fresh.', denominator: 9 }
});
export const QUESTION = 'Can a world be simple and hard to break?';
export const FOUNDERS = [
  { version: VERSION, id: 'one-centre', name: 'One bright centre', idea: 'A shared centre keeps the journey short. What happens when its bridges break?', edges: [[0,4],[1,4],[2,4],[3,4],[4,5],[4,6],[4,7],[4,8]], parents: [], origin: 'founder', author: 'Dream Unity' },
  { version: VERSION, id: 'many-paths', name: 'A way around', idea: 'A loop gives light another way home. Is the extra journey worth it?', edges: [[0,1],[1,2],[2,3],[3,5],[5,6],[6,7],[7,8],[0,8],[4,7],[2,4]], parents: [], origin: 'founder', author: 'Dream Unity' }
];

export const edgeKey = ([a,b]) => a < b ? `${a}-${b}` : `${b}-${a}`;
export const edgeCost = ([a,b]) => Math.max(1, Math.round(Math.hypot(POINTS[a][0]-POINTS[b][0], POINTS[a][1]-POINTS[b][1]) / 12));
export const cost = edges => edges.reduce((sum, edge) => sum + edgeCost(edge), 0);
export const allEdges = () => POINTS.flatMap((_, a) => POINTS.slice(a+1).map((__, b) => [a, a+b+1]));
export function canonicalEdges(edges) {
  if (!Array.isArray(edges) || edges.length > 36) throw new Error('A world can have at most 36 bridges.');
  const keys = new Set();
  const clean = edges.map(edge => {
    if (!Array.isArray(edge) || edge.length !== 2 || !edge.every(n => Number.isInteger(n) && n >= 0 && n < COUNT) || edge[0] === edge[1]) throw new Error('Each bridge must join two different islands, from 1 to 9.');
    const pair = [...edge].sort((a,b)=>a-b), key = edgeKey(pair);
    if (keys.has(key)) throw new Error('A bridge appears twice.');
    keys.add(key); return pair;
  });
  return clean.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
}
function plain(value, name, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()) || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${name} must be plain text, up to ${max} characters.`);
  return value.trim();
}
export function validateWorld(input) {
  if (!input || input.version !== VERSION) throw new Error('This world uses an unsupported format.');
  const id = plain(input.id, 'World ID', 64);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('The world ID is invalid.');
  const edges = canonicalEdges(input.edges);
  if (cost(edges) > BUDGET) throw new Error(`This world needs more than ${BUDGET} bridge stones.`);
  const parents = input.parents ?? [];
  if (!Array.isArray(parents) || parents.length > 4 || parents.some(p => typeof p !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p))) throw new Error('This world has an invalid family history.');
  if (parents.includes(id)) throw new Error('A world cannot be its own parent.');
  const origin = ['founder','visitor','grown','community'].includes(input.origin) ? input.origin : 'visitor';
  const world = { version: VERSION, id, name: plain(input.name,'Name',64), idea: plain(input.idea,'Idea',320), edges, parents: [...new Set(parents)], origin, author: plain(input.author,'Creator',64,true) };
  if (input.createdAt !== undefined) {
    if (typeof input.createdAt !== 'string' || input.createdAt.length > 32 || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('The creation date is invalid.');
    world.createdAt = input.createdAt;
  }
  if (input.issue !== undefined) {
    if (!Number.isSafeInteger(input.issue) || input.issue < 1) throw new Error('The source submission is invalid.');
    world.issue = input.issue;
  }
  return world;
}

export function reach(edges, { removed = [], sleeping = null } = {}) {
  const blocked = new Set(removed.map(edgeKey));
  const distance = Array(COUNT).fill(null), previous = Array(COUNT).fill(null);
  if (sleeping === 0) return { distance, previous, lit: [] };
  distance[0] = 0; const queue = [0];
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    for (const edge of edges) {
      if (blocked.has(edgeKey(edge)) || edge.includes(sleeping)) continue;
      const next = edge[0] === here ? edge[1] : edge[1] === here ? edge[0] : null;
      if (next !== null && distance[next] === null) { distance[next] = distance[here]+1; previous[next] = here; queue.push(next); }
    }
  }
  return { distance, previous, lit: queue };
}
export function trialsFor(edges, scenario = 'bridge') {
  if (!Object.hasOwn(SCENARIOS,scenario)) throw new Error('Choose a known experiment.');
  if (scenario === 'island') return POINTS.slice(1).map((_, i) => ({ removed: [], sleeping: i+1 }));
  if (scenario === 'double') return edges.flatMap((edge,i) => edges.slice(i+1).map(other=>({ removed:[edge,other], sleeping:null })));
  return edges.map(edge=>({ removed:[edge], sleeping:null }));
}
export function report(edges, scenario = 'bridge') {
  const base = reach(edges), cases = trialsFor(edges,scenario);
  const trials = cases.map(trial => ({ ...trial, ...reach(edges,trial) }));
  const worst = trials.length ? trials.reduce((a,b)=> b.lit.length < a.lit.length ? b : a) : { removed:[], sleeping:null, ...base };
  const total = SCENARIOS[scenario].denominator;
  const average = trials.length ? trials.reduce((sum,t)=>sum+t.lit.length,0)/trials.length : base.lit.length;
  const hops = base.lit.length === COUNT ? base.distance.slice(1).reduce((sum,d)=>sum+d,0)/(COUNT-1) : null;
  return { model: VERSION, scenario, working: base.lit.length, cost: cost(edges), average, worst: worst.lit.length, total, hops, resilient: trials.length > 0 && base.lit.length === COUNT && worst.lit.length === total, cases: trials.length, trial: worst, trials };
}
export function signature(world) { return canonicalEdges(world.edges).map(edgeKey).join(','); }
export function routeTo(edges, island, trial = {}) {
  const { distance, previous } = reach(edges,trial);
  if (distance[island] === null) return [];
  const path = [island];
  while (path[0] !== 0) path.unshift(previous[path[0]]);
  return path;
}
// Search a bounded set of single-bridge additions/removals. This is a transparent
// local rule, not an LLM, and it makes no claim of finding a global optimum.
export function grow(world, scenario = 'bridge') {
  const original = report(world.edges,scenario), existing = new Set(world.edges.map(edgeKey));
  const candidates = [];
  for (const edge of allEdges()) {
    const remove = existing.has(edgeKey(edge));
    const edges = remove ? world.edges.filter(e=>edgeKey(e)!==edgeKey(edge)) : [...world.edges,edge];
    if (!edges.length || cost(edges) > BUDGET) continue;
    const result = report(edges,scenario);
    if (result.working !== COUNT) continue;
    // Preserve the initial connected network, then prefer the most resilient,
    // then average reach, then lowest cost, then shortest journey.
    candidates.push({ edges:canonicalEdges(edges), result, edge, remove });
  }
  const score = (a,b) => b.result.worst-a.result.worst || b.result.average-a.result.average || a.result.cost-b.result.cost || (a.result.hops??99)-(b.result.hops??99);
  candidates.sort(score);
  const best = candidates[0];
  if (!best || (original.working === COUNT && score(best,{result:original}) >= 0)) return null;
  return { ...best, explanation:`${best.remove?'Remove':'Add'} bridge ${best.edge[0]+1}–${best.edge[1]+1}. The worst trial keeps ${best.result.worst} of ${best.result.total} lights on; the world uses ${best.result.cost} stones.`, before:original };
}
export function encodeWorld(world) {
  const data = validateWorld(world);
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeWorld(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('This world link is incomplete or too large.');
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)))); }
  catch { throw new Error('This world link could not be read.'); }
  return validateWorld(parsed);
}
export function validateCommunity(data) {
  if (!data || data.version !== VERSION || !Array.isArray(data.worlds) || data.worlds.length > 100) throw new Error('The shared atlas could not be read.');
  const worlds = data.worlds.map(validateWorld), ids = new Set(FOUNDERS.map(w=>w.id));
  for (const world of worlds) {
    if (ids.has(world.id)) throw new Error('The atlas contains a repeated world ID.');
    if (world.origin !== 'community' || !world.issue) throw new Error('A shared world must name its source submission.');
    ids.add(world.id);
  }
  return { version:VERSION, worlds, updatedAt:typeof data.updatedAt === 'string' ? data.updatedAt.slice(0,32) : null };
}
