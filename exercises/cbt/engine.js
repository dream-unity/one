// Pure training rules. Authored worlds are fixed before any learner response.
export const VERSION = '3.0.0';
export const PROGRESS_KEY = 'dreamunity:cbt:progress:v3';
export const VARIANTS = ['local', 'broader', 'mixed', 'unresolved'];
export const SKILLS = ['sources', 'scope', 'loop', 'model', 'prediction', 'probe', 'update', 'action', 'uncertainty', 'stopping'];
export const ORIGINAL = Object.freeze({fact: 'Two panels need revision.', claim: 'They have realised I do not belong here.'});
const card = (id, source, text, group, tags = []) => Object.freeze({id, source, text, group, tags: Object.freeze(tags)});
export const EVIDENCE = Object.freeze({
 L1: card('L1', 'Current rubric · 10:00', 'Panel A must use millimetres. Its labels currently show centimetres.', 'review', ['units']),
 L2: card('L2', 'Specification history · 09:00', 'Yesterday’s specification used three columns. Today’s version requires four.', 'specification', ['layout']),
 L3: card('L3', 'Reviewer · 10:15', 'Those are the corrections I can explain now. I can review the changes at 3; I cannot give a broader evaluation today.', 'review', ['scope-open']),
 B1: card('B1', 'Current rubric · 10:00', 'Panel A must use millimetres. Its labels currently show centimetres.', 'review', ['units']),
 B2: card('B2', 'Review log · previous two tasks', 'The two previous tasks also used the wrong measurement units; both were returned with this criterion.', 'review-history', ['repeated']),
 B3: card('B3', 'Reviewer · 10:15', 'I am concerned about this recurring measurement skill. I suggest a worked example and a units check before the next review.', 'review-history', ['repeated']),
 M1: card('M1', 'Current rubric · 10:00', 'Panel A must use millimetres. Its labels currently show centimetres.', 'review', ['units']),
 M2: card('M2', 'Specification history · 09:00', 'Yesterday’s specification used three columns. Today’s version requires four.', 'specification', ['layout']),
 M3: card('M3', 'Review log · previous task', 'One previous task had the same units error.', 'review-history', ['repeated']),
 M4: card('M4', 'Reviewer · 10:15', 'The layout changed after your first draft, and the units problem has occurred before. We need to address both.', 'review-summary', ['summary']),
 U2: card('U2', 'Rubric access · 10:15', 'The rubric is unavailable until the review.', 'access', ['unavailable']),
 U3: card('U3', 'Reviewer · 10:15', 'I cannot clarify this before 3.', 'review', ['unavailable']),
 R1: card('R1', 'Reviewer · after general reassurance request', 'We can discuss the work at the review.', 'reassurance', ['non-diagnostic']),
 A1: card('A1', 'Reviewer · after accusatory question', 'Please ask about the specific feedback.', 'exchange', ['non-diagnostic']),
 C1: card('C1', 'Working copy · after colour edit', 'The colour has changed. The marked requirements have not been addressed.', 'action', ['non-diagnostic']),
 W1: card('W1', 'Ari’s review plan', 'The review is at 3. Its outcome has not happened in this scene.', 'schedule', ['pending'])
});
const world = (id, rubric, full) => Object.freeze({id, rubric: Object.freeze(rubric), full: Object.freeze(full)});
export const WORLDS = Object.freeze({
 local: world('local', ['L1','L2'], ['L1','L2','L3']),
 broader: world('broader', ['B1'], ['B1','B2','B3']),
 mixed: world('mixed', ['M1','M2'], ['M1','M2','M3','M4']),
 unresolved: world('unresolved', ['U2'], ['U2','U3'])
});
export const PROBES = Object.freeze([
 {id:'rubric', label:'Inspect the current rubric', detail:'Open the available criteria. The reviewer’s wider evaluation is a separate question.', source:'Rubric and specification records', effect:'You opened the available records.'},
 {id:'clarify', label:'Inspect the rubric and ask a specific question', detail:'“Which criteria do these panels miss, and are there concerns beyond them?”', source:'Records and reviewer', effect:'You inspected the criteria and requested specific scope clarification.'},
 {id:'reassure', label:'Ask for general reassurance', detail:'“Do you still think I belong on the team?”', source:'Reviewer', effect:'The reply leaves the requirements and scope unanswered.'},
 {id:'cosmetic', label:'Change the prototype’s colour', detail:'Try a fresh appearance before asking about the marks.', source:'Working copy', effect:'The colour changed. The review’s question was not tested.'},
 {id:'accuse', label:'Ask why the reviewer has rejected Ari', detail:'“Why have you decided I don’t belong?”', source:'Reviewer', effect:'The question changed the exchange. This reply cannot establish the reviewer’s prior opinion.'},
 {id:'wait', label:'Prepare for the announced review', detail:'Ask about the marked criteria and their scope at 3. No unseen review result will be invented.', source:'Review schedule', effect:'A bounded review plan is ready. The review’s outcome remains unknown.'}
]);
export const CAUSES = [
 {id:'units', label:'A measurement requirement was missed', forecast:'A specific measurement criterion explains a mark.'},
 {id:'rule', label:'A requirement changed after the draft', forecast:'The specification history records a relevant change.'},
 {id:'skill', label:'A specific skill needs more practice', forecast:'The review log documents the same issue on earlier tasks.'}
];
export const SORT_CARDS = [
 {id:'panels', text:'Two panels are marked for revision.', source:'prototype'},
 {id:'time', text:'The review is at 3.', source:'message'},
 {id:'feeling', text:'Ari feels embarrassed.', source:'character'},
 {id:'judgment', text:'Everyone has lost confidence in Ari.', source:'unshown'}
];
export const LOOP = [
 {id:'meaning', text:'“I do not belong here.”'},
 {id:'feeling', text:'Embarrassment and apprehension'},
 {id:'avoidance', text:'Withhold the next draft'},
 {id:'feedback', text:'Miss feedback that could test the interpretation'}
];
export const CUES = [
 {id:'fact', text:'Keep the fact.'},
 {id:'test', text:'Test the added claim.'},
 {id:'update', text:'Change what the result warrants.'}
];
export const STAGES = {
 arrival: {title:'A small message. A much larger conclusion.', phase:'Notice', seconds:20},
 separate: {title:'Where did each claim come from?', phase:'Notice', seconds:35},
 scope: {title:'How far does the evidence reach?', phase:'Make sense', seconds:30},
 loop: {title:'Build the loop that keeps this going.', phase:'Make sense', seconds:40},
 model: {title:'Build another possible explanation.', phase:'Make sense', seconds:40},
 predict: {title:'Make your explanation testable.', phase:'Try a test', seconds:40},
 probe: {title:'Choose what to do—and what it can tell you.', phase:'Try a test', seconds:45},
 inspect: {title:'What did the action actually reveal?', phase:'Use the result', seconds:40},
 update: {title:'Edit the original conclusion.', phase:'Use the result', seconds:50},
 act: {title:'Make one useful change.', phase:'Take a step', seconds:35},
 transfer: {title:'Choose your next move.', phase:'A new situation', seconds:75},
 close: {title:'Carry the process forward.', phase:'Close', seconds:30},
 sources: {title:'Three messages. How many sources?', phase:'Look closer', seconds:65},
 replay: {title:'Did the test change the exchange?', phase:'Look closer', seconds:65},
 transfer2: {title:'Choose your next move.', phase:'A different situation', seconds:80},
 delayed: {title:'What would make another check useful?', phase:'Return to the decision', seconds:30},
 recall: {title:'Choose your next move.', phase:'Return to an earlier skill', seconds:60}
};
export function planFor(minutes=8) {
 if(minutes===4) return ['arrival','scope','predict','probe','inspect','update','act','close'];
 const standard=['arrival','separate','scope','loop','model','predict','probe','inspect','update','act','transfer','close'];
 if(minutes===12) standard.splice(10,0,'sources','replay');
 if(minutes===12) standard.splice(standard.length-1,0,'transfer2','delayed');
 return standard;
}
export function shuffled(items, random=Math.random) {
 const copy=[...items]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy;
}
export function safeProgress(value) {
 const v=value && typeof value==='object' ? value : {};
 const records=Array.isArray(v.records) ? v.records.filter(r=>r && typeof r.skill==='string' && typeof r.caseId==='string' && typeof r.at==='number' && Number.isFinite(r.at) && ['guided','independent','repair','demonstrated','unassessed'].includes(r.mode)).slice(-120).map(r=>({skill:r.skill.slice(0,30),caseId:r.caseId.slice(0,90),pass:r.pass===true,mode:r.mode,at:r.at,delayed:r.delayed===true})) : [];
 return {version:VERSION, sessions:Number.isSafeInteger(v.sessions)&&v.sessions>0?Math.min(v.sessions,100000):0,records,used:Array.isArray(v.used)?v.used.filter(x=>typeof x==='string').slice(-24):[]};
}
export function assistanceFor(progress, skill) {
 const records=safeProgress(progress).records.filter(r=>r.skill===skill);
 const recent=records.slice(-4);
 if(recent.some(r=>!r.pass)) return 'guided';
 const cases=new Set(recent.filter(r=>r.pass&&r.mode==='independent').map(r=>r.caseId));
 return cases.size>=2?'faded':'guided';
}
export function selectCases(cases, progress, count=2, random=Math.random) {
 const p=safeProgress(progress); const weak=new Set(p.records.slice(-12).filter(r=>!r.pass).map(r=>r.skill));
 const decorated=shuffled(cases,random).map(c=>({c,rank:(p.used.includes(c.id)?-10:0)+(weak.has(c.skill)?4:0)})).sort((a,b)=>b.rank-a.rank);
 const chosen=[]; for(const {c} of decorated){if(!chosen.some(x=>x.family===c.family))chosen.push(c);if(chosen.length===count)break;}
 return chosen;
}
export function createSession({minutes=8,pacing='clock',variant='local',progress={},cases=[],now=Date.now()}={}) {
 const duration=[4,8,12].includes(minutes)?minutes:8;
 const p=safeProgress(progress);
 const plan=planFor(duration);
 const due=p.records.findLast(r=>r.mode==='independent' && now-r.at>=86400000);
 const recall=due&&duration!==4 ? cases.find(c=>c.skill===due.skill && c.id!==due.caseId && !p.used.includes(c.id)) : null;
 const picked=selectCases(cases.filter(c=>c.id!==recall?.id),p,recall?2:3);
 if(recall){plan.splice(1,0,'recall');picked[2]=recall;}
 return {version:VERSION,minutes:duration,pacing:pacing==='self'?'self':'clock',world:WORLDS[variant]||WORLDS.local,plan,cursor:0,evidence:[],probes:[],responses:{},attempts:[],help:{},repairs:{},model:['units'],prediction:null,original:{...ORIGINAL},revised:null,actionDone:false,completed:[],cases:picked,progress:p,startedAt:now,elapsed:0,ended:false};
}
export function probeResult(worldValue, probeId) {
 const w=WORLDS[worldValue?.id]; if(!w)throw new Error('Unknown authored world');
 const p=PROBES.find(p=>p.id===probeId); if(!p)throw new Error('Unknown action');
 const ids=probeId==='rubric'?w.rubric:probeId==='clarify'?w.full:({reassure:['R1'],cosmetic:['C1'],accuse:['A1'],wait:['W1']})[probeId];
 return {probeId,ids:[...ids],effect:p.effect,source:p.source};
}
export function executeProbe(session, probeId) {
 if(!session.prediction)throw new Error('Commit a prediction before revealing results');
 if(session.probes.length>=2)throw new Error('One initial probe and one focused repair only');
 const result=probeResult(session.world,probeId);
 session.probes.push(result);session.evidence=[...new Set([...session.evidence,...result.ids])];
 return result;
}
export function knowledgeFrom(ids=[]) {
 const tags=new Set(ids.flatMap(id=>EVIDENCE[id]?.tags||[]));
 const units=tags.has('units'),layout=tags.has('layout'),repeated=tags.has('repeated');
 const state=repeated&&layout?'mixed':repeated?'broader':units&&layout?'local':units?'partial':'unresolved';
 return {units,layout,repeated,state,scopeOpen:!repeated,nonDiagnostic:!units&&!layout&&!repeated};
}
export function warrantedStatement(ids) {
 const state=knowledgeFrom(ids).state;
 return {
 local:'The feedback identifies two corrections; a broader evaluation has not been clarified.',
 broader:'The evidence shows a recurring measurement problem. A specific skill needs practice; it does not establish that Ari cannot improve.',
 mixed:'A changed layout requirement and a recurring units problem both matter. Each needs its own response.',
 partial:'A measurement correction is supported. The other mark and any broader concern still need clarification.',
 unresolved:'Two panels were marked. The reason and scope are still unclear.'
 }[state];
}
export function inspectTargets(ids) {
 const k=knowledgeFrom(ids);
 return [
  {id:'units',text:'A measurement criterion was missed.',answer:k.units?'supported':'open'},
  {id:'pattern',text:'The units issue has occurred on earlier tasks.',answer:k.repeated?'supported':'open'},
  {id:'identity',text:'Ari cannot improve or belong here.',answer:'unsupported'}
 ];
}
const result=(pass,skill,message,defects=[])=>({pass,skill,message,defects});
export function evaluateSort(answer={}) {
 const defects=SORT_CARDS.filter(c=>answer[c.id]!==c.source).map(c=>c.id);
 return result(!defects.length,'sources',defects.length?'Attach only what a source actually says. Ari’s feeling is reported in the scene; everyone’s opinion is not.':'You kept observations, a reported feeling and an added interpretation distinct.',defects);
}
export function evaluateScope(answer) {return result(answer==='panels','scope',answer==='panels'?'These two panels need work. The message gives no verdict about all projects or Ari’s identity.':'The marks reach these two panels. A later review could establish a wider, specific pattern.');}
export function evaluateLoop(order) {const correct=LOOP.map(x=>x.id);return result(Array.isArray(order)&&order.length===correct.length&&order.every((x,i)=>x===correct[i]),'loop','The interpretation is followed by embarrassment, withholding the draft and missing useful feedback. Interrupting the action can create a chance to learn even while embarrassment remains.');}
export function evaluatePrediction(model, forecast, counter) {
 const match=model.includes(forecast);return result(match&&counter==='history','prediction',!match?'Match the observation to the explanation you constructed. A changed rule predicts a version record; a measurement error predicts a criterion; a recurring skill problem predicts a history.':counter!=='history'?'A documented pattern across tasks would widen the concern. A short reply or a calmer feeling cannot establish that pattern.':'You specified observable evidence before seeing a reply. Several explanations could still contribute.');
}
export function evaluateInspect(ids, answer={}) {
 const defects=inspectTargets(ids).filter(t=>answer[t.id]!==t.answer).map(t=>t.id);
 return result(!defects.length,'sources',defects.length?'Use only the cards your action revealed. A question you did not answer stays open; an identity verdict exceeds these records.':'Your conclusions track the available evidence, including its limits.',defects);
}
export function evaluateUpdate(session, fact, replacement) {
 const expected=warrantedStatement(session.evidence);
 return result(fact==='keep'&&replacement===expected,'update',fact!=='keep'?'The request to revise two panels remains a fact. Retain it while changing the interpretation.':replacement!==expected?'The replacement must fit the evidence you actually obtained. Neither a global rejection nor universal approval is established.':'You preserved the fact and replaced the original identity claim with a bounded, evidence-based conclusion.');
}
export function evaluateAction(ids, action={}) {
 const k=knowledgeFrom(ids);const defects=[];
 if(k.units&&(action.unit!=='mm'||Number(action.value)!==200))defects.push('units');
 if(k.layout&&Number(action.columns)!==4)defects.push('layout');
 if(k.repeated&&Number(action.practice)!==30)defects.push('practice');
 if((!k.units||!k.layout)&&action.question!=='criteria')defects.push('question');
 if(action.returnWhen!=='new-or-review')defects.push('stopping');
 return result(!defects.length,'action',defects.length?'Keep the physical length unchanged: 20 cm = 200 mm, and 3 cm = 30 mm. Follow each available criterion; ask for the missing one. Revisit at 3 or when relevant information changes.':'The available criteria are addressed. Unanswered criteria remain open, with a specific review plan. This result concerns the work, not Ari’s worth.',defects);
}
export function evaluateTransfer(item, optionId, reasonId) {
 const option=item.options.find(o=>o.id===optionId);
 const pass=Boolean(option?.valid&&option.reasonIds.includes(reasonId));
 return result(pass,item.skill,item.explanation);
}
export function recordAttempt(session,{stage,skill,pass,mode='guided',caseId=session.world.id,delayed=false,answer=null,now=Date.now()}) {
 const snapshot=answer===null?null:JSON.parse(JSON.stringify(answer));
 const attempt={stage,skill,pass:pass===true,mode,caseId,delayed,answer:snapshot,at:now};
 session.attempts.push(attempt);return attempt;
}
export function mergeProgress(previous,session) {
 const p=safeProgress(previous);
 const records=session.attempts.map(({skill,pass,mode,caseId,delayed,at})=>({skill,pass,mode,caseId,delayed,at}));
 return safeProgress({sessions:p.sessions+1,records:[...p.records,...records],used:[...new Set([...p.used,...session.attempts.filter(a=>['transfer','transfer2','recall'].includes(a.stage)).map(a=>a.caseId)])]});
}
export function completionSummary(session) {
 const independent=session.attempts.filter(a=>['transfer','transfer2','recall'].includes(a.stage)&&a.mode==='independent');
 const repaired=session.attempts.filter(a=>a.mode==='repair'||a.mode==='demonstrated');
 return {complete:['probe','inspect','update','act'].every(id=>session.completed.includes(id)),independentAttempts:independent.length,independentSuccesses:independent.filter(a=>a.pass).length,repairs:repaired.length,updated:session.completed.includes('update'),acted:session.actionDone,delayed:independent.filter(a=>a.delayed).length};
}
export function nextStage(session, remaining=Infinity) {
 const optional=new Set(['sources','replay','transfer2','delayed']);
 session.cursor++;
 while(optional.has(session.plan[session.cursor])&&remaining<120)session.cursor++;
 // Never skip a committed experiment's result, update or action. Budget expiry is handled explicitly by the learner.
 return session.plan[session.cursor]||'summary';
}
