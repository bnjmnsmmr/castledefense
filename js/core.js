// ===== CORE (canvas, run state, persistence) =====
// Canvas handle, the live `game` object, lane helpers, admin config overrides, run save/load, lifetime profile, skins, Hall of Fame, leaderboard client.

const C = document.getElementById('c');
let ctx = C.getContext('2d'); // `let` so drawEnemies can temporarily retarget the enemy artists to an offscreen buffer

// --- GAME STATE ---
let game = null;

// Cached DOM lookups for HUD elements that live in the static markup. Use `$id('gold')`
// in per-frame code instead of document.getElementById; the map is filled lazily.
const DOM_CACHE = new Map();
function $id(id) {
  let el = DOM_CACHE.get(id);
  if (!el) { el = document.getElementById(id); if (el) DOM_CACHE.set(id, el); }
  return el;
}

function getActivePaths(wave) {
  return ALL_PATHS.filter(p => wave >= p.unlockWave);
}

function buildPathSet(wave) {
  const s = new Set();
  for (const p of getActivePaths(wave)) {
    for (const [x,y] of p.tiles) s.add(`${x},${y}`);
  }
  return s;
}

let pathSet = buildPathSet(1);
function isPath(tx, ty) { return pathSet.has(`${tx},${ty}`); }
function isCastle(tx, ty) { return tx >= 28 && ty >= 6 && ty <= 10; }

// Tower types

function getWallCost(typeIdx) {
  const base = WALL_TYPES[typeIdx].cost;
  const world = (game ? game.world : 1);
  return Math.floor(base * (1 + (world - 1) * DIFFICULTY.wallCostScale) * relicMult('wallCost'));
}

function wallAt(tx, ty) {
  if (!game || !game.walls) return null;
  return game.walls.find(w => w.tx === tx && w.ty === ty) || null;
}
// How hard a given enemy hits masonry. Big bruisers smash, rats nibble, bosses wreck.
function wallDps(e) {
  return (5 + enemySize(e) * 0.8) * (e.boss ? 6 : 1) * affixWallDpsMult(e) * stormWallDmgMult();
}

// Each wall draws into a 48x48 box, so the same art serves the board and the cards.

const DEFAULT_DIFFICULTY = JSON.parse(JSON.stringify(DIFFICULTY));
const DEFAULT_TOWERS = TOWER_TYPES.map(t => ({ id: t.id, cost: t.cost, range: t.range, rate: t.rate, dmg: t.dmg, ammo: t.ammo, reload: t.reload }));
const DEFAULT_ENEMIES = ENEMY_DEFS.map(e => ({ id: e.id, hp: e.hp, speed: e.speed, reward: e.reward, xp: e.xp }));

// Apply any admin-panel overrides saved in localStorage
function loadConfigOverrides() {
  try {
    const raw = localStorage.getItem('castleDefenseConfig');
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg.difficulty) Object.assign(DIFFICULTY, cfg.difficulty);
    if (cfg.towers) for (const t of TOWER_TYPES) if (cfg.towers[t.id]) Object.assign(t, cfg.towers[t.id]);
    if (cfg.enemies) for (const e of ENEMY_DEFS) if (cfg.enemies[e.id]) Object.assign(e, cfg.enemies[e.id]);
    if (cfg.walls) for (const w of WALL_TYPES) if (cfg.walls[w.id]) Object.assign(w, cfg.walls[w.id]);
  } catch (err) {
    console.warn('Castle Defense: failed to load admin config overrides', err);
  }
}

// ===== ADMIN PANEL (built into this same file) =====
const ADMIN_STORAGE_KEY = 'castleDefenseConfig';

// --- PERSISTENT RUN SAVE (so progress survives reloads / admin panel visits) ---
const SAVE_KEY = 'castleDefenseSave';

