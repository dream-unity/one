import { makeFlock, stepFlock, flockReport } from '../core.js';
import { $, button, slider, bindSlider, research, announce, animation, seed } from '../ui.js';
export function mount() {
  let startSeed=seed(), a, b, seconds=0, frames=0, samples=[];
  const baseline={space:1.4,align:1,near:.6}, rules={space:1.4,align:0,near:.6};
  $('#stage').innerHTML=`<div class="stage-top"><strong>Two worlds. The same beginning.</strong><span id="flock-time">0 / 20 s</span></div><div class="flock-pair">${['a','b'].map((id,i)=>`<div class="flock-pane"><p>${i?'B · Your rules':'A · Fixed rules'}</p><canvas width="600" height="360" id="flock-${id}" aria-label="${i?'Changed':'Reference'} flock, with the measured results below">Flock animation. Read the live alignment and crowding below.</canvas><div class="flock-readout"><strong id="align-${id}">0%</strong> direction agreement<br><span id="crowd-${id}">0%</span> have a very close neighbour</div></div>`).join('')}</div><div class="flock-chart"><svg viewBox="0 0 600 126" role="img" aria-label="Alignment over twenty seconds. Blue is the fixed world; gold is your world."><path d="M32 6V102H586" fill="none" stroke="#43566e"/><text x="0" y="16" fill="#a6b5c8" font-size="12">1</text><text x="0" y="104" fill="#a6b5c8" font-size="12">0</text><text x="32" y="121" fill="#a6b5c8" font-size="12">0 s</text><text x="558" y="121" fill="#a6b5c8" font-size="12">20 s</text><path id="chart-a" d="" fill="none" stroke="#8abbff" stroke-width="2"/><path id="chart-b" d="" fill="none" stroke="#ffd489" stroke-width="2"/></svg><p class="hint">Alignment over time · blue A · gold B</p></div>`;
  $('#controls').innerHTML=`<h2>Make a flock without a leader.</h2><p>Every dot checks its neighbours. Change a rule in B, then run both worlds from the same start.</p>${slider('space','Keep some space',1.4,0,2,.1)}${slider('align','Face the same way',0,0,2,.1)}${slider('near','Stay near neighbours',.6,0,2,.1)}${button('run','Run both worlds',true)}<div class="button-row">${button('step','One small step')}${button('restart','Same start')}</div>${button('new','New shared start')}<hr>${button('match','Give B the same rules as A')}<p class="small">Fixed world A: space 1.4, face 1.0, near 0.6. Sliders are rule weights, not biological units.</p>`;
  const contexts=['a','b'].map(id=>$('#flock-'+id).getContext('2d'));
  const paintFlock=(flock,ctx,color)=>{
    if(!ctx)return;ctx.clearRect(0,0,600,360);ctx.fillStyle=color;
    for(const bird of flock){ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.atan2(bird.vy,bird.vx));ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-4,-3);ctx.lineTo(-2,0);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();ctx.restore();}
  };
  const paint=()=>{
    paintFlock(a,contexts[0],'#8abbff');paintFlock(b,contexts[1],'#ffd489');
    const ar=flockReport(a),br=flockReport(b);
    for(const [id,r]of [['a',ar],['b',br]]){$('#align-'+id).textContent=`${Math.round(r.alignment*100)}%`;$('#crowd-'+id).textContent=`${Math.round(r.crowded*100)}%`;}
    $('#flock-time').textContent=`${seconds.toFixed(1)} / 20 s`;
    if(!samples.length||seconds-samples.at(-1).t>=.45){samples.push({t:seconds,a:ar.alignment,b:br.alignment});}
    for(const id of ['a','b'])$('#chart-'+id).setAttribute('d',samples.map((s,i)=>`${i?'L':'M'}${32+s.t/20*550},${102-s[id]*94}`).join(' '));
  };
  const controlsLocked=lock=>{for(const id of ['space','align','near','match','new','step'])$('#'+id).disabled=lock;};
  const loop=animation(dt=>{
    a=stepFlock(a,baseline,dt);b=stepFlock(b,rules,dt);seconds=Math.min(20,seconds+dt);frames++;
    if(frames%4===0||seconds>=20)paint();
    if(seconds>=20){const ar=flockReport(a),br=flockReport(b);announce(`After the same twenty seconds: A alignment ${Math.round(ar.alignment*100)}%, B ${Math.round(br.alignment*100)}%. B crowding ${Math.round(br.crowded*100)}%. Try a new shared start before deciding a rule always works.`,'success');return false;}
  },()=>{$('#run').textContent=seconds>=20?'Run again from this start':'Resume both worlds';controlsLocked(false);});
  const reset=()=>{loop.pause();seconds=0;frames=0;samples=[];a=makeFlock(startSeed);b=makeFlock(startSeed);paint();$('#run').textContent='Run both worlds';controlsLocked(false);};
  for(const key of ['space','align','near'])bindSlider(key,v=>{rules[key]=v;reset();announce('Rule changed. Both worlds have returned to the same starting positions and directions.');},v=>v.toFixed(1));
  $('#run').addEventListener('click',()=>{if(loop.running){loop.pause();announce('Both worlds paused. Changing a rule will restart both from the same beginning.');return;}if(seconds>=20)reset();controlsLocked(true);$('#run').textContent='Pause both worlds';loop.play();announce('No dot knows the whole flock. Each sees only nearby dots.');});
  $('#step').addEventListener('click',()=>{if(seconds>=20)return;a=stepFlock(a,baseline,1/60);b=stepFlock(b,rules,1/60);seconds+=1/60;paint();announce(`Advanced both worlds by one sixtieth of a second. ${seconds.toFixed(2)} seconds total.`);});
  $('#restart').addEventListener('click',()=>{reset();announce('The same shared start is restored. Try changing just one rule.');});
  $('#new').addEventListener('click',()=>{startSeed=seed();reset();announce('A new beginning for both worlds, with your current rules.');});
  $('#match').addEventListener('click',()=>{Object.assign(rules,baseline);for(const key of ['space','align','near']){$('#'+key).value=rules[key];$('#'+key+'-value').textContent=rules[key].toFixed(1);}reset();announce('Both worlds now have identical rules and starts. They should match exactly. This is a useful control.');});
  reset();announce('Try adding “Face the same way” to B. Then compare alignment and crowding, not just how pretty the flock looks.');
  research({question:'Can simple rules make something new?',finding:'Reynolds’ boids model generates coordinated group motion from local separation, alignment and cohesion rules. A central director is not needed for this model’s flocking patterns.',model:'Each world has 48 agents on a wraparound surface. At each fixed 1/60-second step, agents read the previous positions and velocities of neighbours within 95 units. Steering is bounded; speed stays between 24 and 65 units per second. A and B share the same seeded initial state. Any rule change resets both worlds.',limits:'This is an original simplified boids implementation, not a faithful animal model. Alignment is the length of the mean unit direction vector. Crowding counts agents with a neighbour within 12 units. Neither measure captures all desirable group behaviour. Collective patterns do not establish consciousness, intention or social wisdom.',maths:'Alignment = |Σ(vᵢ / |vᵢ|)| / N. An edge wraps to the opposite edge; it is not a wall.',sources:[['Craig Reynolds (1987) · Flocks, Herds, and Schools','https://www.red3d.com/cwr/papers/1987/boids.html'],['Craig Reynolds · Boids background and model rules','https://www.red3d.com/cwr/boids/']]});
}
