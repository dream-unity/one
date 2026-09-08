import { makeBall, stepBall, energies, bounceHeight } from '../core.js';
import { $, $$, button, slider, bindSlider, research, announce, animation } from '../ui.js';
export function mount() {
  let height = 3, mass = 1, restitution = .8, gravity = 9.81, ball, prediction = null, finished = false, began = false, previousV = 0;
  const rows = [], target = 1.5, tolerance = .15;
  $('#stage').innerHTML = `<div class="stage-top"><strong>Can your first bounce reach the gold band?</strong><span id="drop-time">0.0 s</span></div><svg viewBox="0 0 640 380" role="img" aria-labelledby="matter-description"><title id="matter-description">A ball falls and bounces. The goal band is 1.35 to 1.65 metres high.</title><defs><linearGradient id="fall-glow" x2="0" y2="1"><stop stop-color="#c2acff" stop-opacity=".5"/><stop offset="1" stop-color="#c2acff" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3,4,5].map(h=>`<line x1="78" x2="598" y1="${340-h*60}" y2="${340-h*60}" stroke="#26374c"/><text x="52" y="${345-h*60}" fill="#a6b5c8" font-size="14" text-anchor="end">${h} m</text>`).join('')}<rect x="80" y="${340-(target+tolerance)*60}" width="518" height="${tolerance*120}" fill="#ffd48912" stroke="#ffd48970" stroke-dasharray="4 6"/><text x="578" y="${340-(target+tolerance)*60-10}" text-anchor="end" fill="#ffd489" font-size="14">Catch band</text><line id="height-line" x1="320" x2="320" y1="160" y2="340" stroke="#c2acff40" stroke-dasharray="3 7"/><circle id="ball-halo" cx="320" cy="160" r="30" fill="#c2acff10"/><circle id="ball" cx="320" cy="160" r="11" fill="#dfd4ff"/><path id="velocity" d="" stroke="#c2acff" stroke-width="2"/><text id="height-label" x="355" y="160" fill="#edf3fa" font-size="16">3.00 m</text><line x1="78" x2="598" y1="353" y2="353" stroke="#8292a8" stroke-width="2"/></svg><div class="energy-panel">${[['height','Stored in height'],['motion','In movement'],['surroundings','To surroundings']].map(([key,label])=>`<div class="energy-row"><span>${label}</span><div class="energy-track"><span id="bar-${key}"></span></div><output id="energy-${key}">0 J</output></div>`).join('')}</div>`;
  $('#controls').innerHTML = `<h2>Change one thing. Try again.</h2><p>A star is just a ball in this world. Choose its height and bounce. Guess where its first bounce will peak.</p>${slider('height','Release height',3,.5,5,.1,' m')}${slider('bounce','Bounce setting',80,10,95,5,'%')}${slider('mass','Mass',1,.5,3,.5,' kg')}<label class="field-label" for="gravity">Gravity</label><select id="gravity"><option value="9.81">Earth · 9.81 m/s²</option><option value="1.62">Moon · 1.62 m/s²</option></select><div class="button-row" role="group" aria-label="My first bounce will peak"><button class="choice" data-guess="below" aria-pressed="false">Below</button><button class="choice" data-guess="inside" aria-pressed="false">In band</button><button class="choice" data-guess="above" aria-pressed="false">Above</button></div>${button('drop','Drop the star',true)}${button('reset','Reset the drop')}<p class="small">The bounce setting is the fraction of speed kept after a hit. It is not the fraction of height kept.</p>`;
  $('#extra').innerHTML = `<details class="history"><summary>Compare my drops</summary><p class="hint">To test a cause, change one setting and keep the others the same. No air resistance is included.</p><div class="forecast-table"><table><thead><tr><th>Height</th><th>Bounce</th><th>Mass</th><th>Gravity</th><th>First peak</th><th>Guess</th></tr></thead><tbody id="drop-rows"></tbody></table></div></details>`;
  const setLocked = lock => { for (const id of ['height','bounce','mass','gravity']) $('#' + id).disabled = lock; $$('[data-guess]').forEach(b=>b.disabled=lock); };
  const draw = () => {
    const y = 340-ball.y*60;
    $('#ball').setAttribute('cy',y); $('#ball-halo').setAttribute('cy',y);
    $('#height-line').setAttribute('y1',y); $('#height-label').setAttribute('y', Math.max(20,y-12));
    $('#height-label').textContent = `${ball.y.toFixed(2)} m`;
    $('#drop-time').textContent = `${ball.t.toFixed(1)} s`;
    const end = Math.max(18,Math.min(330,y-ball.v*5));
    $('#velocity').setAttribute('d', Math.abs(ball.v) < .1 ? '' : `M320 ${y}V${end}m-4 ${ball.v>0?5:-5} 4 ${ball.v>0?-5:5} 4 ${ball.v>0?5:-5}`);
    for (const [key,value] of Object.entries(energies(ball))) {
      $('#bar-' + key).style.width = `${value / ball.initial * 100}%`; $('#energy-' + key).textContent = `${value.toFixed(2)} J`;
    }
  };
  const loop = animation(dt => {
    previousV = ball.v; ball = stepBall(ball,dt); draw();
    if ((ball.hits >= 1 && previousV > 0 && ball.v <= 0) || ball.rest || ball.t > 22) {
      finished = true; setLocked(false);
      const peak = bounceHeight(height,restitution), actual = peak < target-tolerance ? 'below' : peak > target+tolerance ? 'above' : 'inside';
      rows.push({height,mass,restitution,gravity,peak,prediction,actual});
      $('#drop-rows').innerHTML = rows.map(r=>`<tr><td>${r.height.toFixed(1)} m</td><td>${Math.round(r.restitution*100)}%</td><td>${r.mass} kg</td><td>${r.gravity}</td><td>${r.peak.toFixed(2)} m</td><td>${r.prediction} · ${r.prediction===r.actual?'matched':'different'}</td></tr>`).join('');
      announce(`The first bounce peaks at ${peak.toFixed(2)} m: ${actual === 'inside' ? 'inside the catch band' : actual + ' the band'}. Your guess ${prediction===actual?'matched':'was different'}. Try changing only mass: will the peak move?`,actual==='inside'?'success':'');
      $('#drop').textContent = 'Drop again';
      return false;
    }
  },()=>{ if (!finished && began) { $('#drop').textContent = 'Resume the drop'; announce('The drop is paused. Resume when you are ready.'); } });
  const reset = () => {
    loop.pause(); began = false; finished = false; ball = makeBall({height,mass,restitution,gravity}); draw(); setLocked(false);
    $('#drop').textContent = 'Drop the star'; $('#drop').disabled = prediction === null;
  };
  bindSlider('height',v=>{height=v;reset();},v=>`${v.toFixed(1)} m`);
  bindSlider('bounce',v=>{restitution=v/100;reset();},v=>`${v}%`);
  bindSlider('mass',v=>{mass=v;reset();},v=>`${v} kg`);
  $('#gravity').addEventListener('change',()=>{gravity=Number($('#gravity').value);reset();});
  $$('[data-guess]').forEach(b=>b.addEventListener('click',()=>{
    prediction=b.dataset.guess; $$('[data-guess]').forEach(c=>c.setAttribute('aria-pressed',String(b===c))); $('#drop').disabled=false;
  }));
  $('#drop').addEventListener('click',()=>{
    if (loop.running) { loop.pause(); return; }
    if (!began || finished) { ball=makeBall({height,mass,restitution,gravity}); finished=false; began=true; }
    setLocked(true); $('#drop').textContent='Pause the drop'; loop.play(); announce('Watch the three energy bars. Energy can change form without vanishing.');
  });
  $('#reset').addEventListener('click',()=>{reset();announce('Ready for another controlled experiment. Choose a guess, then drop.');});
  reset(); announce('Choose Below, In band or Above before you drop. The gold band is 1.35–1.65 metres high.');
  research({question:'Where does a bounce go?',finding:'In ideal free fall, gravitational potential energy becomes kinetic energy. An inelastic collision transfers some mechanical energy to the surroundings, including internal energy and sound.',model:'Free-flight segments use constant gravitational acceleration and exact impact times. A speed restitution coefficient e sets the upward speed after each hit. The first rebound height is e² times the starting height; mass changes joules, not the rebound height. The three bars sum to the initial energy. Tiny final rebounds are brought to rest and their remaining energy is assigned to surroundings.',limits:'This is an ideal, one-dimensional teaching model. No air drag, spin, ball deformation or temperature-dependent bounce is modelled. “Star” is a playful name; this does not simulate stellar physics. A real ball must be measured to estimate its restitution coefficient.',maths:'Height energy = mgh; movement energy = ½mv²; first bounce height = e² × start height. Energy to surroundings = initial energy − height energy − movement energy.',sources:[['University of Colorado PhET · Energy Skate Park','https://phet.colorado.edu/en/simulations/energy-skate-park']]});
}
