/* Empire Dawn runtime · part 2 */
function generateTerrain(seed) {
  const random = mulberry32(seed);
  const terrain = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(TERRAIN.GRASS));
  const variants = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(0));
  const fog = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(0));

  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const edge = Math.min(x, y, MAP_SIZE - 1 - x, MAP_SIZE - 1 - y);
      const noise = hash2(x, y, seed);
      let value = noise > 0.72 ? TERRAIN.GRASS_DARK : TERRAIN.GRASS;
      if (edge <= 1) value = TERRAIN.WATER;
      else if (edge === 2) value = TERRAIN.SHALLOW;
      else if (edge === 3 && noise > 0.22) value = TERRAIN.SAND;
      terrain[y][x] = value;
      variants[y][x] = Math.floor(random() * 6);
    }
  }

  // A crescent lake leaves wide paths on both sides while giving the map a strong landmark.
  const lakeX = 35;
  const lakeY = 24;
  for (let y = 13; y <= 34; y += 1) {
    for (let x = 27; x <= 45; x += 1) {
      const dx = (x - lakeX) / 1.05;
      const dy = (y - lakeY) / 1.35;
      const d = Math.hypot(dx, dy);
      const bite = Math.hypot(x - 40, y - 24);
      if (d < 6.1 && bite > 3.7) terrain[y][x] = TERRAIN.WATER;
      else if (d < 7.2 && bite > 3.2 && terrain[y][x] !== TERRAIN.WATER) terrain[y][x] = TERRAIN.SAND;
    }
  }

  // Worn ground around the two starting settlements.
  for (const [cx, cy] of [[16, 18], [48, 45]]) {
    for (let y = cy - 6; y <= cy + 6; y += 1) {
      for (let x = cx - 6; x <= cx + 6; x += 1) {
        if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
        if (Math.hypot(x - cx, y - cy) < 5.2 && random() > 0.22 && terrain[y][x] < TERRAIN.WATER) {
          terrain[y][x] = TERRAIN.DIRT;
        }
      }
    }
  }

  return { terrain, variants, fog };
}

function isTerrainWalkable(x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE) return false;
  const terrain = game.terrain[ty][tx];
  return terrain !== TERRAIN.WATER && terrain !== TERRAIN.SHALLOW;
}

function buildingContainsTile(building, tx, ty, margin = 0) {
  const halfW = building.width / 2 + margin;
  const halfH = building.height / 2 + margin;
  return tx + 0.5 >= building.x - halfW && tx + 0.5 < building.x + halfW
    && ty + 0.5 >= building.y - halfH && ty + 0.5 < building.y + halfH;
}

function isCellBlocked(tx, ty, ignoreId = null) {
  if (!isTerrainWalkable(tx + 0.5, ty + 0.5)) return true;
  for (const building of game.buildings) {
    if (building.dead || building.id === ignoreId || building.progress < 0.08) continue;
    if (buildingContainsTile(building, tx, ty, 0.03)) return true;
  }
  for (const resource of game.resourcesNodes) {
    if (resource.dead || resource.id === ignoreId) continue;
    const spec = RESOURCE_TYPES[resource.type];
    if (spec.blocking && Math.floor(resource.x) === tx && Math.floor(resource.y) === ty) return true;
  }
  return false;
}

function clearArea(cx, cy, radius) {
  game.resourcesNodes = game.resourcesNodes.filter((resource) => Math.hypot(resource.x - cx, resource.y - cy) > radius);
}

function addCluster(type, cx, cy, count, spread, random, amountScale = 1) {
  let attempts = 0;
  let placed = 0;
  while (placed < count && attempts < count * 30) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * spread;
    const x = clamp(cx + Math.cos(angle) * radius, 4.5, MAP_SIZE - 4.5);
    const y = clamp(cy + Math.sin(angle) * radius, 4.5, MAP_SIZE - 4.5);
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!isTerrainWalkable(x, y)) continue;
    if (game.resourcesNodes.some((resource) => Math.hypot(resource.x - x, resource.y - y) < 0.82)) continue;
    if (game.buildings.some((building) => buildingContainsTile(building, tx, ty, 0.6))) continue;
    createResource(type, tx + 0.5 + (random() - 0.5) * 0.22, ty + 0.5 + (random() - 0.5) * 0.22, Math.round(RESOURCE_TYPES[type].amount * amountScale));
    placed += 1;
  }
}

