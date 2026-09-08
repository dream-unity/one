import { mean } from '../core.js';
import { $, $$, button, slider, bindSlider, research, announce, session, animation, fmt, tone } from '../ui.js';
const movement = [
  ['Settle','Sit in a way that feels easy. Let your feet or body be supported. Breathe as usual.'],
  ['Hands','Slowly open one hand, only as far as feels easy. You may imagine the movement instead.'],
  ['Rest','Let the hand rest. What feels the same? What feels different?'],
  ['Feet','If it feels easy, gently move your toes. A tiny movement is enough.'],
  ['Shoulders','Let your shoulders rest. You do not need to pull them down or make them loose.'],
  ['Notice','Look around you. Notice one colour and one place where your body is supported.']
];
const stillness = [
  ['Settle','Stay in an easy, supported position. Breathe in your usual way.'],
  ['Hands','Notice where your hands are resting. You do not need to move them.'],
  ['Rest','Notice a point of contact with a chair, bed or the floor.'],
  ['Feet','Notice where your feet are. Feeling nothing clear is also an answer.'],
  ['Shoulders','Notice your shoulders without changing them. Let the next breath happen by itself.'],
  ['Notice','Look around you. Find one colour and listen for one sound.']
];
export function mount() {
  let activeSession=null, activeLoop=null;
  const guided=()=>{
    activeSession?.dispose();activeSession=null;activeLoop?.dispose();activeLoop=null;let duration=120, current=-1, before=null, ending=false;
    $('#stage').innerHTML=`<div class="stage-top"><strong>Move and rest</strong><span id="stage-count">Six small steps</span></div><div class="body-stations" aria-hidden="true">${['Settle','Hands','Rest','Feet','Rest','Notice'].map((s,i)=>`<span data-station="${i}">${s}</span>`).join('')}</div><div class="center-scene timer-scene"><p class="eyebrow" id="body-step">Go gently</p><h2 id="body-prompt">An easy movement. A little space to notice.</h2><div class="large-number" id="body-clock">2:00</div></div><div class="progress-track"><span id="body-progress"></span></div>`;
    $('#controls').innerHTML=`<div class="mode-tabs"><button class="choice" id="gentle-mode" aria-pressed="true">Move & rest</button><button class="choice" id="rhythm-mode" aria-pressed="false">Tap a rhythm</button></div><h2>Your body sets the pace.</h2><p>Stay seated or supported. Keep movements small and easy. Skip any that hurt or feel wrong. Children explore with a trusted grown-up.</p><label class="field-label" for="body-duration">Practice length</label><select id="body-duration"><option value="60">1 minute</option><option value="120" selected>2 minutes</option><option value="180">3 minutes</option></select><label class="check"><input type="checkbox" id="stay-still">Notice without moving</label><label class="field-label" for="before-ease">How easy does your body feel now?</label><select id="before-ease"><option value="">Skip this question</option>${[0,2,4,6,8,10].map(v=>`<option value="${v}">${v} / 10${v===0?' · not easy':v===10?' · very easy':''}</option>`).join('')}</select>${button('body-start','Begin gently',true)}${button('body-end','Finish now')}<p class="small">If you feel dizzy, uncomfortable or distressed, stop and return to your usual breathing. You can simply look around.</p>`;
    $('#body-end').hidden=true;
    const finish=complete=>{
      if(ending)return;ending=true;const elapsed=activeSession?.clock.elapsed||0;activeSession?.dispose();activeSession=null;
      $('#stage-count').textContent=complete?'Complete':'Finished early';$('#body-step').textContent='Back to the room';$('#body-prompt').textContent='Notice what is here. Nothing has to change.';$('#body-clock').textContent=fmt(elapsed);
      $('#controls').innerHTML=`<h2>${complete?'Your practice is complete.':'You chose when to finish.'}</h2><p>You spent ${fmt(elapsed)} practising.${before!==null?` Before, you reported ${before}/10 for ease.`:''}</p><label class="field-label" for="after-ease">How easy does your body feel now?</label><select id="after-ease"><option value="">Skip this question</option>${[0,2,4,6,8,10].map(v=>`<option value="${v}">${v} / 10</option>`).join('')}</select><p class="small" id="ease-result">A feeling report is yours. It is not a health measurement.</p>${button('body-again','Try again',true)}${button('rhythm-mode','Explore a rhythm')}`;
      $('#after-ease').addEventListener('change',()=>{const value=$('#after-ease').value;$('#ease-result').textContent=value===''?'You skipped the question.':`You reported ${value}/10 now.${before!==null?` Before: ${before}/10.`:''} This comparison cannot show what caused any change.`;});
      $('#body-again').addEventListener('click',guided);$('#rhythm-mode').addEventListener('click',rhythm);announce(complete?'You completed all six steps. A stronger sensation is not a better result.':'Your timer stopped where you chose. An early finish is not recorded as a completed practice.');
    };
    $('#body-duration').addEventListener('change',()=>{duration=Number($('#body-duration').value);$('#body-clock').textContent=fmt(duration);});
    $('#body-start').addEventListener('click',()=>{
      if(activeSession){if(activeSession.clock.running)activeSession.pause();else activeSession.play();return;}
      before=$('#before-ease').value===''?null:Number($('#before-ease').value);const steps=$('#stay-still').checked?stillness:movement;
      for(const id of ['body-duration','stay-still','before-ease'])$('#'+id).disabled=true;$('#body-end').hidden=false;
      activeSession=session(duration,clock=>{
        const index=Math.min(5,Math.floor(clock.elapsed/duration*6));
        $('#body-clock').textContent=fmt(duration-clock.elapsed);$('#body-progress').style.width=`${clock.elapsed/duration*100}%`;$('#body-start').textContent=clock.running?'Pause':'Resume gently';
        if(index!==current){current=index;$('#body-step').textContent=steps[index][0];$('#body-prompt').textContent=steps[index][1];$('#stage-count').textContent=`Step ${index+1} / 6`;$$('[data-station]').forEach(n=>n.classList.toggle('active',Number(n.dataset.station)===index));announce(steps[index][1]);}
      },()=>finish(true));activeSession.play();
    });
    $('#body-end').addEventListener('click',()=>finish(false));$('#rhythm-mode').addEventListener('click',rhythm);$('#gentle-mode').addEventListener('click',()=>{});
    announce('This is gentle movement and attention practice. There is no need to force a tremor, hold a breath or make a feeling stronger.');
  };
  const rhythm=()=>{
    activeSession?.dispose();activeSession=null;activeLoop?.dispose();let bpm=60,taps=0,lastTap=null,beat=-1,elapsed=0,sound=false,completed=false,pauses=0;const intervals=[];
    $('#stage').innerHTML=`<div class="stage-top"><strong>Listen or watch. Tap at an easy pace.</strong><span id="tap-count">0 / 8 taps</span></div><div class="center-scene"><p id="beat-label" class="eyebrow">One beat each second</p><button type="button" class="tap-pad" id="tap" disabled>Tap here</button><p id="tap-result">No need to tap hard. One finger is enough.</p></div><div class="stats"><div class="stat"><strong id="target-gap">1,000 ms</strong><span>gap between guide beats</span></div><div class="stat"><strong id="actual-gap">—</strong><span>your mean tap interval</span></div><div class="stat"><strong id="tap-difference">—</strong><span>mean absolute gap error</span></div></div>`;
    $('#controls').innerHTML=`<div class="mode-tabs"><button class="choice" id="gentle-mode" aria-pressed="false">Move & rest</button><button class="choice" aria-pressed="true">Tap a rhythm</button></div><h2>Eight light taps.</h2><p>Press Begin. Watch the beat number, or turn on a quiet sound. Tap along. Use the button with a finger, mouse or the space key.</p>${slider('bpm','Beats each minute',60,40,80,5)}<label class="check"><input type="checkbox" id="rhythm-sound">Quiet beat sound</label>${button('rhythm-start','Begin rhythm',true)}${button('rhythm-reset','Start over')}<p class="small">This compares the gaps between your taps with the guide. It does not measure your heart or diagnose movement ability.</p>`;
    const loop=animation(dt=>{elapsed+=dt;const nextBeat=Math.floor(elapsed*bpm/60);if(nextBeat!==beat){beat=nextBeat;$('#beat-label').textContent=`Beat ${beat%4+1} · ${bpm} each minute`;if(sound)tone(beat%4===0?520:390,.08);}},()=>{lastTap=null;$('#tap').disabled=true;$('#rhythm-start').textContent=completed?'Try eight more taps':'Resume rhythm';if(!completed)pauses++;});activeLoop=loop;
    bindSlider('bpm',v=>{bpm=v;$('#target-gap').textContent=`${Math.round(60000/bpm).toLocaleString()} ms`;});
    $('#rhythm-sound').addEventListener('change',()=>{sound=$('#rhythm-sound').checked;if(sound)tone();});
    const tap=()=>{
      if(!loop.running||completed)return;const now=performance.now();if(lastTap!==null)intervals.push(now-lastTap);lastTap=now;taps++;
      $('#tap-count').textContent=`${taps} / 8 taps`;$('#actual-gap').textContent=intervals.length?`${Math.round(mean(intervals))} ms`:'—';$('#tap-difference').textContent=intervals.length?`${Math.round(mean(intervals.map(n=>Math.abs(n-60000/bpm))))} ms`:'—';
      if(taps>=8){completed=true;loop.pause();$('#tap-result').textContent=`Eight taps recorded; ${intervals.length} uninterrupted gaps compared.${pauses?' Gaps spanning pauses were excluded.':''}`;announce('Eight taps recorded. These results describe this attempt, including your device and input method. They are not a measure of health.','success');}
    };
    $('#tap').addEventListener('pointerdown',e=>{if(e.button===0){e.preventDefault();$('#tap').focus({preventScroll:true});tap();}});
    $('#tap').addEventListener('click',e=>{if(e.detail===0)tap();});
    $('#rhythm-start').addEventListener('click',()=>{if(completed){rhythm();return;}if(loop.running){loop.pause();announce('Paused. The next tap starts a fresh interval, so resting time will not count.');return;}$('#bpm').disabled=true;$('#tap').disabled=false;$('#rhythm-start').textContent='Pause rhythm';if(sound)tone();loop.play();announce('Tap with the guide for eight taps. You can stop at any point.');});
    $('#rhythm-reset').addEventListener('click',rhythm);$('#gentle-mode').addEventListener('click',guided);
    announce('The beat changes slowly without a flashing screen. Sound is optional and begins only when you choose it.');
  };
  guided();
  research({question:'What can a small movement tell you?',finding:'Relaxation approaches include attention, breathing and muscle-based methods. Effects depend on the method and person; some people can feel more distressed with inward attention.',model:'Move & rest alternates optional easy movement with rest and external orientation. Notice-only uses the same timer without movement. Ease ratings are optional self-reports. Tap a rhythm compares uninterrupted input intervals with the selected beat period; it does not estimate timing phase or a physiological rhythm.',limits:'These exact activities and their one-to-three-minute lengths are original educational designs, not clinically validated treatments. They do not induce TRE, treat trauma, assess proprioceptive accuracy or measure heart-rate variability. Tap timing includes device and browser delays.',maths:'Rhythm interval target = 60,000 / beats per minute. Error = mean(|tap interval − target interval|).',sources:[['US National Center for Complementary and Integrative Health · Relaxation techniques','https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know']]});
}
