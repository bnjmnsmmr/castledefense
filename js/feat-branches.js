// ===== FEATURE: TOWER SPECIALIZATION BRANCHES =====
// At level 3, a tower's next upgrade point offers a choice between two
// specializations instead of applying automatically. The choice is permanent
// for the run (`t.branch`), the level-up point is spent only once a card is
// picked, and levels 4-5 keep scaling on top of it as before.

const TOWER_BRANCHES = {
  arrow: [
    { id: 'multishot', name: 'Multishot', desc: 'Fires 3 bolts per shot at 70% damage each.',
      apply(t, def) { def.dmg *= 0.7; } },
    { id: 'piercing', name: 'Piercing', desc: 'Bolts pass through, hitting up to 3 enemies in a line.',
      apply() {} },
  ],
  cannon: [
    { id: 'cluster', name: 'Cluster', desc: 'Splash radius increased by 60%.',
      apply(t, def) { def.splash *= 1.6; } },
    { id: 'siege', name: 'Siege', desc: 'Damage x1.8, but reloads noticeably slower.',
      apply(t, def) { def.dmg *= 1.8; def.rate /= 0.7; } },
  ],
  ice: [
    { id: 'frostnova', name: 'Frost Nova', desc: 'Every 4th shot slows every enemy in range.',
      apply() {} },
    { id: 'permafrost', name: 'Permafrost', desc: 'Slow strength 0.4 -> 0.65, duration x1.5.',
      apply(t, def) { def.slow = 0.65; def.slowDur *= 1.5; } },
  ],
  sniper: [
    { id: 'headshot', name: 'Headshot', desc: '25% chance to fire a x3 damage critical shot.',
      apply() {} },
    { id: 'longshot', name: 'Longshot', desc: 'Range x1.4, damage x1.15.',
      apply(t, def) { def.range *= 1.4; def.dmg *= 1.15; } },
  ],
  tesla: [
    { id: 'overcharge', name: 'Overcharge', desc: 'Lightning chains to 6 enemies instead of 3.',
      apply(t, def) { def.chain = 6; } },
    { id: 'capacitor', name: 'Capacitor', desc: 'Ammo capacity x2, damage x1.3.',
      apply(t, def) { def.ammo = Math.round(def.ammo * 2); def.dmg *= 1.3; } },
  ],
  flame: [
    { id: 'inferno', name: 'Inferno', desc: 'Cone damage x1.6.',
      apply(t, def) { def.dmg *= 1.6; } },
    { id: 'wildfire', name: 'Wildfire', desc: 'Burning enemies spread the fire to a neighbor on death.',
      apply() {} },
  ],
  mortar: [
    { id: 'carpet', name: 'Carpet', desc: 'Splash radius x1.5.',
      apply(t, def) { def.splash *= 1.5; } },
    { id: 'bunkerbuster', name: 'Bunker Buster', desc: 'Damage x2 against bosses and tanky enemies.',
      apply() {} },
  ],
  poison: [
    { id: 'plague', name: 'Plague', desc: 'The infection spreads farther and more often.',
      apply() {} },
    { id: 'venom', name: 'Venom', desc: 'Poison tick damage x2.',
      apply(t, def) { def.dot *= 2; } },
  ],
  goldmine: [
    { id: 'deepvein', name: 'Deep Vein', desc: 'Income x1.5.',
      apply() {} },
    { id: 'bank', name: 'Bank', desc: '+3% of current gold as interest on every wave clear (cap 50g).',
      apply() {} },
  ],
};

// Reads the chosen branch (if any) for a tower id and returns the pair.
function branchPairFor(towerId) { return TOWER_BRANCHES[towerId] || null; }
function branchDefFor(towerId, branchId) {
  const pair = branchPairFor(towerId);
  return pair ? pair.find(b => b.id === branchId) : null;
}

