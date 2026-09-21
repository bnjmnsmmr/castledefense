// ===== FEATURE: STRUCTURED ENDLESS WITH STORM MUTATORS =====
// Worlds 1..WORLD_THEMES.length (8) are the authored campaign: `game.wave` is the per-world
// counter (reset to 1 each world, see the wave-complete handler in js/game.js update()).
// Once the player clears the campaign the run is ENDLESS: `endlessWaveNumber()` maps every
// later wave onto a continuous counter that starts at 31, and from there waves are grouped
// into deterministic 5-wave STORMS — a themed enemy mix plus a run-wide mutator. A single
// long world (admin panel: raise "Waves per World" past 30) reaches the storms too.
// Everything here is seeded off game.runSeed (or the Daily Challenge's game.dailySeed) mixed
// with an integer key via mulberry32 (js/render-world.js) — never Math.random() — so a given
// seed always produces the same sequence of storms.

// --- ENDLESS WAVE NUMBERING ---
// Returns the storm-space wave number for a per-world wave: unchanged during the campaign,
// 31+ once the world index is past the last authored world.
function endlessWaveNumber(wave, world) {
  if (typeof game !== 'undefined' && game && world === undefined) world = game.world;
  world = world || 1;
  const campaign = WORLD_THEMES.length;
  if (world > campaign) return 30 + (world - campaign - 1) * DIFFICULTY.wavesPerWorld + wave;
  return wave;
}

const STORM_THEMES = [
  { id: 'swarm', name: 'SWARM STORM', types: [4, 1] },     // rats + goblins
  { id: 'iron',  name: 'IRON STORM',  types: [2, 7] },     // tanks + shields
  { id: 'night', name: 'NIGHT STORM', types: [6, 5, 8] },  // bats + wizards + necros
  { id: 'siege', name: 'SIEGE STORM', types: [2, 3] },     // ogres + dark knights
];

const STORM_MUTATORS = [
  { id: 'fog',       name: 'Fog',        icon: '🌫️', desc: 'Tower range −25%' },
  { id: 'bloodmoon', name: 'Blood Moon', icon: '🌕', desc: 'Enemy HP ×2, kill gold ×2' },
  { id: 'plague',    name: 'Plague',     icon: '☠️', desc: 'Every 3rd spawn is a wizard' },
  { id: 'quake',     name: 'Quake',      icon: '💥', desc: 'Walls take ×2 damage' },
  { id: 'frenzy',    name: 'Frenzy',     icon: '⚡', desc: 'Enemy speed ×1.3 (2 waves half-size)' },
  { id: 'goldrush',  name: 'Gold Rush',  icon: '💰', desc: 'Double crates, +30% kill gold' },
  { id: 'eclipse',   name: 'Eclipse',    icon: '🌑', desc: 'One tower type offline' },
];

function stormWaveLen() { return DIFFICULTY.stormWaveLength || 5; }

// --- SEEDING ---
function stormRunSeed() {
  if (typeof game === 'undefined' || !game) return 1;
  return (game.dailyChallenge ? game.dailySeed : game.runSeed) || 1;
}
// Mixes the run seed with an arbitrary integer key into a fresh mulberry32 stream, so
// different call sites (per-wave composition vs. per-storm theme pick) never collide.
function stormRng(key) {
  const seed = (stormRunSeed() ^ Math.imul(key | 0, 2654435761)) >>> 0;
  return mulberry32(seed);
}

// --- STORM STRUCTURE ---
function stormIndexFor(n) {
  return n > 30 ? Math.floor((n - 31) / stormWaveLen()) + 1 : 0;
}
function stormOffsetFor(n) { return (n - 31) % stormWaveLen(); } // 0-based position within the storm

// Which two of the storm's waves run at half size under Frenzy — deterministic per storm.
function frenzyHalfOffsets(stormIndex) {
  const rng = stormRng(900000 + stormIndex);
  const pool = []; for (let i = 0; i < stormWaveLen(); i++) pool.push(i);
  const a = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const b = pool.length ? pool[Math.floor(rng() * pool.length)] : a;
  return [a, b];
}

