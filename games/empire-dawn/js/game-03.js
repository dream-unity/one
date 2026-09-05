/* Empire Dawn runtime · part 3 */
class MinHeap {
  constructor() { this.items = []; }
  push(node) {
    const items = this.items;
    items.push(node);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (items[parent].f <= node.f) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = node;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const root = items[0];
    const end = items.pop();
    if (items.length && end) {
      let index = 0;
      items[0] = end;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && items[left].f < items[smallest].f) smallest = left;
        if (right < items.length && items[right].f < items[smallest].f) smallest = right;
        if (smallest === index) break;
        [items[index], items[smallest]] = [items[smallest], items[index]];
        index = smallest;
      }
    }
    return root;
  }
  get length() { return this.items.length; }
}

function nearestWalkableCell(tx, ty, ignoreId = null, maxRadius = 8) {
  tx = clamp(Math.floor(tx), 0, MAP_SIZE - 1);
  ty = clamp(Math.floor(ty), 0, MAP_SIZE - 1);
  if (!isCellBlocked(tx, ty, ignoreId)) return { x: tx, y: ty };
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && !isCellBlocked(x, y, ignoreId)) return { x, y };
      }
    }
  }
  return null;
}

function findPath(startX, startY, goalX, goalY, ignoreId = null) {
  const start = nearestWalkableCell(startX, startY, ignoreId, 2);
  const goal = nearestWalkableCell(goalX, goalY, ignoreId, 8);
  if (!start || !goal) return [];
  if (start.x === goal.x && start.y === goal.y) return [{ x: goal.x + 0.5, y: goal.y + 0.5 }];

  const total = MAP_SIZE * MAP_SIZE;
  const gScore = new Float32Array(total);
  gScore.fill(Infinity);
  const came = new Int32Array(total);
  came.fill(-1);
  const closed = new Uint8Array(total);
  const indexOf = (x, y) => y * MAP_SIZE + x;
  const startIndex = indexOf(start.x, start.y);
  const goalIndex = indexOf(goal.x, goal.y);
  const open = new MinHeap();
  gScore[startIndex] = 0;
  open.push({ x: start.x, y: start.y, f: 0, index: startIndex });
  const directions = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
  ];

  while (open.length) {
    const current = open.pop();
    if (!current || closed[current.index]) continue;
    if (current.index === goalIndex) {
      const path = [];
      let cursor = goalIndex;
      while (cursor !== startIndex && cursor >= 0) {
        const x = cursor % MAP_SIZE;
        const y = Math.floor(cursor / MAP_SIZE);
        path.push({ x: x + 0.5, y: y + 0.5 });
        cursor = came[cursor];
      }
      path.reverse();
      // Remove redundant points on straight segments.
      const simplified = [];
      let previousDirection = null;
      for (let i = 0; i < path.length; i += 1) {
        const previous = i === 0 ? { x: start.x + 0.5, y: start.y + 0.5 } : path[i - 1];
        const direction = { x: Math.sign(path[i].x - previous.x), y: Math.sign(path[i].y - previous.y) };
        if (previousDirection && direction.x === previousDirection.x && direction.y === previousDirection.y) {
          simplified[simplified.length - 1] = path[i];
        } else {
          simplified.push(path[i]);
          previousDirection = direction;
        }
      }
      return simplified;
    }
    closed[current.index] = 1;

    for (const [dx, dy, cost] of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) continue;
      if (isCellBlocked(nx, ny, ignoreId) && !(nx === goal.x && ny === goal.y)) continue;
      if (dx !== 0 && dy !== 0) {
        if (isCellBlocked(current.x + dx, current.y, ignoreId) || isCellBlocked(current.x, current.y + dy, ignoreId)) continue;
      }
      const neighbourIndex = indexOf(nx, ny);
      if (closed[neighbourIndex]) continue;
      const tentative = gScore[current.index] + cost;
      if (tentative >= gScore[neighbourIndex]) continue;
      came[neighbourIndex] = current.index;
      gScore[neighbourIndex] = tentative;
      const heuristic = Math.hypot(goal.x - nx, goal.y - ny);
      open.push({ x: nx, y: ny, index: neighbourIndex, f: tentative + heuristic });
    }
  }
  return [];
}

