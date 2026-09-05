/* The supplied Project Meaning session protocol, hosted inside Dream Unity.
   Prompt constants and timer cadence are preserved; lifecycle guards only
   prevent an ended/replaced session from updating a later one. */
'use strict';
var $ = function(id){ return document.getElementById(id); };
function pad(n){ return String(n).padStart(2,'0'); }
function heartReducedMotion(){
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function heartFocus(element){
  if(!element || typeof element.focus !== 'function') return;
  if(!element.hasAttribute('tabindex') && !element.matches('button,a,input')) element.setAttribute('tabindex','-1');
  try{ element.focus({preventScroll:true}); }catch(e){ element.focus(); }
}
function heartFocusStart(id){
  var start = $(id);
  heartFocus(start && start.querySelector('.dur-btn'));
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.add('hidden'); });
  var el = $(id);
  if(el){ el.classList.remove('hidden'); el.scrollTop = 0; }
  window.scrollTo(0,0);
  heartFocus(el && el.querySelector('h1,h2,.instr-heading,.s2-title'));
}
function closeHeartCompletion(id){
  var el = $(id);
  if(!el) return;
  if(el.open && typeof el.close === 'function') el.close();
  el.classList.remove('show');
}
function closeHeartCompletions(){
  closeHeartCompletion('completion');
  closeHeartCompletion('stage2-completion');
}
function showHeartCompletion(id){
  var el = $(id);
  if(!el) return;
  el.classList.add('show');
  if(!el.open && typeof el.showModal === 'function') el.showModal();
  heartFocus(el.querySelector('button'));
}
function stopHeartSessions(options){
  s1Stop();
  s2Stop();
  stopHeartAudio(options);
  closeHeartCompletions();
}
function showInstructions(){
  stopHeartSessions({immediate:true});
  s1ShowStart();
  showScreen('screen-instructions');
}
function s1ShowStart(){
  var st=$('s1-start'), lv=$('s1-live');
  if(lv) lv.classList.add('is-hidden');
  if(st) st.classList.remove('is-hidden');
}
function showStage2Preview(){
  stopHeartSessions({immediate:true});
  s2ShowStart();
  showScreen('screen-stage2');
}
function showStage2Instructions(){ showStage2Preview(); }
function s2ShowStart(){
  var st=$('s2-start'), lv=$('s2-live');
  if(lv) lv.classList.add('is-hidden');
  if(st) st.classList.remove('is-hidden');
}

/* ============================ STAGE ONE ============================ */
const PHASES = {
  early: {
    inhale: { label: 'Step 1 · Heart-Focused Breathing',
      text: 'Breathe in gently through the heart. Soften the chest. The love is already in the body, let it come forward on its own.' },
    exhale: { label: 'Step 1 · Heart-Focused Breathing',
      text: 'Breathe out slowly through the heart. Unhurried. The rhythm alone is already quieting the nervous system.' }
  },
  middle: {
    inhale: { label: 'Step 2 · Heart Feeling',
      text: 'Breathe the love in. Not the idea of it, the felt warmth already present in the chest. Let it move through you.' },
    exhale: { label: 'Step 2 · Heart Feeling',
      text: 'Breathe the love out through the heart. You are training coherence through the signal itself.' }
  },
  late: {
    inhale: { label: 'Step 3 · Deepen',
      text: 'Breathe the love in. Deepen it. Move to a subtler, deeper and more powerful level.' },
    exhale: { label: 'Step 3 · Deepen',
      text: 'Breathe the love out. Sustain it. The longer it is held, the stronger it becomes.' }
  }
};

var s1 = { total:0, rem:0, tick:null, bTo:null, bSec:null, phase:'inhale', active:false, run:0, indicators:[] };

