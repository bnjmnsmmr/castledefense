// ============================================================
// Elemental combos — reactive bonus damage when one tower's status
// effect (slow / poison / burn) is capitalized on by a different
// tower's attack. Hooked from damageEnemy() in js/game.js via a
// single line: `dmg = comboOnHit(e, dmg, source);`. See CLAUDE.md
// "Elemental combos" for the full rundown.
//
// Status fields read here (set elsewhere in js/game.js):
//   e.slowed   > 0  -> ice slow (any tower with `slow`, incl. upgraded Ice splash)
//   e.dotTimer > 0  -> a burn/poison tick is active
//   e.dotSrc        -> which tower applied that tick: 'poison' | 'flame' | 'cannon'
// ============================================================

const COMBO_DEFS = {
  SHATTER: { mult: 1.5, radius: 0, color: '#7fd8ff' },      // Cannon/Mortar vs slowed
  IGNITE:  { burstMult: 3, radius: 60, color: '#ff9a3d' },  // Flame/Cannon vs poisoned
  CONDUCT: { extraMult: 0.5, radius: 90, jumps: 2, color: '#ccff88' }, // Tesla vs slowed
  BRITTLE: { mult: 2, color: '#ff8844' },                   // Sniper vs burning
};
const COMBO_COOLDOWN_MS = 500; // per-enemy, so fast tickers (Flame) can't re-proc every frame

function comboReady(e) {
  return !e._comboCdUntil || performance.now() >= e._comboCdUntil;
}
function comboArm(e) {
  e._comboCdUntil = performance.now() + COMBO_COOLDOWN_MS;
}
function isPoisoned(e) {
  return e.dotTimer > 0 && e.dotSrc === 'poison';
}
function isBurning(e) {
  return e.dotTimer > 0 && (e.dotSrc === 'flame' || e.dotSrc === 'cannon');
}

function popCombo(e, name) {
  game.combos = (game.combos || 0) + 1;
  spawnDamageNum(e.x, e.y - 30, name + '!', 'combo');
  sfxTone('square', 720, 1250, 0.12, 0.22);
  if (game.combos >= 50) unlockAchievement('Alchemist', 'Triggered 50 elemental combos in one run');
}

// Called at the top of damageEnemy(e, dmg, source). `source` is the firing
// tower's TOWER_TYPES id (or undefined for hits with no combo relevance —
// hero stomps, DoT ticks, combo side-effect splashes). Returns the (possibly
// boosted) damage; any extra combo damage to OTHER enemies is applied here
// directly as a side effect.
function comboOnHit(e, dmg, source) {
  if (!e || !source || e.dead || !comboReady(e)) return dmg;

  // SHATTER: a Cannon or Mortar hit cracks a frozen/slowed enemy for bonus damage
  if ((source === 'cannon' || source === 'mortar') && e.slowed > 0) {
    comboArm(e);
    e.slowed = 0;
    dmg *= COMBO_DEFS.SHATTER.mult;
    spawnParticles(e.x, e.y, COMBO_DEFS.SHATTER.color, 10);
    popCombo(e, 'SHATTER');
    return dmg;
  }

  // IGNITE: Flame or napalm-Cannon fire detonates an active poison DoT into an
  // instant AoE burst, consuming the poison.
  if ((source === 'flame' || source === 'cannon') && isPoisoned(e)) {
    comboArm(e);
    const burst = (e.dotDmg || 4) * COMBO_DEFS.IGNITE.burstMult;
    const radius = COMBO_DEFS.IGNITE.radius;
    let othersHit = 0;
    for (const e2 of game.enemies) {
      if (e2.dead || e2 === e || e2.untargetable > 0) continue;
      if (Math.hypot(e2.x - e.x, e2.y - e.y) <= radius) {
        othersHit++;
        damageEnemy(e2, burst);
        spawnParticles(e2.x, e2.y, '#66cc44', 6);
      }
    }
    e.dotTimer = 0; e.dotDmg = 0; e.dotSrc = null; e.infect = 0;
    spawnParticles(e.x, e.y, COMBO_DEFS.IGNITE.color, 12);
    popCombo(e, 'IGNITE');
    if (othersHit >= 5) unlockAchievement('Chain Reaction', `An IGNITE burst hit ${othersHit + 1} enemies at once`);
    return dmg;
  }

  // CONDUCT: Tesla arcs off a wet/frozen enemy onto the 2 nearest other targets
  if (source === 'tesla' && e.slowed > 0) {
    comboArm(e);
    const radius = COMBO_DEFS.CONDUCT.radius;
    const nearby = game.enemies
      .filter(e2 => e2 !== e && !e2.dead && !(e2.untargetable > 0) && Math.hypot(e2.x - e.x, e2.y - e.y) <= radius)
      .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
      .slice(0, COMBO_DEFS.CONDUCT.jumps);
    for (const tgt of nearby) {
      damageEnemy(tgt, dmg * COMBO_DEFS.CONDUCT.extraMult);
      spawnParticles(tgt.x, tgt.y, COMBO_DEFS.CONDUCT.color, 5);
    }
    popCombo(e, 'CONDUCT');
    return dmg;
  }

  // BRITTLE: a Sniper round cracks a burning enemy for double damage
  if (source === 'sniper' && isBurning(e)) {
    comboArm(e);
    dmg *= COMBO_DEFS.BRITTLE.mult;
    spawnParticles(e.x, e.y, COMBO_DEFS.BRITTLE.color, 8);
    popCombo(e, 'BRITTLE');
    return dmg;
  }

  return dmg;
}

// OVERGROWTH: in the Enchanted Grove world, an active poison tick always
// spreads to the nearest un-poisoned neighbor (instead of the normal random
// Infectious-upgrade chance). Hooked with one line from the poison DoT tick
// loop in js/game.js: `overgrowthSpread(e);`
function overgrowthSpread(e) {
  if (e.dotSrc !== 'poison' || !(e.dotTimer > 0)) return;
  const theme = getWorldTheme();
  if (!theme || theme.name.indexOf('Grove') === -1) return;
  let nearest = null, nearestD = 50;
  for (const e2 of game.enemies) {
    if (e2.dead || e2 === e || e2.dotTimer > 0) continue;
    const d = Math.hypot(e2.x - e.x, e2.y - e.y);
    if (d < nearestD) { nearest = e2; nearestD = d; }
  }
  if (nearest) {
    nearest.dotTimer = e.dotTimer; nearest.dotDmg = e.dotDmg; nearest.dotTickTimer = 0;
    nearest.dotSrc = 'poison'; nearest.infect = e.infect;
    spawnParticles(nearest.x, nearest.y, '#3fbf5f', 6);
  }
}

// Results-screen stat card: total elemental combos triggered this run.
// Called with one line from endGame(): `renderComboStat(ov.querySelector('.go-grid'));`
function renderComboStat(container) {
  if (!container || !game || !game.combos) return;
  const card = document.createElement('div');
  card.className = 'go-stat';
  card.innerHTML = `<div class="go-val">${game.combos}</div><div class="go-lbl">Elemental combos</div>`;
  container.appendChild(card);
}
