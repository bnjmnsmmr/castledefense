// ===== FEATURE: RELIC DRAFT (roguelite perks between worlds) =====
// On every world clear (never in Daily Challenge) the player is offered 3 of the
// ~15 relics below and picks one via #relic-draft. Picks persist in game.relics
// (array of ids) and are read back through hasRelic(id) / relicMult(kind) by
// small hooks scattered through js/game.js, js/core.js and js/input.js.

const RELICS = [
  { id: 'frostbite',    name: 'Frostbite',     emoji: '❄️', desc: 'Ice slows stack: +15% strength per re-hit (cap 80%)' },
  { id: 'masons',       name: "Masons' Kit",   emoji: '🧱', desc: 'Walls regenerate 3% max HP per second' },
  { id: 'quartermaster',name: 'Quartermaster', emoji: '📦', desc: 'A bonus supply crate drops every 20s during waves' },
  { id: 'sharpshooter', name: 'Sharpshooter',  emoji: '🎯', desc: 'Sniper and Arrow towers deal +25% damage' },
  { id: 'pyromaniac',   name: 'Pyromaniac',    emoji: '🔥', desc: 'Burning / poison damage-over-time deals +50%' },
  { id: 'treasury',     name: 'Treasury',      emoji: '💰', desc: '+10% gold from every kill' },
  { id: 'fortify',      name: 'Fortify',       emoji: '❤️', desc: '+5 max hearts, heals 5 right now' },
  { id: 'overclock',    name: 'Overclock',     emoji: '⚙️', desc: 'All towers reload and fire 30% faster' },
  { id: 'scrapper',     name: 'Scrapper',      emoji: '♻️', desc: 'Selling refunds 80% instead of 50%' },
  { id: 'magnet',       name: 'Gold Magnet',   emoji: '🧲', desc: 'Supply crates give double gold' },
  { id: 'vanguard',     name: 'Vanguard',      emoji: '🏰', desc: 'Walls cost 30% less gold' },
  { id: 'alchemist',    name: 'Alchemist',     emoji: '⚗️', desc: 'Gold Mines earn +50% income' },
  { id: 'juggernaut',   name: 'Juggernaut',    emoji: '💥', desc: 'Cannon and Mortar splash radius +35%' },
  { id: 'tempo',        name: 'Tempo',         emoji: '⚡', desc: 'Tesla and Flame fire 20% faster' },
  { id: 'second_wind',  name: 'Second Wind',   emoji: '🕊️', desc: 'Once per world, surviving a killing blow at 1 heart' },
];
const RELIC_DRAFT_SIZE = 3;

// --- Lookups used by the hooks in game.js / core.js / input.js ---
function hasRelic(id) { return !!(game && game.relics && game.relics.includes(id)); }

function relicMult(kind) {
  switch (kind) {
    case 'gold':     return hasRelic('treasury') ? 1.1 : 1;
    case 'goldMine': return hasRelic('alchemist') ? 1.5 : 1;
    case 'wallCost': return hasRelic('vanguard') ? 0.7 : 1;
    default: return 1;
  }
}

function getSellRefundRate() { return hasRelic('scrapper') ? 0.8 : DIFFICULTY.sellRefundRate; }

// Applies relic bonuses to a tower's per-frame stat block. `def` may alias the
// shared TOWER_TYPES entry (level 0) so this only clones on first write.
function applyRelicTowerDef(base, def) {
  if (!game || !game.relics || !game.relics.length) return def;
  let out = def;
  const own = () => { if (out === def) out = Object.assign({}, def); return out; };
  if (hasRelic('sharpshooter') && (base.id === 'sniper' || base.id === 'arrow')) {
    own(); out.dmg *= 1.25;
  }
  if (hasRelic('pyromaniac') && out.dot) {
    own(); out.dot *= 1.5;
  }
  if (hasRelic('overclock')) {
    own(); out.rate *= 0.7; out.reload *= 0.7;
  }
  if (hasRelic('juggernaut') && (base.id === 'cannon' || base.id === 'mortar') && out.splash) {
    own(); out.splash *= 1.35;
  }
  if (hasRelic('tempo') && (base.id === 'tesla' || base.id === 'flame')) {
    own(); out.rate *= 0.8;
  }
  return out;
}