function s1PhaseKey(){
  var p = 1 - s1.rem / s1.total;
  return p < 0.33 ? 'early' : (p < 0.66 ? 'middle' : 'late');
}
function s1Timer(){
  var t = $('session-timer'); if(t) t.textContent = pad(Math.floor(s1.rem/60)) + ':' + pad(s1.rem%60);
}
function s1Progress(){
  var f = $('progress-fill'); if(f) f.style.width = ((1 - s1.rem/s1.total)*100).toFixed(2) + '%';
}
function s1Activate(id){ var e=$(id); if(e) e.classList.add('active'); }
function s1ResetIndicators(){
  ['ci-breath','ci-heart','ci-feeling'].forEach(function(id){ var e=$(id); if(e) e.classList.remove('active'); });
}
function startWithDuration(secs){
  if([900,1800,3600,7200,10800].indexOf(secs) < 0) return;
  stopHeartSessions({immediate:true});
  showScreen('screen-instructions');
  s1.total = secs; s1.rem = secs; s1.phase = 'inhale'; s1.active = true;
  var run = s1.run;
  var st=$('s1-start'), lv=$('s1-live');
  if(st) st.classList.add('is-hidden');
  if(lv) lv.classList.remove('is-hidden');
  try{ window.scrollTo({top:0,behavior:heartReducedMotion() ? 'auto' : 'smooth'}); }catch(e){ window.scrollTo(0,0); }
  heartFocus(lv && lv.querySelector('.session-end'));
  var ttl = $('session-title-label'); if(ttl) ttl.textContent = 'Heart Coherence · Active';
  s1ResetIndicators();
  s1Timer(); s1Progress();
  // A restarted inhale begins at the source's resting scale, even when the
  // previous session ended with the circle expanded. This adds no timer.
  var ball = $('breath-ball');
  if(ball){
    ball.style.transition = 'none';
    ball.classList.remove('inhale-state');
    void ball.offsetWidth;
    ball.style.transition = '';
  }
  startBreath('inhale');
  droneStart();                 // soft ambient pad underneath the bell
  [['ci-breath',400],['ci-heart',4000],['ci-feeling',9000]].forEach(function(item){
    var timer = setTimeout(function(){
      s1.indicators = s1.indicators.filter(function(t){ return t !== timer; });
      if(s1.active && s1.run === run) s1Activate(item[0]);
    }, item[1]);
    s1.indicators.push(timer);
  });
  s1.tick = setInterval(function(){
    if(!s1.active || s1.run !== run) return;
    s1.rem--;
    s1Timer(); s1Progress();
    if(s1.rem <= 0){ s1Stop(); completeS1(); }
  }, 1000);
}
function startBreath(phase){
  if(!s1.active) return;
  var run = s1.run;
  s1.phase = phase;
  breathBell(phase);
  var ball = $('breath-ball'), label = $('breath-label'), cd = $('breath-cd');
  var info = PHASES[s1PhaseKey()][phase];
  var sl = $('phase-step-label'); if(sl) sl.textContent = info.label;
  var pt = $('phase-text');      if(pt) pt.textContent = info.text;
  if(label) label.textContent = (phase === 'inhale') ? 'Inhale' : 'Exhale';
  if(ball) ball.classList.toggle('inhale-state', phase === 'inhale');
  var c = 5; if(cd) cd.textContent = '5';
  clearInterval(s1.bSec);
  s1.bSec = setInterval(function(){
    if(!s1.active || s1.run !== run) return;
    c--; if(cd) cd.textContent = c > 0 ? c : '';
    if(c <= 0){ clearInterval(s1.bSec); s1.bSec = null; }
  }, 1000);
  clearTimeout(s1.bTo);
  s1.bTo = setTimeout(function(){
    if(!s1.active || s1.run !== run) return;
    s1.bTo = null;
    if(s1.rem > 0) startBreath(phase === 'inhale' ? 'exhale' : 'inhale');
  }, 5000);
}
function s1Stop(){
  s1.active = false;
  s1.run++;
  clearInterval(s1.tick); clearTimeout(s1.bTo); clearInterval(s1.bSec);
  s1.tick = null; s1.bTo = null; s1.bSec = null;
  s1.indicators.forEach(function(timer){ clearTimeout(timer); });
  s1.indicators = [];
  droneStop();
}
function completeS1(){
  completeBell();
  showHeartCompletion('completion');
}
function endSession(){
  s1Stop();
  stopHeartAudio();
  closeHeartCompletion('completion');
  s1ShowStart();
  heartFocusStart('s1-start');
}
function restartToIntro(){
  stopHeartSessions({immediate:true});
  s1ResetIndicators();
  s1ShowStart();
  s2ShowStart();
  showScreen('screen-heart');
}

