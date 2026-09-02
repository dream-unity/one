/* Empire Dawn runtime · part 7 */
function getEntityAtScreen(x, y) {
  // Units receive click priority over the larger building silhouettes beneath
  // them, matching the selection feel expected from classic RTS controls.
  const unitHits = game.units
    .filter((entity) => isAlive(entity) && entityVisible(entity))
    .map((entity) => {
      const point = worldToScreen(entity.x, entity.y);
      const distance = Math.hypot(x - point.x, y - (point.y - 12 * game.camera.zoom));
      const radius = (entity.type === 'scout' ? 22 : 16) * game.camera.zoom;
      return { entity, distance, hit: distance <= radius };
    })
    .filter((item) => item.hit)
    .sort((a, b) => a.distance - b.distance);
  if (unitHits.length) return unitHits[0].entity;

  const buildings = game.buildings
    .filter((entity) => isAlive(entity) && entityVisible(entity))
    .sort((a, b) => (b.x + b.y) - (a.x + a.y));
  for (const entity of buildings) {
    const point = worldToScreen(entity.x, entity.y);
    const width = entity.width * 30 * game.camera.zoom;
    const height = entity.height * 22 * game.camera.zoom + 45 * game.camera.zoom;
    if (x >= point.x - width && x <= point.x + width && y >= point.y - height && y <= point.y + 18 * game.camera.zoom) return entity;
  }

  const resources = game.resourcesNodes
    .filter((entity) => !entity.dead && entityVisible(entity))
    .sort((a, b) => (b.x + b.y) - (a.x + a.y));
  for (const entity of resources) {
    const point = worldToScreen(entity.x, entity.y);
    const radius = entity.type === 'tree' ? 26 : 18;
    if (Math.hypot(x - point.x, y - (point.y - 10 * game.camera.zoom)) <= radius * game.camera.zoom) return entity;
  }
  return null;
}

function selectEntity(entity, additive = false) {
  if (!additive) runtime.selected = [];
  if (!entity || !isAlive(entity)) { updateUI(true); return; }
  if (additive && runtime.selected.includes(entity.id)) runtime.selected = runtime.selected.filter((id) => id !== entity.id);
  else runtime.selected.push(entity.id);
  runtime.commandMode = 'default';
  sound('click');
  updateUI(true);
}

function boxSelect(start, end, additive = false) {
  if (!additive) runtime.selected = [];
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const selected = game.units.filter((unit) => unit.owner === PLAYER && isAlive(unit)).filter((unit) => {
    const point = worldToScreen(unit.x, unit.y);
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  });
  for (const unit of selected) if (!runtime.selected.includes(unit.id)) runtime.selected.push(unit.id);
  if (selected.length) sound('click');
  updateUI(true);
}

function issueContextOrder(screenX, screenY) {
  const units = selectedUnits();
  if (!units.length) return;
  const target = getEntityAtScreen(screenX, screenY);
  const world = screenToWorld(screenX, screenY);
  if (target && target.owner !== PLAYER && target.owner !== NEUTRAL) {
    units.filter((unit) => unit.type !== 'villager' || true).forEach((unit) => orderAttack(unit, target));
    spawnOrderMarker(target.x, target.y, '#df6350');
    sound('order');
    return;
  }
  if (target && (target.kind === 'resource' || (target.kind === 'building' && target.type === 'farm'))) {
    const villagers = units.filter((unit) => unit.type === 'villager');
    villagers.forEach((unit) => orderGather(unit, target));
    if (villagers.length) { spawnOrderMarker(target.x, target.y, '#e1c46e'); sound('order'); }
    return;
  }
  if (target && target.kind === 'building' && target.owner === PLAYER) {
    const villagers = units.filter((unit) => unit.type === 'villager');
    if (target.progress < 1 || target.hp < target.maxHp) {
      villagers.forEach((unit) => orderBuild(unit, target));
      if (villagers.length) { spawnOrderMarker(target.x, target.y, '#71c58a'); sound('order'); }
      return;
    }
  }

  const columns = Math.ceil(Math.sqrt(units.length));
  const spacing = 0.75;
  units.forEach((unit, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const offsetX = (col - (columns - 1) / 2) * spacing;
    const offsetY = (row - (Math.ceil(units.length / columns) - 1) / 2) * spacing;
    orderMove(unit, world.x + offsetX, world.y + offsetY, false);
  });
  spawnOrderMarker(world.x, world.y, '#77c5f4');
  sound('order');
}

