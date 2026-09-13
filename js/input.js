// ===== INPUT =====
// Mouse/touch on the canvas, keyboard shortcuts, secret key combos.

// --- INPUT ---
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;
const mouse = { x: 0, y: 0, tx: -1, ty: -1 };

C.addEventListener('mousemove', e => {
  const rect = C.getBoundingClientRect();
  const scaleX = C.width / rect.width;
  const scaleY = C.height / rect.height;
  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top) * scaleY;
  mouse.tx = Math.floor(mouse.x / TILE);
  mouse.ty = Math.floor(mouse.y / TILE);

  if (game) {
    for (const t of game.towers) {
      t.hover = (t.tx === mouse.tx && t.ty === mouse.ty);
    }
  }
});

C.addEventListener('click', e => {
  if (!game || game.gameOver || game.paused) return;
  // Compute the tile from the event itself — on touch there's no mousemove beforehand
  const rect = C.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (C.width / rect.width);
  mouse.y = (e.clientY - rect.top) * (C.height / rect.height);
  mouse.tx = Math.floor(mouse.x / TILE);
  mouse.ty = Math.floor(mouse.y / TILE);
  const tx = mouse.tx, ty = mouse.ty;
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;

  // Touch flow: first tap arms the tile (ghost + range preview), second tap on the same tile confirms
  if (IS_TOUCH) {
    for (const t of game.towers) t.hover = (t.tx === tx && t.ty === ty);
    if (!game.pendingTile || game.pendingTile.tx !== tx || game.pendingTile.ty !== ty) {
      game.pendingTile = { tx, ty };
      return;
    }
    game.pendingTile = null;
  }

  // Supply crate collection
  if (collectCrate(tx, ty)) return;

  if (game.trashMode) {
    // Walls sell too — refund scales with how much of it is still standing
    const wIdx = (game.walls || []).findIndex(w => w.tx === tx && w.ty === ty);
    if (wIdx !== -1) {
      const w = game.walls[wIdx];
      const refund = Math.floor((w.buyCost || WALL_TYPES[w.type].cost) * getSellRefundRate() * (w.hp / w.maxHp));
      game.walls.splice(wIdx, 1);
      game.gold += refund;
      SFX.play('sell');
      spawnParticles(tx * TILE + TILE/2, ty * TILE + TILE/2, '#e8b64c', 12);
      showFlash(`Wall dismantled for ${refund} gold`);
      updateUI();
      return;
    }
    const idx = game.towers.findIndex(t => t.tx === tx && t.ty === ty);
    if (idx === -1) { showFlash('Nothing there to sell'); return; }
    const sold = game.towers[idx];
    const refund = Math.floor(TOWER_TYPES[sold.type].cost * getSellRefundRate());
    game.towers.splice(idx, 1);
    game.gold += refund;
    SFX.play('sell');
    spawnParticles(tx * TILE + TILE/2, ty * TILE + TILE/2, '#e8b64c', 12);
    showFlash(`Sold for ${refund} gold`);
    updateUI();
    return;
  }

  if (game.buildMode === 'wall') { placeWall(tx, ty); return; }

  if (isPath(tx, ty) || isCastle(tx, ty)) return;

  const existing = game.towers.find(t => t.tx === tx && t.ty === ty);
  if (existing) {
    const pts = availableUpgradePoints();
    if (pts <= 0) {
      guardianPester();
      return;
    }
    existing.level = (existing.level || 0) + 1;
    game.upgradesSpent++;
    SFX.play('upgrade');
    tutorialEvent('upgrade');
    spawnParticles(existing.tx * TILE + TILE/2, existing.ty * TILE + TILE/2, '#ffd700', 14);
    const newAttackNames = {
      arrow: 'Multishot volley', cannon: 'Napalm shells', ice: 'Freeze nova',
      sniper: 'Piercing rounds', tesla: 'Arc explosion', flame: 'Ignition cone',
      mortar: 'Cluster bombs', poison: 'Infectious spores',
      goldmine: '+50% income boost'
    };
    const towerId = TOWER_TYPES[existing.type].id;
    const label = existing.level === 1 && newAttackNames[towerId]
      ? ` — unlocked ${newAttackNames[towerId]}!`
      : ' — attack intensified!';
    showFlash(`⬆️ ${TOWER_TYPES[existing.type].name} Lv.${existing.level}${label}`);
    updateUI();
    return;
  }

  const def = TOWER_TYPES[game.selectedTower];
  if (game.gold < def.cost) {
    SFX.play('error');
    showFlash(`Not enough gold! Need ${def.cost} (have ${game.gold})`);
    return;
  }

  game.gold -= def.cost;
  game.towers.push({ tx, ty, type: game.selectedTower, cooldown: 0, angle: 0 });
  if (def.income) {
    game.goldMinesPlaced = (game.goldMinesPlaced || 0) + 1;
    if (game.goldMinesPlaced >= 3) unlockAchievement('Gold Rush', 'Placed 3 Gold Mines in a single run');
  }
  SFX.play('place');
  tutorialEvent('place');
  spawnParticles(tx * TILE + TILE/2, ty * TILE + TILE/2, '#a89878', 10);
  updateUI();
});