function entityRadius(entity) {
  if (!entity) return 0;
  if (entity.kind === 'building') return Math.max(entity.width, entity.height) * 0.47;
  if (entity.kind === 'resource') return RESOURCE_TYPES[entity.type].radius;
  if (entity.type === 'scout') return 0.46;
  return 0.28;
}

function approachPoint(unit, target, desiredRange = 0.78) {
  const baseAngle = Math.atan2(unit.y - target.y, unit.x - target.x);
  let best = null;
  let bestScore = Infinity;
  for (let step = 0; step < 32; step += 1) {
    const angle = baseAngle + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * Math.PI / 16;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let distance;
    if (target.kind === 'building') {
      // Intersect the ray with the rectangular footprint, then step outside it.
      const halfWidth = Math.max(0.5, target.width * 0.5);
      const halfHeight = Math.max(0.5, target.height * 0.5);
      const boundary = 1 / Math.max(Math.abs(ux) / halfWidth, Math.abs(uy) / halfHeight);
      distance = boundary + desiredRange;
    } else {
      distance = entityRadius(target) + desiredRange;
    }
    const x = target.x + ux * distance;
    const y = target.y + uy * distance;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const ignoreId = target.kind === 'building' ? null : target.id;
    if (tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE || isCellBlocked(tx, ty, ignoreId)) continue;
    const score = Math.hypot(unit.x - x, unit.y - y);
    if (score < bestScore) { bestScore = score; best = { x, y }; }
  }
  return best || nearestWalkableCell(target.x, target.y, target.kind === 'building' ? null : target.id);
}

function setUnitPath(unit, x, y, ignoreId = null) {
  const path = findPath(unit.x, unit.y, x, y, ignoreId);
  // A* navigates tile centres. Preserve the exact interaction point as the
  // final waypoint so units do not stop on the wrong side of a diagonal tile.
  if (path.length) {
    const exact = { x: clamp(x, 0.05, MAP_SIZE - 0.05), y: clamp(y, 0.05, MAP_SIZE - 0.05) };
    const last = path[path.length - 1];
    if (Math.hypot(last.x - exact.x, last.y - exact.y) > 0.08
      && isTerrainWalkable(exact.x, exact.y)
      && !isCellBlocked(Math.floor(exact.x), Math.floor(exact.y), ignoreId)) {
      path.push(exact);
    }
  }
  unit.path = path;
  unit.pathIndex = 0;
  unit.repath = 0.65 + Math.random() * 0.25;
  return path.length > 0;
}

function orderMove(unit, x, y, aggressive = false) {
  if (!isAlive(unit)) return;
  const goal = nearestWalkableCell(x, y, null, 8);
  if (!goal) return;
  unit.order = { type: 'move', x: goal.x + 0.5, y: goal.y + 0.5, aggressive };
  unit.aggressive = aggressive;
  setUnitPath(unit, goal.x, goal.y);
}

function orderGather(unit, target) {
  if (!isAlive(unit) || unit.type !== 'villager' || !target || target.dead) return;
  const point = approachPoint(unit, target, 0.55);
  unit.order = { type: 'gather', targetId: target.id, resumeTargetId: target.id };
  unit.aggressive = false;
  if (point) setUnitPath(unit, point.x, point.y, target.id);
}

function orderBuild(unit, building) {
  if (!isAlive(unit) || unit.type !== 'villager' || !building || building.dead) return;
  const point = approachPoint(unit, building, 0.42);
  unit.order = { type: building.progress < 1 ? 'build' : 'repair', targetId: building.id };
  unit.aggressive = false;
  if (point) setUnitPath(unit, point.x, point.y, building.id);
}