function saveGameState() {
  if (!game || game.gameOver || game.dailyChallenge) return;
  try {
    const data = {
      hp: game.hp, gold: game.gold, wave: game.wave, world: game.world,
      kills: game.kills, xp: game.xp, upgradesSpent: game.upgradesSpent,
      annihilatorUnlocked: !!game.annihilatorUnlocked, triBeamEquipped: !!game.triBeamEquipped,
      triBeamGranted: !!game.triBeamGranted, merchantGone: !!game.merchantGone,
      achievements: game.achievements || {}, autoWave: !!game.autoWave, speed: game.speed || 1,
      mana: game.mana || 0, powerCooldowns: game.powerCooldowns || {}, powersCast: game.powersCast || 0,
      towers: game.towers.map(t => ({ tx: t.tx, ty: t.ty, type: t.type, level: t.level || 0, targetMode: t.targetMode || null, branch: t.branch || null })),
      runSeed: game.runSeed,
      walls: (game.walls || []).map(w => ({ tx: w.tx, ty: w.ty, type: w.type, hp: w.hp, maxHp: w.maxHp })),
      relics: game.relics || [],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable, ignore */ }
}

// Throttled save: HUD updates fire many times a second mid-wave (every kill, every coin),
// so they only mark the run dirty and the frame loop flushes at most once a second.
// Direct saveGameState() stays for the moments that must land now (pause, quit, unload).
let saveDirty = false, lastSaveAt = 0;
function requestSave() { saveDirty = true; }
function flushSaveIfDue(now) {
  if (!saveDirty || now - lastSaveAt < 1000) return;
  saveDirty = false; lastSaveAt = now;
  saveGameState();
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearGameState() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}


// ===== PLAYER PROFILE (lifetime meta-progression, survives every run) =====
const PROFILE_KEY = 'castleDefenseProfile';
function loadProfile() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { p = {}; }
  p.stats = p.stats || {};
  p.achievements = p.achievements || {};
  p.notifiedSkins = p.notifiedSkins || [];
  return p;
}
let profile = loadProfile();
function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}


function buildSkinOptionsFor(tower) {
  const opts = [{ id:'default', name:'Default', color: tower.color, proj: tower.projColor }];
  for (const p of SKIN_PALETTE) {
    if (p.color.toLowerCase() === tower.color.toLowerCase()) continue;
    opts.push(p);
    if (opts.length >= 4) break;
  }
  return opts;
}
const TOWER_SKIN_OPTIONS = {};
for (const t of TOWER_TYPES) { if (!t.secret) TOWER_SKIN_OPTIONS[t.id] = buildSkinOptionsFor(t); }


function isSkinUnlocked(skinId) {
  if (skinId === 'default') return true;
  const rule = SKIN_UNLOCKS[skinId];
  return !rule || rule.test(profile);
}
// Announce freshly-earned skins (called after waves / achievements land)
function checkSkinUnlockNotifications() {
  for (const id in SKIN_UNLOCKS) {
    if (isSkinUnlocked(id) && !profile.notifiedSkins.includes(id)) {
      profile.notifiedSkins.push(id);
      const pal = SKIN_PALETTE.find(s => s.id === id);
      notify('epic', `New skin unlocked: ${pal ? pal.name : id} — equip it in Customize!`);
      SFX.play('unlock');
      saveProfile();
    }
  }
}

const SKIN_STORAGE_KEY = 'castleDefenseSkins';
function loadSkinSelections() {
  try { return JSON.parse(localStorage.getItem(SKIN_STORAGE_KEY)) || {}; } catch (e) { return {}; }
}
function saveSkinSelectionsToStorage() {
  try { localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(skinSelections)); } catch (e) { /* ignore */ }
}
let skinSelections = loadSkinSelections();
function getTowerSkin(towerId) {
  const opts = TOWER_SKIN_OPTIONS[towerId];
  if (!opts) return null;
  const selId = skinSelections[towerId] || 'default';
  return opts.find(o => o.id === selId) || opts[0];
}
function setTowerSkin(towerId, skinId) {
  skinSelections[towerId] = skinId;
  saveSkinSelectionsToStorage();
  applySkinSelections();
  if (typeof buildTowerBar === 'function' && game) buildTowerBar();
}
// Apply the saved skin colors onto the live TOWER_TYPES (color/projColor only — see spec)
function applySkinSelections() {
  for (const t of TOWER_TYPES) {
    if (t.secret) continue;
    const skin = getTowerSkin(t.id);
    if (skin) { t.color = skin.color; t.projColor = skin.proj; }
  }
}
// Tints a just-drawn 48x48 tower sprite toward its selected skin color (defaults draw untouched)
function applySpriteTint(c, towerId) {
  const skin = getTowerSkin(towerId);
  if (!skin || skin.id === 'default') return;
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = 0.5;
  c.fillStyle = skin.color;
  c.fillRect(0, 0, 48, 48);
  c.restore();
}


