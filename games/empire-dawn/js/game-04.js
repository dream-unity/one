/* Empire Dawn runtime · part 4 */
function canPlaceBuilding(type, x, y, owner = PLAYER) {
  const spec = BUILDING_TYPES[type];
  if (!spec) return { ok: false, reason: 'Unknown building' };
  if ((spec.requiredAge || 0) > getPlayer(owner).age) return { ok: false, reason: `Requires ${getAgeName(spec.requiredAge)}` };
  const minX = Math.floor(x - spec.width / 2);
  const maxX = Math.ceil(x + spec.width / 2) - 1;
  const minY = Math.floor(y - spec.height / 2);
  const maxY = Math.ceil(y + spec.height / 2) - 1;
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      if (tx < 3 || ty < 3 || tx >= MAP_SIZE - 3 || ty >= MAP_SIZE - 3) return { ok: false, reason: 'Too close to the map edge' };
      if (!isTerrainWalkable(tx + 0.5, ty + 0.5)) return { ok: false, reason: 'Cannot build on water' };
      if (game.buildings.some((building) => isAlive(building) && buildingContainsTile(building, tx, ty, 0.35))) return { ok: false, reason: 'Another building is in the way' };
      if (game.resourcesNodes.some((resource) => !resource.dead && Math.floor(resource.x) === tx && Math.floor(resource.y) === ty)) return { ok: false, reason: 'Clear the resources first' };
    }
  }
  return { ok: true };
}

function beginPlacement(type) {
  const spec = BUILDING_TYPES[type];
  if (!spec) return;
  const player = getPlayer(PLAYER);
  if ((spec.requiredAge || 0) > player.age) { notify(`Requires ${getAgeName(spec.requiredAge)}.`, 'bad'); return; }
  runtime.placement = { type };
  runtime.targeting = null;
  DOM.placementHint.textContent = `Place ${spec.name} · Left-click to confirm · Right-click or Esc to cancel`;
  DOM.placementHint.classList.remove('hidden');
  canvas.style.cursor = 'crosshair';
}

function cancelCommandMode() {
  runtime.placement = null;
  runtime.targeting = null;
  DOM.placementHint.classList.add('hidden');
  canvas.style.cursor = 'default';
}

function placeBuilding(type, x, y) {
  const spec = BUILDING_TYPES[type];
  const player = getPlayer(PLAYER);
  const snappedX = Math.floor(x) + (spec.width % 2 ? 0.5 : 0);
  const snappedY = Math.floor(y) + (spec.height % 2 ? 0.5 : 0);
  const placement = canPlaceBuilding(type, snappedX, snappedY, PLAYER);
  if (!placement.ok) { notify(placement.reason, 'bad'); sound('warning', 0.45); return false; }
  if (!hasCost(player, spec.cost)) { notify('Insufficient resources.', 'bad'); sound('warning', 0.5); return false; }
  const builders = selectedUnits().filter((unit) => unit.type === 'villager');
  if (!builders.length) { notify('Select at least one Villager.', 'bad'); return false; }
  spendCost(player, spec.cost);
  const building = createBuilding(PLAYER, type, snappedX, snappedY, { complete: false });
  builders.forEach((unit) => orderBuild(unit, building));
  runtime.selected = [building.id];
  runtime.commandMode = 'default';
  cancelCommandMode();
  notify(`${spec.name} foundation placed.`, 'good');
  sound('build');
  updateUI(true);
  return true;
}

function selectedEntities() { return runtime.selected.map(getEntity).filter(isAlive); }
function selectedUnits() { return selectedEntities().filter((entity) => entity.kind === 'unit' && entity.owner === PLAYER); }
function selectedBuildings() { return selectedEntities().filter((entity) => entity.kind === 'building' && entity.owner === PLAYER); }