function spawnOrderMarker(x, y, colour) {
  game.particles.push({ type: 'text', x, y, z: 0.05, vx: 0, vy: 0, vz: 0.15, life: 0.55, maxLife: 0.55, colour, text: '◇' });
}

function handleTargetClick(screenX, screenY) {
  const targeting = runtime.targeting;
  if (!targeting) return false;
  const world = screenToWorld(screenX, screenY);
  const target = getEntityAtScreen(screenX, screenY);
  if (targeting.type === 'attack') {
    if (!target || target.owner === PLAYER || target.owner === NEUTRAL) { notify('Choose an enemy target.', 'bad'); return true; }
    selectedUnits().forEach((unit) => orderAttack(unit, target));
    spawnOrderMarker(target.x, target.y, '#df6350');
  } else if (targeting.type === 'attackMove') {
    selectedUnits().forEach((unit, index) => orderMove(unit, world.x + (index % 3) * 0.5, world.y + Math.floor(index / 3) * 0.5, true));
    spawnOrderMarker(world.x, world.y, '#df9a50');
  } else if (targeting.type === 'rally') {
    selectedBuildings().forEach((building) => { building.rally = { x: world.x, y: world.y }; });
    spawnOrderMarker(world.x, world.y, '#77c5f4');
  }
  cancelCommandMode();
  sound('order');
  return true;
}

function onCanvasMouseDown(event) {
  if (!runtime.started || runtime.paused || runtime.ended) return;
  ensureAudio();
  runtime.mouse.down = true;
  runtime.mouse.button = event.button;
  runtime.mouse.x = event.clientX;
  runtime.mouse.y = event.clientY;
  if (event.button === 0) {
    runtime.mouse.dragStart = { x: event.clientX, y: event.clientY };
    runtime.mouse.dragging = false;
  }
}

function onCanvasMouseMove(event) {
  runtime.mouse.x = event.clientX;
  runtime.mouse.y = event.clientY;
  runtime.hoverWorld = screenToWorld(event.clientX, event.clientY);
  if (runtime.mouse.down && runtime.mouse.button === 0 && runtime.mouse.dragStart && !runtime.placement && !runtime.targeting) {
    if (Math.hypot(event.clientX - runtime.mouse.dragStart.x, event.clientY - runtime.mouse.dragStart.y) > 7) runtime.mouse.dragging = true;
  }
  const margin = 10;
  runtime.mouse.edgeX = event.clientX < margin ? -1 : event.clientX > viewport.width - margin ? 1 : 0;
  runtime.mouse.edgeY = event.clientY < 76 + margin ? -1 : event.clientY > viewport.height - 170 - margin ? 1 : 0;
}

function onCanvasMouseUp(event) {
  if (!runtime.started || runtime.paused || runtime.ended) return;
  runtime.mouse.down = false;
  if (event.button === 0) {
    if (runtime.placement) {
      placeBuilding(runtime.placement.type, runtime.hoverWorld.x, runtime.hoverWorld.y);
    } else if (runtime.targeting) {
      handleTargetClick(event.clientX, event.clientY);
    } else if (runtime.mouse.dragging && runtime.mouse.dragStart) {
      boxSelect(runtime.mouse.dragStart, { x: event.clientX, y: event.clientY }, event.shiftKey);
    } else {
      selectEntity(getEntityAtScreen(event.clientX, event.clientY), event.shiftKey);
    }
  }
  runtime.mouse.dragStart = null;
  runtime.mouse.dragging = false;
}

function onCanvasContextMenu(event) {
  event.preventDefault();
  if (!runtime.started || runtime.paused || runtime.ended) return;
  if (runtime.placement || runtime.targeting) { cancelCommandMode(); return; }
  issueContextOrder(event.clientX, event.clientY);
}

