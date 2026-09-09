import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateWorld, validateCommunity, report, FOUNDERS, VERSION, BUDGET, signature } from '../portals/dream-world/model.js';

// Optional input is a local UTF-8 JSON world. Never imports or executes submission code.
const input = process.argv[2];
if (input) {
  const content = await readFile(input,'utf8');
  if(content.length>10000)throw new Error('Submitted design exceeds 10 KB.');
  const world=validateWorld(JSON.parse(content));
  console.log(JSON.stringify({world,signature:signature(world),results:Object.fromEntries(['bridge','island','double'].map(s=>{const r=report(world.edges,s);return [s,{working:r.working,worst:r.worst,total:r.total,cost:r.cost,cases:r.cases,hops:r.hops,resilient:r.resilient}];}))},null,2));
} else {
  const root=new URL('../portals/dream-world/',import.meta.url);
  const content=await readFile(new URL('community.json',root),'utf8');
  if(content.length>200000)throw new Error('Shared atlas exceeds 200 KB.');
  const community=validateCommunity(JSON.parse(content));
  const ids=new Set();
  for(const world of [...FOUNDERS,...community.worlds]) {
    const clean=validateWorld(world);
    if(ids.has(clean.id))throw new Error('Duplicate world ID.');ids.add(clean.id);
    for(const scenario of ['bridge','island','double']) {
      const result=report(clean.edges,scenario);
      if(result.cost>BUDGET || !Number.isFinite(result.average) || result.worst>result.total)throw new Error(`Invalid result: ${clean.id}`);
    }
  }
  const byId=new Map([...FOUNDERS,...community.worlds].map(w=>[w.id,w]));
  const visiting=new Set(),visited=new Set();
  function walk(id) {
    if(visiting.has(id))throw new Error('A cycle appears in world ancestry.');
    if(visited.has(id)||!byId.has(id))return;
    visiting.add(id);for(const p of byId.get(id).parents)walk(p);visiting.delete(id);visited.add(id);
  }
  for(const id of byId.keys())walk(id);
  const review=JSON.parse(await readFile(new URL('evolution.json',root),'utf8'));
  if(review.version!==VERSION || !Array.isArray(review.reviews) || review.reviews.length>1000)throw new Error('Invalid evolution review ledger.');
  for(const r of review.reviews)if(!Number.isSafeInteger(r.issue)||r.issue<1||!['published','duplicate','unsupported'].includes(r.decision)||typeof r.reason!=='string'||r.reason.length>300)throw new Error('Invalid review entry.');
  console.log(JSON.stringify({ok:true,model:VERSION,founders:FOUNDERS.length,community:community.worlds.length,reviews:review.reviews.length,path:fileURLToPath(root)}));
}