function orderAttack(unit, target) {
  if (!isAlive(unit) || !target || !isAlive(target) || unit.owner === target.owner) return;
  unit.order = { type: 'attack', targetId: target.id };
  unit.aggressive = true;
  const point = approachPoint(unit, target, Math.max(0.25, unit.range - entityRadius(target) * 0.1));
  if (point) setUnitPath(unit, point.x, point.y, target.id);
}

function orderReturn(unit, dropoff, resumeTargetId = null) {
  if (!dropoff) {
    unit.order = { type: 'idle' };
    unit.path = [];
    return;
  }
  const point = approachPoint(unit, dropoff, 0.45);
  unit.order = { type: 'return', targetId: dropoff.id, resumeTargetId };
  if (point) setUnitPath(unit, point.x, point.y, dropoff.id);
}

function stopUnit(unit) {
  unit.order = { type: 'idle' };
  unit.path = [];
  unit.pathIndex = 0;
  unit.aggressive = false;
}

function suitableDropoff(owner, resourceType) {
  const types = resourceType === 'food' ? ['townCenter', 'granary'] : ['townCenter', 'storagePit'];
  return game.buildings.filter((building) => building.owner === owner && building.progress >= 1 && isAlive(building) && types.includes(building.type));
}

function nearestDropoff(unit, resourceType) {
  return suitableDropoff(unit.owner, resourceType).sort((a, b) => sqrDistance(unit, a) - sqrDistance(unit, b))[0] || null;
}

function nearestResource(x, y, type = null, maxDistance = Infinity) {
  let best = null;
  let bestDistance = maxDistance * maxDistance;
  for (const resource of game.resourcesNodes) {
    if (resource.dead || resource.amount <= 0 || (type && resource.type !== type)) continue;
    const d = (resource.x - x) ** 2 + (resource.y - y) ** 2;
    if (d < bestDistance) { bestDistance = d; best = resource; }
  }
  return best;
}

function resourceTargetData(target) {
  if (!target) return null;
  if (target.kind === 'resource') {
    const spec = RESOURCE_TYPES[target.type];
    return { resourceType: spec.resource, rate: spec.rate, amount: target.amount };
  }
  if (target.kind === 'building' && target.type === 'farm' && target.progress >= 1 && target.foodRemaining > 0) {
    return { resourceType: 'food', rate: 0.84, amount: target.foodRemaining };
  }
  return null;
}

function takeResource(target, amount) {
  if (target.kind === 'resource') {
    const actual = Math.min(amount, target.amount);
    target.amount -= actual;
    if (target.amount <= 0.001) {
      target.amount = 0;
      target.dead = true;
    }
    return actual;
  }
  if (target.kind === 'building' && target.type === 'farm') {
    const actual = Math.min(amount, target.foodRemaining);
    target.foodRemaining -= actual;
    if (target.foodRemaining <= 0.001) {
      target.foodRemaining = 0;
      target.dead = true;
      spawnParticles(target.x, target.y, '#8e6d38', 12, 0.5);
    }
    return actual;
  }
  return 0;
}

function populationUsed(owner) {
  return game.units.filter((unit) => unit.owner === owner && isAlive(unit)).reduce((total, unit) => total + (UNIT_TYPES[unit.type].pop || 1), 0);
}
function populationQueued(owner) {
  return game.buildings.filter((building) => building.owner === owner && isAlive(building)).reduce((total, building) => {
    return total + building.queue.reduce((sum, item) => sum + (UNIT_TYPES[item.type].pop || 1), 0);
  }, 0);
}
function populationCap(owner) {
  return game.buildings.filter((building) => building.owner === owner && isAlive(building) && building.progress >= 1)
    .reduce((total, building) => total + (BUILDING_TYPES[building.type].popCap || 0), 0);
}

function canTrain(owner, unitType) {
  const player = getPlayer(owner);
  const spec = UNIT_TYPES[unitType];
  if ((spec.requiredAge || 0) > player.age) return { ok: false, reason: `First reach ${getAgeName(spec.requiredAge)}` };
  if (!hasCost(player, spec.cost)) return { ok: false, reason: 'You need more food, wood, stone or gold' };
  const used = populationUsed(owner) + populationQueued(owner);
  if (used + (spec.pop || 1) > populationCap(owner)) return { ok: false, reason: 'Build another House to make room' };
  return { ok: true };
}