function onWheel(event) {
  if (!game || !runtime.started) return;
  event.preventDefault();
  const before = screenToWorld(event.clientX, event.clientY);
  const nextZoom = clamp(game.camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.68, 1.55);
  game.camera.zoom = nextZoom;
  const after = screenToWorld(event.clientX, event.clientY);
  const beforeIso = worldToIso(before.x, before.y);
  const afterIso = worldToIso(after.x, after.y);
  game.camera.x += beforeIso.x - afterIso.x;
  game.camera.y += beforeIso.y - afterIso.y;
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  runtime.keys.add(key);
  if (!runtime.started) return;
  if (key === 'escape') {
    if (DOM.helpScreen.classList.contains('visible')) DOM.helpScreen.classList.remove('visible');
    else if (runtime.placement || runtime.targeting) cancelCommandMode();
    else togglePause();
  }
  if (key === 'p') togglePause();
  if (runtime.paused || runtime.ended) return;
  if (key === ' ') centreOnSelection();
  if (key === 'h') {
    const tc = game.buildings.find((building) => building.owner === PLAYER && building.type === 'townCenter' && isAlive(building));
    if (tc) { runtime.selected = [tc.id]; centreCameraOnWorld(tc.x, tc.y); updateUI(true); }
  }
  if (key === 'b' && selectedUnits().some((unit) => unit.type === 'villager')) { runtime.commandMode = 'build'; updateUI(true); }
  if (key === 's') selectedUnits().forEach(stopUnit);
  if (event.ctrlKey && /^[1-5]$/.test(key)) {
    runtime.groups[key] = runtime.selected.filter((id) => {
      const entity = getEntity(id); return entity && entity.owner === PLAYER;
    });
    notify(`Control group ${key} assigned.`, 'good');
  } else if (/^[1-5]$/.test(key) && !event.ctrlKey) {
    runtime.selected = runtime.groups[key].filter((id) => isAlive(getEntity(id)));
    if (runtime.selected.length) centreOnSelection();
    updateUI(true);
  }
}

function onKeyUp(event) { runtime.keys.delete(event.key.toLowerCase()); }

function centreOnSelection() {
  const entities = selectedEntities();
  if (!entities.length) return;
  const x = entities.reduce((sum, entity) => sum + entity.x, 0) / entities.length;
  const y = entities.reduce((sum, entity) => sum + entity.y, 0) / entities.length;
  centreCameraOnWorld(x, y);
}

function onMinimapClick(event) {
  if (!game || runtime.paused || runtime.ended) return;
  const rect = minimap.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width * MAP_SIZE, 0, MAP_SIZE);
  const y = clamp((event.clientY - rect.top) / rect.height * MAP_SIZE, 0, MAP_SIZE);
  centreCameraOnWorld(x, y, true);
}

function notify(message, type = '') {
  const element = document.createElement('div');
  element.className = `notification ${type}`;
  element.textContent = message;
  DOM.notifications.appendChild(element);
  setTimeout(() => element.remove(), 3800);
}

function updateObjectivesUI() {
  DOM.objectiveList.innerHTML = game.objectives.map((objective) => `<li class="${objective.complete ? 'complete' : ''}">${objective.text}</li>`).join('');
}

function iconForEntity(entity) {
  if (!entity) return '⌂';
  if (entity.kind === 'unit') return UNIT_TYPES[entity.type].icon;
  if (entity.kind === 'building') return BUILDING_TYPES[entity.type].icon;
  return RESOURCE_TYPES[entity.type].icon;
}

function descriptionForEntity(entity) {
  if (entity.kind === 'unit') return UNIT_TYPES[entity.type].description;
  if (entity.kind === 'building') {
    if (entity.type === 'farm' && entity.progress >= 1) return `${BUILDING_TYPES.farm.description} ${Math.ceil(entity.foodRemaining)} food remains.`;
    if (entity.progress < 1) return `${BUILDING_TYPES[entity.type].name} under construction — ${Math.floor(entity.progress * 100)}% complete.`;
    return BUILDING_TYPES[entity.type].description;
  }
  return `${RESOURCE_TYPES[entity.type].name}: ${Math.ceil(entity.amount)} ${RESOURCE_TYPES[entity.type].resource} remaining.`;
}

