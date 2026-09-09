import { BUDGET, COUNT, POINTS, SCENARIOS, FOUNDERS, VERSION, edgeKey, edgeCost, cost, canonicalEdges, validateWorld, reach, routeTo, report, signature, grow, encodeWorld, decodeWorld, validateCommunity } from './model.js';
import { esc, tone } from '../ui.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE = 'dream-unity-dream-world-v1';
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const day = value => { try { return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}); } catch { return 'Earlier visit'; } };
let notebook = { version:VERSION, worlds:[], runs:[] };
let world = validateWorld(FOUNDERS[0]), draft = null, editing = false, selected = null;
let lastResult = null, lastSignature = '', trial = {}, path = [], undo = [], sound = false;
let run = null, runTimer = null, walkTimer = null, view = 'play', community = [], communityLoaded = false;
let sharedWorld = null, shareOpener = null, storageAvailable = true;

function notice(text) { $('#notice').textContent=text; $('#notice').hidden=!text; }
function feedback(text) { $('#world-feedback').textContent=text; }
function persist() {
  try { localStorage.setItem(STORAGE,JSON.stringify(notebook)); storageAvailable=true; return true; }
  catch { storageAvailable=false; $('#save-note').textContent='Browser saving is unavailable. Export your notebook to keep it.'; return false; }
}
function checkNotebook(data) {
  if (!data || data.version!==VERSION || !Array.isArray(data.worlds) || !Array.isArray(data.runs) || data.worlds.length>80 || data.runs.length>200) throw new Error('Choose a Dream World notebook with up to 80 worlds and 200 tests.');
  const worlds=data.worlds.map(validateWorld);
  if(new Set(worlds.map(w=>w.id)).size!==worlds.length) throw new Error('The notebook contains repeated world IDs.');
  const runs=data.runs.map(entry=> {
    if (!entry || typeof entry.id!=='string' || entry.id.length>96 || !Object.hasOwn(SCENARIOS,entry.scenario) || typeof entry.at!=='string' || entry.at.length>32 || !Number.isFinite(Date.parse(entry.at)) || !Number.isInteger(entry.prediction) || entry.prediction<1 || entry.prediction>SCENARIOS[entry.scenario].denominator) throw new Error('A notebook test is incomplete.');
    return {id:entry.id,world:validateWorld(entry.world),scenario:entry.scenario,prediction:entry.prediction,at:entry.at};
  });
  return {version:VERSION,worlds,runs};
}
try { const stored=localStorage.getItem(STORAGE); if(stored) { if(stored.length>500000) throw new Error('Notebook too large.'); notebook=checkNotebook(JSON.parse(stored)); } }
catch { notice('The saved notebook could not be opened. This visit starts fresh; you can still import an exported copy.'); storageAvailable=false; }