// --- MORE SECRETS: GG (bonus gold), ASDF (rapid fire), ZAP (lightning strike) ---
// Each is a rolling-buffer combo, works once per game, and unlocks an achievement the first time.
let secretKeyBuffer = '';
let goldCheatBuffer = '';
function activateRapidFireSecret() {
  game.rapidFireTimer = 30;
  showFlash('⚡ RAPID FIRE! All towers fire 2x faster for 30 seconds!');
  spawnParticles(C.width/2, C.height/2, '#ffee44', 40);
  unlockAchievement('Rapid Fire', 'Unlocked the ASDF cheat — 2x tower fire rate for 30s, once per game');
}
function activateZapSecret() {
  showFlash('⚡⚡ ZAP! Lightning strikes every enemy on screen!');
  triggerShake(8, 0.4);
  game.zapFlashT = 0.3;
  for (const e of game.enemies) {
    if (e.dead) continue;
    damageEnemy(e, 100);
    spawnParticles(e.x, e.y, '#ffffff', 6);
  }
  unlockAchievement('Thunderstruck', 'Unlocked the ZAP cheat — 100 damage to every enemy on screen, once per game');
}
function activateGoldSecret() {
  game.gold += 500;
  showFlash('💰 SECRET: GG — +500 bonus gold!');
  spawnParticles(C.width/2, C.height/2, '#ffd700', 50);
  unlockAchievement('GG Easy Money', 'Found the GG cheat code — +500 gold, once per game');
  updateUI();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('admin-panel').classList.contains('show')) {
    toggleAdminPanel();
    return;
  }
  const typingNow = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
  if (!typingNow && (!game || game.gameOver) && e.key.length === 1) {
    goldCheatBuffer = (goldCheatBuffer + e.key.toUpperCase()).slice(-10);
    if (goldCheatBuffer.endsWith('GOLD')) {
      goldCheatBuffer = '';
      try {
        const cur = localStorage.getItem('castleDefenseInfiniteGold');
        const ov = document.getElementById('overlay');
        if (cur === 'true') {
          localStorage.removeItem('castleDefenseInfiniteGold');
          if (ov) { const d = document.createElement('div'); d.style.cssText = 'color:#e0766f;font-size:14px;font-weight:800;margin-top:8px;'; d.textContent = 'INFINITE GOLD: OFF'; ov.appendChild(d); setTimeout(() => d.remove(), 2000); }
        } else {
          localStorage.setItem('castleDefenseInfiniteGold', 'true');
          if (ov) { const d = document.createElement('div'); d.style.cssText = 'color:#ffd87a;font-size:14px;font-weight:800;margin-top:8px;'; d.textContent = '✨ INFINITE GOLD: ON ✨'; ov.appendChild(d); setTimeout(() => d.remove(), 2000); }
        }
      } catch (e) {}
      return;
    }
  }
  if (!typingNow && (e.key === 'p' || e.key === 'P') && game && game.running && !game.gameOver) {
    togglePause();
    return;
  }
  if (!typingNow && e.key === ' ' && game && game.running && !game.gameOver && !game.paused && game.prepPhase) {
    e.preventDefault();
    sendWave();
    return;
  }
  // Track a rolling buffer of typed letters for the combo secrets below (ignored while typing in an input)
  const typingInField = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
  if (!typingInField && e.key.length === 1) {
    secretKeyBuffer = (secretKeyBuffer + e.key.toLowerCase()).slice(-12);
    if (game && !game.gameOver) {
      if (secretKeyBuffer.endsWith('gg') && !game.usedGG) {
        game.usedGG = true;
        activateGoldSecret();
        secretKeyBuffer = '';
      } else if (secretKeyBuffer.endsWith('asdf') && !game.usedASDF) {
        game.usedASDF = true;
        activateRapidFireSecret();
        secretKeyBuffer = '';
      } else if (secretKeyBuffer.endsWith('zap') && !game.usedZAP) {
        game.usedZAP = true;
        activateZapSecret();
        secretKeyBuffer = '';
      }
    }
  }
  // Secret: press B, then N (the code is "BN" — B alone does nothing)
  if (e.key === 'b' || e.key === 'B') {
    if (!game) return;
    game.cheatArmed = true;
    return;
  }
  if ((e.key === 'n' || e.key === 'N') && game && game.cheatArmed) {
    game.cheatArmed = false;
    if (!game.annihilatorUnlocked) {
      game.annihilatorUnlocked = true;
      buildTowerBar();
      showFlash('☢️ SECRET UNLOCKED: THE ANNIHILATOR ☢️ — press [9] or click it to place');
      spawnParticles(C.width/2, C.height/2, '#ffffff', 40);
      unlockAchievement('The Annihilator', 'Found the secret weapon — reward: Tri-Beam Crystal item!');
      game.triBeamGranted = true;
      setTimeout(showMerchant, 1600);
    }
    const annIdx = TOWER_TYPES.findIndex(t => t.id === 'annihilator');
    game.selectedTower = annIdx;
    game.trashMode = false;
    game.buildMode = 'tower';
    buildTowerBar();
    return;
  }
  if (game) game.cheatArmed = false; // any other key breaks the sequence
  if (e.key === 'x' || e.key === 'X') {
    if (game) game.trashMode = !game.trashMode;
    updateTowerBar();
    return;
  }
  // Q/W/E/R select a wall and flip the bar into wall mode
  const wallIdx = WALL_TYPES.findIndex(w => w.key === e.key.toUpperCase());
  if (wallIdx !== -1 && game && !game.gameOver) {
    game.selectedWall = wallIdx;
    game.buildMode = 'wall';
    game.trashMode = false;
    buildTowerBar();
    return;
  }
  const towerIdx = TOWER_TYPES.findIndex(t => t.key === e.key);
  if (towerIdx !== -1) {
    if (TOWER_TYPES[towerIdx].secret && !(game && game.annihilatorUnlocked)) return;
    if (game) { game.selectedTower = towerIdx; game.trashMode = false; game.buildMode = 'tower'; }
    buildTowerBar();
    tutorialEvent('select');
  }
});