// ===== HALL OF FAME (local best runs) =====
// Top 10 runs kept on this device. A global leaderboard would need a backend —
// see the note in CLAUDE.md; this is the honest offline version.
const HOF_KEY = 'castleDefenseHallOfFame';
const HOF_MAX = 10;
function loadHallOfFame() {
  try { return JSON.parse(localStorage.getItem(HOF_KEY)) || []; } catch (e) { return []; }
}
function saveHallOfFame(list) {
  try { localStorage.setItem(HOF_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}
// Returns the 1-based rank if the run made the board, else 0
function recordHallOfFame(entry) {
  const list = loadHallOfFame();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.kills - a.kills);
  const trimmed = list.slice(0, HOF_MAX);
  saveHallOfFame(trimmed);
  const idx = trimmed.indexOf(entry);
  return idx === -1 ? 0 : idx + 1;
}


// ===== GLOBAL LEADERBOARD =====
// Paste your deployed Cloudflare Worker URL here to switch the global board on.
// Left empty the game works exactly as before, with local scores only —
// see server/README.md for the five-minute deploy.
const LEADERBOARD_API = ''; // e.g. 'https://castle-defense-leaderboard.you.workers.dev'
function leaderboardEnabled() { return !!LEADERBOARD_API; }

const IDENTITY_KEY = 'castleDefenseIdentity';

function randomToken() {
  const bytes = new Uint8Array(16);
  (crypto && crypto.getRandomValues) ? crypto.getRandomValues(bytes)
    : bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
function newCodename() {
  return {
    adj: Math.floor(Math.random() * ADJECTIVES.length),
    noun: Math.floor(Math.random() * NOUNS.length),
    num: Math.floor(Math.random() * 10000),
  };
}
function getPlayerIdentity() {
  let id = null;
  try { id = JSON.parse(localStorage.getItem(IDENTITY_KEY)); } catch (e) { id = null; }
  if (!id || typeof id.token !== 'string' || id.adj === undefined) {
    id = { token: randomToken(), ...newCodename() };
    try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(id)); } catch (e) { /* ignore */ }
  }
  return id;
}
function codenameOf(id) {
  return `${ADJECTIVES[id.adj]} ${NOUNS[id.noun]} ${String(id.num).padStart(4, '0')}`;
}
function rerollCodename() {
  const id = { ...getPlayerIdentity(), ...newCodename() };
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(id)); } catch (e) { /* ignore */ }
  SFX.play('ui_click');
  buildLeaderboard();
}

// Submissions are fire-and-forget: a dead network must never block the results
// screen, so every failure just leaves the local Hall of Fame as the record.
async function submitScoreToLeaderboard(entry) {
  if (!leaderboardEnabled()) return null;
  const id = getPlayerIdentity();
  try {
    const res = await fetch(LEADERBOARD_API.replace(/\/$/, '') + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: id.token, adj: id.adj, noun: id.noun, num: id.num,
        score: entry.score, world: entry.world, wave: entry.wave,
        kills: entry.kills, bosses: entry.bosses || 0,
        durationMs: entry.durationMs || 0, mode: entry.mode === 'daily' ? 'daily' : 'run',
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchLeaderboard(period, mode) {
  if (!leaderboardEnabled()) return null;
  const id = getPlayerIdentity();
  try {
    const url = LEADERBOARD_API.replace(/\/$/, '') +
      `/api/leaderboard?period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode || 'run')}` +
      `&token=${encodeURIComponent(id.token)}&limit=25`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
