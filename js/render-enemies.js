// ===== RENDER: ENEMIES =====
// Offscreen buffer compositing plus one drawer per enemy type (ENEMY_DRAWERS).

const ENEMY_BUF = 112;
const enemyBufCv = document.createElement('canvas');
enemyBufCv.width = enemyBufCv.height = ENEMY_BUF;
const enemyBufCtx = enemyBufCv.getContext('2d');
const enemyOutCv = document.createElement('canvas');
enemyOutCv.width = enemyOutCv.height = ENEMY_BUF;
const enemyOutCtx = enemyOutCv.getContext('2d');
const ENEMY_DRAWERS = [drawSkeleton, drawGoblin, drawOgre, drawDarkKnight, drawRats, drawWizard, drawBat, drawShieldBearer, drawNecromancer];

function drawEnemies() {
  const t = Date.now() / 1000;
  const frameDt = 1/60;
  const HALF = ENEMY_BUF / 2;
  for (const e of game.enemies) {
    if (e.dead && !(e.squash > 0)) continue;
    const def = ENEMY_DEFS[e.type];
    const es = enemySize(e);
    const s = es / 10; // scale factor
    const bob = Math.sin(t * 6 + e.x * 0.1) * 1.5; // walk bob
    const frozen = e.slowed > 0;

    // Figure out facing direction
    let facing = 1;
    if (e.pathIdx + 1 < e.path.length) {
      const np = e.path[e.pathIdx + 1];
      if (np.x < e.x) facing = -1;
    }

    // 1. Paint the character into the offscreen buffer (drawer fns target the global `ctx`)
    enemyBufCtx.clearRect(0, 0, ENEMY_BUF, ENEMY_BUF);
    enemyBufCtx.save();
    enemyBufCtx.translate(HALF, HALF);
    enemyBufCtx.scale(facing, 1);
    const mainCtx = ctx;
    ctx = enemyBufCtx;
    ENEMY_DRAWERS[e.type](s, frozen, t, e);
    ctx = mainCtx;
    enemyBufCtx.restore();

    // 2. Ink silhouette for the outline pass
    enemyOutCtx.clearRect(0, 0, ENEMY_BUF, ENEMY_BUF);
    enemyOutCtx.drawImage(enemyBufCv, 0, 0);
    enemyOutCtx.globalCompositeOperation = 'source-in';
    enemyOutCtx.fillStyle = 'rgba(18,14,10,0.85)';
    enemyOutCtx.fillRect(0, 0, ENEMY_BUF, ENEMY_BUF);
    enemyOutCtx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(e.x, e.y + bob);

    // Spawn pop-in: characters grow into the world instead of blinking in
    if (e.spawnT > 0) {
      e.spawnT -= frameDt;
      const g = 1 - Math.max(e.spawnT, 0) / 0.25;
      ctx.scale(g, g);
    }

    // Death squash: stretch wide + flat, fade out
    if (e.dead && e.squash > 0) {
      e.squash -= frameDt;
      const p = Math.max(e.squash / 0.28, 0);
      ctx.globalAlpha = p;
      ctx.scale(1 + (1-p)*0.5, Math.max(p, 0.15));
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, es + 2, es * 0.9, 3, 0, 0, Math.PI*2);
    ctx.fill();

    // 3. Composite: outline underneath, character on top
    for (const [ox, oy] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) {
      ctx.drawImage(enemyOutCv, -HALF + ox, -HALF + oy);
    }
    ctx.drawImage(enemyBufCv, -HALF, -HALF);

    // Hit flash: brief white glow
    if (e.hitFlash > 0) {
      e.hitFlash -= frameDt;
      ctx.globalAlpha = Math.min(e.hitFlash / 0.06, 1) * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, es * 1.15, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // HP bar (drawn in world space, not flipped) — bosses get a chunkier framed bar
    const isBoss = es >= 16;
    const barW = Math.max(es * 2.5, 20);
    const barH = isBoss ? 5 : 3;
    const barY = e.y - es - (isBoss ? 15 : 10) + bob;
    const hpPct = e.hp / e.maxHp;
    if (isBoss) {
      ctx.fillStyle = 'rgba(10,8,6,0.85)';
      ctx.fillRect(e.x - barW/2 - 1.5, barY - 1.5, barW + 3, barH + 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - barW/2, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : (hpPct > 0.25 ? '#ccaa44' : '#cc4444');
    ctx.fillRect(e.x - barW/2, barY, barW * hpPct, barH);
  }
}

function drawSkeleton(s, frozen, t) {
  const c = frozen ? '#88aacc' : '#e8dcc8';
  const dark = frozen ? '#6688aa' : '#b0a48a';
  const walk = Math.sin(t * 8) * 0.2;

  // Legs (two bones)
  ctx.strokeStyle = c; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3*s, 4*s); ctx.lineTo(-5*s, 12*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3*s, 4*s); ctx.lineTo(5*s, 12*s); ctx.stroke();
  // Feet
  ctx.beginPath(); ctx.moveTo(-5*s, 12*s); ctx.lineTo(-7*s, 12*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5*s, 12*s); ctx.lineTo(7*s, 12*s); ctx.stroke();

  // Ribcage
  ctx.strokeStyle = c; ctx.lineWidth = 1.2 * s;
  ctx.beginPath(); ctx.moveTo(0, -2*s); ctx.lineTo(0, 5*s); ctx.stroke(); // spine
  for (let i = 0; i < 3; i++) {
    const ry = (-1 + i * 2.2) * s;
    ctx.beginPath();
    ctx.moveTo(-4*s, ry); ctx.quadraticCurveTo(0, ry + 1.5*s, 4*s, ry);
    ctx.stroke();
  }

  // Arms
  const armSwing = Math.sin(t * 8) * 15 * Math.PI / 180;
  ctx.save();
  // Right arm with sword
  ctx.translate(4*s, -1*s); ctx.rotate(armSwing);
  ctx.strokeStyle = c; ctx.lineWidth = 1.3 * s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6*s, 5*s); ctx.stroke();
  // Sword
  ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.moveTo(6*s, 5*s); ctx.lineTo(10*s, -2*s); ctx.stroke();
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(5*s, 4*s, 3*s, 2*s); // guard
  ctx.restore();

  ctx.save();
  // Left arm with shield
  ctx.translate(-4*s, -1*s); ctx.rotate(-armSwing);
  ctx.strokeStyle = c; ctx.lineWidth = 1.3 * s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5*s, 4*s); ctx.stroke();
  // Shield
  ctx.fillStyle = frozen ? '#6688aa' : '#8B4513';
  ctx.beginPath();
  ctx.ellipse(-6*s, 2*s, 3.5*s, 4.5*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#aa8855'; ctx.lineWidth = 0.8*s;
  ctx.stroke();
  ctx.restore();

  // Skull
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(0, -6*s, 5*s, 0, Math.PI*2);
  ctx.fill();
  // Jaw
  ctx.beginPath();
  ctx.moveTo(-3*s, -3*s); ctx.lineTo(-2.5*s, -1*s); ctx.lineTo(2.5*s, -1*s); ctx.lineTo(3*s, -3*s);
  ctx.fillStyle = c; ctx.fill();
  // Eye sockets
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(-2*s, -7*s, 1.3*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2*s, -7*s, 1.3*s, 0, Math.PI*2); ctx.fill();
  // Eye glow
  ctx.fillStyle = frozen ? '#44aaff' : '#ff4444';
  ctx.beginPath(); ctx.arc(-2*s, -7*s, 0.6*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2*s, -7*s, 0.6*s, 0, Math.PI*2); ctx.fill();
  // Nose hole
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(0, -5.5*s); ctx.lineTo(-0.8*s, -4*s); ctx.lineTo(0.8*s, -4*s);
  ctx.fill();
  // Teeth
  ctx.fillStyle = c; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.3*s;
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i*1.2*s - 0.4*s, -3.2*s, 0.9*s, 1.5*s);
    ctx.strokeRect(i*1.2*s - 0.4*s, -3.2*s, 0.9*s, 1.5*s);
  }
}