// Simple multiplier lookup for stat-only branches, e.g. branchStat(t, 'dmg', base.dmg).
// Most stat changes are applied wholesale via branchModifyDef below; this helper is for
// call sites that want a single stat outside that pipeline.
const BRANCH_STAT_MULT = {
  cannon:  { cluster: { splash: 1.6 }, siege: { dmg: 1.8, rate: 1/0.7 } },
  ice:     { permafrost: { slowDur: 1.5 } },
  sniper:  { longshot: { range: 1.4, dmg: 1.15 } },
  tesla:   { capacitor: { ammo: 2, dmg: 1.3 } },
  flame:   { inferno: { dmg: 1.6 } },
  mortar:  { carpet: { splash: 1.5 } },
  poison:  { venom: { dot: 2 } },
  arrow:   { multishot: { dmg: 0.7 } },
};
function branchStat(t, statKey, base) {
  if (!t.branch) return base;
  const towerId = TOWER_TYPES[t.type].id;
  const mult = BRANCH_STAT_MULT[towerId] && BRANCH_STAT_MULT[towerId][t.branch] && BRANCH_STAT_MULT[towerId][t.branch][statKey];
  return mult ? base * mult : base;
}

// Called once per tower per frame right after the level-based `def` is built.
// Mutates `def` in place via the branch's own apply(t, def, base) and returns it.
function branchModifyDef(t, def, base) {
  const chosen = branchDefFor(base.id, t.branch);
  if (chosen && chosen.apply) chosen.apply(t, def, base);
  return def;
}

// Ice / Frost Nova: every 4th shot pulses a slow across the whole range, on top of
// whatever the projectile itself does.
function branchFrostNovaPulse(t, def, cx, cy) {
  t.branchShotCount = (t.branchShotCount || 0) + 1;
  if (t.branchShotCount % 4 !== 0) return;
  for (const e of game.enemies) {
    if (e.dead || e.untargetable > 0) continue;
    if (Math.hypot(e.x - cx, e.y - cy) <= def.range) {
      e.slowed = Math.max(e.slowed || 0, def.slowDur || 2.5);
    }
  }
  spawnParticles(cx, cy, '#bbffff', 18);
}

// Mortar / Bunker Buster: double damage vs bosses and tanky enemies (size >= 14).
// Called wherever a projectile's splash/direct damage is finally computed.
function branchProjectileDmg(p, e, dmg) {
  if (p && p.branch === 'bunkerbuster' && enemySize(e) >= 14) return dmg * 2;
  return dmg;
}

// Flame / Wildfire: wrap damageEnemy (a reassignable `function` global) so that when a
// burning, wildfire-branched enemy dies, the burn jumps to the nearest healthy neighbor.
const _origDamageEnemyForBranches = damageEnemy;
damageEnemy = function branchDamageEnemyWrap(e, dmg, source) {
  const wasAlive = !e.dead;
  const burning = wasAlive && e.dotTimer > 0 && e.branch === 'wildfire';
  const burnDmg = e.dotDmg, burnDur = e.dotTimer;
  _origDamageEnemyForBranches(e, dmg, source); // forward `source` — affix/combo/inspect-card hooks depend on it
  if (burning && e.dead) branchWildfireSpread(e, burnDmg, burnDur);
};
function branchWildfireSpread(e, dmg, dur) {
  let nearest = null, nearestD = Infinity;
  for (const e2 of game.enemies) {
    if (e2.dead || e2 === e || e2.dotTimer > 0) continue;
    const d = Math.hypot(e2.x - e.x, e2.y - e.y);
    if (d < 70 && d < nearestD) { nearest = e2; nearestD = d; }
  }
  if (nearest) {
    nearest.dotTimer = Math.max(2, dur); nearest.dotDmg = dmg; nearest.dotTickTimer = 0;
    nearest.branch = 'wildfire';
    spawnParticles(nearest.x, nearest.y, '#ff8822', 10);
  }
}

// Gold Mine / Bank: +3% of current gold as interest per Bank tower, on every wave clear.
function applyBankInterest() {
  if (!game) return;
  for (const t of game.towers) {
    if (t.branch !== 'bank' || TOWER_TYPES[t.type].id !== 'goldmine') continue;
    const interest = Math.min(50, Math.round(game.gold * 0.03));
    if (interest > 0) {
      game.gold += interest;
      spawnDamageNum(t.tx * TILE + TILE/2, t.ty * TILE + TILE/2 - 20, '+' + interest, 'gold');
      spawnParticles(t.tx * TILE + TILE/2, t.ty * TILE + TILE/2, '#ffd700', 4);
    }
  }
}

