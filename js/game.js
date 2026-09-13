// ===== GAME (simulation) =====
// initGame/startGame, the frame loop, update(), render(), boss abilities, damage, HUD sync, endGame, wall building, crates.

// --- INIT ---
function initGame() {
  pathSet = buildPathSet(1);
  return {
    hp: DIFFICULTY.startHp, gold: DIFFICULTY.startGold, wave: 1, world: 1, kills: 0, xp: 0, upgradesSpent: 0, annihilatorUnlocked: false, triBeamEquipped: false,
    towers: [], enemies: [], projectiles: [], particles: [],
    walls: [],
    supplyCrates: [],
    goldMinesPlaced: 0,
    cratesCollected: 0,
    selectedTower: 0,
    selectedWall: 0,
    buildMode: 'tower',   // 'tower' | 'wall'
    waveEnemies: [],
    waveTimer: 0,
    waveSpawnIdx: 0,
    waveActive: false,
    betweenWaves: true,
    betweenTimer: 3,
    activePaths: getActivePaths(1),
    newPathUnlocked: null,
    running: true,
    gameOver: false,
    paused: false,
    speed: 1,
    rapidFireTimer: 0,
    mana: 0, powerCooldowns: {}, powersCast: 0, rallyTimer: 0, powerTargeting: null,
    zapFlashT: 0,
    usedGG: false,
    usedASDF: false,
    usedZAP: false,
    dailyChallenge: false,
    forcedThemeIdx: null,
    startedAt: Date.now(),
    // Lifetime totals at run start, so the results screen can show "+N this run" deltas
    profileStart: {
      kills: profile.stats.totalKills || 0,
      waves: profile.stats.wavesCleared || 0,
      bestScore: profile.stats.bestScore || 0,
    },
  };
}

function startGame(resume) {
  game = initGame();
  try { if (localStorage.getItem('castleDefenseInfiniteGold') === 'true') game.infiniteGold = true; } catch (e) {}
  const saved = resume ? loadGameState() : null;
  if (saved) {
    game.hp = saved.hp; game.gold = saved.gold; game.wave = saved.wave; game.world = saved.world;
    game.kills = saved.kills; game.xp = saved.xp; game.upgradesSpent = saved.upgradesSpent;
    game.annihilatorUnlocked = saved.annihilatorUnlocked; game.triBeamEquipped = saved.triBeamEquipped;
    game.triBeamGranted = saved.triBeamGranted; game.merchantGone = saved.merchantGone;
    game.achievements = saved.achievements || {}; game.autoWave = saved.autoWave || false;
    game.speed = saved.speed || 1;
    game.mana = saved.mana || 0; game.powerCooldowns = saved.powerCooldowns || {}; game.powersCast = saved.powersCast || 0;
    game.activePaths = getActivePaths(game.wave);
    pathSet = buildPathSet(game.wave);
    game.towers = (saved.towers || []).map(t => ({ tx: t.tx, ty: t.ty, type: t.type, level: t.level || 0, cooldown: 0, angle: 0 }));
    game.walls = (saved.walls || []).map(w => ({ tx: w.tx, ty: w.ty, type: w.type, hp: w.hp, maxHp: w.maxHp }));
  } else {
    clearGameState();
  }
  game.prepPhase = true;
  game.betweenWaves = false;
  game.waveActive = false;
  document.getElementById('overlay').style.display = 'none';
  setGameChromeVisible(true);
  document.body.style.background = getWorldTheme().bgBase;
  groundCache = null;
  document.getElementById('send-wave-btn').style.display = 'block';
  document.getElementById('hint').style.display = 'block';
  const awBtn = document.getElementById('auto-wave-btn');
  awBtn.style.display = 'block';
  if (game.autoWave) {
    awBtn.textContent = 'AUTO-WAVE: ON';
    awBtn.classList.add('on');
    game.autoWaveTimer = 4;
  } else {
    awBtn.textContent = 'AUTO-WAVE: OFF';
    awBtn.classList.remove('on');
  }
  document.getElementById('speed-btn').style.display = 'block';
  document.getElementById('pause-toggle-btn').style.display = 'flex';
  updateSpeedBtn();
  buildTowerBar();
  stopHomeMusic();
  startMusic();
  updateUI();
  // Render the board so player can see the map and place towers
  resize();
  render();
  requestAnimationFrame(loop);
  if (!saved) tutorialStart(pendingTutorialReplay);
  pendingTutorialReplay = false;
}

function showMerchant() {
  if (!game || game.triBeamEquipped || game.merchantGone) return;
  // If the crystal was granted by achievement, rewrite the pitch as the Guardian's reward
  if (game.triBeamGranted) {
    document.querySelector('#merchant .merch-name').textContent = "Guardian's Reward";
    document.querySelector('#merchant .merch-text').innerHTML = 'The Guardian of Stars left you a gift: the <b>Tri-Beam Crystal</b>. Bolt it onto your Annihilator and it fires <b>THREE beams at once</b>.';
    document.querySelector('#merchant .merch-buy').textContent = 'EQUIP IT — FREE';
  }
  document.getElementById('merchant').classList.add('show');
}

// --- ACHIEVEMENTS ---
function unlockAchievement(name, sub) {
  if (!game.achievements) game.achievements = {};
  if (game.achievements[name]) return false;
  game.achievements[name] = true;
  // Record in the lifetime profile (achievement gallery on the home screen)
  if (!profile.achievements[name]) {
    profile.achievements[name] = { sub: sub || '', date: todayStr() };
    saveProfile();
    setTimeout(checkSkinUnlockNotifications, 800);
  }
  const stack = document.getElementById('toast-stack');
  while (stack.childElementCount >= 3) stack.removeChild(stack.firstChild);
  const t = document.createElement('div');
  t.className = 'toast achieve';
  t.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2h3v4c0 2.2-1.8 4-4 4h-.4A6 6 0 0 1 13 16.9V19h4v2H7v-2h4v-2.1A6 6 0 0 1 6.4 13H6c-2.2 0-4-1.8-4-4V5h3V3zm-1 4v2c0 1.1.9 2 2 2V7H4zm16 0h-2v4c1.1 0 2-.9 2-2V7z"/></svg><span>ACHIEVEMENT: ${name}<span class="ach-sub">${sub || ''}</span></span>`;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 5000);
  playAchievementSound();
  return true;
}