// Ice slow: each hit while already slowed adds a stack (frostbite only); the
// speed multiplier below turns that into a bigger reduction, capped at 80%.
function applyIceSlow(e, dur) {
  if (!e) return;
  const wasSlowed = e.slowed > 0;
  e.slowed = dur;
  e.iceStacks = hasRelic('frostbite') ? Math.min((wasSlowed ? (e.iceStacks || 1) : 0) + 1, 5) : 1;
}
function slowSpeedMult(e) {
  const stacks = hasRelic('frostbite') ? Math.max(1, e.iceStacks || 1) : 1;
  const reduction = Math.max(Math.min(0.5 + 0.15 * (stacks - 1), 0.8), e.slowStrength || 0);
  return 1 - reduction;
}

// Once-per-world save: consumes the charge for THIS world only, so it "recharges"
// on the next world-clear relic pick. Returns true if it saved the run.
function trySecondWind() {
  if (!game || !hasRelic('second_wind')) return false;
  if (game.secondWindUsedWorld === game.world) return false;
  game.secondWindUsedWorld = game.world;
  game.hp = 1;
  SFX.play('unlock');
  showBannerText('SECOND WIND', 'A relic keeps the castle standing — 1 heart left', 2400);
  spawnParticles(C.width / 2, C.height / 2, '#8fd4ff', 30);
  return true;
}

// One-time effects applied at the moment a relic is picked (everything else is
// read passively through hasRelic()/relicMult() above).
function applyRelicPickEffect(id) {
  if (id === 'fortify') { game.maxHp = (game.maxHp || DIFFICULTY.startHp) + 5; game.hp += 5; updateUI(); }
}

// Passive per-frame relic systems: wall regen (masons) and bonus mid-wave
// crates (quartermaster). Hooked once from update(dt) in js/game.js.
function updateRelics(dt) {
  if (!game || !game.relics || !game.relics.length) return;
  if (hasRelic('masons') && game.walls && game.walls.length) {
    for (const w of game.walls) {
      if (w.hp < w.maxHp) w.hp = Math.min(w.maxHp, w.hp + w.maxHp * 0.03 * dt);
    }
  }
  if (hasRelic('quartermaster') && game.waveActive) {
    game.relicCrateTimer = (game.relicCrateTimer || 0) + dt;
    if (game.relicCrateTimer >= 20) {
      game.relicCrateTimer -= 20;
      spawnRelicCrate();
    }
  }
}

// A single extra crate dropped mid-wave by Quartermaster — reuses the normal
// supplyCrates array/renderer/collect logic, just doesn't clear it first.
function spawnRelicCrate() {
  if (!game) return;
  game.supplyCrates = game.supplyCrates || [];
  const occupied = new Set();
  for (const t of game.towers) occupied.add(`${t.tx},${t.ty}`);
  for (const w of game.walls) occupied.add(`${w.tx},${w.ty}`);
  for (const c of game.supplyCrates) occupied.add(`${c.tx},${c.ty}`);
  const candidates = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (!isPath(x, y) && !isCastle(x, y) && !occupied.has(`${x},${y}`)) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return;
  const c = candidates[Math.floor(Math.random() * candidates.length)];
  const gold = DIFFICULTY.supplyCrateMin + Math.floor(Math.random() * (DIFFICULTY.supplyCrateMax - DIFFICULTY.supplyCrateMin + 1)) + game.world * 5;
  game.supplyCrates.push({ tx: c.x, ty: c.y, gold, spawnT: Date.now(), collected: false });
  spawnDamageNum(c.x * TILE + TILE / 2, c.y * TILE, 'CRATE!', 'gold');
}