function addMapResources(random) {
  // Player-side economy.
  addCluster('berries', 20, 17, 6, 2.0, random);
  addCluster('tree', 10, 22, 24, 4.8, random);
  addCluster('tree', 20, 9, 18, 4.4, random);
  addCluster('stone', 24, 24, 5, 2.1, random);
  addCluster('gold', 12, 30, 4, 2.0, random);
  addCluster('gazelle', 26, 13, 6, 3.0, random);

  // Rival-side economy.
  addCluster('berries', 44, 46, 6, 2.1, random);
  addCluster('tree', 54, 40, 24, 4.6, random);
  addCluster('tree', 45, 55, 18, 4.2, random);
  addCluster('stone', 40, 40, 5, 2.0, random);
  addCluster('gold', 53, 51, 5, 2.0, random);
  addCluster('gazelle', 38, 53, 6, 3.0, random);

  // Contested centre.
  addCluster('gold', 29, 42, 6, 2.3, random, 1.2);
  addCluster('stone', 36, 38, 6, 2.4, random, 1.2);
  addCluster('tree', 30, 49, 20, 4.8, random);
  addCluster('gazelle', 21, 40, 8, 4.0, random);

  // Peripheral forests for map richness.
  addCluster('tree', 9, 47, 28, 6.0, random);
  addCluster('tree', 49, 13, 24, 5.4, random);
}

function createNewGame(civilisation = 'river', difficulty = 'standard') {
  const seed = 20260902;
  const generated = { terrain: null, variants: null, fog: null };
  game = {
    version: 1,
    seed,
    civilisation,
    difficulty,
    elapsed: 0,
    nextId: 1,
    camera: { x: 0, y: 0, targetX: null, targetY: null, zoom: 1.14 },
    players: [
      createPlayer(CIVILISATIONS[civilisation].name, '#4d8bc4', { food: 390, wood: 530, stone: 180, gold: 140 }, 0),
      createPlayer('Ashen Horde', '#bd4c3e', { food: 680, wood: 720, stone: 200, gold: 250 }, difficulty === 'hard' ? 1 : 0),
    ],
    terrain: generated.terrain,
    variants: generated.variants,
    fog: generated.fog,
    units: [],
    buildings: [],
    resourcesNodes: [],
    projectiles: [],
    particles: [],
    decals: [],
    objectives: [
      { id: 'gather', text: 'Gather 250 additional resources', complete: false, startGathered: 0 },
      { id: 'barracks', text: 'Construct a Barracks', complete: false },
      { id: 'army', text: 'Command at least 5 military units', complete: false },
      { id: 'age', text: 'Advance to the Tool Age', complete: false },
      { id: 'destroy', text: 'Destroy the enemy Town Centre', complete: false },
    ],
    ai: {
      thinkTimer: 1,
      nextAttack: difficulty === 'hard' ? 62 : 82,
      wave: 0,
      bonusTick: 0,
    },
    lastAttackWarning: -100,
    autosaveAt: 30,
    endReason: null,
  };

  const terrain = generateTerrain(seed);
  game.terrain = terrain.terrain;
  game.variants = terrain.variants;
  game.fog = terrain.fog;

  // Founding settlements.
  createBuilding(PLAYER, 'townCenter', 16.5, 18.5);
  createUnit(PLAYER, 'villager', 14.3, 17.0);
  createUnit(PLAYER, 'villager', 15.0, 20.9);
  createUnit(PLAYER, 'villager', 18.3, 17.2);
  createUnit(PLAYER, 'villager', 18.8, 20.1);

  createBuilding(ENEMY, 'townCenter', 47.5, 45.5);
  createBuilding(ENEMY, 'house', 51.0, 44.0);
  createBuilding(ENEMY, 'house', 45.0, 49.0);
  createBuilding(ENEMY, 'barracks', 51.0, 48.0);
  createUnit(ENEMY, 'villager', 45.1, 43.2);
  createUnit(ENEMY, 'villager', 47.0, 42.5);
  createUnit(ENEMY, 'villager', 49.6, 43.8);
  createUnit(ENEMY, 'villager', 44.8, 47.1);
  createUnit(ENEMY, 'villager', 49.2, 48.5);
  createUnit(ENEMY, 'clubman', 43.2, 45.0);
  createUnit(ENEMY, 'clubman', 43.7, 46.2);
  if (difficulty === 'hard') createUnit(ENEMY, 'archer', 44.2, 44.1);

  const random = mulberry32(seed ^ 0xA5A5A5);
  addMapResources(random);
  clearArea(16.5, 18.5, 4.5);
  clearArea(47.5, 45.5, 4.6);
  // Re-add guaranteed close food after clearing building footprints.
  addCluster('berries', 21, 18, 6, 1.7, random);
  addCluster('berries', 43, 45, 6, 1.7, random);

  game.objectives[0].startGathered = getPlayer(PLAYER).stats.gathered;
  centreCameraOnWorld(16.5, 18.5, true);
  updateFog(true);
  assignInitialAIWorkers();

  runtime.started = true;
  runtime.paused = false;
  runtime.ended = false;
  runtime.selected = [];
  runtime.commandMode = 'default';
  runtime.placement = null;
  runtime.targeting = null;
  runtime.groups = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  runtime.lastTime = performance.now();
  runtime.accumulator = 0;
  runtime.saveTimer = 0;
  runtime.previewBattleStarted = false;
  DOM.startScreen.classList.remove('visible');
  DOM.pauseScreen.classList.remove('visible');
  DOM.endScreen.classList.remove('visible');
  updateUI(true);
  notify(`The ${CIVILISATIONS[civilisation].name} have founded a new settlement.`, 'good');
  sound('age');
}

