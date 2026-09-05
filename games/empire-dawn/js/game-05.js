/* Empire Dawn runtime · part 5 */
function updateAI(dt) {
  if (!game || runtime.ended) return;
  const ai = game.ai;
  ai.thinkTimer -= dt;
  ai.bonusTick += dt;
  if (ai.bonusTick >= 1) {
    ai.bonusTick -= 1;
    const bonus = game.difficulty === 'hard' ? 1.45 : 0.75;
    // Modest strategic income prevents the AI from collapsing if a path is blocked.
    getPlayer(ENEMY).resources.food += bonus;
    getPlayer(ENEMY).resources.wood += bonus * 0.8;
  }
  if (ai.thinkTimer > 0) return;
  ai.thinkTimer = game.difficulty === 'hard' ? 2.8 : 4.0;

  const player = getPlayer(ENEMY);
  const aiBuildings = game.buildings.filter((building) => building.owner === ENEMY && isAlive(building) && building.progress >= 1);
  const aiUnits = game.units.filter((unit) => unit.owner === ENEMY && isAlive(unit));
  const villagers = aiUnits.filter((unit) => unit.type === 'villager');
  const army = aiUnits.filter((unit) => unit.type !== 'villager');

  // Put idle workers back into the economy.
  const workPattern = ['berries', 'tree', 'tree', 'gold', 'stone'];
  villagers.forEach((unit, index) => {
    if (unit.order.type !== 'idle') return;
    const target = nearestResource(unit.x, unit.y, workPattern[index % workPattern.length], 22) || nearestResource(unit.x, unit.y, null, 22);
    if (target) orderGather(unit, target);
  });

  const tc = aiBuildings.find((building) => building.type === 'townCenter');
  const barracks = aiBuildings.find((building) => building.type === 'barracks');
  let range = aiBuildings.find((building) => building.type === 'archeryRange');

  if (player.age === 0 && game.elapsed > (game.difficulty === 'hard' ? 34 : 54) && player.resources.food >= 500 && tc && !tc.research) {
    spendCost(player, { food: 500 });
    tc.research = { kind: 'age', targetAge: 1, progress: 0, duration: game.difficulty === 'hard' ? 22 : 34 };
  }

  if (player.age >= 1 && !range && player.resources.wood >= 175) {
    spendCost(player, { wood: 175 });
    range = createBuilding(ENEMY, 'archeryRange', 53.0, 46.0, { complete: true });
  }

  if (populationUsed(ENEMY) + populationQueued(ENEMY) >= populationCap(ENEMY) - 1 && player.resources.wood >= 80) {
    const spot = findAIPlacement('house');
    if (spot) {
      spendCost(player, { wood: 80 });
      createBuilding(ENEMY, 'house', spot.x, spot.y, { complete: true });
    }
  }

  if (tc && villagers.length < (game.difficulty === 'hard' ? 9 : 7) && tc.queue.length < 1) {
    const check = canTrain(ENEMY, 'villager');
    if (check.ok) {
      spendCost(player, UNIT_TYPES.villager.cost);
      tc.queue.push({ type: 'villager', progress: 0, duration: UNIT_TYPES.villager.trainTime * (game.difficulty === 'hard' ? 0.78 : 1) });
    }
  }
  if (barracks && barracks.queue.length < 2 && army.length < 15) {
    const check = canTrain(ENEMY, 'clubman');
    if (check.ok) {
      spendCost(player, UNIT_TYPES.clubman.cost);
      barracks.queue.push({ type: 'clubman', progress: 0, duration: UNIT_TYPES.clubman.trainTime * (game.difficulty === 'hard' ? 0.76 : 1) });
    }
  }
  if (range && player.age >= 1 && range.queue.length < 1 && army.filter((unit) => unit.type === 'archer').length < 7) {
    const check = canTrain(ENEMY, 'archer');
    if (check.ok) {
      spendCost(player, UNIT_TYPES.archer.cost);
      range.queue.push({ type: 'archer', progress: 0, duration: UNIT_TYPES.archer.trainTime * (game.difficulty === 'hard' ? 0.78 : 1) });
    }
  }

  if (game.elapsed >= ai.nextAttack && army.length >= (game.difficulty === 'hard' ? 5 : 6)) {
    const target = game.buildings.find((building) => building.owner === PLAYER && building.type === 'townCenter' && isAlive(building))
      || game.buildings.find((building) => building.owner === PLAYER && isAlive(building));
    if (target) {
      const waveSize = Math.min(army.length, (game.difficulty === 'hard' ? 7 : 6) + ai.wave * 2);
      army.sort((a, b) => sqrDistance(a, target) - sqrDistance(b, target)).slice(0, waveSize).forEach((unit) => orderAttack(unit, target));
      ai.wave += 1;
      ai.nextAttack = game.elapsed + (game.difficulty === 'hard' ? 54 : 70);
      if (game.elapsed - game.lastAttackWarning > 30) {
        game.lastAttackWarning = game.elapsed;
        notify('Watch out! The other team is coming.', 'bad');
        sound('warning');
      }
    }
  }
}

