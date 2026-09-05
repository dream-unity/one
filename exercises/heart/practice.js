/* Sensor-free practice plans and foreground-time session state. No DOM or audio. */
(function (root) {
  'use strict';

  const BREATH_LENGTHS = [180, 300, 600, 900];
  const BODY_LENGTHS = [240, 480, 720];
  const PACES = [5, 4, 0];
  const strength = () => [
    { value: 0, label: 'None' }, { value: 1, label: 'Small' },
    { value: 2, label: 'Medium' }, { value: 3, label: 'Strong' },
    { value: 4, label: 'Very strong' }, { value: 'unclear', label: 'Not clear' }
  ];
  const comfort = () => [
    { value: 0, label: 'Very hard' }, { value: 1, label: 'A bit hard' },
    { value: 2, label: 'In between' }, { value: 3, label: 'Quite easy' },
    { value: 4, label: 'Very easy' },
    { value: 'unclear', label: 'Not clear' }, { value: 'skip', label: 'Skip' }
  ];

  function checkPace(pace) {
    if (!PACES.includes(pace)) throw new RangeError('Choose a breath pace of 5, 4, or 0.');
    return pace;
  }

  function tagPlan(steps, kind) {
    steps.kind = kind;
    steps.totalSeconds = steps.reduce((sum, step) => sum + step.seconds, 0);
    return steps;
  }

  function makeBreathPlan(seconds, { pace = 5, kindness = true } = {}) {
    if (!BREATH_LENGTHS.includes(seconds)) throw new RangeError('Choose 3, 5, 10, or 15 minutes.');
    checkPace(pace);
    if (typeof kindness !== 'boolean') throw new TypeError('Kindness must be true or false.');
    const part = seconds / 3;
    return tagPlan([
      {
        id: 'breath-settle', title: 'Find an easy breath', seconds: part, pace,
        prompt: 'Let your breath stay small and easy. Follow the guide only if it feels comfortable. You can use your own pace at any time.',
        question: 'Can you follow a slower pace without making each breath bigger?'
      },
      {
        id: kindness ? 'breath-care' : 'breath-notice',
        title: kindness ? 'Try a kind wish' : 'Stay with your breath', seconds: part, pace,
        prompt: kindness
          ? 'Keep an easy breath. If you like, quietly wish someone well. You do not have to feel happy. Staying with your breath is fine too.'
          : 'Keep an easy breath. Notice one breath at a time. If your mind wanders, gently come back. Nothing special needs to happen.',
        question: kindness
          ? 'Does a kind wish change your experience, or do you expect it to? Either way, what can you actually notice?'
          : 'What changes when you notice a breath without trying to improve it?'
      },
      {
        id: 'breath-own-pace', title: 'Take it with you', seconds: part, pace: 0,
        prompt: 'Let your breath choose its own pace. Look around. Notice one colour or sound. Choose one small, kind thing to do after this practice.',
        question: 'Can you carry a little of this care into an ordinary moment, even when you do not feel calm?'
      }
    ], 'breath');
  }

  const BODY_QUESTIONS = [
    [
      'Can you notice an easy feeling without searching for a stronger one?',
      'Which word fits what you feel, rather than what you expected?',
      'Can something be faint but still easy to notice?',
      'Can a strong feeling still be hard to understand?',
      'Can you choose where your attention goes?',
      'Could the feeling have changed while your attention was elsewhere?',
      'Could the same feeling have more than one cause?',
      'What small choice fits what you need right now?'
    ],
    [
      'Does a different spot feel clearer, or just more familiar?',
      'Would you use the same word if no examples had been given?',
      'Does paying attention seem to change how strong the feeling is?',
      'What is clear about the feeling, and what remains a guess?',
      'Is turning your attention outward easy today, or does it take effort?',
      'Could memory, attention, or a real change explain the difference?',
      'What clue from the room or your day might change your guess?',
      'Would the same next step help even if your guess were wrong?'
    ],
    [
      'What happens when you let an unclear feeling stay unclear?',
      'Are you describing the feeling, or telling a story about it?',
      'Can you notice strength without treating it as danger or success?',
      'What new clue would make you less sure, rather than more sure?',
      'When might looking outward be more useful than looking inward?',
      'If your answer stayed the same, could your first guess still be wrong?',
      'Can two different causes fit the clues you have right now?',
      'Can you make a gentle choice while leaving the cause open?'
    ]
  ];

  function makeBodyPlan(seconds) {
    if (!BODY_LENGTHS.includes(seconds)) throw new RangeError('Choose 4, 8, or 12 minutes.');
    const cards = [
      {
        id: 'find', title: 'Find an easy spot',
        prompt: 'Notice one easy feeling in your body. Your hands or feet are fine. Let your breath be ordinary. If nothing is clear, that is okay.'
      },
      {
        id: 'describe', title: 'What does it feel like?',
        prompt: 'Does it feel warm, cool, tight, soft, still, or changing? Use any word that fits. You can also leave it unnamed.'
      },
      {
        id: 'strength', title: 'How strong is it?',
        prompt: 'Notice how strong the feeling seems. Stronger is not better. You can tap an answer, keep it to yourself, or leave it unclear.',
        choices: strength()
      },
      {
        id: 'certainty', title: 'How sure are you?',
        prompt: 'How sure are you about what you noticed? This is different from how strong it feels. Being unsure is fine. You do not need to guess.',
        choices: [
          { value: 'low', label: 'A little sure' }, { value: 'mid', label: 'Quite sure' },
          { value: 'high', label: 'Very sure' }, { value: 'unclear', label: 'Not clear' }
        ]
      },
      {
        id: 'outside', title: 'Look around',
        prompt: 'Let the body feeling rest. Notice a colour or a sound nearby. Feel the support beneath you. These are other places to put your attention.'
      },
      {
        id: 'return', title: 'Come back and compare',
        prompt: 'If you want, return to the same easy spot. Does it seem the same, different, or unclear? You can stay with the room instead.',
        choices: [
          { value: 'same', label: 'Seems the same' }, { value: 'changed', label: 'Seems different' },
          { value: 'unclear', label: 'Not clear' }
        ]
      },
      {
        id: 'meaning', title: 'What else could it mean?',
        prompt: 'A body feeling can have more than one cause. A fast heart can come from play or worry. Leave room for another guess, or no guess.',
        choices: [
          { value: 'several', label: 'More than one cause could fit' },
          { value: 'unclear', label: 'I do not know' }
        ]
      },
      {
        id: 'action', title: 'Choose a gentle next step',
        prompt: 'Would you like to rest, move gently, look around, or ask for help? You do not need to solve the feeling before choosing what helps.'
      }
    ];
    return tagPlan(Array.from({ length: seconds / 240 }, (_, round) => cards.map((card, index) => ({
      ...card, id: `body-${round + 1}-${card.id}`, round: round + 1,
      seconds: 30, pace: 0, question: BODY_QUESTIONS[round][index],
      ...(card.choices ? { choices: card.choices.map(choice => ({ ...choice })) } : {})
    }))).flat(), 'body');
  }

  function makeComparePlan({ pace = 5, first = 'breath' } = {}) {
    checkPace(pace);
    if (!['breath', 'care'].includes(first)) throw new RangeError('Start with breath or care.');
    const other = first === 'breath' ? 'care' : 'breath';
    const order = [first, other, other, first];
    const plan = [{
      id: 'compare-prediction', title: 'What do you expect?', seconds: 0, pace: 0, wait: true,
      prompt: 'You will try easy breathing with and without a kind wish. Which way do you think will feel easier? A guess is enough.',
      question: 'A guess can shape what you notice. Can you leave room to be surprised?',
      choices: [
        { value: 'breath', label: 'Breath alone' }, { value: 'care', label: 'A kind wish too' },
        { value: 'same', label: 'About the same' }, { value: 'unclear', label: 'Not sure' },
        { value: 'skip', label: 'Skip' }
      ]
    }];
    order.forEach((condition, index) => {
      const round = index + 1;
      plan.push({
        id: `compare-${round}-${condition}`, title: condition === 'care' ? 'Add a kind wish' : 'Notice your breath',
        condition, round, seconds: 60, pace,
        prompt: condition === 'care'
          ? 'Keep a small, easy breath. If you like, quietly wish someone well. You do not have to create a warm or happy feeling.'
          : 'Keep a small, easy breath. Notice each breath. Let thoughts come and go. Follow the guide only if it feels comfortable.',
        question: 'What can you notice without trying to make this part win?'
      });
      plan.push({
        id: `compare-${round}-rating`, title: 'How easy did that feel?',
        condition, round, seconds: 0, pace: 0, wait: true,
        prompt: 'Think about the round you just tried. How easy did it feel? Choose an answer, or skip. Let your breath use its own pace while you choose.',
        question: 'Could tiredness, the order, or your expectations also have shaped this moment?',
        choices: comfort()
      });
    });
    return tagPlan(plan, 'compare');
  }

  function copyPlan(plan) {
    if (!Array.isArray(plan) || plan.length === 0) throw new TypeError('A plan needs at least one step.');
    const ids = new Set();
    const copied = plan.map(step => {
      if (!step || typeof step !== 'object' || typeof step.id !== 'string' || !step.id || ids.has(step.id)) {
        throw new TypeError('Every step needs a different id.');
      }
      ids.add(step.id);
      if (typeof step.title !== 'string' || !step.title || typeof step.prompt !== 'string' || !step.prompt) {
        throw new TypeError('Every step needs a title and prompt.');
      }
      if (!Number.isInteger(step.seconds) || !Number.isSafeInteger(step.seconds * 1000) || step.seconds < 0 ||
          (step.wait !== undefined && typeof step.wait !== 'boolean') ||
          (step.wait ? step.seconds !== 0 : step.seconds === 0)) {
        throw new RangeError('Timed steps need positive whole seconds; waiting steps need zero seconds.');
      }
      checkPace(step.pace);
      const result = { ...step };
      if (step.choices !== undefined) {
        if (!Array.isArray(step.choices) || step.choices.length === 0) throw new TypeError('Choices must not be empty.');
        const values = new Set();
        result.choices = Object.freeze(step.choices.map(choice => {
          if (!choice || !['string', 'number'].includes(typeof choice.value) ||
              (typeof choice.value === 'number' && !Number.isFinite(choice.value)) ||
              typeof choice.label !== 'string' || !choice.label || values.has(choice.value)) {
            throw new TypeError('Choices need distinct finite numbers or strings and readable labels.');
          }
          values.add(choice.value);
          return Object.freeze({ value: choice.value, label: choice.label });
        }));
      }
      if (step.wait && !result.choices) throw new TypeError('Waiting steps need an answer or skip choice.');
      return Object.freeze(result);
    });
    const total = copied.reduce((sum, step) => sum + step.seconds * 1000, 0);
    if (!Number.isSafeInteger(total)) throw new RangeError('The plan is too long.');
    return Object.freeze(tagPlan(copied, ['breath', 'body', 'compare'].includes(plan.kind) ? plan.kind : 'practice'));
  }

  function createSession(plan, now = 0) {
    if (!Number.isFinite(now) || now < 0) throw new RangeError('Time must be finite and non-negative.');
    const ownedPlan = copyPlan(plan);
    return {
      plan: ownedPlan, index: 0, status: ownedPlan[0].wait ? 'waiting' : 'running',
      stepElapsedMs: 0, elapsedMs: 0, lastNow: now, answers: [],
      completedStepIds: [], pausedStatus: null
    };
  }

  function acceptsTime(state, now) {
    return Number.isFinite(now) && now >= state.lastNow;
  }

  function currentStep(state) {
    return ['complete', 'ended'].includes(state.status) ? null : state.plan[state.index] || null;
  }

  function nextStep(state) {
    state.completedStepIds.push(state.plan[state.index].id);
    state.index += 1;
    state.stepElapsedMs = 0;
    state.status = state.index >= state.plan.length ? 'complete' : state.plan[state.index].wait ? 'waiting' : 'running';
  }

  function advance(state, now) {
    if (!acceptsTime(state, now) || ['complete', 'ended'].includes(state.status)) return state;
    let available = now - state.lastNow;
    state.lastNow = now;
    while (state.status === 'running') {
      const needed = state.plan[state.index].seconds * 1000 - state.stepElapsedMs;
      const spent = Math.min(available, needed);
      state.stepElapsedMs += spent;
      state.elapsedMs += spent;
      available -= spent;
      if (state.stepElapsedMs < state.plan[state.index].seconds * 1000) break;
      nextStep(state);
      if (available === 0) break;
    }
    return state;
  }

  function answer(state, value, expectedStepId) {
    if (!['running', 'waiting'].includes(state.status)) return state;
    const step = currentStep(state);
    if (expectedStepId !== undefined && expectedStepId !== step.id) return state;
    const choice = step.choices && step.choices.find(item => item.value === value);
    if (!choice) return state;
    const record = { stepId: step.id, title: step.title, value: choice.value, label: choice.label };
    if (step.condition !== undefined) record.condition = step.condition;
    if (step.round !== undefined) record.round = step.round;
    const existing = state.answers.findIndex(item => item.stepId === step.id);
    if (existing < 0) state.answers.push(record);
    else state.answers[existing] = record;
    return state;
  }

  function continueStep(state, now, expectedStepId) {
    if (state.status !== 'waiting' || !acceptsTime(state, now)) return state;
    const step = currentStep(state);
    if ((expectedStepId !== undefined && expectedStepId !== step.id) ||
        !state.answers.some(item => item.stepId === step.id)) return state;
    state.lastNow = now;
    nextStep(state);
    return state;
  }

  function pause(state, now) {
    if (!['running', 'waiting'].includes(state.status) || !acceptsTime(state, now)) return state;
    advance(state, now);
    if (['running', 'waiting'].includes(state.status)) {
      state.pausedStatus = state.status;
      state.status = 'paused';
    }
    return state;
  }

  function resume(state, now) {
    if (state.status !== 'paused' || !acceptsTime(state, now)) return state;
    state.lastNow = now;
    state.status = state.pausedStatus;
    state.pausedStatus = null;
    return state;
  }

  function finish(state) {
    if (!['complete', 'ended'].includes(state.status)) {
      state.status = 'ended';
      state.pausedStatus = null;
    }
    return state;
  }

  function elapsedSeconds(state) {
    return state.elapsedMs / 1000;
  }

  function remainingSeconds(state) {
    const total = state.plan.reduce((sum, step) => sum + step.seconds, 0);
    return Math.max(0, total - elapsedSeconds(state));
  }

  function summary(state) {
    return {
      kind: state.plan.kind, totalSeconds: state.plan.totalSeconds, completed: state.status === 'complete',
      status: state.status,
      label: state.status === 'complete' ? 'Completed' : state.status === 'ended' ? 'Ended early' : 'In progress',
      elapsedSeconds: elapsedSeconds(state), remainingSeconds: remainingSeconds(state),
      completedStepIds: state.completedStepIds.slice(),
      order: state.plan.filter(step => step.condition !== undefined && !step.wait).map(step => ({
        stepId: step.id, condition: step.condition, round: step.round,
        completed: state.completedStepIds.includes(step.id)
      })),
      answers: state.answers.map(record => ({ ...record }))
    };
  }

  root.HeartPractice = Object.freeze({
    makeBreathPlan, makeBodyPlan, makeComparePlan, createSession, advance, answer,
    continueStep, pause, resume, finish, remainingSeconds, elapsedSeconds, currentStep, summary
  });
})(globalThis);
