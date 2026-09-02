/* Empire Dawn runtime · part 6 */
function drawBuilding(building, time) {
  if (!entityVisible(building)) return;
  const zoom = game.camera.zoom;
  if (runtime.selected.includes(building.id)) drawSelectionRing(building, building.owner === PLAYER ? '#72c2ff' : '#ff8571');
  if (building.progress < 1) { drawConstruction(building); drawHealthBar(building); return; }

  const team = ownerColour(building.owner);
  const stone = { top: '#a69b82', left: '#766b58', right: '#8a7d65' };
  const timber = { top: '#a88a5d', left: '#6a4d30', right: '#825e3b' };
  const plaster = { top: '#d1c3a2', left: '#91836a', right: '#ac9c80' };
  const point = worldToScreen(building.x, building.y);
  drawShadow(point.x, point.y + 8 * zoom, building.width * 27 * zoom, building.height * 12 * zoom, 0.32);

  if (building.type === 'farm') {
    const corners = [
      worldToScreen(building.x - building.width / 2, building.y - building.height / 2),
      worldToScreen(building.x + building.width / 2, building.y - building.height / 2),
      worldToScreen(building.x + building.width / 2, building.y + building.height / 2),
      worldToScreen(building.x - building.width / 2, building.y + building.height / 2),
    ];
    ctx.fillStyle = '#8b6a38';
    ctx.beginPath(); corners.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
    const rows = 7;
    ctx.strokeStyle = '#d0a84f';
    ctx.lineWidth = 2 * zoom;
    for (let row = 1; row < rows; row += 1) {
      const t = row / rows;
      const a = { x: lerp(corners[0].x, corners[3].x, t), y: lerp(corners[0].y, corners[3].y, t) };
      const b = { x: lerp(corners[1].x, corners[2].x, t), y: lerp(corners[1].y, corners[2].y, t) };
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  } else if (building.type === 'townCenter') {
    drawIsoPrism(building.x, building.y, 2.7, 2.5, 1.1, stone);
    drawIsoPrism(building.x, building.y - 0.05, 2.15, 1.85, 1.95, plaster);
    drawRoof(building.x, building.y - 0.05, 2.55, 2.15, 1.95, 27, '#6f4424', '#915a2e');
    drawIsoPrism(building.x - 0.65, building.y + 0.35, 0.55, 0.5, 2.35, stone);
    drawIsoPrism(building.x + 0.65, building.y - 0.35, 0.55, 0.5, 2.35, stone);
    drawBanner(point.x + 2 * zoom, point.y - 75 * zoom, team, time);
    ctx.fillStyle = '#3a2517';
    ctx.fillRect(point.x - 7 * zoom, point.y - 40 * zoom, 14 * zoom, 20 * zoom);
  } else if (building.type === 'house') {
    drawIsoPrism(building.x, building.y, 1.75, 1.6, 1.2, plaster);
    drawRoof(building.x, building.y, 2.05, 1.9, 1.2, 23, '#6d3f23', '#8f582e');
    ctx.fillStyle = '#3a2517'; ctx.fillRect(point.x - 5 * zoom, point.y - 21 * zoom, 10 * zoom, 16 * zoom);
  } else if (building.type === 'granary') {
    drawIsoPrism(building.x, building.y, 1.65, 1.55, 1.45, timber);
    drawRoof(building.x, building.y, 1.95, 1.85, 1.45, 19, '#b18b47', '#87642f');
    ctx.strokeStyle = '#d9bf75'; ctx.lineWidth = 2 * zoom;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath(); ctx.moveTo(point.x + i * 7 * zoom, point.y - 35 * zoom); ctx.lineTo(point.x + i * 7 * zoom, point.y - 8 * zoom); ctx.stroke();
    }
  } else if (building.type === 'storagePit') {
    drawIsoPrism(building.x, building.y, 1.7, 1.5, 0.65, timber);
    ctx.fillStyle = '#5a3c23';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath(); ctx.arc(point.x + (i - 2) * 8 * zoom, point.y - (8 + (i % 2) * 5) * zoom, 5 * zoom, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#a98756'; ctx.lineWidth = 2 * zoom;
    ctx.beginPath(); ctx.moveTo(point.x - 28 * zoom, point.y - 25 * zoom); ctx.lineTo(point.x + 25 * zoom, point.y - 44 * zoom); ctx.stroke();
  } else if (building.type === 'barracks') {
    drawIsoPrism(building.x, building.y, 2.65, 1.65, 1.25, stone);
    drawRoof(building.x, building.y, 2.95, 1.95, 1.25, 24, '#61351f', '#884328');
    ctx.strokeStyle = team; ctx.lineWidth = 4 * zoom;
    ctx.beginPath(); ctx.moveTo(point.x - 22 * zoom, point.y - 35 * zoom); ctx.lineTo(point.x - 22 * zoom, point.y - 6 * zoom); ctx.stroke();
  } else if (building.type === 'archeryRange') {
    drawIsoPrism(building.x, building.y, 2.55, 1.6, 1.0, timber);
    drawRoof(building.x, building.y, 2.85, 1.9, 1.0, 18, '#80613a', '#a07a44');
    ctx.strokeStyle = '#e0c58b'; ctx.lineWidth = 2 * zoom;
    ctx.beginPath(); ctx.arc(point.x + 11 * zoom, point.y - 27 * zoom, 12 * zoom, -1.2, 1.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(point.x + 16 * zoom, point.y - 38 * zoom); ctx.lineTo(point.x + 6 * zoom, point.y - 17 * zoom); ctx.stroke();
  } else if (building.type === 'stable') {
    drawIsoPrism(building.x, building.y, 2.75, 1.65, 1.0, timber);
    drawRoof(building.x, building.y, 3.05, 1.95, 1.0, 22, '#66422b', '#875a35');
    ctx.strokeStyle = '#302117'; ctx.lineWidth = 4 * zoom;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath(); ctx.moveTo(point.x + i * 18 * zoom, point.y - 29 * zoom); ctx.lineTo(point.x + i * 18 * zoom, point.y - 5 * zoom); ctx.stroke();
    }
  } else if (building.type === 'watchTower') {
    drawIsoPrism(building.x, building.y, 0.85, 0.85, 3.0, stone);
    drawIsoPrism(building.x, building.y, 1.2, 1.2, 3.25, timber);
    drawRoof(building.x, building.y, 1.45, 1.45, 3.25, 17, '#5e3623', '#80472b');
    drawBanner(point.x + 2 * zoom, point.y - 99 * zoom, team, time);
  }

  if (building.owner !== NEUTRAL && building.type !== 'farm') {
    ctx.fillStyle = team;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(point.x - 4 * zoom, point.y - 7 * zoom, 8 * zoom, 3 * zoom);
    ctx.globalAlpha = 1;
  }
  if (building.recentDamage > 0 || runtime.selected.includes(building.id)) drawHealthBar(building);
}

function drawBanner(x, y, colour, time) {
  const zoom = game.camera.zoom;
  ctx.strokeStyle = '#2f2418';
  ctx.lineWidth = 2 * zoom;
  ctx.beginPath(); ctx.moveTo(x, y + 28 * zoom); ctx.lineTo(x, y); ctx.stroke();
  const wave = Math.sin(time * 2.2 + x * 0.01) * 2 * zoom;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y + 2 * zoom);
  ctx.lineTo(x + 18 * zoom + wave, y + 6 * zoom);
  ctx.lineTo(x + 13 * zoom - wave, y + 18 * zoom);
  ctx.lineTo(x, y + 15 * zoom);
  ctx.closePath();
  ctx.fill();
}