// Returns { index, offset, theme, mutator, eclipseTowerId } for wave n, or null before storms begin.
function stormFor(n) {
  const index = stormIndexFor(n);
  if (index <= 0) return null;
  let theme, mutator;
  if (index === 1) {
    theme = STORM_THEMES[0]; mutator = STORM_MUTATORS[0]; // gentle intro: Swarm Storm + Fog
  } else {
    const rng = stormRng(index);
    theme = STORM_THEMES[Math.floor(rng() * STORM_THEMES.length)];
    mutator = STORM_MUTATORS[Math.floor(rng() * STORM_MUTATORS.length)];
  }
  let eclipseTowerId = null;
  if (mutator.id === 'eclipse') {
    const rng = stormRng(500000 + index);
    const eligible = TOWER_TYPES.filter(t => !t.secret && !t.income);
    eclipseTowerId = eligible[Math.floor(rng() * eligible.length)].id;
  }
  return { index, offset: stormOffsetFor(n), theme, mutator, eclipseTowerId };
}
// The storm (if any) governing the wave currently loaded into `game`.
function activeStorm() { return (typeof game !== 'undefined' && game) ? stormFor(endlessWaveNumber(game.wave)) : null; }

// --- WAVE COMPOSITION ---
// Called from js/waves.js getWave() in place of the old Math.random() endless branch.
// Pushes spawns via the same spawn()/fill() closures getWave() already builds; the caller's
// scaling code (hpMult/spdMult, upgrade/world escalation) still runs afterward untouched.
function endlessWave(n, base, spawn, fill, waves) {
  const storm = stormFor(n);
  const rng = stormRng(n);
  let count = base + Math.floor(n * 0.8);
  if (storm.mutator.id === 'frenzy' && frenzyHalfOffsets(storm.index).includes(storm.offset)) {
    count = Math.max(3, Math.round(count * 0.5));
  }
  const types = storm.theme.types;
  for (let i = 0; i < count; i++) {
    const t = (storm.mutator.id === 'plague' && (i + 1) % 3 === 0) ? 5 : types[Math.floor(rng() * types.length)];
    spawn(t, i * Math.max(0.1, 0.35 - n * 0.005));
  }
  // A themed reinforcement wedge, echoing the density the old random soup had past wave 30.
  if (n % 2 === 0) {
    const reinforceType = types[types.length - 1];
    for (let i = 0; i < Math.floor(n / 6); i++) spawn(reinforceType, count * 0.2 + i * 0.8);
  }
}

// --- MUTATOR HOOKS (pure multipliers/queries, one-line call sites in js/game.js & js/core.js) ---
function stormRangeMult() { const s = activeStorm(); return (s && s.mutator.id === 'fog') ? 0.75 : 1; }
function stormHpMult()    { const s = activeStorm(); return (s && s.mutator.id === 'bloodmoon') ? 2 : 1; }
function stormSpeedMult() { const s = activeStorm(); return (s && s.mutator.id === 'frenzy') ? 1.3 : 1; }
function stormWallDmgMult(){ const s = activeStorm(); return (s && s.mutator.id === 'quake') ? 2 : 1; }
function stormCrateMult() { const s = activeStorm(); return (s && s.mutator.id === 'goldrush') ? 2 : 1; }
function stormGoldMult() {
  const s = activeStorm();
  if (!s) return 1;
  if (s.mutator.id === 'bloodmoon') return 2;
  if (s.mutator.id === 'goldrush') return 1.3;
  return 1;
}
function stormTowerOffline(towerId) {
  const s = activeStorm();
  return !!(s && s.mutator.id === 'eclipse' && s.eclipseTowerId === towerId);
}

// --- MINI-BOSS (called from js/waves.js spawnWave(); a no-op until the run is in storm territory) ---
// Every 5th (final) wave of a storm gets the current world's named boss as a mini-boss,
// at reduced HP so it reads as a checkpoint rather than the full world-ending fight.
function addStormMiniBoss() {
  const s = stormFor(endlessWaveNumber(game.wave));
  if (!s || s.offset !== stormWaveLen() - 1) return;
  const bd = getBossForWorld(game.world);
  const maxDelay = game.waveEnemies.length ? Math.max(...game.waveEnemies.map(w => w.delay)) : 0;
  const ref = game.waveEnemies[0] || { hpMult: 1, spdMult: 1 };
  game.waveEnemies.push({
    type: bd.type, delay: maxDelay + 2.5,
    hpMult: ref.hpMult * 0.4, spdMult: ref.spdMult, bossId: bd.id,
  });
}