function updateSelectionUI() {
  const entities = selectedEntities();
  const primary = entities[0];
  if (!primary) {
    DOM.portrait.textContent = '⌂';
    DOM.selectionOwner.textContent = 'NO SELECTION';
    DOM.selectionTitle.textContent = 'Select a unit or building';
    DOM.selectionDescription.textContent = 'Drag to select several units. Right-click the world to move, gather, build, or attack.';
    DOM.healthRow.classList.add('hidden');
    DOM.selectionStats.innerHTML = '';
    return;
  }

  DOM.portrait.textContent = entities.length > 1 ? entities.length : iconForEntity(primary);
  DOM.selectionOwner.textContent = primary.owner === PLAYER ? CIVILISATIONS[game.civilisation].name : primary.owner === ENEMY ? 'ASHEN HORDE' : 'WILDERNESS';
  if (entities.length > 1) {
    const unitCount = entities.filter((entity) => entity.kind === 'unit').length;
    DOM.selectionTitle.textContent = `${unitCount} units selected`;
    DOM.selectionDescription.textContent = 'Issue a shared order or create a numbered control group with Ctrl + 1–5.';
    DOM.healthRow.classList.add('hidden');
    const military = entities.filter((entity) => entity.kind === 'unit' && entity.type !== 'villager').length;
    const villagers = entities.filter((entity) => entity.kind === 'unit' && entity.type === 'villager').length;
    DOM.selectionStats.innerHTML = `<span><b>${villagers}</b> villagers</span><span><b>${military}</b> military</span>`;
    return;
  }

  const name = primary.kind === 'unit' ? UNIT_TYPES[primary.type].name : primary.kind === 'building' ? BUILDING_TYPES[primary.type].name : RESOURCE_TYPES[primary.type].name;
  DOM.selectionTitle.textContent = name;
  DOM.selectionDescription.textContent = descriptionForEntity(primary);
  if (primary.hp != null) {
    DOM.healthRow.classList.remove('hidden');
    const ratio = clamp(primary.hp / primary.maxHp, 0, 1);
    DOM.healthFill.style.width = `${ratio * 100}%`;
    DOM.healthValue.textContent = `${Math.ceil(primary.hp)} / ${Math.ceil(primary.maxHp)}`;
  } else DOM.healthRow.classList.add('hidden');

  if (primary.kind === 'unit') {
    const attack = unitEffectiveAttack(primary);
    const armour = unitEffectiveArmour(primary);
    const carrying = primary.carryingAmount > 0 ? `<span><b>${Math.floor(primary.carryingAmount)}</b> ${primary.carryingType}</span>` : '';
    DOM.selectionStats.innerHTML = `<span>Attack <b>${attack}</b></span><span>Armour <b>${armour}</b></span><span>Speed <b>${primary.speed.toFixed(1)}</b></span>${carrying}`;
  } else if (primary.kind === 'building') {
    DOM.selectionStats.innerHTML = `<span>Armour <b>${primary.armour}</b></span><span>Complete <b>${Math.floor(primary.progress * 100)}%</b></span>`;
  } else {
    DOM.selectionStats.innerHTML = `<span>Remaining <b>${Math.ceil(primary.amount)}</b></span>`;
  }
}

function commandButton({ action, icon, name, cost = {}, hotkey = '', disabled = false, title = '', active = false }) {
  const button = document.createElement('button');
  button.className = `command-button${active ? ' active' : ''}`;
  button.dataset.action = action;
  button.disabled = disabled;
  button.innerHTML = `${hotkey ? `<span class="hotkey">${hotkey}</span>` : ''}<span class="command-icon">${icon}</span><span class="command-name">${name}</span>${Object.keys(cost).length ? `<span class="command-cost">${costText(cost)}</span>` : ''}`;
  button.dataset.tooltip = title || name;
  return button;
}