// ===== Branch chooser UI =====
// A translucent panel over the map with two big cards. Opens instead of applying the
// level-3 upgrade immediately; the point is spent only once a card (or key 1/2) is picked.
let branchChooserTower = null;

function ensureBranchChooserEl() {
  let el = document.getElementById('branch-chooser');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'branch-chooser';
  el.innerHTML = `
    <div class="branch-chooser-inner">
      <div class="branch-chooser-title">Choose a specialization</div>
      <div class="branch-chooser-sub"></div>
      <div class="branch-cards"></div>
      <div class="branch-chooser-hint">Press <b>1</b> / <b>2</b> to pick, <b>Esc</b> to decide later</div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function openBranchChooser(t) {
  const towerId = TOWER_TYPES[t.type].id;
  const pair = branchPairFor(towerId);
  if (!pair) return;
  branchChooserTower = t;
  const el = ensureBranchChooserEl();
  el.querySelector('.branch-chooser-sub').textContent = `${TOWER_TYPES[t.type].name} — Level 3`;
  const cardsEl = el.querySelector('.branch-cards');
  cardsEl.innerHTML = '';
  pair.forEach((b, i) => {
    const card = document.createElement('div');
    card.className = 'branch-card';
    card.innerHTML = `<div class="branch-card-key">${i + 1}</div>
      <div class="branch-card-name">${b.name}</div>
      <div class="branch-card-desc">${b.desc}</div>`;
    card.addEventListener('click', () => pickBranch(t, b.id));
    cardsEl.appendChild(card);
  });
  el.classList.add('show');
  if (game) game.paused = true;
}

function closeBranchChooser() {
  const el = document.getElementById('branch-chooser');
  if (el) el.classList.remove('show');
  branchChooserTower = null;
  if (game) { game.paused = false; saveGameState(); }
}

function pickBranch(t, branchId) {
  if (!t || branchChooserTower !== t) return;
  const towerId = TOWER_TYPES[t.type].id;
  const b = branchDefFor(towerId, branchId);
  if (!b) return;
  t.level = 3;
  t.branch = branchId;
  game.upgradesSpent++;
  game.branchesChosen = (game.branchesChosen || 0) + 1;
  SFX.play('upgrade');
  tutorialEvent('upgrade');
  spawnParticles(t.tx * TILE + TILE/2, t.ty * TILE + TILE/2, '#ffd700', 20);
  showFlash(`⬆️ ${TOWER_TYPES[t.type].name} specialized: ${b.name}!`);
  if (game.branchesChosen >= 5) unlockAchievement('Specialist', 'Chose a specialization for 5 towers in a single run');
  closeBranchChooser();
  updateUI();
}

document.addEventListener('keydown', e => {
  if (!branchChooserTower) return;
  if (e.key === '1') pickBranch(branchChooserTower, TOWER_BRANCHES[TOWER_TYPES[branchChooserTower.type].id][0].id);
  else if (e.key === '2') pickBranch(branchChooserTower, TOWER_BRANCHES[TOWER_TYPES[branchChooserTower.type].id][1].id);
  else if (e.key === 'Escape') closeBranchChooser();
});

// Tiny colored badge drawn on a branched tower (render-world.js drawTowers hook).
const BRANCH_BADGE_COLORS = { 0: '#ffd87a', 1: '#9b6dd6' };
function drawBranchBadge(t, cx, cy) {
  if (!t.branch) return;
  const towerId = TOWER_TYPES[t.type].id;
  const pair = branchPairFor(towerId);
  if (!pair) return;
  const idx = pair.findIndex(b => b.id === t.branch);
  const color = BRANCH_BADGE_COLORS[idx] || '#ffd87a';
  const bx = t.tx * TILE + TILE - 7, by = t.ty * TILE + 7;
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#1a1512';
  ctx.stroke();
  ctx.fillStyle = '#1a1512';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(idx === 0 ? '★' : '◆', bx, by + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
