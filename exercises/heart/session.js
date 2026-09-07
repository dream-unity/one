/* Heart practice: a foreground-only controller. Timed cards, choices and
   summaries come from HeartPractice; this page never measures physiology. */
(function () {
  'use strict';

  var engine = window.HeartPractice;
  var root = document.getElementById('heart-training');
  if (!root || !engine) return;
  var session = null;
  var ticker = null;
  var shownStep = null;
  var phaseKey = null;
  var lastKind = 'breath';
  var soundOn = true;
  var pauses = 0;
  var soundChanges = 0;
  var paceChanges = 0;
  var ownBreath = false;
  var selection = { breath: 900, body: 900, pace: 5, feeling: 'love' };
  var peek = null;
  var beforeChild = null;

  function el(id) { return document.getElementById(id); }
  function text(id, value) { var node = el(id); if (node) node.textContent = value == null ? '' : String(value); }
  function now() { return performance.now(); }
  function clearTick() { if (ticker !== null) clearInterval(ticker); ticker = null; }
  function hush() { stopHeartAudio({ immediate: true }); }
  function focus(node) {
    if (!node || typeof node.focus !== 'function') return;
    if (!node.hasAttribute('tabindex') && !node.matches('button,a,input,summary')) node.setAttribute('tabindex', '-1');
    try { node.focus({ preventScroll: true }); } catch (error) { node.focus(); }
  }
  function clock(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function closePause() {
    var dialog = el('pause-dialog');
    if (dialog && dialog.open) dialog.close();
  }
  function showScreen(name, moveFocus) {
    root.querySelectorAll('.screen').forEach(function (screen) { screen.hidden = screen.id !== 'screen-' + name; });
    if (moveFocus !== false) {
      var screen = el('screen-' + name);
      focus(screen && screen.querySelector('h1'));
      window.scrollTo(0, 0);
    }
  }
  function resetBall() {
    var ball = el('breath-ball');
    if (ball) { ball.classList.remove('is-paced', 'is-paused'); ball.style.removeProperty('--breath-offset'); }
    phaseKey = null;
  }
  function forgetData() {
    clearTick(); hush(); closePause(); resetBall();
    session = null; shownStep = null; peek = null; pauses = 0; soundChanges = 0; paceChanges = 0; ownBreath = false;
    var results = el('finish-results'); if (results) results.replaceChildren();
    var choices = el('step-choices'); if (choices) choices.replaceChildren();
    text('finish-summary', ''); text('finish-response', ''); text('step-feedback', '');
    root.querySelectorAll('[data-feeling]').forEach(function (button) { button.setAttribute('aria-pressed', 'false'); });
  }
  function navigate(name) {
    if (['heart', 'breath', 'body'].indexOf(name) < 0) return;
    forgetData(); showScreen(name);
  }
  function syncSettings() {
    root.querySelectorAll('[data-duration][data-seconds]').forEach(function (button) {
      button.setAttribute('aria-pressed', Number(button.dataset.seconds) === selection[button.dataset.duration] ? 'true' : 'false');
    });
    var child = !!(el('with-child') && el('with-child').checked);
    root.querySelectorAll('[data-pace]').forEach(function (button) {
      var pace = Number(button.dataset.pace);
      button.setAttribute('aria-pressed', pace === selection.pace ? 'true' : 'false');
      button.disabled = child && pace !== 0;
    });
    root.querySelectorAll('[data-emotion]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.emotion === selection.feeling)); });
    text('selected-feeling', selection.feeling);
    text('sound-toggle', soundOn ? 'Mute sound' : 'Use sound');
    if (el('sound-toggle')) {
      el('sound-toggle').setAttribute('aria-label', 'Sound');
      el('sound-toggle').setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    }
  }
  function live() { return session && ['running', 'waiting', 'paused'].indexOf(session.status) >= 0; }
  function kind() { return session && session.plan.kind || lastKind; }
  function buildMapChips(show) {
    var group = el('map-chips'); if (!group) return;
    group.hidden = !show; group.replaceChildren();
    if (!show) return;
    engine.BODY_DIMENSIONS.forEach(function (dimension, index) {
      var button = document.createElement('button'); button.type = 'button';
      button.textContent = (index + 1) + ' · ' + dimension.name;
      button.dataset.dimension = index; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        if (!session || session.status !== 'running') return;
        engine.advance(session, now()); render(false);
        if (!session || session.status !== 'running') return;
        var active = engine.currentStep(session);
        peek = peek === index ? null : index;
        var displayed = peek === null ? active : engine.BODY_DIMENSIONS[peek];
        text('step-title', peek === null ? active.title : 'Read again · ' + displayed.title);
        text('step-prompt', displayed.prompt); text('step-question', displayed.question);
        if (el('step-choices')) el('step-choices').hidden = peek !== null;
        text('peek-note', peek === null ? '' : 'The timer keeps going. Tap this button again to return to the current step.');
        updateMapChips(active);
      }); group.appendChild(button);
    });
  }
  function updateMapChips(step) {
    var group = el('map-chips'); if (!group || group.hidden) return;
    group.querySelectorAll('button').forEach(function (button) {
      var index = Number(button.dataset.dimension);
      button.classList.toggle('is-current', index === step.dimension);
      button.classList.toggle('is-done', index < step.dimension);
      button.classList.toggle('is-peek', index === peek);
      button.setAttribute('aria-pressed', String(index === peek));
      if (index === step.dimension) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    if (peek === null) { text('peek-note', ''); if (el('step-choices')) el('step-choices').hidden = false; }
  }
  function updateCues() {
    var cues = el('practice-cues'); if (!cues) return;
    cues.hidden = kind() !== 'breath';
    [400, 4000, 9000].forEach(function (delay, index) {
      var cue = cues.querySelectorAll('[data-cue]')[index];
      if (cue) cue.classList.toggle('is-active', session.elapsedMs >= delay);
    });
  }
  function newSession(which) {
    forgetData(); lastKind = which;
    var plan;
    if (which === 'body') plan = engine.makeBodyPlan(selection.body);
    else if (which === 'body-check') plan = engine.makeBodyCheckPlan(480);
    else if (which === 'compare') {
      var bit;
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var bytes = new Uint8Array(1); window.crypto.getRandomValues(bytes); bit = bytes[0] % 2;
      } else bit = Math.random() < 0.5 ? 0 : 1;
      plan = engine.makeComparePlan({ pace: selection.pace, first: bit ? 'care' : 'breath', feeling: selection.feeling });
    } else plan = engine.makeBreathPlan(selection.breath, { pace: selection.pace, feeling: selection.feeling });
    session = engine.createSession(plan, now());
    text('session-name', which === 'body' ? 'Map the feeling' : which === 'body-check' ? 'Check a body clue' : which === 'compare' ? 'Compare breathing and ' + selection.feeling : 'Heart and ' + selection.feeling + ' together');
    buildMapChips(which === 'body');
    showScreen('session');
    render(true);
    if (document.hidden) pausePractice('hidden');
    else runClock();
  }
  function runClock() {
    clearTick();
    if (!session || session.status !== 'running' || document.hidden) return;
    if (soundOn) droneStart();
    ticker = setInterval(function () {
      if (!session || session.status !== 'running') { clearTick(); return; }
      if (document.hidden) { pausePractice('hidden'); return; }
      engine.advance(session, now()); render(false);
    }, 250);
  }
  function syncBall(step, force) {
    var visual = el('breath-visual'), ball = el('breath-ball');
    var waiting = session.status === 'waiting' || step.wait;
    if (visual) visual.hidden = kind() === 'body' || !!waiting;
    if (!ball || kind() === 'body' || waiting) { resetBall(); return; }
    var pace = ownBreath ? 0 : Number(step.pace) || 0;
    if (pace === 0) {
      resetBall(); text('breath-word', 'Your own breath'); text('breath-count', ''); return;
    }
    var elapsed = Math.max(0, (kind() === 'breath' ? session.elapsedMs : session.stepElapsedMs) || 0);
    var phase = Math.floor(elapsed / (pace * 1000));
    var inhale = phase % 2 === 0;
    text('breath-word', inhale ? 'Breathe in' : 'Breathe out');
    text('breath-count', Math.max(1, Math.ceil((pace * 1000 - elapsed % (pace * 1000)) / 1000)));
    if (force || !ball.classList.contains('is-paced')) {
      ball.classList.remove('is-paced');
      ball.style.setProperty('--breath-cycle', pace * 2 + 's');
      ball.style.setProperty('--breath-offset', -(elapsed % (pace * 2000)) / 1000 + 's');
      void ball.offsetWidth;
      ball.classList.add('is-paced');
    }
    ball.classList.toggle('is-paused', session.status === 'paused');
    var nextPhaseKey = (kind() === 'breath' ? 'breath' : step.id) + ':' + phase;
    if (step.inhale) {
      text('phase-prompt', inhale ? step.inhale : step.exhale);
      if (el('phase-prompt')) el('phase-prompt').hidden = false;
    }
    if (phaseKey !== nextPhaseKey) {
      phaseKey = nextPhaseKey;
      if (soundOn && session.status === 'running' && !document.hidden) breathBell(inhale ? 'inhale' : 'exhale');
    }
  }
  function choiceValue(choice) { return typeof choice === 'object' ? choice.value : choice; }
  function choiceLabel(choice) { return typeof choice === 'object' ? choice.label : String(choice); }
  function drawChoices(step) {
    var target = el('step-choices'); if (!target) return;
    target.replaceChildren();
    (step.choices || []).forEach(function (choice) {
      var button = document.createElement('button');
      button.type = 'button'; button.textContent = choiceLabel(choice);
      button.dataset.choice = String(choiceValue(choice)); button.dataset.stepId = step.id;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        if (!session || session.status === 'paused' || document.hidden) return;
        if (session.status === 'running') engine.advance(session, now());
        if (!engine.currentStep(session) || engine.currentStep(session).id !== step.id) { render(false); return; }
        engine.answer(session, choiceValue(choice), step.id);
        target.querySelectorAll('button').forEach(function (item) { item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
        if (el('continue-step')) el('continue-step').disabled = false;
        text('step-feedback', typeof choice === 'object' && choice.feedback ? choice.feedback : 'Your choice is here. You can change it.');
      });
      target.appendChild(button);
    });
  }
  function render(force) {
    if (!session) return;
    if (session.status === 'complete') { finishView(!document.hidden); return; }
    if (session.status === 'ended') { finishView(false); return; }
    var step = engine.currentStep(session); if (!step) return;
    var changed = shownStep !== step.id;
    if (force && peek !== null) { peek = null; text('step-title', step.title); }
    if (changed || force) {
      var unpacedStart = false;
      var prompt = unpacedStart ? 'Let your breath stay small and easy. There is no pace to match. Notice one breath at a time.' : step.prompt;
      if (ownBreath || Number(step.pace) === 0) prompt = prompt.replace('Follow the guide only if it feels comfortable.', 'Let your breath use its own pace.');
      var question = unpacedStart ? 'Can you notice your breath without trying to change it?' : step.question;
      if (ownBreath || Number(step.pace) === 0) prompt = prompt.replace('five seconds in and five seconds out', 'at your own comfortable pace');
      else if (Number(step.pace) === 4) prompt = prompt.replace('five seconds in and five seconds out', 'four seconds in and four seconds out');
      text('step-prompt', prompt); text('step-question', question || '');
      var deeper = el('deeper-step'); if (deeper) { deeper.hidden = !question; if (changed) deeper.open = false; }
    }
    if (changed) {
      shownStep = step.id; peek = null;
      if (kind() !== 'breath') phaseKey = null;
      text('step-title', step.title);
      text('step-feedback', ''); drawChoices(step);
      if (kind() === 'body' && session.status === 'running' && soundOn && !document.hidden) breathBell(step.dimension === undefined || step.dimension % 2 === 0 ? 'inhale' : 'exhale');
    }
    if (el('phase-prompt')) el('phase-prompt').hidden = !step.inhale || ownBreath || !step.pace;
    updateMapChips(step);
    updateCues();
    var waiting = session.status === 'waiting';
    var next = el('continue-step');
    if (next) { next.hidden = !waiting; next.dataset.stepId = step.id; next.disabled = !session.answers.some(function (answer) { return answer.stepId === step.id; }); }
    if (el('own-breath')) el('own-breath').hidden = kind() === 'body' || waiting || ownBreath || !step.pace;
    text('session-timer', clock(engine.remainingSeconds(session)));
    text('session-step', (step.dimension !== undefined ? 'Round ' + step.round + ' · ' + (step.dimension + 1) + ' of 7' : 'Step ' + (session.index + 1) + ' of ' + session.plan.length) + (waiting ? ' · Your choice' : ' · ' + clock(Math.max(0, step.seconds - session.stepElapsedMs / 1000)) + ' left'));
    text('session-time-note', waiting ? 'Take your time. The practice clock has stopped.' : 'The clock counts only the time you practise here.');
    var total = session.plan.totalSeconds || session.plan.reduce(function (sum, card) { return sum + (card.seconds || 0); }, 0);
    var progress = el('session-progress');
    if (progress) { progress.max = 100; progress.value = total ? Math.min(100, engine.elapsedSeconds(session) / total * 100) : 0; }
    syncBall(step, force || (changed && kind() !== 'breath'));
    if (waiting) {
      clearTick(); hush();
      if (changed) {
        if (kind() === 'compare') window.scrollTo(0, 0);
        focus(el('step-title'));
      }
    }
  }
  function pausePractice(reason) {
    if (!live() || session.status === 'paused') return;
    engine.pause(session, now()); clearTick(); hush(); pauses++;
    if (session.status === 'complete' || session.status === 'ended') { finishView(false); return; }
    var ball = el('breath-ball'); if (ball) ball.classList.add('is-paused');
    text('pause-title', reason === 'look' ? 'Look around' : 'Take your time');
    text('pause-message', reason === 'look'
      ? 'Find one colour. Hear one sound. Feel the floor. You can finish here.'
      : reason === 'hidden'
        ? 'The practice stopped while this page was away. Start again only when you are ready.'
        : 'Breathe in your own way. The clock and sound are stopped.');
    var dialog = el('pause-dialog');
    if (dialog && !dialog.open) dialog.showModal();
    if (!document.hidden) focus(el('pause-title'));
  }
  function resumePractice() {
    if (!session || session.status !== 'paused' || document.hidden) return;
    closePause(); engine.resume(session, now()); phaseKey = null;
    render(true); runClock(); focus(el(session.status === 'waiting' ? 'step-title' : 'pause-session'));
  }
  function continuePractice() {
    var button = el('continue-step');
    if (!session || session.status !== 'waiting' || !button || document.hidden) return;
    engine.continueStep(session, now(), button.dataset.stepId);
    render(true); runClock();
    if (session && session.status === 'running') {
      window.scrollTo(0, 0);
      focus(el('pause-session'));
    }
  }
  function endPractice() {
    if (!session) return;
    if (session.status === 'running' && !document.hidden) engine.advance(session, now());
    engine.finish(session); finishView(false);
  }
  function resultLine(parent, label, value) {
    var row = document.createElement('p');
    var heading = document.createElement('strong'); heading.textContent = label + ': ';
    row.appendChild(heading); row.appendChild(document.createTextNode(String(value))); parent.appendChild(row);
  }
  function finishView(natural) {
    if (!session) return;
    clearTick(); hush(); closePause(); resetBall();
    var report = engine.summary(session);
    var completed = session.status === 'complete';
    text('finish-title', completed ? 'Session complete' : 'You finished here');
    text('finish-summary', 'You practised for ' + clock(engine.elapsedSeconds(session)) + '.');
    var results = el('finish-results');
    if (results) {
      results.replaceChildren();
      (report.answers || []).forEach(function (entry) {
        var label = entry.title || entry.stepId || 'Your choice';
        if (entry.round) label = 'Round ' + entry.round + ' · ' + (kind() === 'compare' ? (entry.condition === 'care' ? 'Breath and care' : 'Breath only') : label);
        var answerText = entry.label == null ? (entry.value == null ? 'Skipped' : entry.value) : entry.label;
        if (kind() === 'compare' && typeof entry.value === 'number') answerText = (entry.value + 1) + ' of 5 — ' + answerText;
        if (entry.value === 'skip') answerText = 'Skipped';
        resultLine(results, label, answerText);
      });
      if (kind() === 'compare' && (pauses || soundChanges || paceChanges)) resultLine(results, 'Changes during this try', 'Pauses: ' + pauses + '. Sound changes: ' + soundChanges + '. Breath guide changes: ' + paceChanges + '.');
    }
    text('finish-note', kind() === 'compare'
      ? 'These are your reports from one try. They cannot prove why you felt a difference. Order, practice and other changes may matter.'
      : 'This page does not read your heart or body. Feeling better is welcome. Feeling the same or unsure is useful to notice too.');
    if (el('map-this-feeling')) el('map-this-feeling').hidden = kind() !== 'breath';
    text('finish-integration', kind() === 'breath' ? 'Notice the breath, chest, and feeling you actually have now. Keep the heart area and the feeling together for a moment, if that feels right. Carry it into one kind action, or map its full pattern next.' : 'Let the whole pattern come together: place, texture, strength, movement, direction, agreement, and feeling tone. Keep what you sensed separate from what you guessed. Choose one action and leave room to learn more.');
    showScreen('finish');
    if (natural && completed && soundOn && !document.hidden) completeBell();
  }
  function useOwnBreath() {
    if (!session || session.status !== 'running' || ownBreath || kind() === 'body' || document.hidden) return;
    engine.advance(session, now());
    ownBreath = true; paceChanges++; hush(); render(true); runClock();
  }
  function toggleSound() {
    soundOn = !soundOn;
    if (live() && kind() === 'compare') soundChanges++;
    hush(); syncSettings();
    if (soundOn && session && session.status === 'running' && !document.hidden) droneStart();
  }
  function reflect(button) {
    root.querySelectorAll('[data-feeling]').forEach(function (item) { item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
    var messages = {
      more: 'Notice what feels different. You do not have to keep this feeling.',
      same: 'You noticed no clear change. That is a useful report.',
      less: 'Let your breath move on its own. Look around. You can leave the practice here.',
      unclear: 'You do not need to guess. Not sure is a useful answer.'
    };
    text('finish-response', messages[button.dataset.feeling] || '');
  }

  root.addEventListener('click', function (event) {
    var button = event.target.closest('button,[data-open]');
    if (!button || !root.contains(button) || button.disabled) return;
    if (button.dataset.open) { navigate(button.dataset.open); return; }
    if (button.dataset.duration && !live()) {
      var seconds = Number(button.dataset.seconds);
      if (Number.isFinite(seconds) && seconds > 0) selection[button.dataset.duration] = seconds;
      syncSettings(); return;
    }
    if (button.hasAttribute('data-pace') && !live()) { selection.pace = Number(button.dataset.pace); syncSettings(); return; }
    if (button.dataset.emotion && !live()) { selection.feeling = button.dataset.emotion; syncSettings(); return; }
    if (button.dataset.feeling) { reflect(button); return; }
    if (button.dataset.call === 'setWave' && !live()) { hush(); setWave(Number(button.dataset.value), button); return; }
    if (button.dataset.call === 'testBell') { if (soundOn && !live() && !document.hidden) { hush(); testBell(); } return; }
    switch (button.id) {
      case 'start-breath': newSession('breath'); break;
      case 'start-body': newSession('body'); break;
      case 'start-body-check': newSession('body-check'); break;
      case 'map-this-feeling': navigate('body'); break;
      case 'start-compare': newSession('compare'); break;
      case 'pause-session': pausePractice('pause'); break;
      case 'look-around': pausePractice('look'); break;
      case 'resume-session': resumePractice(); break;
      case 'continue-step': continuePractice(); break;
      case 'end-session': case 'finish-paused': endPractice(); break;
      case 'sound-toggle': toggleSound(); break;
      case 'own-breath': useOwnBreath(); break;
      case 'try-again': navigate(lastKind === 'body' || lastKind === 'body-check' ? 'body' : 'breath'); break;
      case 'forget-session': navigate('heart'); break;
    }
  });
  root.addEventListener('change', function (event) {
    if (event.target.id !== 'with-child' || live()) return;
    if (event.target.checked) { beforeChild = { pace: selection.pace, breath: selection.breath }; selection.pace = 0; selection.breath = 180; }
    else if (beforeChild) { selection.pace = beforeChild.pace; selection.breath = beforeChild.breath; beforeChild = null; }
    syncSettings();
  });
  root.addEventListener('input', function (event) {
    if (!event.target.matches('.bell-vol')) return;
    if (live()) { syncBellVolUI(); return; }
    setBellVol(event.target.value);
  });
  if (el('pause-dialog')) el('pause-dialog').addEventListener('cancel', function (event) { event.preventDefault(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (live()) pausePractice('hidden'); else hush(); }
  });
  window.addEventListener('pagehide', function () { forgetData(); showScreen('heart', false); });
  if (el('step-title')) el('step-title').setAttribute('aria-live', 'polite');
  if (el('step-prompt')) el('step-prompt').setAttribute('aria-live', 'polite');
  syncSettings(); syncBellVolUI(); showScreen('heart', false);
}());