/* ============================ STAGE TWO ============================ */
const S2_DIMENSIONS = [
  { label:'LOCATION',     prompt:'Okay, now. Where in the body is the feeling sitting? Name the area in the plainest words &mdash; chest, throat, belly, jaw, hands, shoulders. This is where an emotion lives as something physical: grief tends to gather in the chest and throat, anxiety high in the chest, anger in the jaw and hands. Does it have a clear edge, or fade into what surrounds it? Don&rsquo;t explain it yet &mdash; just say where it is.' },
  { label:'QUALITY',      prompt:'Okay, now. What does it feel like, as raw sensation? Plain physical words &mdash; pressure, heat, cold, tightness, hollowness, heaviness, lightness. This texture is the emotion&rsquo;s signature: a downward heaviness reads as sadness, a warm spreading openness as joy, a tight electric buzzing as fear. Pick the word that truly fits, not the one that sounds deep &mdash; the feeling lives in the texture.' },
  { label:'INTENSITY',    prompt:'Okay, now. How strong is the sensation itself, 0 to 10? Rate the sensation, not the story riding on it. Notice the two can differ: a loud emotion can sit on a faint sensation, and a strong physical sensation can carry almost no feeling. Learning that gap &mdash; how big the emotion is versus how big the sensation is &mdash; is part of reading yourself accurately.' },
  { label:'MOVEMENT',     prompt:'Okay, now. Is it still, or moving &mdash; pulsing, spreading, rising, sinking, flickering, throbbing? Steady, or coming in waves? The movement carries the emotion: a rising, quickening lift leans toward excitement or joy; a sinking, collapsing pull toward sadness; a fast flutter toward fear. Describe the movement itself for now, not yet what it means.' },
  { label:'DIRECTION',    prompt:'Okay, now. Which way is it going &mdash; toward you, away, up, down, inward, outward, radiating from a centre? Direction maps to feeling: opening outward tends toward warmth and joy; pulling inward and down toward grief or shame; pushing out against something toward anger. If there is no clear direction, say so &mdash; it is simply staying put.' },
  { label:'COHERENCE',    prompt:'Okay, now. Is this one clean feeling, or several at once? Check four layers and see if they agree: the raw sensation, the image it brings to mind, what the body wants to do, and the emotional tone it carries. Mixed feelings show up here as layers pulling apart &mdash; relief threaded with grief, anger sitting over fear. Are they pointing the same way, or against each other?' },
  { label:'MEANING-TONE', prompt:'Okay, now. First the tone &mdash; pleasant, unpleasant, or neutral; drawing you in, pushing away, or holding still? Then name it: from where it sits, its texture, its movement, what emotion is this in one word? Sadness, joy, fear, anger, longing, calm. The name now rests on what you actually felt, not a guess &mdash; and each time you trace a feeling down to its body like this, the link between <em>this</em> sensation and <em>this</em> emotion grows stronger, and faster to read next time.' }
];

const S2_PHASES = [
  { k:'arrive', from:0.00, to:0.12, label:'Phase · Arrive',
    prompts:[
      'Okay now. Let the breath stay slow, about five to six breaths per minute. Feel the ground under your feet and seat. Let one sensation in your body come forward on its own. You are not searching for it; you are receiving it. Whatever shows up first is what you will work with.',
      'Okay now. Commit to that sensation. Put your attention <em>inside</em> the part of the body holding it, rather than watching it from outside. If a light hand on your chest, side ribs, or lower belly helps, use it for a moment.'
    ] },
  { k:'mapping', from:0.12, to:0.68 },
  { k:'calibrate', from:0.68, to:0.88, label:'Phase · Calibrate',
    prompts:[
      '<strong>Okay, now. Accuracy check.</strong> How closely does what you described match what is actually happening in the body? If you honestly can&rsquo;t tell, say so. A truthful &ldquo;I don&rsquo;t know&rdquo; is more accurate than a confident guess.',
      '<strong>Okay, now. Attention check.</strong> How inside the body were you, versus watching from outside and narrating? Being inside isn\u2019t a performance; it\u2019s just where your attention actually was.',
      '<strong>Okay, now. Confidence check.</strong> On a 0&ndash;10 scale, how sure are you about what you just described? Now notice: strong feelings often carry weak precision. The gap between your confidence and how right you likely are is exactly what we are training.'
    ] },
  { k:'translate', from:0.88, to:1.01, label:'Phase · Translate',
    prompts:[
      '<strong>Okay, now. What it grabs.</strong> What is this sensation doing to your attention right now? Is it making certain worries louder, or muting other things that usually matter to you?',
      '<strong>Okay, now. What it suggests.</strong> What interpretation is the sensation pushing you toward? Threat, promise, obligation, shame, curiosity? Name the interpretation.',
      '<strong>Okay, now. What the body wants to do.</strong> What is the body getting ready for? Move toward something, pull away, brace, soften, reach out, hide? This is the moment a sensation turns into meaning. Watch it form. Don&rsquo;t automatically go along with it. You are the reader, not the reading.'
    ] }
];

