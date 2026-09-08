import { plans } from '../catalog.js';
import { $, $$, button, research, announce } from '../ui.js';
export function mount() {
  let plan=null,step=0;
  const chosen=[];
  const prompts=['What would you like to do?','What would show it happened?','What is one small first step?','When will you start?','What if the first plan gets stuck?'];
  const labels=['Wish','Visible result','First step','Start cue','A way around'];
  const draw=()=>{
    $('#stage').innerHTML=`<div class="stage-top"><strong>A path from wish to action</strong><span>${Math.min(step+1,5)} / 5</span></div><div class="plan-path">${labels.map((label,i)=>`<div class="plan-node ${i<=step?'active':''}" data-step="${i+1}"><small>${label}</small><p>${chosen[i]|| (i===step?'Choose a piece of the path.':'Still open')}</p></div>`).join('')}</div>`;
    $('#controls').innerHTML=`<h2>${prompts[step]}</h2><p>${step===0?'Choose a small example. You do not need to share a personal goal.':step===1?'Choose something you could see or check.':step===2?'Small enough to begin in two minutes.':step===3?'A clear moment is easier to find than “later”.':'A useful plan makes room for a real obstacle.'}</p><div class="choice-list" id="plan-options"></div>${step?button('plan-back','Back one step'):''}`;
    let options;
    if(step===0)options=plans.map(p=>({text:p.title,value:p.id,valid:true}));
    if(step===1)options=[{text:'Everything is perfect.',valid:false},{text:plan.result,valid:true},{text:'I feel like a different person.',valid:false}];
    if(step===2)options=[{text:plan.step,valid:true},{text:'Finish the whole goal at once.',valid:false},{text:'Wait until I feel completely ready.',valid:false}];
    if(step===3)options=[{text:'Sometime soon.',valid:false},{text:'When everything is just right.',valid:false},{text:plan.cue+'.',valid:true}];
    if(step===4)options=[{text:'If '+plan.obstacle.replace(/^The /,'the ')+', '+plan.fallback+'.',valid:true},{text:'If it gets hard, the whole goal is impossible.',valid:false},{text:'Keep the same plan no matter what happens.',valid:false}];
    $('#plan-options').innerHTML=options.map((o,i)=>`<button type="button" class="choice" data-option="${i}">${o.text}</button>`).join('');
    $$('[data-option]').forEach(b=>b.addEventListener('click',()=>{
      const option=options[Number(b.dataset.option)];
      if(!option.valid){announce(['','That is hard to check from outside a feeling. What would actually happen?','Could you shrink this to one action you can start?','Which moment would you recognise when it arrives?','Could the plan change while the goal stays useful?'][step]);return;}
      if(step===0)plan=plans.find(p=>p.id===option.value);
      chosen[step]=option.text;step++;
      if(step===5)finish();else{draw();announce('That gives the next part of the path something clear to build on.');}
    }));
    $('#plan-back')?.addEventListener('click',()=>{step--;chosen.splice(step);draw();announce('You can change this part of the plan.');});
  };
  const finish=()=>{
    $('#stage').innerHTML=`<div class="stage-top"><strong>${plan.title}</strong><span>A plan you can try</span></div><div class="plan-result"><p class="eyebrow">Your if–then plan</p><blockquote>${plan.cue}, I will ${plan.step.charAt(0).toLowerCase()+plan.step.slice(1)}</blockquote><p class="note">If ${plan.obstacle.replace(/^The /,'the ')}, I can ${plan.fallback}.</p><div class="plan-path"><div class="plan-node active" data-step="✓"><small>What I will look for</small><p>${plan.result}</p></div></div></div>`;
    $('#controls').innerHTML=`<h2>Let the plan meet the world.</h2><p>Spend two minutes trying the first step. You can use the example, or quietly use the same pattern for your own goal.</p><a class="primary" href="../act/?mode=step&plan=${plan.id}">Take my first step →</a>${button('change','Change the plan')}${button('new-plan','Build another plan')}<p class="small">This is an authored example. Choosing a good plan here is not proof that you will carry it out.</p>`;
    $('#change').addEventListener('click',()=>{step=4;chosen.splice(4);draw();});$('#new-plan').addEventListener('click',mount);
    announce('Your goal, starting cue, first action and fallback now fit together. Act will keep this exact example with you.','success');
  };
  draw();announce('A wish gives you a direction. A first step gives you a place to begin.');
  research({question:'Why give a wish a time and place?',finding:'Implementation intentions link a recognisable situation with a specific response: if this situation occurs, I will do this action. Research finds benefits for goal pursuit across many settings, with variation between tasks and people.',model:'You assemble an observable result, a small action, a start cue and a fallback within one consistent fictional example. The Act timer receives only that example’s identifier. No personal goal text is requested or transmitted.',limits:'This original builder is not a validated behaviour-change programme. It cannot choose your values, remove material barriers, or guarantee follow-through. A timer finishing is not proof that a goal was achieved. Reconsidering an unhelpful goal can itself be sensible.',sources:[['Gollwitzer & Sheeran (2006) · Implementation intentions and goal achievement','https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f']]});
}