function findAIPlacement(type) {
  const spec = BUILDING_TYPES[type];
  const centre = { x: 47.5, y: 45.5 };
  for (let radius = 5; radius < 12; radius += 1) {
    for (let step = 0; step < 16; step += 1) {
      const angle = step / 16 * Math.PI * 2;
      const x = Math.floor(centre.x + Math.cos(angle) * radius) + (spec.width % 2 ? 0.5 : 0);
      const y = Math.floor(centre.y + Math.sin(angle) * radius) + (spec.height % 2 ? 0.5 : 0);
      if (canPlaceBuilding(type, x, y, ENEMY).ok) return { x, y };
    }
  }
  return null;
}

function updateFog(force = false) {
  if (!game) return;
  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      if (game.fog[y][x] >= 0.95) game.fog[y][x] = 0.42;
    }
  }
  const revealers = [
    ...game.units.filter((unit) => unit.owner === PLAYER && isAlive(unit)),
    ...game.buildings.filter((building) => building.owner === PLAYER && isAlive(building) && building.progress >= 0.15),
  ];
  for (const entity of revealers) {
    let radius = entity.kind === 'building' ? 6.2 : 5.2;
    if (entity.type === 'watchTower') radius = 9;
    if (entity.type === 'scout') radius = 7.5;
    const minX = clamp(Math.floor(entity.x - radius), 0, MAP_SIZE - 1);
    const maxX = clamp(Math.ceil(entity.x + radius), 0, MAP_SIZE - 1);
    const minY = clamp(Math.floor(entity.y - radius), 0, MAP_SIZE - 1);
    const maxY = clamp(Math.ceil(entity.y + radius), 0, MAP_SIZE - 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const d = Math.hypot(x + 0.5 - entity.x, y + 0.5 - entity.y);
        if (d <= radius) game.fog[y][x] = 1;
      }
    }
  }
  if (force) renderMinimap();
}

function updateObjectives() {
  const player = getPlayer(PLAYER);
  const objectiveMap = Object.fromEntries(game.objectives.map((objective) => [objective.id, objective]));
  objectiveMap.gather.complete = player.stats.gathered - objectiveMap.gather.startGathered >= 250;
  objectiveMap.barracks.complete = game.buildings.some((building) => building.owner === PLAYER && building.type === 'barracks' && building.progress >= 1 && isAlive(building));
  objectiveMap.army.complete = game.units.filter((unit) => unit.owner === PLAYER && unit.type !== 'villager' && isAlive(unit)).length >= 5;
  objectiveMap.age.complete = player.age >= 1;
  objectiveMap.destroy.complete = !game.buildings.some((building) => building.owner === ENEMY && building.type === 'townCenter' && isAlive(building));
}

function cleanupDeadEntities() {
  // Keep destroyed buildings briefly only as decals; dead units can be removed immediately.
  game.units = game.units.filter((unit) => !unit.dead);
  game.buildings = game.buildings.filter((building) => !building.dead);
  game.resourcesNodes = game.resourcesNodes.filter((resource) => !resource.dead);
}

function update(dt) {
  if (!game || !runtime.started) return;
  updateCamera(dt);
  if (runtime.paused || runtime.ended) return;
  const scaled = dt * runtime.speed;
  game.elapsed += scaled;
  game.units.forEach((unit) => updateUnit(unit, scaled));
  game.buildings.forEach((building) => updateBuilding(building, scaled));
  updateProjectiles(scaled);
  updateParticles(scaled);
  updateAI(scaled);

  runtime.fogTimer -= scaled;
  if (runtime.fogTimer <= 0) { runtime.fogTimer = 0.42; updateFog(); }
  runtime.uiTimer -= scaled;
  if (runtime.uiTimer <= 0) { runtime.uiTimer = 0.16; updateObjectives(); updateUI(); }
  runtime.saveTimer += scaled;
  if (runtime.saveTimer >= 30 && !runtime.previewMode) { runtime.saveTimer = 0; saveGame(false); }

  if (Math.floor(game.elapsed * 2) % 20 === 0) cleanupDeadEntities();
}

