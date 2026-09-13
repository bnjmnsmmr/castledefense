// ===== WAVES =====
// Wave composition per wave number, difficulty scaling, lane pixel paths, sending/spawning waves, auto-wave.

function getWave(n) {
  const waves = [];
  const base = Math.floor(n * 1.3) + 3;
  const spawn = (type, delay) => waves.push({ type, delay });
  const fill = (count, type, spacing, start) => {
    for (let i = 0; i < count; i++) spawn(type, start + i * spacing);
  };

  if (n === 1) { fill(5, 0, 0.8, 0); }
  else if (n === 2) { fill(7, 0, 0.6, 0); }
  else if (n === 3) { fill(4, 0, 0.6, 0); fill(3, 1, 0.4, 3); }
  else if (n === 4) { fill(3, 0, 0.6, 0); fill(8, 4, 0.3, 2); fill(2, 1, 0.5, 5); }
  else if (n === 5) { fill(6, 0, 0.5, 0); fill(3, 1, 0.4, 3.5); spawn(3, 5); spawn(3, 6.5); }
  else if (n === 6) { fill(6, 6, 0.35, 0); fill(4, 0, 0.5, 2.5); spawn(3, 4); }
  else if (n === 7) { fill(4, 7, 0.8, 0); fill(5, 0, 0.5, 3.5); spawn(3, 2); spawn(3, 5); }
  else if (n === 8) { fill(3, 7, 0.7, 0); fill(4, 6, 0.4, 2); fill(4, 1, 0.35, 4); spawn(3, 5.5); spawn(3, 6.5); }
  else if (n === 9) { fill(2, 5, 1.5, 0); fill(6, 2, 0.6, 1); spawn(3, 3); spawn(3, 5); spawn(3, 7); }
  else if (n === 10) { fill(5, 0, 0.4, 0); fill(3, 7, 0.6, 2); spawn(3, 3); spawn(3, 4); spawn(3, 5); fill(4, 1, 0.3, 5.5); spawn(3, 7); spawn(3, 8); }
  else if (n === 11) { spawn(8, 0); fill(8, 0, 0.4, 1); fill(4, 4, 0.25, 4.5); }
  else if (n === 12) { fill(12, 1, 0.25, 0); fill(6, 6, 0.3, 3.5); }
  else if (n === 13) { fill(6, 2, 0.8, 0); fill(3, 7, 0.7, 5); fill(2, 5, 1, 7); }
  else if (n === 14) { fill(20, 4, 0.15, 0); fill(5, 1, 0.3, 3.5); }
  else if (n === 15) { fill(4, 7, 0.5, 0); spawn(3, 1.5); spawn(3, 2.5); fill(3, 5, 0.8, 3); spawn(3, 4.5); spawn(3, 5.5); fill(6, 0, 0.3, 6); spawn(3, 7.5); spawn(3, 8.5); }
  else if (n === 16) { fill(4, 5, 0.6, 0); fill(6, 2, 0.5, 2.5); fill(3, 7, 0.6, 5.5); }
  else if (n === 17) { fill(15, 6, 0.2, 0); fill(4, 0, 0.5, 3.5); }
  else if (n === 18) { fill(2, 8, 1.5, 0); fill(6, 7, 0.5, 1); fill(5, 0, 0.4, 4.5); }
  else if (n === 19) { fill(3, 0, 0.4, 0); fill(3, 1, 0.35, 1.5); fill(3, 2, 0.6, 3); fill(3, 6, 0.3, 4.5); fill(2, 5, 0.8, 5.5); fill(2, 7, 0.7, 6.5); spawn(8, 8); }
  else if (n === 20) { fill(6, 0, 0.3, 0); fill(4, 1, 0.3, 2); fill(3, 2, 0.5, 3.5); for (let i = 0; i < 8; i++) spawn(3, 4.5 + i * 0.5); fill(2, 8, 1, 9); fill(3, 5, 0.5, 10); }
  else if (n === 21) { fill(25, 1, 0.12, 0); fill(8, 4, 0.2, 3.5); }
  else if (n === 22) { fill(5, 5, 0.6, 0); fill(8, 7, 0.4, 3); }
  else if (n === 23) { fill(10, 2, 0.5, 0); fill(2, 5, 1, 5.5); }
  else if (n === 24) { fill(4, 8, 0.8, 0); fill(10, 0, 0.3, 3.5); fill(5, 4, 0.2, 6.5); }
  else if (n === 25) { for (let i = 0; i < 8; i++) spawn(3, i * 1.2); fill(4, 5, 0.5, 10); fill(3, 8, 0.6, 12); }
  else if (n === 26) { fill(8, 1, 0.2, 0); fill(8, 6, 0.2, 2); fill(6, 4, 0.15, 4); fill(4, 2, 0.4, 5); }
  else if (n === 27) { fill(8, 7, 0.35, 0); fill(10, 6, 0.2, 3); }
  else if (n === 28) { fill(4, 8, 0.6, 0); fill(4, 5, 0.5, 2.5); fill(8, 2, 0.4, 5); }
  else if (n === 29) {
    for (let i = 0; i < base + 15; i++) {
      const r = Math.random();
      const t = r < 0.1 ? 8 : (r < 0.2 ? 3 : (r < 0.3 ? 2 : (r < 0.4 ? 5 : (r < 0.5 ? 6 : (r < 0.6 ? 7 : (r < 0.75 ? 1 : 0))))));
      spawn(t, i * 0.2);
    }
  } else if (n === 30) {
    fill(10, 0, 0.2, 0); fill(6, 1, 0.2, 2.5); fill(5, 2, 0.4, 4);
    fill(4, 7, 0.3, 6); fill(3, 5, 0.5, 7.5); fill(3, 8, 0.4, 9);
    for (let i = 0; i < 10; i++) spawn(3, 10.5 + i * 0.8);
    fill(15, 4, 0.1, 18.5);
  } else {
    // Endless: random escalation past 30
    const count = base + Math.floor(n * 0.8);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const t = r < 0.12 ? 8 : (r < 0.28 ? 3 : (r < 0.38 ? 2 : (r < 0.48 ? 5 : (r < 0.56 ? 6 : (r < 0.64 ? 7 : (r < 0.8 ? 1 : 0))))));
      spawn(t, i * Math.max(0.1, 0.35 - n * 0.005));
    }
    if (n % 2 === 0) {
      const bossCount = Math.floor(n / 3);
      for (let i = 0; i < bossCount; i++) spawn(3, count * 0.2 + i * 0.8);
    }
  }
  const upgrades = (typeof game !== 'undefined' && game && game.upgradesSpent) || 0;
  const world = (typeof game !== 'undefined' && game && game.world) || 1;
  // Vampire-survivors style scaling: more upgrades deployed -> bigger waves
  if (upgrades > 0) {
    const maxDelay = waves.length ? Math.max(...waves.map(w => w.delay)) : 0;
    const extraCount = Math.round(upgrades * DIFFICULTY.upgradesExtraEnemies);
    for (let i = 0; i < extraCount; i++) {
      const r = Math.random();
      const t = r < 0.4 ? 0 : (r < 0.65 ? 1 : (r < 0.8 ? 4 : (r < 0.92 ? 2 : 7)));
      spawn(t, maxDelay + 0.3 + i * 0.22);
    }
  }
  // Every new world piles on more enemies too
  if (world > 1) {
    const maxDelay2 = waves.length ? Math.max(...waves.map(w => w.delay)) : 0;
    const worldExtra = Math.round((world - 1) * DIFFICULTY.worldExtraEnemies);
    for (let i = 0; i < worldExtra; i++) {
      const r = Math.random();
      const t = r < 0.25 ? 0 : (r < 0.4 ? 1 : (r < 0.5 ? 4 : (r < 0.65 ? 2 : (r < 0.75 ? 7 : 3))));
      spawn(t, maxDelay2 + 0.3 + i * 0.2);
    }
  }
  // HARD MODE scaling: enemies get tougher AND faster every wave — and every world raises the floor
  const hpMult = (1 + (n - 1) * DIFFICULTY.waveHpGrowth + upgrades * DIFFICULTY.upgradeHpGrowth) * (1 + (world - 1) * DIFFICULTY.worldHpGrowth);
  const spdMult = Math.min((1 + (n - 1) * DIFFICULTY.waveSpeedGrowth) * (1 + (world - 1) * DIFFICULTY.worldSpeedGrowth), DIFFICULTY.maxSpeedMult);
  return waves.map(w => ({ ...w, hpMult, spdMult }));
}

