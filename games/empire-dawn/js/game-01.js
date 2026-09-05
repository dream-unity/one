'use strict';

/*
 * Empire Dawn: First Age
 * An original, self-contained real-time strategy game inspired by the design
 * language and systems of classic 1990s civilisation builders. All visuals,
 * simulation code and procedural sounds in this file are original.
 */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const canvas = $('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const minimap = $('#minimap');
const miniCtx = minimap.getContext('2d', { alpha: false });

const DOM = {
  food: $('#food-value'), wood: $('#wood-value'), stone: $('#stone-value'), gold: $('#gold-value'),
  age: $('#age-value'), pop: $('#population-value'), popCap: $('#population-cap'), time: $('#time-value'),
  objectiveList: $('#objective-list'), objectivePanel: $('#objective-panel'), collapseObjectives: $('#collapse-objectives'),
  notifications: $('#notification-stack'),
  portrait: $('#selection-portrait'), selectionOwner: $('#selection-owner'), selectionTitle: $('#selection-title'),
  selectionDescription: $('#selection-description'), healthRow: $('#health-row'), healthFill: $('#health-fill'),
  healthValue: $('#health-value'), selectionStats: $('#selection-stats'),
  commandContext: $('#command-context'), commandGrid: $('#command-grid'), backCommand: $('#back-command'),
  queueStrip: $('#queue-strip'), queueName: $('#queue-name'), queueTime: $('#queue-time'), queueFill: $('#queue-fill'),
  placementHint: $('#placement-hint'), cursorTooltip: $('#cursor-tooltip'),
  startScreen: $('#start-screen'), pauseScreen: $('#pause-screen'), helpScreen: $('#help-screen'), endScreen: $('#end-screen'),
  continueButton: $('#continue-button'), startButton: $('#start-button'), menuButton: $('#menu-button'), soundButton: $('#sound-button'),
  saveButton: $('#save-button'), resumeButton: $('#resume-button'), manualSaveButton: $('#manual-save-button'),
  loadButton: $('#load-button'), helpButton: $('#help-button'), closeHelp: $('#close-help'), restartButton: $('#restart-button'),
  playAgainButton: $('#play-again-button'), endKicker: $('#end-kicker'), endTitle: $('#end-title'), endCopy: $('#end-copy'), endStats: $('#end-stats'),
};

const MAP_SIZE = 64;
const TILE_W = 64;
const TILE_H = 32;
const PLAYER = 0;
const ENEMY = 1;
const NEUTRAL = 2;
const SAVE_KEY = 'empire-dawn-first-age-save-v1';

const TERRAIN = {
  GRASS: 0,
  GRASS_DARK: 1,
  SAND: 2,
  WATER: 3,
  DIRT: 4,
  SHALLOW: 5,
};

const AGE_NAMES = ['Stone', 'Tool', 'Bronze'];
const AGE_LONG_NAMES = ['Stone Age', 'Tool Age', 'Bronze Age'];

const CIVILISATIONS = {
  river: {
    name: 'River team',
    description: 'Workers bring back food and wood faster.',
    gatherMultiplier: 1.12,
    militarySpeed: 1,
    buildingHealth: 1,
    colour: '#4b8bc4',
  },
  steppe: {
    name: 'Fast team',
    description: 'Guards move faster.',
    gatherMultiplier: 1,
    militarySpeed: 1.12,
    buildingHealth: 1,
    colour: '#4b8bc4',
  },
  aegean: {
    name: 'Strong team',
    description: 'Buildings can take more hits.',
    gatherMultiplier: 1,
    militarySpeed: 1,
    buildingHealth: 1.18,
    colour: '#4b8bc4',
  },
};

const UNIT_TYPES = {
  villager: {
    name: 'Worker', icon: '♙', hp: 35, speed: 1.55, attack: 3, armour: 0, range: 0.72,
    cooldown: 1.3, carry: 10, trainTime: 14, cost: { food: 50 }, pop: 1,
    description: 'Brings back food, wood, stone and gold. Builds and fixes your buildings.',
  },
  clubman: {
    name: 'Club guard', icon: '⚔', hp: 55, speed: 1.65, attack: 8, armour: 1, range: 0.86,
    cooldown: 1.05, trainTime: 17, cost: { food: 50 }, pop: 1, requiredAge: 0,
    description: 'Fights up close. Train one at the Guard camp.',
  },
  archer: {
    name: 'Bow guard', icon: '➶', hp: 42, speed: 1.6, attack: 7, armour: 0, range: 5.2,
    cooldown: 1.55, trainTime: 21, cost: { food: 40, wood: 25 }, pop: 1, requiredAge: 1,
    description: 'Shoots arrows from far away. Keep space between this guard and foes.',
  },
  scout: {
    name: 'Horse guard', icon: '♞', hp: 85, speed: 2.5, attack: 10, armour: 1, range: 1.02,
    cooldown: 1.15, trainTime: 26, cost: { food: 80 }, pop: 2, requiredAge: 1,
    description: 'Rides fast. Finds new places and catches bow guards.',
  },
};

const BUILDING_TYPES = {
  townCenter: {
    name: 'Main house', icon: '⌂', width: 3, height: 3, hp: 1400, armour: 3, buildTime: 0,
    cost: {}, popCap: 5, description: 'Your main building. Make workers here. They bring back what they find. Learn new tools here too.',
  },
  house: {
    name: 'House', icon: '⌂', width: 2, height: 2, hp: 420, armour: 1, buildTime: 18,
    cost: { wood: 80 }, popCap: 5, description: 'Makes room for 5 more people.',
  },
  granary: {
    name: 'Food store', icon: '◒', width: 2, height: 2, hp: 500, armour: 1, buildTime: 22,
    cost: { wood: 120 }, description: 'Workers leave food here. Add wheels to help them carry more.',
  },
  storagePit: {
    name: 'Wood store', icon: '▦', width: 2, height: 2, hp: 520, armour: 1, buildTime: 22,
    cost: { wood: 120 }, description: 'Workers leave wood, stone and gold here.',
  },
  barracks: {
    name: 'Guard camp', icon: '⚔', width: 3, height: 2, hp: 720, armour: 2, buildTime: 28,
    cost: { wood: 150 }, description: 'Make club guards here. Give your guards stronger weapons.',
  },
  archeryRange: {
    name: 'Bow camp', icon: '➶', width: 3, height: 2, hp: 650, armour: 1, buildTime: 30,
    cost: { wood: 175 }, requiredAge: 1, description: 'Make bow guards here. First reach the Tool Age.',
  },
  stable: {
    name: 'Horse camp', icon: '♞', width: 3, height: 2, hp: 780, armour: 2, buildTime: 34,
    cost: { wood: 200 }, requiredAge: 1, description: 'Make horse guards here. First reach the Tool Age.',
  },
  watchTower: {
    name: 'Guard tower', icon: '♜', width: 1, height: 1, hp: 600, armour: 4, buildTime: 30,
    cost: { wood: 100, stone: 75 }, requiredAge: 1, range: 6.4, attack: 9, cooldown: 1.65,
    description: 'Shoots at foes who come close.',
  },
  farm: {
    name: 'Farm', icon: '▧', width: 2, height: 2, hp: 260, armour: 0, buildTime: 14,
    cost: { wood: 75 }, food: 260, description: 'Workers get food here. Build a new farm when the food runs out.',
  },
};

const RESOURCE_TYPES = {
  tree: { name: 'Tree', resource: 'wood', amount: 110, rate: 1.15, icon: '▲', radius: 0.42, blocking: true },
  berries: { name: 'Berry Bush', resource: 'food', amount: 135, rate: 0.92, icon: '●', radius: 0.4, blocking: false },
  gold: { name: 'Gold rock', resource: 'gold', amount: 380, rate: 0.68, icon: '●', radius: 0.52, blocking: true },
  stone: { name: 'Stone rock', resource: 'stone', amount: 420, rate: 0.66, icon: '⬟', radius: 0.52, blocking: true },
  gazelle: { name: 'Deer', resource: 'food', amount: 115, rate: 1.08, icon: '♧', radius: 0.32, blocking: false },
};

const TECHNOLOGIES = {
  toolworking: {
    name: 'Stronger hits', icon: '⚒', building: 'barracks', requiredAge: 1, cost: { food: 120, gold: 50 }, duration: 22,
    description: 'Each guard does 2 more damage with each hit.',
  },
  leatherArmour: {
    name: 'Better shields', icon: '⬙', building: 'townCenter', requiredAge: 1, cost: { food: 120, wood: 75 }, duration: 20,
    description: 'Each hit does 1 less damage to your guards.',
  },
  wheel: {
    name: 'The Wheel', icon: '◉', building: 'granary', requiredAge: 1, cost: { food: 150, wood: 100 }, duration: 24,
    description: 'Workers gather 18% faster and carry 18% more.',
  },
  architecture: {
    name: 'Stronger walls', icon: '▤', building: 'townCenter', requiredAge: 2, cost: { stone: 150, gold: 100 }, duration: 30,
    description: 'Your buildings can take 20% more damage.',
  },
};

const BUILD_MENU = ['house', 'granary', 'storagePit', 'barracks', 'farm', 'archeryRange', 'stable', 'watchTower'];

const runtime = {
  started: false,
  paused: false,
  ended: false,
  speed: 1,
  selected: [],
  commandMode: 'default',
  placement: null,
  targeting: null,
  hoverWorld: { x: 0, y: 0 },
  mouse: { x: 0, y: 0, down: false, button: 0, dragStart: null, dragging: false, edgeX: 0, edgeY: 0 },
  keys: new Set(),
  groups: { 1: [], 2: [], 3: [], 4: [], 5: [] },
  lastTime: performance.now(),
  accumulator: 0,
  uiTimer: 0,
  fogTimer: 0,
  aiTimer: 0,
  saveTimer: 0,
  previewMode: new URLSearchParams(location.search).get('preview') === '1',
  previewBattleStarted: false,
  soundOn: true,
  audioContext: null,
  audioThrottle: new Map(),
  civChoice: 'river',
  difficultyChoice: 'standard',
};

let viewport = { width: innerWidth, height: innerHeight, dpr: Math.min(2, devicePixelRatio || 1) };
let game = null;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function sqrDistance(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy; }
function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function formatNumber(value) { return Math.max(0, Math.floor(value)).toLocaleString(); }
function titleCase(value) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase()); }
function hash2(x, y, seed = 0) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomChoice(items, random = Math.random) { return items[Math.floor(random() * items.length)]; }
function hasCost(player, cost = {}) { return Object.entries(cost).every(([key, value]) => player.resources[key] >= value); }
function spendCost(player, cost = {}) { Object.entries(cost).forEach(([key, value]) => { player.resources[key] -= value; }); }
function costText(cost = {}) {
  const symbols = { food: 'food', wood: 'wood', stone: 'stone', gold: 'gold' };
  return Object.entries(cost).map(([key, value]) => `${value} ${symbols[key]}`).join(' ');
}
function getAgeName(index) { return AGE_LONG_NAMES[clamp(index, 0, AGE_LONG_NAMES.length - 1)]; }

