import { signalField, brier, mean } from '../core.js';
import { $, $$, button, slider, bindSlider, research, announce, seed } from '../ui.js';
export function mount() {
  let runSeed = seed(), round = 0, field, choice = null, confidence = 70, assisted = false, locked = false;
  const records = [];
  $('#stage').innerHTML = `<div class="stage-top"><strong>Which way do more arrows point?</strong><span id="round-count">1 / 8</span></div><div class="signal-field" id="field" aria-hidden="true"></div><div class="stats"><div class="stat"><strong>48</strong><span>visible arrows</span></div><div class="stat"><strong id="look-count">—</strong><span>your answer</span></div><div class="stat"><strong id="certainty">70%</strong><span>your confidence</span></div></div><div class="round-strip" id="round-strip" aria-hidden="true"></div>`;
  $('#controls').innerHTML = `<h2>Look first. Then decide.</h2><p>Are more arrows pointing left or right? Take your time. Small differences can be hard to see.</p><div class="button-row"><button type="button" class="choice" id="left" aria-pressed="false">← Left</button><button type="button" class="choice" id="right" aria-pressed="false">Right →</button></div>${slider('confidence','How sure are you?',70,50,100,5,'%')}<p class="small">50% = either way. 100% = completely sure.</p>${button('check','Check what is there',true)}${button('again','Next field')}<hr>${button('group','Help me group the arrows')}<details><summary>Read the field as words</summary><p id="field-words" class="small"></p></details>`;
  const draw = () => {
    field = signalField(runSeed, round); choice = null; assisted = false; locked = false; confidence = 70;
    $('#field').className = 'signal-field';
    $('#field').innerHTML = field.values.map(right => `<span class="signal ${right ? 'right' : 'left'}">${right ? '→' : '←'}</span>`).join('');
    $('#field-words').textContent = field.values.map((right,i) => `${i % 8 === 0 ? `Row ${Math.floor(i / 8) + 1}: ` : ''}${right ? 'right' : 'left'}${i % 8 === 7 ? '. ' : ', '}`).join('');
    $('#round-count').textContent = `${round + 1} / 8`;
    $('#round-strip').innerHTML = Array.from({length:8},(_,i) => `<span class="${i < round ? 'done' : i === round ? 'current' : ''}"></span>`).join('');
    $('#look-count').textContent = '—'; $('#certainty').textContent = '70%'; $('#confidence').value = 70; $('#confidence-value').textContent = '70%';
    for (const id of ['left','right']) { $('#' + id).disabled = false; $('#' + id).setAttribute('aria-pressed','false'); }
    $('#confidence').disabled = false; $('#group').disabled = false; $('#check').disabled = true; $('#check').hidden = false; $('#again').hidden = true;
    announce('The answer is in the field. Confidence is your report, not a sensor reading.');
  };
  for (const id of ['left','right']) $('#' + id).addEventListener('click', () => {
    if (locked) return; choice = id === 'right';
    for (const side of ['left','right']) $('#' + side).setAttribute('aria-pressed', String(side === id));
    $('#look-count').textContent = id === 'right' ? 'Right' : 'Left'; $('#check').disabled = false;
  });
  bindSlider('confidence', value => { confidence = value; $('#certainty').textContent = `${value}%`; }, v => `${v}%`);
  $('#group').addEventListener('click', () => {
    if (locked) return; assisted = true;
    $('#field').innerHTML = [...field.values].sort((a,b) => Number(a)-Number(b)).map(right => `<span class="signal ${right ? 'right' : 'left'}">${right ? '→' : '←'}</span>`).join('');
    $('#field').classList.add('revealed');
    announce('The same arrows are now grouped. This round will be marked “with help”.');
  });
  $('#check').addEventListener('click', () => {
    if (choice === null || locked) return; locked = true;
    const correct = choice === field.right;
    records.push({correct, confidence, assisted, score:brier(confidence / 100,correct)});
    $('#field').classList.add('revealed');
    for (const id of ['left','right','confidence','check','group']) $('#' + id).disabled = true;
    $('#again').hidden = false;
    $('#again').textContent = round === 7 ? 'See what you noticed' : 'Next field';
    announce(`${field.rightCount} point right; ${48-field.rightCount} point left. ${correct ? 'You found the larger group.' : 'The larger group was the other way.'} You reported ${confidence}% confidence.${assisted ? ' This was a helped round.' : ''}`, correct ? 'success' : '');
  });
  $('#again').addEventListener('click', () => {
    if (round < 7) { round++; draw(); return; }
    const independent = records.filter(r => !r.assisted);
    $('#stage').innerHTML = `<div class="stage-top"><strong>Eight fields, eight decisions</strong><span>Complete</span></div><div class="center-scene"><p class="eyebrow">What you noticed today</p><div class="large-number">${records.filter(r => r.correct).length} / 8</div><p>larger groups found · ${records.filter(r=>r.assisted).length} rounds with help</p></div><div class="stats"><div class="stat"><strong>${Math.round(mean(records.map(r=>r.confidence)))}%</strong><span>average confidence</span></div><div class="stat"><strong>${independent.length ? mean(independent.map(r=>r.score)).toFixed(3) : '—'}</strong><span>Brier score, without help</span></div><div class="stat"><strong>${independent.length}</strong><span>rounds without help</span></div></div>`;
    $('#controls').innerHTML = `<h2>Could you be less sure, and more accurate?</h2><p>A small clue can deserve a small amount of confidence. Eight rounds cannot measure a lasting ability.</p>${button('restart','Try eight new fields',true)}<p class="small">Next, try forecasting something you cannot see yet.</p><a class="secondary" href="../predict/">Open Predict →</a>`;
    $('#restart').addEventListener('click',mount);
    announce('Observation is about what is here. Prediction asks what has not happened yet.');
  });
  draw();
  research({question:'Can confidence outrun observation?',finding:'A correct answer and a feeling of certainty are different things. Confidence can be compared with accuracy over many decisions.',model:'Each field contains exactly 48 arrows, shuffled from known counts. The majority changes independently of your answer. Grouping is assistance and is reported separately. The binary Brier score compares reported confidence in the chosen answer with whether that answer was correct; smaller is better.',limits:'This original counting game is not a validated perception, metacognition or intelligence test. Counting, display size and strategy affect results. Eight decisions are too few for a stable estimate, and improvement here does not establish transfer to everyday judgment.',maths:'Brier = mean((confidence − correct)²), with confidence in [0,1] and correct = 0 or 1.',sources:[['Brier (1950) · scoring probability forecasts','https://journals.ametsoc.org/view/journals/mwre/78/1/1520-0493_1950_078_0001_vofeit_2_0_co_2.xml']]});
}
