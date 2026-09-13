// ===== FEATURE: NEXT-WAVE INTEL PANEL =====
// Prep-phase panel docked above SEND WAVE: enemy composition, lane warnings,
// boss warning, and a rough "can my DPS handle this HP" estimate. Also paints
// an animated hint on the map at a newly-unlocked lane's spawn tile.
// Driven by explicit hooks (not per-frame polling) — see updateWaveIntel() callers
// in js/game.js (startGame/update), js/screens.js (startDailyChallenge, setGameChromeVisible),
// and js/waves.js (sendWave).

// One small offscreen canvas per enemy type, drawn once via the real ENEMY_DRAWERS
// and reused thereafter. Falls back to a colored dot if a drawer needs live enemy
// state it doesn't have here (only the shield bearer does).
const intelIconCache = {};
function getIntelIcon(type) {
  if (intelIconCache[type]) return intelIconCache[type];
  const SZ = 40;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SZ;
  const cctx = cv.getContext('2d');
  const mainCtx = ctx; // `ctx` is the global, retargetable canvas context (see render-enemies.js)
  let drew = false;
  try {
    ctx = cctx;
    ctx.save();
    ctx.translate(SZ / 2, SZ / 2 + 4);
    const def = ENEMY_DEFS[type] || {};
    ENEMY_DRAWERS[type](1.3, false, 0, { shieldHp: def.shield || 1 });
    ctx.restore();
    drew = true;
  } catch (e) {
    // Fall through to the dot fallback below.
  } finally {
    ctx = mainCtx; // always restore — the real game loop depends on this
  }
  if (!drew) {
    cctx.clearRect(0, 0, SZ, SZ);
    cctx.beginPath();
    cctx.arc(SZ / 2, SZ / 2, SZ * 0.3, 0, Math.PI * 2);
    cctx.fillStyle = (ENEMY_DEFS[type] && ENEMY_DEFS[type].color) || '#999';
    cctx.fill();
  }
  intelIconCache[type] = cv;
  return cv;
}

// One-line trait blurb per enemy, derived from ENEMY_DEFS flags where they exist
// (flying/shield) and from the type's known behavior otherwise (heals/revives have
// no boolean flag — see the comments next to ENEMY_DEFS in js/config.js).
function intelEnemyTrait(type) {
  const def = ENEMY_DEFS[type];
  if (!def) return null;
  if (def.flying) return 'Flies — ignores walls';
  if (def.shield) return `Shielded (${def.shield} HP)`;
  if (def.id === 'wizard') return 'Heals nearby allies';
  if (def.id === 'necro') return 'Revives fallen enemies';
  if (def.id === 'tank') return 'Heavy tank';
  if (def.id === 'fast') return 'Fast mover';
  if (def.id === 'swarm') return 'Weak but numerous';
  return null;
}