function ensureAudio() {
  if (!runtime.soundOn) return null;
  if (!runtime.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    runtime.audioContext = new AudioContext();
  }
  if (runtime.audioContext.state === 'suspended') runtime.audioContext.resume();
  return runtime.audioContext;
}

function sound(kind, intensity = 1) {
  if (!runtime.soundOn) return;
  const now = performance.now();
  const previous = runtime.audioThrottle.get(kind) || 0;
  const throttle = kind === 'combat' ? 180 : 40;
  if (now - previous < throttle) return;
  runtime.audioThrottle.set(kind, now);
  const ac = ensureAudio();
  if (!ac) return;

  const settings = {
    click: [620, 0.05, 'triangle', 0.035],
    order: [280, 0.09, 'sine', 0.045],
    build: [170, 0.16, 'triangle', 0.05],
    train: [420, 0.13, 'triangle', 0.045],
    age: [180, 0.8, 'sine', 0.06],
    combat: [95, 0.06, 'square', 0.022],
    warning: [120, 0.35, 'sawtooth', 0.045],
    victory: [240, 1.0, 'triangle', 0.06],
    defeat: [110, 1.1, 'sine', 0.06],
  }[kind] || [330, 0.08, 'sine', 0.03];

  const [frequency, duration, wave, gainValue] = settings;
  const oscillator = ac.createOscillator();
  const gain = ac.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, ac.currentTime);
  if (kind === 'age' || kind === 'victory') {
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 2.1, ac.currentTime + duration);
  } else if (kind === 'defeat') {
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.55, ac.currentTime + duration);
  } else {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * 0.72), ac.currentTime + duration);
  }
  gain.gain.setValueAtTime(gainValue * intensity, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  oscillator.connect(gain).connect(ac.destination);
  oscillator.start();
  oscillator.stop(ac.currentTime + duration);
}