function updateCamera(dt) {
  if (!game || !runtime.started) return;
  const baseSpeed = 610 / game.camera.zoom;
  let dx = 0;
  let dy = 0;
  if (runtime.keys.has('w') || runtime.keys.has('arrowup')) dy -= 1;
  if (runtime.keys.has('s') || runtime.keys.has('arrowdown')) dy += 1;
  if (runtime.keys.has('a') || runtime.keys.has('arrowleft')) dx -= 1;
  if (runtime.keys.has('d') || runtime.keys.has('arrowright')) dx += 1;
  if (!runtime.mouse.down && !runtime.placement && !runtime.targeting) {
    dx += runtime.mouse.edgeX;
    dy += runtime.mouse.edgeY;
  }
  if (dx || dy) {
    const length = Math.hypot(dx, dy) || 1;
    game.camera.x += dx / length * baseSpeed * dt;
    game.camera.y += dy / length * baseSpeed * dt;
    game.camera.targetX = null;
    game.camera.targetY = null;
  }
  if (game.camera.targetX != null && game.camera.targetY != null) {
    const t = 1 - Math.exp(-7 * dt);
    game.camera.x = lerp(game.camera.x, game.camera.targetX, t);
    game.camera.y = lerp(game.camera.y, game.camera.targetY, t);
    if (Math.hypot(game.camera.x - game.camera.targetX, game.camera.y - game.camera.targetY) < 1) {
      game.camera.targetX = null;
      game.camera.targetY = null;
    }
  }
  const bounds = worldToIso(MAP_SIZE / 2, MAP_SIZE / 2);
  const extent = MAP_SIZE * TILE_W / 2;
  game.camera.x = clamp(game.camera.x, bounds.x - extent * 0.88, bounds.x + extent * 0.88);
  game.camera.y = clamp(game.camera.y, 0, MAP_SIZE * TILE_H * 0.98);
}

function unitEffectiveAttack(unit) { return unit.attack + (getPlayer(unit.owner).upgrades.attack || 0); }
function unitEffectiveArmour(unit) { return unit.armour + (getPlayer(unit.owner).upgrades.armour || 0); }

function moveUnit(unit, dt) {
  if (!unit.path?.length || unit.pathIndex >= unit.path.length) return false;
  const waypoint = unit.path[unit.pathIndex];
  const dx = waypoint.x - unit.x;
  const dy = waypoint.y - unit.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.08) {
    unit.pathIndex += 1;
    if (unit.pathIndex >= unit.path.length) { unit.path = []; unit.pathIndex = 0; return false; }
    return true;
  }
  const separation = getSeparation(unit);
  const speed = unit.speed * (unit.type === 'villager' && unit.carryingAmount > 0 ? 0.93 : 1);
  const step = Math.min(dist, speed * dt);
  const nx = unit.x + dx / dist * step + separation.x * dt;
  const ny = unit.y + dy / dist * step + separation.y * dt;
  if (isTerrainWalkable(nx, ny)) {
    unit.x = nx;
    unit.y = ny;
  }
  unit.facing = dx >= 0 ? 1 : -1;
  unit.anim += dt * speed * 6;
  return true;
}

function getSeparation(unit) {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (const other of game.units) {
    if (other === unit || other.dead || other.owner !== unit.owner) continue;
    const dx = unit.x - other.x;
    const dy = unit.y - other.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0.0001 && d2 < 0.36) {
      const d = Math.sqrt(d2);
      sx += dx / d * (0.6 - d) * 1.8;
      sy += dy / d * (0.6 - d) * 1.8;
      count += 1;
    }
  }
  return count ? { x: sx / count, y: sy / count } : { x: 0, y: 0 };
}

function distanceToEntityEdge(unit, target) {
  if (target.kind === 'building') {
    const dx = Math.max(0, Math.abs(unit.x - target.x) - target.width * 0.5);
    const dy = Math.max(0, Math.abs(unit.y - target.y) - target.height * 0.5);
    return Math.hypot(dx, dy);
  }
  return Math.max(0, Math.hypot(unit.x - target.x, unit.y - target.y) - entityRadius(target));
}

function withinInteractionRange(unit, target, extra = 0.65) {
  return distanceToEntityEdge(unit, target) <= extra;
}

function acquireEnemy(unit, radius) {
  let best = null;
  let bestDistance = radius * radius;
  for (const target of [...game.units, ...game.buildings]) {
    if (!isAlive(target) || target.owner === unit.owner || target.owner === NEUTRAL) continue;
    const d = sqrDistance(unit, target);
    if (d < bestDistance) { bestDistance = d; best = target; }
  }
  return best;
}