function terrainBaseColour(type, variant, fog) {
  const light = variant % 3;
  const palettes = {
    [TERRAIN.GRASS]: ['#56763c', '#5d7f43', '#526f38'],
    [TERRAIN.GRASS_DARK]: ['#466634', '#4b6b37', '#405e31'],
    [TERRAIN.SAND]: ['#b39a64', '#bea66e', '#aa905c'],
    [TERRAIN.WATER]: ['#315e68', '#2e6872', '#356773'],
    [TERRAIN.DIRT]: ['#806743', '#886f49', '#78603f'],
    [TERRAIN.SHALLOW]: ['#5f8880', '#688f86', '#5a8178'],
  };
  let colour = palettes[type][light];
  if (fog <= 0) return '#11150f';
  if (fog < 0.9) colour = shadeColour(colour, -0.5);
  return colour;
}

function shadeColour(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = value >> 16;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  const factor = 1 + amount;
  return `rgb(${clamp(Math.round(r * factor), 0, 255)},${clamp(Math.round(g * factor), 0, 255)},${clamp(Math.round(b * factor), 0, 255)})`;
}

function drawDiamond(cx, cy, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

function drawTerrain(time) {
  const zoom = game.camera.zoom;
  const halfW = TILE_W / 2 * zoom;
  const halfH = TILE_H / 2 * zoom;
  ctx.fillStyle = '#0b0f0a';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const centre = worldToScreen(x + 0.5, y + 0.5);
      if (centre.x < -halfW * 2 || centre.x > viewport.width + halfW * 2 || centre.y < 50 - halfH * 2 || centre.y > viewport.height + halfH * 2) continue;
      const terrain = game.terrain[y][x];
      const fog = game.fog[y][x];
      drawDiamond(centre.x, centre.y, halfW + 0.7, halfH + 0.7);
      ctx.fillStyle = terrainBaseColour(terrain, game.variants[y][x], fog);
      ctx.fill();

      if (fog > 0 && terrain === TERRAIN.WATER) {
        const shimmer = Math.sin(time * 1.4 + x * 0.8 + y * 0.55) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(178, 220, 214, ${0.05 + shimmer * 0.08})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(centre.x - halfW * 0.45, centre.y - halfH * 0.08);
        ctx.lineTo(centre.x + halfW * 0.28, centre.y + halfH * 0.06);
        ctx.stroke();
      } else if (fog > 0.8 && (terrain === TERRAIN.GRASS || terrain === TERRAIN.GRASS_DARK) && game.variants[y][x] === 1 && zoom > 0.86) {
        ctx.strokeStyle = 'rgba(203,224,149,.18)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(centre.x - 5 * zoom, centre.y + 3 * zoom);
        ctx.lineTo(centre.x - 3 * zoom, centre.y - 1 * zoom);
        ctx.moveTo(centre.x + 8 * zoom, centre.y + 2 * zoom);
        ctx.lineTo(centre.x + 10 * zoom, centre.y - 2 * zoom);
        ctx.stroke();
      }

      if (fog <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,.58)';
        drawDiamond(centre.x, centre.y, halfW + 0.7, halfH + 0.7);
        ctx.fill();
      }
    }
  }
}

function entityVisible(entity) {
  if (entity.owner === PLAYER) return true;
  const tx = clamp(Math.floor(entity.x), 0, MAP_SIZE - 1);
  const ty = clamp(Math.floor(entity.y), 0, MAP_SIZE - 1);
  return game.fog[ty][tx] >= 0.9;
}