function resize() {
  viewport = { width: innerWidth, height: innerHeight, dpr: Math.min(2, devicePixelRatio || 1) };
  canvas.width = Math.round(viewport.width * viewport.dpr);
  canvas.height = Math.round(viewport.height * viewport.dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  viewport.playTop = $('#world-tools').getBoundingClientRect().bottom + 8;
  viewport.playBottom = $('#selection-panel').getBoundingClientRect().top;
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  minimap.width = 270 * viewport.dpr;
  minimap.height = 166 * viewport.dpr;
  miniCtx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}

function worldToIso(x, y) {
  return { x: (x - y) * TILE_W / 2, y: (x + y) * TILE_H / 2 };
}

function worldToScreen(x, y, z = 0) {
  const iso = worldToIso(x, y);
  const zoom = game?.camera.zoom || 1;
  const anchorY = 72;
  return {
    x: (iso.x - (game?.camera.x || 0)) * zoom + viewport.width / 2,
    y: (iso.y - (game?.camera.y || 0) - z) * zoom + anchorY,
  };
}

function screenToWorld(screenX, screenY) {
  const zoom = game?.camera.zoom || 1;
  const anchorY = 72;
  const isoX = (screenX - viewport.width / 2) / zoom + (game?.camera.x || 0);
  const isoY = (screenY - anchorY) / zoom + (game?.camera.y || 0);
  return {
    x: isoY / TILE_H + isoX / TILE_W,
    y: isoY / TILE_H - isoX / TILE_W,
  };
}

function centreCameraOnWorld(x, y, immediate = false) {
  if (!game) return;
  const iso = worldToIso(x, y);
  const playableHeight = Math.max(80, viewport.playBottom - viewport.playTop);
  const desiredScreenY = viewport.playTop + playableHeight * 0.6;
  const cameraY = iso.y - (desiredScreenY - 72) / (game.camera.zoom || 1);
  if (immediate) {
    game.camera.x = iso.x;
    game.camera.y = cameraY;
  } else {
    game.camera.targetX = iso.x;
    game.camera.targetY = cameraY;
  }
}

function getPlayer(owner) { return game.players[owner]; }
function isAlive(entity) { return entity && !entity.dead && entity.hp > 0; }
function getAllEntities() { return [...game.units, ...game.buildings, ...game.resourcesNodes]; }
function getEntity(id) {
  if (id == null) return null;
  return game.units.find((item) => item.id === id)
    || game.buildings.find((item) => item.id === id)
    || game.resourcesNodes.find((item) => item.id === id)
    || null;
}
function getUnit(id) { return game.units.find((item) => item.id === id) || null; }
function getBuilding(id) { return game.buildings.find((item) => item.id === id) || null; }

function nextId(prefix = 'e') {
  const value = `${prefix}${game.nextId}`;
  game.nextId += 1;
  return value;
}

function createPlayer(name, colour, resources, age = 0) {
  return {
    name,
    colour,
    resources: { food: 0, wood: 0, stone: 0, gold: 0, ...resources },
    age,
    upgrades: { attack: 0, armour: 0, gather: 0, architecture: 0 },
    researched: [],
    stats: {
      gathered: 0,
      unitsCreated: 0,
      unitsLost: 0,
      enemyUnitsDefeated: 0,
      buildingsBuilt: 0,
      buildingsLost: 0,
      enemyBuildingsDestroyed: 0,
    },
  };
}

function createUnit(owner, type, x, y, options = {}) {
  const spec = UNIT_TYPES[type];
  const player = getPlayer(owner);
  const civ = owner === PLAYER ? CIVILISATIONS[game.civilisation] : null;
  const militarySpeed = type === 'villager' ? 1 : (civ?.militarySpeed || 1);
  const unit = {
    id: nextId('u'), kind: 'unit', owner, type, x, y,
    hp: spec.hp, maxHp: spec.hp,
    speed: spec.speed * militarySpeed,
    attack: spec.attack,
    armour: spec.armour,
    range: spec.range,
    cooldown: 0,
    facing: owner === PLAYER ? 1 : -1,
    order: { type: 'idle' },
    path: [], pathIndex: 0, repath: 0,
    carryingType: null, carryingAmount: 0,
    workPulse: 0, anim: Math.random() * Math.PI * 2,
    recentDamage: 0, selectedPulse: 0,
    aggressive: false,
    ...options,
  };
  game.units.push(unit);
  player.stats.unitsCreated += 1;
  return unit;
}

function buildingMaxHealth(owner, type) {
  const spec = BUILDING_TYPES[type];
  const civMultiplier = owner === PLAYER ? CIVILISATIONS[game.civilisation].buildingHealth : 1;
  const architecture = 1 + (getPlayer(owner).upgrades.architecture || 0);
  return Math.round(spec.hp * civMultiplier * architecture);
}

function createBuilding(owner, type, x, y, options = {}) {
  const spec = BUILDING_TYPES[type];
  const complete = options.complete ?? true;
  const maxHp = buildingMaxHealth(owner, type);
  const building = {
    id: nextId('b'), kind: 'building', owner, type, x, y,
    width: spec.width, height: spec.height,
    hp: complete ? maxHp : Math.max(1, maxHp * 0.04), maxHp,
    armour: spec.armour || 0,
    progress: complete ? 1 : 0.04,
    queue: [], research: null,
    rally: { x: x + spec.width / 2 + 1.2, y: y + spec.height / 2 + 0.5 },
    towerCooldown: Math.random(),
    foodRemaining: type === 'farm' ? spec.food : null,
    recentDamage: 0,
    ...options,
  };
  game.buildings.push(building);
  if (complete && owner !== NEUTRAL) getPlayer(owner).stats.buildingsBuilt += 1;
  return building;
}

function createResource(type, x, y, amount = null, options = {}) {
  const spec = RESOURCE_TYPES[type];
  const node = {
    id: nextId('r'), kind: 'resource', owner: NEUTRAL, type, x, y,
    amount: amount ?? spec.amount,
    maxAmount: amount ?? spec.amount,
    dead: false,
    variant: Math.floor(hash2(Math.floor(x * 10), Math.floor(y * 10), game.seed) * 5),
    sway: hash2(Math.floor(x * 100), Math.floor(y * 100), game.seed) * Math.PI * 2,
    ...options,
  };
  game.resourcesNodes.push(node);
  return node;
}