function drawGoblin(s, frozen, t) {
  const skin = frozen ? '#6688aa' : '#5a8a3a';
  const darkSkin = frozen ? '#557799' : '#3d6628';
  const walk = Math.sin(t * 10);

  // Legs (short, bent)
  ctx.strokeStyle = skin; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2*s, 3*s); ctx.lineTo(-4*s, 7*s); ctx.lineTo(-3*s, 9*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2*s, 3*s); ctx.lineTo(4*s, 7*s); ctx.lineTo(3*s, 9*s); ctx.stroke();

  // Body (hunched, smaller)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 1*s, 5*s, 4*s, 0, 0, Math.PI*2);
  ctx.fill();

  // Loincloth
  ctx.fillStyle = frozen ? '#556677' : '#8B6914';
  ctx.beginPath();
  ctx.moveTo(-4*s, 2*s); ctx.lineTo(0, 6*s); ctx.lineTo(4*s, 2*s);
  ctx.fill();

  // Arms (thin, long)
  const armAng = walk * 0.3;
  ctx.strokeStyle = skin; ctx.lineWidth = 1.5 * s;
  ctx.save(); ctx.translate(4*s, -1*s); ctx.rotate(0.4 + armAng);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(5*s, 6*s); ctx.stroke();
  // Dagger
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.2*s;
  ctx.beginPath(); ctx.moveTo(5*s, 6*s); ctx.lineTo(7*s, 2*s); ctx.stroke();
  ctx.restore();

  ctx.save(); ctx.translate(-4*s, -1*s); ctx.rotate(-0.3 - armAng);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-4*s, 6*s); ctx.stroke();
  ctx.restore();

  // Head (big for body)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -4*s, 4.5*s, 0, Math.PI*2);
  ctx.fill();

  // Ears (pointy, big)
  ctx.fillStyle = darkSkin;
  ctx.beginPath();
  ctx.moveTo(-4*s, -5*s); ctx.lineTo(-9*s, -8*s); ctx.lineTo(-4*s, -3*s); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4*s, -5*s); ctx.lineTo(9*s, -8*s); ctx.lineTo(4*s, -3*s); ctx.fill();

  // Eyes (big, yellow, menacing)
  ctx.fillStyle = frozen ? '#aaddff' : '#ffee44';
  ctx.beginPath(); ctx.ellipse(-1.8*s, -5*s, 1.8*s, 1.3*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.8*s, -5*s, 1.8*s, 1.3*s, 0, 0, Math.PI*2); ctx.fill();
  // Pupils (slitted)
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(-1.8*s, -5*s, 0.5*s, 1.2*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.8*s, -5*s, 0.5*s, 1.2*s, 0, 0, Math.PI*2); ctx.fill();

  // Nose (big, pointy)
  ctx.fillStyle = darkSkin;
  ctx.beginPath();
  ctx.moveTo(0, -4*s); ctx.lineTo(-1*s, -2*s); ctx.lineTo(1*s, -2*s); ctx.fill();

  // Mouth (toothy grin)
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.6*s;
  ctx.beginPath();
  ctx.moveTo(-2.5*s, -1.5*s); ctx.quadraticCurveTo(0, 0.5*s, 2.5*s, -1.5*s);
  ctx.stroke();
  // Fangs
  ctx.fillStyle = '#eee';
  ctx.beginPath(); ctx.moveTo(-1.5*s, -1.8*s); ctx.lineTo(-1*s, -0.5*s); ctx.lineTo(-0.5*s, -1.8*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.5*s, -1.8*s); ctx.lineTo(1*s, -0.5*s); ctx.lineTo(0.5*s, -1.8*s); ctx.fill();
}