function setupPreviewBattle() {
  if (!game || runtime.previewBattleStarted) return;
  runtime.previewBattleStarted = true;
  const player = getPlayer(PLAYER);
  player.age = 1;
  player.resources = { food: 735, wood: 680, stone: 310, gold: 260 };
  player.upgrades.attack = 1;

  const completed = (type, x, y) => createBuilding(PLAYER, type, x, y, { complete: true });
  completed('house', 12.7, 14.3);
  completed('house', 20.5, 22.4);
  completed('barracks', 21.0, 15.0);
  completed('archeryRange', 12.0, 22.5);
  completed('watchTower', 25.0, 22.0);
  completed('farm', 20.5, 19.5);
  completed('farm', 14.2, 23.3);

  const playerArmy = [
    createUnit(PLAYER, 'clubman', 28.1, 31.2), createUnit(PLAYER, 'clubman', 28.9, 32.0),
    createUnit(PLAYER, 'clubman', 29.8, 31.0), createUnit(PLAYER, 'archer', 26.8, 33.6),
    createUnit(PLAYER, 'archer', 27.8, 34.2), createUnit(PLAYER, 'archer', 28.9, 34.0),
    createUnit(PLAYER, 'scout', 26.2, 30.4),
  ];
  const enemyArmy = [
    createUnit(ENEMY, 'clubman', 34.6, 32.2), createUnit(ENEMY, 'clubman', 35.4, 31.4),
    createUnit(ENEMY, 'clubman', 36.0, 32.6), createUnit(ENEMY, 'clubman', 35.1, 33.4),
    createUnit(ENEMY, 'archer', 37.2, 30.5), createUnit(ENEMY, 'archer', 37.8, 31.5),
  ];
  playerArmy.forEach((unit, index) => orderAttack(unit, enemyArmy[index % enemyArmy.length]));
  enemyArmy.forEach((unit, index) => orderAttack(unit, playerArmy[index % playerArmy.length]));
  runtime.selected = playerArmy.map((unit) => unit.id);
  game.fog.forEach((row) => row.fill(0.42));
  game.camera.zoom = 1.22;
  centreCameraOnWorld(32.4, 32.2, true);
  game.elapsed = 487;
  updateFog(true);
  updateUI(true);
}

function assignInitialAIWorkers() {
  const aiVillagers = game.units.filter((unit) => unit.owner === ENEMY && unit.type === 'villager');
  const preference = ['berries', 'tree', 'tree', 'gold', 'berries'];
  aiVillagers.forEach((unit, index) => {
    const target = nearestResource(unit.x, unit.y, preference[index % preference.length], 18);
    if (target) orderGather(unit, target);
  });
}