function updateUnit(unit, dt) {
  if (!isAlive(unit)) return;
  unit.cooldown = Math.max(0, unit.cooldown - dt);
  unit.repath = Math.max(0, (unit.repath || 0) - dt);
  unit.recentDamage = Math.max(0, (unit.recentDamage || 0) - dt);
  unit.selectedPulse += dt;

  if (unit.order.type === 'idle') {
    unit.anim += dt * 0.8;
    if (unit.type !== 'villager') {
      const target = acquireEnemy(unit, unit.owner === ENEMY ? 7 : 3.2);
      if (target) orderAttack(unit, target);
    }
    return;
  }

  if (unit.order.type === 'move') {
    const moving = moveUnit(unit, dt);
    if (unit.order.aggressive) {
      const target = acquireEnemy(unit, 3.8);
      if (target) { orderAttack(unit, target); return; }
    }
    if (!moving && unit.path.length === 0) stopUnit(unit);
    return;
  }

  const target = getEntity(unit.order.targetId);
  if (!target || target.dead || (target.hp != null && target.hp <= 0)) {
    if (unit.order.type === 'gather' && unit.carryingAmount > 0 && unit.carryingType) {
      orderReturn(unit, nearestDropoff(unit, unit.carryingType), null);
    } else {
      stopUnit(unit);
    }
    return;
  }

  if (unit.order.type === 'gather') {
    const data = resourceTargetData(target);
    if (!data) { stopUnit(unit); return; }
    if (!withinInteractionRange(unit, target, 0.72)) {
      if (!unit.path.length || unit.repath <= 0) {
        const point = approachPoint(unit, target, 0.55);
        if (point) setUnitPath(unit, point.x, point.y, target.id);
      }
      moveUnit(unit, dt);
      return;
    }
    unit.path = [];
    unit.anim += dt * 5;
    unit.workPulse += dt;
    const civBonus = unit.owner === PLAYER ? CIVILISATIONS[game.civilisation].gatherMultiplier : (game.difficulty === 'hard' && unit.owner === ENEMY ? 1.15 : 1);
    const wheelBonus = 1 + (getPlayer(unit.owner).upgrades.gather || 0);
    const carryCap = UNIT_TYPES.villager.carry * wheelBonus;
    const amount = Math.min(carryCap - unit.carryingAmount, data.rate * civBonus * wheelBonus * dt);
    const taken = takeResource(target, amount);
    unit.carryingType = data.resourceType;
    unit.carryingAmount += taken;
    if (unit.carryingAmount >= carryCap - 0.02 || target.dead || taken <= 0) {
      const dropoff = nearestDropoff(unit, unit.carryingType);
      orderReturn(unit, dropoff, target.dead ? null : target.id);
    }
    return;
  }

  if (unit.order.type === 'return') {
    if (!withinInteractionRange(unit, target, 0.82)) {
      if (!unit.path.length || unit.repath <= 0) {
        const point = approachPoint(unit, target, 0.55);
        if (point) setUnitPath(unit, point.x, point.y, target.id);
      }
      moveUnit(unit, dt);
      return;
    }
    const player = getPlayer(unit.owner);
    if (unit.carryingType && unit.carryingAmount > 0) {
      player.resources[unit.carryingType] += unit.carryingAmount;
      player.stats.gathered += unit.carryingAmount;
      spawnFloatingText(unit.x, unit.y, `+${Math.floor(unit.carryingAmount)}`, resourceColour(unit.carryingType));
      unit.carryingAmount = 0;
      unit.carryingType = null;
      sound('click', 0.25);
    }
    const resume = getEntity(unit.order.resumeTargetId);
    if (resume && !resume.dead && resourceTargetData(resume)) orderGather(unit, resume);
    else stopUnit(unit);
    return;
  }

  if (unit.order.type === 'build' || unit.order.type === 'repair') {
    if (target.kind !== 'building' || target.owner !== unit.owner) { stopUnit(unit); return; }
    if (!withinInteractionRange(unit, target, 0.75)) {
      if (!unit.path.length || unit.repath <= 0) {
        const point = approachPoint(unit, target, 0.45);
        if (point) setUnitPath(unit, point.x, point.y, target.id);
      }
      moveUnit(unit, dt);
      return;
    }
    unit.path = [];
    unit.anim += dt * 5;
    if (target.progress < 1) {
      const spec = BUILDING_TYPES[target.type];
      const buildRate = 1 / Math.max(4, spec.buildTime);
      target.progress = Math.min(1, target.progress + buildRate * dt);
      target.hp = Math.max(target.hp, target.maxHp * target.progress);
      if (target.progress >= 1) {
        target.hp = target.maxHp;
        getPlayer(target.owner).stats.buildingsBuilt += 1;
        notify(`${spec.name} completed.`, 'good');
        sound('build');
        stopUnit(unit);
      }
    } else if (target.hp < target.maxHp) {
      target.hp = Math.min(target.maxHp, target.hp + 14 * dt);
      if (target.hp >= target.maxHp - 0.1) stopUnit(unit);
    } else stopUnit(unit);
    return;
  }

  if (unit.order.type === 'attack') {
    if (target.owner === unit.owner) { stopUnit(unit); return; }
    const attackRange = unit.range + entityRadius(target);
    const dist = Math.hypot(unit.x - target.x, unit.y - target.y);
    if (dist > attackRange) {
      if (!unit.path.length || unit.repath <= 0) {
        const point = approachPoint(unit, target, Math.max(0.22, unit.range - 0.08));
        if (point) setUnitPath(unit, point.x, point.y, target.id);
      }
      moveUnit(unit, dt);
      return;
    }
    unit.path = [];
    unit.facing = target.x >= unit.x ? 1 : -1;
    unit.anim += dt * 4;
    if (unit.cooldown <= 0) {
      const damage = unitEffectiveAttack(unit);
      if (unit.type === 'archer') {
        game.projectiles.push({
          id: nextId('p'), owner: unit.owner, x: unit.x, y: unit.y, z: 0.9,
          targetId: target.id, damage, speed: 10.5, life: 2.5, type: 'arrow',
        });
      } else {
        applyDamage(target, damage, unit);
        spawnParticles(target.x, target.y, target.kind === 'building' ? '#9b7a50' : '#d9b28c', 5, 0.3);
      }
      unit.cooldown = unit.cooldown === 0 ? UNIT_TYPES[unit.type].cooldown : unit.cooldown;
      unit.cooldown = UNIT_TYPES[unit.type].cooldown;
      sound('combat', 0.55);
    }
  }
}