// --- PATH as pixel positions ---
function pathToPixels(tiles) {
  return tiles.map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }));
}


function toggleAutoWave() {
  if (!game) return;
  game.autoWave = !game.autoWave;
  const btn = document.getElementById('auto-wave-btn');
  btn.textContent = game.autoWave ? 'AUTO-WAVE: ON' : 'AUTO-WAVE: OFF';
  btn.classList.toggle('on', game.autoWave);
  if (game.autoWave) {
    if (game.prepPhase) game.autoWaveTimer = 3; // give a few seconds to place towers
    showFlash('Auto-wave ON — waves will send themselves, go grind');
  } else {
    game.autoWaveTimer = undefined;
    showFlash('Auto-wave OFF');
  }
}

function sendWave() {
  if (!game || !game.prepPhase || game.gameOver) return;
  game.prepPhase = false;
  hideWaveIntel();
  game.newPathUnlocked = null;
  game.supplyCrates = [];
  game.waveStartHp = game.hp; // for the Flawless bonus
  game.bossAnnounced = false;
  SFX.play('horn');
  tutorialEvent('send');
  document.getElementById('send-wave-btn').style.display = 'none';
  document.getElementById('hint').style.display = 'none';
  document.getElementById('merchant').classList.remove('show');
  spawnWave();
  // Banner: summarize composition of this wave
  const counts = {};
  for (const w of game.waveEnemies) counts[w.type] = (counts[w.type] || 0) + 1;
  const parts = Object.entries(counts)
    .sort((a,b) => b[1] - a[1]).slice(0, 3)
    .map(([type, n]) => `${n} ${ENEMY_NAMES[type] || 'FOES'}`);
  const routes = game.activePaths ? game.activePaths.length : 1;
  showWaveBanner(game.wave, parts.join(' · ') + (routes > 1 ? ` — ${routes} ROUTES` : ''));
}

function spawnWave() {
  game.waveEnemies = getWave(game.wave);
  // The final wave of every world is a boss fight
  if (game.wave === DIFFICULTY.wavesPerWorld && !game.dailyChallenge) {
    const bd = getBossForWorld(game.world);
    const maxDelay = game.waveEnemies.length ? Math.max(...game.waveEnemies.map(w => w.delay)) : 0;
    const ref = game.waveEnemies[0] || { hpMult: 1, spdMult: 1 };
    game.waveEnemies.push({
      type: bd.type, delay: maxDelay + 2.5,
      hpMult: ref.hpMult, spdMult: ref.spdMult, bossId: bd.id,
    });
  }
  game.waveSpawnIdx = 0;
  game.waveTimer = 0;
  game.waveActive = true;
  game.betweenWaves = false;
  updateUI();
}
