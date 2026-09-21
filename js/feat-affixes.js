// ===== FEATURE: ENEMY AFFIXES / ELITES =====
// From wave 6 onward (counting continuously across worlds), each non-boss spawn has a
// chance to roll one affix, turning it into a mini-elite: a distinct ability, a pulsing
// aura ring, and a name tag. Bosses never roll an affix. Hooked from:
//  - js/game.js: spawn (affixMaybeApply), damageEnemy (affixModifyDamage, affixOnDeath),
//    reach-castle (affixOnReachCastle)
//  - js/core.js: wallDps (affixWallDpsMult)
//  - js/render-enemies.js: drawEnemies (drawAffixAura, drawAffixTag)

const AFFIX_DEFS = {
  armored:  { id: 'armored',  name: 'Armored',  color: '#9aa7b8', desc: 'takes less damage from arrows & sniper rounds' },
  hasty:    { id: 'hasty',    name: 'Hasty',    color: '#ffd23f', desc: 'much faster, but fragile' },
  splitter: { id: 'splitter', name: 'Splitter', color: '#6ecb63', desc: 'splits into rats when it dies' },
  thief:    { id: 'thief',    name: 'Thief',    color: '#ffcc33', desc: 'steals gold if it reaches the castle' },
  sapper:   { id: 'sapper',   name: 'Sapper',   color: '#d97a3d', desc: 'wrecks walls fast, tanky while doing it' },
  vampiric: { id: 'vampiric', name: 'Vampiric', color: '#c0335a', desc: 'heals off wall damage and nearby kills' },
  shielded: { id: 'shielded', name: 'Shielded', color: '#4fb8ff', desc: 'starts with a bonus shield' },
};
const AFFIX_IDS = Object.keys(AFFIX_DEFS);
const AFFIX_MIN_TOTAL_WAVE = 6;
const AFFIX_TAG_LIMIT = 30;

// --- Roll & apply (called once per non-boss spawn) ---
function affixMaybeApply(e) {
  if (!game) return;
  const totalWave = (game.world - 1) * DIFFICULTY.wavesPerWorld + game.wave;
  if (totalWave < AFFIX_MIN_TOTAL_WAVE) return;
  const chance = Math.min(DIFFICULTY.affixChance + (game.world - 1) * 0.02, 0.35);
  if (Math.random() >= chance) return;
  applyAffix(e, AFFIX_IDS[Math.floor(Math.random() * AFFIX_IDS.length)]);
}

function applyAffix(e, id) {
  e.affix = id;
  if (id === 'hasty') {
    e.speed *= 1.6;
    e.hp = Math.max(1, Math.round(e.hp * 0.7));
    e.maxHp = e.hp;
  } else if (id === 'shielded') {
    e.shieldHp = (e.shieldHp || 0) + 60;
  }
  affixAnnounce(id);
}

function affixAnnounce(id) {
  if (!game.affixesSeen) game.affixesSeen = new Set();
  if (game.affixesSeen.has(id)) return;
  game.affixesSeen.add(id);
  const def = AFFIX_DEFS[id];
  notify('epic', `ELITE SPOTTED: ${def.name} — ${def.desc}`);
}

// --- Damage taken hook: called from damageEnemy(e, dmg, source) ---
// `source` is the firing tower's id, passed cheaply from direct-hit projectiles only
// (splash/dot/chain calls omit it, so armored never reduces those, per design).
function affixModifyDamage(e, dmg, source) {
  if (!e.affix) return dmg;
  if (e.affix === 'armored' && (source === 'arrow' || source === 'sniper')) return dmg * 0.6;
  if (e.affix === 'sapper' && e.attacking) return dmg * 0.5; // tanky while adjacent to a wall
  return dmg;
}

// --- Wall damage dealt hook: called from wallDps(e) in js/core.js ---
function affixWallDpsMult(e) {
  if (!e || !e.affix) return 1;
  if (e.affix === 'vampiric' && e.attacking) {
    // Heals roughly 20% of the damage it deals to the wall, applied per frame.
    const baseDps = (5 + enemySize(e) * 0.8) * (e.boss ? 6 : 1);
    e.hp = Math.min(e.maxHp, e.hp + (baseDps * 0.2) / 60);
  }
  return e.affix === 'sapper' ? 2.5 : 1;
}

// --- Death hook: called from damageEnemy() right after game.kills++ ---
function affixOnDeath(e) {
  // Any living vampiric enemy near this kill heals a little, regardless of what died.
  for (const other of game.enemies) {
    if (other === e || other.dead || other.affix !== 'vampiric') continue;
    if (Math.hypot(other.x - e.x, other.y - e.y) < 80) {
      other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.15);
    }
  }
  if (!e.affix) return;
  game.affixKills = (game.affixKills || 0) + 1;
  if (game.affixKills === 50) unlockAchievement('Elite Hunter', 'Killed 50 affixed elite enemies in one run');
  // Elite bounty: +50% gold, +1 xp on top of the normal reward already granted.
  const def = ENEMY_DEFS[e.type];
  game.gold += Math.round((def.reward || 0) * 0.5);
  gainXP(1);
  if (e.affix === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const rat = ENEMY_DEFS[4];
      const hp = Math.max(1, Math.round(rat.hp * 0.3));
      game.enemies.push({
        type: 4, x: e.x + (Math.random() - 0.5) * 20, y: e.y + (Math.random() - 0.5) * 20,
        hp, maxHp: hp, speed: rat.speed,
        path: e.path, pathIdx: e.pathIdx, dead: false, slowed: 0,
        shieldHp: 0, healTimer: 0, necroTimer: 0, spawnT: 0.2,
      });
    }
  }
}

// --- Reach-castle hook: called from the move loop right after game.hp -= dmg ---
function affixOnReachCastle(e) {
  if (!game || e.affix !== 'thief') return;
  const stolen = Math.max(15, Math.round(game.gold * 0.1));
  game.gold = Math.max(0, game.gold - stolen);
  showFlash(`A thief made off with ${stolen} gold!`);
  spawnParticles(e.x, e.y, '#ffd700', 10);
}

// --- Rendering hooks: called from drawEnemies() in js/render-enemies.js ---
let affixTagsDrawnThisFrame = 0;
function drawAffixAura(e) {
  // Called for every rendered enemy, affixed or not — also doubles as our per-frame
  // tag-budget reset point (fires once, on the first surviving entry of the pass).
  if (game.enemies[0] === e) affixTagsDrawnThisFrame = 0;
  if (!e.affix || e.dead) return;
  const def = AFFIX_DEFS[e.affix];
  const es = enemySize(e);
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260 + e.x * 0.05);
  ctx.save();
  ctx.globalAlpha = 0.35 + pulse * 0.25;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const rx = es * 1.15 + pulse * 2;
  ctx.ellipse(0, es * 0.3, rx, rx * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawAffixTag(e) {
  if (!e.affix || e.dead) return;
  const es = enemySize(e);
  if (es < 8) return; // only worth labeling elites big enough to read
  if (affixTagsDrawnThisFrame >= AFFIX_TAG_LIMIT) return;
  affixTagsDrawnThisFrame++;
  const def = AFFIX_DEFS[e.affix];
  const label = def.name.toUpperCase();
  const ty = e.y - es - (es >= 16 ? 24 : 18);
  ctx.save();
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(label).width + 6;
  ctx.fillStyle = 'rgba(10,8,6,0.72)';
  ctx.fillRect(e.x - w / 2, ty - 9, w, 11);
  ctx.fillStyle = def.color;
  ctx.fillText(label, e.x, ty);
  ctx.restore();
}