function drawOgre(s, frozen, t) {
  const skin = frozen ? '#6688aa' : '#8B6B3D';
  const armor = frozen ? '#556677' : '#666666';
  const armorLight = frozen ? '#7799aa' : '#888888';

  // Legs (thick, stumpy)
  ctx.fillStyle = skin;
  ctx.fillRect(-6*s, 4*s, 4*s, 10*s);
  ctx.fillRect(2*s, 4*s, 4*s, 10*s);
  // Boots
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-7*s, 11*s, 5*s, 3*s);
  ctx.fillRect(1*s, 11*s, 5*s, 3*s);

  // Body (massive)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9*s, 7*s, 0, 0, Math.PI*2);
  ctx.fill();

  // Armor plates
  ctx.fillStyle = armor; ctx.strokeStyle = armorLight; ctx.lineWidth = 0.8*s;
  // Chest plate
  ctx.beginPath();
  ctx.moveTo(-7*s, -4*s); ctx.lineTo(-8*s, 3*s); ctx.lineTo(8*s, 3*s); ctx.lineTo(7*s, -4*s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Shoulder pads
  ctx.beginPath();
  ctx.ellipse(-8*s, -3*s, 4*s, 3*s, -0.3, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(8*s, -3*s, 4*s, 3*s, 0.3, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Rivets on armor
  ctx.fillStyle = armorLight;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.arc(i*3*s, -3*s, 0.7*s, 0, Math.PI*2); ctx.fill();
  }

  // Arms
  ctx.fillStyle = skin;
  ctx.save(); ctx.translate(-9*s, -1*s); ctx.rotate(-0.15);
  ctx.fillRect(-2*s, 0, 4*s, 9*s);
  // Fist
  ctx.beginPath(); ctx.arc(0, 10*s, 2.5*s, 0, Math.PI*2); ctx.fill();
  // Club
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1.2*s, 8*s, 2.5*s, 7*s);
  ctx.fillStyle = '#4a2a10';
  ctx.beginPath(); ctx.arc(0, 15*s, 3*s, 0, Math.PI*2); ctx.fill(); // club head
  // Spikes on club
  ctx.fillStyle = '#888';
  for (let a = 0; a < 5; a++) {
    const ang = a * Math.PI * 2 / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang)*3*s, 15*s + Math.sin(ang)*3*s);
    ctx.lineTo(Math.cos(ang)*5*s, 15*s + Math.sin(ang)*5*s);
    ctx.lineTo(Math.cos(ang+0.3)*3*s, 15*s + Math.sin(ang+0.3)*3*s);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = skin;
  ctx.save(); ctx.translate(9*s, -1*s); ctx.rotate(0.15);
  ctx.fillRect(-2*s, 0, 4*s, 9*s);
  ctx.beginPath(); ctx.arc(0, 10*s, 2.5*s, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Head (small relative to body)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -8*s, 5*s, 0, Math.PI*2);
  ctx.fill();
  // Helmet
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.arc(0, -9*s, 5.5*s, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = armorLight; ctx.lineWidth = 0.5*s;
  ctx.stroke();
  // Visor slit
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-3.5*s, -9.5*s, 7*s, 2*s);
  // Eyes behind visor
  ctx.fillStyle = frozen ? '#44aaff' : '#ff6633';
  ctx.beginPath(); ctx.arc(-1.5*s, -9*s, 0.8*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5*s, -9*s, 0.8*s, 0, Math.PI*2); ctx.fill();
  // Jaw/underbite
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-3*s, -5*s); ctx.quadraticCurveTo(0, -3*s, 3*s, -5*s);
  ctx.fill();
  // Tusks
  ctx.fillStyle = '#eeddcc';
  ctx.beginPath(); ctx.moveTo(-2.5*s, -5*s); ctx.lineTo(-3*s, -7*s); ctx.lineTo(-1.5*s, -5.5*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2.5*s, -5*s); ctx.lineTo(3*s, -7*s); ctx.lineTo(1.5*s, -5.5*s); ctx.fill();
}