// Pure data crunch for the upcoming wave — no DOM here so it's cheap to call once
// per prep-phase transition and once per rAF frame for the map hint.
function computeWaveIntel() {
  if (!game) return null;
  const wave = getWave(game.wave);
  const counts = new Map();
  for (const w of wave) counts.set(w.type, (counts.get(w.type) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const curPaths = getActivePaths(game.wave);
  const prevPaths = getActivePaths(Math.max(1, game.wave - 1));
  const newLane = curPaths.length > prevPaths.length ? curPaths[curPaths.length - 1] : null;

  const isBossWave = game.wave === DIFFICULTY.wavesPerWorld && !game.dailyChallenge;
  const bossDef = isBossWave ? getBossForWorld(game.world) : null;

  // Rough total enemy HP for the wave (mirrors the hp formula in js/game.js's spawn path)
  let totalHp = 0;
  for (const w of wave) {
    let hp = (ENEMY_DEFS[w.type] ? ENEMY_DEFS[w.type].hp : 0) * (w.hpMult || 1);
    if (w.bossId) {
      const bd = BOSS_DEFS.find(b => b.id === w.bossId);
      if (bd) hp *= bd.hpMult;
    }
    totalHp += hp;
  }
  const maxDelay = wave.length ? Math.max(...wave.map(w => w.delay)) : 0;
  const waveDuration = maxDelay + 10; // rough: last spawn + time to walk in and die

  // Rough tower DPS (ignores splash/chain/dot bonuses and range/uptime — labeled as an estimate)
  let dps = 0;
  for (const t of game.towers) {
    const base = TOWER_TYPES[t.type];
    if (!base || base.income || !base.rate) continue;
    const lvl = t.level || 0;
    const dmg = base.dmg * (1 + lvl * (DIFFICULTY.towerUpgradeDmgPerLevel || 0));
    const rate = base.rate * Math.pow(DIFFICULTY.towerUpgradeRateMult || 1, lvl);
    if (rate > 0) dps += dmg / rate;
  }
  const timeToClear = totalHp / Math.max(dps, 0.01);
  let hpLevel = 'danger';
  if (dps > 0) {
    if (timeToClear < waveDuration * 0.6) hpLevel = 'comfortable';
    else if (timeToClear < waveDuration * 1.1) hpLevel = 'tight';
  }

  return { wave, groups, newLane, isBossWave, bossDef, totalHp, dps, hpLevel };
}

let waveIntelCollapsed = false;
try { waveIntelCollapsed = localStorage.getItem('castleDefenseIntelCollapsed') === 'true'; } catch (e) {}

function toggleWaveIntelCollapsed() {
  waveIntelCollapsed = !waveIntelCollapsed;
  try { localStorage.setItem('castleDefenseIntelCollapsed', String(waveIntelCollapsed)); } catch (e) {}
  const panel = $id('wave-intel');
  if (panel) panel.classList.toggle('collapsed', waveIntelCollapsed);
}

function hideWaveIntel() {
  const panel = $id('wave-intel');
  if (panel) panel.style.display = 'none';
}

// Called at every point game.prepPhase becomes true (see hook call sites above).
function updateWaveIntel() {
  const panel = $id('wave-intel');
  if (!panel) return;
  if (!game || !game.prepPhase || game.gameOver) { panel.style.display = 'none'; return; }

  const data = computeWaveIntel();
  if (!data) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  panel.classList.toggle('collapsed', waveIntelCollapsed);

  const waveLbl = $id('wi-wave-label');
  if (waveLbl) waveLbl.textContent = 'NEXT: WAVE ' + game.wave;

  const iconsEl = $id('wi-icons');
  if (iconsEl) {
    iconsEl.innerHTML = '';
    for (const [type, count] of data.groups) {
      const item = document.createElement('div');
      item.className = 'wi-icon-item';
      const trait = intelEnemyTrait(type);
      const name = ENEMY_NAMES[type] || 'FOES';
      item.title = name + (trait ? ' — ' + trait : '');
      item.appendChild(getIntelIcon(type));
      const cnt = document.createElement('span');
      cnt.className = 'wi-count';
      cnt.textContent = '×' + count;
      item.appendChild(cnt);
      iconsEl.appendChild(item);
    }
    if (data.isBossWave && data.bossDef) {
      const bossItem = document.createElement('div');
      bossItem.className = 'wi-icon-item wi-boss-icon';
      const abilities = (data.bossDef.abilities || []).map(a => BOSS_ABILITY_LABEL[a] || a.toUpperCase()).join(', ');
      bossItem.title = data.bossDef.name + ' — ' + abilities;
      bossItem.textContent = '💀';
      iconsEl.appendChild(bossItem);
    }
  }

  const lanesEl = $id('wi-lanes');
  if (lanesEl) {
    lanesEl.innerHTML = '';
    for (const p of ALL_PATHS) {
      const chip = document.createElement('span');
      const active = game.wave >= p.unlockWave;
      const isNew = data.newLane === p;
      chip.className = 'wi-lane' + (active ? ' active' : '') + (isNew ? ' new-route' : '');
      chip.textContent = (isNew ? '⚠ ' : '') + p.label;
      lanesEl.appendChild(chip);
    }
  }

  const bossEl = $id('wi-boss');
  if (bossEl) {
    if (data.isBossWave && data.bossDef) {
      const abilities = (data.bossDef.abilities || []).map(a => BOSS_ABILITY_LABEL[a] || a.toUpperCase()).join(' · ');
      bossEl.innerHTML = `<span class="wi-skull">💀</span> <b>${data.bossDef.name}</b> incoming — ${abilities}`;
      bossEl.style.display = 'block';
    } else {
      bossEl.style.display = 'none';
    }
  }

  const hpEl = $id('wi-hp');
  if (hpEl) {
    const labelMap = { comfortable: 'COMFORTABLE', tight: 'TIGHT', danger: 'DANGER' };
    hpEl.className = 'wi-hp-bar wi-' + data.hpLevel;
    hpEl.innerHTML = `Est. threat: <b>${labelMap[data.hpLevel]}</b>`;
    hpEl.title = `Estimated enemy HP ~${Math.round(data.totalHp)} vs your tower DPS ~${Math.round(data.dps)} (rough estimate, ignores splash/DoT)`;
  }
}

// Called once per frame from render() while prepPhase is true — draws a pulsing
// glow + arrow at a newly-unlocked lane's spawn tile plus a dashed preview of the
// lane itself, so a new route is visible on the map, not just listed in the panel.
function drawIntelMapHints() {
  if (!game || !game.prepPhase) return;
  const curPaths = getActivePaths(game.wave);
  const prevPaths = getActivePaths(Math.max(1, game.wave - 1));
  const newLane = curPaths.length > prevPaths.length ? curPaths[curPaths.length - 1] : null;
  if (!newLane || !newLane.tiles.length) return;

  const t = Date.now() / 1000;
  const pulse = (Math.sin(t * 3) + 1) / 2; // 0..1

  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -t * 20;
  ctx.strokeStyle = `rgba(232,182,76,${0.3 + pulse * 0.25})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  newLane.tiles.forEach(([tx, ty], i) => {
    const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  const [sx, sy] = newLane.tiles[0];
  const px = sx * TILE + TILE / 2, py = sy * TILE + TILE / 2;
  const r = 14 + pulse * 8;
  const grad = ctx.createRadialGradient(px, py, 2, px, py, r);
  grad.addColorStop(0, `rgba(255,80,60,${0.55 + pulse * 0.25})`);
  grad.addColorStop(1, 'rgba(255,80,60,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();

  if (newLane.tiles.length > 1) {
    const [nx, ny] = newLane.tiles[1];
    const ang = Math.atan2(ny - sy, nx - sx);
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.translate(4 + pulse * 3, 0);
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(2, -7); ctx.lineTo(2, 7); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
