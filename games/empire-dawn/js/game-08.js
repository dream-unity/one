/* Empire Dawn runtime · part 8 */
function updateCommandUI() {
  DOM.commandGrid.innerHTML = '';
  const buttons = buildCommandButtons();
  buttons.slice(0, 12).forEach((button) => DOM.commandGrid.appendChild(button));
  const building = selectedBuildings()[0];
  let queue = null;
  let queueName = '';
  if (building?.research) {
    queue = building.research;
    queueName = building.research.kind === 'age' ? `Advancing to ${getAgeName(building.research.targetAge)}` : TECHNOLOGIES[building.research.id].name;
  } else if (building?.queue?.length) {
    queue = building.queue[0];
    queueName = `Training ${UNIT_TYPES[queue.type].name}`;
  }
  if (queue) {
    DOM.queueStrip.classList.remove('hidden');
    DOM.queueName.textContent = queueName;
    DOM.queueTime.textContent = `${Math.max(0, Math.ceil(queue.duration - queue.progress))}s`;
    DOM.queueFill.style.width = `${clamp(queue.progress / queue.duration, 0, 1) * 100}%`;
  } else DOM.queueStrip.classList.add('hidden');
}

function updateUI(force = false) {
  if (!game) return;
  const player = getPlayer(PLAYER);
  DOM.food.textContent = formatNumber(player.resources.food);
  DOM.wood.textContent = formatNumber(player.resources.wood);
  DOM.stone.textContent = formatNumber(player.resources.stone);
  DOM.gold.textContent = formatNumber(player.resources.gold);
  DOM.age.textContent = AGE_NAMES[player.age];
  DOM.pop.textContent = populationUsed(PLAYER);
  DOM.popCap.textContent = populationCap(PLAYER);
  DOM.time.textContent = formatTime(game.elapsed);
  updateObjectivesUI();
  updateSelectionUI();
  updateCommandUI();
  renderMinimap();
}

function handleCommandAction(action) {
  if (!action || !game || runtime.paused || runtime.ended) return;
  sound('click');
  if (action === 'buildMenu') { runtime.commandMode = 'build'; updateUI(true); return; }
  if (action === 'back') { runtime.commandMode = 'default'; updateUI(true); return; }
  if (action === 'stop') { selectedUnits().forEach(stopUnit); return; }
  if (action.startsWith('place:')) { beginPlacement(action.split(':')[1]); return; }
  if (action.startsWith('train:')) { queueUnit(selectedBuildings()[0], action.split(':')[1]); return; }
  if (action.startsWith('research:')) { queueResearch(selectedBuildings()[0], action.split(':')[1]); return; }
  if (action.startsWith('age:')) { queueAgeUp(selectedBuildings()[0], Number(action.split(':')[1])); return; }
  if (action.startsWith('target:')) {
    const type = action.split(':')[1];
    if (type === 'repair') {
      notify('Right-click a damaged friendly building with Villagers selected.', 'good');
      return;
    }
    runtime.targeting = { type };
    runtime.placement = null;
    DOM.placementHint.textContent = type === 'attackMove' ? 'Choose attack-move destination · Left-click to confirm · Right-click or Esc to cancel' : type === 'rally' ? 'Choose rally point · Left-click to confirm · Right-click or Esc to cancel' : 'Choose target';
    DOM.placementHint.classList.remove('hidden');
    canvas.style.cursor = 'crosshair';
  }
}

function saveGame(manual = true) {
  if (!game || runtime.previewMode) return;
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      game,
      runtime: { speed: runtime.speed },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    DOM.continueButton.classList.remove('hidden');
    if (manual) { notify('Campaign saved locally.', 'good'); sound('click'); }
  } catch (error) {
    console.error('Save failed', error);
    if (manual) notify('Could not save this campaign.', 'bad');
  }
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { notify('No saved campaign found.', 'bad'); return false; }
  try {
    const payload = JSON.parse(raw);
    if (payload.version !== 1 || !payload.game) throw new Error('Unsupported save');
    game = payload.game;
    runtime.speed = payload.runtime?.speed || 1;
    runtime.started = true;
    runtime.paused = false;
    runtime.ended = false;
    runtime.selected = [];
    runtime.commandMode = 'default';
    runtime.placement = null;
    runtime.targeting = null;
    runtime.lastTime = performance.now();
    DOM.startScreen.classList.remove('visible');
    DOM.pauseScreen.classList.remove('visible');
    DOM.endScreen.classList.remove('visible');
    centreCameraOnWorld(16.5, 18.5, true);
    updateFog(true);
    updateUI(true);
    notify('Saved campaign restored.', 'good');
    return true;
  } catch (error) {
    console.error('Load failed', error);
    notify('The saved campaign could not be loaded.', 'bad');
    return false;
  }
}

function togglePause(force = null) {
  if (!runtime.started || runtime.ended) return;
  runtime.paused = force == null ? !runtime.paused : force;
  DOM.pauseScreen.classList.toggle('visible', runtime.paused);
  if (!runtime.paused) DOM.helpScreen.classList.remove('visible');
}