function drawDarkKnight(s, frozen, t) {
  const metal = frozen ? '#6688aa' : '#3a3a4a';
  const metalLight = frozen ? '#88aacc' : '#5a5a6a';
  const glow = Math.sin(t * 3) * 0.3 + 0.7;

  // Cape (billowing behind)
  ctx.fillStyle = frozen ? '#445566' : '#4a1122';
  ctx.beginPath();
  ctx.moveTo(-6*s, -5*s);
  ctx.quadraticCurveTo(-10*s, 8*s, -8*s + Math.sin(t*2)*2*s, 16*s);
  ctx.lineTo(8*s + Math.sin(t*2+1)*2*s, 16*s);
  ctx.quadraticCurveTo(10*s, 8*s, 6*s, -5*s);
  ctx.fill();

  // Legs (armored)
  ctx.fillStyle = metal;
  ctx.fillRect(-5*s, 5*s, 3.5*s, 10*s);
  ctx.fillRect(1.5*s, 5*s, 3.5*s, 10*s);
  // Knee guards
  ctx.fillStyle = metalLight;
  ctx.beginPath(); ctx.arc(-3*s, 8*s, 2*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(3*s, 8*s, 2*s, 0, Math.PI*2); ctx.fill();
  // Boots
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(-6*s, 13*s, 4.5*s, 3*s);
  ctx.fillRect(1*s, 13*s, 4.5*s, 3*s);

  // Body (tall, dark armor)
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(-7*s, -5*s); ctx.lineTo(-8*s, 6*s); ctx.lineTo(8*s, 6*s); ctx.lineTo(7*s, -5*s);
  ctx.closePath(); ctx.fill();
  // Armor detail lines
  ctx.strokeStyle = metalLight; ctx.lineWidth = 0.5*s;
  ctx.beginPath(); ctx.moveTo(0, -4*s); ctx.lineTo(0, 5*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6*s, 0); ctx.lineTo(6*s, 0); ctx.stroke();

  // Shoulder pauldrons (spiked)
  ctx.fillStyle = metal;
  ctx.beginPath(); ctx.ellipse(-8*s, -4*s, 4*s, 3*s, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8*s, -4*s, 4*s, 3*s, 0.2, 0, Math.PI*2); ctx.fill();
  // Spikes on shoulders
  ctx.fillStyle = metalLight;
  ctx.beginPath(); ctx.moveTo(-10*s, -5*s); ctx.lineTo(-11*s, -10*s); ctx.lineTo(-8*s, -5*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10*s, -5*s); ctx.lineTo(11*s, -10*s); ctx.lineTo(8*s, -5*s); ctx.fill();

  // Arms
  ctx.fillStyle = metal;
  ctx.save(); ctx.translate(8*s, -2*s); ctx.rotate(0.15);
  ctx.fillRect(-1.5*s, 0, 3*s, 8*s);
  // Gauntlet
  ctx.fillStyle = metalLight;
  ctx.beginPath(); ctx.arc(0, 9*s, 2*s, 0, Math.PI*2); ctx.fill();
  // Greatsword
  ctx.strokeStyle = '#8888aa'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 7*s); ctx.lineTo(2*s, -8*s); ctx.stroke();
  // Sword glow
  ctx.strokeStyle = `rgba(255,50,50,${glow * 0.4})`; ctx.lineWidth = 4*s;
  ctx.beginPath(); ctx.moveTo(0, 7*s); ctx.lineTo(2*s, -8*s); ctx.stroke();
  ctx.strokeStyle = '#8888aa'; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.moveTo(0, 7*s); ctx.lineTo(2*s, -8*s); ctx.stroke();
  // Cross guard
  ctx.fillStyle = '#aa8833';
  ctx.fillRect(-3*s, 6*s, 6*s, 1.5*s);
  ctx.restore();

  ctx.fillStyle = metal;
  ctx.save(); ctx.translate(-8*s, -2*s); ctx.rotate(-0.15);
  ctx.fillRect(-1.5*s, 0, 3*s, 8*s);
  ctx.fillStyle = metalLight;
  ctx.beginPath(); ctx.arc(0, 9*s, 2*s, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Helmet
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(0, -10*s, 6*s, 0, Math.PI*2);
  ctx.fill();
  // Helmet crest
  ctx.fillStyle = metalLight;
  ctx.beginPath();
  ctx.moveTo(0, -17*s); ctx.lineTo(-1*s, -10*s); ctx.lineTo(1*s, -10*s);
  ctx.fill();
  // Visor (T-shaped slit)
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-4*s, -11.5*s, 8*s, 2*s); // horizontal
  ctx.fillRect(-0.8*s, -11.5*s, 1.6*s, 5*s); // vertical

  // Glowing red eyes
  ctx.fillStyle = `rgba(255,20,20,${glow})`;
  ctx.beginPath(); ctx.arc(-2*s, -11*s, 1*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2*s, -11*s, 1*s, 0, Math.PI*2); ctx.fill();
  // Eye glow effect
  ctx.fillStyle = `rgba(255,50,30,${glow * 0.3})`;
  ctx.beginPath(); ctx.arc(-2*s, -11*s, 2.5*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2*s, -11*s, 2.5*s, 0, Math.PI*2); ctx.fill();

  // Aura
  ctx.strokeStyle = `rgba(255,30,30,${glow * 0.15})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 18*s, 0, Math.PI*2);
  ctx.stroke();
}

function drawRats(s, frozen, t) {
  const fur = frozen ? '#6688aa' : '#6B5B4B';
  const darkFur = frozen ? '#557799' : '#4a3a2a';
  // Draw 3 rats in a cluster
  const offsets = [
    { x: -3*s, y: -2*s, phase: 0 },
    { x: 3*s, y: 0, phase: 2 },
    { x: 0, y: 3*s, phase: 4 },
  ];
  for (const off of offsets) {
    const rx = off.x + Math.sin(t * 12 + off.phase) * 1;
    const ry = off.y + Math.cos(t * 10 + off.phase) * 0.5;
    ctx.save();
    ctx.translate(rx, ry);

    // Body
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4*s, 2.5*s, 0, 0, Math.PI*2);
    ctx.fill();

    // Head
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(3.5*s, -0.5*s, 2*s, 1.8*s, -0.2, 0, Math.PI*2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#aa8877';
    ctx.beginPath(); ctx.arc(3*s, -2.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5*s, -2*s, 1*s, 0, Math.PI*2); ctx.fill();

    // Eye
    ctx.fillStyle = frozen ? '#aaddff' : '#ff3333';
    ctx.beginPath(); ctx.arc(4.5*s, -0.8*s, 0.5*s, 0, Math.PI*2); ctx.fill();

    // Nose
    ctx.fillStyle = '#ff8888';
    ctx.beginPath(); ctx.arc(5.5*s, 0, 0.4*s, 0, Math.PI*2); ctx.fill();

    // Tail (curvy)
    ctx.strokeStyle = darkFur; ctx.lineWidth = 0.6*s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4*s, 0);
    ctx.quadraticCurveTo(-7*s, -2*s + Math.sin(t*8+off.phase)*1.5, -9*s, 1*s);
    ctx.stroke();

    // Legs (tiny)
    ctx.strokeStyle = darkFur; ctx.lineWidth = 0.7*s;
    ctx.beginPath(); ctx.moveTo(-2*s, 2*s); ctx.lineTo(-2*s, 4*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1*s, 2*s); ctx.lineTo(1*s, 4*s); ctx.stroke();

    ctx.restore();
  }
}

function drawWizard(s, frozen, t) {
  const robe = frozen ? '#6688aa' : '#6622aa';
  const robeDark = frozen ? '#557799' : '#440088';
  const glow = Math.sin(t * 4) * 0.3 + 0.7;

  // Robe body
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-6*s, -2*s);
  ctx.lineTo(-8*s, 12*s);
  ctx.lineTo(8*s, 12*s);
  ctx.lineTo(6*s, -2*s);
  ctx.closePath();
  ctx.fill();
  // Robe trim
  ctx.strokeStyle = frozen ? '#88aacc' : '#ffcc44';
  ctx.lineWidth = 0.8*s;
  ctx.beginPath();
  ctx.moveTo(-8*s, 12*s); ctx.lineTo(8*s, 12*s);
  ctx.stroke();

  // Arms holding staff
  ctx.strokeStyle = frozen ? '#aabbcc' : '#ddc8aa';
  ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5*s, 0); ctx.lineTo(-7*s, 5*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5*s, 0); ctx.lineTo(7*s, 3*s); ctx.stroke();

  // Staff
  ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.moveTo(7*s, 3*s); ctx.lineTo(7*s, -12*s); ctx.stroke();
  // Orb on staff
  ctx.fillStyle = `rgba(170,80,255,${glow})`;
  ctx.beginPath(); ctx.arc(7*s, -13*s, 2.5*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(220,160,255,${glow * 0.6})`;
  ctx.beginPath(); ctx.arc(7*s, -13*s, 4*s, 0, Math.PI*2); ctx.fill();

  // Head
  ctx.fillStyle = frozen ? '#aabbcc' : '#ddc8aa';
  ctx.beginPath(); ctx.arc(0, -5*s, 4*s, 0, Math.PI*2); ctx.fill();

  // Pointy hat
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-5*s, -5*s);
  ctx.lineTo(0, -18*s);
  ctx.lineTo(5*s, -5*s);
  ctx.closePath(); ctx.fill();
  // Hat brim
  ctx.fillStyle = robeDark;
  ctx.beginPath();
  ctx.ellipse(0, -5*s, 6.5*s, 2*s, 0, 0, Math.PI*2);
  ctx.fill();
  // Hat band
  ctx.strokeStyle = frozen ? '#88aacc' : '#ffcc44';
  ctx.lineWidth = 1*s;
  ctx.beginPath();
  ctx.moveTo(-5*s, -7*s); ctx.lineTo(5*s, -7*s);
  ctx.stroke();
  // Star on hat
  ctx.fillStyle = frozen ? '#88aacc' : '#ffcc44';
  ctx.beginPath();
  ctx.arc(0, -12*s, 1.2*s, 0, Math.PI*2); ctx.fill();

  // Eyes (glowing)
  ctx.fillStyle = frozen ? '#44aaff' : '#ff88ff';
  ctx.beginPath(); ctx.arc(-1.5*s, -5.5*s, 1*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5*s, -5.5*s, 1*s, 0, Math.PI*2); ctx.fill();

  // Beard
  ctx.fillStyle = '#cccccc';
  ctx.beginPath();
  ctx.moveTo(-2*s, -3*s);
  ctx.quadraticCurveTo(-1*s, 4*s, 0, 5*s);
  ctx.quadraticCurveTo(1*s, 4*s, 2*s, -3*s);
  ctx.fill();

  // Heal aura particles (floating around)
  ctx.fillStyle = `rgba(100,255,100,${glow * 0.4})`;
  for (let i = 0; i < 4; i++) {
    const a = t * 2 + i * Math.PI/2;
    const px = Math.cos(a) * 10*s;
    const py = Math.sin(a) * 6*s + 2*s;
    ctx.beginPath(); ctx.arc(px, py, 1.2*s, 0, Math.PI*2); ctx.fill();
  }
}

