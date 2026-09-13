// ===== FEATURE: Castle Powers (active spells on a mana bar) =====
// Four active spells — Fireball / Rally / Frost / Repair — burn `game.mana` (0-100) on
// independent cooldowns. Mana charges from kills (`DIFFICULTY.manaPerKill`, bosses +25)
// and slowly over time while a wave is active (`DIFFICULTY.manaRegen`/s). Usable only
// while a run is live and not paused/game-over; only Repair works during the prep phase.
// HUD: `#powers-bar` (vertical stack, built once by `buildPowersBar`); `updatePowersBar(dt)`
// is called every frame from `loop()` to tick cooldowns/regen and refresh the DOM cheaply.

const POWERS = [
  { id: 'fireball', emoji: '🔥', key: 'F', name: 'Fireball', cost: 35, cooldown: 12, radius: 90 },
  { id: 'rally',     emoji: '⚡', key: 'G', name: 'Rally',    cost: 25, cooldown: 20 },
  { id: 'frost',     emoji: '❄️', key: 'V', name: 'Frost',    cost: 30, cooldown: 18, dur: 4, slow: 0.6 },
  { id: 'repair',    emoji: '🔨', key: 'H', name: 'Repair',   cost: 40, cooldown: 25 },
];

function powersReady() {
  return !!(game && game.running && !game.paused && !game.gameOver);
}
// Everything but Repair is locked out during the prep phase (no enemies to hit, nothing to rally against).
function powerAvailable(p) {
  if (!powersReady()) return false;
  if (game.prepPhase && p.id !== 'repair') return false;
  return true;
}

function gainMana(amount) {
  if (!game) return;
  game.mana = Math.min(100, (game.mana || 0) + amount);
}

function powerDenied(p) {
  SFX.play('error');
  triggerShake(3, 0.15);
  return true;
}

function castPower(id) {
  const p = POWERS.find(x => x.id === id);
  if (!p || !game) return;
  if (id === 'fireball' && game.powerTargeting === 'fireball') { game.powerTargeting = null; return; } // toggle off
  if (!powerAvailable(p)) { powerDenied(p); return; }
  if (!game.powerCooldowns) game.powerCooldowns = {};
  if ((game.powerCooldowns[id] || 0) > 0) { powerDenied(p); return; }
  if ((game.mana || 0) < p.cost) { powerDenied(p); showFlash(`Not enough mana for ${p.name} (need ${p.cost})`); return; }
  if (id === 'fireball') { game.powerTargeting = 'fireball'; showFlash('🔥 Choose a target for Fireball'); return; }
  spendAndFirePower(p);
}

function spendAndFirePower(p, x, y) {
  game.mana -= p.cost;
  game.powerCooldowns[p.id] = p.cooldown;
  game.powersCast = (game.powersCast || 0) + 1;
  if (game.powersCast >= 25) unlockAchievement('Archmage', 'Cast 25 castle powers in a single run');
  if (p.id === 'fireball') fireFireball(x, y);
  else if (p.id === 'rally') fireRally();
  else if (p.id === 'frost') fireFrost();
  else if (p.id === 'repair') fireRepair();
  updatePowersBar(0, true);
}

// Canvas click hook (js/input.js calls this before its own build/upgrade/sell logic).
function powerHandleCanvasClick(tx, ty, px, py) {
  if (!game || game.powerTargeting !== 'fireball') return false;
  const p = POWERS.find(x => x.id === 'fireball');
  game.powerTargeting = null;
  if (!powerAvailable(p) || (game.mana || 0) < p.cost || (game.powerCooldowns && game.powerCooldowns.fireball > 0)) {
    powerDenied(p);
    return true;
  }
  spendAndFirePower(p, px, py);
  return true;
}

function fireFireball(x, y) {
  const p = POWERS.find(x2 => x2.id === 'fireball');
  const dmg = 60 * (1 + 0.3 * ((game.world || 1) - 1));
  let hits = 0;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) <= p.radius) { damageEnemy(e, dmg); hits++; }
  }
  spawnParticles(x, y, '#ff6622', 36);
  spawnParticles(x, y, '#ffcc44', 18);
  triggerShake(6, 0.3);
  SFX.play('boss_cast');
  if (!game.shockwaves) game.shockwaves = [];
  game.shockwaves.push({ x, y, maxR: p.radius, life: 0.5, color: '#ff8844' });
  showFlash(`🔥 Fireball hit ${hits} enem${hits === 1 ? 'y' : 'ies'}!`);
}

function fireRally() {
  for (const t of game.towers) {
    const base = TOWER_TYPES[t.type];
    if (base.income) continue;
    t.ammo = t.maxAmmo !== undefined ? t.maxAmmo : base.ammo;
    t.reloading = 0;
    t.cooldown = 0;
  }
  game.rallyTimer = 5;
  spawnParticles(C.width / 2, C.height / 2, '#aaff44', 26);
  SFX.play('upgrade');
  showFlash('⚡ Rally! Every tower reloaded, +30% fire rate for 5s');
}