function drawSelectionRing(entity, colour) {
  const point = worldToScreen(entity.x, entity.y);
  const zoom = game.camera.zoom;
  const radius = entity.kind === 'building' ? Math.max(entity.width, entity.height) * 20 * zoom : (entity.type === 'scout' ? 15 : 10) * zoom;
  ctx.save();
  ctx.translate(point.x, point.y + 2 * zoom);
  ctx.scale(1, 0.45);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2 / 0.45;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHealthBar(entity) {
  if (entity.hp == null || entity.maxHp == null) return;
  const zoom = game.camera.zoom;
  const point = worldToScreen(entity.x, entity.y, entity.kind === 'building' ? Math.max(1.2, (BUILDING_TYPES[entity.type].width || 1) * 0.4) : 1.15);
  const width = (entity.kind === 'building' ? 42 : 26) * zoom;
  const height = 4 * zoom;
  const ratio = clamp(entity.hp / entity.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.72)';
  ctx.fillRect(point.x - width / 2 - 1, point.y - height / 2 - 1, width + 2, height + 2);
  ctx.fillStyle = ratio > 0.55 ? '#63a25a' : ratio > 0.25 ? '#d2a445' : '#c44f3e';
  ctx.fillRect(point.x - width / 2, point.y - height / 2, width * ratio, height);
}

function drawUnit(unit, time) {
  if (!entityVisible(unit)) return;
  const zoom = game.camera.zoom;
  const point = worldToScreen(unit.x, unit.y);
  const moving = unit.path?.length > 0;
  const bob = moving ? Math.abs(Math.sin(unit.anim)) * 2.2 * zoom : Math.sin(time * 1.5 + unit.anim) * 0.45 * zoom;
  const team = ownerColour(unit.owner);
  const selected = runtime.selected.includes(unit.id);
  if (selected) drawSelectionRing(unit, unit.owner === PLAYER ? '#7ed0ff' : '#ff826c');
  drawShadow(point.x, point.y + 3 * zoom, (unit.type === 'scout' ? 17 : 10) * zoom, (unit.type === 'scout' ? 5 : 3.5) * zoom, 0.3);

  ctx.save();
  ctx.translate(point.x, point.y - bob);
  ctx.scale(unit.facing, 1);

  if (unit.type === 'scout') {
    ctx.fillStyle = unit.owner === PLAYER ? '#8b6945' : '#704738';
    ctx.beginPath(); ctx.ellipse(0, -7 * zoom, 17 * zoom, 7 * zoom, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b3b29';
    ctx.beginPath(); ctx.arc(15 * zoom, -11 * zoom, 5 * zoom, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a2f20'; ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(-10 * zoom, -3 * zoom); ctx.lineTo(-12 * zoom, 6 * zoom);
    ctx.moveTo(9 * zoom, -2 * zoom); ctx.lineTo(12 * zoom, 6 * zoom);
    ctx.stroke();
    drawHumanoid(0, -14 * zoom, team, '#7d5b3b', unit, zoom, true);
  } else {
    drawHumanoid(0, 0, team, unit.type === 'villager' ? '#9d7952' : '#6d6559', unit, zoom, false);
  }
  ctx.restore();

  if (unit.carryingAmount > 0 && unit.carryingType) {
    ctx.fillStyle = resourceColour(unit.carryingType);
    ctx.beginPath();
    ctx.arc(point.x - 9 * zoom, point.y - 17 * zoom - bob, 4 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  if (unit.recentDamage > 0 || selected) drawHealthBar(unit);
}

function drawHumanoid(x, y, team, cloth, unit, zoom, mounted) {
  const baseY = mounted ? y : y - 4 * zoom;
  const attackSwing = unit.order.type === 'attack' && unit.cooldown > UNIT_TYPES[unit.type].cooldown * 0.55 ? -0.8 : 0.2;
  const stride = unit.path?.length ? Math.sin(unit.anim) * 3 * zoom : 0;
  ctx.strokeStyle = '#3f2b20';
  ctx.lineWidth = 2.3 * zoom;
  ctx.lineCap = 'round';
  if (!mounted) {
    ctx.beginPath();
    ctx.moveTo(x - 2 * zoom, baseY + 8 * zoom); ctx.lineTo(x - 4 * zoom + stride, baseY + 17 * zoom);
    ctx.moveTo(x + 2 * zoom, baseY + 8 * zoom); ctx.lineTo(x + 4 * zoom - stride, baseY + 17 * zoom);
    ctx.stroke();
  }
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(x - 6 * zoom, baseY - 6 * zoom);
  ctx.lineTo(x + 6 * zoom, baseY - 6 * zoom);
  ctx.lineTo(x + 5 * zoom, baseY + 9 * zoom);
  ctx.lineTo(x - 5 * zoom, baseY + 9 * zoom);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = team;
  ctx.fillRect(x - 6 * zoom, baseY + 1 * zoom, 12 * zoom, 4 * zoom);
  ctx.fillStyle = '#d3aa7b';
  ctx.beginPath(); ctx.arc(x, baseY - 10 * zoom, 4.5 * zoom, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = unit.type === 'archer' ? '#59422d' : '#6e5a44';
  ctx.beginPath();
  ctx.moveTo(x - 5 * zoom, baseY - 12 * zoom); ctx.lineTo(x + 5 * zoom, baseY - 12 * zoom); ctx.lineTo(x + 2 * zoom, baseY - 16 * zoom); ctx.lineTo(x - 4 * zoom, baseY - 15 * zoom); ctx.closePath(); ctx.fill();

  ctx.save();
  ctx.translate(x + 4 * zoom, baseY - 2 * zoom);
  ctx.rotate(attackSwing);
  if (unit.type === 'clubman' || unit.type === 'villager') {
    ctx.strokeStyle = unit.type === 'clubman' ? '#654322' : '#8f6a3c';
    ctx.lineWidth = unit.type === 'clubman' ? 4 * zoom : 2.5 * zoom;
    ctx.beginPath(); ctx.moveTo(0, 3 * zoom); ctx.lineTo(12 * zoom, -10 * zoom); ctx.stroke();
    if (unit.type === 'villager') {
      ctx.strokeStyle = '#a9a49a'; ctx.lineWidth = 3 * zoom;
      ctx.beginPath(); ctx.moveTo(9 * zoom, -12 * zoom); ctx.lineTo(15 * zoom, -7 * zoom); ctx.stroke();
    }
  } else if (unit.type === 'archer') {
    ctx.strokeStyle = '#b98b4d'; ctx.lineWidth = 1.8 * zoom;
    ctx.beginPath(); ctx.arc(5 * zoom, -2 * zoom, 10 * zoom, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#ddcfac'; ctx.lineWidth = 0.8 * zoom;
    ctx.beginPath(); ctx.moveTo(9 * zoom, -11 * zoom); ctx.lineTo(9 * zoom, 7 * zoom); ctx.stroke();
  } else if (unit.type === 'scout') {
    ctx.strokeStyle = '#6a492d'; ctx.lineWidth = 3 * zoom;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13 * zoom, -8 * zoom); ctx.stroke();
  }
  ctx.restore();
}

function resourceColour(type) {
  return { food: '#cf674e', wood: '#6f9a54', stone: '#a5a098', gold: '#e3b945' }[type] || '#fff';
}

function drawProjectile(projectile) {
  const point = worldToScreen(projectile.x, projectile.y, projectile.z);
  const target = getEntity(projectile.targetId);
  const angle = target ? Math.atan2(target.y - projectile.y, target.x - projectile.x) : 0;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(angle * 0.55);
  ctx.strokeStyle = '#e4d5b0';
  ctx.lineWidth = 1.4 * game.camera.zoom;
  ctx.beginPath(); ctx.moveTo(-6 * game.camera.zoom, 0); ctx.lineTo(6 * game.camera.zoom, 0); ctx.stroke();
  ctx.fillStyle = '#5f4b34';
  ctx.beginPath(); ctx.moveTo(7 * game.camera.zoom, 0); ctx.lineTo(3 * game.camera.zoom, -2 * game.camera.zoom); ctx.lineTo(3 * game.camera.zoom, 2 * game.camera.zoom); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const particle of game.particles) {
    const point = worldToScreen(particle.x, particle.y, particle.z);
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    if (particle.type === 'text') {
      ctx.fillStyle = particle.colour;
      ctx.font = `700 ${12 * game.camera.zoom}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(particle.text, point.x, point.y);
    } else {
      ctx.fillStyle = particle.colour;
      ctx.fillRect(point.x, point.y, particle.size * game.camera.zoom, particle.size * game.camera.zoom);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlacementGhost() {
  if (!runtime.placement) return;
  const spec = BUILDING_TYPES[runtime.placement.type];
  const x = Math.floor(runtime.hoverWorld.x) + (spec.width % 2 ? 0.5 : 0);
  const y = Math.floor(runtime.hoverWorld.y) + (spec.height % 2 ? 0.5 : 0);
  const point = worldToScreen(x, y);
  const zoom = game.camera.zoom;
  const valid = canPlaceBuilding(runtime.placement.type, x, y, PLAYER).ok && hasCost(getPlayer(PLAYER), spec.cost);
  ctx.save();
  ctx.globalAlpha = 0.48;
  ctx.fillStyle = valid ? '#58c76a' : '#d04b42';
  drawDiamond(point.x, point.y, spec.width * TILE_W / 2 * zoom, spec.height * TILE_H / 2 * zoom);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = valid ? '#9ef0aa' : '#ff8d82';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawSelectionBox() {
  if (!runtime.mouse.dragging || !runtime.mouse.dragStart) return;
  const x = Math.min(runtime.mouse.dragStart.x, runtime.mouse.x);
  const y = Math.min(runtime.mouse.dragStart.y, runtime.mouse.y);
  const width = Math.abs(runtime.mouse.x - runtime.mouse.dragStart.x);
  const height = Math.abs(runtime.mouse.y - runtime.mouse.dragStart.y);
  ctx.fillStyle = 'rgba(81,166,221,.12)';
  ctx.strokeStyle = 'rgba(126,208,255,.9)';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 0.5, y + 0.5, width, height);
}

function drawWorld(time) {
  drawTerrain(time);
  drawGroundDecals();
  const renderables = [
    ...game.resourcesNodes.filter((entity) => !entity.dead),
    ...game.buildings.filter((entity) => isAlive(entity)),
    ...game.units.filter((entity) => isAlive(entity)),
  ].filter(entityVisible).sort((a, b) => {
    const depthA = a.x + a.y + (a.kind === 'building' ? a.height * 0.12 : 0);
    const depthB = b.x + b.y + (b.kind === 'building' ? b.height * 0.12 : 0);
    return depthA - depthB;
  });
  for (const entity of renderables) {
    if (entity.kind === 'resource') drawResource(entity, time);
    else if (entity.kind === 'building') drawBuilding(entity, time);
    else drawUnit(entity, time);
  }
  game.projectiles.forEach(drawProjectile);
  drawParticles();
  drawPlacementGhost();
  drawSelectionBox();
}

function drawAmbientOverlay(time) {
  const gradient = ctx.createRadialGradient(viewport.width * 0.5, viewport.height * 0.42, viewport.height * 0.18, viewport.width * 0.5, viewport.height * 0.45, viewport.width * 0.72);
  gradient.addColorStop(0, 'rgba(255,219,151,0.015)');
  gradient.addColorStop(0.62, 'rgba(20,18,14,0.02)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  // Small atmospheric motes.
  ctx.fillStyle = 'rgba(255,233,188,.15)';
  for (let i = 0; i < 12; i += 1) {
    const x = (hash2(i, 1, game.seed) * viewport.width + time * (3 + i % 4)) % viewport.width;
    const y = 90 + hash2(i, 2, game.seed) * (viewport.height - 260);
    ctx.beginPath();
    ctx.arc(x, y + Math.sin(time + i) * 5, 0.7 + (i % 3) * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render(timeSeconds = performance.now() / 1000) {
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  if (!game) {
    ctx.fillStyle = '#11130f';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    return;
  }
  drawWorld(timeSeconds);
  drawAmbientOverlay(timeSeconds);
}

function renderMinimap() {
  if (!game) return;
  const width = 270;
  const height = 166;
  miniCtx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  miniCtx.fillStyle = '#0d110c';
  miniCtx.fillRect(0, 0, width, height);
  const sx = width / MAP_SIZE;
  const sy = height / MAP_SIZE;
  const miniPalette = {
    [TERRAIN.GRASS]: '#506f3c', [TERRAIN.GRASS_DARK]: '#405c34', [TERRAIN.SAND]: '#aa915f',
    [TERRAIN.WATER]: '#315d68', [TERRAIN.DIRT]: '#765f40', [TERRAIN.SHALLOW]: '#577c77',
  };
  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const fog = game.fog[y][x];
      miniCtx.fillStyle = fog <= 0 ? '#080b08' : (fog < 0.9 ? shadeColour(miniPalette[game.terrain[y][x]], -0.52) : miniPalette[game.terrain[y][x]]);
      miniCtx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  for (const resource of game.resourcesNodes) {
    const tx = Math.floor(resource.x); const ty = Math.floor(resource.y);
    if (game.fog[ty][tx] <= 0 || resource.dead) continue;
    miniCtx.fillStyle = resource.type === 'tree' ? '#224c25' : resource.type === 'gold' ? '#d5ad35' : resource.type === 'stone' ? '#a19d94' : '#a8473c';
    miniCtx.fillRect(resource.x * sx - 1, resource.y * sy - 1, 2, 2);
  }
  for (const building of game.buildings) {
    if (!isAlive(building) || !entityVisible(building)) continue;
    miniCtx.fillStyle = ownerColour(building.owner);
    miniCtx.fillRect((building.x - building.width / 2) * sx, (building.y - building.height / 2) * sy, Math.max(2, building.width * sx), Math.max(2, building.height * sy));
  }
  for (const unit of game.units) {
    if (!isAlive(unit) || !entityVisible(unit)) continue;
    miniCtx.fillStyle = ownerColour(unit.owner);
    miniCtx.fillRect(unit.x * sx - 1.2, unit.y * sy - 1.2, 2.4, 2.4);
  }

  const corners = [
    screenToWorld(0, 72), screenToWorld(viewport.width, 72),
    screenToWorld(viewport.width, viewport.height - 168), screenToWorld(0, viewport.height - 168),
  ];
  miniCtx.strokeStyle = 'rgba(255,236,182,.75)';
  miniCtx.lineWidth = 1;
  miniCtx.beginPath();
  corners.forEach((corner, index) => {
    const x = clamp(corner.x, 0, MAP_SIZE) * sx;
    const y = clamp(corner.y, 0, MAP_SIZE) * sy;
    if (index === 0) miniCtx.moveTo(x, y); else miniCtx.lineTo(x, y);
  });
  miniCtx.closePath();
  miniCtx.stroke();
}