function drawBat(s, frozen, t) {
  const body = frozen ? '#6688aa' : '#332244';
  const wing = frozen ? '#557799' : '#443355';
  const wingFlap = Math.sin(t * 14) * 0.6;

  // Wings
  ctx.fillStyle = wing;
  ctx.save(); ctx.translate(-3*s, 0); ctx.rotate(-wingFlap);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8*s, -6*s, -14*s, -2*s);
  ctx.quadraticCurveTo(-10*s, 2*s, -6*s, 4*s);
  ctx.quadraticCurveTo(-3*s, 2*s, 0, 0);
  ctx.fill();
  // Wing membrane lines
  ctx.strokeStyle = body; ctx.lineWidth = 0.4*s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12*s, -3*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10*s, 0); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = wing;
  ctx.save(); ctx.translate(3*s, 0); ctx.rotate(wingFlap);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8*s, -6*s, 14*s, -2*s);
  ctx.quadraticCurveTo(10*s, 2*s, 6*s, 4*s);
  ctx.quadraticCurveTo(3*s, 2*s, 0, 0);
  ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = 0.4*s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12*s, -3*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10*s, 0); ctx.stroke();
  ctx.restore();

  // Body
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 1*s, 4*s, 5*s, 0, 0, Math.PI*2); ctx.fill();

  // Head
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, -4*s, 3.5*s, 0, Math.PI*2); ctx.fill();

  // Ears (pointy)
  ctx.beginPath();
  ctx.moveTo(-2.5*s, -6*s); ctx.lineTo(-4*s, -10*s); ctx.lineTo(-1*s, -6*s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2.5*s, -6*s); ctx.lineTo(4*s, -10*s); ctx.lineTo(1*s, -6*s);
  ctx.fill();

  // Eyes (red, glowing)
  ctx.fillStyle = frozen ? '#44aaff' : '#ff3333';
  ctx.beginPath(); ctx.arc(-1.5*s, -4.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5*s, -4.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = frozen ? '#88ddff' : '#ff8888';
  ctx.beginPath(); ctx.arc(-1.5*s, -4.5*s, 0.5*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5*s, -4.5*s, 0.5*s, 0, Math.PI*2); ctx.fill();

  // Fangs
  ctx.fillStyle = '#eee';
  ctx.beginPath(); ctx.moveTo(-1*s, -2.5*s); ctx.lineTo(-0.5*s, -0.5*s); ctx.lineTo(0*s, -2.5*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1*s, -2.5*s); ctx.lineTo(0.5*s, -0.5*s); ctx.lineTo(0*s, -2.5*s); ctx.fill();

  // Feet (tiny claws)
  ctx.strokeStyle = body; ctx.lineWidth = 0.6*s;
  ctx.beginPath(); ctx.moveTo(-2*s, 5*s); ctx.lineTo(-2*s, 7*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2*s, 5*s); ctx.lineTo(2*s, 7*s); ctx.stroke();
}