// S2_PHASES is retained from the supplied source, but it is not scheduled.
// The operational exercise rotates these seven dimensions every 30 seconds.
var S2_STEP_SECS = 30;
var s2 = { total:0, rem:0, tick:null, lastDim:-1, stepRem:0, peek:null,
  active:false, run:0, centerFade:null, promptFade:null, displayRevision:0 };

function startStage2WithDuration(secs){
  if([900,1800,3600].indexOf(secs) < 0) return;
  stopHeartSessions({immediate:true});
  showScreen('screen-stage2');
  s2.total = secs; s2.rem = secs; s2.lastDim = -1; s2.stepRem = S2_STEP_SECS; s2.peek = null; s2.active = true;
  var run = s2.run;
  document.querySelectorAll('#s2s-chain .s2s-chip').forEach(function(c){
    c.classList.remove('active','done','peek');
    c.setAttribute('aria-pressed','false');
    c.removeAttribute('aria-current');
  });
  var st=$('s2-start'), lv=$('s2-live');
  if(st) st.classList.add('is-hidden');
  if(lv) lv.classList.remove('is-hidden');
  try{ window.scrollTo({top:0,behavior:heartReducedMotion() ? 'auto' : 'smooth'}); }catch(e){ window.scrollTo(0,0); }
  heartFocus(lv && lv.querySelector('.session-end'));
  droneStart();                 // soft ambient pad beneath the mapping session
  s2RenderMeta();
  s2ShowStep(0, true);          // first step, with the bell
  s2.stepRem = S2_STEP_SECS;
  s2UpdateCountdown();
  s2.tick = setInterval(function(){
    if(!s2.active || s2.run !== run) return;
    s2.rem--;
    s2RenderMeta();
    if(s2.rem <= 0){ showStage2Completion(); return; }
    s2.stepRem--;                                // keep counting even while re-reading a step
    if(s2.stepRem <= 0){                          // interval elapsed: shift to the next step + bell
      if(s2.peek !== null){                       // a re-read ends when the rotation moves on
        s2.peek = null;
        clearStage2Peek();
      }
      s2ShowStep((s2.lastDim + 1) % S2_DIMENSIONS.length, true);
      s2.stepRem = S2_STEP_SECS;
    }
    s2UpdateCountdown();
  }, 1000);
}
function s2RenderMeta(){
  var t = $('s2s-timer'); if(t) t.textContent = pad(Math.floor(s2.rem/60)) + ':' + pad(s2.rem%60);
  var pct = Math.min(1, 1 - (s2.rem / s2.total));
  var bar = $('s2s-progress-fill'); if(bar) bar.style.width = (pct*100).toFixed(2) + '%';
}
function s2UpdateCountdown(){
  var e = $('s2s-countdown'); if(e) e.textContent = '0:' + pad(Math.max(0, s2.stepRem));
}
function s2ShowStep(step, ring){
  if(!s2.active) return;
  if(ring) breathBell(step % 2 === 0 ? 'inhale' : 'exhale');   // G4 / D4 — the same bell as Stage One
  var dim = S2_DIMENSIONS[step];
  setStage2Display(dim.label, 'Step ' + (step+1) + ' / ' + S2_DIMENSIONS.length, dim.prompt);
  updateStage2Chain(step);
  s2.lastDim = step;
}
function clearStage2Fades(){
  clearTimeout(s2.centerFade); clearTimeout(s2.promptFade);
  s2.centerFade = null; s2.promptFade = null;
  s2.displayRevision++;
  ['s2s-center','s2s-prompt'].forEach(function(id){ var el=$(id); if(el) el.classList.remove('fading'); });
}
function setStage2Display(center, label, prompt){
  clearStage2Fades();
  var revision = s2.displayRevision, run = s2.run;
  var c = $('s2s-center'), l = $('s2s-phase-label'), p = $('s2s-prompt');
  var reduced = heartReducedMotion();
  if(c && c.textContent !== center){
    var showCenter = function(){
      if(!s2.active || s2.run !== run || s2.displayRevision !== revision) return;
      s2.centerFade = null;
      c.textContent = center; c.classList.remove('fading');
    };
    if(reduced) showCenter();
    else { c.classList.add('fading'); s2.centerFade = setTimeout(showCenter,300); }
  }
  if(l) l.textContent = label;
  if(p && p.getAttribute('data-text') !== prompt){
    var showPrompt = function(){
      if(!s2.active || s2.run !== run || s2.displayRevision !== revision) return;
      s2.promptFade = null;
      p.innerHTML = prompt; p.setAttribute('data-text', prompt); p.classList.remove('fading');
    };
    if(reduced) showPrompt();
    else { p.classList.add('fading'); s2.promptFade = setTimeout(showPrompt,320); }
  }
}
function updateStage2Chain(active){
  document.querySelectorAll('#s2s-chain .s2s-chip').forEach(function(c){
    var i = parseInt(c.dataset.dim, 10);
    c.classList.remove('active','done');
    if(i < active) c.classList.add('done'); else if(i === active) c.classList.add('active');
    if(i === active) c.setAttribute('aria-current','step'); else c.removeAttribute('aria-current');
  });
}
function clearStage2Peek(){
  document.querySelectorAll('#s2s-chain .s2s-chip').forEach(function(c){
    c.classList.remove('peek');
    c.setAttribute('aria-pressed','false');
  });
}
function peekStage2Dimension(idx){
  if(!s2.active || typeof idx !== 'number' || idx % 1 !== 0 || idx < 0 || idx >= S2_DIMENSIONS.length) return;
  if(s2.peek === idx){ exitStage2Peek(); return; }
  s2.peek = idx;
  var dim = S2_DIMENSIONS[idx];
  document.querySelectorAll('#s2s-chain .s2s-chip').forEach(function(c){
    var peek = parseInt(c.dataset.dim,10) === idx;
    c.classList.toggle('peek', peek);
    c.setAttribute('aria-pressed', peek ? 'true' : 'false');
  });
  setStage2Display(dim.label, 'Re-reading · ' + dim.label + ' · tap again to return', dim.prompt);
}
function exitStage2Peek(){
  if(s2.peek === null || !s2.active) return;
  s2.peek = null;
  clearStage2Peek();
  s2ShowStep(s2.lastDim >= 0 ? s2.lastDim : 0, false);   // back to the current step, no bell
  s2UpdateCountdown();
}
function s2Stop(){
  s2.active = false;
  s2.run++;
  clearInterval(s2.tick); s2.tick = null;
  clearStage2Fades();
  s2.peek = null;
  clearStage2Peek();
  droneStop();
}
function showStage2Completion(){
  s2Stop();
  completeBell();   // the same closing bell as Stage One
  showHeartCompletion('stage2-completion');
}
function endStage2Session(){
  s2Stop();
  stopHeartAudio();
  closeHeartCompletion('stage2-completion');
  s2ShowStart();
  heartFocusStart('s2-start');
}
function restartStage2ToIntro(){
  stopHeartSessions({immediate:true});
  s1ResetIndicators();
  s1ShowStart();
  s2ShowStart();
  showScreen('screen-heart');
}

