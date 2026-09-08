import { forecastWorld, brier, mean, posteriorMean, calibration } from '../core.js';
import { $, button, slider, bindSlider, research, announce, seed } from '../ui.js';
export function mount() {
  const world = forecastWorld(seed()), records = [], history = [...world.history];
  let p = .5, round = 0, locked = false, usedHint = false;
  $('#stage').innerHTML = `<div class="stage-top"><strong>Will the next seed glow?</strong><span id="round-count">1 / 12</span></div><div class="probability-orbit"><div class="probability-ring" id="seed-face" aria-label="Next outcome is hidden">?</div></div><div class="seed-row" id="seed-row" aria-hidden="true"></div><p class="hint" id="history-description" style="text-align:center;padding:0 18px"></p><div class="stats"><div class="stat"><strong id="score">—</strong><span>your Brier score ↓</span></div><div class="stat"><strong>0.250</strong><span>always guessing 50%</span></div><div class="stat"><strong id="count">0 / 12</strong><span>forecasts recorded</span></div></div>`;
  $('#controls').innerHTML = `<h2>Guess a chance, not a certainty.</h2><p>Gold seeds glowed. Empty seeds stayed dark. Each new seed has the same hidden chance of glowing.</p>${slider('chance','Chance of a glow',50,0,100,5,'%')}<p class="small">0% = never. 50% = half the time. 100% = always.</p>${button('forecast','Lock my forecast',true)}${button('next','Next seed')}<hr>${button('clue','Show a counting hint')}<p class="small" id="clue-text">A smaller Brier score is better. A single surprising result does not make a sensible forecast bad.</p>`;
  $('#extra').innerHTML = `<details class="history"><summary>My forecasts</summary><div class="forecast-table"><table><thead><tr><th>Round</th><th>Forecast</th><th>Result</th><th>Score</th></tr></thead><tbody id="forecast-rows"></tbody></table></div></details>`;
  const paint = () => {
    $('#seed-row').innerHTML = history.map(glow => `<span class="seed-dot ${glow?'lit':''}"></span>`).join('');
    $('#history-description').textContent = `${history.filter(Boolean).length} glowed out of ${history.length} seeds opened. Gold = glow; outline = dark.`;
    $('#score').textContent = records.length ? mean(records.map(r=>r.score)).toFixed(3) : '—';
    $('#count').textContent = `${records.length} / 12`;
    $('#forecast-rows').innerHTML = records.map((r,i)=>`<tr><td>${i+1}${r.hint?' · hint':''}</td><td>${Math.round(r.p*100)}%</td><td>${r.y?'Glow':'Dark'}</td><td>${r.score.toFixed(3)}</td></tr>`).join('');
  };
  bindSlider('chance', value => p = value / 100, v => `${v}%`);
  $('#next').hidden = true;
  $('#clue').addEventListener('click', () => {
    if (locked) return; usedHint = true;
    $('#clue-text').textContent = `One simple model guesses ${Math.round(posteriorMean(history)*100)}%: add one glow and one dark seed to the counts. This is a starting model, not knowledge of the hidden chance. This round will be marked “hint”.`;
  });
  $('#forecast').addEventListener('click', () => {
    if (locked) return; locked = true;
    const y = world.future[round];
    records.push({p,y,hint:usedHint,score:brier(p,y)}); history.push(y);
    $('#seed-face').textContent = y ? 'Glow' : 'Dark';
    $('#seed-face').className = `probability-ring ${y?'':'dark'}`;
    $('#seed-face').setAttribute('aria-label', y ? 'The seed glowed' : 'The seed stayed dark');
    $('#chance').disabled = true; $('#forecast').disabled = true; $('#clue').disabled = true;
    $('#next').hidden = false; $('#next').textContent = round === 11 ? 'Reveal this world' : 'Next seed';
    paint(); announce(`You forecast ${Math.round(p*100)}%. This seed ${y?'glowed':'stayed dark'}. This round’s score is ${brier(p,y).toFixed(3)}. Keep judging forecasts across many seeds.`);
  });
  $('#next').addEventListener('click', () => {
    if (round < 11) {
      round++; locked = false; usedHint = false;
      $('#round-count').textContent = `${round+1} / 12`; $('#seed-face').textContent = '?'; $('#seed-face').className = 'probability-ring'; $('#seed-face').setAttribute('aria-label','Next outcome is hidden');
      $('#chance').disabled = false; $('#forecast').disabled = false; $('#clue').disabled = false; $('#next').hidden = true;
      $('#clue-text').textContent = 'The hidden chance is unchanged. You can change your forecast as clues arrive.';
      announce('The next result is still hidden. Your last forecast is a starting point; change it if you wish.');
      return;
    }
    $('#seed-face').textContent = `${Math.round(world.probability*100)}%`;
    $('#seed-face').setAttribute('aria-label','The hidden probability');
    $('#round-count').textContent = 'Complete';
    const bins = calibration(records);
    $('#controls').innerHTML = `<h2>The hidden chance was ${Math.round(world.probability*100)}%.</h2><p>That was the rule for all 24 seeds, including the first 12 clues. A short sample can look different from its rule.</p><p>Your average score: <strong>${mean(records.map(r=>r.score)).toFixed(3)}</strong>. ${records.filter(r=>r.hint).length} forecasts used a hint.</p>${button('restart','Explore a new world',true)}`;
    $('#restart').addEventListener('click',mount);
    $('#extra').insertAdjacentHTML('beforeend',`<details class="history"><summary>Did my chances match what happened?</summary><p class="hint">These groups are tiny. Empty groups have no estimate.</p><div class="forecast-table"><table><thead><tr><th>Forecast band</th><th>Seeds</th><th>Mean forecast</th><th>Actually glowed</th></tr></thead><tbody>${bins.map((b,i)=>`<tr><td>${b.lo*100}–${b.hi*100}%${i<3?' (upper edge excluded)':''}</td><td>${b.n}</td><td>${b.n?Math.round(b.predicted*100)+'%':'—'}</td><td>${b.n?Math.round(b.observed*100)+'%':'—'}</td></tr>`).join('')}</tbody></table></div></details>`);
    announce('You practised leaving room for an outcome you could not see. Twelve forecasts are not a stable measure of forecasting ability.','success');
  });
  paint(); announce('All outcomes were set before your first forecast. Changing the slider cannot change a seed.');
  research({question:'Why does honest uncertainty matter?',finding:'Proper probability scores reward reporting the probability you believe, in expectation. A Brier score evaluates probability accuracy; it is not a pure measure of calibration alone.',model:'A fixed chance is chosen for each session. Twenty-four independent pseudorandom draws are generated before play; twelve are shown as clues and twelve stay hidden. The optional hint is a Beta(1,1) posterior mean for independent Bernoulli trials with a fixed rate. This assumption is exactly the simulated world, but does not fit every real world.',limits:'A short run is noisy. The displayed calibration table has at most twelve observations. These original activities have not been shown to improve general forecasting, and no real event is being predicted.',maths:'Binary Brier = mean((p − outcome)²). Hint p = (glows + 1) / (observations + 2).',sources:[['Brier (1950) · Verification of forecasts expressed in terms of probability','https://journals.ametsoc.org/view/journals/mwre/78/1/1520-0493_1950_078_0001_vofeit_2_0_co_2.xml']]});
}
