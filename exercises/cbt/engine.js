// Pure training rules. Authored worlds are fixed before any learner response.
export const VERSION = '3.1.0';
export const PROGRESS_KEY = 'dreamunity:cbt:progress:v3';
export const VARIANTS = ['local', 'broader', 'mixed', 'unresolved'];
export const SKILLS = ['sources', 'scope', 'loop', 'model', 'prediction', 'probe', 'update', 'action', 'uncertainty', 'stopping'];
export const ORIGINAL = Object.freeze({fact: 'Two parts need a change.', claim: 'They think I should not be here.'});
const card = (id, source, text, group, tags = []) => Object.freeze({id, source, text, group, tags: Object.freeze(tags)});
export const EVIDENCE = Object.freeze({
 L1: card('L1', 'Picture rules', 'Part A has three blue dots. The rules ask for four blue dots.', 'review', ['units']),
 L2: card('L2', 'Earlier rules', 'Part B has three boxes. Yesterday, that was right. Today, the rules ask for four boxes.', 'specification', ['layout']),
 L3: card('L3', 'Reply', 'I can explain these two changes now. We can look at them at 3. I cannot answer about the rest of Ari’s work today.', 'review', ['scope-open']),
 B1: card('B1', 'Picture rules', 'Part A has three blue dots. The rules ask for four blue dots.', 'review', ['units']),
 B2: card('B2', 'Old picture checks', 'The last two pictures were each missing a blue dot. Both checks asked Ari to add that dot.', 'review-history', ['repeated']),
 B3: card('B3', 'Reply', 'Ari has missed a dot before. Try a small example. Then count the dots before we look again.', 'review-history', ['repeated']),
 M1: card('M1', 'Picture rules', 'Part A has three blue dots. The rules ask for four blue dots.', 'review', ['units']),
 M2: card('M2', 'Earlier rules', 'Part B has three boxes. Yesterday, that was right. Today, the rules ask for four boxes.', 'specification', ['layout']),
 M3: card('M3', 'Old picture check', 'One earlier picture was missing the same blue dot.', 'review-history', ['repeated']),
 M4: card('M4', 'Reply', 'The box rule changed after Ari started. A dot was also missed before. Both things need care.', 'review-summary', ['summary']),
 U2: card('U2', 'Picture rules', 'You cannot open the picture rules until 3.', 'access', ['unavailable']),
 U3: card('U3', 'Reply', 'I cannot explain the two marks before 3.', 'review', ['unavailable']),
 R1: card('R1', 'Reply', 'We can talk about the picture at 3.', 'reassurance', ['non-diagnostic']),
 A1: card('A1', 'Reply', 'Please ask me which parts need a change.', 'exchange', ['non-diagnostic']),
 C1: card('C1', 'Changed picture', 'The colour has changed. The two marked parts still need a change.', 'action', ['non-diagnostic']),
 W1: card('W1', 'Plan for 3', 'We will look at Ari’s picture at 3. That has not happened yet.', 'schedule', ['pending'])
});
const world = (id, rubric, full) => Object.freeze({id, rubric: Object.freeze(rubric), full: Object.freeze(full)});
export const WORLDS = Object.freeze({
 local: world('local', ['L1','L2'], ['L1','L2','L3']),
 broader: world('broader', ['B1'], ['B1','B2','B3']),
 mixed: world('mixed', ['M1','M2'], ['M1','M2','M3','M4']),
 unresolved: world('unresolved', ['U2'], ['U2','U3'])
});
export const PROBES = Object.freeze([
 {id:'rubric', label:'Read the picture rules', detail:'See what the picture needs. This may not tell you about the rest of Ari’s work.', source:'Picture rules', effect:'You tried to open the picture rules. See what was there.'},
 {id:'clarify', label:'Read the rules and ask about the marks', detail:'“What needs a change? Is there a problem with other work too?”', source:'Picture rules and reply', effect:'You looked for the rules and asked what else needs care. Read what came back.'},
 {id:'reassure', label:'Ask if Ari is still wanted', detail:'“Do you still want me here?”', source:'Reply', effect:'This reply does not tell you what the marks mean.'},
 {id:'cosmetic', label:'Give the picture a new colour', detail:'Try a new colour before asking what needs a change.', source:'Changed picture', effect:'The colour changed. You still do not know what the marks mean.'},
 {id:'accuse', label:'Ask why Ari is not wanted', detail:'“Why don’t you want me here?”', source:'Reply', effect:'The question said Ari was not wanted. The reply does not tell you what the person thought before you asked.'},
 {id:'wait', label:'Get ready to talk at 3', detail:'Plan to ask what the two marks mean, and whether other work needs care too.', source:'Plan for 3', effect:'You have a time and a question ready. You do not have an answer yet.'}
]);
export const CAUSES = [
 {id:'units', label:'Ari missed a blue dot', forecast:'The rules ask for a dot that is missing.'},
 {id:'rule', label:'A rule changed after Ari started', forecast:'The old rules and new rules are different.'},
 {id:'skill', label:'Ari needs more practice counting dots', forecast:'Old picture checks show the same missing dot.'}
];
export const SORT_CARDS = [
 {id:'panels', text:'Two parts have marks.', source:'prototype'},
 {id:'time', text:'They will look at the picture at 3.', source:'message'},
 {id:'feeling', text:'Ari feels upset.', source:'character'},
 {id:'judgment', text:'No one thinks Ari can do this.', source:'unshown'}
];
export const LOOP = [
 {id:'meaning', text:'“They don’t want me here.”'},
 {id:'feeling', text:'Feels upset and worried'},
 {id:'avoidance', text:'Stops showing new pictures'},
 {id:'feedback', text:'Misses a chance to ask and learn'}
];
export const CUES = [
 {id:'fact', text:'Keep what you know.'},
 {id:'test', text:'Find out what you can.'},
 {id:'update', text:'Let what you learn guide your next step.'}
];
export const STAGES = {
 arrival: {title:'Ari’s picture', phase:'Look', seconds:20},
 separate: {title:'How do you know?', phase:'Look', seconds:35},
 scope: {title:'What do the marks tell you?', phase:'Think', seconds:30},
 loop: {title:'What happens next?', phase:'Think', seconds:40},
 model: {title:'What else could explain this?', phase:'Think', seconds:40},
 predict: {title:'What would you expect to find?', phase:'Try', seconds:40},
 probe: {title:'How will you find out?', phase:'Try', seconds:45},
 inspect: {title:'What did you learn?', phase:'Learn', seconds:40},
 update: {title:'What do you think now?', phase:'Learn', seconds:50},
 act: {title:'Make one useful change.', phase:'Take a step', seconds:35},
 transfer: {title:'What will you do?', phase:'A new story', seconds:75},
 close: {title:'Keep these three steps.', phase:'Finish', seconds:30},
 sources: {title:'Who saw it first?', phase:'Look closer', seconds:65},
 replay: {title:'Did your question change the reply?', phase:'Look closer', seconds:65},
 transfer2: {title:'What will you do?', phase:'Another story', seconds:80},
 delayed: {title:'When would you check again?', phase:'Think again', seconds:30},
 recall: {title:'What will you do?', phase:'Try again', seconds:60}
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
 const w=WORLDS[worldValue?.id]; if(!w)throw new Error('This story could not be opened.');
 const p=PROBES.find(p=>p.id===probeId); if(!p)throw new Error('This choice could not be found.');
 const ids=probeId==='rubric'?w.rubric:probeId==='clarify'?w.full:({reassure:['R1'],cosmetic:['C1'],accuse:['A1'],wait:['W1']})[probeId];
 return {probeId,ids:[...ids],effect:p.effect,source:p.source};
}
export function executeProbe(session, probeId) {
 if(!session.prediction)throw new Error('Choose what you expect to find before you look.');
 if(session.probes.length>=2)throw new Error('You have tried twice. Use what you found to take a next step.');
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
 local:'Two parts need a change. I still do not know what they think about Ari’s other work.',
 broader:'Ari has missed a dot before. Counting dots needs practice. This does not mean Ari can never learn.',
 mixed:'The box rule changed, and Ari has missed a dot before. Both things need care.',
 partial:'Part A needs another blue dot. I still need to ask about Part B and Ari’s other work.',
 unresolved:'Two parts were marked. I still do not know why, or whether other work needs care too.'
 }[state];
}
export function inspectTargets(ids) {
 const k=knowledgeFrom(ids);
 return [
  {id:'units',text:'Part A needs four blue dots.',answer:k.units?'supported':'open'},
  {id:'pattern',text:'The same dot was missed in earlier pictures.',answer:k.repeated?'supported':'open'},
  {id:'identity',text:'Ari can never learn to do this.',answer:'unsupported'}
 ];
}
const result=(pass,skill,message,defects=[])=>({pass,skill,message,defects});
export function evaluateSort(answer={}) {
 const defects=SORT_CARDS.filter(c=>answer[c.id]!==c.source).map(c=>c.id);
 return result(!defects.length,'sources',defects.length?'Match each card to where it came from. The story tells us Ari feels upset. It does not tell us what everyone thinks.':'You kept what happened, how Ari feels, and what Ari thinks apart.',defects);
}
export function evaluateScope(answer) {return result(answer==='panels','scope',answer==='panels'?'These two parts need work. The marks do not tell us about all Ari’s pictures or what Ari can learn.':'The marks point to these two parts. We would need more to know if this has happened before.');}
export function evaluateLoop(order) {const correct=LOOP.map(x=>x.id);return result(Array.isArray(order)&&order.length===correct.length&&order.every((x,i)=>x===correct[i]),'loop','Ari thinks they are not wanted, feels upset, and stops showing pictures. Then Ari misses a chance to ask and learn. Ari could ask even while feeling upset.');}
export function evaluatePrediction(model, forecast, counter) {
 const match=model.includes(forecast);return result(match&&counter==='history','prediction',!match?'Match what you expect to find to your idea. Would you look for a missing dot, a changed rule, or the same mistake in old pictures?':counter!=='history'?'Old pictures could show the same mistake happened before. A short reply or feeling calmer cannot show that.':'You chose what to look for before seeing the reply. More than one reason could still fit.');
}
export function evaluateInspect(ids, answer={}) {
 const defects=inspectTargets(ids).filter(t=>answer[t.id]!==t.answer).map(t=>t.id);
 return result(!defects.length,'sources',defects.length?'Use only the cards you opened. If they do not answer a question, you still do not know. None can show that Ari can never learn.':'You used what the cards show and kept room for what you still do not know.',defects);
}
export function evaluateUpdate(session, fact, replacement) {
 const expected=warrantedStatement(session.evidence);
 return result(fact==='keep'&&replacement===expected,'update',fact!=='keep'?'The two parts still need a change. Keep that fact while you change the thought.':replacement!==expected?'Choose a new thought that fits the cards you opened. They do not show that Ari is never wanted, or that everyone loves all of Ari’s work.':'You kept what happened and changed Ari’s thought to fit what you learned.');
}
export function evaluateAction(ids, action={}) {
 const k=knowledgeFrom(ids);const defects=[];
 if(k.units&&(Number(action.dots)!==4||action.colour!=='blue'))defects.push('units');
 if(k.layout&&Number(action.columns)!==4)defects.push('layout');
 if(k.repeated&&Number(action.practice)!==3)defects.push('practice');
 if((!k.units||!k.layout)&&action.question!=='criteria')defects.push('question');
 if(action.returnWhen!=='new-or-review')defects.push('stopping');
 const help={units:'Part A needs four blue dots.',layout:'Part B needs four boxes.',practice:'In the small example, two dots and one more make three.',question:'Ask what the marked parts need.',stopping:'Check again at 3, or if something new helps answer the question.'};
 return result(!defects.length,'action',defects.length?defects.map(id=>help[id]).join(' '):'You used what you know. You have a plan for what you still need to find out.',defects);
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