function endGame(victory) {
  if (runtime.ended) return;
  runtime.ended = true;
  runtime.paused = false;
  game.endReason = victory ? 'victory' : 'defeat';
  updateObjectives();
  DOM.endKicker.textContent = victory ? 'CAMPAIGN COMPLETE' : 'THE SETTLEMENT HAS FALLEN';
  DOM.endTitle.textContent = victory ? 'Victory' : 'Defeat';
  DOM.endCopy.textContent = victory
    ? 'The rival seat of power lies in ruins. Your settlement survives to enter a wider age of empires.'
    : 'The Town Centre has been destroyed. Rebuild your strategy, secure the economy earlier, and meet the next assault with a larger army.';
  const stats = getPlayer(PLAYER).stats;
  DOM.endStats.innerHTML = `
    <div><b>${formatTime(game.elapsed)}</b><small>MISSION TIME</small></div>
    <div><b>${Math.floor(stats.gathered)}</b><small>RESOURCES GATHERED</small></div>
    <div><b>${stats.enemyUnitsDefeated + stats.enemyBuildingsDestroyed}</b><small>ENEMIES DEFEATED</small></div>`;
  DOM.endScreen.classList.add('visible');
  sound(victory ? 'victory' : 'defeat');
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - runtime.lastTime) / 1000));
  runtime.lastTime = now;
  if (game) update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}

function wireUI() {
  resize();
  addEventListener('resize', resize);
  canvas.addEventListener('mousedown', onCanvasMouseDown);
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('mouseup', onCanvasMouseUp);
  canvas.addEventListener('mouseleave', () => { runtime.mouse.edgeX = 0; runtime.mouse.edgeY = 0; runtime.mouse.down = false; });
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  minimap.addEventListener('mousedown', onMinimapClick);

  $('#civilisation-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-civ]');
    if (!button) return;
    runtime.civChoice = button.dataset.civ;
    $$('#civilisation-options [data-civ]').forEach((item) => item.classList.toggle('selected', item === button));
    sound('click');
  });
  $('#difficulty-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');
    if (!button) return;
    runtime.difficultyChoice = button.dataset.difficulty;
    $$('#difficulty-options [data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
    sound('click');
  });

  DOM.startButton.addEventListener('click', () => createNewGame(runtime.civChoice, runtime.difficultyChoice));
  DOM.continueButton.addEventListener('click', loadGame);
  DOM.menuButton.addEventListener('click', () => togglePause(true));
  DOM.resumeButton.addEventListener('click', () => togglePause(false));
  DOM.saveButton.addEventListener('click', () => saveGame(true));
  DOM.manualSaveButton.addEventListener('click', () => saveGame(true));
  DOM.loadButton.addEventListener('click', loadGame);
  DOM.helpButton.addEventListener('click', () => DOM.helpScreen.classList.add('visible'));
  DOM.closeHelp.addEventListener('click', () => DOM.helpScreen.classList.remove('visible'));
  DOM.restartButton.addEventListener('click', () => createNewGame(game?.civilisation || runtime.civChoice, game?.difficulty || runtime.difficultyChoice));
  DOM.playAgainButton.addEventListener('click', () => createNewGame(game?.civilisation || runtime.civChoice, game?.difficulty || runtime.difficultyChoice));
  DOM.soundButton.addEventListener('click', () => {
    runtime.soundOn = !runtime.soundOn;
    DOM.soundButton.textContent = runtime.soundOn ? '♪' : '×';
    DOM.soundButton.title = runtime.soundOn ? 'Mute sound' : 'Enable sound';
    if (runtime.soundOn) sound('click');
  });
  DOM.collapseObjectives.addEventListener('click', () => {
    const collapsed = DOM.objectivePanel.classList.toggle('collapsed');
    DOM.collapseObjectives.textContent = collapsed ? 'Show objectives' : 'Hide objectives';
  });
  DOM.backCommand.addEventListener('click', () => { runtime.commandMode = 'default'; updateUI(true); });
  DOM.commandGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) handleCommandAction(button.dataset.action);
  });
  DOM.commandGrid.addEventListener('mousemove', (event) => {
    const button = event.target.closest('[data-tooltip]');
    if (!button) { DOM.cursorTooltip.classList.add('hidden'); return; }
    DOM.cursorTooltip.textContent = button.dataset.tooltip;
    DOM.cursorTooltip.style.left = `${clamp(event.clientX + 14, 8, viewport.width - 255)}px`;
    DOM.cursorTooltip.style.top = `${clamp(event.clientY - 54, 8, viewport.height - 80)}px`;
    DOM.cursorTooltip.classList.remove('hidden');
  });
  DOM.commandGrid.addEventListener('mouseleave', () => DOM.cursorTooltip.classList.add('hidden'));
  $$('.speed-control button').forEach((button) => button.addEventListener('click', () => {
    runtime.speed = Number(button.dataset.speed);
    $$('.speed-control button').forEach((item) => item.classList.toggle('active', item === button));
    sound('click');
  }));

  if (localStorage.getItem(SAVE_KEY)) DOM.continueButton.classList.remove('hidden');
}

wireUI();
requestAnimationFrame(frame);

if (runtime.previewMode) {
  createNewGame('river', 'standard');
  setupPreviewBattle();
  DOM.objectivePanel.classList.add('hidden');
}