function drawShieldBearer(s, frozen, t, enemy) {
  const skin = frozen ? '#6688aa' : '#cc9966';
  const armor = frozen ? '#556677' : '#777777';
  const shieldColor = frozen ? '#6688aa' : '#3366aa';
  const hasShield = enemy.shieldHp > 0;

  // Legs
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-4*s, 4*s, 3*s, 8*s);
  ctx.fillRect(1*s, 4*s, 3*s, 8*s);
  // Boots
  ctx.fillRect(-5*s, 10*s, 4*s, 2.5*s);
  ctx.fillRect(0*s, 10*s, 4*s, 2.5*s);

  // Body with chainmail
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  // Chainmail texture
  ctx.strokeStyle = frozen ? '#7799aa' : '#999999';
  ctx.lineWidth = 0.3*s;
  for (let row = -3; row <= 3; row++) {
    for (let col = -2; col <= 2; col++) {
      const cx = col * 2.5*s + (row%2)*1.2*s;
      const cy = row * 1.8*s;
      if (cx*cx/(6*s*6*s) + cy*cy/(6*s*6*s) < 0.7) {
        ctx.beginPath(); ctx.arc(cx, cy, 0.8*s, 0, Math.PI*2); ctx.stroke();
      }
    }
  }

  // Left arm holding shield
  ctx.strokeStyle = skin; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5*s, 0); ctx.lineTo(-7*s, 3*s); ctx.stroke();

  // Shield (big, prominent)
  if (hasShield) {
    ctx.fillStyle = shieldColor;
    ctx.beginPath();
    ctx.moveTo(-8*s, -6*s);
    ctx.lineTo(-14*s, -4*s);
    ctx.lineTo(-14*s, 5*s);
    ctx.lineTo(-8*s, 8*s);
    ctx.lineTo(-6*s, 5*s);
    ctx.lineTo(-6*s, -4*s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = frozen ? '#88aacc' : '#ffcc44';
    ctx.lineWidth = 0.8*s;
    ctx.stroke();
    // Shield emblem (cross)
    ctx.strokeStyle = frozen ? '#aaccdd' : '#ffdd66';
    ctx.lineWidth = 1*s;
    ctx.beginPath(); ctx.moveTo(-10*s, -2*s); ctx.lineTo(-10*s, 4*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12*s, 1*s); ctx.lineTo(-8*s, 1*s); ctx.stroke();
    // Shield glow
    ctx.strokeStyle = `rgba(100,180,255,${Math.sin(t*3)*0.2+0.3})`;
    ctx.lineWidth = 2*s;
    ctx.beginPath();
    ctx.moveTo(-8*s, -6*s); ctx.lineTo(-14*s, -4*s); ctx.lineTo(-14*s, 5*s); ctx.lineTo(-8*s, 8*s);
    ctx.stroke();
  }

  // Right arm with mace
  ctx.strokeStyle = skin; ctx.lineWidth = 2*s;
  ctx.beginPath(); ctx.moveTo(5*s, 0); ctx.lineTo(7*s, 4*s); ctx.stroke();
  ctx.strokeStyle = '#666'; ctx.lineWidth = 1.2*s;
  ctx.beginPath(); ctx.moveTo(7*s, 4*s); ctx.lineTo(8*s, -3*s); ctx.stroke();
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(8*s, -4*s, 2*s, 0, Math.PI*2); ctx.fill();

  // Head with helmet
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -7*s, 4*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = armor;
  ctx.beginPath(); ctx.arc(0, -8*s, 4.5*s, Math.PI, 0); ctx.fill();
  // Nose guard
  ctx.fillStyle = armor;
  ctx.fillRect(-0.8*s, -8*s, 1.6*s, 4*s);
  // Eyes
  ctx.fillStyle = frozen ? '#44aaff' : '#334455';
  ctx.beginPath(); ctx.arc(-1.8*s, -7*s, 0.8*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.8*s, -7*s, 0.8*s, 0, Math.PI*2); ctx.fill();
}