// --- DRAFT OVERLAY ---
function pickRandomRelics(n) {
  const owned = new Set(game.relics || []);
  let pool = RELICS.filter(r => !owned.has(r.id));
  if (pool.length < n) pool = RELICS.slice();
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function openRelicDraft() {
  if (!game || game.gameOver || game.dailyChallenge) return;
  const offers = pickRandomRelics(RELIC_DRAFT_SIZE);
  if (!offers.length) return;
  game.relicDraftActive = true;
  game.relicDraftOffers = offers;
  if (game.autoWaveTimer !== undefined) {
    game._relicPausedAutoTimer = game.autoWaveTimer;
    game.autoWaveTimer = undefined;
  }
  renderRelicDraftOverlay(offers);
  const el = document.getElementById('relic-draft');
  if (el) el.classList.add('show');
}

function renderRelicDraftOverlay(offers) {
  const el = document.getElementById('relic-draft');
  if (!el) return;
  el.innerHTML =
    '<div class="relic-draft-head">' +
      '<div class="relic-draft-title">CHOOSE A RELIC</div>' +
      '<div class="relic-draft-sub">World ' + game.world + ' — pick one permanent perk for this run</div>' +
    '</div>' +
    '<div class="relic-draft-cards">' +
      offers.map((r, i) =>
        '<button class="relic-card" onclick="pickRelic(' + i + ')">' +
          '<div class="relic-key">' + (i + 1) + '</div>' +
          '<div class="relic-emoji">' + r.emoji + '</div>' +
          '<div class="relic-name">' + r.name + '</div>' +
          '<div class="relic-desc">' + r.desc + '</div>' +
        '</button>'
      ).join('') +
    '</div>';
}

function pickRelic(i) {
  if (!game || !game.relicDraftActive) return;
  const offers = game.relicDraftOffers || [];
  const relic = offers[i];
  if (!relic) return;
  game.relics = game.relics || [];
  game.relics.push(relic.id);
  applyRelicPickEffect(relic.id);
  game.relicDraftActive = false;
  game.relicDraftOffers = null;
  const el = document.getElementById('relic-draft');
  if (el) el.classList.remove('show');
  if (game._relicPausedAutoTimer !== undefined) {
    game.autoWaveTimer = game._relicPausedAutoTimer;
    delete game._relicPausedAutoTimer;
  }
  SFX.play('unlock');
  showBannerText('RELIC ACQUIRED', relic.name.toUpperCase(), 2200);
  spawnParticles(C.width / 2, C.height / 2, '#ffd87a', 30);
  renderRelicTray();
  if (game.relics.length >= 5) unlockAchievement('Collector', 'Held 5 relics at once in a single run');
  saveGameState();
}

// Swallow input while the draft is up: digit keys pick a relic, everything else
// is blocked from reaching the game's own hotkeys (this listener is registered
// before input.js's, so stopImmediatePropagation here wins).
document.addEventListener('keydown', e => {
  if (!game || !game.relicDraftActive) return;
  const offers = game.relicDraftOffers || [];
  const n = parseInt(e.key, 10);
  e.stopImmediatePropagation();
  if (n >= 1 && n <= offers.length) {
    e.preventDefault();
    pickRelic(n - 1);
  }
});

// --- HUD TRAY + RESULTS SCREEN CHIPS ---
function renderRelicTray() {
  const tray = document.getElementById('relic-tray');
  if (!tray) return;
  if (!game || !game.relics || !game.relics.length) {
    tray.innerHTML = '';
    tray.style.display = 'none';
    return;
  }
  tray.style.display = 'flex';
  tray.innerHTML = game.relics.map(id => {
    const r = RELICS.find(x => x.id === id);
    if (!r) return '';
    return '<div class="relic-chip" title="' + r.name + ': ' + r.desc + '">' + r.emoji + '</div>';
  }).join('');
}

function renderRelicChips(containerId) {
  const el = document.getElementById(containerId || 'go-relics');
  if (!el) return;
  if (!game || !game.relics || !game.relics.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="go-relic-label">RELICS COLLECTED</div><div class="go-relic-row">' +
    game.relics.map(id => {
      const r = RELICS.find(x => x.id === id);
      return r ? '<span class="go-relic-chip" title="' + r.desc + '">' + r.emoji + ' ' + r.name + '</span>' : '';
    }).join('') +
    '</div>';
}
