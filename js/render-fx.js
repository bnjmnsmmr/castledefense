// ===== RENDER: EFFECTS =====
// Projectiles, particles, shockwaves, boss bar, damage numbers, screen shake, hero, nugget, supply crates, wave notice.

function drawProjectiles() {
  for (const p of game.projectiles) {
    // Lightning bolt
    if (p.lightning) {
      ctx.globalAlpha = p.life * 6;
      ctx.strokeStyle = '#aaff44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // Jagged line
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const segs = 5;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const jx = (i < segs) ? (Math.random() - 0.5) * 12 : 0;
        const jy = (i < segs) ? (Math.random() - 0.5) * 12 : 0;
        ctx.lineTo(p.x + dx * t + jx, p.y + dy * t + jy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    // Flame cone
    if (p.flame) {
      ctx.globalAlpha = p.life * 6;
      ctx.fillStyle = '#ff6622';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle - 0.5) * p.range, p.y + Math.sin(p.angle - 0.5) * p.range);
      ctx.lineTo(p.x + Math.cos(p.angle + 0.5) * p.range, p.y + Math.sin(p.angle + 0.5) * p.range);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffcc44';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle - 0.25) * p.range * 0.7, p.y + Math.sin(p.angle - 0.25) * p.range * 0.7);
      ctx.lineTo(p.x + Math.cos(p.angle + 0.25) * p.range * 0.7, p.y + Math.sin(p.angle + 0.25) * p.range * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.splash ? 4 : 3, 0, Math.PI*2);
    ctx.fill();
    // Trail
    ctx.fillStyle = p.color + '44';
    ctx.beginPath();
    ctx.arc(p.x - p.vx*2, p.y - p.vy*2, 2, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}


function drawWaveNotice() {
  if (game.prepPhase) {
    let msg = game.newPathUnlocked
      ? `NEW ROUTE: ${game.newPathUnlocked}! Place towers for Wave ${game.wave}`
      : `Place towers, then send Wave ${game.wave}`;
    if (game.autoWave && game.autoWaveTimer !== undefined) {
      msg += `  •  auto-sending in ${Math.ceil(game.autoWaveTimer)}s`;
    }
    const w = Math.max(ctx.measureText(msg).width + 40, 280);
    ctx.fillStyle = game.newPathUnlocked ? 'rgba(180,40,40,0.6)' : 'rgba(10,10,18,0.5)';
    ctx.fillRect(C.width/2 - w/2, C.height/2 - 24, w, 48);
    ctx.fillStyle = '#f0c040';
    ctx.font = '600 15px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(msg, C.width/2, C.height/2 + 6);
    // Show path count
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(`${game.activePaths.length} active route${game.activePaths.length > 1 ? 's' : ''}`, C.width/2, C.height/2 + 22);
    ctx.textAlign = 'left';
  }
}


function updateDrawShockwaves(dt) {
  if (!game.shockwaves || !game.shockwaves.length) return;
  for (let i = game.shockwaves.length - 1; i >= 0; i--) {
    const w = game.shockwaves[i];
    w.life -= dt;
    if (w.life <= 0) { game.shockwaves.splice(i, 1); continue; }
    const p = 1 - w.life / 0.6;
    const rgb = w.color === '#8fd4ff' ? '143,212,255' : '255,136,68';
    ctx.strokeStyle = `rgba(${rgb},${1 - p})`;
    ctx.lineWidth = 5 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.maxR * p, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Boss health bar pinned to the top of the board
function drawBossBar() {
  const b = game.activeBoss;
  if (!b || b.dead) return;
  const W = C.width * 0.5, X = (C.width - W) / 2, Y = 92;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,6,0.82)';
  ctx.fillRect(X - 4, Y - 22, W + 8, 40);
  ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 1.5;
  ctx.strokeRect(X - 4, Y - 22, W + 8, 40);

  ctx.textAlign = 'center';
  ctx.font = '900 14px Cinzel, Georgia, serif';
  ctx.fillStyle = '#e8b64c';
  ctx.fillText(b.boss.name, C.width / 2, Y - 7);

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(X, Y, W, 11);
  const pct = Math.max(b.hp / b.maxHp, 0);
  const grad = ctx.createLinearGradient(X, 0, X + W, 0);
  grad.addColorStop(0, b.enraged ? '#ff5533' : '#b3362e');
  grad.addColorStop(1, b.enraged ? '#ffaa33' : '#e0766f');
  ctx.fillStyle = grad;
  ctx.fillRect(X, Y, W * pct, 11);
  // Barrier overlay
  if (b.shieldHp > 0) {
    ctx.fillStyle = 'rgba(110,170,255,0.75)';
    ctx.fillRect(X, Y, W * Math.min(b.shieldHp / b.maxHp, 1), 11);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(X, Y, W, 11);

  // Telegraph: what it's about to do
  if (b.castLabel) {
    ctx.font = '800 11px Inter, sans-serif';
    ctx.fillStyle = '#ffd87a';
    ctx.fillText('\u26a0 ' + b.castLabel, C.width / 2, Y + 26);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}


// --- DAMAGE NUMBERS ---
function spawnDamageNum(x, y, val, kind) {
  if (!game.dmgNums) game.dmgNums = [];
  if (game.dmgNums.length > 60) game.dmgNums.shift();
  game.dmgNums.push({ x, y, val, kind, life: 0.65 });
}
function updateDrawDamageNums(dt) {
  if (!game.dmgNums) return;
  for (let i = game.dmgNums.length - 1; i >= 0; i--) {
    const d = game.dmgNums[i];
    d.y -= 42 * dt;
    d.life -= dt;
    if (d.life <= 0) { game.dmgNums.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(d.life / 0.3, 1);
    const size = d.kind === 'combo' ? 20 : (d.kind === 'crit' ? 19 : (d.kind === 'dot' ? 11 : (d.kind === 'gold' ? 12 : 14)));
    ctx.font = `800 ${size}px Inter, sans-serif`;
    ctx.fillStyle = d.kind === 'combo' ? '#ff6ad5' : (d.kind === 'crit' ? '#e8b64c' : (d.kind === 'dot' ? '#5fae4c' : (d.kind === 'shield' ? '#6fa8d6' : (d.kind === 'gold' ? '#ffd87a' : (d.kind === 'heal' ? '#66ff99' : '#f5f2ea')))));
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    const txt = d.kind === 'crit' ? d.val + '!' : String(d.val);
    ctx.strokeText(txt, d.x, d.y);
    ctx.fillText(txt, d.x, d.y);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

// --- SCREEN SHAKE ---
function triggerShake(strength = 4, duration = 0.25) {
  game.shakeT = duration;
  game.shakeStr = strength;
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, color, size: 2 + Math.random() * 3
    });
  }
}


function drawHero() {
  if (!game || !game.hero) return;
  const h = game.hero;
  const t = Date.now() / 1000;
  const bounce = Math.abs(Math.sin(t * 4)) * 8;
  const legSwing = Math.sin(t * 8) * 0.4;

  ctx.save();
  ctx.translate(h.x, h.y - bounce);

  // === GIANT CHARACTER (100px tall) ===

  // Legs (blue overalls)
  ctx.fillStyle = '#2244cc';
  ctx.save(); ctx.translate(-15, 65); ctx.rotate(legSwing);
  ctx.fillRect(-8, 0, 16, 35);
  // Boot
  ctx.fillStyle = '#553311';
  ctx.fillRect(-10, 30, 20, 10);
  ctx.restore();
  ctx.save(); ctx.translate(15, 65); ctx.rotate(-legSwing);
  ctx.fillStyle = '#2244cc';
  ctx.fillRect(-8, 0, 16, 35);
  ctx.fillStyle = '#553311';
  ctx.fillRect(-10, 30, 20, 10);
  ctx.restore();

  // Body (red shirt)
  ctx.fillStyle = '#dd2222';
  ctx.beginPath();
  ctx.ellipse(0, 45, 28, 25, 0, 0, Math.PI*2);
  ctx.fill();

  // Overalls straps
  ctx.fillStyle = '#2244cc';
  ctx.fillRect(-20, 30, 10, 25);
  ctx.fillRect(10, 30, 10, 25);
  // Buttons
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.arc(-15, 38, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(15, 38, 3, 0, Math.PI*2); ctx.fill();

  // Arms swinging
  ctx.fillStyle = '#dd2222';
  ctx.save(); ctx.translate(-28, 40); ctx.rotate(-legSwing * 0.8);
  ctx.fillRect(-6, 0, 12, 28);
  // Glove
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 30, 8, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(28, 40); ctx.rotate(legSwing * 0.8);
  ctx.fillStyle = '#dd2222';
  ctx.fillRect(-6, 0, 12, 28);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 30, 8, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Head
  ctx.fillStyle = '#ffcc88';
  ctx.beginPath(); ctx.arc(0, 15, 22, 0, Math.PI*2); ctx.fill();

  // Cap (red with brim)
  ctx.fillStyle = '#dd2222';
  ctx.beginPath();
  ctx.arc(0, 10, 23, Math.PI, 0);
  ctx.fill();
  // Brim
  ctx.fillStyle = '#dd2222';
  ctx.fillRect(-28, 8, 56, 6);
  // Cap circle emblem
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI*2); ctx.fill();
  // Star on cap
  ctx.fillStyle = '#ffcc00';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', 0, 7);
  ctx.textAlign = 'left';

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-8, 14, 6, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, 14, 6, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2244aa';
  ctx.beginPath(); ctx.arc(-7, 15, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(9, 15, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-6.5, 15, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(9.5, 15, 2, 0, Math.PI*2); ctx.fill();

  // Big nose
  ctx.fillStyle = '#ee9966';
  ctx.beginPath(); ctx.ellipse(0, 22, 7, 5, 0, 0, Math.PI*2); ctx.fill();

  // HUGE mustache
  ctx.fillStyle = '#442200';
  ctx.beginPath();
  ctx.moveTo(-18, 26);
  ctx.quadraticCurveTo(-12, 22, -4, 26);
  ctx.quadraticCurveTo(0, 30, 4, 26);
  ctx.quadraticCurveTo(12, 22, 18, 26);
  ctx.quadraticCurveTo(14, 32, 8, 30);
  ctx.quadraticCurveTo(0, 34, -8, 30);
  ctx.quadraticCurveTo(-14, 32, -18, 26);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#aa6644';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 28, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawNugget() {
  if (!game || !game.nuggets) return;
  for (const nug of game.nuggets) {

  if (nug.phase === 'falling') {
    const progress = Math.min((nug.y + 60) / (nug.targetY + 60), 1);
    const shadowR = 10 + progress * 25;
    ctx.fillStyle = `rgba(255,100,0,${0.08 + progress * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(nug.targetX, nug.targetY, shadowR, shadowR * 0.4, 0, 0, Math.PI*2);
    ctx.fill();

    const ns = 12 + progress * 6;
    ctx.save();
    ctx.translate(nug.x, nug.y);
    ctx.rotate(nug.y * 0.03);
    ctx.fillStyle = '#D4943A';
    ctx.beginPath();
    ctx.moveTo(-ns, -ns*0.3);
    ctx.quadraticCurveTo(-ns*0.8, -ns*0.9, -ns*0.2, -ns*0.8);
    ctx.quadraticCurveTo(ns*0.3, -ns, ns*0.7, -ns*0.6);
    ctx.quadraticCurveTo(ns*1.1, -ns*0.2, ns, ns*0.3);
    ctx.quadraticCurveTo(ns*0.8, ns*0.9, ns*0.1, ns*0.8);
    ctx.quadraticCurveTo(-ns*0.5, ns*1, -ns*0.9, ns*0.5);
    ctx.quadraticCurveTo(-ns*1.2, ns*0.1, -ns, -ns*0.3);
    ctx.fill();
    ctx.fillStyle = '#E8B04A';
    ctx.beginPath();
    ctx.ellipse(-ns*0.3, -ns*0.2, ns*0.3, ns*0.15, 0.3, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  if (nug.phase === 'impact') {
    const t = nug.timer;
    const ringR = nug.blastRadius * Math.min(t * 4, 1);
    ctx.strokeStyle = `rgba(255,180,50,${Math.max(0, 1 - t * 1.5)})`;
    ctx.lineWidth = 4 * Math.max(0, 1 - t);
    ctx.beginPath();
    ctx.arc(nug.targetX, nug.targetY, ringR, 0, Math.PI*2);
    ctx.stroke();
    if (t < 0.2) {
      ctx.fillStyle = `rgba(255,230,150,${0.4 - t*2})`;
      ctx.beginPath();
      ctx.arc(nug.targetX, nug.targetY, ringR * 0.5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  } // end for
}


function drawSupplyCrates() {
  if (!game || !game.supplyCrates) return;
  const now = Date.now();
  for (const c of game.supplyCrates) {
    if (c.collected) continue;
    const age = (now - c.spawnT) / 1000;
    const bob = Math.sin(age * 2.5) * 2;
    const px = c.tx * TILE + TILE/2, py = c.ty * TILE + TILE/2 + bob;
    ctx.save();
    // Crate body
    ctx.fillStyle = '#8b6914';
    ctx.strokeStyle = '#5c4310';
    ctx.lineWidth = 2;
    ctx.fillRect(px - 12, py - 10, 24, 20);
    ctx.strokeRect(px - 12, py - 10, 24, 20);
    // Cross planks
    ctx.strokeStyle = '#a07818';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.stroke();
    // Gold coin icon
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(px, py - 1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8960f';
    ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('G', px, py);
    // Shimmer
    ctx.globalAlpha = 0.4 + Math.sin(age * 4) * 0.3;
    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 13, py - 11, 26, 22);
    ctx.restore();
  }
}
