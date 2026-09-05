import {
 VERSION, PROGRESS_KEY, VARIANTS, ORIGINAL, EVIDENCE, PROBES, CAUSES, SORT_CARDS, LOOP, CUES, STAGES,
 createSession, safeProgress, assistanceFor, shuffled, executeProbe, probeResult, knowledgeFrom,
 warrantedStatement, inspectTargets, evaluateSort, evaluateScope, evaluateLoop, evaluatePrediction,
 evaluateInspect, evaluateUpdate, evaluateAction, evaluateTransfer, recordAttempt, mergeProgress,
 completionSummary, nextStage
} from './engine.js?v=cbt-clear-1';
import {TRANSFER_CASES} from './scenarios.js?v=cbt-clear-1';

const $=selector=>document.querySelector(selector);
const app=$('#app'),dialog=$('#dialog');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RETURN_URL='../../?return=machine-mind-model&focus=model';
const STAGE_SKILL={separate:'sources',scope:'scope',loop:'loop',model:'model',predict:'prediction',probe:'probe',inspect:'sources',update:'update',act:'action'};
const FADED_LEADS={separate:'Where did we learn this?',scope:'How much does this show?',loop:'Put the steps in order.',predict:'What would you look for?',inspect:'What do these clues show?',update:'Keep what is true. Change the thought.',act:'Make the change. Decide when to look again.'};
let session=null, minutes=8, selfPaced=false, remember=false, timeHidden=false;
let progress=safeProgress({}), visit=0, running=false, lastTick=performance.now(), dialogResume=false;
try {const saved=localStorage.getItem(PROGRESS_KEY);if(saved){progress=safeProgress(JSON.parse(saved));remember=true;}} catch {/* Storage is optional. */}
const id=()=>session?.plan[session.cursor];
const response=()=>session.responses[id()]||(session.responses[id()]={});
const transferStage=()=>['transfer','transfer2','recall'].includes(id());
const currentCase=()=>session.cases[id()==='transfer2'?1:id()==='recall'?2:0];
const remaining=()=>session ? Math.max(0,session.minutes*60+(session.extension||0)-session.elapsed) : 0;
const say=text=>{$('#announcement').textContent=text;};
function choice(group,value,label,detail='',selected=false){return `<button type="button" class="choice${selected?' selected':''}" data-action="choose" data-group="${esc(group)}" data-value="${esc(value)}" data-key="${esc(group+'-'+value)}" aria-pressed="${selected}"><span class="choice-title">${selected?'<span aria-hidden="true">✓ </span>':''}${esc(label)}</span>${detail?`<small class="choice-detail">${esc(detail)}</small>`:''}</button>`;}
function choices(group,items,selected){return `<div class="choice-grid" role="group" aria-label="${esc(({scope:"What does the note tell us?",model:"Pick an idea",forecast:"What might happen?",counter:"What would change your mind?",probe:"Choose what to do",update:"Choose a thought",colour:"Pick a colour",returnWhen:"When will you look again?",replacement:"A new thought",linked:"Which clues share the same check?",replay:"What do the replies show?",fact:"Keep what happened",move:"Choose a step",reason:"Why this step?",return:"When to look again",question:"Choose a question",transferAction:"Choose a step",transferReason:"Why this step?",confidence:"How sure are you?"})[group]||"Choose an answer")}">${items.map(x=>choice(group,x.id,x.label,x.detail||'',Array.isArray(selected)?selected.includes(x.id):selected===x.id)).join('')}</div>`;}
function primary(label='Check my choice',disabled=false,action='submit'){return `<button type="button" class="primary" data-action="${action}" ${disabled?'disabled':''}>${esc(label)} <span aria-hidden="true">→</span></button>`;}
function note(text){return `<p class="hint">${esc(text)}</p>`;}
function record(result,answer,mode){
 const stage=id(),r=response();
 recordAttempt(session,{stage,skill:result.skill,pass:result.pass,mode:mode||(session.help[stage]?'guided':transferStage()||assistanceFor(session.progress,STAGE_SKILL[stage])==='faded'?'independent':'guided'),caseId:transferStage()?currentCase().id:`prototype-${session.world.id}`,delayed:stage==='recall',answer});
 r.tried=(r.tried||0)+1;
}
function feedbackHTML(r){
 if(!r.feedback)return '';
 return `<div class="feedback ${r.feedback.pass?'success':'repair'}" tabindex="-1" id="feedback" role="status"><strong class="feedback-title">${esc(r.feedback.title)}</strong><p>${esc(r.feedback.message)}</p></div>`;
}
function evaluate(result,answer,demonstrate){
 const r=response(); const mode=r.tried?'repair':undefined;
 record(result,answer,mode);
 if(result.pass){r.done=true;r.feedback={pass:true,title:r.tried>1?'Changed and checked':'Checked',message:result.message};}
 else if(r.tried>=2&&demonstrate){demonstrate();r.done=true;r.feedback={pass:false,title:'Here is one way',message:result.message+' We have shown one way. You used help for this step.'};recordAttempt(session,{stage:id(),skill:result.skill,pass:false,mode:'demonstrated',caseId:`prototype-${session.world.id}`});}
 else {r.feedback={pass:false,title:'Try changing this part',message:result.message};session.help[id()]=true;}
 if(r.done&&!session.completed.includes(id()))session.completed.push(id());
 paint(false);$('#feedback')?.focus();
}
function markAndNext(){
 if(!session.completed.includes(id()))session.completed.push(id());
 const next=nextStage(session,remaining());
 if(next==='summary')return finishSession();
 paint();
}
function tick(){
 const now=performance.now();
 if(session&&!session.ended&&running&&!document.hidden&&!dialog.open)session.elapsed+=(now-lastTick)/1000;
 lastTick=now;
 if(!session)return;
 const left=Math.ceil(remaining());
 $('#timer').textContent=session.pacing==='self'?'No timer':timeHidden?'Time':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
 $('#timer').setAttribute('aria-label',timeHidden?'Show time left':'Hide time left');
 if(left===0&&session.pacing==='clock'&&running&&!dialog.open&&!session.ended){
  openDialog('Time is up','You can keep going or stop here. Your choice will stay where you left it.',[
   ['extend','Add 2 minutes'],['self','Keep going, no timer'],['end','Stop here']
  ]);
 }
}
setInterval(tick,500);
function openDialog(title,text,actions,extra=''){
 dialogResume=running;running=false;lastTick=performance.now();
 dialog.innerHTML=`<h2 id="dialog-title">${esc(title)}</h2><p>${esc(text)}</p>${extra}<div class="modal-actions">${actions.map(([action,label],i)=>`<button type="button" class="${i===0?'primary':'secondary'}" data-dialog="${action}">${esc(label)}</button>`).join('')}</div>`;
 if(!dialog.open)dialog.showModal();
}
function closeDialog(){dialog.close();running=dialogResume&&!!session&&!session.ended&&!document.hidden;lastTick=performance.now();$('#pause').textContent=running?'Pause':'Keep going';}
function about(){
 openDialog('What is CBT?', 'CBT is short for cognitive behavioural therapy. It helps us look at how thoughts, feelings and actions work together.', [['resume','Back']],
 `<p>A thought can feel true before we know if it is true. We can look for clues, try a small step, and think again.</p><p>Sometimes a worry is right. Sometimes we do not know yet. This practice makes room for both.</p><p>These are made-up stories. You do not have to tell us about your life.</p><details><summary>For grown-ups: research and privacy</summary><p>This is a skills exercise, not a full course of therapy. This exercise itself has not been tested as a treatment.</p><p>Practice stays on this page unless you choose to save it on this device. We do not ask for a name, a recording or a personal story.</p><p><a href="https://www.nice.org.uk/guidance/ng222/chapter/recommendations" target="_blank" rel="noopener noreferrer">Read the CBT guidance</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/21819813/" target="_blank" rel="noopener noreferrer">Read a study</a></p></details>`);
}
function intro(){
 session=null;running=false;$('#session-controls').hidden=true;
 app.innerHTML=`<section class="intro" id="stage" tabindex="-1"><p class="eyebrow">Mind / Model · Check a thought</p><h1>Cognitive behavioural therapy <span>(CBT)</span></h1><p class="intro-copy">What we think can change how we feel and what we do. CBT helps us look for clues, try a small step, and think again.</p><div class="method-preview" aria-label="Look, try, learn"><span><i aria-hidden="true">◉</i>Look</span><b aria-hidden="true">→</b><span><i aria-hidden="true">◇</i>Try</span><b aria-hidden="true">→</b><span><i aria-hidden="true">✧</i>Learn</span></div><p>Use a made-up story. You do not need to write or tell us about yourself.</p><p class="field-label" id="duration-label">How long would you like?</p><div class="duration-group" role="group" aria-labelledby="duration-label">${[[4,'A short try'],[8,'A full try'],[12,'More to work out']].map(([n,label])=>`<button type="button" class="duration-option ${minutes===n?'selected':''}" aria-pressed="${minutes===n}" data-action="duration" data-value="${n}"><strong>${n} min</strong><span>${label}</span></button>`).join('')}</div><label class="preference"><input id="self-paced" type="checkbox" ${selfPaced?'checked':''}> No timer</label><label class="preference"><input id="remember" type="checkbox" ${remember?'checked':''}> Save my practice on this device</label><p class="status-note">${remember?'You can clear saved practice at any time.':'Nothing is saved after you close this page.'}</p>${progress.sessions?`<p class="status-note">You have practised ${progress.sessions} ${progress.sessions===1?'time':'times'}. <button class="quiet" data-action="clear-progress">Clear saved practice</button></p>`:''}<div class="action-bar">${primary('Start',false,'start')}<span class="timer-note">You can pause, stop, or take more time.</span></div></section>`;
}
function begin(){
 const runIndex=Math.max(visit,progress.sessions);
 const variant=VARIANTS[runIndex%VARIANTS.length];
 session=createSession({minutes,pacing:selfPaced?'self':'clock',variant,progress,cases:TRANSFER_CASES});visit=runIndex+1;
 session.tileOrder=shuffled(LOOP);session.cueOrder=shuffled(CUES);session.probeOrder=shuffled(PROBES);
 session.caseOptions=Object.fromEntries(session.cases.map(c=>[c.id,shuffled(c.options)]));
 session.caseReasons=Object.fromEntries(session.cases.map(c=>[c.id,shuffled(c.reasons)]));
 running=true;lastTick=performance.now();$('#session-controls').hidden=false;paint();tick();
}
function dots(count,colour='blue'){
 return `<span class="picture-dots ${colour}" role="img" aria-label="${count} ${colour} dots">${Array.from({length:count},()=>'<i aria-hidden="true"></i>').join('')}</span>`;
}
function boxes(count){return `<span class="picture-boxes" role="img" aria-label="${count} boxes">${Array.from({length:count},()=>'<i aria-hidden="true"></i>').join('')}</span>`;}
function board(){
 if(id()==='sources')return `<aside class="scene-panel" aria-label="Jo, Sam and Lee’s story"><p class="eyebrow">A different story</p><h2 class="scene-title">One clue, said twice</h2><p>Jo checks a picture.</p><p>Sam reads Jo’s note.</p><p>Lee looks at a rule card.</p><p class="case-note">Did each person do a new check?</p></aside>`;
 if(transferStage()){
  const c=currentCase();return `<aside class="scene-panel" aria-label="The story"><p class="eyebrow">A made-up story</p><h2 class="scene-title">${esc(c.title)}</h2><p class="case-note">${esc(c.scene)}</p><ul class="scene-facts">${c.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${c.claim!=='No belief claim is needed here.'?`<div class="thought"><span class="source">The thought</span>${esc(c.claim)}</div>`:''}</aside>`;
 }
 const k=knowledgeFrom(session.evidence);
 return `<aside class="scene-panel" aria-label="Ari’s picture and story"><p class="eyebrow">A made-up story</p><h2 class="scene-title">Ari’s picture</h2><p class="case-note">Ari has made a picture. Two parts are marked.</p><div class="picture-board ${session.evidence.includes('C1')?'recoloured':''}"><div class="panel ${session.actionDone&&k.units?'fixed':'marked'}"><span>Part A</span>${dots(session.actionDone&&k.units?4:3)}</div><div class="panel ${session.actionDone&&k.layout?'fixed':'marked'}"><span>Part B</span>${boxes(session.actionDone&&k.layout?4:3)}</div></div><p class="case-note"><strong>“Please change these two parts. We will look at it at 3.”</strong></p><div class="thought"><span class="source">${session.revised?'The thought now':'Ari thinks'}</span>“${esc(session.revised||session.original.claim)}”</div><p class="case-note">Ari says, “I feel upset,” and hides the next picture.</p>${session.evidence.length?`<details class="evidence-drawer"><summary>Look at the clues · ${session.evidence.length}</summary><div class="evidence-list">${session.evidence.map(evidenceCard).join('')}</div></details>`:''}</aside>`;
}
function evidenceCard(eid){const e=EVIDENCE[eid];return `<article class="evidence-card"><span class="source">${esc(e.source)}</span><p>${esc(e.text)}</p></article>`;}
function paint(focus=true){
 const oldKey=document.activeElement?.dataset.key,oldAction=document.activeElement?.dataset.action;const stage=id(),r=response(),meta=STAGES[stage];
 const page=renderStage(stage,r);
 const faded=assistanceFor(session.progress,STAGE_SKILL[stage])==='faded';
 if(faded&&FADED_LEADS[stage]&&!session.help[stage])page.lead=FADED_LEADS[stage];
 const completed=r.done;
 app.innerHTML=`<div class="workspace">${board()}<section class="exercise-panel" id="stage" data-stage="${stage}" tabindex="-1" aria-labelledby="stage-title"><div class="stage-meta"><span>${esc(meta.phase)}</span><span aria-hidden="true">·</span><span>Step ${session.cursor+1} of ${session.plan.length}</span></div><div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${Math.round(session.cursor/session.plan.length*100)}%"></div></div><h1 class="stage-title" id="stage-title">${esc(page.title||meta.title)}</h1>${page.lead?`<p class="stage-lead">${esc(page.lead)}</p>`:''}<fieldset class="stage-body" ${completed?'disabled':''}>${page.body}</fieldset>${feedbackHTML(r)}<div class="action-bar">${completed?primary('Next',false,'next'):page.footer||primary('Check my choice',!page.ready)}${!completed&&page.help?`<button class="quiet" type="button" data-action="help">Help me</button>`:''}</div>${session.help[stage]&&page.help?note(page.help):''}</section></div>`;
 if(focus){$('#stage').focus({preventScroll:true});if(session.cursor)$('#stage-title').scrollIntoView({block:'start',behavior:'instant'});}
 else {const exact=oldKey?[...app.querySelectorAll('[data-key]')].find(el=>el.dataset.key===oldKey):null;
 const fallback=oldAction==='tile'?app.querySelector('.tile-bank button, [data-action=submit]'):['sort','inspect'].includes(oldAction)?app.querySelector('.sort-text'):oldAction?app.querySelector(`[data-action="${oldAction}"]`):null;
 (exact||fallback||$('#stage')).focus({preventScroll:true});}
}
function cardPager(index,length,kind){return `<div class="card-pager" aria-label="Pick a card">${Array.from({length},(_,i)=>`<button class="${i===index?'selected':''}" data-action="card-page" data-kind="${kind}" data-value="${i}" aria-label="Card ${i+1}" aria-pressed="${i===index}">${i+1}</button>`).join('')}</div>`;}
function sortPage(r){
 const active=Math.min(r.cardIndex||0,SORT_CARDS.length-1),c=SORT_CARDS[active];
 return {lead:'Where did we learn this? Pick the picture, the note, Ari’s words, or “We do not know”.',body:`${cardPager(active,SORT_CARDS.length,'sort')}<div class="sort-row"><p class="sort-text" tabindex="-1">${esc(c.text)}</p><div class="source-choices" role="group" aria-label="Where did we learn this?">${[['prototype','The picture','▧'],['message','The note','▤'],['character','Ari’s words','◌'],['unshown','We do not know','?']].map(([value,label,icon])=>`<button type="button" data-action="sort" data-value="${value}" data-card="${c.id}" data-key="${c.id}-${value}" aria-pressed="${r[c.id]===value}" class="${r[c.id]===value?'selected':''}"><i aria-hidden="true">${icon}</i>${label}</button>`).join('')}</div></div><p class="status-note">${SORT_CARDS.filter(c=>r[c.id]).length} of ${SORT_CARDS.length} cards placed. You can change any card.</p>`,ready:SORT_CARDS.every(c=>r[c.id]),help:'The picture shows the marks. The note gives a time. Ari tells us about feeling upset. Nobody tells us what everyone thinks.'};
}
function inspectPage(r){
 const targets=inspectTargets(session.evidence),active=Math.min(r.cardIndex||0,targets.length-1),t=targets[active];
 return {lead:session.probes.at(-1).effect,body:`<div class="evidence-list">${session.evidence.map(evidenceCard).join('')}</div>${!r.repairClosed&&session.probes.length===1&&session.probes[0].probeId!=='clarify'?`<div class="task-result"><p>You can ask one more question, or use what you know.</p>${primary('Ask what needs to change',false,'repair-probe')} <button class="secondary" data-action="keep-evidence">Use these clues</button></div>`:''}<p class="field-label">What do the clues show?</p>${cardPager(active,targets.length,'inspect')}<div class="sort-row"><p class="sort-text" tabindex="-1">${esc(t.text)}</p><div class="source-choices three" role="group" aria-label="What do the clues show?">${[['supported','The clues show this','✓'],['open','We still do not know','?'],['unsupported','This says too much','↗']].map(([v,l,icon])=>`<button data-action="inspect" data-card="${t.id}" data-value="${v}" data-key="${t.id}-${v}" aria-pressed="${r[t.id]===v}" class="${r[t.id]===v?'selected':''}"><i aria-hidden="true">${icon}</i>${l}</button>`).join('')}</div></div>`,ready:targets.every(t=>r[t.id]),help:'Use only the clues you have. A missing answer stays missing. A mistake does not tell us what someone can never learn.'};
}
function renderStage(stage,r){
 const k=knowledgeFrom(session.evidence);
 switch(stage){
 case 'arrival':return {lead:'Read the note. Look at Ari’s thought. Are they saying the same thing?',body:`<div class="paired"><div class="statement"><span class="source">What happened</span>${esc(session.original.fact)}</div><div class="statement"><span class="source">What Ari thinks</span>“${esc(session.original.claim)}”</div></div>${note('The story stays here. You can look at it again at any time.')}`,footer:primary('Start with Ari',false,'next')};
 case 'separate':return sortPage(r);
 case 'scope':return {lead:'The note asks for a change. What does it tell us about?',body:choices('scope',[{id:'panels',label:'These two parts'},{id:'project',label:'Every part of this picture'},{id:'ability',label:'Everything Ari can do'},{id:'identity',label:'Whether Ari should be here'}],r.scope),ready:!!r.scope,help:'The two marks tell us about two parts. To say more, we would need more clues.'};
 case 'loop':return {lead:'What comes first? Tap each piece to put it in order. Tap a placed piece to move it back.',body:`${slots(r.order||[],session.tileOrder,'loop')}<div class="tile-bank">${session.tileOrder.filter(t=>!(r.order||[]).includes(t.id)).map(t=>`<button class="tile" data-action="tile" data-key="tile-${t.id}" data-value="${t.id}">${esc(t.text)}</button>`).join('')}</div>`,ready:r.order?.length===4,help:'Ari has a thought, feels upset, then hides the picture. Hiding it means missing help that could change the thought.'};
 case 'model':return {lead:'Why might the picture need a change? Pick one or two ideas. An idea is not an answer yet.',body:choices('model',CAUSES.map(c=>({id:c.id,label:c.label})),r.model||[])+note((r.model||[]).length?`Your ideas: ${(r.model||[]).map(x=>CAUSES.find(c=>c.id===x).label).join(' Also: ')}`:'More than one thing could be happening.'),ready:!!r.model?.length,footer:primary('Try these ideas',!r.model?.length),help:'Ari may have missed a dot. A rule may have changed. Ari may have missed the same dot before. Each idea needs a check.'};
 case 'predict':{
  const second=r.predictionPart===1;
  return {lead:second?'Before you look, choose what would make you think this has happened before.':`Your idea: ${session.model.map(x=>CAUSES.find(c=>c.id===x).label).join(' Also: ')}`,body:second?`<p class="field-label">What would show the same problem happened before?</p>${choices('counter',[{id:'history',label:'Old pictures show the same missing dot.'},{id:'calm',label:'Ari feels better after a reply.'},{id:'brief',label:'The next reply is short too.'}],r.counter)}<button class="quiet" data-action="prediction-back">Back to my guess</button>`:`<p class="field-label">If your idea is right, what might you find?</p>${choices('forecast',[...CAUSES.map(c=>({id:c.id,label:c.forecast})),{id:'tone',label:'Another short reply.'}],r.forecast)}`,ready:!!r.forecast&&!!r.counter,footer:second?primary('Keep my guess',!r.counter):primary('Next',!r.forecast,'prediction-next'),help:'Match your guess to your idea. Old pictures can show an old mistake. Feeling better cannot show that.'};
 }
 case 'probe':return {lead:'What will you do to find out? Each choice can lead to a different reply.',body:`<p class="statement"><span class="source">You expect to find</span>${esc(CAUSES.find(c=>c.id===session.prediction.forecast)?.forecast||'A clue you can check.')}</p>${choices('probe',session.probeOrder,r.probe)}${r.probe?note(`You will check: ${PROBES.find(p=>p.id===r.probe).source}. You have not seen the reply yet.`):''}`,ready:!!r.probe,footer:primary('Try this',!r.probe)};
 case 'inspect':return inspectPage(r);
 case 'update':{
  const expected=warrantedStatement(session.evidence);
  if(!r.options)r.options=shuffled([...new Set([expected,...['local','broader','mixed','unresolved'].map(v=>warrantedStatement(({local:['L1','L2','L3'],broader:['B1','B2','B3'],mixed:['M1','M2','M3','M4'],unresolved:['U2','U3']})[v]))])]);
  return {lead:'Keep what really happened. Pick a new thought that fits the clues.',body:`<div class="claim-row"><p class="claim-original"><span class="source">What happened</span>${esc(session.original.fact)}</p>${choices('fact',[{id:'keep',label:'Keep this'},{id:'remove',label:'Take this out'}],r.fact)}</div><div class="claim-row"><p class="claim-original"><span class="source">The old thought</span>“${esc(session.original.claim)}”</p><p class="field-label">A new thought could be…</p>${choices('replacement',r.options.map((text,i)=>({id:String(i),label:text})),r.replacement)}</div>`,ready:!!r.fact&&r.replacement!==undefined,help:'Ari was asked to change two parts. That still happened. The new thought must fit the clues you found.'};
 }
 case 'act':return actionPage(r,k);
 case 'transfer':case 'transfer2':case 'recall':return transferPage(r);
 case 'sources':return {lead:'Here is a different story. Jo checks a picture. Sam reads Jo’s note. Lee looks at a rule card.',body:`<div class="evidence-list"><article class="evidence-card"><span class="source">A · Jo’s note</span>“One dot is missing in the old picture.”</article><article class="evidence-card"><span class="source">B · Sam’s words</span>“Jo’s note says one dot is missing.”</article><article class="evidence-card"><span class="source">C · Lee’s rule card</span>“The number of boxes changed today.”</article></div><p class="field-label">Which two share the very same clue?</p>${choices('linked',[{id:'ab',label:'A and B'},{id:'ac',label:'A and C'},{id:'bc',label:'B and C'}],r.linked)}`,ready:!!r.linked,help:'Sam has copied Jo’s clue. Two people saying it does not make it two checks. But two people can each do a check and find the same thing.'};
 case 'replay':{
  const neutral=probeResult(session.world,'clarify'),accusatory=probeResult(session.world,'accuse');
  return {lead:'Try two ways of asking from the same starting point. This shows how a question can change a reply.',body:`<div class="paired"><div class="outcome-comparison"><h2 class="field-label">“What needs to change?”</h2>${neutral.ids.map(evidenceCard).join('')}</div><div class="outcome-comparison"><h2 class="field-label">“Why don’t you want Ari here?”</h2>${accusatory.ids.map(evidenceCard).join('')}</div></div><p class="field-label">What can we learn?</p>${choices('replay',[{id:'exchange',label:'The question changed the reply. We still cannot read a mind.'},{id:'rejection',label:'The short reply proves they did not want Ari there before.'},{id:'universal',label:'Everyone always gives this reply to that question.'}],r.replay)}`,ready:!!r.replay,help:'The reply happened after the question. It does not prove what someone thought before the question.'};
 }
 case 'delayed':return {lead:'Back to Ari. The note is the same. There is no new clue. It is not 3 yet.',body:choices('return',[{id:'wait',label:'Keep the plan. Look again at 3, or when a new clue comes.'},{id:'check',label:'Read the same note until I feel sure.'},{id:'never',label:'Never think about this again.'}],r.return),ready:!!r.return,help:'Stopping now does not mean stopping forever. A new clue or the planned time can be a reason to look again.'};
 case 'close':return {lead:'Put these three steps in order. Or choose “Finish” if you are ready to stop.',body:`${slots(r.order||[],CUES,'cue')}<div class="tile-bank">${session.cueOrder.filter(t=>!(r.order||[]).includes(t.id)).map(t=>`<button class="tile" data-action="tile" data-key="tile-${t.id}" data-value="${t.id}">${esc(t.text)}</button>`).join('')}</div>`,ready:r.order?.length===3,footer:`${primary('Check the steps',r.order?.length!==3)}<button class="quiet" data-action="end">Finish</button>`};
 default:return {body:'',footer:primary('Finish',false,'end')};
 }
}
function slots(order,tiles,name){return `<div class="slots" aria-label="${name==='loop'?'The steps in the story':'Steps to remember'}">${tiles.map((_,i)=>{const t=tiles.find(t=>t.id===order[i]);return `<button type="button" class="slot" data-action="remove-tile" data-key="slot-${i}" data-value="${i}" ${!t?'disabled':''}><span class="slot-number">${i+1}</span>${t?esc(t.text):'Tap a piece'}</button>`;}).join('')}</div>`;}
function selectField(name,label,options,value){return `<label class="control-group"><span class="field-label">${esc(label)}</span><select data-field="${name}">${options.map(([v,l])=>`<option value="${v}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
function counter(field,value,label,min=1,max=6){return `<div class="counter" role="group" aria-label="${esc(label)}"><button type="button" data-action="count" data-field="${field}" data-delta="-1" data-key="${field}-less" aria-label="Take away one: ${esc(label)}" ${value<=min?'disabled':''}>−</button><output aria-live="polite">${value}</output><button type="button" data-action="count" data-field="${field}" data-delta="1" data-key="${field}-more" aria-label="Add one: ${esc(label)}" ${value>=max?'disabled':''}>+</button></div>`;}
function actionPage(r,k){
 if(r.dots===undefined)Object.assign(r,{dots:3,colour:'blue',columns:3,practice:2,question:'',returnWhen:''});
 let body=`<div class="panel-work">`;
 if(k.units)body+=`<div class="panel"><h2>Part A</h2><p>The rule asks for 4 blue dots.</p>${dots(r.dots,r.colour)}${counter('dots',r.dots,'dots')}<p class="field-label">Dot colour</p>${choices('colour',[{id:'blue',label:'Blue'},{id:'red',label:'Red'}],r.colour)}</div>`;
 if(k.layout)body+=`<div class="panel"><h2>Part B</h2><p>Today’s rule asks for 4 boxes.</p>${boxes(r.columns)}${counter('columns',r.columns,'boxes')}</div>`;
 body+='</div>';
 if(k.repeated)body+=`<div class="practice-picture"><h2>Try it once more</h2><p>This little picture has 2 dots. Add 1 more.</p>${dots(r.practice)}${counter('practice',r.practice,'practice dots')}</div>`;
 if(!k.units||!k.layout)body+=`<p class="field-label">Some rules are still missing. What will you ask?</p>${choices('question',[{id:'criteria',label:'At 3: “What needs to change? Has it happened before?”'},{id:'approve',label:'“Does everyone like Ari?”'}],r.question)}`;
 body+=`<p class="field-label">When will you look again?</p>${choices('returnWhen',[{id:'new-or-review',label:'At 3, or when a new clue comes.'},{id:'certain',label:'Keep checking until I feel sure.'}],r.returnWhen)}`;
 return {lead:k.nonDiagnostic?'We do not know the rules yet. Make a plan to ask.':'Make the change yourself. Use + to add and − to take away.',body,ready:!!r.returnWhen&&((k.units&&k.layout)||!!r.question),footer:primary(k.nonDiagnostic?'Keep this plan':'Check the picture',!r.returnWhen||(!(k.units&&k.layout)&&!r.question)),help:'Count the dots and boxes. Follow the rules you have. Ask about a rule you have not seen yet.'};
}
function transferPage(r){
 const c=currentCase(),options=session.caseOptions[c.id];
 if(!r.executed)return {lead:'Read the story. What would you do next?',body:choices('move',options,r.move),ready:!!r.move,footer:primary('Try this',!r.move),help:'You might need a clue, a small change, a new thought, or time to wait. Pick what this story needs.'};
 const option=c.options.find(o=>o.id===r.move);
 return {title:'Why did you choose that?',lead:option.effect,body:`<p class="statement"><span class="source">You chose</span>${esc(option.label)}</p>${choices('reason',session.caseReasons[c.id].map(x=>({id:x.id,label:x.text})),r.reason)}<details class="optional-choice"><summary>How sure are you? You can skip this.</summary>${choices('confidence',[{id:'tentative',label:'Not very sure'},{id:'moderate',label:'Quite sure'},{id:'strong',label:'Very sure'}],r.confidence)}</details>`,ready:!!r.reason,help:c.principle};
}
function submit(){
 const r=response(),stage=id();
 switch(stage){
 case 'separate':return evaluate(evaluateSort(r),{...r},()=>SORT_CARDS.forEach(c=>r[c.id]=c.source));
 case 'scope':return evaluate(evaluateScope(r.scope),r.scope,()=>r.scope='panels');
 case 'loop':return evaluate(evaluateLoop(r.order),[...(r.order||[])],()=>r.order=LOOP.map(t=>t.id));
 case 'model':session.model=[...r.model];record({pass:true,skill:'model'},r.model);return markAndNext();
 case 'predict':{
  const res=evaluatePrediction(session.model,r.forecast,r.counter);
  if(res.pass)session.prediction={model:[...session.model],forecast:r.forecast,counter:r.counter};
  return evaluate(res,{forecast:r.forecast,counter:r.counter},()=>{r.forecast=session.model[0];r.counter='history';session.prediction={model:[...session.model],forecast:r.forecast,counter:r.counter};});
 }
 case 'probe':executeProbe(session,r.probe);recordAttempt(session,{stage,skill:'probe',pass:['rubric','clarify','wait'].includes(r.probe),mode:'guided',caseId:`prototype-${session.world.id}`,answer:r.probe});return markAndNext();
 case 'inspect':return evaluate(evaluateInspect(session.evidence,r),{...r},()=>inspectTargets(session.evidence).forEach(t=>r[t.id]=t.answer));
 case 'update':{
  const replacement=r.options[Number(r.replacement)],res=evaluateUpdate(session,r.fact,replacement);
  if(res.pass)session.revised=replacement;
  return evaluate(res,{fact:r.fact,replacement},()=>{r.fact='keep';r.replacement=String(r.options.indexOf(warrantedStatement(session.evidence)));session.revised=warrantedStatement(session.evidence);session.updateDemonstrated=true;});
 }
 case 'act':{
  const res=evaluateAction(session.evidence,r);if(res.pass)session.actionDone=true;
  return evaluate(res,{...r},()=>{Object.assign(r,{dots:4,colour:'blue',columns:4,practice:3,question:'criteria',returnWhen:'new-or-review'});session.actionDone=false;session.actionDemonstrated=true;});
 }
 case 'transfer':case 'transfer2':case 'recall':{
  if(!r.executed){r.executed=true;return paint();}
  const c=currentCase(),res=evaluateTransfer(c,r.move,r.reason);
  record(res,{move:r.move,reason:r.reason,confidence:r.confidence},r.tried?'repair':undefined);
  if(res.pass){r.done=true;r.feedback={pass:true,title:r.tried===1&&!session.help[stage]?'You tried this on your own':'You tried this with help',message:c.explanation};}
  else if(r.tried>=2){r.done=true;r.feedback={pass:false,title:'One useful way',message:`${c.options.find(o=>o.valid).label}. ${c.explanation} You used help with this one.`};}
  else {r.feedback={pass:false,title:'Try one change',message:c.explanation};session.help[stage]=true;r.executed=false;r.move=undefined;r.reason=undefined;}
  paint(false);$('#feedback')?.focus();return;
 }
 case 'sources':return evaluate({pass:r.linked==='ab',skill:'sources',message:'A and B share one clue. C comes from a different check. Two people can also check for themselves and agree.'},r.linked,()=>r.linked='ab');
 case 'replay':return evaluate({pass:r.replay==='exchange',skill:'probe',message:'The question changed the reply. That reply cannot tell us what someone thought before, or how everyone would act.'},r.replay,()=>r.replay='exchange');
 case 'delayed':return evaluate({pass:r.return==='wait',skill:'stopping',message:'Keep the plan. Look again at 3 or when a new clue comes. The same note is not a new clue.'},r.return,()=>r.return='wait');
 case 'close':return evaluate({pass:CUES.every((c,i)=>r.order?.[i]===c.id),skill:'retrieval',message:'Keep what happened. Check the thought. Change what the clues show. Remembering these steps is one part of learning to use them.'},r.order,()=>r.order=CUES.map(c=>c.id));
 }
}
function finishSession(){
 running=false;session.ended=true;$('#session-controls').hidden=true;const s=completionSummary(session);
 if(!session.saved){progress=mergeProgress(progress,session);session.saved=true;if(remember){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));session.persisted=true;}catch{session.storageFailed=true;}}}
 app.innerHTML=`<section class="completion" id="stage" tabindex="-1"><p class="eyebrow">CBT · Check a thought</p><h1>${s.complete?'You reached the end.':'Here is what you tried.'}</h1><p class="intro-copy">${s.updated?esc(session.revised):'You can stop at any time. We only count the things you tried.'}</p><div class="summary-grid"><div class="summary-card"><h2>${session.updateDemonstrated?'You saw a new thought':s.updated?'You checked a thought':'A thought to check next time'}</h2><p>${session.updateDemonstrated?'We showed one way to change the thought. You can try it yourself next time.':s.updated?'You kept what happened and looked again at the thought.':'You stopped before this step. That is okay.'}</p></div><div class="summary-card"><h2>${s.acted?'You made a next step':session.actionDemonstrated?'You saw one way':'A step to try next time'}</h2><p>${s.acted?'You changed the picture or made a plan to find a missing rule.':session.actionDemonstrated?'We showed you how. You can try it yourself another time.':'You have not tried this step yet.'}</p></div><div class="summary-card"><h2>${s.independentAttempts?`${s.independentSuccesses} of ${s.independentAttempts} worked on your first try`:'You have not tried a new story on your own yet'}</h2><p>${s.independentAttempts?'These were choices in made-up stories. Using the skill in your own life takes more practice.':'Using help and trying on your own are both parts of practice.'}</p></div></div><p class="status-note">${s.repairs?`You used help ${s.repairs} ${s.repairs===1?'time':'times'}. `:''}${s.delayed?'You tried an earlier skill again. ':''}${session.storageFailed?'We could not save this on your device. It stays on this page for now.':remember?'Your practice is saved on this device.':'Your practice stays here until you close the page.'}</p><div class="action-bar"><a class="primary return-link" href="${RETURN_URL}">Back to Mind</a><button class="secondary" data-action="restart">Try again</button></div></section>`;
 $('#stage').focus();window.scrollTo({top:0,behavior:'instant'});
}
app.addEventListener('click',event=>{
 const b=event.target.closest('button[data-action]');if(!b||b.disabled)return;
 const action=b.dataset.action;
 if(action==='start')return begin();
 if(action==='duration'){minutes=Number(b.dataset.value);intro();app.querySelector('.duration-option.selected')?.focus();return;}
 if(action==='restart')return intro();
 if(action==='clear-progress'){openDialog('Clear saved practice?','This will clear your CBT practice from this device.',[['clear','Clear it'],['resume','Keep it']]);return;}
 if(!session||session.ended)return;
 const r=response();
 if(action==='next')return markAndNext();
 if(action==='end')return finishSession();
 if(action==='submit')return submit();
 if(action==='help'){session.help[id()]=true;paint(false);say('Here is some help. We will remember that you used it.');return;}
 if(action==='choose'){
  if(b.dataset.group==='model'){r.model=r.model||[];const v=b.dataset.value;if(r.model.includes(v))r.model=r.model.filter(x=>x!==v);else if(r.model.length<2)r.model.push(v);else say('Pick up to two ideas. Tap an idea again to put it back.');}
  else r[b.dataset.group]=b.dataset.value;
 }
 if(action==='sort'||action==='inspect'){r[b.dataset.card]=b.dataset.value;const cards=action==='sort'?SORT_CARDS:inspectTargets(session.evidence);const next=cards.findIndex(c=>r[c.id]===undefined);if(next>=0)r.cardIndex=next;}
 if(action==='card-page')r.cardIndex=Number(b.dataset.value);
 if(action==='prediction-next'){r.predictionPart=1;paint();return;}
 if(action==='prediction-back'){r.predictionPart=0;paint();return;}
 if(action==='count'){const field=b.dataset.field;r[field]=Math.max(1,Math.min(6,Number(r[field])+Number(b.dataset.delta)));}
 if(action==='tile'){r.order=r.order||[];if(!r.order.includes(b.dataset.value))r.order.push(b.dataset.value);}
 if(action==='remove-tile')r.order.splice(Number(b.dataset.value),1);
 if(action==='repair-probe'){executeProbe(session,'clarify');r.repairClosed=true;for(const t of inspectTargets(session.evidence))delete r[t.id];r.feedback=null;session.help.inspect=true;}
 if(action==='keep-evidence')r.repairClosed=true;
 paint(false);
});
app.addEventListener('change',event=>{
 if(event.target.id==='self-paced'){selfPaced=event.target.checked;return;}
 if(event.target.id==='remember'){remember=event.target.checked;if(!remember){try{localStorage.removeItem(PROGRESS_KEY);}catch{}}intro();return;}
 if(event.target.dataset.field&&session){response()[event.target.dataset.field]=event.target.value;const field=event.target.dataset.field;paint(false);app.querySelector(`[data-field="${field}"]`)?.focus({preventScroll:true});}
});
dialog.addEventListener('click',event=>{
 const action=event.target.closest('[data-dialog]')?.dataset.dialog;if(!action)return;
 if(action==='end'){closeDialog();return finishSession();}
 if(action==='extend'){session.extension=(session.extension||0)+120;closeDialog();return;}
 if(action==='self'){session.pacing='self';closeDialog();return;}
 if(action==='clear'){try{localStorage.removeItem(PROGRESS_KEY);}catch{}progress=safeProgress({});remember=false;closeDialog();intro();return;}
 closeDialog();
});
dialog.addEventListener('cancel',event=>{event.preventDefault();if(session&&remaining()===0&&session.pacing==='clock')dialogResume=false;closeDialog();});
$('#about').addEventListener('click',about);
$('#pause').addEventListener('click',()=>{openDialog('Paused','Your place and time are safe. Keep going when you are ready.',[['resume','Keep going'],['end','Stop here']]);dialogResume=true;});
$('#finish').addEventListener('click',()=>openDialog('Stop for now?','We will show what you have tried so far.',[['resume','Keep going'],['end','Stop here']]));
$('#timer').addEventListener('click',()=>{timeHidden=!timeHidden;tick();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&session&&!session.ended&&running){tick();openDialog('Paused','The clock stopped when you left this page.',[['resume','Keep going'],['end','Stop here']]);}
 lastTick=performance.now();
});
window.addEventListener('pagehide',()=>{running=false;});
window.addEventListener('pageshow',event=>{if(event.persisted&&session&&!session.ended){running=true;openDialog('Paused','You are back. Your place is safe.',[['resume','Keep going'],['end','Stop here']]);}});
intro();
