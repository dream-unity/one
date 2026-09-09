import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { BUDGET, FOUNDERS, SCENARIOS, POINTS, edgeKey, edgeCost, cost, validateWorld, validateCommunity, canonicalEdges, reach, report, routeTo, grow, encodeWorld, decodeWorld, signature } from '../portals/dream-world/model.js';

test('founding worlds share fixed conditions and expose a genuine resilience tradeoff',()=>{
  const [a,b]=FOUNDERS.map(validateWorld),ra=report(a.edges),rb=report(b.edges);
  assert.equal(ra.working,9);assert.equal(rb.working,9);
  assert.equal(ra.worst,1);assert.equal(rb.worst,9);assert.equal(ra.resilient,false);assert.equal(rb.resilient,true);
  assert.ok(ra.hops<rb.hops);assert.ok(ra.cost<=BUDGET&&rb.cost<=BUDGET);
  assert.notEqual(ra.cases,rb.cases);assert.deepEqual(POINTS[0],[12,57]);
});
test('all failure cases are enumerated independently and disconnected lights count as dark',()=>{
  for(const world of FOUNDERS){
    const saved=JSON.stringify(world),one=report(world.edges),two=report(world.edges,'double');
    assert.equal(one.cases,world.edges.length);assert.equal(two.cases,world.edges.length*(world.edges.length-1)/2);
    for(const r of [one,two]){
      assert.equal(r.worst,Math.min(...r.trials.map(t=>reach(world.edges,t).lit.length)));
      assert.equal(new Set(r.trials.map(t=>t.removed.map(edgeKey).sort().join(','))).size,r.cases);
    }
    assert.equal(JSON.stringify(world),saved);
  }
  assert.deepEqual(reach([]).lit,[0]);assert.equal(report([]).resilient,false);assert.equal(report([]).cases,0);
  assert.equal(report([[1,2],[3,4],[5,6]]).working,1);
});
test('sleeping island trials exclude the source and adjust the denominator',()=>{
  const a=report(FOUNDERS[0].edges,'island'),b=report(FOUNDERS[1].edges,'island');
  assert.equal(a.cases,8);assert.equal(a.total,8);assert.equal(a.worst,1);assert.equal(b.worst,8);
  for(const t of a.trials){assert.notEqual(t.sleeping,0);assert.ok(!t.lit.includes(t.sleeping));}
  assert.deepEqual(reach(FOUNDERS[0].edges,{sleeping:0}).lit,[]);
});
test('travel uses actual surviving shortest paths and growth improves a computed result',()=>{
  assert.deepEqual(routeTo(FOUNDERS[0].edges,2),[0,4,2]);
  assert.deepEqual(routeTo(FOUNDERS[0].edges,2,{removed:[[0,4]]}),[]);
  const world=validateWorld(FOUNDERS[0]),before=structuredClone(world),next=grow(world);
  assert.ok(next);assert.ok(next.result.worst>report(world.edges).worst);assert.ok(cost(next.edges)<=BUDGET);
  const diff=new Set([...world.edges.map(edgeKey),...next.edges.map(edgeKey)]);
  assert.equal(diff.size,Math.max(world.edges.length,next.edges.length));assert.equal(Math.abs(world.edges.length-next.edges.length),1);
  assert.deepEqual(world,before);assert.deepEqual(grow(world),next);
});
test('world validation bounds data and rejects invalid topology before execution',()=>{
  const base=FOUNDERS[0];
  for(const edges of [[[0,0]],[[0,9]],[[0,1.2]],[[0,'1']],[[0,1],[1,0]],[[0,NaN]],null])assert.throws(()=>validateWorld({...base,edges}));
  assert.throws(()=>validateWorld({...base,version:2}));assert.throws(()=>validateWorld({...base,id:'../bad'}));assert.throws(()=>validateWorld({...base,parents:[base.id]}));assert.throws(()=>validateWorld({...base,name:'x'.repeat(65)}));
  const complete=POINTS.flatMap((_,a)=>POINTS.slice(a+1).map((__,i)=>[a,a+i+1]));assert.ok(cost(complete)>BUDGET);assert.throws(()=>validateWorld({...base,edges:complete}));
  assert.equal(edgeCost([0,1]),edgeCost([1,0]));assert.deepEqual(canonicalEdges([[4,0],[2,1]]),[[0,4],[1,2]]);
  const cleaned=validateWorld({...base,script:'alert(1)',result:{worst:9}});assert.ok(!('script'in cleaned));assert.ok(!('result'in cleaned));
});
test('portable links round-trip Unicode and reject oversized, malformed or versioned payloads',()=>{
  const world=validateWorld({...FOUNDERS[1],name:'Lumière — 世界',idea:'An idea with <tags>, “quotes”, and 🪐.'});
  assert.deepEqual(decodeWorld(encodeWorld(world)),world);
  assert.ok(!/[+/=]/.test(encodeWorld(world)));
  for(const value of ['','%', 'a'.repeat(6001),btoa('{not json}'),btoa(JSON.stringify({version:99}))])assert.throws(()=>decodeWorld(value));
});
test('community designs require a public source and never masquerade as founders',()=>{
  const communityWorld={...FOUNDERS[0],id:'submission-10',parents:['one-centre'],origin:'community',issue:10};
  assert.equal(validateCommunity({version:1,worlds:[communityWorld]}).worlds.length,1);
  assert.throws(()=>validateCommunity({version:1,worlds:[FOUNDERS[0]]}));
  assert.throws(()=>validateCommunity({version:1,worlds:[{...communityWorld,issue:0}]}));
  assert.throws(()=>validateCommunity({version:1,worlds:[communityWorld,communityWorld]}));
  assert.equal(signature({...FOUNDERS[0],name:'Other name'}),signature(FOUNDERS[0]));
});
test('world entrypoints, same-origin assets and existing Dream World integration resolve',async()=>{
  const root=new URL('../portals/dream-world/',import.meta.url),html=await readFile(new URL('index.html',root),'utf8'),app=await readFile(new URL('app.js',root),'utf8');
  for(const match of html.matchAll(/(?:href|src)="(\.{1,2}\/[^"#]+)"/g)) {
    const target=new URL(match[1].split(/[?#]/)[0],root);await access(target.pathname.endsWith('/')?new URL('index.html',target):target);
  }
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const match of app.matchAll(/\$\('#([a-z-]+)'\)/g))assert.ok(ids.has(match[1]),`Missing static element: ${match[1]}`);
  assert.match(html,/connect-src 'self'/);assert.doesNotMatch(`${html}\n${app}`,/OPENAI_API_KEY|sk-proj-|eval\(|new Function/);
  const nav=await readFile(new URL('../portal-subnav.js',import.meta.url),'utf8');assert.match(nav,/\.\/portals\/dream-world\//);assert.match(nav,/observatory\.hidden = world !== "world"/);
  const atlas=validateCommunity(JSON.parse(await readFile(new URL('community.json',root),'utf8')));assert.ok(Array.isArray(atlas.worlds));
});
