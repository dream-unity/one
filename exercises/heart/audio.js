'use strict';

// Audio transplanted from the supplied Project Meaning index.html.
// Only audio-resource ownership, browser resume handling and cleanup are added.

/* ---- temple bell: a soft, warm singing-bowl tone, lightly shimmering, in a long temple reverb. ----
   No voices, no ambient drone. A near-pure low-ish fundamental with a slow detuned twin (a
   gentle living shimmer), a soft octave, and one quiet inharmonic partial for true bowl
   character — at this pitch that overtone lands near 950 Hz, well clear of the harsh 2-5 kHz
   band, so it adds beauty without biting. The core tone is gently widened in stereo; a long,
   warm convolution reverb gives the spacious, serene tail of a temple hall. Slow swelling
   attack (no struck "ping"), quiet by design. */
var _actx = null, _verb = null;
// Each resource belongs to its own strike/session. A delayed cleanup must never
// refer to the next session's graph, even after a rapid End -> Start sequence.
var _heartAudioEpoch = 0, _heartResumePromise = null, _heartDronePending = null;
var _heartCueTimers = new Set(), _heartStrikes = new Set(), _heartFadingDrones = new Set();
var _heartReverbNodes = [];

function getHeartAudioState(){
  var state = _actx ? _actx.state : 'unavailable';
  return {
    contextState: state,
    soundActive: state === 'running' && !!(_drone || _heartStrikes.size || _heartFadingDrones.size),
    padActive: state === 'running' && !!(_drone || _heartFadingDrones.size)
  };
}
function _notifyHeartAudioState(){
  if(typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function'){
    window.dispatchEvent(new window.CustomEvent('heart-audio-state', {detail:getHeartAudioState()}));
  }
}
function _resumeHeartAudio(ac){
  if(ac.state === 'running') return Promise.resolve(true);
  if(ac.state === 'closed' || typeof ac.resume !== 'function') return Promise.resolve(false);
  if(_heartResumePromise && _heartResumePromise.context === ac) return _heartResumePromise.promise;
  var request = {context:ac, promise:null};
  try {
    request.promise = Promise.resolve(ac.resume()).then(function(){
      _notifyHeartAudioState();
      return ac.state === 'running';
    }, function(){
      _notifyHeartAudioState();
      return false;
    }).then(function(ready){
      if(_heartResumePromise === request) _heartResumePromise = null;
      return ready;
    });
  } catch(e){
    _notifyHeartAudioState();
    return Promise.resolve(false);
  }
  _heartResumePromise = request;
  return request.promise;
}
function _heartCue(fn, delay){
  var epoch = _heartAudioEpoch;
  var timer = setTimeout(function(){
    _heartCueTimers.delete(timer);
    if(epoch === _heartAudioEpoch) fn();
  }, delay);
  _heartCueTimers.add(timer);
  return timer;
}
function _disconnectHeartNodes(nodes){
  (nodes || []).forEach(function(n){ try{ if(n) n.disconnect(); }catch(e){} });
}
function _disposeHeartStrike(strike){
  if(!strike || strike.disposed) return;
  strike.disposed = true;
  clearTimeout(strike.cleanupTimer);
  strike.osc.forEach(function(o){ try{ o.stop(); }catch(e){} });
  _disconnectHeartNodes(strike.osc);
  _disconnectHeartNodes(strike.node);
  _heartStrikes.delete(strike);
  _notifyHeartAudioState();
}
function _disposeHeartDrone(d){
  if(!d || d.disposed) return;
  d.disposed = true;
  clearTimeout(d.cleanupTimer);
  (d.osc || []).forEach(function(o){ try{ o.stop(); }catch(e){} });
  _disconnectHeartNodes(d.osc);
  _disconnectHeartNodes(d.node);
  _heartFadingDrones.delete(d);
  if(_drone === d) _drone = null;
  _notifyHeartAudioState();
}
function _audio(){
  if(_actx && _actx.state !== 'closed') return _actx;
  if(_actx && _actx.state === 'closed'){
    stopHeartAudio({immediate:true});
    _actx = null;
  }
  try { var AC = window.AudioContext || window.webkitAudioContext; if(AC) _actx = new AC(); }
  catch(e){ _actx = null; }
  if(_actx) _actx.onstatechange = _notifyHeartAudioState;
  _notifyHeartAudioState();
  return _actx;
}
function _reverbBus(ac){
  if(_verb) return _verb;
  // long impulse response: exponentially-decaying stereo noise, low-passed for a warm (not dead) tail
  var sr = ac.sampleRate, len = Math.floor(sr * 4.5), buf = ac.createBuffer(2, len, sr);
  for(var ch = 0; ch < 2; ch++){
    var d = buf.getChannelData(ch), last = 0;
    for(var i = 0; i < len; i++){
      var env = Math.pow(1 - i / len, 2.5);
      var n = (Math.random() * 2 - 1) * env;
      last = last + 0.10 * (n - last);   // one-pole lowpass (~600 Hz) -> warm, spacious, no hiss
      d[i] = last;
    }
  }
  var conv = ac.createConvolver(); conv.buffer = buf;     // normalize=true keeps level steady
  var wlp  = ac.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 1800; wlp.Q.value = 0.2;
  var wet  = ac.createGain(); wet.gain.value = 0.55;
  var dry  = ac.createGain(); dry.gain.value = 0.90;
  var send = ac.createGain(); send.gain.value = 1;
  send.connect(dry); send.connect(conv); conv.connect(wlp); wlp.connect(wet);
  dry.connect(ac.destination); wet.connect(ac.destination);
  _heartReverbNodes = [send, dry, conv, wlp, wet];
  _verb = send;
  return _verb;
}
function bowl(fund, peak, decay){
  var ac = _audio(); if(!ac) return false;
  if(ac.state !== 'running'){
    var epoch = _heartAudioEpoch;
    return _resumeHeartAudio(ac).then(function(ready){
      if(ready && epoch === _heartAudioEpoch) return bowl(fund, peak, decay);
      return false;
    });
  }
  var dest = _reverbBus(ac);
  var t = ac.currentTime;
  peak  = (peak  == null) ? 0.08 : peak;
  decay = decay || 3.5;
  // Per-option bell volume, set by the user via the volume bar (defaults keep the soft delta bell).
  peak *= bellGain();
  // An exponential AudioParam ramp cannot target zero. Zero on the source
  // volume control is silence, so it needs no strike graph at all.
  if(peak <= 0) return false;

  // gentle lowpass that closes as it decays -> mellow throughout, guarantees nothing bright
  var lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.3;
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(1100, t + decay * 0.5);
  lp.connect(dest);
  var strike = {osc:[], node:[lp], cleanupTimer:null, disposed:false};
  _heartStrikes.add(strike);

  // [ratio, gain, decayScale, pan] — warm, with one soft inharmonic shimmer (safe at this low pitch)
  var partials = [
    [1.000, 1.00, 1.00, -0.30],   // fundamental, slightly left
    [1.003, 0.70, 1.00,  0.30],   // detuned twin, slightly right -> wide living shimmer
    [2.000, 0.26, 0.78,  0.00],   // soft octave, centred
    [2.760, 0.07, 0.45,  0.18]    // characteristic bowl partial (~950 Hz here), brief, gentle
  ];
  partials.forEach(function(p){
    var d = decay * p[2];
    var o = ac.createOscillator(), g = ac.createGain();
    strike.osc.push(o); strike.node.push(g);
    o.type = 'sine';
    o.frequency.value = fund * p[0];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * p[1], t + 0.045);  // slow swelling attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    var tail = g;
    if(p[3] && ac.createStereoPanner){
      var pan = ac.createStereoPanner(); pan.pan.value = p[3];
      strike.node.push(pan);
      g.connect(pan); tail = pan;
    }
    tail.connect(lp);
    o.start(t); o.stop(t + d + 0.1);
  });
  // release this strike's filter after it has decayed (prevents node buildup over long sessions)
  strike.cleanupTimer = setTimeout(function(){ _disposeHeartStrike(strike); }, (decay + 0.4) * 1000);
  _notifyHeartAudioState();
  return true;
}
// Breath cue: a soft strike that rings, then dissolves into the long reverb.
// Inhale a perfect-fourth above the exhale — the same bowl, struck for in vs out.
function breathBell(phase){ return bowl(phase === 'inhale' ? 392.00 : 293.66, 0.08, 3.3); }
// Completion: a fuller, long temple bell, then a lower strike — spacious and serene.
function completeBell(){ bowl(392.00, 0.13, 8.5); _heartCue(function(){ bowl(293.66, 0.11, 9.5); }, 3000); }