function updateBuilding(building, dt) {
  if (!isAlive(building)) return;
  building.recentDamage = Math.max(0, (building.recentDamage || 0) - dt);
  if (building.progress < 1) return;

  if (building.queue.length) {
    const item = building.queue[0];
    item.progress += dt;
    if (item.progress >= item.duration) {
      const spawn = findSpawnPoint(building);
      const unit = createUnit(building.owner, item.type, spawn.x, spawn.y);
      building.queue.shift();
      if (building.rally) orderMove(unit, building.rally.x, building.rally.y);
      if (building.owner === PLAYER) notify(`${UNIT_TYPES[item.type].name} ready.`, 'good');
      sound('train');
    }
  }

  if (building.research) {
    building.research.progress += dt;
    if (building.research.progress >= building.research.duration) {
      if (building.research.kind === 'age') {
        const player = getPlayer(building.owner);
        player.age = building.research.targetAge;
        if (building.owner === PLAYER) notify(`You have advanced to the ${getAgeName(player.age)}!`, 'good');
        sound('age');
      } else if (building.research.kind === 'tech') {
        applyTechnology(building.owner, building.research.id);
      }
      building.research = null;
    }
  }

  if (building.type === 'watchTower') {
    building.towerCooldown = Math.max(0, building.towerCooldown - dt);
    if (building.towerCooldown <= 0) {
      let best = null;
      let bestDistance = (BUILDING_TYPES.watchTower.range || 6) ** 2;
      for (const unit of game.units) {
        if (!isAlive(unit) || unit.owner === building.owner) continue;
        const d = sqrDistance(building, unit);
        if (d < bestDistance) { best = unit; bestDistance = d; }
      }
      if (best) {
        game.projectiles.push({
          id: nextId('p'), owner: building.owner, x: building.x, y: building.y, z: 2.9,
          targetId: best.id, damage: BUILDING_TYPES.watchTower.attack, speed: 12, life: 2.2, type: 'arrow',
        });
        building.towerCooldown = BUILDING_TYPES.watchTower.cooldown;
        sound('combat', 0.4);
      }
    }
  }
}

