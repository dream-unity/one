import {
 VERSION, PROGRESS_KEY, VARIANTS, ORIGINAL, EVIDENCE, PROBES, CAUSES, SORT_CARDS, LOOP, CUES, STAGES,
 createSession, safeProgress, assistanceFor, shuffled, executeProbe, probeResult, knowledgeFrom,
 warrantedStatement, inspectTargets, evaluateSort, evaluateScope, evaluateLoop, evaluatePrediction,
 evaluateInspect, evaluateUpdate, evaluateAction, evaluateTransfer, recordAttempt, mergeProgress,
 completionSummary, nextStage
} from './engine.js?v=cbt-3';
import {TRANSFER_CASES} from './scenarios.js?v=cbt-3';

const $=selector=>document.querySelector(selector);
const app=$('#app'),dialog=$('#dialog');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RETURN_URL='../../?return=machine-mind-model&focus=model';
const STAGE_SKILL={separate:'sources',scope:'scope',loop:'loop',model:'model',predict:'prediction',probe:'probe',inspect:'sources',update:'update',act:'action'};
const FADED_LEADS={separate:'Sort the claims by their source.',scope:'Set the reach of the evidence.',loop:'Reconstruct the maintaining sequence.',predict:'Commit your forecast and a revision condition.',inspect:'Use the evidence your action produced.',update:'Revise the original account.',act:'Use the available criteria and set a stopping point.'};
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
function choices(group,items,selected){return `<div class="choice-grid" role="group" aria-label="${esc(group)}">${items.map(x=>choice(group,x.id,x.label,x.detail||'',Array.isArray(selected)?selected.includes(x.id):selected===x.id)).join('')}</div>`;}
function primary(label='Check this move',disabled=false,action='submit'){return `<button type="button" class="primary" data-action="${action}" ${disabled?'disabled':''}>${esc(label)} <span aria-hidden="true">→</span></button>`;}
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
 if(result.pass){r.done=true;r.feedback={pass:true,title:r.tried>1?'Repair completed':'Move checked',message:result.message};}
 else if(r.tried>=2&&demonstrate){demonstrate();r.done=true;r.feedback={pass:false,title:'A worked example',message:result.message+' The completed example is shown below. This was supported practice.'};recordAttempt(session,{stage:id(),skill:result.skill,pass:false,mode:'demonstrated',caseId:`prototype-${session.world.id}`});}
 else {r.feedback={pass:false,title:'Make a focused repair',message:result.message};session.help[id()]=true;}
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
 $('#timer').textContent=session.pacing==='self'?'Self-paced':timeHidden?'Time':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
 $('#timer').setAttribute('aria-label',timeHidden?'Show the remaining time':'Hide the remaining time');
 if(left===0&&session.pacing==='clock'&&running&&!dialog.open&&!session.ended){
  openDialog('Your time window is complete','Your current move is saved in this session. Choose whether to continue it or finish with a record of what you practised.',[
   ['extend','Continue · add 2 minutes'],['self','Continue at my own pace'],['end','Finish here']
  ]);
 }
}
setInterval(tick,500);
function openDialog(title,text,actions,extra=''){
 dialogResume=running;running=false;lastTick=performance.now();
 dialog.innerHTML=`<h2 id="dialog-title">${esc(title)}</h2><p>${esc(text)}</p>${extra}<div class="modal-actions">${actions.map(([action,label],i)=>`<button type="button" class="${i===0?'primary':'secondary'}" data-dialog="${action}">${esc(label)}</button>`).join('')}</div>`;
 if(!dialog.open)dialog.showModal();
}
function closeDialog(){dialog.close();running=dialogResume&&!!session&&!session.ended&&!document.hidden;lastTick=performance.now();$('#pause').textContent=running?'Pause':'Resume';}
function about(){openDialog('Cognitive behavioural therapy (CBT)','CBT is a structured psychological approach that explores how situations, interpretations, feelings, body responses and actions influence one another. It develops skills for testing thoughts, solving practical problems and changing unhelpful patterns through practice.',[['resume','Back']],`<p>This exercise uses supplied fictional situations. Nothing asks for your personal story. Progress stays in this session unless you choose to remember it on this device.</p><p>The training draws on CBT and learning research; this particular exercise has not been clinically validated.</p><p><a href="https://www.nice.org.uk/guidance/ng222/chapter/recommendations" target="_blank" rel="noopener noreferrer">NICE: CBT and behavioural approaches</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/21819813/" target="_blank" rel="noopener noreferrer">Research on thought records and experiments</a></p>`);}
function intro(){
 session=null;running=false;$('#session-controls').hidden=true;
 app.innerHTML=`<section class="intro" id="stage" tabindex="-1"><p class="eyebrow">Mind / Model</p><h1>Cognitive behavioural therapy <span>(CBT)</span></h1><p class="intro-copy">CBT explores how thoughts, feelings and actions influence one another. Practise investigating an interpretation, testing it against evidence, and taking a useful next step.</p><p>Work through a fictional situation, one move at a time. No writing or personal disclosure.</p><p class="field-label" id="duration-label">Choose your practice window</p><div class="duration-group" role="group" aria-labelledby="duration-label">${[[4,'Focused'],[8,'Full cycle'],[12,'More variation']].map(([n,label])=>`<button type="button" class="duration-option ${minutes===n?'selected':''}" aria-pressed="${minutes===n}" data-action="duration" data-value="${n}">${n} minutes<small>${label}</small></button>`).join('')}</div><label class="preference"><input id="self-paced" type="checkbox" ${selfPaced?'checked':''}> Work at my own pace</label><label class="preference"><input id="remember" type="checkbox" ${remember?'checked':''}> Remember skill practice on this device</label><p class="status-note">${remember?'Only task progress is remembered. You can clear it here.':'Progress is session-only. No account, recording or personal story.'}</p>${progress.sessions?`<p class="status-note">${progress.sessions} previous practice ${progress.sessions===1?'session':'sessions'} available for variation. <button class="quiet" data-action="clear-progress">Clear remembered progress</button></p>`:''}<div class="action-bar">${primary('Begin practice',false,'start')}<span class="timer-note">Time guides the session. You can pause or extend it.</span></div></section>`;
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
function board(){
 if(transferStage()){
  const c=currentCase();return `<aside class="scene-panel" aria-label="Current fictional situation"><p class="eyebrow">Fictional situation</p><h2 class="scene-title">${esc(c.title)}</h2><p class="case-note">${esc(c.scene)}</p><ul class="scene-facts">${c.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${c.claim!=='No belief claim is needed here.'?`<div class="thought"><span class="source">The character’s interpretation</span>${esc(c.claim)}</div>`:''}</aside>`;
 }
 const k=knowledgeFrom(session.evidence);
 return `<aside class="scene-panel" aria-label="Current fictional situation"><p class="eyebrow">Fictional situation</p><h2 class="scene-title">The revised prototype</h2><p class="case-note">Ari receives a review of a first draft.</p><div class="case-note"><strong>“These need work. Review at 3.”</strong></div><div class="prototype" aria-label="Two panels marked for revision"><div class="panel ${session.actionDone&&k.units?'fixed':'marked'}">Panel A<br><strong>${session.actionDone&&k.units?'200 mm':'20 cm'}</strong></div><div class="panel ${session.actionDone&&k.layout?'fixed':'marked'}">Panel B<br><strong>${session.actionDone&&k.layout?'4':'3'} columns</strong></div></div><div class="thought"><span class="source">${session.revised?'Revised interpretation':'Ari’s interpretation'}</span>“${esc(session.revised||session.original.claim)}”</div><p class="case-note">Ari feels embarrassed and holds back the next draft.</p>${session.evidence.length?`<details class="evidence-drawer"><summary>Evidence collected · ${session.evidence.length}</summary><div class="evidence-list">${session.evidence.map(evidenceCard).join('')}</div></details>`:''}<p class="status-note">The characters and outcomes are authored fiction.</p></aside>`;
}
function evidenceCard(eid){const e=EVIDENCE[eid];return `<article class="evidence-card"><span class="source">${esc(e.source)}</span><p>${esc(e.text)}</p></article>`;}
function paint(focus=true){
 const oldKey=document.activeElement?.dataset.key,oldAction=document.activeElement?.dataset.action;const stage=id(),r=response(),meta=STAGES[stage];
 const page=renderStage(stage,r);
 const faded=assistanceFor(session.progress,STAGE_SKILL[stage])==='faded';
 if(faded&&FADED_LEADS[stage]&&!session.help[stage])page.lead=FADED_LEADS[stage];
 const completed=r.done;
 app.innerHTML=`<div class="workspace">${board()}<section class="exercise-panel" id="stage" tabindex="-1" aria-labelledby="stage-title"><div class="stage-meta"><span>${esc(meta.phase)}</span><span aria-hidden="true">·</span><span>${session.cursor+1} / ${session.plan.length}</span></div><div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${Math.round(session.cursor/session.plan.length*100)}%"></div></div><h1 class="stage-title" id="stage-title">${esc(page.title||meta.title)}</h1>${page.lead?`<p class="stage-lead">${esc(page.lead)}</p>`:''}<fieldset class="stage-body" ${completed?'disabled':''}>${page.body}</fieldset>${feedbackHTML(r)}<div class="action-bar">${completed?primary('Continue',false,'next'):page.footer||primary('Check this move',!page.ready)}${!completed&&page.help?`<button class="quiet" type="button" data-action="help">Show a hint</button>`:''}</div>${session.help[stage]&&page.help?note(page.help):''}</section></div>`;
 if(focus){$('#stage').focus({preventScroll:true});if(session.cursor)$('#stage-title').scrollIntoView({block:'start',behavior:'instant'});}
 else {const exact=oldKey?[...app.querySelectorAll('[data-key]')].find(el=>el.dataset.key===oldKey):null;
 const fallback=oldAction==='tile'?app.querySelector('.tile-bank button, [data-action=submit]'):oldAction?app.querySelector(`[data-action="${oldAction}"]`):null;
 (exact||fallback||$('#stage')).focus({preventScroll:true});}
}
function renderStage(stage,r){
 const k=knowledgeFrom(session.evidence);
 switch(stage){
 case 'arrival':return {lead:'Read the message and Ari’s interpretation. You will help Ari discover what the feedback warrants and what to do next.',body:`<div class="statement"><span class="source">The fact</span>${esc(session.original.fact)}</div><div class="statement"><span class="source">The added claim</span>“${esc(session.original.claim)}”</div>${note('You can keep the scene and collected evidence open throughout. No answer is timed.')}`,footer:primary('Work with this situation',false,'next')};
 case 'separate':return {lead:'Attach each statement to the source that supports it. A feeling can be real without proving someone else’s opinion.',body:SORT_CARDS.map(c=>`<div class="sort-row"><p class="sort-text">${esc(c.text)}</p><div class="segmented" role="group" aria-label="Source for ${esc(c.text)}">${[['prototype','Panels'],['message','Message'],['character','Ari’s report'],['unshown','Not shown']].map(([value,label])=>`<button type="button" data-action="sort" data-value="${value}" data-card="${c.id}" data-key="${c.id}-${value}" aria-pressed="${r[c.id]===value}" class="${r[c.id]===value?'selected':''}">${label}</button>`).join('')}</div></div>`).join(''),ready:SORT_CARDS.every(c=>r[c.id]),help:'The prototype shows the marks. The message gives the time. The story reports embarrassment. No source gives everyone’s judgment.'};
 case 'scope':return {lead:'Keep the criticism that is supported. Choose the reach of this particular review message.',body:choices('scope',[{id:'panels',label:'These two panels'},{id:'project',label:'Every part of this project'},{id:'ability',label:'All of Ari’s ability'},{id:'identity',label:'Whether Ari belongs'}],r.scope),ready:!!r.scope,help:'Two marks can justify revising two panels. A wider conclusion would need evidence that reaches further.'};
 case 'loop':return {lead:'Tap the pieces to connect interpretation → response → action → consequence. Tap a placed piece to return it.',body:`${slots(r.order||[],session.tileOrder,'loop')}<div class="tile-bank">${session.tileOrder.filter(t=>!(r.order||[]).includes(t.id)).map(t=>`<button class="tile" data-action="tile" data-key="tile-${t.id}" data-value="${t.id}">${esc(t.text)}</button>`).join('')}</div>${note('The message starts this scene. This chain represents Ari’s response, not a rule about everybody.')}`,ready:r.order?.length===4,help:'Withholding the draft comes after embarrassment and prevents the feedback that might clarify the meaning.'};
 case 'model':return {lead:'Select one or two causes that could explain the marks. More than one may contribute; none is established yet.',body:choices('model',CAUSES.map(c=>({id:c.id,label:c.label})),r.model||[])+note((r.model||[]).length?`Your working explanation: ${(r.model||[]).map(x=>CAUSES.find(c=>c.id===x).label.toLowerCase()).join(' + ')}. The reviewer’s broader evaluation remains unknown.`:'Use the scene to generate possibilities before looking for an answer.'),ready:!!r.model?.length,footer:primary('Keep this working explanation',!r.model?.length),help:'A technical error, a changed rule and a recurring skill problem can all be investigated. Selecting a possibility does not make it a fact.'};
 case 'predict':return {lead:`Your working explanation: ${session.model.map(x=>CAUSES.find(c=>c.id===x).label.toLowerCase()).join(' + ')}. Choose an observation it predicts, then set a rule for widening the concern.`,body:`<p class="field-label">If that explanation fits, I would expect…</p>${choices('forecast',[...CAUSES.map(c=>({id:c.id,label:c.forecast})),{id:'tone',label:'Another short reply.'}],r.forecast)}<p class="field-label">I would take a broader concern seriously if…</p>${choices('counter',[{id:'history',label:'Specific examples show a recurring issue across tasks.'},{id:'calm',label:'Ari feels calmer after the reply.'},{id:'brief',label:'The next reply is also brief.'}],r.counter)}`,ready:!!r.forecast&&!!r.counter,help:'The forecast should follow from your chosen cause. Decide what counts as broader evidence before the result appears.'};
 case 'probe':return {lead:'Each move changes what happens next. Choose the source and question that serve your prediction.',body:`<p class="statement"><span class="source">Your committed forecast</span>${esc(CAUSES.find(c=>c.id===session.prediction.forecast)?.forecast||'A specific observable result.')}</p>${choices('probe',session.probeOrder,r.probe)}${r.probe?note(`Source: ${PROBES.find(p=>p.id===r.probe).source}. The result is still hidden.`):''}`,ready:!!r.probe,footer:primary('Carry out this move',!r.probe)};
 case 'inspect':return {lead:session.probes.at(-1).effect,body:`<div class="evidence-list">${session.evidence.map(evidenceCard).join('')}</div>${!r.repairClosed&&session.probes.length===1&&session.probes[0].probeId!=='clarify'?`<div class="task-result"><p>You can make one follow-up or continue with these limits.</p>${primary('Ask about the criteria and scope',false,'repair-probe')} <button class="secondary" data-action="keep-evidence">Keep this evidence</button></div>`:''}<h2 class="field-label">Attach each conclusion to its evidence state</h2>${inspectTargets(session.evidence).map(t=>`<div class="sort-row"><p>${esc(t.text)}</p><div class="segmented" role="group" aria-label="Evidence for ${esc(t.text)}">${[['supported','Supported'],['open','Still open'],['unsupported','Beyond the evidence']].map(([v,l])=>`<button data-action="inspect" data-card="${t.id}" data-value="${v}" data-key="${t.id}-${v}" aria-pressed="${r[t.id]===v}" class="${r[t.id]===v?'selected':''}">${l}</button>`).join('')}</div></div>`).join('')}`,ready:inspectTargets(session.evidence).every(t=>r[t.id]),help:'An unanswered practical question stays open. A global identity verdict goes beyond the kinds of evidence these cards contain.'};
 case 'update':{
  const expected=warrantedStatement(session.evidence);
  if(!r.options)r.options=shuffled([...new Set([expected,...['local','broader','mixed','unresolved'].map(v=>warrantedStatement(({local:['L1','L2','L3'],broader:['B1','B2','B3'],mixed:['M1','M2','M3','M4'],unresolved:['U2','U3']})[v]))])]);
  return {lead:'Keep the before-and-after connected. Change only what your evidence warrants.',body:`<div class="claim-row"><p class="claim-original"><span class="source">Original fact</span>${esc(session.original.fact)}</p>${choices('fact',[{id:'keep',label:'Keep this fact'},{id:'remove',label:'Remove this fact'}],r.fact)}</div><div class="claim-row"><p class="claim-original"><span class="source">Original interpretation</span>“${esc(session.original.claim)}”</p><p class="field-label">Replace that interpretation with…</p>${choices('replacement',r.options.map((text,i)=>({id:String(i),label:text})),r.replacement)}</div>`,ready:!!r.fact&&r.replacement!==undefined,help:'Preserve the revision request. A documented recurring problem belongs in the update when it is actually in your evidence.'};
 }
 case 'act':return actionPage(r,k);
 case 'transfer':case 'transfer2':case 'recall':return transferPage(r);
 case 'sources':return {lead:'A separate fictional example: a review history says the units problem occurred before. A reviewer summarises that history. The specification record separately documents a layout change.',body:`<div class="evidence-list"><article class="evidence-card"><span class="source">A · Review history</span>The previous task had a units error.</article><article class="evidence-card"><span class="source">B · Reviewer, quoting A</span>“As the history shows, the units error happened before.”</article><article class="evidence-card"><span class="source">C · Specification log</span>The layout changed this morning.</article></div><p class="field-label">Which two cards share the same underlying report?</p>${choices('linked',[{id:'ab',label:'A and B'},{id:'ac',label:'A and C'},{id:'bc',label:'B and C'}],r.linked)}${r.linked?note('Now reverse the case: two reviewers independently measure the same error. Their similar wording alone would not make them one source.') : ''}`,ready:!!r.linked,help:'Trace where a claim originated. Repetition can be a summary; independent measurements can also agree.'};
 case 'replay':{
  const neutral=probeResult(session.world,'clarify'),accusatory=probeResult(session.world,'accuse');
  return {lead:'This is an authored comparison from the same starting situation. Inspect how changing the question changes what becomes observable.',body:`<div class="paired"><div class="outcome-comparison"><h2 class="field-label">Specific question</h2>${neutral.ids.map(evidenceCard).join('')}</div><div class="outcome-comparison"><h2 class="field-label">Accusatory question</h2>${accusatory.ids.map(evidenceCard).join('')}</div></div><p class="field-label">What can the changed reply establish?</p>${choices('replay',[{id:'exchange',label:'The question changed the exchange; the reply alone cannot establish the prior opinion.'},{id:'rejection',label:'The defensive reply proves the reviewer had already rejected Ari.'},{id:'universal',label:'Accusatory questions always produce this response in real life.'}],r.replay)}`,ready:!!r.replay,help:'This comparison concerns the authored scene. It is not an observed counterfactual about real people.'};
 }
 case 'delayed':return {lead:'Return to Ari’s decision. The page still shows the same review note. No new evidence has arrived, and the review time has not yet come.',body:choices('return',[{id:'wait',label:'Keep the plan; return at the review or if relevant information changes.'},{id:'check',label:'Read the same note until completely certain.'},{id:'never',label:'Never review this question again.'}],r.return),ready:!!r.return,help:'A stopping point is conditional. New information or the agreed review time can make another check useful.'};
 case 'close':return {lead:'Rebuild a compact cue in your own sequence of actions. You can finish without this final retrieval.',body:`${slots(r.order||[],CUES,'cue')}<div class="tile-bank">${session.cueOrder.filter(t=>!(r.order||[]).includes(t.id)).map(t=>`<button class="tile" data-action="tile" data-key="tile-${t.id}" data-value="${t.id}">${esc(t.text)}</button>`).join('')}</div>`,ready:r.order?.length===3,footer:`${primary('Check the cue',r.order?.length!==3)}<button class="quiet" data-action="end">Finish practice</button>`};
 default:return {body:'',footer:primary('Finish',false,'end')};
 }
}
function slots(order,tiles,name){return `<div class="slots" aria-label="${name==='loop'?'Your causal chain':'Your procedural cue'}">${tiles.map((_,i)=>{const t=tiles.find(t=>t.id===order[i]);return `<button type="button" class="slot" data-action="remove-tile" data-key="slot-${i}" data-value="${i}" ${!t?'disabled':''}><span class="slot-number">${i+1}</span>${t?esc(t.text):'Place a piece'}</button>`;}).join('')}</div>`;}
function selectField(name,label,options,value){return `<label class="control-group"><span class="field-label">${esc(label)}</span><select data-field="${name}">${options.map(([v,l])=>`<option value="${v}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
function actionPage(r,k){
 if(r.unit===undefined)Object.assign(r,{unit:'cm',value:20,columns:3,practice:'',question:'',returnWhen:''});
 const instructions=[];if(k.units)instructions.push('Use millimetres for Panel A without changing its length.');if(k.layout)instructions.push('Apply the current four-column layout.');if(k.repeated)instructions.push('Try the supplied units check on a second example.');if(!k.units||!k.layout)instructions.push('Prepare a question for the criterion that is still missing.');
 let body=`<ul class="rule-list">${instructions.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><div class="panel-work">`;
 if(k.units)body+=`<div class="panel"><h2 class="field-label">Panel A · original length 20 cm</h2>${selectField('value','Number',[[20,'20'],[200,'200'],[2,'2']],r.value)}${selectField('unit','Unit',[['cm','cm'],['mm','mm']],r.unit)}<p class="status-note">Conversion supplied: 1 cm = 10 mm.</p><div class="measurement-bar" style="width:${Math.min(100,(r.unit==='cm'?Number(r.value)*10:Number(r.value))/2)}%"></div></div>`;
 if(k.layout)body+=`<div class="panel"><h2 class="field-label">Panel B · current requirement: four columns</h2>${selectField('columns','Columns',[[3,'3 columns'],[4,'4 columns'],[5,'5 columns']],r.columns)}<div class="column-preview" aria-hidden="true">${Array.from({length:Number(r.columns)},()=>'<i></i>').join('')}</div></div>`;
 body+='</div>';
 if(k.repeated)body+=selectField('practice','Practise once: 3 cm equals…',[['','Choose a value'],[3,'3 mm'],[30,'30 mm'],[300,'300 mm']],r.practice);
 if(!k.units||!k.layout)body+=`<p class="field-label">Prepare the next information step</p>${choices('question',[{id:'criteria',label:'At 3, ask which criteria the remaining mark refers to and whether concerns extend beyond it.'},{id:'approve',label:'Ask again whether everyone approves of Ari.'}],r.question)}`;
 body+=`<p class="field-label">After this step, return to the question…</p>${choices('returnWhen',[{id:'new-or-review',label:'At the review, or when relevant new information arrives.'},{id:'certain',label:'Keep reopening it until certainty feels complete.'}],r.returnWhen)}`;
 return {lead:k.nonDiagnostic?'The cause is unresolved. Prepare a specific, bounded next step instead of guessing at corrections.':'Use the available requirements to edit the working copy. The check will inspect the actual values you set.',body,ready:!!r.returnWhen&&((k.units&&k.layout)||!!r.question)&&(!k.repeated||!!r.practice),footer:primary(k.nonDiagnostic?'Prepare the review plan':'Run the criteria check',!r.returnWhen||(!(k.units&&k.layout)&&!r.question)||(k.repeated&&!r.practice)),help:'Changing a unit label must preserve the length. A missing requirement calls for a question, not a guessed correction.'};
}
function transferPage(r){
 const c=currentCase(),options=session.caseOptions[c.id];
 if(!r.executed)return {lead:'The facts are in the scene. Choose an action; its consequence will appear next.',body:choices('move',options,r.move),ready:!!r.move,footer:primary('Take this action',!r.move),help:'Ask what this situation needs: evidence, a practical step, a bounded update, or a stopping point. A reasonable belief does not always need challenging.'};
 const option=c.options.find(o=>o.id===r.move);
 return {title:'What makes that move fit?',lead:option.effect,body:`<p class="statement"><span class="source">Your action</span>${esc(option.label)}</p>${choices('reason',session.caseReasons[c.id].map(x=>({id:x.id,label:x.text})),r.reason)}<p class="field-label">Confidence in this decision <span class="status-note">· optional, not a score</span></p>${choices('confidence',[{id:'tentative',label:'Tentative'},{id:'moderate',label:'Fairly sure'},{id:'strong',label:'Very sure'}],r.confidence)}`,ready:!!r.reason,help:c.principle};
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
  return evaluate(res,{fact:r.fact,replacement},()=>{r.fact='keep';r.replacement=String(r.options.indexOf(warrantedStatement(session.evidence)));session.revised=warrantedStatement(session.evidence);});
 }
 case 'act':{
  const res=evaluateAction(session.evidence,r);if(res.pass)session.actionDone=true;
  return evaluate(res,{...r},()=>{Object.assign(r,{unit:'mm',value:200,columns:4,practice:30,question:'criteria',returnWhen:'new-or-review'});session.actionDone=false;session.actionDemonstrated=true;});
 }
 case 'transfer':case 'transfer2':case 'recall':{
  if(!r.executed){r.executed=true;return paint();}
  const c=currentCase(),res=evaluateTransfer(c,r.move,r.reason);
  record(res,{move:r.move,reason:r.reason,confidence:r.confidence},r.tried?'repair':undefined);
  if(res.pass){r.done=true;r.feedback={pass:true,title:r.tried===1&&!session.help[stage]?'Independent attempt checked':'Supported attempt checked',message:c.explanation};}
  else if(r.tried>=2){r.done=true;r.feedback={pass:false,title:'A defensible route',message:`${c.options.find(o=>o.valid).label}. ${c.explanation} This item remains supported practice.`};}
  else {r.feedback={pass:false,title:'Try one focused repair',message:c.explanation};session.help[stage]=true;r.executed=false;r.move=undefined;r.reason=undefined;}
  paint(false);$('#feedback')?.focus();return;
 }
 case 'sources':return evaluate({pass:r.linked==='ab',skill:'sources',message:'A and B repeat the same history. C is a separate record. Similar wording does not, by itself, make two measurements dependent.'},r.linked,()=>r.linked='ab');
 case 'replay':return evaluate({pass:r.replay==='exchange',skill:'probe',message:'The question is part of the intervention. The altered reply cannot by itself reveal the reviewer’s previous attitude, or a universal rule about people.'},r.replay,()=>r.replay='exchange');
 case 'delayed':return evaluate({pass:r.return==='wait',skill:'stopping',message:'Keep the stopping condition. A genuinely new fact or the scheduled review is a reason to return; unchanged evidence is not a new test.'},r.return,()=>r.return='wait');
 case 'close':return evaluate({pass:CUES.every((c,i)=>r.order?.[i]===c.id),skill:'retrieval',message:'Keep the fact. Test the added claim. Change what the result warrants. Retrieving this cue is separate from applying it in a new situation.'},r.order,()=>r.order=CUES.map(c=>c.id));
 }
}
function finishSession(){
 running=false;session.ended=true;$('#session-controls').hidden=true;const s=completionSummary(session);
 if(!session.saved){progress=mergeProgress(progress,session);session.saved=true;if(remember){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));session.persisted=true;}catch{session.storageFailed=true;}}}
 app.innerHTML=`<section class="completion" id="stage" tabindex="-1"><p class="eyebrow">Cognitive behavioural therapy (CBT)</p><h1>${s.complete?'Practice cycle complete.':'Your practice, so far.'}</h1><p class="intro-copy">${s.updated?esc(session.revised):'You can finish at any point. The record below includes only the parts you attempted.'}</p><div class="summary-grid"><div class="summary-card"><h2>${s.updated?'Conclusion updated':'Update not completed'}</h2><p>${s.updated?'The revision request and the interpretation were considered separately.':'No completed update is claimed for this session.'}</p></div><div class="summary-card"><h2>${s.acted?'Next step prepared':session.actionDemonstrated?'Worked example observed':'Action not completed'}</h2><p>${s.acted?'Available criteria were checked or missing information was turned into a review plan.':session.actionDemonstrated?'A worked example showed the required change. Independent execution remains unassessed.':'The practical step remains unassessed.'}</p></div><div class="summary-card"><h2>${s.independentAttempts?`${s.independentSuccesses} of ${s.independentAttempts} independent attempts`:'Independent application not assessed'}</h2><p>${s.independentAttempts?'These are first attempts on the fictional cases in this session. They do not establish everyday transfer.':'Supported practice and cue recall are kept separate from independent application.'}</p></div></div><p class="status-note">${s.repairs?`${s.repairs} supported repair or worked-example ${s.repairs===1?'record':'records'}. `:''}${s.delayed?'An earlier skill was revisited after a delay. ':''}${session.storageFailed?'Progress could not be saved on this device; it remains available in this open session.':remember?'Skill practice remembered on this device.':'This progress is available while this page remains open.'}</p><div class="action-bar"><a class="primary return-link" href="${RETURN_URL}">Return to Model</a><button class="secondary" data-action="restart">Another practice</button></div></section>`;
 $('#stage').focus();window.scrollTo({top:0,behavior:'instant'});
}
app.addEventListener('click',event=>{
 const b=event.target.closest('button[data-action]');if(!b||b.disabled)return;
 const action=b.dataset.action;
 if(action==='start')return begin();
 if(action==='duration'){minutes=Number(b.dataset.value);intro();app.querySelector('.duration-option.selected')?.focus();return;}
 if(action==='restart')return intro();
 if(action==='clear-progress'){openDialog('Clear remembered practice?','This removes the skill record for this CBT exercise from this device.',[['clear','Clear progress'],['resume','Keep it']]);return;}
 if(!session||session.ended)return;
 const r=response();
 if(action==='next')return markAndNext();
 if(action==='end')return finishSession();
 if(action==='submit')return submit();
 if(action==='help'){session.help[id()]=true;paint(false);say('Hint shown. This attempt will be recorded as supported.');return;}
 if(action==='choose'){
  if(b.dataset.group==='model'){r.model=r.model||[];const v=b.dataset.value;if(r.model.includes(v))r.model=r.model.filter(x=>x!==v);else if(r.model.length<2)r.model.push(v);else say('Choose at most two explanations. Tap one to remove it.');}
  else r[b.dataset.group]=b.dataset.value;
 }
 if(action==='sort'||action==='inspect')r[b.dataset.card]=b.dataset.value;
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
$('#pause').addEventListener('click',()=>{openDialog('Practice paused','Your place and remaining time are held. Continue when you are ready.',[['resume','Resume practice'],['end','Finish here']]);dialogResume=true;});
$('#finish').addEventListener('click',()=>openDialog('Finish this session?','Your summary will distinguish completed practice from anything still unassessed.',[['resume','Continue practising'],['end','Finish here']]));
$('#timer').addEventListener('click',()=>{timeHidden=!timeHidden;tick();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&session&&!session.ended&&running){tick();openDialog('Practice paused','Time stopped while this page was in the background.',[['resume','Resume practice'],['end','Finish here']]);}
 lastTick=performance.now();
});
window.addEventListener('pagehide',()=>{running=false;});
window.addEventListener('pageshow',event=>{if(event.persisted&&session&&!session.ended){running=true;openDialog('Practice paused','Your place is held after returning to this page.',[['resume','Resume practice'],['end','Finish here']]);}});
intro();
