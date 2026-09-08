import { stepPilot } from '../core.js';
import { plans } from '../catalog.js';
import { $, $$, button, research, announce, animation, session, fmt } from '../ui.js';
export function mount() {
  let loop=null, timer=null, disposeKeys=()=>{};
  const params=new URLSearchParams(location.search);
  const plan=plans.find(p=>p.id===params.get('plan'));
  const game=()=>{
    loop?.dispose();loop=null;timer?.dispose();timer=null;disposeKeys();
    let level=0,state,held=new Set(),pulse=0,pulseDirection=0,complete=false,draws=0;
    const levels=[{start:85,target:440,wind:0,name:'A quiet world'},{start:510,target:155,wind:8,name:'A little wind to the right'},{start:100,target:465,wind:-10,name:'A little wind to the left'}];
    $('#stage').innerHTML=`<div class="stage-top"><strong id="level-name">A quiet world</strong><span id="level-count">1 / 3</span></div><svg viewBox="0 0 600 330" role="img" aria-labelledby="pilot-description"><title id="pilot-description">Move the light into the marked home zone and slow it down.</title>${[80,160,240,320,400,480,560].map(x=>`<line x1="${x}" y1="42" x2="${x}" y2="285" stroke="#22364a"/>`).join('')}<line x1="20" y1="170" x2="580" y2="170" stroke="#3f546e"/><rect id="dock-zone" x="418" y="65" width="44" height="210" fill="#76e0cb10" stroke="#76e0cb60" stroke-dasharray="5 8" rx="15"/><text id="dock-label" x="440" y="46" fill="#76e0cb" font-size="15" text-anchor="middle">HOME</text><line id="pilot-vector" x1="85" x2="85" y1="170" y2="170" stroke="#ffd489" stroke-width="2"/><circle id="pilot-halo" cx="85" cy="170" r="28" fill="#76e0cb0d" stroke="#76e0cb25"/><circle id="pilot-light" cx="85" cy="170" r="10" fill="#b9ffee"/><text id="pilot-hint" x="300" y="312" text-anchor="middle" fill="#a6b5c8" font-size="14">A push changes speed. Letting go keeps the motion.</text></svg><div class="pilot-controls"><button type="button" class="secondary" data-thrust="-1" aria-pressed="false">← Push left</button><button type="button" class="secondary" data-thrust="1" aria-pressed="false">Push right →</button></div><div class="stats"><div class="stat"><strong id="pilot-speed">0</strong><span>speed · units / second</span></div><div class="stat"><strong id="pilot-direction">Still</strong><span>direction of motion</span></div><div class="stat"><strong id="pilot-hold">0.0 / 1.5 s</strong><span>settled at home</span></div></div>`;
    $('#controls').innerHTML=`<div class="mode-tabs"><button class="choice" aria-pressed="true">Guide the light</button><button class="choice" id="step-mode" aria-pressed="false">Take my step</button></div><h2>Aim. Act. Notice. Adjust.</h2><p>Bring the light into HOME. Keep it there, moving slowly, for 1.5 seconds.</p><p>Hold a push button, or use ← and →. To slow a moving light, push the other way. A keyboard click on a push button gives a short nudge.</p>${button('pilot-play','Begin flying',true)}${button('pilot-reset','Try this level again')}${button('pilot-next','Next world')}<p class="small">Slow means below 12 units per second. Motion is a simulation, not a reading of your body.</p>`;
    const paint=()=>{
      for(const id of ['pilot-halo','pilot-light'])$('#'+id).setAttribute('cx',state.x);
      $('#pilot-vector').setAttribute('x1',state.x);$('#pilot-vector').setAttribute('x2',Math.max(16,Math.min(584,state.x+state.v*.65)));
      $('#pilot-speed').textContent=Math.abs(state.v).toFixed(0);$('#pilot-direction').textContent=Math.abs(state.v)<.5?'Still':state.v>0?'Right':'Left';$('#pilot-hold').textContent=`${Math.min(1.5,state.hold).toFixed(1)} / 1.5 s`;
      $$('[data-thrust]').forEach(b=>{const active=held.has(Number(b.dataset.thrust));b.classList.toggle('held',active);b.setAttribute('aria-pressed',String(active));});
    };
    const clearHeld=()=>{held.clear();pulse=0;paint();};
    const active=animation(dt=>{
      const thrust=held.size?(Number(held.has(1))-Number(held.has(-1))):pulse>0?pulseDirection:0;pulse=Math.max(0,pulse-dt);
      state=stepPilot(state,thrust,levels[level].wind,dt);draws++;if(draws%2===0)paint();
      if(state.hold>=1.5){complete=true;paint();$('#pilot-next').hidden=false;$('#pilot-next').textContent=level===2?'See what you learned':'Next world';$('#pilot-play').disabled=true;announce(`You settled the light in ${state.time.toFixed(1)} seconds. ${level===0?'Next, a small wind will make you change the plan.':'You adapted to a force you did not control.'}`,'success');return false;}
    },()=>{clearHeld();$('#pilot-play').textContent='Resume flying';});loop=active;
    const reset=()=>{active.pause();state={x:levels[level].start,v:0,target:levels[level].target,hold:0,time:0};held.clear();pulse=0;complete=false;$('#level-name').textContent=levels[level].name;$('#level-count').textContent=`${level+1} / 3`;$('#dock-zone').setAttribute('x',state.target-22);$('#dock-label').setAttribute('x',state.target);$('#pilot-next').hidden=true;$('#pilot-play').disabled=false;$('#pilot-play').textContent='Begin flying';paint();};
    $$('[data-thrust]').forEach(b=>{
      const value=Number(b.dataset.thrust);
      b.addEventListener('pointerdown',e=>{if(!active.running||complete)return;e.preventDefault();b.setPointerCapture(e.pointerId);held.add(value);b.focus({preventScroll:true});paint();});
      const release=()=>{held.delete(value);paint();};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
      b.addEventListener('click',e=>{if(e.detail===0&&active.running){pulse=.25;pulseDirection=value;}});
    });
    const keydown=e=>{if(!active.running||!['ArrowLeft','ArrowRight'].includes(e.key)||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;e.preventDefault();held.add(e.key==='ArrowLeft'?-1:1);paint();};
    const keyup=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){held.delete(e.key==='ArrowLeft'?-1:1);paint();}};
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clearHeld);
    disposeKeys=()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearHeld);};
    $('#pilot-play').addEventListener('click',()=>{if(active.running){active.pause();announce('Paused. All pushes are released.');return;}active.play();$('#pilot-play').textContent='Pause flying';announce(`Level ${level+1}: ${levels[level].name}. Push briefly, watch the motion, and brake before HOME.`);});
    $('#pilot-reset').addEventListener('click',()=>{reset();announce('This level is ready to try again.');});
    $('#pilot-next').addEventListener('click',()=>{
      if(level<2){level++;reset();announce('A new world changes the force. The goal stays the same.');return;}
      active.pause();disposeKeys();$('#stage').innerHTML=`<div class="stage-top"><strong>Three worlds crossed</strong><span>Complete</span></div><div class="center-scene"><p class="eyebrow">Action is a conversation with the world</p><h2>You pushed, watched and changed your next move.</h2><p>A useful action depends on what is happening now. Even doing less can help when momentum is carrying you.</p></div>`;
      $('#controls').innerHTML=`<h2>Try that outside the game.</h2><p>Choose one small step. Give it two minutes. Check what actually happened.</p>${button('step-mode','Take a small step',true)}${button('game-again','Play again')}`;$('#step-mode').addEventListener('click',focus);$('#game-again').addEventListener('click',game);
    });
    $('#step-mode').addEventListener('click',focus);reset();announce('Begin flying, then push right. Start braking before you reach home.');
  };
  const focus=()=>{
    loop?.dispose();loop=null;disposeKeys();timer?.dispose();timer=null;let duration=120,ended=false;
    $('#stage').innerHTML=`<div class="stage-top"><strong>${plan?.title||'One small step'}</strong><span id="focus-status">Ready when you are</span></div><div class="center-scene timer-scene"><p class="eyebrow">${plan?'Your plan from Intend':'Keep your goal to yourself'}</p><h2>${plan?.step||'Pick one small thing you can do now.'}</h2><div class="large-number" id="focus-clock">2:00</div><p>${plan?'If '+plan.obstacle.replace(/^The /,'the ')+', '+plan.fallback+'.':'Write one line. Put one thing in its place. Try one part of a task.'}</p></div><div class="progress-track"><span id="focus-progress"></span></div>`;
    $('#controls').innerHTML=`<div class="mode-tabs"><button class="choice" id="game-mode" aria-pressed="false">Guide the light</button><button class="choice" aria-pressed="true">Take my step</button></div><h2>Make a little room to act.</h2><p>${plan?plan.cue+'. When you are ready, try the first step.':'Choose your step quietly. You do not need to write it here.'}</p><label class="field-label" for="focus-length">Time for this step</label><select id="focus-length"><option value="60">1 minute</option><option value="120" selected>2 minutes</option><option value="300">5 minutes</option></select>${button('focus-start','Begin my step',true)}${button('focus-end','Finish now')}<p class="small">The timer pauses if you leave this tab. Resume deliberately when you return.</p>`;
    $('#focus-end').hidden=true;
    const finish=complete=>{
      if(ended)return;ended=true;const elapsed=timer?.clock.elapsed||0;timer?.dispose();timer=null;
      $('#focus-status').textContent=complete?'Time complete':'Finished early';$('#focus-clock').textContent=fmt(elapsed);
      $('#controls').innerHTML=`<h2>What actually happened?</h2><p>${fmt(elapsed)} spent on the step. A timer can count time; only you can say what you did.</p><div class="choice-list">${['I took the step.','I started part of it.','I need a different step.'].map((t,i)=>`<button class="choice" data-reflect="${i}">${t}</button>`).join('')}</div>${button('focus-again','Make room for another step')}`;
      $$('[data-reflect]').forEach(b=>b.addEventListener('click',()=>{announce(['You report taking the step. What small result can you notice?','You report starting. What made the start possible?','You report needing another step. What could you make smaller or clearer?'][Number(b.dataset.reflect)]);$$('[data-reflect]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));$('#focus-again').addEventListener('click',focus);announce(complete?'The planned time is complete. Check the action separately.':'The timer stopped early. You can still notice what you did.');
    };
    $('#focus-length').addEventListener('change',()=>{duration=Number($('#focus-length').value);$('#focus-clock').textContent=fmt(duration);});
    $('#focus-start').addEventListener('click',()=>{
      if(timer){if(timer.clock.running)timer.pause();else timer.play();return;}
      $('#focus-length').disabled=true;$('#focus-end').hidden=false;
      timer=session(duration,clock=>{$('#focus-clock').textContent=fmt(duration-clock.elapsed);$('#focus-progress').style.width=`${clock.elapsed/duration*100}%`;$('#focus-start').textContent=clock.running?'Pause':'Resume my step';$('#focus-status').textContent=clock.running?'One step at a time':'Paused';},()=>finish(true));timer.play();announce('Your time has begun. Try the small step.');
    });
    $('#focus-end').addEventListener('click',()=>finish(false));$('#game-mode').addEventListener('click',game);announce(plan?'Your exact example from Intend is here, including the fallback.':'Choose a small action privately, then start the timer.');
  };
  if(params.get('mode')==='step')focus();else game();
  research({question:'Why is trying also a way of finding out?',finding:'Feedback control adjusts an input in response to a difference between a target and an observed state. Force changes velocity; removing a force does not instantly remove momentum.',model:'The game uses one-dimensional constant-acceleration motion in bounded space, with fixed 1/60-second steps. Pushes provide acceleration, and later levels add a constant disturbance. Success needs both position and low speed. The separate focus timer carries a chosen example from Intend and asks for an honest report of action.',limits:'The light is an ideal simulated object with simplified wall impacts and no drag. Success is task-specific and does not establish improved executive function or real-world self-control. A self-report of action is different from observed behaviour.',maths:'xnew = x + vΔt + ½aΔt²; vnew = v + aΔt. A push changes acceleration, not the target.',sources:[['University of Colorado PhET · Forces and Motion: Basics','https://phet.colorado.edu/en/simulations/forces-and-motion-basics'],['Gollwitzer & Sheeran · Implementation intentions','https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f']]});
}