function cancelWalk() { clearInterval(walkTimer); walkTimer=null; $('#traveller').hidden=true; path=[]; }
function cancelRun() { clearTimeout(runTimer); runTimer=null; run=null; $('#pause-test').hidden=true; $('#test-phase').textContent='Ready to explore'; setBusy(false); }
function setBusy(busy) {
  for(const selector of ['#scenario','#prediction','#test-world','#make-world','#draft-name','#draft-idea','#blank-world','#compare-worlds','#grow-world','#save-world','#share-world','[data-pick]']) $$(selector).forEach(el=>el.disabled=busy);
  $('#undo').disabled=busy || !undo.length;
  if(!busy) $('#grow-world').disabled=!(lastResult && lastSignature===signature(world));
}
function updateMetadata() {
  $('#world-name').textContent=world.name; $('#world-idea').textContent=world.idea;
  $('#world-kind').textContent=editing?'Your world':world.id==='one-centre'?'World A':world.id==='many-paths'?'World B':world.issue?'A shared world':notebook.worlds.some(w=>w.id===world.id)?'Your saved world':'A shared design';
  $('#edit-mode').hidden=!editing;
  $('#mode-caption').textContent=editing?'Tap two islands to change a bridge.':'Tap an island to follow its light.';
  $$('[data-pick]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pick===world.id && !editing)));
  $('#make-world').setAttribute('aria-pressed',String(editing));
  $('#draft-name').value=world.name; $('#draft-idea').value=world.idea;
  $('#trial-stat').textContent=lastResult && lastSignature===signature(world)?`${lastResult.worst} / ${lastResult.total}`:'—';
  $('#grow-world').disabled=!(lastResult && lastSignature===signature(world));
  $('#undo').disabled=!undo.length;
}
function displayWorld(next, isDraft=false) {
  cancelWalk(); cancelRun(); world=validateWorld(next); editing=isDraft; selected=null; trial={}; path=[]; undo=[]; lastResult=null; lastSignature='';
  if(editing) draft=world;
  $('#result').hidden=true; $('#comparison').hidden=true; $('#test-phase').textContent='Ready to explore';
  updateMetadata(); draw();
  feedback(editing?'Tap one island, then another. A new bridge costs stones. Remove bridges to get stones back.':'Tap an island. Watch the path that connects it to the source.');
}
function fork(next, idea) {
  return validateWorld({...clone(next),id:uid(),parents:[next.id],origin:'visitor',author:'',createdAt:new Date().toISOString(),name:'My third world',idea:idea||next.idea,issue:undefined});
}
function newThirdWorld() {
  if(draft) {displayWorld(draft,true);return;}
  const edges=clone(FOUNDERS[1].edges), existing=new Set(edges.map(edgeKey));
  for(const edge of [...FOUNDERS[0].edges].sort((a,b)=>edgeCost(a)-edgeCost(b))) {
    if(!existing.has(edgeKey(edge)) && cost([...edges,edge])<=BUDGET) {edges.push(edge); if(edges.length>=12) break;}
  }
  displayWorld({...fork(FOUNDERS[1],'Borrow a way around and a short path through the centre. What survives?'),edges,parents:FOUNDERS.map(w=>w.id)},true);
  feedback('Your third world borrows bridges from both A and B. Change a bridge, make a guess, then test it.');
}
function reviseIdentity() {
  if(notebook.worlds.some(w=>w.id===world.id) || notebook.runs.some(r=>r.world.id===world.id)) world={...world,id:uid(),parents:[world.id],createdAt:new Date().toISOString()};
}
function changeEdges(edges) {
  const clean=canonicalEdges(edges);
  if(cost(clean)>BUDGET) {feedback(`That bridge needs more stones. Remove a bridge first; your limit is ${BUDGET}.`);return;}
  undo.push(clone(world)); if(undo.length>40)undo.shift(); reviseIdentity(); world={...world,edges:clean}; draft=world;
  cancelWalk(); trial={}; selected=null; lastResult=null; lastSignature=''; $('#result').hidden=true; $('#test-phase').textContent='Design changed · ready for a new test'; updateMetadata();draw();
}
function toggleEdge(a,b) {
  if(run || !editing || a===b) return;
  const edge=[a,b].sort((x,y)=>x-y), key=edgeKey(edge), exists=world.edges.some(e=>edgeKey(e)===key);
  changeEdges(exists?world.edges.filter(e=>edgeKey(e)!==key):[...world.edges,edge]);
  if(selected===null) feedback(`${exists?'Removed':'Added'} bridge ${a+1}–${b+1}. ${BUDGET-cost(world.edges)} stones left. Make a guess when you are ready to test.`);
}
function chooseIsland(index) {
  if(run) return;
  if(editing) {
    if(selected===null) {selected=index;draw();feedback(`Island ${index+1} selected. Choose a second island to add or remove their bridge.`);}
    else if(selected===index) {selected=null;draw();feedback('Selection cleared. Choose any two islands.');}
    else toggleEdge(selected,index);
  } else travel(index);
}
function draw() {
  const state=reach(world.edges,trial), lit=new Set(state.lit), broken=new Set((trial.removed||[]).map(edgeKey));
  const pathEdges=new Set(path.slice(1).map((n,i)=>edgeKey([path[i],n])));
  $('#bridges').innerHTML=world.edges.map(edge=>{
    const [a,b]=edge,p=POINTS[a],q=POINTS[b],key=edgeKey(edge),classes=['bridge',lit.has(a)&&lit.has(b)?'live':'',broken.has(key)?'broken':'',edge.includes(trial.sleeping)?'suspended':'',pathEdges.has(key)?'path':''].join(' ');
    const line=`x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"`;
    return `<line ${line} class="${classes}"/><line ${line} class="bridge touch-target" data-edge="${key}"/>`;
  }).join('');
  const islands=$('#islands');
  if(!islands.children.length) {
    POINTS.forEach(([x,y],i)=> {
      const node=document.createElement('button');node.type='button';node.className='island';node.dataset.island=String(i);node.textContent=String(i+1);node.style.left=`${x}%`;node.style.top=`${y}%`;
      node.addEventListener('click',()=>chooseIsland(i));
      node.addEventListener('keydown',event=>{
        if(event.key==='Escape') {selected=null;draw();return;}
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
        event.preventDefault();const axis=event.key==='ArrowLeft'||event.key==='ArrowRight'?0:1,sign=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;
        const options=POINTS.map((p,j)=>({j,d:Math.hypot(p[0]-x,p[1]-y)})).filter(p=>sign*(POINTS[p.j][axis]-POINTS[i][axis])>0).sort((a,b)=>a.d-b.d);
        if(options[0])$(`[data-island="${options[0].j}"]`).focus();
      }); islands.append(node);
    });
  }
  $$('[data-island]').forEach(node=> {
    const i=Number(node.dataset.island);node.classList.toggle('lit',lit.has(i));node.classList.toggle('source',i===0);node.classList.toggle('sleeping',trial.sleeping===i);node.setAttribute('aria-pressed',String(selected===i));
    node.setAttribute('aria-label',`Island ${i+1}${i===0?', light source':''}, ${trial.sleeping===i?'sleeping':lit.has(i)?'connected':'cut off'}${editing?', choose to change a bridge':', follow its light'}`);
    node.dataset.status=i===0?'SOURCE':trial.sleeping===i?'SLEEPING':'';
  });
  $('#lit-stat').textContent=`${state.lit.length} / ${trial.sleeping===null||trial.sleeping===undefined?COUNT:COUNT-1}`;
  $('#cost-stat').textContent=`${cost(world.edges)} / ${BUDGET}`;
  if(editing) $('#edge-list').innerHTML=world.edges.map(edge=>`<button type="button" data-remove="${edgeKey(edge)}" aria-label="Remove bridge ${edge[0]+1} to ${edge[1]+1}, costing ${edgeCost(edge)} stones">${edge[0]+1}–${edge[1]+1} ×</button>`).join('') || '<p class="hint">No bridges yet. Join two islands to begin.</p>';
}
function travel(index) {
  cancelWalk(); path=routeTo(world.edges,index,trial); draw();
  if(!path.length) {feedback(`Island ${index+1} has no path to the light source. Change a bridge to find a way.`);return;}
  feedback(index===0?'Island 1 supplies the light. Every other island needs a path back here.':`The light crosses ${path.length-1} ${path.length===2?'bridge':'bridges'}: ${path.map(n=>n+1).join(' → ')}.`);
  if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  let step=0; const traveler=$('#traveller');traveler.hidden=false;
  const move=()=>{const point=POINTS[path[step]];if(!point){clearInterval(walkTimer);walkTimer=null;return;}traveler.style.left=`${3+.94*point[0]}%`;traveler.style.top=`${5+.83*point[1]}%`;if(sound)tone(220+step*55,.12);step++;};
  move();walkTimer=setInterval(move,260);
}
function startTest() {
  cancelWalk(); cancelRun(); selected=null; trial={}; $('#result').hidden=true;
  const scenario=$('#scenario').value,result=report(world.edges,scenario);
  if(!result.cases) {feedback('Add enough bridges for this experiment first. Two-bridge tests need at least two bridges.');draw();return;}
  run={result,world:clone(world),prediction:Number($('#prediction').value),step:0,paused:false};
  setBusy(true);$('#pause-test').hidden=false;$('#pause-test').textContent='Pause test';feedback('Your guess is locked. Each trial starts with your original world.');
  advanceTest();
}
function advanceTest() {
  if(!run || run.paused)return;
  if(run.step>=run.result.trials.length) {finishTest();return;}
  trial=run.result.trials[run.step];run.step++;
  $('#test-phase').textContent=`Trial ${run.step} / ${run.result.cases}`;draw();
  runTimer=setTimeout(advanceTest,Math.max(45,Math.min(360,5000/run.result.cases)));
}
function pauseTest() {
  if(!run)return;clearTimeout(runTimer);runTimer=null;run.paused=true;$('#pause-test').textContent='Resume test';$('#test-phase').textContent=`Paused · trial ${run.step} / ${run.result.cases}`;
}
function finishTest() {
  const finished=run;run=null;clearTimeout(runTimer);$('#pause-test').hidden=true;
  lastResult=finished.result;lastSignature=signature(world);trial=lastResult.trial;setBusy(false);draw();
  $('#trial-stat').textContent=`${lastResult.worst} / ${lastResult.total}`;$('#test-phase').textContent='Worst trial shown';
  const entry={id:`test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,at:new Date().toISOString(),world:finished.world,scenario:finished.result.scenario,prediction:finished.prediction};
  notebook.runs.push(entry);notebook.runs=notebook.runs.slice(-200);persist();updateCounts();
  $('#result').hidden=false;
  $('#result').innerHTML=`<h3>${lastResult.resilient?'Every light found another way.':'Here is where this world breaks.'}</h3><p>The worst trial kept <strong>${lastResult.worst} of ${lastResult.total}</strong> lights on. You guessed ${finished.prediction}. Across all ${lastResult.cases} trials, the average was ${lastResult.average.toFixed(2)}.</p><p>${lastResult.resilient?'Can you keep that resilience with fewer stones, or under a different kind of failure?':'The dark islands show where a new connection might help. Borrow a bridge, or let this result grow a new idea.'}</p><p class="result-meta">${esc(SCENARIOS[lastResult.scenario].name)} · ${lastResult.cost} stones · ${lastResult.cases} fresh trials · graph model ${VERSION}</p>`;
  feedback(lastResult.resilient?'All possible trials passed under this rule. Change the rule to ask a harder question.':'The weakest trial is visible. Restore the light to explore, or build a descendant that repairs it.');
  $('#grow-hint').textContent='Try a new bridge suggested by this test. You decide whether to keep the descendant.';if(sound)tone(lastResult.resilient?660:330,.2);
}
function compare() {
  const scenario=$('#scenario').value,examples=FOUNDERS.map(validateWorld);
  if(editing || !FOUNDERS.some(w=>signature(w)===signature(world)))examples.push(world);
  $('#comparison').hidden=false;$('#comparison-note').textContent=`${SCENARIOS[scenario].name}. Same positions, light source, 42-stone limit and model. We enumerate each world’s own bridges; trial counts may differ.`;
  $('#comparison-results').innerHTML=`<div class="comparison-table"><table><thead><tr><th scope="col">World</th><th scope="col">Lights before</th><th scope="col">Worst trial</th><th scope="col">Stones</th><th scope="col">Average journey*</th><th scope="col">Trials</th></tr></thead><tbody>${examples.map(w=>{const r=report(w.edges,scenario);return `<tr><th scope="row">${esc(w.name)}</th><td>${r.working} / 9</td><td>${r.cases?`${r.worst} / ${r.total}`:'No valid trials'}</td><td>${r.cost} / ${BUDGET}</td><td>${r.hops===null?'Some islands cut off':r.hops.toFixed(2)+' bridges'}</td><td>${r.cases}</td></tr>`;}).join('')}</tbody></table></div><p class="hint">*Shortest-path bridge crossings from the source, averaged over the other eight islands before a failure. Averages across each world’s own failures do not imply equal real-world failure probabilities.</p>`;
  $('#comparison').scrollIntoView({block:'nearest',behavior:'auto'});
}
function saveWorld() {
  const saved=validateWorld(world),index=notebook.worlds.findIndex(w=>w.id===saved.id);
  if(index<0 && notebook.worlds.length>=80) {notice('Your notebook holds 80 worlds. Export it before adding more. Your current world can still be shared by link.');return;}
  if(index<0)notebook.worlds.push(clone(saved));else notebook.worlds[index]=clone(saved);
  const stored=persist();updateCounts();feedback(stored?`“${saved.name}” is saved in My worlds on this device.`:'Added for this visit. Export the notebook to keep this world.');
}
function growWorld() {
  if(!lastResult || lastSignature!==signature(world))return;
  const next=grow(world,lastResult.scenario);
  if(!next) {feedback('No single bridge change improves this world under the current rule. Try another failure rule, or make several changes yourself.');return;}
  const parent=clone(world),scenario=lastResult.scenario;
  // Preserve the source design as well as the child so the lineage can be revisited.
  if(!notebook.worlds.some(w=>w.id===parent.id) && notebook.worlds.length<80)notebook.worlds.push(parent);
  const child=validateWorld({...fork(parent),name:`After ${parent.name}`.slice(0,64),idea:`${next.explanation} What happens under a different kind of failure?`,edges:next.edges,origin:'grown'});
  displayWorld(child,true);$('#scenario').value=scenario;
  if(notebook.worlds.length<80)notebook.worlds.push(clone(child));persist();updateCounts();
  feedback(`${next.explanation} A new world has grown from “${parent.name}”. Its prediction comes from the same model; test a different rule to challenge it.`);
}
function updateCounts() {$('#journal-count').textContent=String(notebook.worlds.length);}
function miniature(w) {
  const lit=new Set(reach(w.edges).lit);
  return `<svg viewBox="0 0 200 110" aria-hidden="true">${w.edges.map(([a,b])=>`<line x1="${POINTS[a][0]*2}" y1="${POINTS[a][1]}" x2="${POINTS[b][0]*2}" y2="${POINTS[b][1]}" stroke="#9985bf" stroke-width="1"/>`).join('')}${POINTS.map(([x,y],i)=>`<circle cx="${x*2}" cy="${y}" r="${i===0?5:3.5}" fill="${i===0?'#ffd489':lit.has(i)?'#c2acff':'#526079'}"/>`).join('')}</svg>`;
}
function nameFor(id) {return [...FOUNDERS,...notebook.worlds,...community,...notebook.runs.map(r=>r.world)].find(w=>w.id===id)?.name || id;}
function worldCard(w,source) {
  const r=report(w.edges),savedRun=[...notebook.runs].reverse().find(entry=>signature(entry.world)===signature(w) && entry.scenario==='bridge');
  const status=savedRun?(r.resilient?'Survived every bridge break':'A world worth repairing'):'Ready for an experiment';
  return `<article class="atlas-card ${savedRun&&!r.resilient?'ruin':''}"><span class="card-origin">${source==='community'?'Shared world':w.origin==='grown'?'A descendant':w.origin==='founder'?'A founding world':'Your creation'}</span>${miniature(w)}<h3>${esc(w.name)}</h3><p>${esc(w.idea)}</p><small>${esc(status)} · ${cost(w.edges)} stones</small>${w.parents.length?`<small>Grew from: ${w.parents.map(id=>esc(nameFor(id))).join(' + ')}</small>`:''}${w.author?`<small>Creator: ${esc(w.author)}</small>`:''}${w.issue?`<a href="https://github.com/dream-unity/one/issues/${w.issue}" target="_blank" rel="noopener noreferrer">Original submission ↗</a>`:''}<div class="button-row"><button type="button" class="secondary" data-open-world="${esc(w.id)}" data-source="${source}">Enter world</button><button type="button" class="secondary" data-remix-world="${esc(w.id)}" data-source="${source}">Make a descendant</button></div></article>`;
}
function renderJournal() {
  $('#journal-list').innerHTML=notebook.worlds.length?[...notebook.worlds].reverse().map(w=>worldCard(w,'notebook')).join(''):'<div class="empty-atlas"><h3>Your first world is waiting.</h3><p>Explore A and B, make a third world, and save it. Even a failed experiment can become the beginning of something useful.</p><button class="primary" type="button" data-view="play">Enter the worlds</button></div>';
  $('#history-list').innerHTML=notebook.runs.length?[...notebook.runs].reverse().map(entry=>{const r=report(entry.world.edges,entry.scenario);return `<article class="history-entry"><div><strong>${esc(entry.world.name)}</strong><p>${esc(SCENARIOS[entry.scenario].name)} · guessed ${entry.prediction} · worst ${r.worst}/${r.total} · ${r.cases} trials</p><p>${esc(day(entry.at))} · stored design; result recalculated</p></div><button class="secondary" type="button" data-restore-run="${esc(entry.id)}">Reopen this attempt</button></article>`;}).join(''):'<p class="hint">Completed tests will appear here. Interrupted tests are not recorded as complete.</p>';
}
async function loadCommunity() {
  $('#community-status').textContent='Opening the shared atlas…';$('#refresh-community').disabled=true;
  try {
    const response=await fetch(new URL('./community.json',import.meta.url),{cache:'no-store'});
    if(!response.ok)throw new Error('The atlas is temporarily unavailable.');
    const text=await response.text();if(text.length>200000)throw new Error('The atlas is too large.');
    const data=validateCommunity(JSON.parse(text));community=data.worlds;communityLoaded=true;
    $('#community-list').innerHTML=community.map(w=>worldCard(w,'community')).join('');
    $('#community-status').textContent=community.length?`${community.length} shared ${community.length===1?'world':'worlds'}. Each design names its source submission.`:'The shared atlas is open. No visitor worlds have been published yet.';
  } catch {$('#community-status').textContent='The shared atlas could not load. Your own worlds still work. Try Refresh worlds when you are connected.';}
  finally {$('#refresh-community').disabled=false;}
}
function setView(next) {
  if(!['play','journal','community','about'].includes(next))return;
  if(next!=='play'){pauseTest();cancelWalk();}
  view=next;
  for(const key of ['play','journal','community','about'])$(`#${key}-view`).hidden=key!==view;
  $$('.view-link').forEach(el=>{if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(view==='journal')renderJournal();if(view==='community'&&!communityLoaded)loadCommunity();
}
function selectFromAtlas(id,source,remix=false) {
  const chosen=(source==='community'?community:notebook.worlds).find(w=>w.id===id);if(!chosen)return;
  setView('play');displayWorld(remix?fork(chosen):chosen,remix);$('#world-name').tabIndex=-1;$('#world-name').focus();
}
function exportNotebook() {
  const url=URL.createObjectURL(new Blob([JSON.stringify(notebook,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='dream-world-notebook.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importNotebook(file) {
  if(!file)return;
  if(file.size>500000){notice('This notebook is too large. Choose a Dream World export smaller than 500 KB.');return;}
  try {
    const incoming=checkNotebook(JSON.parse(await file.text()));
    const additions=incoming.worlds.filter(w=>!notebook.worlds.some(current=>current.id===w.id));
    const tests=incoming.runs.filter(r=>!notebook.runs.some(current=>current.id===r.id));
    const conflicts=incoming.worlds.some(w=>notebook.worlds.some(current=>current.id===w.id && JSON.stringify(current)!==JSON.stringify(w)));
    if(conflicts)throw new Error('Two different designs use the same world ID. Your existing notebook was kept.');
    if(notebook.worlds.length+additions.length>80 || notebook.runs.length+tests.length>200)throw new Error('The combined notebook would exceed 80 worlds or 200 tests. Your existing notebook was kept.');
    notebook={version:VERSION,worlds:[...notebook.worlds,...additions],runs:[...notebook.runs,...tests]};const stored=persist();renderJournal();updateCounts();notice(`Imported ${additions.length} worlds and ${tests.length} test records. Results are recalculated from the stored designs.${stored?'':' Export the combined notebook to keep it.'}`);
  }catch(error){notice(error instanceof Error?error.message:'This notebook could not be imported.');}
  finally{$('#import-journal').value='';}
}
function refreshShare() {
  if(!sharedWorld)return;
  sharedWorld.author=$('#creator-name').value.trim().slice(0,64);
  const link=new URL(location.href);link.search='';link.hash=`world=${encodeWorld(sharedWorld)}`;$('#share-url').value=link.href;
  const r=report(sharedWorld.edges,$('#scenario').value);
  const body=`<!-- dream-world-submission:v1 -->\nI want this design to be public and considered for the Dream World atlas.\n\n## The idea\n${sharedWorld.idea}\n\n## World data\n\`\`\`json\n${JSON.stringify(sharedWorld,null,2)}\n\`\`\`\n\n## Calculation from the design\nModel ${VERSION}. ${SCENARIOS[r.scenario].name}: ${r.cases} trials, worst ${r.worst}/${r.total}, ${r.cost}/${BUDGET} stones. This is a graph-model calculation, not evidence of human learning.\n\n## What surprised me / what I would change\n[Add an observation here if you want.]\n`;
  const submission=new URL('https://github.com/dream-unity/one/issues/new');submission.searchParams.set('title',`Dream World: ${sharedWorld.name}`);submission.searchParams.set('body',body);
  $('#submit-world').href=submission.href;$('#submit-world').setAttribute('aria-disabled',String(!$('#public-consent').checked));
}
function openShare() {
  sharedWorld=validateWorld({...clone(world),id:FOUNDERS.some(w=>w.id===world.id)?uid():world.id,parents:FOUNDERS.some(w=>w.id===world.id)?[world.id]:world.parents,origin:'visitor',issue:undefined});
  shareOpener=document.activeElement;$('#share-title').textContent=`Share “${world.name}”`;$('#share-summary').textContent=`${world.edges.length} bridges · ${cost(world.edges)} stones · ${world.parents.length} ${world.parents.length===1?'parent':'parents'}`;
  $('#creator-name').value=sharedWorld.author||'';$('#public-consent').checked=false;$('#share-status').textContent='';refreshShare();$('#share-dialog').showModal();
}

document.addEventListener('click',event=> {
  const control=event.target.closest('button,a');if(!control)return;
  if(control.dataset.view)setView(control.dataset.view);
  if(control.dataset.pick)displayWorld(FOUNDERS.find(w=>w.id===control.dataset.pick));
  if(control.dataset.remove){const [a,b]=control.dataset.remove.split('-').map(Number);toggleEdge(a,b);}
  if(control.dataset.openWorld)selectFromAtlas(control.dataset.openWorld,control.dataset.source);
  if(control.dataset.remixWorld)selectFromAtlas(control.dataset.remixWorld,control.dataset.source,true);
  if(control.dataset.restoreRun){const entry=notebook.runs.find(r=>r.id===control.dataset.restoreRun);if(entry){setView('play');displayWorld(entry.world);$('#scenario').value=entry.scenario;updateScenario();feedback('The exact attempted world is restored. Make a descendant to repair it, or test it again.');}}
});
$('#bridges').addEventListener('click',event=>{const key=event.target.dataset.edge;if(!key||run)return;const [a,b]=key.split('-').map(Number);if(editing)toggleEdge(a,b);else{cancelWalk();trial={removed:[[a,b]],sleeping:null};draw();feedback(`Bridge ${a+1}–${b+1} is temporarily broken. Tap an island to trace another path, or restore the light. This preview is not a completed test.`);}});
$('#make-world').addEventListener('click',()=>{if(!FOUNDERS.some(w=>w.id===world.id)&&!editing){displayWorld(fork(world),true);}else newThirdWorld();});
$('#blank-world').addEventListener('click',()=>changeEdges([]));
$('#undo').addEventListener('click',()=>{if(!undo.length)return;world=undo.pop();draft=world;lastResult=null;lastSignature='';trial={};selected=null;$('#result').hidden=true;updateMetadata();draw();feedback('Undid the last bridge change.');});
for(const [id,key] of [['draft-name','name'],['draft-idea','idea']])$('#'+id).addEventListener('input',event=>{
  if(!editing)return;reviseIdentity();world={...world,[key]:event.target.value.replace(/[\u0000-\u001f\u007f]/g,' ').trim() || (key==='name'?'My third world':'What will these connections make possible?')};draft=world;
  $('#world-name').textContent=world.name;$('#world-idea').textContent=world.idea;
});
function updateScenario() {
  cancelRun();trial={};lastResult=null;lastSignature='';$('#result').hidden=true;$('#comparison').hidden=true;
  const definition=SCENARIOS[$('#scenario').value];$('#scenario-note').textContent=definition.detail;$('#prediction').max=String(definition.denominator);$('#prediction').value=String(Math.min(Number($('#prediction').value),definition.denominator));$('#prediction-value').textContent=`${$('#prediction').value} / ${definition.denominator}`;updateMetadata();draw();
}
$('#scenario').addEventListener('change',updateScenario);
$('#prediction').addEventListener('input',()=>$('#prediction-value').textContent=`${$('#prediction').value} / ${SCENARIOS[$('#scenario').value].denominator}`);
$('#test-world').addEventListener('click',startTest);
$('#pause-test').addEventListener('click',()=>{if(!run)return;if(run.paused){run.paused=false;$('#pause-test').textContent='Pause test';advanceTest();}else pauseTest();});
$('#restore-light').addEventListener('click',()=>{cancelRun();cancelWalk();trial={};selected=null;draw();feedback('The original light is restored. Every new trial starts from this world.');});
$('#compare-worlds').addEventListener('click',compare);
$('#close-comparison').addEventListener('click',()=>$('#comparison').hidden=true);
$('#grow-world').addEventListener('click',growWorld);
$('#save-world').addEventListener('click',saveWorld);
$('#share-world').addEventListener('click',openShare);
$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));if(sound)tone(440,.1);});
$('#export-journal').addEventListener('click',exportNotebook);
$('#import-journal').addEventListener('change',event=>importNotebook(event.target.files[0]));
$('#refresh-community').addEventListener('click',loadCommunity);
$('#creator-name').addEventListener('input',refreshShare);
$('#public-consent').addEventListener('change',refreshShare);
$('#submit-world').addEventListener('click',event=>{if(!$('#public-consent').checked){event.preventDefault();$('#share-status').textContent='Choose whether to make this design public before opening the submission.';}});
$('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#share-url').value);$('#share-status').textContent='Link copied. Anyone with it can open this design.';}catch{$('#share-url').focus();$('#share-url').select();$('#share-status').textContent='Select and copy the link above to share this design.';}});
$('#share-dialog').addEventListener('close',()=>shareOpener?.focus());
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseTest();cancelWalk();}});
window.addEventListener('pagehide',()=>{pauseTest();cancelWalk();});

displayWorld(FOUNDERS[0]);updateCounts();
if(!storageAvailable)$('#save-note').textContent='Browser saving is unavailable. Export your notebook to keep it.';
const encoded=new URLSearchParams(location.hash.slice(1)).get('world');
if(encoded){try{const imported=decodeWorld(encoded);displayWorld(imported);notice(`Opened a shared design: “${imported.name}”. It is not saved until you choose Save world.`);}catch(error){notice(error.message);}}