// ── Ambient pad ── a low, soft sustained drone that runs beneath the Stage One
// session: the calm background layer the bell rings over. Built on its OWN
// independent graph straight to the speakers — it shares nothing with the bell
// synthesis, so it cannot change the bell sound (audio simply sums at output).
// Entrainment pad, tuned to D so it sits consonantly under both bell strikes. A warm
// open fifth + octave on D spread across the stereo field; A3 is a hard-panned
// pair whose difference is a binaural beat (true binaural on headphones). Both
// the binaural beat and an isochronic tremolo over the whole pad run at the
// selected rate, easing in from the top of the chosen band over the first minute — 10 Hz is
// the alpha frequency most linked to creativity (Lustenberger et al. 2015), and
// 10-12 Hz is the upper-alpha ideation band. The rate is user-selectable: delta
// (0.5-4 Hz) for deep restorative rest, or alpha (8-12 Hz) for relaxed focus.
// Reads on a phone speaker too.
// Nothing below ~145 Hz, high-passed: clean, no sub buzz.
var _drone = null;
var WAVE_HZ = 10;   // selected entrainment rate (Hz): delta 0.5-4 (rest) or alpha 8-12 (focus); 10 = creativity (Lustenberger 2015)
var WAVE_ON = true;   // false = no entrainment pad at all (bell only)
// Per-option bell volume (0..1), one remembered value per selectable option ('0' = off).
// Defaults preserve current behaviour: soft bell under delta, full bell for alpha and off.
var BELL_VOL = { '0': 1.0, '1': 0.48, '2': 0.48, '3': 0.48, '8': 1.0, '10': 1.0, '12': 1.0 };