function queueUnit(building, unitType) {
  if (!building || building.owner !== PLAYER || building.progress < 1) return;
  const check = canTrain(building.owner, unitType);
  if (!check.ok) { notify(check.reason, 'bad'); sound('warning', 0.6); return; }
  spendCost(getPlayer(building.owner), UNIT_TYPES[unitType].cost);
  building.queue.push({ type: unitType, progress: 0, duration: UNIT_TYPES[unitType].trainTime });
  sound('train');
  updateUI(true);
}

function findSpawnPoint(building) {
  for (let radius = Math.ceil(Math.max(building.width, building.height) / 2) + 1; radius < 8; radius += 1) {
    for (let step = 0; step < 24; step += 1) {
      const angle = step / 24 * Math.PI * 2;
      const x = Math.floor(building.x + Math.cos(angle) * radius);
      const y = Math.floor(building.y + Math.sin(angle) * radius);
      if (x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && !isCellBlocked(x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  return { x: building.x + 1, y: building.y + 1 };
}

function queueResearch(building, technologyId) {
  const tech = TECHNOLOGIES[technologyId];
  if (!building || building.owner !== PLAYER || !tech || building.type !== tech.building) return;
  const player = getPlayer(PLAYER);
  if (player.researched.includes(technologyId)) { notify('You already have this skill.', 'bad'); return; }
  if (building.research) { notify('This building is learning a skill. Wait for it to finish.', 'bad'); return; }
  if (player.age < tech.requiredAge) { notify(`First reach ${getAgeName(tech.requiredAge)}.`, 'bad'); return; }
  if (!hasCost(player, tech.cost)) { notify('You need more food, wood, stone or gold.', 'bad'); return; }
  spendCost(player, tech.cost);
  building.research = { kind: 'tech', id: technologyId, progress: 0, duration: tech.duration };
  sound('train');
  updateUI(true);
}

function queueAgeUp(building, targetAge) {
  const player = getPlayer(PLAYER);
  const costs = targetAge === 1 ? { food: 500 } : { food: 800, gold: 200 };
  const duration = targetAge === 1 ? 34 : 48;
  if (!building || building.type !== 'townCenter' || building.owner !== PLAYER) return;
  if (player.age >= targetAge) { notify(`You have already reached the ${getAgeName(targetAge)}.`, 'bad'); return; }
  if (targetAge !== player.age + 1) { notify('Finish this age before you start the next one.', 'bad'); return; }
  if (building.research) { notify('The Main house is learning a skill. Wait for it to finish.', 'bad'); return; }
  if (!hasCost(player, costs)) { notify('Bring back more food or gold first.', 'bad'); sound('warning', 0.6); return; }
  spendCost(player, costs);
  building.research = { kind: 'age', targetAge, progress: 0, duration };
  notify(`Learning about the ${getAgeName(targetAge)}…`, 'good');
  sound('age', 0.7);
  updateUI(true);
}

function applyTechnology(owner, techId) {
  const player = getPlayer(owner);
  if (player.researched.includes(techId)) return;
  player.researched.push(techId);
  if (techId === 'toolworking') player.upgrades.attack += 2;
  if (techId === 'leatherArmour') player.upgrades.armour += 1;
  if (techId === 'wheel') player.upgrades.gather += 0.18;
  if (techId === 'architecture') {
    player.upgrades.architecture += 0.2;
    game.buildings.filter((building) => building.owner === owner && isAlive(building)).forEach((building) => {
      const previousMax = building.maxHp;
      building.maxHp = buildingMaxHealth(owner, building.type);
      building.hp += building.maxHp - previousMax;
    });
  }
  if (owner === PLAYER) notify(`${TECHNOLOGIES[techId].name} is ready.`, 'good');
  sound('age', 0.7);
}