function applyDamage(target, rawDamage, attacker = null) {
  if (!target || !isAlive(target)) return;
  const armour = target.kind === 'unit' ? unitEffectiveArmour(target) : (target.armour || 0);
  const damage = Math.max(1, rawDamage - armour);
  target.hp -= damage;
  target.recentDamage = 2.2;
  spawnFloatingText(target.x, target.y, `-${Math.round(damage)}`, '#e27358');
  if (target.hp <= 0) destroyEntity(target, attacker);
}

function destroyEntity(entity, attacker = null) {
  if (!entity || entity.dead) return;
  entity.hp = 0;
  entity.dead = true;
  entity.path = [];
  spawnParticles(entity.x, entity.y, entity.kind === 'building' ? '#c88a4c' : '#b04d3a', entity.kind === 'building' ? 28 : 12, entity.kind === 'building' ? 1.2 : 0.55);
  game.decals.push({ x: entity.x, y: entity.y, size: entity.kind === 'building' ? 1.6 : 0.45, life: entity.kind === 'building' ? 1000 : 35, maxLife: entity.kind === 'building' ? 1000 : 35 });

  if (entity.kind === 'unit') getPlayer(entity.owner).stats.unitsLost += 1;
  if (entity.kind === 'building') getPlayer(entity.owner).stats.buildingsLost += 1;
  if (attacker && attacker.owner !== entity.owner) {
    if (entity.kind === 'unit') getPlayer(attacker.owner).stats.enemyUnitsDefeated += 1;
    if (entity.kind === 'building') getPlayer(attacker.owner).stats.enemyBuildingsDestroyed += 1;
  }

  runtime.selected = runtime.selected.filter((id) => id !== entity.id);
  if (entity.kind === 'building' && entity.type === 'townCenter') {
    if (entity.owner === ENEMY) endGame(true);
    if (entity.owner === PLAYER) endGame(false);
  }
}

function updateProjectiles(dt) {
  for (const projectile of game.projectiles) {
    projectile.life -= dt;
    const target = getEntity(projectile.targetId);
    if (!target || !isAlive(target) || projectile.life <= 0) { projectile.dead = true; continue; }
    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.22 + entityRadius(target)) {
      applyDamage(target, projectile.damage, { owner: projectile.owner });
      spawnParticles(target.x, target.y, '#dfc28e', 4, 0.22);
      projectile.dead = true;
      continue;
    }
    const step = Math.min(dist, projectile.speed * dt);
    projectile.x += dx / dist * step;
    projectile.y += dy / dist * step;
    projectile.z = Math.max(0.25, projectile.z + Math.sin((2.5 - projectile.life) * Math.PI) * 0.012);
  }
  game.projectiles = game.projectiles.filter((projectile) => !projectile.dead);
}

function spawnParticles(x, y, colour, count = 8, spread = 0.4) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.25 + Math.random() * 1.2) * spread;
    game.particles.push({
      type: 'debris', x, y, z: 0.2 + Math.random() * 0.9,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, vz: 0.8 + Math.random() * 1.8,
      life: 0.45 + Math.random() * 0.7, maxLife: 1.1, colour, size: 1.5 + Math.random() * 2.5,
    });
  }
}

function spawnFloatingText(x, y, text, colour) {
  game.particles.push({ type: 'text', x, y, z: 1.2, vx: 0, vy: 0, vz: 0.35, life: 1.1, maxLife: 1.1, colour, text });
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    if (particle.type === 'debris') particle.vz -= 3.4 * dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
  for (const decal of game.decals) decal.life -= dt;
  game.decals = game.decals.filter((decal) => decal.life > 0);
}