// set the entrainment rate from the selector; takes effect on the next session start
function setWave(hz, btn){
  hz = parseFloat(hz) || 0;
  if(hz <= 0){ WAVE_ON = false; }                       // "Off": bell only, no pad
  else { WAVE_ON = true; WAVE_HZ = Math.max(0.5, Math.min(12, hz)); }
  document.querySelectorAll('.rate-btn').forEach(function(b){
    var v = parseFloat(b.dataset.hz) || 0;
    var on = v <= 0 ? !WAVE_ON : (WAVE_ON && v === WAVE_HZ);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  syncBellVolUI();                         // show this option's saved bell volume
}

// ----- per-option bell volume -----
function currentWaveKey(){ return WAVE_ON ? String(WAVE_HZ) : '0'; }       // '0' = waves off
function bellVol(){ var v = BELL_VOL[currentWaveKey()]; return (v == null) ? 1.0 : v; }
// The slider stores 0..1.5 (shown as 0..150%). Below 100% it's a straight cut; ABOVE 100% the gain
// climbs much faster (150% -> ~2.5x, about +8 dB) so turning it up past normal is clearly audible,
// not the timid +3.5 dB a literal 1.5x would give on a short bell.
function bellGain(){ var v = bellVol(); return (v <= 1) ? v : 1 + (v - 1) * 3; }
function syncBellVolUI(){
  var v = bellVol();
  document.querySelectorAll('.bell-vol').forEach(function(s){ s.value = v; });
  document.querySelectorAll('.bell-vol-val').forEach(function(e){ e.textContent = Math.round(v * 100) + '%'; });
}
function setBellVol(v){
  v = parseFloat(v); if(isNaN(v)) v = 1.0;
  v = Math.max(0, Math.min(1.5, v));
  BELL_VOL[currentWaveKey()] = v;          // remember it for the currently selected option
  document.querySelectorAll('.bell-vol-val').forEach(function(e){ e.textContent = Math.round(v * 100) + '%'; });
  document.querySelectorAll('.bell-vol').forEach(function(s){ if(parseFloat(s.value) !== v) s.value = v; });
}
function testBell(){ breathBell('inhale'); _heartCue(function(){ breathBell('exhale'); }, 650); }  // quick bell-only preview at the current volume
function droneStart(){
  if(_drone) return _actx && _actx.state === 'running';  // already running
  if(_heartDronePending) return _heartDronePending.promise;
  if(!WAVE_ON) return false;             // pad turned off (Hz "Off") -> bell only
  var ac = _audio(); if(!ac) return false;
  if(ac.state !== 'running'){
    var pending = {epoch:_heartAudioEpoch, promise:null};
    _heartDronePending = pending;
    pending.promise = _resumeHeartAudio(ac).then(function(ready){
      if(_heartDronePending !== pending) return false;
      _heartDronePending = null;
      if(ready && pending.epoch === _heartAudioEpoch) return droneStart();
      return false;
    });
    return pending.promise;
  }
  var t = ac.currentTime;
  var hasPan = (typeof ac.createStereoPanner === 'function');
  var SETTLE = 60;                                  // seconds to ease the rate in
  var aEnd = Math.max(0.5, Math.min(12, WAVE_HZ)); // target rate (Hz): delta or alpha
  var bandTop = (aEnd >= 5) ? 12 : 4;               // alpha ceiling vs delta ceiling
  var aTop = Math.min(bandTop, aEnd + 2);           // ease in from the top of the chosen band
  var isDelta = aEnd < 5;                           // delta = deep-rest mode: gentler, slower

  var mix  = ac.createGain(); mix.gain.value = 1;                       // carrier sum
  var trem = ac.createGain(); trem.gain.value = 0.5;                    // pulse stage (delta/alpha rate)
  var hp   = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = isDelta ? 45 : 110; hp.Q.value=0.5;  // delta keeps its sub foundation
  var lp   = ac.createBiquadFilter(); lp.type='lowpass';  lp.frequency.value = isDelta ? 480 : 1000; lp.Q.value=0.4; // delta sits low and dark
  var env  = ac.createGain();                                           // master swell + slow drift
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1.8, t + (isDelta ? 13 : 4.5));  // slow, deep onset for delta rest

  mix.connect(trem); trem.connect(hp); hp.connect(lp); lp.connect(env); env.connect(ac.destination);

  var osc = [], node = [mix, trem, hp, lp, env];
  function voice(freq, gain, pan){
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = gain;
    if(hasPan && pan){ var p = ac.createStereoPanner(); p.pan.value = pan; o.connect(g); g.connect(p); p.connect(mix); node.push(p); }
    else { o.connect(g); g.connect(mix); }
    o.start(t); osc.push(o); node.push(g); return o;
  }

  var bCenter = isDelta ? 110 : 220;   // binaural carrier centre: an octave lower for delta
  var bL, bR;
  if(isDelta){
    // DEEP DELTA: an octave below the alpha pad, dark, with NO bright presence tones -> nothing like alpha.
    voice(73.42,  0.052, -0.25);   // D2  sub foundation, felt more than heard
    voice(110.00, 0.070,  0.25);   // A2  low warm body
    bL = voice(bCenter - aTop/2, 0.084, -1.00);   // close-detuned low pair: the deep binaural beat
    bR = voice(bCenter + aTop/2, 0.084,  1.00);
    voice(146.83, 0.054,  0.00);   // D3  a touch of warmth above
    voice(220.00, 0.030, -0.20);   // A3  faint, just so it still reads on a phone speaker
    // a faint dark rumble (brown noise) -> the oceanic "deep sleep" texture, and unlike the sub sines it
    // actually carries on a small phone speaker. It runs through the pad so it pulses and swells with it.
    var nlen = Math.floor(ac.sampleRate * 4), nbuf = ac.createBuffer(1, nlen, ac.sampleRate), nd = nbuf.getChannelData(0), nlast = 0;
    for(var nk = 0; nk < nlen; nk++){ var nw = Math.random() * 2 - 1; nlast = (nlast + 0.02 * nw) / 1.02; nd[nk] = nlast * 2.0; }
    var nsrc = ac.createBufferSource(); nsrc.buffer = nbuf; nsrc.loop = true;
    var nlp = ac.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 210; nlp.Q.value = 0.3;
    var ngain = ac.createGain(); ngain.gain.value = 0.07;
    nsrc.connect(nlp); nlp.connect(ngain); ngain.connect(mix);
    nsrc.start(t); osc.push(nsrc); node.push(nlp, ngain);
  } else {
    // ALPHA: warm mid pad with bright presence carriers (unchanged).
    voice(146.83, 0.080, -0.40);   // D3  body, left
    voice(293.66, 0.042,  0.40);   // D4  soft octave
    bL = voice(bCenter - aTop/2, 0.058, -1.00);
    bR = voice(bCenter + aTop/2, 0.058,  1.00);
    voice(440.00, 0.050, -0.25);   // A4  the fifth, an octave up
    voice(587.33, 0.034,  0.25);   // D5  an octave above the exhale tone
  }
  // the binaural beat eases from aTop down to aEnd over the first minute, settling on the target rate.
  bL.frequency.setValueAtTime(bCenter - aTop/2, t); bL.frequency.linearRampToValueAtTime(bCenter - aEnd/2, t + SETTLE);
  bR.frequency.setValueAtTime(bCenter + aTop/2, t); bR.frequency.linearRampToValueAtTime(bCenter + aEnd/2, t + SETTLE);

  // the pulse: an isochronic tremolo at the chosen rate over the whole pad, eased in from the top
  // of the band so it stays locked with the binaural beat. A deeper, slower throb for delta.
  var alpha = ac.createOscillator(); alpha.type = 'sine';
  alpha.frequency.setValueAtTime(aTop, t); alpha.frequency.linearRampToValueAtTime(aEnd, t + SETTLE);
  var alphaGain = ac.createGain(); alphaGain.gain.value = isDelta ? 0.22 : 0.26;
  alpha.connect(alphaGain); alphaGain.connect(trem.gain); alpha.start(t);
  osc.push(alpha); node.push(alphaGain);

  // a very slow drift underneath, so the pad still breathes over ~15 s
  var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = isDelta ? 0.045 : 0.07;
  var lfoGain = ac.createGain(); lfoGain.gain.value = isDelta ? 0.18 : 0.03;
  lfo.connect(lfoGain); lfoGain.connect(env.gain); lfo.start(t);
  osc.push(lfo); node.push(lfoGain);

  _drone = { osc: osc, node: node, env: env, context:ac, cleanupTimer:null, disposed:false };
  _notifyHeartAudioState();
  return true;
}
function droneStop(options){
  _heartDronePending = null;
  var d = _drone; if(!d) return;
  _drone = null;                           // allow a fresh start immediately
  var ac = d.context;
  if((options && options.immediate) || !ac || ac.state !== 'running'){
    _disposeHeartDrone(d);
    return;
  }
  var t = ac.currentTime, fade = 3.0;
  try {
    d.env.gain.cancelScheduledValues(t);
    d.env.gain.setValueAtTime(Math.max(d.env.gain.value, 0.0001), t);
    d.env.gain.exponentialRampToValueAtTime(0.0001, t + fade);   // slow fade-out
  } catch(e){}
  _heartFadingDrones.add(d);
  d.cleanupTimer = setTimeout(function(){ _disposeHeartDrone(d); }, (fade + 0.3) * 1000);
  _notifyHeartAudioState();
}

// End keeps the source's three-second pad fade and already ringing bell tails.
// Leaving or replacing a session also removes tails immediately. Completion
// uses droneStop() + completeBell(); it must not cancel its own second strike.
function stopHeartAudio(options){
  var immediate = !!(options && options.immediate);
  _heartAudioEpoch++;
  _heartDronePending = null;
  _heartCueTimers.forEach(function(timer){ clearTimeout(timer); });
  _heartCueTimers.clear();
  droneStop({immediate:immediate});
  if(immediate){
    Array.from(_heartStrikes).forEach(_disposeHeartStrike);
    Array.from(_heartFadingDrones).forEach(_disposeHeartDrone);
    _disconnectHeartNodes(_heartReverbNodes);
    _heartReverbNodes = [];
    _verb = null;
  }
  _notifyHeartAudioState();
}