function drawGroundDecals() {
  for (const decal of game.decals) {
    const point = worldToScreen(decal.x, decal.y);
    const alpha = clamp(decal.life / Math.min(decal.maxLife, 8), 0.12, 0.4);
    ctx.save();
    ctx.translate(point.x, point.y + 3 * game.camera.zoom);
    ctx.scale(1, 0.45);
    ctx.fillStyle = `rgba(49,32,24,${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, decal.size * 15 * game.camera.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawResource(resource, time) {
  if (!entityVisible(resource)) return;
  const zoom = game.camera.zoom;
  const point = worldToScreen(resource.x, resource.y);
  const selected = runtime.selected.includes(resource.id);
  if (selected) drawSelectionRing(resource, '#d9bd70');

  if (resource.type === 'tree') {
    const sway = Math.sin(time * 0.7 + resource.sway) * 1.3 * zoom;
    drawShadow(point.x, point.y + 2 * zoom, 18 * zoom, 7 * zoom, 0.25);
    ctx.strokeStyle = '#49341f';
    ctx.lineWidth = 5 * zoom;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - 2 * zoom);
    ctx.lineTo(point.x + sway * 0.25, point.y - 29 * zoom);
    ctx.stroke();
    const greens = ['#315b2d', '#3f7136', '#2f6538', '#4b7838', '#385f2c'];
    const colour = greens[resource.variant % greens.length];
    for (const [dx, dy, radius] of [[-10,-27,12],[7,-31,14],[-1,-40,14],[14,-43,10],[-13,-43,11]]) {
      ctx.fillStyle = shadeColour(colour, dy < -38 ? 0.08 : -0.05);
      ctx.beginPath();
      ctx.arc(point.x + (dx * zoom) + sway, point.y + dy * zoom, radius * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(198,225,141,.12)';
    ctx.beginPath();
    ctx.arc(point.x - 6 * zoom + sway, point.y - 45 * zoom, 7 * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (resource.type === 'berries') {
    drawShadow(point.x, point.y + 2 * zoom, 14 * zoom, 5 * zoom, 0.2);
    ctx.fillStyle = '#3f6a35';
    for (const [dx, dy, r] of [[-8,-7,7],[0,-10,8],[8,-6,7],[-3,-3,8]]) {
      ctx.beginPath(); ctx.arc(point.x + dx * zoom, point.y + dy * zoom, r * zoom, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#9f3140';
    for (let i = 0; i < 7; i += 1) {
      const angle = i * 2.17 + resource.variant;
      ctx.beginPath();
      ctx.arc(point.x + Math.cos(angle) * 8 * zoom, point.y - 7 * zoom + Math.sin(angle) * 4 * zoom, 1.8 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (resource.type === 'gold' || resource.type === 'stone') {
    const gold = resource.type === 'gold';
    drawShadow(point.x, point.y + 4 * zoom, 18 * zoom, 7 * zoom, 0.26);
    const palette = gold ? ['#c59a32', '#e5bd4f', '#8f6b1e'] : ['#827f7a', '#a39d91', '#66655f'];
    const shards = [[-12,0,11,11],[-2,-8,13,17],[10,-2,10,14],[1,3,15,12]];
    shards.forEach(([dx, dy, w, h], index) => {
      ctx.fillStyle = palette[index % palette.length];
      ctx.beginPath();
      ctx.moveTo(point.x + (dx - w / 2) * zoom, point.y + (dy + h / 2) * zoom);
      ctx.lineTo(point.x + dx * zoom, point.y + (dy - h / 2) * zoom);
      ctx.lineTo(point.x + (dx + w / 2) * zoom, point.y + (dy + h / 2) * zoom);
      ctx.closePath();
      ctx.fill();
    });
  } else if (resource.type === 'gazelle') {
    const bob = Math.sin(time * 2 + resource.sway) * 1.2 * zoom;
    drawShadow(point.x, point.y + 2 * zoom, 15 * zoom, 4 * zoom, 0.18);
    ctx.strokeStyle = '#5f4027';
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(point.x - 6 * zoom, point.y - 3 * zoom); ctx.lineTo(point.x - 8 * zoom, point.y + 7 * zoom);
    ctx.moveTo(point.x + 5 * zoom, point.y - 2 * zoom); ctx.lineTo(point.x + 8 * zoom, point.y + 7 * zoom);
    ctx.stroke();
    ctx.fillStyle = '#a97d4a';
    ctx.beginPath(); ctx.ellipse(point.x, point.y - 8 * zoom + bob, 11 * zoom, 6 * zoom, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(point.x + 10 * zoom, point.y - 14 * zoom + bob, 4 * zoom, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8c49d';
    ctx.lineWidth = 1 * zoom;
    ctx.beginPath();
    ctx.moveTo(point.x + 11 * zoom, point.y - 18 * zoom + bob); ctx.lineTo(point.x + 14 * zoom, point.y - 24 * zoom + bob);
    ctx.moveTo(point.x + 9 * zoom, point.y - 18 * zoom + bob); ctx.lineTo(point.x + 10 * zoom, point.y - 24 * zoom + bob);
    ctx.stroke();
  }
}

function drawShadow(x, y, radiusX, radiusY, alpha = 0.28) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, radiusY / radiusX);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ownerColour(owner) {
  if (owner === PLAYER) return '#4f98d2';
  if (owner === ENEMY) return '#c65345';
  return '#b1a58b';
}

function drawIsoPrism(x, y, width, height, elevation, colours) {
  const zoom = game.camera.zoom;
  const p00 = worldToScreen(x - width / 2, y - height / 2);
  const p10 = worldToScreen(x + width / 2, y - height / 2);
  const p11 = worldToScreen(x + width / 2, y + height / 2);
  const p01 = worldToScreen(x - width / 2, y + height / 2);
  const lift = elevation * TILE_H * zoom;

  ctx.fillStyle = colours.left;
  ctx.beginPath();
  ctx.moveTo(p01.x, p01.y); ctx.lineTo(p11.x, p11.y); ctx.lineTo(p11.x, p11.y - lift); ctx.lineTo(p01.x, p01.y - lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colours.right;
  ctx.beginPath();
  ctx.moveTo(p10.x, p10.y); ctx.lineTo(p11.x, p11.y); ctx.lineTo(p11.x, p11.y - lift); ctx.lineTo(p10.x, p10.y - lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colours.top;
  ctx.beginPath();
  ctx.moveTo(p00.x, p00.y - lift); ctx.lineTo(p10.x, p10.y - lift); ctx.lineTo(p11.x, p11.y - lift); ctx.lineTo(p01.x, p01.y - lift); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(32,25,18,.35)';
  ctx.lineWidth = Math.max(0.6, zoom);
  ctx.stroke();
  return { p00, p10, p11, p01, lift };
}

function drawRoof(x, y, width, height, elevation, roofHeight, colourA, colourB) {
  const zoom = game.camera.zoom;
  const left = worldToScreen(x - width / 2, y, elevation);
  const right = worldToScreen(x + width / 2, y, elevation);
  const near = worldToScreen(x, y + height / 2, elevation);
  const far = worldToScreen(x, y - height / 2, elevation);
  const ridgeLeft = { x: left.x, y: left.y - roofHeight * zoom };
  const ridgeRight = { x: right.x, y: right.y - roofHeight * zoom };
  ctx.fillStyle = colourA;
  ctx.beginPath();
  ctx.moveTo(far.x, far.y); ctx.lineTo(ridgeLeft.x, ridgeLeft.y); ctx.lineTo(ridgeRight.x, ridgeRight.y); ctx.lineTo(right.x, right.y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colourB;
  ctx.beginPath();
  ctx.moveTo(near.x, near.y); ctx.lineTo(ridgeLeft.x, ridgeLeft.y); ctx.lineTo(ridgeRight.x, ridgeRight.y); ctx.lineTo(right.x, right.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(43,26,13,.45)';
  ctx.lineWidth = 1 * zoom;
  ctx.stroke();
}

function drawConstruction(building) {
  const zoom = game.camera.zoom;
  const point = worldToScreen(building.x, building.y);
  const w = building.width * 24 * zoom;
  const h = building.height * 12 * zoom;
  drawShadow(point.x, point.y + 6 * zoom, w * 0.65, h * 0.45, 0.3);
  ctx.fillStyle = 'rgba(123,101,70,.55)';
  drawDiamond(point.x, point.y, w, h);
  ctx.fill();
  ctx.strokeStyle = '#7e5b35';
  ctx.lineWidth = 2 * zoom;
  const height = (18 + building.progress * 40) * zoom;
  for (const dx of [-w * 0.65, w * 0.65]) {
    ctx.beginPath();
    ctx.moveTo(point.x + dx, point.y); ctx.lineTo(point.x + dx, point.y - height); ctx.stroke();
  }
  for (let level = 0; level < 3; level += 1) {
    const y = point.y - height * level / 2.5;
    ctx.beginPath(); ctx.moveTo(point.x - w * 0.75, y); ctx.lineTo(point.x + w * 0.75, y - 2 * zoom); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(222,184,112,.5)';
  ctx.beginPath();
  ctx.moveTo(point.x - w * 0.65, point.y); ctx.lineTo(point.x + w * 0.65, point.y - height);
  ctx.moveTo(point.x + w * 0.65, point.y); ctx.lineTo(point.x - w * 0.65, point.y - height);
  ctx.stroke();
}