// --- UPDATE ---
let lastTime = 0;
function loop(ts) {
  if (!game || !game.running) return;
  if (game.infiniteGold) game.gold = Math.max(game.gold, 99999);
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  const gdt = dt * (game.speed || 1); // game-time delta (speed toggle)

  if (!game.paused) {
    if (game.rapidFireTimer > 0) {
      game.rapidFireTimer = Math.max(0, game.rapidFireTimer - gdt);
      if (game.rapidFireTimer === 0) showFlash('Rapid Fire wore off');
    }
    if (game.zapFlashT > 0) game.zapFlashT = Math.max(0, game.zapFlashT - dt);
  }
  const rfEl = $id('rapidfire-stat');
  if (rfEl) {
    const show = game.rapidFireTimer > 0 ? 'flex' : 'none';
    if (rfEl.style.display !== show) rfEl.style.display = show;
    if (game.rapidFireTimer > 0) $id('rapidfire-time').textContent = Math.ceil(game.rapidFireTimer);
  }
  if (!game.paused && !game.prepPhase) update(gdt);
  if (!game.paused && game.prepPhase && game.autoWave && game.autoWaveTimer !== undefined) {
    game.autoWaveTimer -= gdt;
    if (game.autoWaveTimer <= 0) { game.autoWaveTimer = undefined; sendWave(); }
  }
  updatePowersBar(gdt);
  render();
  flushSaveIfDue(ts);
  requestAnimationFrame(loop);
}

// --- GAME SPEED / PAUSE ---
function updateSpeedBtn() {
  const btn = document.getElementById('speed-btn');
  if (!btn || !game) return;
  btn.innerHTML = 'SPEED ' + (game.speed || 1) + '&times;';
  btn.classList.toggle('fast', (game.speed || 1) > 1);
}
function cycleGameSpeed() {
  if (!game || game.gameOver) return;
  game.speed = game.speed >= 3 ? 1 : (game.speed || 1) + 1;
  updateSpeedBtn();
  saveGameState();
}
function togglePause() {
  if (!game || game.gameOver || !game.running) return;
  if (document.getElementById('admin-panel').classList.contains('show')) return;
  game.paused = !game.paused;
  document.getElementById('pause-overlay').classList.toggle('show', game.paused);
  if (!game.paused) saveGameState();
}
function quitToMenu() {
  if (game && game.paused) {
    game.paused = false;
    document.getElementById('pause-overlay').classList.remove('show');
  }
  saveGameState();
  returnToMenu();
}