// Native buttons provide keyboard/touch activation. Only the source's named
// controls are dispatched; attached markup never evaluates code as an action.
var heartActions = {
  showInstructions:showInstructions,
  showStage2Preview:showStage2Preview,
  showStage2Instructions:showStage2Instructions,
  startWithDuration:startWithDuration,
  startStage2WithDuration:startStage2WithDuration,
  endSession:endSession,
  endStage2Session:endStage2Session,
  restartToIntro:restartToIntro,
  restartStage2ToIntro:restartStage2ToIntro,
  peekStage2Dimension:peekStage2Dimension,
  exitStage2Peek:exitStage2Peek,
  setWave:setWave,
  testBell:testBell
};
document.addEventListener('click',function(event){
  var target = event.target && event.target.closest ? event.target.closest('[data-call]') : null;
  if(!target || target.disabled) return;
  var action = target.dataset.call;
  if(!Object.prototype.hasOwnProperty.call(heartActions,action)) return;
  if(['startWithDuration','startStage2WithDuration','peekStage2Dimension','setWave'].indexOf(action) >= 0){
    var value = Number(target.dataset.value);
    if(!Number.isFinite(value)) return;
    if(action === 'setWave') heartActions[action](value,target);
    else heartActions[action](value);
  }else heartActions[action]();
});
document.addEventListener('input',function(event){
  var target = event.target;
  if(target && target.matches && target.matches('.bell-vol')) setBellVol(target.value);
});
[['completion',restartToIntro],['stage2-completion',restartStage2ToIntro]].forEach(function(pair){
  var dialog = $(pair[0]);
  if(dialog) dialog.addEventListener('cancel',function(event){ event.preventDefault(); pair[1](); });
});
window.addEventListener('pagehide',function(){
  stopHeartSessions({immediate:true});
  s1ResetIndicators();
  s1ShowStart();
  s2ShowStart();
});
syncBellVolUI();