// --- PRESENTATION ---
function updateStormChip() {
  const chip = $id('storm-chip');
  if (!chip) return;
  const s = activeStorm();
  if (!s) { chip.style.display = 'none'; return; }
  chip.style.display = 'flex';
  chip.textContent = s.mutator.icon + ' ' + s.theme.name + ' — ' + s.mutator.name;
}
// Called once per sent wave (js/waves.js sendWave()): keeps the HUD chip in sync every
// wave, and announces a new storm with a banner the moment its first wave goes out.
function announceStormIfNew() {
  const s = activeStorm();
  updateStormChip();
  if (!s || s.offset !== 0) return;
  showBannerText('STORM ' + toStormNumeral(s.index) + ' — ' + s.theme.name,
    'Mutator: ' + s.mutator.name + ' — ' + s.mutator.desc, 3200);
  if (s.mutator.id === 'eclipse') {
    const t = TOWER_TYPES.find(x => x.id === s.eclipseTowerId);
    showFlash('🌑 ' + (t ? t.name : 'A tower') + ' towers are OFFLINE for this storm');
  }
}
function toStormNumeral(n) {
  const table = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
  return table[n - 1] || String(n);
}
// Subtle full-screen tint while a storm mutator is active. One-line hook at the end of render().
function drawStormOverlay() {
  const s = activeStorm();
  if (!s || !game) return;
  const TINTS = {
    fog: 'rgba(180,190,200,0.10)', bloodmoon: 'rgba(150,20,20,0.12)', plague: 'rgba(90,140,60,0.10)',
    quake: 'rgba(160,110,40,0.10)', frenzy: 'rgba(220,180,40,0.08)', goldrush: 'rgba(232,182,76,0.10)',
    eclipse: 'rgba(20,10,40,0.18)',
  };
  const tint = TINTS[s.mutator.id];
  if (!tint) return;
  ctx.save();
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, C.width, C.height);
  ctx.restore();
}

// --- COMPLETION, SCORE BONUS & ACHIEVEMENTS ---
// Called from js/game.js's wave-complete handler, before game.wave increments — credits the
// storm once its final wave clears. `stormMult` is a display-only bonus; it never touches
// the (world-1)*wavesPerWorld+wave score the server/local Hall of Fame record.
function checkStormComplete(clearedWave) {
  const s = stormFor(endlessWaveNumber(clearedWave));
  if (!s || s.offset !== stormWaveLen() - 1) return;
  game.stormsSurvived = (game.stormsSurvived || 0) + 1;
  game.stormMult = 1 + (DIFFICULTY.stormScoreBonusPerStorm || 0.25) * game.stormsSurvived;
  notify('epic', `Storm survived! Score bonus now ×${game.stormMult.toFixed(2)}`);
  if (game.stormsSurvived >= 3) unlockAchievement('Storm Chaser', 'Survived 3 storms in a single endless run');
  if (s.mutator.id === 'eclipse') unlockAchievement('Eye of the Storm', 'Survived an Eclipse storm with a tower type offline');
}
function stormScoreBonus() {
  if (typeof game === 'undefined' || !game || !game.stormsSurvived) return 0;
  const runScore = (game.world - 1) * DIFFICULTY.wavesPerWorld + game.wave;
  return Math.round(((game.stormMult || 1) - 1) * runScore);
}
// One-line hook from js/game.js endGame(): appends a "STORM BONUS" card to the results grid.
function renderStormStat(container) {
  if (!container || !game || !game.stormsSurvived) return;
  const div = document.createElement('div');
  div.className = 'go-stat';
  div.innerHTML = `<div class="go-val">+${stormScoreBonus()}</div><div class="go-lbl">STORM BONUS</div>` +
    `<div class="go-delta">${game.stormsSurvived} storm${game.stormsSurvived > 1 ? 's' : ''} survived · ×${(game.stormMult || 1).toFixed(2)}</div>`;
  container.appendChild(div);
}