function update(dt) {
  if (game && game.infiniteGold) game.gold = Math.max(game.gold, 99999);
  // Between waves — now handled by sendWave button
  if (game.betweenWaves) return;

  // === GIANT HERO (Big Stache) ===
  if (!game.heroTimer) game.heroTimer = 15 + Math.random() * 10;
  game.heroTimer -= dt;
  if (game.heroTimer <= 0 && !game.hero) {
    game.heroTimer = 20 + Math.random() * 15;
    game.hero = {
      x: -80, y: ROWS * TILE / 2 - 40,
      speed: 60, phase: 'walking',
    };
    showFlash('🦸 BIG STACHE INCOMING!');
  }
  if (game.hero) {
    const h = game.hero;
    h.x += h.speed * dt;
    // Stomp enemies as he walks
    h.bossHitT = Math.max(0, (h.bossHitT || 0) - dt);
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - h.x, e.y - (h.y + 40)) < 60) {
        // A boss is a fight, not a speed bump — Stache hurts it on a cooldown but
        // can't flatten it, and the kill routes through damageEnemy so the bounty,
        // banner and trophy still fire.
        if (e.boss) {
          if (h.bossHitT === 0) {
            h.bossHitT = 0.8;
            damageEnemy(e, Math.max(300, e.maxHp * 0.06));
            playFart();
            spawnParticles(e.x, e.y, '#ff4444', 14);
          }
          continue;
        }
        e.dead = true;
        game.gold += ENEMY_DEFS[e.type].reward;
        game.kills++;
        profile.stats.totalKills = (profile.stats.totalKills || 0) + 1;
        gainXP(ENEMY_DEFS[e.type].xp || 1);
        playFart();
        spawnParticles(e.x, e.y, '#ff4444', 10);
      }
    }
    // Screen shake on each step
    if (Math.sin(Date.now() / 150 * Math.PI) > 0.95) {
      for (let i = 0; i < 3; i++) {
        game.particles.push({
          x: h.x + (Math.random()-0.5)*40, y: h.y + 100,
          vx: (Math.random()-0.5)*30, vy: -Math.random()*20,
          life: 0.5, color: '#886644', size: 3
        });
      }
    }
    if (h.x > COLS * TILE + 100) game.hero = null;
  }

  // Spawn enemies
  if (game.waveActive && game.waveSpawnIdx < game.waveEnemies.length) {
    game.waveTimer += dt;
    const next = game.waveEnemies[game.waveSpawnIdx];
    if (game.waveTimer >= next.delay) {
      const def = ENEMY_DEFS[next.type];
      // Pick a random active path for this enemy
      const pathDef = game.activePaths[Math.floor(Math.random() * game.activePaths.length)];
      const path = pathToPixels(pathDef.tiles);
      const start = path[0];
      const bd = next.bossId ? BOSS_DEFS.find(b => b.id === next.bossId) : null;
      const hp = Math.round(def.hp * next.hpMult * (bd ? bd.hpMult : 1));
      const ent = {
        type: next.type, x: start.x, y: start.y,
        hp, maxHp: hp, speed: def.speed * (next.spdMult || 1) * (bd ? bd.speedMult : 1),
        path, pathIdx: 0, dead: false, slowed: 0,
        shieldHp: def.shield || 0,
        healTimer: 0, necroTimer: 0, spawnT: 0.25,
      };
      if (bd) {
        ent.boss = bd;
        ent.sizeMult = bd.sizeMult;
        ent.abilityTimers = {};
        for (const a of bd.abilities) ent.abilityTimers[a] = (BOSS_ABILITIES[a].cd || 0) * 0.55;
        game.activeBoss = ent;
        showBannerText(bd.name, bd.title, 3000);
        SFX.play('boss');
        triggerShake(8, 0.6);
      }
      if (!ent.boss) affixMaybeApply(ent);
      game.enemies.push(ent);
      // Mini-boss entrance: announce the first Dark Knight of each wave
      if (next.type === 3 && !bd && !game.bossAnnounced) {
        game.bossAnnounced = true;
        showBannerText('DARK KNIGHT', 'A CHAMPION OF THE HORDE RIDES FORTH', 2200);
        SFX.play('boss');
        triggerShake(5, 0.35);
      }
      game.waveSpawnIdx++;
    }
  }

  // Move enemies
  for (const e of game.enemies) {
    if (e.dead) continue;
    const def = ENEMY_DEFS[e.type];
    let spd = e.speed * (e.rageMult || 1);
    if (e.untargetable > 0) { e.untargetable -= dt; spd *= 2.2; } // burrowed: fast and unhittable
    if (e.slowed > 0) { spd *= 0.5; e.slowed -= dt; }

    const target = e.path[e.pathIdx + 1];
    if (!target) {
      // Reached castle — a boss smashing through costs far more than a stray rat
      e.dead = true;
      const dmg = e.boss ? 5 : 1;
      game.hp -= dmg;
      affixOnReachCastle(e);
      if (e.boss) {
        game.activeBoss = null;
        showBannerText(e.boss.name + ' BREACHES THE GATE', `-${dmg} HEARTS`, 2400);
        triggerShake(12, 0.6);
      }
      SFX.play('hurt');
      triggerShake(4, 0.25);
      game.hurtT = 0.3;
      spawnParticles(e.x, e.y, '#ff4444', e.boss ? 24 : 6);
      updateUI();
      if (game.hp <= 0) endGame();
      continue;
    }

    // A wall on the next tile stops the march. Flyers ignore them entirely,
    // and a burrowed boss tunnels straight under.
    if (!def.flying && !(e.untargetable > 0)) {
      const blocker = wallAt(Math.floor(target.x / TILE), Math.floor(target.y / TILE));
      if (blocker) {
        e.attacking = true;
        damageWall(blocker, wallDps(e) * dt);
        e.wallFxT = (e.wallFxT || 0) - dt;
        if (e.wallFxT <= 0) {
          e.wallFxT = 0.35;
          SFX.play('wall_hit');
          spawnParticles(
            blocker.tx * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6,
            blocker.ty * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6,
            WALL_TYPES[blocker.type].wood, 2);
        }
        continue; // held at the barricade
      }
      e.attacking = false;
    }

    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < spd * TILE * dt) {
      e.x = target.x; e.y = target.y;
      e.pathIdx++;
    } else {
      e.x += (dx/dist) * spd * TILE * dt;
      e.y += (dy/dist) * spd * TILE * dt;
    }
  }

  // Wizard healing: heals nearby allies
  for (const e of game.enemies) {
    if (e.dead || e.type !== 5) continue;
    e.healTimer = (e.healTimer || 0) + dt;
    if (e.healTimer >= 2) {
      e.healTimer = 0;
      for (const ally of game.enemies) {
        if (ally.dead || ally === e) continue;
        const d = Math.hypot(ally.x - e.x, ally.y - e.y);
        if (d < 80) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 10);
          spawnParticles(ally.x, ally.y, '#44ff44', 3);
        }
      }
    }
  }

  // Necromancer revive: brings back dead enemies
  for (const e of game.enemies) {
    if (e.dead || e.type !== 8) continue;
    e.necroTimer = (e.necroTimer || 0) + dt;
    if (e.necroTimer >= 5) {
      e.necroTimer = 0;
      // Find recently dead enemies nearby
      const dead = game.deadEnemies || [];
      for (let i = dead.length - 1; i >= 0 && i >= dead.length - 3; i--) {
        const d = dead[i];
        if (!d.revived && Math.hypot(d.x - e.x, d.y - e.y) < 120) {
          d.revived = true;
          // Respawn as a grunt at necromancer's position
          const pathDef = game.activePaths[Math.floor(Math.random() * game.activePaths.length)];
          const path = pathToPixels(pathDef.tiles);
          // Find closest path point to necromancer
          let closestIdx = 0, closestDist = Infinity;
          for (let pi = 0; pi < path.length; pi++) {
            const pd = Math.hypot(path[pi].x - e.x, path[pi].y - e.y);
            if (pd < closestDist) { closestDist = pd; closestIdx = pi; }
          }
          game.enemies.push({
            type: 0, x: e.x, y: e.y,
            hp: 30, maxHp: 30, speed: 1.0,
            path, pathIdx: closestIdx, dead: false, slowed: 0,
            shieldHp: 0, healTimer: 0, necroTimer: 0, spawnT: 0.25,
          });
          spawnParticles(e.x, e.y, '#22ff44', 8);
          break;
        }
      }
    }
  }

  updateBossAbilities(dt);

  // Tower shooting (with ammo/reload)
  for (const t of game.towers) {
    const base = TOWER_TYPES[t.type];
    const lvl = t.level || 0;
    let def = base;
    if (lvl > 0) {
      def = {
        ...base,
        dmg: base.dmg * (1 + lvl * DIFFICULTY.towerUpgradeDmgPerLevel),
        range: base.range * (1 + lvl * DIFFICULTY.towerUpgradeRangePerLevel),
        rate: base.rate * Math.pow(DIFFICULTY.towerUpgradeRateMult, lvl),
        ammo: base.ammo + lvl * DIFFICULTY.towerUpgradeAmmoPerLevel,
        reload: base.reload * Math.pow(DIFFICULTY.towerUpgradeReloadMult, lvl),
      };
      // Each tower gets a NEW ATTACK type when upgraded, not just bigger numbers
      if (base.id === 'cannon') { def.dot = 6 + lvl * 2; def.dotDur = 3; } // napalm shells: splash now burns
      if (base.id === 'ice')    { def.splash = 35 + lvl * 15; } // freeze nova: AoE freeze instead of single target
      if (base.id === 'flame')  { def.dot = 5 + lvl * 2; def.dotDur = 2.5; } // ignites the ground it burns
      if (base.id === 'mortar') { def.cluster = lvl; } // cluster bomblets on impact
      if (base.id === 'poison') { def.infect = lvl; } // poison spreads to nearby enemies
      if (base.id === 'tesla')  { def.arcSplash = 20 + lvl * 8; } // each chain jump also arcs to nearby enemies
    }
    if (t.ammo === undefined) { t.ammo = def.ammo; t.maxAmmo = def.ammo; }
    else if (t.maxAmmo !== def.ammo) { t.ammo += (def.ammo - t.maxAmmo); t.maxAmmo = def.ammo; }
    // Knocked offline by a boss shockwave / frost nova
    if (t.stunned > 0) { t.stunned -= dt; continue; }

    // Gold Mine: generate passive income instead of attacking
    if (base.income) {
      t.incomeTimer = (t.incomeTimer || 0) + dt;
      const rate = DIFFICULTY.goldMineRate * (1 + (lvl || 0) * 0.5);
      const earned = rate * dt;
      game.gold += earned;
      if (t.incomeTimer >= 1) {
        t.incomeTimer -= 1;
        const cx = t.tx * TILE + TILE/2, cy = t.ty * TILE + TILE/2;
        spawnDamageNum(cx, cy - 20, '+' + Math.round(rate), 'gold');
        spawnParticles(cx, cy - 10, '#ffd700', 3);
      }
      continue;
    }

    t.cooldown = (t.cooldown || 0) - dt;
    if (t.cooldown > 0) continue;

    // Reloading
    if (t.ammo <= 0) {
      t.reloading = (t.reloading || 0) + dt;
      if (t.reloading >= def.reload) {
        t.ammo = def.ammo;
        t.reloading = 0;
      }
      continue;
    }

    const cx = t.tx * TILE + TILE/2;
    const cy = t.ty * TILE + TILE/2;

    // Find nearest enemy in range
    let best = null, bestDist = Infinity;
    for (const e of game.enemies) {
      if (e.dead || e.untargetable > 0) continue;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d <= def.range && d < bestDist) { best = e; bestDist = d; }
    }

    if (best) {
      t.cooldown = def.rate * (game.rapidFireTimer > 0 ? 0.5 : 1) * (game.rallyTimer > 0 ? (1 / 1.3) : 1);
      t.ammo--;
      t.angle = Math.atan2(best.y - cy, best.x - cx);
      SFX.play('shot_' + base.id);

      // Tesla: chain lightning (instant, no projectile)
      if (def.chain) {
        // Tri-Beam Crystal: annihilator fires 3 separate beams from 3 different enemies
        const triBeam = base.id === 'annihilator' && game.triBeamEquipped;
        const seeds = [best];
        if (triBeam) {
          const others = game.enemies
            .filter(e => !e.dead && e !== best && Math.hypot(e.x - cx, e.y - cy) <= def.range)
            .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
          for (const cand of others) {
            if (seeds.length >= 3) break;
            // only seed a new beam on an enemy far from existing seeds (separate cluster)
            if (seeds.every(s => Math.hypot(cand.x - s.x, cand.y - s.y) > 80)) seeds.push(cand);
          }
          // if fewer than 3 distinct clusters, fill with nearest leftovers
          for (const cand of others) {
            if (seeds.length >= 3) break;
            if (!seeds.includes(cand)) seeds.push(cand);
          }
        }
        const globalHit = new Set();
        for (const seed of seeds) {
          if (globalHit.has(seed)) continue;
          let targets = [seed];
          let last = seed;
          for (let c = 1; c < def.chain; c++) {
            let nextBest = null, nextDist = Infinity;
            for (const e of game.enemies) {
              if (e.dead || targets.includes(e) || globalHit.has(e)) continue;
              const d = Math.hypot(e.x - last.x, e.y - last.y);
              if (d < 80 && d < nextDist) { nextBest = e; nextDist = d; }
            }
            if (nextBest) { targets.push(nextBest); last = nextBest; }
            else break;
          }
          // Draw lightning and damage
          let prevX = cx, prevY = cy;
          for (const tgt of targets) {
            globalHit.add(tgt);
            const hitDmg = def.pctDmg ? tgt.maxHp * def.pctDmg : def.dmg;
            damageEnemy(tgt, hitDmg);
            if (def.arcSplash) {
              for (const e2 of game.enemies) {
                if (e2.dead || e2 === tgt || targets.includes(e2)) continue;
                if (Math.hypot(e2.x - tgt.x, e2.y - tgt.y) < def.arcSplash) {
                  damageEnemy(e2, def.dmg * 0.4);
                  spawnParticles(e2.x, e2.y, '#ccff88', 3);
                }
              }
            }
            game.projectiles.push({
              x: prevX, y: prevY, vx: 0, vy: 0,
              tx: tgt.x, ty: tgt.y,
              dmg: 0, color: triBeam ? '#aaffff' : def.projColor, life: 0.15, lightning: true
            });
            prevX = tgt.x; prevY = tgt.y;
          }
        }
        continue;
      }

      // Flame: cone damage (instant, no projectile)
      if (def.cone) {
        const angle = t.angle;
        for (const e of game.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d > def.range) continue;
          const ea = Math.atan2(e.y - cy, e.x - cx);
          let diff = ea - angle;
          while (diff > Math.PI) diff -= Math.PI*2;
          while (diff < -Math.PI) diff += Math.PI*2;
          if (Math.abs(diff) < 0.5) { // ~57 degree cone
            damageEnemy(e, def.dmg);
            if (def.dot) { e.dotTimer = def.dotDur; e.dotDmg = def.dot; e.dotTickTimer = 0; }
          }
        }
        // Flame visual
        game.projectiles.push({
          x: cx, y: cy, vx: 0, vy: 0,
          angle: angle, range: def.range,
          dmg: 0, color: '#ff8822', life: 0.12, flame: true
        });
        continue;
      }

      // Arrow upgrade: multishot volley (new attack — hits several enemies at once instead of one)
      if (base.id === 'arrow' && lvl >= 1) {
        const shots = Math.min(1 + lvl, 6);
        const targets = game.enemies
          .filter(e => !e.dead && Math.hypot(e.x - cx, e.y - cy) <= def.range)
          .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
          .slice(0, shots);
        for (const tgt of targets) {
          const pdx = tgt.x - cx, pdy = tgt.y - cy, pd = Math.hypot(pdx, pdy) || 1;
          game.projectiles.push({
            x: cx, y: cy,
            vx: (pdx / pd) * def.projSpeed * TILE, vy: (pdy / pd) * def.projSpeed * TILE,
            dmg: def.dmg, color: def.projColor, life: 2, towerId: base.id
          });
        }
        continue;
      }

      // Sniper upgrade: piercing round (new attack — one shot punches through several enemies in a line)
      if (base.id === 'sniper' && lvl >= 1) {
        const pdx = best.x - cx, pdy = best.y - cy, pd = Math.hypot(pdx, pdy) || 1;
        game.projectiles.push({
          x: cx, y: cy,
          vx: (pdx / pd) * def.projSpeed * TILE, vy: (pdy / pd) * def.projSpeed * TILE,
          dmg: def.dmg, color: def.projColor, life: 2,
          pierceLeft: lvl, hitList: [], towerId: base.id
        });
        continue;
      }

      // Standard projectile
      const travelTime = def.projSpeed > 0 ? bestDist / (def.projSpeed * TILE) : 0;
      let targetX = best.x, targetY = best.y;
      if (def.projSpeed > 0 && best.pathIdx + 1 < best.path.length) {
        const np = best.path[best.pathIdx + 1];
        const edx = np.x - best.x, edy = np.y - best.y;
        const ed = Math.sqrt(edx*edx+edy*edy) || 1;
        targetX += (edx/ed) * best.speed * TILE * travelTime * 0.5;
        targetY += (edy/ed) * best.speed * TILE * travelTime * 0.5;
      }

      const pdx = targetX - cx, pdy = targetY - cy;
      const pd = Math.sqrt(pdx*pdx+pdy*pdy) || 1;
      game.projectiles.push({
        x: cx, y: cy,
        vx: (pdx/pd) * def.projSpeed * TILE,
        vy: (pdy/pd) * def.projSpeed * TILE,
        dmg: def.dmg, color: def.projColor,
        splash: def.splash || 0, slow: def.slow || 0, slowDur: def.slowDur || 0,
        cluster: def.cluster || 0, infect: def.infect || 0,
        dot: def.dot || 0, dotDur: def.dotDur || 0,
        life: 2, towerId: base.id
      });
    }
  }

  // Apply poison DoT
  for (const e of game.enemies) {
    if (e.dead || !e.dotTimer) continue;
    e.dotTimer -= dt;
    e.dotTickTimer = (e.dotTickTimer || 0) - dt;
    if (e.dotTickTimer <= 0) {
      e.dotTickTimer = 0.5;
      damageEnemy(e, e.dotDmg || 4);
      spawnParticles(e.x, e.y, '#44cc66', 2);
      // Upgraded Poison: infection spreads to nearby healthy enemies
      if (e.infect) {
        for (const e2 of game.enemies) {
          if (e2.dead || e2 === e || e2.dotTimer > 0) continue;
          if (Math.hypot(e2.x - e.x, e2.y - e.y) < 40 && Math.random() < 0.25) {
            e2.dotTimer = e.dotTimer; e2.dotDmg = e.dotDmg; e2.dotTickTimer = 0; e2.infect = e.infect;
            spawnParticles(e2.x, e2.y, '#44cc66', 4);
          }
        }
      }
    }
    if (e.dotTimer <= 0) { e.dotTimer = 0; e.dotDmg = 0; e.infect = 0; }
  }

  // Move projectiles
  for (const p of game.projectiles) {
    // Lightning and flame are instant visuals, just fade
    if (p.lightning || p.flame) { p.life -= dt; continue; }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    // Hit detection
    for (const e of game.enemies) {
      if (e.dead || e.untargetable > 0) continue;
      if (p.hitList && p.hitList.includes(e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const eSize = enemySize(e);
      if (d < eSize + 4) {
        if (p.splash > 0) {
          for (const e2 of game.enemies) {
            if (e2.dead) continue;
            const d2 = Math.hypot(e2.x - p.x, e2.y - p.y);
            if (d2 < p.splash) {
              damageEnemy(e2, p.dmg * (1 - d2/p.splash * 0.5));
              if (p.slow) e2.slowed = p.slowDur;
              if (p.dot) { e2.dotTimer = p.dotDur; e2.dotDmg = p.dot; e2.dotTickTimer = 0; }
            }
          }
          spawnParticles(p.x, p.y, p.color, 10);
          // Cluster bomblets: extra small explosions scattered around impact
          if (p.cluster) {
            for (let c = 0; c < p.cluster; c++) {
              const ang = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 40;
              const bx = p.x + Math.cos(ang) * dist, by = p.y + Math.sin(ang) * dist;
              for (const e3 of game.enemies) {
                if (e3.dead) continue;
                if (Math.hypot(e3.x - bx, e3.y - by) < 30) damageEnemy(e3, p.dmg * 0.35);
              }
              spawnParticles(bx, by, '#ccaa66', 5);
            }
          }
        } else {
          damageEnemy(e, p.dmg, p.towerId);
          if (p.slow) e.slowed = p.slowDur;
          // Poison DoT
          if (p.dot) {
            e.dotTimer = p.dotDur; e.dotDmg = p.dot; e.dotTickTimer = 0;
            if (p.infect) e.infect = p.infect; // marks this enemy's poison as contagious
          }
          spawnParticles(p.x, p.y, p.color, 4);
        }
        if (p.pierceLeft > 0) {
          p.pierceLeft--;
          p.hitList = p.hitList || [];
          p.hitList.push(e);
          continue; // projectile keeps flying, hits the next enemy
        }
        p.life = 0;
        break;
      }
    }
  }

  // Cleanup
  game.projectiles = game.projectiles.filter(p => p.life > 0 && p.x > -20 && p.x < C.width+20 && p.y > -20 && p.y < C.height+20);
  game.enemies = game.enemies.filter(e => !e.dead);

  // Particles
  for (const p of game.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt * 2;
  }
  game.particles = game.particles.filter(p => p.life > 0);

  // Wave complete?
  if (game.waveActive && game.waveSpawnIdx >= game.waveEnemies.length && game.enemies.length === 0) {
    game.waveActive = false;
    game.activeBoss = null;
    game.shockwaves = [];
    for (const t of game.towers) t.stunned = 0;
    const clearedWave = game.wave;
    const flawless = game.waveStartHp !== undefined && game.hp === game.waveStartHp;
    game.wave++;
    let waveBonus = 30 + game.wave * 5;
    if (flawless) {
      const perfectBonus = 20 + clearedWave * 2;
      waveBonus += perfectBonus;
      SFX.play('flawless');
      notify('epic', `Flawless! No hearts lost — +${perfectBonus} bonus gold`);
      unlockAchievement('Flawless Defense', 'Cleared a wave without losing a single heart');
    } else {
      SFX.play('clear');
    }
    game.gold += waveBonus; // Wave bonus

    // Lifetime stats + skin unlock checks
    profile.stats.wavesCleared = (profile.stats.wavesCleared || 0) + 1;
    const runScore = (game.world - 1) * DIFFICULTY.wavesPerWorld + clearedWave;
    if (runScore > (profile.stats.bestScore || 0)) {
      profile.stats.bestScore = runScore;
      profile.stats.bestWorld = game.world;
      profile.stats.bestWave = clearedWave;
    }
    saveProfile();
    checkSkinUnlockNotifications();

    const WAVES_PER_WORLD = DIFFICULTY.wavesPerWorld;
    let worldedUp = false;
    if (game.wave > WAVES_PER_WORLD) {
      game.world++;
      game.wave = 1;
      worldedUp = true;
      groundCache = null; // force terrain rebuild with new theme
      document.body.style.background = getWorldTheme().bgBase;
      game.gold += 100 * (game.world - 1); // world-clear bonus
      unlockAchievement(`World ${game.world - 1} Cleared`, `Onward to World ${game.world} — it only gets harder from here`);
      if (game.buildMode === 'wall') buildWallBar();
    }

    // Check for new path unlocks
    const oldCount = game.activePaths.length;
    game.activePaths = getActivePaths(game.wave);
    pathSet = buildPathSet(game.wave);
    if (game.activePaths.length > oldCount) {
      const newPath = game.activePaths[game.activePaths.length - 1];
      game.newPathUnlocked = newPath.label;
      showFlash(`⚠️ NEW ROUTE: ${newPath.label} — enemies incoming from a new direction!`);
    }

    game.prepPhase = true;
    spawnSupplyCrates();
    document.getElementById('send-wave-btn').style.display = 'block';
    if (game.autoWave) game.autoWaveTimer = worldedUp ? 6 : 4;
    if (game.annihilatorUnlocked && !game.triBeamEquipped) showMerchant();
    if (worldedUp) {
      setTimeout(() => showWorldBanner(game.world, 'Welcome to the ' + getWorldTheme().name), 400);
    } else {
      showBannerText('WAVE ' + clearedWave + ' CLEARED', `+${waveBonus} GOLD EARNED${flawless ? ' · FLAWLESS' : ''}`);
    }
    updateUI();
  }
}

function availableUpgradePoints() {
  return Math.floor(game.xp / DIFFICULTY.xpPerUpgradePoint) - game.upgradesSpent;
}

function gainXP(amount) {
  const before = availableUpgradePoints();
  game.xp += amount;
  const after = availableUpgradePoints();
  if (after > before) {
    showFlash(`⭐ Upgrade point unlocked! (${after} available) — click a tower to upgrade it`);
  }
}

// Big Stache's signature stomp noise — his joke, his sound. Regular kills use SFX 'death'.

// ===== BOSS ABILITIES =====
const BOSS_ABILITY_LABEL = {
  slam: 'SHOCKWAVE', summon: 'SUMMONING', barrier: 'RAISING BARRIER',
  regen: 'REGENERATING', freeze: 'FROST NOVA', burrow: 'BURROWING',
};

function updateBossAbilities(dt) {
  const b = game.activeBoss;
  if (!b) return;
  if (b.dead) { game.activeBoss = null; return; }
  const bd = b.boss;

  // Passive: rage — the closer to death, the faster it moves
  if (bd.abilities.includes('rage')) {
    b.rageMult = 1 + (1 - b.hp / b.maxHp) * 0.9;
    b.enraged = b.hp / b.maxHp < 0.5;
  }

  // Mid-cast: run out the telegraph, then fire
  if (b.castT > 0) {
    b.castT -= dt;
    if (b.castT <= 0) {
      const a = b.casting;
      b.casting = null; b.castLabel = null;
      fireBossAbility(b, a);
    }
    return;
  }

  for (const a of bd.abilities) {
    const cfg = BOSS_ABILITIES[a];
    if (!cfg || !cfg.cd) continue; // rage is passive
    b.abilityTimers[a] -= dt;
    if (b.abilityTimers[a] <= 0) {
      b.abilityTimers[a] = cfg.cd;
      b.casting = a;
      b.castT = cfg.telegraph;
      b.castLabel = BOSS_ABILITY_LABEL[a] || a.toUpperCase();
      SFX.play('boss_cast');
      break; // one ability at a time
    }
  }
}

function fireBossAbility(b, a) {
  if (!b || b.dead) return;
  switch (a) {
    case 'slam': {
      // Shockwave: knocks nearby towers offline for a few seconds
      const R = 150;
      triggerShake(10, 0.45);
      SFX.play('boss_slam');
      game.shockwaves = game.shockwaves || [];
      game.shockwaves.push({ x: b.x, y: b.y, r: 0, maxR: R, life: 0.6 });
      for (const t of game.towers) {
        const tx = t.tx * TILE + TILE/2, ty = t.ty * TILE + TILE/2;
        if (Math.hypot(tx - b.x, ty - b.y) < R) {
          t.stunned = Math.max(t.stunned || 0, 3);
          spawnParticles(tx, ty, '#ff8844', 6);
        }
      }
      break;
    }
    case 'summon': {
      SFX.play('boss_cast');
      const kinds = [0, 1, 4];
      for (let i = 0; i < 4; i++) {
        const type = kinds[Math.floor(Math.random() * kinds.length)];
        const d = ENEMY_DEFS[type];
        const hp = Math.round(d.hp * (1 + (game.world - 1) * DIFFICULTY.worldHpGrowth));
        game.enemies.push({
          type, x: b.x + (Math.random() - 0.5) * 30, y: b.y + (Math.random() - 0.5) * 30,
          hp, maxHp: hp, speed: d.speed,
          path: b.path, pathIdx: b.pathIdx, dead: false, slowed: 0,
          shieldHp: d.shield || 0, healTimer: 0, necroTimer: 0, spawnT: 0.25,
        });
      }
      spawnParticles(b.x, b.y, '#22ff44', 18);
      showFlash(`${b.boss.name} summons reinforcements!`);
      break;
    }
    case 'barrier': {
      b.shieldHp = (b.shieldHp || 0) + Math.round(b.maxHp * 0.18);
      spawnParticles(b.x, b.y, '#4488ff', 20);
      SFX.play('boss_shield');
      showFlash(`${b.boss.name} raises a barrier!`);
      break;
    }
    case 'regen': {
      const healed = Math.round(b.maxHp * 0.1);
      b.hp = Math.min(b.maxHp, b.hp + healed);
      spawnDamageNum(b.x, b.y - 30, '+' + healed, 'heal');
      spawnParticles(b.x, b.y, '#44ff88', 16);
      SFX.play('boss_shield');
      break;
    }
    case 'freeze': {
      const R = 190;
      SFX.play('boss_slam');
      game.shockwaves = game.shockwaves || [];
      game.shockwaves.push({ x: b.x, y: b.y, r: 0, maxR: R, life: 0.6, color: '#8fd4ff' });
      for (const t of game.towers) {
        const tx = t.tx * TILE + TILE/2, ty = t.ty * TILE + TILE/2;
        if (Math.hypot(tx - b.x, ty - b.y) < R) {
          t.stunned = Math.max(t.stunned || 0, 4);
          spawnParticles(tx, ty, '#8fd4ff', 6);
        }
      }
      showFlash(`${b.boss.name} freezes your towers solid!`);
      break;
    }
    case 'burrow': {
      b.untargetable = 2.2;
      spawnParticles(b.x, b.y, '#8b6b3d', 18);
      showFlash(`${b.boss.name} burrows underground!`);
      break;
    }
  }
}

// Shockwave rings from boss slams

function damageEnemy(e, dmg, source) {
  // Burrowed / phased out: immune on every path (direct, splash, chain, cone, ZAP)
  if (e.untargetable > 0) return;
  dmg = affixModifyDamage(e, dmg, source);
  // Shield absorbs damage first
  if (e.shieldHp > 0) {
    const absorbed = Math.min(dmg, e.shieldHp);
    e.shieldHp -= absorbed;
    dmg -= absorbed;
    spawnParticles(e.x - 8, e.y, '#4488ff', 3);
    spawnDamageNum(e.x, e.y - 12, Math.round(absorbed), 'shield');
    if (dmg <= 0) return;
  }
  e.hp -= dmg;
  e.hitFlash = 0.06; // white flash
  const isCrit = dmg >= 60;
  spawnDamageNum(e.x + (Math.random()-0.5)*16, e.y - 14, Math.round(dmg), isCrit ? 'crit' : (dmg < 6 ? 'dot' : 'normal'));
  if (e.hp <= 0) {
    e.dead = true;
    e.deathX = e.x; e.deathY = e.y; e.deathTime = Date.now();
    e.squash = 0.28; // death squash animation timer
    if (!game.deadEnemies) game.deadEnemies = [];
    game.deadEnemies.push({ x: e.x, y: e.y, revived: false });
    if (game.deadEnemies.length > 20) game.deadEnemies.shift(); // cap memory
    const def = ENEMY_DEFS[e.type];
    if (e.boss) {
      // Boss kill: big payout, a banner, and a permanent trophy
      const bounty = 250 + game.world * 120;
      game.gold += bounty;
      game.activeBoss = null;
      triggerShake(12, 0.7);
      SFX.play('boss_die');
      spawnParticles(e.x, e.y, '#ffd87a', 45);
      showBannerText(e.boss.name + ' FALLS', `+${bounty} GOLD BOUNTY`, 2600);
      unlockAchievement('Slayer of ' + titleCase(e.boss.name), `Defeated ${e.boss.name}, ${e.boss.title}`);
      profile.stats.bossesSlain = (profile.stats.bossesSlain || 0) + 1;
      game.bossesSlain = (game.bossesSlain || 0) + 1;
      saveProfile();
    }
    game.gold += def.reward;
    game.kills++;
    gainMana(e.boss ? 25 : DIFFICULTY.manaPerKill);
    affixOnDeath(e);
    profile.stats.totalKills = (profile.stats.totalKills || 0) + 1;
    gainXP(def.xp || 1);
    SFX.play('death');
    SFX.play('coin');
    tutorialEvent('kill');
    spawnDamageNum(e.x, e.y - 26, '+' + def.reward, 'gold');
    spawnParticles(e.x, e.y, def.color, 8);
    updateUI();
  }
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}


function render() {
  ctx.save();
  if (game && game.shakeT > 0) {
    game.shakeT -= 1/60;
    const s = game.shakeStr || 4;
    ctx.translate((Math.random()-0.5)*s*2, (Math.random()-0.5)*s*2);
  }
  drawGround();
  drawPlacement();
  drawSupplyCrates();
  drawTowers();
  drawWalls();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawHero();
  updateDrawShockwaves(1/60);
  updateDrawDamageNums(1/60);
  drawWaveNotice();
  drawBossBar();
  drawPowerTargeting();
  ctx.restore();
  // Red vignette pulse when castle recently hit
  if (game && game.hurtT > 0) {
    game.hurtT -= 1/60;
    const a = Math.min(game.hurtT / 0.3, 1) * 0.35;
    const grad = ctx.createRadialGradient(C.width/2, C.height/2, C.height*0.4, C.width/2, C.height/2, C.height*0.75);
    grad.addColorStop(0, 'rgba(179,54,46,0)');
    grad.addColorStop(1, `rgba(179,54,46,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.width, C.height);
  }
  // White lightning flash from the ZAP secret
  if (game && game.zapFlashT > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${(game.zapFlashT / 0.3) * 0.55})`;
    ctx.fillRect(0, 0, C.width, C.height);
    ctx.restore();
  }
}


function updateUI() {
  // HP pips (25 hp -> 5 groups of 5)
  const pipsEl = $id('hp-pips');
  if (pipsEl.childElementCount === 0) {
    for (let gI = 0; gI < 5; gI++) {
      const grp = document.createElement('div');
      grp.className = 'hp-group';
      for (let p = 0; p < 5; p++) { const pip = document.createElement('div'); pip.className = 'hp-pip'; grp.appendChild(pip); }
      pipsEl.appendChild(grp);
    }
  }
  const pips = pipsEl.querySelectorAll('.hp-pip');
  pips.forEach((pip, i) => {
    const alive = i < game.hp;
    const wasAlive = !pip.classList.contains('lost');
    if (!alive && wasAlive) { pip.classList.add('shatter'); setTimeout(() => pip.classList.remove('shatter'), 400); }
    pip.classList.toggle('lost', !alive);
  });

  // Gold with pop animation on change
  const goldEl = $id('gold');
  const newGold = Math.floor(game.gold);
  if (goldEl.textContent !== String(newGold)) {
    goldEl.textContent = newGold.toLocaleString();
    goldEl.classList.remove('gold-pop');
    void goldEl.offsetWidth;
    goldEl.classList.add('gold-pop');
  }
  // Show gold income rate from Gold Mines
  const incomeEl = $id('gold-income');
  const mines = game.towers.filter(t => TOWER_TYPES[t.type].income);
  if (mines.length > 0) {
    const totalRate = mines.reduce((s, t) => s + DIFFICULTY.goldMineRate * (1 + (t.level || 0) * 0.5), 0);
    incomeEl.textContent = Math.round(totalRate) + '/s';
    incomeEl.style.display = '';
  } else {
    incomeEl.style.display = 'none';
  }

  $id('wave').textContent = game.wave;
  $id('world').textContent = game.world;
  $id('kills').textContent = game.kills;
  $id('xp').textContent = game.xp;

  // XP progress bar toward next point
  const pts = availableUpgradePoints();
  const xpFill = $id('xp-fill');
  const progress = (game.xp % DIFFICULTY.xpPerUpgradePoint) / DIFFICULTY.xpPerUpgradePoint * 100;
  xpFill.style.width = (pts > 0 ? 100 : progress) + '%';
  xpFill.classList.toggle('full', pts > 0);

  const upgradeStat = $id('upgrade-stat');
  $id('upgrade-pts').textContent = pts;
  upgradeStat.style.display = pts > 0 ? 'flex' : 'none';
  updateTowerBar();
  requestSave();
}


function endGame() {
  game.running = false;
  game.gameOver = true;
  if (!game.dailyChallenge) clearGameState();
  profile.stats.gamesPlayed = (profile.stats.gamesPlayed || 0) + 1;
  saveProfile();
  playEvilLaugh();
  for (const id of ['send-wave-btn', 'auto-wave-btn', 'speed-btn', 'hint', 'pause-toggle-btn']) {
    document.getElementById(id).style.display = 'none';
  }
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('coach').classList.remove('show');
  tutorial = null;
  setGameChromeVisible(false);
  const ov = document.getElementById('overlay');
  ov.classList.remove('home-mode');
  ov.style.display = 'flex';

  // Run summary + lifetime deltas for the results screen
  const runScore = (game.world - 1) * DIFFICULTY.wavesPerWorld + game.wave;
  const ps = game.profileStart || { kills: 0, waves: 0, bestScore: 0 };
  const killDelta = (profile.stats.totalKills || 0) - ps.kills;
  const waveDelta = (profile.stats.wavesCleared || 0) - ps.waves;
  const newBest = !game.dailyChallenge && (profile.stats.bestScore || 0) > (ps.bestScore || 0);
  const runEntry = {
    score: runScore, world: game.world, wave: game.wave, kills: game.kills,
    towers: game.towers.length, bosses: game.bossesSlain || 0,
    durationMs: game.startedAt ? Date.now() - game.startedAt : 0,
    date: todayStr(), mode: game.dailyChallenge ? 'daily' : 'run',
  };
  const hofRank = recordHallOfFame(runEntry);
  // Fire-and-forget: the results screen never waits on the network
  submitScoreToLeaderboard(runEntry).then(res => {
    const el = document.getElementById('global-rank');
    if (!el) return;
    if (res && res.rank) {
      el.textContent = `Global rank #${Number(res.rank) || 0}`;
      el.style.display = '';
    }
  });
  const achEarned = Object.keys(game.achievements || {});
  const achChips = achEarned.length
    ? `<div class="go-ach">${achEarned.map(() => '<span></span>').join('')}</div>`
    : '';
  const statCard = (val, lbl, delta) =>
    `<div class="go-stat"><div class="go-val">${val}</div><div class="go-lbl">${lbl}</div>${delta ? `<div class="go-delta">${delta}</div>` : ''}</div>`;

  if (game.dailyChallenge) {
    restoreConfigAfterDaily();
    const isNewBest = saveDailyBest(runScore);
    const best = getDailyBest().best || runScore;
    ov.innerHTML = `
      <h1>DAILY CHALLENGE OVER</h1>
      <div class="sub">Seed ${todayStr()} — everyone plays this exact gauntlet today</div>
      ${isNewBest ? '<div class="go-badge">NEW BEST SCORE</div>' : ''}
      <div id="global-rank" class="go-global" style="display:none"></div>
      <div class="go-grid">
        ${statCard(runScore, 'Waves survived', isNewBest ? '' : `best ever: ${best}`)}
        ${statCard(game.kills, 'Enemies slain', killDelta > 0 ? `lifetime: ${(profile.stats.totalKills || 0).toLocaleString()}` : '')}
        ${statCard(game.towers.length, 'Towers built', '')}
      </div>
      ${achChips}
      <div id="start-buttons">
        <button onclick="startDailyChallenge()">TRY AGAIN</button>
        <button class="secondary-btn" id="share-btn" onclick="shareRun()">SHARE YOUR SCORE</button>
        <button class="secondary-btn" onclick="returnToMenu()">MAIN MENU</button>
      </div>
    `;
  } else {
    ov.innerHTML = `
      <h1>THE CASTLE HAS FALLEN</h1>
      <div class="sub">You held the line until World ${game.world}, Wave ${game.wave}</div>
      ${newBest ? '<div class="go-badge">NEW PERSONAL BEST</div>' : (hofRank ? `<div class="go-badge rank">#${hofRank} BEST RUN EVER</div>` : '')}
      <div id="global-rank" class="go-global" style="display:none"></div>
      <div class="go-grid">
        ${statCard(runScore, 'Waves survived', waveDelta > 0 ? `lifetime: ${(profile.stats.wavesCleared || 0).toLocaleString()} (+${waveDelta})` : '')}
        ${statCard(game.kills, 'Enemies slain', killDelta > 0 ? `lifetime: ${(profile.stats.totalKills || 0).toLocaleString()} (+${killDelta})` : '')}
        ${statCard(game.towers.length, 'Towers built', '')}
        ${game.bossesSlain ? statCard(game.bossesSlain, game.bossesSlain > 1 ? 'Bosses slain' : 'Boss slain', '') : statCard(achEarned.length, 'Achievements', '')}
      </div>
      ${achChips}
      <div id="start-buttons">
        <button onclick="startGame(false)">PLAY AGAIN</button>
        <button class="secondary-btn" id="share-btn" onclick="shareRun()">SHARE YOUR SCORE</button>
        <button class="secondary-btn" onclick="returnToMenu()">MAIN MENU</button>
      </div>
    `;
  }
  // Achievement names go in via textContent (they can contain arbitrary strings)
  const chipEls = ov.querySelectorAll('.go-ach span');
  achEarned.forEach((name, i) => { if (chipEls[i]) chipEls[i].textContent = name; });
}


// ===== WALL BUILDING =====
// Walls go ON the lane — that is the entire point — so they use their own
// placement rules rather than the tower ones.
function spawnTileSet() {
  const set = new Set();
  for (const p of (game ? game.activePaths : getActivePaths(1))) {
    const [x, y] = p.tiles[0];
    set.add(x + ',' + y);
  }
  return set;
}

function canPlaceWall(tx, ty) {
  if (!isPath(tx, ty)) return 'Walls can only be built on the path — that is what makes them useful';
  if (isCastle(tx, ty)) return 'Not on the castle';
  if (spawnTileSet().has(tx + ',' + ty)) return 'Too close to the gate they march out of';
  if (wallAt(tx, ty)) return 'There is already a wall here';
  if (game.towers.some(t => t.tx === tx && t.ty === ty)) return 'A tower is standing there';
  // Don't trap an enemy inside a freshly built wall
  const occupied = game.enemies.some(e => !e.dead &&
    Math.floor(e.x / TILE) === tx && Math.floor(e.y / TILE) === ty);
  if (occupied) return 'Something is standing there right now';
  return null;
}

function placeWall(tx, ty) {
  const def = WALL_TYPES[game.selectedWall];
  const cost = getWallCost(game.selectedWall);
  const why = canPlaceWall(tx, ty);
  if (why) { SFX.play('error'); showFlash(why); return; }
  if (game.gold < cost) {
    SFX.play('error');
    showFlash(`Not enough gold! Need ${cost} (have ${Math.floor(game.gold)})`);
    return;
  }
  game.gold -= cost;
  game.walls.push({ tx, ty, type: game.selectedWall, hp: def.hp, maxHp: def.hp, buyCost: cost });
  SFX.play('wall_place');
  spawnParticles(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#a89878', 12);
  updateUI();
}

function damageWall(w, dmg) {
  if (w.destroyed) return; // already finished off earlier this frame
  w.hp -= dmg;
  w.hitFlash = 0.08;
  if (w.hp <= 0) {
    w.destroyed = true;
    const i = game.walls.indexOf(w);
    if (i === -1) return;
    game.walls.splice(i, 1);
    const cx = w.tx * TILE + TILE / 2, cy = w.ty * TILE + TILE / 2;
    SFX.play('wall_break');
    spawnParticles(cx, cy, WALL_TYPES[w.type].wood, 22);
    triggerShake(4, 0.2);
    showFlash(`${WALL_TYPES[w.type].name} destroyed!`);
  }
}

// ===== SUPPLY CRATES =====
function spawnSupplyCrates() {
  if (!game) return;
  game.supplyCrates = [];
  const count = 1 + Math.floor(Math.random() * 2) + (game.world > 3 ? 1 : 0);
  const occupied = new Set();
  for (const t of game.towers) occupied.add(`${t.tx},${t.ty}`);
  for (const w of game.walls) occupied.add(`${w.tx},${w.ty}`);
  const candidates = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (!isPath(x, y) && !isCastle(x, y) && !occupied.has(`${x},${y}`)) candidates.push({x, y});
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const min = DIFFICULTY.supplyCrateMin;
  const max = DIFFICULTY.supplyCrateMax;
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    const c = candidates[i];
    const gold = min + Math.floor(Math.random() * (max - min + 1)) + game.world * 5;
    game.supplyCrates.push({ tx: c.x, ty: c.y, gold, spawnT: Date.now(), collected: false });
  }
}

function collectCrate(tx, ty) {
  if (!game || !game.supplyCrates) return false;
  const idx = game.supplyCrates.findIndex(c => c.tx === tx && c.ty === ty && !c.collected);
  if (idx === -1) return false;
  const crate = game.supplyCrates[idx];
  crate.collected = true;
  game.gold += crate.gold;
  game.cratesCollected = (game.cratesCollected || 0) + 1;
  if (game.cratesCollected >= 20) unlockAchievement('Crate Hoarder', 'Collected 20 supply crates in a single run');
  SFX.play('coin');
  spawnDamageNum(tx * TILE + TILE/2, ty * TILE, '+' + crate.gold, 'gold');
  spawnParticles(tx * TILE + TILE/2, ty * TILE + TILE/2, '#e8b64c', 15);
  game.supplyCrates.splice(idx, 1);
  updateUI();
  return true;
}