function drawNecromancer(s, frozen, t) {
  const robe = frozen ? '#556677' : '#1a3a1a';
  const robeDark = frozen ? '#445566' : '#0a2a0a';
  const glow = Math.sin(t * 3) * 0.3 + 0.7;

  // Tattered robe
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-7*s, -3*s);
  ctx.lineTo(-9*s, 13*s);
  ctx.quadraticCurveTo(-7*s, 14*s, -5*s, 13*s);
  ctx.lineTo(-3*s, 11*s);
  ctx.lineTo(-1*s, 14*s);
  ctx.lineTo(1*s, 11*s);
  ctx.lineTo(3*s, 13*s);
  ctx.quadraticCurveTo(5*s, 14*s, 7*s, 13*s);
  ctx.lineTo(9*s, 13*s);
  ctx.lineTo(7*s, -3*s);
  ctx.closePath();
  ctx.fill();

  // Belt with skulls
  ctx.strokeStyle = '#888866'; ctx.lineWidth = 1*s;
  ctx.beginPath(); ctx.moveTo(-6*s, 2*s); ctx.lineTo(6*s, 2*s); ctx.stroke();
  // Tiny skull on belt
  ctx.fillStyle = '#ddccbb';
  ctx.beginPath(); ctx.arc(0, 2*s, 1.5*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(-0.5*s, 1.5*s, 0.3*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(0.5*s, 1.5*s, 0.3*s, 0, Math.PI*2); ctx.fill();

  // Arms raised (summoning pose)
  ctx.strokeStyle = frozen ? '#88aacc' : '#99aa88';
  ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
  const armWave = Math.sin(t * 3) * 0.15;
  ctx.save(); ctx.translate(-6*s, -1*s); ctx.rotate(-0.8 + armWave);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4*s, -6*s); ctx.stroke();
  // Bony hand
  ctx.strokeStyle = '#bbaa99'; ctx.lineWidth = 0.8*s;
  ctx.beginPath(); ctx.moveTo(-4*s, -6*s); ctx.lineTo(-5*s, -8*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4*s, -6*s); ctx.lineTo(-3*s, -8*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4*s, -6*s); ctx.lineTo(-6*s, -7*s); ctx.stroke();
  ctx.restore();

  ctx.save(); ctx.translate(6*s, -1*s); ctx.rotate(0.8 - armWave);
  ctx.strokeStyle = frozen ? '#88aacc' : '#99aa88';
  ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4*s, -6*s); ctx.stroke();
  ctx.strokeStyle = '#bbaa99'; ctx.lineWidth = 0.8*s;
  ctx.beginPath(); ctx.moveTo(4*s, -6*s); ctx.lineTo(5*s, -8*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4*s, -6*s); ctx.lineTo(3*s, -8*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4*s, -6*s); ctx.lineTo(6*s, -7*s); ctx.stroke();
  ctx.restore();

  // Hood
  ctx.fillStyle = robeDark;
  ctx.beginPath();
  ctx.moveTo(-6*s, -4*s);
  ctx.quadraticCurveTo(-7*s, -14*s, 0, -16*s);
  ctx.quadraticCurveTo(7*s, -14*s, 6*s, -4*s);
  ctx.quadraticCurveTo(0, -2*s, -6*s, -4*s);
  ctx.fill();

  // Face (shadowed, only eyes visible)
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, -7*s, 4*s, 3.5*s, 0, 0, Math.PI*2);
  ctx.fill();
  // Glowing green eyes
  ctx.fillStyle = `rgba(50,255,80,${glow})`;
  ctx.beginPath(); ctx.arc(-1.5*s, -7.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5*s, -7.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(80,255,100,${glow * 0.3})`;
  ctx.beginPath(); ctx.arc(-1.5*s, -7.5*s, 2.5*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5*s, -7.5*s, 2.5*s, 0, Math.PI*2); ctx.fill();

  // Summoning circle at feet
  ctx.strokeStyle = `rgba(50,255,80,${glow * 0.3})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 10*s, 10*s, 3*s, 0, 0, Math.PI*2);
  ctx.stroke();
  // Rune marks rotating
  ctx.fillStyle = `rgba(50,255,80,${glow * 0.4})`;
  for (let i = 0; i < 6; i++) {
    const a = t * 1.5 + i * Math.PI/3;
    const rx = Math.cos(a) * 9*s;
    const ry = Math.sin(a) * 2.5*s + 10*s;
    ctx.beginPath(); ctx.arc(rx, ry, 0.8*s, 0, Math.PI*2); ctx.fill();
  }

  // Floating skull above (summoned)
  const skullBob = Math.sin(t * 2.5) * 3;
  ctx.fillStyle = `rgba(200,200,180,${glow * 0.7})`;
  ctx.beginPath(); ctx.arc(0, -20*s + skullBob, 2.5*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(50,255,80,${glow * 0.5})`;
  ctx.beginPath(); ctx.arc(-0.8*s, -20.5*s + skullBob, 0.5*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(0.8*s, -20.5*s + skullBob, 0.5*s, 0, Math.PI*2); ctx.fill();
}