function fireFrost() {
  const p = POWERS.find(x => x.id === 'frost');
  for (const e of game.enemies) {
    if (e.dead) continue;
    e.slowed = Math.max(e.slowed || 0, p.dur);
    e.slowStrength = Math.max(e.slowStrength || 0, p.slow); // stronger than the Ice tower's 50%
  }
  spawnParticles(C.width / 2, C.height / 2, '#bbffff', 26);
  triggerShake(3, 0.2);
  SFX.play('shot_ice');
  showFlash('❄️ Frost! Every enemy slowed 60% for 4s');
}

function fireRepair() {
  for (const w of game.walls || []) w.hp = w.maxHp;
  game.hp = Math.min(game.maxHp || DIFFICULTY.startHp, game.hp + 1);
  spawnParticles(C.width / 2, C.height / 2, '#e8b64c', 26);
  SFX.play('wall_place');
  showFlash('🔨 Repair! Walls restored, +1 heart');
  updateUI();
}

// --- HUD ---
let powersBarBuilt = false;
let powerEls = null;
function buildPowersBar() {
  const bar = document.getElementById('powers-bar');
  if (!bar || powersBarBuilt) return;
  bar.innerHTML =
    '<div class="power-mana-track"><div class="power-mana-fill" id="power-mana-fill"></div>' +
    '<span class="power-mana-label" id="power-mana-label">0</span></div>' +
    '<div class="power-row">' + POWERS.map(p =>
      `<button class="power-btn" id="power-btn-${p.id}" onclick="castPower('${p.id}')" ` +
      `title="${p.name} (${p.key}) — ${p.cost} mana, ${p.cooldown}s cooldown">` +
      `<span class="power-emoji">${p.emoji}</span><span class="power-key">${p.key}</span>` +
      `<div class="power-cd-fill" id="power-${p.id}-cd"></div></button>`
    ).join('') + '</div>';
  powerEls = { manaFill: document.getElementById('power-mana-fill'), manaLabel: document.getElementById('power-mana-label'), items: {} };
  for (const p of POWERS) {
    powerEls.items[p.id] = { btn: document.getElementById('power-btn-' + p.id), cd: document.getElementById('power-' + p.id + '-cd') };
  }
  powersBarBuilt = true;
}

let lastManaShown = -1;
const lastCdShown = {};
function updatePowersBar(dt, force) {
  if (!game) return;
  buildPowersBar();
  if (!game.powerCooldowns) game.powerCooldowns = {};
  if (game.mana === undefined) game.mana = 0;
  if (powersReady()) {
    if (!game.prepPhase) gainMana(DIFFICULTY.manaRegen * dt);
    if (game.rallyTimer > 0) game.rallyTimer = Math.max(0, game.rallyTimer - dt);
    for (const p of POWERS) {
      if ((game.powerCooldowns[p.id] || 0) > 0) game.powerCooldowns[p.id] = Math.max(0, game.powerCooldowns[p.id] - dt);
    }
  }
  if (!powerEls) return;
  const manaVal = Math.round(game.mana || 0);
  if (force || manaVal !== lastManaShown) {
    lastManaShown = manaVal;
    if (powerEls.manaFill) powerEls.manaFill.style.width = manaVal + '%';
    if (powerEls.manaLabel) powerEls.manaLabel.textContent = manaVal;
  }
  for (const p of POWERS) {
    const it = powerEls.items[p.id];
    if (!it || !it.btn) continue;
    const cd = game.powerCooldowns[p.id] || 0;
    const ready = powerAvailable(p) && cd <= 0 && (game.mana || 0) >= p.cost;
    it.btn.classList.toggle('disabled', !powerAvailable(p));
    it.btn.classList.toggle('affordable', ready);
    it.btn.classList.toggle('targeting', game.powerTargeting === p.id);
    const shown = Math.ceil(cd);
    if (force || lastCdShown[p.id] !== shown) {
      lastCdShown[p.id] = shown;
      if (it.cd) {
        if (cd > 0) { it.cd.style.height = Math.min(100, (cd / p.cooldown) * 100) + '%'; it.cd.textContent = shown; }
        else { it.cd.style.height = '0%'; it.cd.textContent = ''; }
      }
    }
  }
}

// Range-ring ghost while a targeted power (Fireball) is armed — hooked from render().
function drawPowerTargeting() {
  if (!game || game.powerTargeting !== 'fireball') return;
  const p = POWERS.find(x => x.id === 'fireball');
  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,60,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, p.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,120,60,0.12)';
  ctx.fill();
  ctx.restore();
}

// --- Hotkeys: F / G / V / H — ignored while typing in a field or with the admin panel open ---
document.addEventListener('keydown', e => {
  const typing = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
  if (typing || !game) return;
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel && adminPanel.classList.contains('show')) return;
  const p = POWERS.find(x => x.key.toLowerCase() === e.key.toLowerCase());
  if (p) castPower(p.id);
  else if (e.key === 'Escape' && game.powerTargeting) game.powerTargeting = null;
});