function buildCommandButtons() {
  const entities = selectedEntities();
  const player = getPlayer(PLAYER);
  const buttons = [];
  DOM.backCommand.classList.add('hidden');
  DOM.commandContext.textContent = 'GENERAL';

  if (!entities.length || entities.some((entity) => entity.owner !== PLAYER)) return buttons;

  if (runtime.commandMode === 'build') {
    DOM.commandContext.textContent = 'CONSTRUCTION';
    DOM.backCommand.classList.remove('hidden');
    for (const type of BUILD_MENU) {
      const spec = BUILDING_TYPES[type];
      const disabled = (spec.requiredAge || 0) > player.age || !hasCost(player, spec.cost);
      buttons.push(commandButton({
        action: `place:${type}`, icon: spec.icon, name: spec.name, cost: spec.cost, disabled,
        title: `${spec.name} — ${spec.description}${spec.requiredAge ? ` Requires ${getAgeName(spec.requiredAge)}.` : ''}`,
      }));
    }
    return buttons;
  }

  const units = entities.filter((entity) => entity.kind === 'unit');
  if (units.length) {
    DOM.commandContext.textContent = units.every((unit) => unit.type === 'villager') ? 'VILLAGER' : 'FIELD ORDERS';
    buttons.push(commandButton({ action: 'target:attackMove', icon: '⚔', name: 'Attack-move', hotkey: 'A', title: 'Move toward a point and automatically engage enemies encountered.' }));
    buttons.push(commandButton({ action: 'stop', icon: '■', name: 'Stop', hotkey: 'S', title: 'Cancel current orders.' }));
    if (units.some((unit) => unit.type === 'villager')) {
      buttons.push(commandButton({ action: 'buildMenu', icon: '⚒', name: 'Build', hotkey: 'B', title: 'Open the construction menu.' }));
      buttons.push(commandButton({ action: 'target:repair', icon: '⟲', name: 'Repair', title: 'Right-click a damaged friendly building to repair it.' }));
    }
    return buttons;
  }

  const building = entities.length === 1 && entities[0].kind === 'building' ? entities[0] : null;
  if (!building || building.progress < 1) return buttons;
  DOM.commandContext.textContent = BUILDING_TYPES[building.type].name.toUpperCase();

  const addTrain = (type) => {
    const spec = UNIT_TYPES[type];
    const check = canTrain(PLAYER, type);
    buttons.push(commandButton({
      action: `train:${type}`, icon: spec.icon, name: spec.name, cost: spec.cost, disabled: !check.ok,
      title: `${spec.name} — ${spec.description}${check.ok ? '' : ` ${check.reason}.`}`,
    }));
  };
  const addTech = (id) => {
    const tech = TECHNOLOGIES[id];
    const researched = player.researched.includes(id);
    const disabled = researched || player.age < tech.requiredAge || !hasCost(player, tech.cost) || Boolean(building.research);
    buttons.push(commandButton({
      action: `research:${id}`, icon: tech.icon, name: researched ? 'Researched' : tech.name, cost: tech.cost, disabled,
      title: `${tech.name} — ${tech.description}`,
    }));
  };

  if (building.type === 'townCenter') {
    addTrain('villager');
    if (player.age === 0) buttons.push(commandButton({ action: 'age:1', icon: 'Ⅱ', name: 'Tool Age', cost: { food: 500 }, disabled: !hasCost(player, { food: 500 }) || Boolean(building.research), title: 'Advance to the Tool Age and unlock new military buildings.' }));
    if (player.age === 1) buttons.push(commandButton({ action: 'age:2', icon: 'Ⅲ', name: 'Bronze Age', cost: { food: 800, gold: 200 }, disabled: !hasCost(player, { food: 800, gold: 200 }) || Boolean(building.research), title: 'Advance to the Bronze Age.' }));
    if (player.age >= 1) addTech('leatherArmour');
    if (player.age >= 2) addTech('architecture');
  } else if (building.type === 'barracks') {
    addTrain('clubman');
    if (player.age >= 1) addTech('toolworking');
  } else if (building.type === 'archeryRange') addTrain('archer');
  else if (building.type === 'stable') addTrain('scout');
  else if (building.type === 'granary' && player.age >= 1) addTech('wheel');

  if (['townCenter', 'barracks', 'archeryRange', 'stable'].includes(building.type)) {
    buttons.push(commandButton({ action: 'target:rally', icon: '⚑', name: 'Rally point', title: 'Choose where newly trained units should assemble.' }));
  }
  return buttons;
}
