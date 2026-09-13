// ===== RENDER: WORLD =====
// Ground cache, castle, walls, towers, placement ghosts, wall/tower sprite art.

const WALL_SPRITES = {
  palisade(c, dmg) {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(24, 42, 18, 4, 0, 0, 7); c.fill();
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 9;
      if (dmg > 0.6 && (i === 1 || i === 3)) continue; // splintered away
      const h = dmg > 0.3 && i === 2 ? 20 : 30;
      c.fillStyle = '#7a5b38';
      c.beginPath();
      c.moveTo(x, 42); c.lineTo(x, 44 - h); c.lineTo(x + 4, 40 - h); c.lineTo(x + 8, 44 - h); c.lineTo(x + 8, 42);
      c.closePath(); c.fill();
      c.strokeStyle = '#1a1512'; c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = '#573f24'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 4, 40 - h + 4); c.lineTo(x + 4, 40); c.stroke();
    }
    c.strokeStyle = '#573f24'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(3, 26); c.lineTo(45, 26); c.stroke();
  },
  rampart(c, dmg) {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(24, 43, 20, 4, 0, 0, 7); c.fill();
    // earth mound
    c.fillStyle = '#6b5138';
    c.beginPath();
    c.moveTo(2, 43); c.lineTo(7, 16); c.lineTo(41, 16); c.lineTo(46, 43);
    c.closePath(); c.fill();
    c.strokeStyle = '#1a1512'; c.lineWidth = 2; c.stroke();
    // timber facing
    c.strokeStyle = '#4a3826'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = 9 + i * 8;
      c.beginPath(); c.moveTo(x, 41); c.lineTo(x + 1, 18); c.stroke();
    }
    // turf cap
    c.fillStyle = dmg > 0.5 ? '#4a3826' : '#4a6238';
    c.beginPath(); c.ellipse(24, 16, 17, 4.5, 0, 0, 7); c.fill();
    c.strokeStyle = '#1a1512'; c.lineWidth = 1.5; c.stroke();
    if (dmg > 0.4) { // blown-out crater
      c.fillStyle = '#2a2018';
      c.beginPath(); c.ellipse(30, 30, 8, 7, 0.3, 0, 7); c.fill();
    }
  },
  stone(c, dmg) {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(24, 43, 19, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#6b6f76';
    c.fillRect(4, 12, 40, 31);
    c.strokeStyle = '#1a1512'; c.lineWidth = 2; c.strokeRect(4, 12, 40, 31);
    // staggered blocks
    c.strokeStyle = 'rgba(30,32,36,0.6)'; c.lineWidth = 1.2;
    for (let r = 0; r < 3; r++) {
      const y = 12 + r * 10.3;
      c.beginPath(); c.moveTo(4, y + 10.3); c.lineTo(44, y + 10.3); c.stroke();
      const off = r % 2 ? 0 : 10;
      for (let bx = 4 + off; bx < 44; bx += 20) {
        c.beginPath(); c.moveTo(bx, y); c.lineTo(bx, y + 10.3); c.stroke();
      }
    }
    c.fillStyle = '#8a8f96'; c.fillRect(4, 12, 40, 3);   // lit cap
    if (dmg > 0.3) { // cracks
      c.strokeStyle = '#241f1c'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(14, 12); c.lineTo(18, 24); c.lineTo(12, 33); c.lineTo(17, 43); c.stroke();
    }
    if (dmg > 0.6) { // hole punched through
      c.fillStyle = '#181512';
      c.beginPath();
      c.moveTo(26, 20); c.lineTo(36, 22); c.lineTo(38, 33); c.lineTo(28, 36); c.closePath(); c.fill();
    }
  },
  bulwark(c, dmg) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(24, 43, 20, 4.5, 0, 0, 7); c.fill();
    c.fillStyle = '#3d4148';
    c.fillRect(3, 9, 42, 34);
    c.strokeStyle = '#14100e'; c.lineWidth = 2; c.strokeRect(3, 9, 42, 34);
    c.fillStyle = '#4a4f57'; c.fillRect(3, 9, 42, 4);
    // iron bands + rivets
    c.fillStyle = '#5c626b';
    for (const by of [17, 30]) {
      c.fillRect(3, by, 42, 5);
      c.strokeStyle = '#14100e'; c.lineWidth = 1; c.strokeRect(3, by, 42, 5);
      c.fillStyle = '#8d949d';
      for (let rx = 8; rx < 44; rx += 9) { c.beginPath(); c.arc(rx, by + 2.5, 1.4, 0, 7); c.fill(); }
      c.fillStyle = '#5c626b';
    }
    // crenellated top
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#4a4f57';
      c.fillRect(4 + i * 11, 4, 7, 6);
      c.strokeStyle = '#14100e'; c.lineWidth = 1.5; c.strokeRect(4 + i * 11, 4, 7, 6);
    }
    if (dmg > 0.35) {
      c.strokeStyle = '#14100e'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(30, 9); c.lineTo(26, 22); c.lineTo(33, 31); c.lineTo(29, 43); c.stroke();
    }
    if (dmg > 0.65) {
      c.fillStyle = '#100d0b';
      c.beginPath();
      c.moveTo(10, 20); c.lineTo(21, 19); c.lineTo(23, 32); c.lineTo(11, 34); c.closePath(); c.fill();
    }
  },
};


// ===== TOWER SPRITES (shared: field + cards). Each draws centered in a 48x48 box at (0,0). =====
const SPRITE_P = {
  stone:'#6b6f76', stoneDark:'#4a4d53', stoneLight:'#8a8f96', outline:'#1a1512',
  wood:'#7a5b38', woodDark:'#573f24', gold:'#e8b64c', blood:'#b3362e',
  frost:'#6fa8d6', frostLight:'#aacfe8', venom:'#5fae4c', venomDark:'#3d7a30', arcane:'#9b6dd6',
  iron:'#3d4148', ironLight:'#5c626b', copper:'#c07840', copperLight:'#e09860', ember:'#e06a2b', white:'#f5f2ea'
};
function spriteBase(c){
  c.fillStyle='rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(24,42,16,5,0,0,7); c.fill();
  c.fillStyle=SPRITE_P.stone; c.fillRect(10,30,28,12);
  c.fillStyle=SPRITE_P.stoneLight; c.fillRect(10,30,28,3);
  c.fillStyle=SPRITE_P.stoneDark; c.fillRect(10,39,28,3);
  c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.strokeRect(10,30,28,12);
}
const TOWER_SPRITES = {
  arrow(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.wood; c.fillRect(20,12,8,20); c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.strokeRect(20,12,8,20);
    c.strokeStyle=SPRITE_P.woodDark; c.lineWidth=3; c.beginPath(); c.moveTo(10,16); c.quadraticCurveTo(24,6,38,16); c.stroke();
    c.strokeStyle=SPRITE_P.white; c.lineWidth=1.5; c.beginPath(); c.moveTo(10,16); c.lineTo(38,16); c.stroke();
    c.fillStyle=SPRITE_P.gold; c.fillRect(22,8,4,12);
  },
  cannon(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.iron; c.beginPath(); c.ellipse(24,24,11,9,0,0,7); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    c.fillStyle=SPRITE_P.ironLight; c.beginPath(); c.ellipse(21,21,4,3,0,0,7); c.fill();
    c.fillStyle=SPRITE_P.iron; c.fillRect(30,18,12,7); c.strokeStyle=SPRITE_P.outline; c.strokeRect(30,18,12,7);
    c.fillStyle=SPRITE_P.gold; c.beginPath(); c.arc(18,27,1.5,0,7); c.arc(24,30,1.5,0,7); c.arc(30,27,1.5,0,7); c.fill();
  },
  ice(c, t=0){
    spriteBase(c);
    const shimmer = 0.85 + Math.sin(t*3)*0.15;
    c.fillStyle=SPRITE_P.frost; c.beginPath(); c.moveTo(24,4); c.lineTo(32,26); c.lineTo(24,32); c.lineTo(16,26); c.closePath(); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    c.globalAlpha = shimmer;
    c.fillStyle=SPRITE_P.frostLight; c.beginPath(); c.moveTo(24,8); c.lineTo(28,24); c.lineTo(24,28); c.closePath(); c.fill();
    c.globalAlpha = 1;
    c.fillStyle=SPRITE_P.white; c.fillRect(23,2,2,4);
  },
  sniper(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.stone; c.fillRect(17,10,14,22); c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.strokeRect(17,10,14,22);
    c.fillStyle=SPRITE_P.stoneDark; c.fillRect(17,10,14,3);
    for(let i=0;i<3;i++){ c.fillStyle=SPRITE_P.stoneLight; c.fillRect(18+i*5,6,3,5); c.strokeStyle=SPRITE_P.outline; c.lineWidth=1; c.strokeRect(18+i*5,6,3,5); }
    c.fillStyle=SPRITE_P.gold; c.fillRect(22,18,4,6);
  },
  tesla(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.copper; c.fillRect(21,14,6,18); c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.strokeRect(21,14,6,18);
    for(let i=0;i<4;i++){ c.strokeStyle=SPRITE_P.copperLight; c.lineWidth=1.5; c.beginPath(); c.moveTo(19,16+i*4); c.lineTo(29,16+i*4); c.stroke(); }
    c.fillStyle=SPRITE_P.frostLight; c.beginPath(); c.arc(24,10,5,0,7); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    if (Math.sin(t*10) > 0.2) { // arc flicker
      c.strokeStyle='#dff2ff'; c.lineWidth=1.5; c.beginPath();
      c.moveTo(24,5); c.lineTo(27,2); c.moveTo(24,5); c.lineTo(20,1); c.stroke();
    }
  },
  flame(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.iron; c.beginPath(); c.moveTo(15,32); c.lineTo(18,20); c.lineTo(30,20); c.lineTo(33,32); c.closePath(); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    const fl = Math.sin(t*8)*2;
    c.fillStyle=SPRITE_P.ember; c.beginPath(); c.moveTo(19,20); c.quadraticCurveTo(21,10+fl,24,6+fl); c.quadraticCurveTo(27,10-fl,29,20); c.closePath(); c.fill();
    c.fillStyle=SPRITE_P.gold; c.beginPath(); c.moveTo(21,20); c.quadraticCurveTo(23,13+fl,24,11+fl); c.quadraticCurveTo(25,13-fl,27,20); c.closePath(); c.fill();
  },
  mortar(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.iron; c.beginPath(); c.ellipse(24,26,12,8,0,0,7); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    c.fillStyle=SPRITE_P.iron; c.save(); c.translate(24,24); c.rotate(-0.7); c.fillRect(-3,-16,7,16); c.strokeRect(-3,-16,7,16); c.restore();
    c.fillStyle=SPRITE_P.ironLight; c.beginPath(); c.ellipse(20,23,3,2,0,0,7); c.fill();
  },
  poison(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.iron; c.beginPath(); c.ellipse(24,25,11,9,0,0,7); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    c.fillStyle=SPRITE_P.venom; c.beginPath(); c.ellipse(24,20,9,3.5,0,0,7); c.fill();
    c.strokeStyle=SPRITE_P.venomDark; c.lineWidth=1; c.stroke();
    const bob = Math.sin(t*4)*1.5;
    c.fillStyle=SPRITE_P.venom;
    c.beginPath(); c.arc(20,15+bob,2,0,7); c.arc(27,13-bob,1.5,0,7); c.arc(24,10+bob*0.5,1.2,0,7); c.fill();
    c.fillStyle='#7ec96a'; c.beginPath(); c.arc(24,25,3,0,7); c.fill();
  },
  goldmine(c, t=0){
    spriteBase(c);
    c.fillStyle=SPRITE_P.wood; c.fillRect(17,10,14,22); c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.strokeRect(17,10,14,22);
    c.fillStyle=SPRITE_P.woodDark; c.fillRect(19,12,10,4); c.fillRect(19,18,10,4);
    c.fillStyle=SPRITE_P.gold;
    const bob = Math.sin(t*3)*1.5;
    c.beginPath(); c.arc(21,8+bob,3,0,7); c.fill();
    c.beginPath(); c.arc(27,6-bob,2.5,0,7); c.fill();
    c.beginPath(); c.arc(24,10+bob*0.5,2,0,7); c.fill();
    c.fillStyle='#ffd700'; c.font='bold 10px sans-serif'; c.textAlign='center'; c.fillText('G',24,38);
  },
  annihilator(c, t=0){
    spriteBase(c);
    c.fillStyle='#181420'; c.beginPath(); c.moveTo(24,2); c.lineTo(33,14); c.lineTo(30,32); c.lineTo(18,32); c.lineTo(15,14); c.closePath(); c.fill();
    c.strokeStyle=SPRITE_P.outline; c.lineWidth=2; c.stroke();
    const pulse = 0.6 + Math.sin(t*6)*0.4;
    c.globalAlpha = pulse;
    c.fillStyle=SPRITE_P.white; c.beginPath(); c.ellipse(24,17,3,7,0,0,7); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle='rgba(245,242,234,0.5)'; c.lineWidth=1; c.beginPath(); c.moveTo(19,8); c.lineTo(29,26); c.stroke();
  },
};

// --- RENDERING ---
function resize() {
  const w = COLS * TILE;
  const h = ROWS * TILE;
  const scale = Math.min(window.innerWidth / w, window.innerHeight / h, 1.5);
  C.width = w;
  C.height = h;
  C.style.width = (w * scale) + 'px';
  C.style.height = (h * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

// --- REALISTIC GROUND (pre-rendered to offscreen canvas, rebuilt only when paths change) ---
let groundCache = null;
let groundCacheKey = '';

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildGroundCache() {
  const activePaths = game ? game.activePaths : getActivePaths(1);
  const theme = getWorldTheme();
  const oc = document.createElement('canvas');
  oc.width = COLS * TILE; oc.height = ROWS * TILE;
  const g = oc.getContext('2d');
  const rnd = mulberry32(1337);

  // 1. Base grass: layered organic color blobs, not tile-aligned
  g.fillStyle = theme.bgBase;
  g.fillRect(0, 0, oc.width, oc.height);
  const grassTones = theme.groundTones;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * oc.width, y = rnd() * oc.height;
    const r = 14 + rnd() * 42;
    g.fillStyle = grassTones[Math.floor(rnd() * grassTones.length)];
    g.globalAlpha = 0.18 + rnd() * 0.2;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  // 2. Sunlight patches (soft warm highlights)
  for (let i = 0; i < 22; i++) {
    const x = rnd() * oc.width, y = rnd() * oc.height, r = 50 + rnd() * 110;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, theme.sunlightColor);
    grad.addColorStop(1, theme.sunlightColor.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 3. Dirt paths: base fill + irregular organic edges + wear
  const pathTiles = new Set();
  for (const p of activePaths) for (const [x, y] of p.tiles) pathTiles.add(x + ',' + y);
  const dirtTones = theme.dirtTones;
  for (const p of activePaths) {
    // base dirt per tile
    for (const [x, y] of p.tiles) {
      g.fillStyle = theme.dirtBase;
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    // organic irregular blobs across the path to kill the grid look
    for (const [x, y] of p.tiles) {
      for (let i = 0; i < 7; i++) {
        const bx = x * TILE + rnd() * TILE, by = y * TILE + rnd() * TILE;
        g.fillStyle = dirtTones[Math.floor(rnd() * dirtTones.length)];
        g.globalAlpha = 0.25 + rnd() * 0.3;
        g.beginPath();
        g.ellipse(bx, by, 5 + rnd() * 12, 4 + rnd() * 8, rnd() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    // ragged grass encroaching on path edges
    for (const [x, y] of p.tiles) {
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of neighbors) {
        if (pathTiles.has((x+dx) + ',' + (y+dy))) continue;
        for (let i = 0; i < 6; i++) {
          const ex = x * TILE + (dx === 0 ? rnd() * TILE : (dx > 0 ? TILE - rnd() * 5 : rnd() * 5));
          const ey = y * TILE + (dy === 0 ? rnd() * TILE : (dy > 0 ? TILE - rnd() * 5 : rnd() * 5));
          g.fillStyle = grassTones[Math.floor(rnd() * grassTones.length)];
          g.globalAlpha = 0.7;
          g.beginPath();
          g.ellipse(ex, ey, 3 + rnd() * 4, 2 + rnd() * 3, rnd() * Math.PI, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    // pebbles + wheel ruts
    for (const [x, y] of p.tiles) {
      if (rnd() < 0.5) {
        const px = x * TILE + rnd() * TILE, py = y * TILE + rnd() * TILE;
        g.fillStyle = rnd() < 0.5 ? '#8a8378' : '#7a7166';
        g.beginPath();
        g.ellipse(px, py, 1.5 + rnd() * 2.5, 1 + rnd() * 2, rnd() * Math.PI, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.ellipse(px + 1, py + 1.5, 1.5 + rnd() * 2, 1 + rnd(), 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // 4. Grass tufts (small blade strokes everywhere off-path)
  for (let i = 0; i < 700; i++) {
    const x = rnd() * oc.width, y = rnd() * oc.height;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (pathTiles.has(tx + ',' + ty) || isCastle(tx, ty)) continue;
    g.strokeStyle = rnd() < 0.5 ? theme.turfTones[0] : theme.turfTones[1];
    g.lineWidth = 1;
    g.globalAlpha = 0.6 + rnd() * 0.4;
    const h = 3 + rnd() * 5, lean = (rnd() - 0.5) * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean, y - h * 0.6, x + lean * 1.6, y - h);
    g.stroke();
  }
  g.globalAlpha = 1;

  // 5. Scatter decor: rocks, flowers, bushes (kept small so they don't hide gameplay)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * oc.width, y = rnd() * oc.height;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (pathTiles.has(tx + ',' + ty) || isCastle(tx, ty)) continue;
    const kind = rnd();
    if (kind < 0.4) { // rock
      const r = 3 + rnd() * 5;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(x + 1, y + r * 0.5, r, r * 0.4, 0, 0, 7); g.fill();
      g.fillStyle = theme.rockColor;
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, rnd() * 0.6, 0, 7); g.fill();
      g.fillStyle = theme.rockHighlight;
      g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25, 0, 0, 7); g.fill();
      g.strokeStyle = '#4a4d50'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, rnd() * 0.6, 0, 7); g.stroke();
    } else if (kind < 0.7) { // flowers cluster
      for (let f = 0; f < 3 + rnd() * 3; f++) {
        const fx = x + (rnd() - 0.5) * 14, fy = y + (rnd() - 0.5) * 10;
        g.fillStyle = theme.flowerColors[Math.floor(rnd() * 3)];
        for (let pt = 0; pt < 4; pt++) {
          const a = pt / 4 * Math.PI * 2;
          g.beginPath(); g.arc(fx + Math.cos(a) * 1.6, fy + Math.sin(a) * 1.6, 1.3, 0, 7); g.fill();
        }
        g.fillStyle = '#c9a227';
        g.beginPath(); g.arc(fx, fy, 1, 0, 7); g.fill();
      }
    } else { // bush
      const r = 6 + rnd() * 6;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(x + 1, y + r * 0.6, r, r * 0.35, 0, 0, 7); g.fill();
      g.fillStyle = theme.decorGrass[0];
      g.beginPath();
      g.arc(x, y, r * 0.7, 0, 7); g.arc(x - r * 0.5, y + r * 0.2, r * 0.5, 0, 7); g.arc(x + r * 0.5, y + r * 0.2, r * 0.55, 0, 7);
      g.fill();
      g.fillStyle = theme.decorGrass[1];
      g.beginPath(); g.arc(x - r * 0.2, y - r * 0.25, r * 0.45, 0, 7); g.fill();
    }
  }

  // 6. Soft vignette for depth
  const vg = g.createRadialGradient(oc.width/2, oc.height/2, oc.height * 0.45, oc.width/2, oc.height/2, oc.height * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, theme.vignetteColor);
  g.fillStyle = vg;
  g.fillRect(0, 0, oc.width, oc.height);

  // World-specific special effects
  const worldIdx = (game ? game.world : 1);
  const themeIdx = ((worldIdx - 1) % WORLD_THEMES.length);

  // Deep Space (theme 5, 0-indexed) — star speckles
  if (themeIdx === 5) {
    for (let i = 0; i < 300; i++) {
      const sx = rnd() * oc.width, sy = rnd() * oc.height;
      const tx = Math.floor(sx / TILE), ty = Math.floor(sy / TILE);
      if (pathTiles.has(tx + ',' + ty)) continue;
      const brightness = 0.3 + rnd() * 0.7;
      const size = 0.5 + rnd() * 1.5;
      g.fillStyle = `rgba(200,210,255,${brightness})`;
      g.beginPath(); g.arc(sx, sy, size, 0, Math.PI * 2); g.fill();
    }
  }

  // Volcanic Hellscape (theme 3, 0-indexed) — lava glow along path edges
  if (themeIdx === 3) {
    for (const p of activePaths) {
      for (const [x, y] of p.tiles) {
        const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
        for (const [dx, dy] of neighbors) {
          if (pathTiles.has((x+dx) + ',' + (y+dy))) continue;
          const ex = (x + (dx > 0 ? 1 : 0)) * TILE;
          const ey = (y + (dy > 0 ? 1 : 0)) * TILE;
          const glow = g.createRadialGradient(ex, ey, 0, ex, ey, TILE * 0.7);
          glow.addColorStop(0, 'rgba(255,60,10,0.15)');
          glow.addColorStop(0.5, 'rgba(255,30,0,0.06)');
          glow.addColorStop(1, 'rgba(255,0,0,0)');
          g.fillStyle = glow;
          g.fillRect(ex - TILE, ey - TILE, TILE * 2, TILE * 2);
        }
      }
    }
  }

  // Enchanted Grove (theme 4, 0-indexed) — floating sparkle particles
  if (themeIdx === 4) {
    for (let i = 0; i < 120; i++) {
      const sx = rnd() * oc.width, sy = rnd() * oc.height;
      const tx = Math.floor(sx / TILE), ty = Math.floor(sy / TILE);
      if (pathTiles.has(tx + ',' + ty)) continue;
      const sparkSize = 1 + rnd() * 2;
      const hue = rnd() < 0.5 ? '180,120,255' : '100,255,220';
      g.fillStyle = `rgba(${hue},${0.2 + rnd() * 0.4})`;
      g.beginPath(); g.arc(sx, sy, sparkSize, 0, Math.PI * 2); g.fill();
      // glow around sparkle
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sparkSize * 3);
      sg.addColorStop(0, `rgba(${hue},0.15)`);
      sg.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = sg;
      g.fillRect(sx - sparkSize * 3, sy - sparkSize * 3, sparkSize * 6, sparkSize * 6);
    }
  }

  groundCache = oc;
}

function drawGround() {
  const activePaths = game ? game.activePaths : getActivePaths(1);
  const key = activePaths.length + ':' + COLS * TILE + ':' + (game ? game.world : 1);
  if (!groundCache || groundCacheKey !== key) { buildGroundCache(); groundCacheKey = key; }
  ctx.drawImage(groundCache, 0, 0);

  // Entry arrows (live, on top of cache)
  for (const p of activePaths) {
    const entry = p.tiles[0];
    ctx.fillStyle = 'rgba(255,80,80,0.6)';
    ctx.font = '600 15px Inter, sans-serif';
    ctx.textAlign = 'center';
    const ex = entry[0] * TILE + TILE/2;
    const ey = entry[1] * TILE + TILE/2;
    if (entry[1] === 0) { ctx.fillText('▼', ex, ey + 6); }
    else if (entry[1] === 16) { ctx.fillText('▲', ex, ey + 4); }
    else { ctx.fillText('▶', ex, ey + 5); }
    ctx.textAlign = 'left';
  }

  drawCastle();

  // Grid overlay (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.015)';
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }
}



// --- REALISTIC 3/4-VIEW CASTLE WITH DAMAGE STATES ---
function drawCastle() {
  const t = Date.now() / 1000;
  const hpPct = game ? Math.max(game.hp / (DIFFICULTY.startHp || 25), 0) : 1;
  const cx0 = 28 * TILE, cy0 = 6 * TILE, cw = 2 * TILE, ch = 5 * TILE;
  const theme = getWorldTheme();
  const D = 13, DY = 7; // side-face depth offsets (pseudo-isometric)

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx0 + cw/2 + 6, cy0 + ch + 3, cw * 0.85, 9, 0, 0, Math.PI*2);
  ctx.fill();

  // ---- RIGHT SIDE WALL (dark face for depth) ----
  ctx.fillStyle = '#565a60';
  ctx.beginPath();
  ctx.moveTo(cx0 + cw, cy0);
  ctx.lineTo(cx0 + cw + D, cy0 - DY);
  ctx.lineTo(cx0 + cw + D, cy0 + ch - DY);
  ctx.lineTo(cx0 + cw, cy0 + ch);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#26282c'; ctx.lineWidth = 1.5; ctx.stroke();
  // side brick hint
  ctx.strokeStyle = 'rgba(30,32,36,0.5)'; ctx.lineWidth = 1;
  for (let ry = cy0 + 10; ry < cy0 + ch - 4; ry += 12) {
    ctx.beginPath(); ctx.moveTo(cx0 + cw + 1, ry); ctx.lineTo(cx0 + cw + D - 1, ry - DY + 1); ctx.stroke();
  }

  // ---- FRONT WALL ----
  const wallGrad = ctx.createLinearGradient(cx0, cy0, cx0, cy0 + ch);
  wallGrad.addColorStop(0, theme.castleStone);
  wallGrad.addColorStop(0.6, theme.castleStoneDark);
  wallGrad.addColorStop(1, theme.castleStoneLight);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(cx0, cy0, cw, ch);
  // staggered bricks with per-brick tone variation
  const brickH = 10, brickW = 20;
  let bi = 0;
  for (let row = 0, ry = cy0; ry < cy0 + ch - 2; row++, ry += brickH) {
    const offset = (row % 2 === 0) ? 0 : brickW / 2;
    for (let bx = cx0 - offset; bx < cx0 + cw; bx += brickW, bi++) {
      const bw2 = Math.min(brickW, cx0 + cw - bx);
      const bxx = Math.max(bx, cx0);
      if (bxx >= cx0 + cw) continue;
      const tone = (bi * 37) % 5;
      ctx.fillStyle = `rgba(${tone > 2 ? 255 : 20},${tone > 2 ? 255 : 22},${tone > 2 ? 255 : 26},0.05)`;
      ctx.fillRect(bxx, ry, bw2 - (bxx - bx), brickH - 1);
      ctx.strokeStyle = 'rgba(44,47,52,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bxx + 0.5, ry + 0.5, bw2 - (bxx - bx) - 1, brickH - 1);
    }
  }
  // moss at the base
  ctx.fillStyle = 'rgba(61,90,47,0.5)';
  for (let i = 0; i < 6; i++) {
    const mx = cx0 + 4 + ((i * 53) % (cw - 8));
    ctx.beginPath(); ctx.ellipse(mx, cy0 + ch - 3, 5 + (i%3)*2, 3, 0, Math.PI, 0, true); ctx.fill();
  }

  // ---- CRACKS (damage < 75%) ----
  if (hpPct < 0.75) {
    ctx.strokeStyle = 'rgba(25,27,30,0.8)';
    ctx.lineWidth = 1.5;
    const cracks = [
      [[cx0+14, cy0+40],[cx0+18, cy0+58],[cx0+12, cy0+74],[cx0+20, cy0+92]],
      [[cx0+cw-12, cy0+70],[cx0+cw-20, cy0+88],[cx0+cw-14, cy0+108]],
    ];
    if (hpPct < 0.5) cracks.push([[cx0+38, cy0+22],[cx0+44, cy0+44],[cx0+36, cy0+66],[cx0+46, cy0+90],[cx0+40, cy0+120]]);
    for (const cr of cracks) {
      ctx.beginPath(); ctx.moveTo(cr[0][0], cr[0][1]);
      for (let i = 1; i < cr.length; i++) ctx.lineTo(cr[i][0], cr[i][1]);
      ctx.stroke();
      // crack branches
      ctx.beginPath(); ctx.moveTo(cr[1][0], cr[1][1]); ctx.lineTo(cr[1][0]+6, cr[1][1]+4); ctx.stroke();
    }
  }

  // ---- HOLE + RUBBLE (damage < 50%) ----
  if (hpPct < 0.5) {
    // gaping hole in the wall
    ctx.fillStyle = '#1d1f22';
    ctx.beginPath();
    ctx.moveTo(cx0 + 12, cy0 + 100);
    ctx.lineTo(cx0 + 30, cy0 + 94);
    ctx.lineTo(cx0 + 36, cy0 + 110);
    ctx.lineTo(cx0 + 28, cy0 + 124);
    ctx.lineTo(cx0 + 10, cy0 + 118);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 2; ctx.stroke();
    // rubble pile at the base
    ctx.fillStyle = '#6a6e74';
    for (let i = 0; i < 7; i++) {
      const rx = cx0 + 6 + (i * 31) % 40, rrY = cy0 + ch + 1 - (i % 3) * 3;
      ctx.beginPath(); ctx.ellipse(rx, rrY, 4 + (i%3)*2, 3, (i*0.7)%3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#43464b'; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // ---- BATTLEMENTS with 3D tops ----
  const merlonW = 15, merlonH = 12;
  for (let i = 0; i < 4; i++) {
    const mx = cx0 + i * (cw/4) + 2;
    // skip a destroyed merlon at <50%
    if (hpPct < 0.5 && i === 2) {
      ctx.fillStyle = '#5c6066';
      ctx.beginPath();
      ctx.moveTo(mx, cy0 - 1); ctx.lineTo(mx + merlonW*0.6, cy0 - 5); ctx.lineTo(mx + merlonW, cy0 - 1);
      ctx.closePath(); ctx.fill();
      continue;
    }
    // front
    ctx.fillStyle = '#84898f';
    ctx.fillRect(mx, cy0 - merlonH, merlonW, merlonH + 1);
    ctx.strokeStyle = '#2c2f34'; ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, cy0 - merlonH, merlonW, merlonH + 1);
    // top face (lit)
    ctx.fillStyle = '#a3a8ae';
    ctx.beginPath();
    ctx.moveTo(mx, cy0 - merlonH);
    ctx.lineTo(mx + 5, cy0 - merlonH - 3);
    ctx.lineTo(mx + merlonW + 5, cy0 - merlonH - 3);
    ctx.lineTo(mx + merlonW, cy0 - merlonH);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // ---- CORNER TOWER (right, cylindrical, with cone roof) ----
  {
    const tx = cx0 + cw + D - 4, tw = 22, tTop = cy0 - 26, tBot = cy0 + ch - DY;
    const cylGrad = ctx.createLinearGradient(tx - tw/2, 0, tx + tw/2, 0);
    cylGrad.addColorStop(0, '#8d9298');
    cylGrad.addColorStop(0.45, '#9da2a8');
    cylGrad.addColorStop(1, '#5f6368');
    ctx.fillStyle = cylGrad;
    ctx.fillRect(tx - tw/2, tTop, tw, tBot - tTop);
    ctx.strokeStyle = '#26282c'; ctx.lineWidth = 1.5;
    ctx.strokeRect(tx - tw/2, tTop, tw, tBot - tTop);
    // curved brick bands
    ctx.strokeStyle = 'rgba(40,43,48,0.4)'; ctx.lineWidth = 1;
    for (let ry = tTop + 8; ry < tBot; ry += 11) {
      ctx.beginPath(); ctx.moveTo(tx - tw/2 + 1, ry); ctx.quadraticCurveTo(tx, ry + 3, tx + tw/2 - 1, ry); ctx.stroke();
    }
    // arrow slit
    ctx.fillStyle = '#1d1f22';
    ctx.fillRect(tx - 1.5, tTop + 18, 3, 12);
    // cone roof
    const roofGrad = ctx.createLinearGradient(tx - tw/2 - 3, 0, tx + tw/2 + 3, 0);
    roofGrad.addColorStop(0, theme.castleRoof[0]);
    roofGrad.addColorStop(0.4, theme.castleRoof[1]);
    roofGrad.addColorStop(1, theme.castleRoof[2]);
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(tx - tw/2 - 4, tTop);
    ctx.lineTo(tx, tTop - 24);
    ctx.lineTo(tx + tw/2 + 4, tTop);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#331b18'; ctx.lineWidth = 1.5; ctx.stroke();
    // shingle lines
    ctx.strokeStyle = 'rgba(45,22,19,0.55)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const yy = tTop - i * 6;
      const half = (tw/2 + 4) * (1 - i/4.2);
      ctx.beginPath(); ctx.moveTo(tx - half, yy); ctx.quadraticCurveTo(tx, yy + 2, tx + half, yy); ctx.stroke();
    }
    // finial
    ctx.fillStyle = '#d9b959';
    ctx.beginPath(); ctx.arc(tx, tTop - 26, 2.2, 0, 7); ctx.fill();
  }

  // ---- MAIN ROOF: front gable + side slope ----
  const peakX = cx0 + cw/2, peakY = cy0 - merlonH - 3 - 44;
  const roofBaseY = cy0 - merlonH - 3;
  // side slope (dark)
  ctx.fillStyle = theme.castleRoof[2];
  ctx.beginPath();
  ctx.moveTo(cx0 + cw + 5, roofBaseY);
  ctx.lineTo(cx0 + cw + 5 + D, roofBaseY - DY);
  ctx.lineTo(peakX + D, peakY - DY);
  ctx.lineTo(peakX, peakY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2c1614'; ctx.lineWidth = 1.5; ctx.stroke();
  // front gable
  const gableGrad = ctx.createLinearGradient(cx0, peakY, cx0, roofBaseY);
  gableGrad.addColorStop(0, theme.castleRoof[1]);
  gableGrad.addColorStop(1, theme.castleRoof[0]);
  ctx.fillStyle = gableGrad;
  ctx.beginPath();
  ctx.moveTo(cx0 - 6, roofBaseY);
  ctx.lineTo(peakX, peakY);
  ctx.lineTo(cx0 + cw + 5, roofBaseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#331b18'; ctx.lineWidth = 2; ctx.stroke();
  // shingle rows on gable
  ctx.strokeStyle = 'rgba(45,22,19,0.5)'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const yy = roofBaseY - (roofBaseY - peakY) * i / 6;
    const span = (cw/2 + 6) * (1 - i/6);
    ctx.beginPath(); ctx.moveTo(peakX - span, yy); ctx.lineTo(peakX + span, yy); ctx.stroke();
  }
  // collapsed roof corner at <25%
  if (hpPct < 0.25) {
    ctx.fillStyle = '#1d1f22';
    ctx.beginPath();
    ctx.moveTo(cx0 + cw - 14, roofBaseY - 12);
    ctx.lineTo(cx0 + cw + 4, roofBaseY - 22);
    ctx.lineTo(cx0 + cw + 5, roofBaseY);
    ctx.lineTo(cx0 + cw - 8, roofBaseY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 1.5; ctx.stroke();
    // exposed beams
    ctx.strokeStyle = '#5c4326'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx0 + cw - 10, roofBaseY - 4); ctx.lineTo(cx0 + cw + 2, roofBaseY - 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx0 + cw - 4, roofBaseY - 2); ctx.lineTo(cx0 + cw + 4, roofBaseY - 12); ctx.stroke();
  }

  // ---- WAVING FLAG ----
  {
    const fx = peakX, fy = peakY;
    ctx.strokeStyle = '#4a4d52'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 26); ctx.stroke();
    ctx.fillStyle = '#d9b959';
    ctx.beginPath(); ctx.arc(fx, fy - 27, 2, 0, 7); ctx.fill();
    const wave1 = Math.sin(t * 5) * 3, wave2 = Math.sin(t * 5 + 1.4) * 4;
    const flagGrad = ctx.createLinearGradient(fx, 0, fx + 26, 0);
    flagGrad.addColorStop(0, theme.flagColor[0]);
    flagGrad.addColorStop(1, theme.flagColor[1]);
    ctx.fillStyle = flagGrad;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 25);
    ctx.quadraticCurveTo(fx + 12, fy - 25 + wave1, fx + 24, fy - 21 + wave2);
    ctx.lineTo(fx + 24, fy - 13 + wave2);
    ctx.quadraticCurveTo(fx + 12, fy - 15 + wave1, fx, fy - 11);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5e1a14'; ctx.lineWidth = 1; ctx.stroke();
  }

  // ---- WINDOWS (arched, inset, warm glow; break when damaged) ----
  const winDefs = [ [cx0 + 11, cy0 + 16], [cx0 + cw - 26, cy0 + 16] ];
  for (let wI = 0; wI < winDefs.length; wI++) {
    const [wx, wy] = winDefs[wI];
    const wwid = 15, whgt = 19;
    const broken = (hpPct < 0.5 && wI === 0) || (hpPct < 0.25);
    // inset shadow frame
    ctx.fillStyle = '#3c4046';
    ctx.beginPath();
    ctx.moveTo(wx - 2, wy + whgt + 1);
    ctx.lineTo(wx - 2, wy + 4);
    ctx.arc(wx + wwid/2, wy + 4, wwid/2 + 2, Math.PI, 0);
    ctx.lineTo(wx + wwid + 2, wy + whgt + 1);
    ctx.closePath(); ctx.fill();
    // glass
    if (broken) {
      ctx.fillStyle = '#15161a';
    } else {
      const glow = 0.75 + Math.sin(t * 2.2 + wI * 2) * 0.25;
      const winGrad = ctx.createLinearGradient(wx, wy, wx, wy + whgt);
      winGrad.addColorStop(0, `rgba(255,209,120,${0.95 * glow})`);
      winGrad.addColorStop(1, `rgba(214,150,60,${0.85 * glow})`);
      ctx.fillStyle = winGrad;
    }
    ctx.beginPath();
    ctx.moveTo(wx, wy + whgt);
    ctx.lineTo(wx, wy + 4);
    ctx.arc(wx + wwid/2, wy + 4, wwid/2, Math.PI, 0);
    ctx.lineTo(wx + wwid, wy + whgt);
    ctx.closePath(); ctx.fill();
    if (broken) {
      // shattered glass shards
      ctx.strokeStyle = '#4b4f56'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx + 2, wy + 4); ctx.lineTo(wx + wwid - 2, wy + whgt - 3);
      ctx.moveTo(wx + wwid - 3, wy + 3); ctx.lineTo(wx + 3, wy + whgt - 4);
      ctx.stroke();
    } else {
      // mullion
      ctx.strokeStyle = 'rgba(60,64,70,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx + wwid/2, wy - 3); ctx.lineTo(wx + wwid/2, wy + whgt);
      ctx.moveTo(wx, wy + 8); ctx.lineTo(wx + wwid, wy + 8);
      ctx.stroke();
    }
  }

  // ---- GATE (arched wood with iron bands) ----
  {
    const gw = cw - 30, gx = cx0 + 15, gTop = cy0 + ch - 34;
    // arch recess
    ctx.fillStyle = '#43474d';
    ctx.beginPath();
    ctx.moveTo(gx - 3, cy0 + ch);
    ctx.lineTo(gx - 3, gTop + 8);
    ctx.arc(gx + gw/2, gTop + 8, gw/2 + 3, Math.PI, 0);
    ctx.lineTo(gx + gw + 3, cy0 + ch);
    ctx.closePath(); ctx.fill();
    // wooden door
    const doorGrad = ctx.createLinearGradient(gx, gTop, gx, cy0 + ch);
    doorGrad.addColorStop(0, theme.castleDoor[0]);
    doorGrad.addColorStop(1, theme.castleDoor[1]);
    ctx.fillStyle = doorGrad;
    ctx.beginPath();
    ctx.moveTo(gx, cy0 + ch);
    ctx.lineTo(gx, gTop + 8);
    ctx.arc(gx + gw/2, gTop + 8, gw/2, Math.PI, 0);
    ctx.lineTo(gx + gw, cy0 + ch);
    ctx.closePath(); ctx.fill();
    // planks
    ctx.strokeStyle = 'rgba(30,21,10,0.7)'; ctx.lineWidth = 1;
    for (let px = gx + 5; px < gx + gw; px += 6) {
      ctx.beginPath(); ctx.moveTo(px, gTop + 2); ctx.lineTo(px, cy0 + ch); ctx.stroke();
    }
    // iron bands + studs
    ctx.strokeStyle = '#2b2d31'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(gx, gTop + 16); ctx.lineTo(gx + gw, gTop + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gTop + 27); ctx.lineTo(gx + gw, gTop + 27); ctx.stroke();
    ctx.fillStyle = '#585b60';
    for (const bandY of [gTop + 16, gTop + 27]) {
      for (let sx = gx + 4; sx < gx + gw; sx += 8) {
        ctx.beginPath(); ctx.arc(sx, bandY, 1.3, 0, 7); ctx.fill();
      }
    }
  }

  // ---- FIRE + SMOKE (damage < 25%) ----
  if (hpPct < 0.25) {
    const fireX = cx0 + 24, fireY = cy0 + 108;
    for (let i = 0; i < 4; i++) {
      const fl = Math.sin(t * 9 + i * 2.1) * 3;
      const fh = 10 + i * 3 + fl;
      ctx.fillStyle = ['#e06a2b', '#f0922f', '#ffc44d', '#e06a2b'][i];
      ctx.globalAlpha = 0.85 - i * 0.12;
      ctx.beginPath();
      ctx.moveTo(fireX - 6 + i * 3, fireY);
      ctx.quadraticCurveTo(fireX - 3 + i * 3 + fl, fireY - fh * 0.6, fireX + i * 3 + fl * 0.6, fireY - fh);
      ctx.quadraticCurveTo(fireX + 3 + i * 3 - fl, fireY - fh * 0.5, fireX + 6 + i * 3, fireY);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (hpPct < 0.5) {
    // smoke wisps drifting up
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.5 + i * 0.33) % 1;
      const sy = cy0 + 100 - phase * 70;
      const sx = cx0 + 22 + Math.sin(t * 1.5 + i * 2) * 8 + phase * 10;
      ctx.fillStyle = `rgba(70,72,76,${0.35 * (1 - phase)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 5 + phase * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWalls() {
  if (!game.walls || !game.walls.length) return;
  const frameDt = 1 / 60;
  for (const w of game.walls) {
    const def = WALL_TYPES[w.type];
    const dmg = 1 - Math.max(w.hp, 0) / w.maxHp;
    ctx.save();
    ctx.translate(w.tx * TILE - 2, w.ty * TILE - 6);
    ctx.scale((TILE + 4) / 48, (TILE + 4) / 48);
    WALL_SPRITES[def.id](ctx, dmg);
    ctx.restore();

    // White flash on each hit
    if (w.hitFlash > 0) {
      w.hitFlash -= frameDt;
      ctx.globalAlpha = Math.min(w.hitFlash / 0.08, 1) * 0.55;
      ctx.fillStyle = '#fff';
      ctx.fillRect(w.tx * TILE + 1, w.ty * TILE + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 1;
    }

    // Condition bar, only once it has taken a knock
    if (dmg > 0.001) {
      const barW = TILE - 10, bx = w.tx * TILE + 5, by = w.ty * TILE + TILE - 5;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, barW, 3);
      const pct = Math.max(w.hp, 0) / w.maxHp;
      ctx.fillStyle = pct > 0.5 ? '#9fd68f' : (pct > 0.25 ? '#e8b64c' : '#cc4444');
      ctx.fillRect(bx, by, barW * pct, 3);
    }
  }
}

function drawTowers() {
  const now = performance.now() / 1000;
  for (const t of game.towers) {
    const def = TOWER_TYPES[t.type];
    const cx = t.tx * TILE + TILE/2;
    const cy = t.ty * TILE + TILE/2;

    // Range circle on hover (skip for income towers)
    if (t.hover && def.range > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, def.range, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();
    }

    // Sprite (48x48 art scaled into the tile)
    const drawFn = TOWER_SPRITES[def.id];
    ctx.save();
    ctx.translate(t.tx*TILE - 2, t.ty*TILE - 6);
    ctx.scale((TILE+4)/48, (TILE+4)/48);
    if (drawFn) drawFn(ctx, now + (t.tx * 0.7 + t.ty * 1.3)); // phase offset so anims don't sync
    applySpriteTint(ctx, def.id);
    ctx.restore();

    // Knocked offline by a boss: frozen-out overlay + crackle
    if (t.stunned > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#8fd4ff';
      ctx.fillRect(t.tx * TILE + 2, t.ty * TILE + 2, TILE - 4, TILE - 4);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#dff2ff';
      ctx.lineWidth = 1.5;
      const jx = t.tx * TILE + TILE / 2, jy = t.ty * TILE + TILE / 2;
      ctx.beginPath();
      ctx.moveTo(jx - 8, jy - 6); ctx.lineTo(jx - 2, jy); ctx.lineTo(jx - 6, jy + 2); ctx.lineTo(jx + 2, jy + 8);
      ctx.stroke();
      ctx.restore();
    }

    // Muzzle flash when recently fired
    if (t.cooldown > def.rate - 0.09 && t.angle !== undefined) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(t.angle)*16, cy + Math.sin(t.angle)*16, 4.5, 0, Math.PI*2);
      ctx.fill();
    }

    // Upgrade level pips — brass shields
    if (t.level > 0) {
      const n = Math.min(t.level, 5);
      const w = n * 8;
      for (let i = 0; i < n; i++) {
        const px = cx - w/2 + i*8 + 4, py = t.ty*TILE - 5;
        ctx.fillStyle = '#e8b64c';
        ctx.strokeStyle = '#1a1512';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py-3); ctx.lineTo(px+3, py-1); ctx.lineTo(px+3, py+2);
        ctx.lineTo(px, py+4); ctx.lineTo(px-3, py+2); ctx.lineTo(px-3, py-1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    // Ammo bar (bottom of tower)
    const maxAmmo = t.maxAmmo || def.ammo;
    const ammo = t.ammo !== undefined ? t.ammo : maxAmmo;
    const barY = t.ty * TILE + TILE - 4;
    const barX = t.tx * TILE + 6;
    const barW = TILE - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, barY, barW, 3);
    const ammoPct = ammo / maxAmmo;
    ctx.fillStyle = ammoPct > 0.3 ? '#66ff66' : (ammoPct > 0 ? '#ffaa44' : '#ff4444');
    ctx.fillRect(barX, barY, barW * ammoPct, 3);

    // Reload indicator
    if (t.ammo <= 0 && t.reloading > 0) {
      const reloadPct = t.reloading / def.reload;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY - 4, barW, 3);
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(barX, barY - 4, barW * reloadPct, 3);
      // "RELOAD" text
      ctx.fillStyle = '#ffcc44';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⟳', cx, t.ty * TILE + 2);
      ctx.textAlign = 'left';
    }
  }
}

// Offscreen buffers, shared and reused per enemy per frame. Every character is drawn into
// enemyBufCv, a dark silhouette of it becomes a consistent ink outline (comic-style pass),
// then both are composited onto the board. This unifies the look of all 9 enemy designs.

function drawPlacement() {
  if (!game || game.gameOver) return;
  if (game.buildMode === 'wall') { drawWallPlacement(); return; }
  const def = TOWER_TYPES[game.selectedTower];
  if (!mouse.tx || mouse.tx < 0 || mouse.tx >= COLS || mouse.ty < 0 || mouse.ty >= ROWS) return;
  if (isPath(mouse.tx, mouse.ty) || isCastle(mouse.tx, mouse.ty)) return;
  if (game.towers.some(t => t.tx === mouse.tx && t.ty === mouse.ty)) return;

  const cx = mouse.tx * TILE + TILE/2;
  const cy = mouse.ty * TILE + TILE/2;

  // Range preview (skip for income towers with no range)
  if (def.range > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, def.range, 0, Math.PI*2);
    ctx.strokeStyle = game.gold >= def.cost ? 'rgba(240,192,64,0.25)' : 'rgba(255,50,50,0.25)';
    ctx.stroke();
    ctx.fillStyle = game.gold >= def.cost ? 'rgba(240,192,64,0.08)' : 'rgba(255,50,50,0.08)';
    ctx.fill();
  }

  // Ghost tower
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = def.color;
  ctx.fillRect(mouse.tx*TILE+6, mouse.ty*TILE+6, TILE-12, TILE-12);
  ctx.globalAlpha = 1;
}

function drawWallPlacement() {
  if (game.trashMode) return;
  const tx = mouse.tx, ty = mouse.ty;
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
  const def = WALL_TYPES[game.selectedWall];
  const ok = !canPlaceWall(tx, ty) && game.gold >= getWallCost(game.selectedWall);
  ctx.save();
  ctx.globalAlpha = 0.55;
  if (ok) {
    ctx.translate(tx * TILE - 2, ty * TILE - 6);
    ctx.scale((TILE + 4) / 48, (TILE + 4) / 48);
    WALL_SPRITES[def.id](ctx, 0);
  } else {
    ctx.fillStyle = 'rgba(255,50,50,0.28)';
    ctx.fillRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = 'rgba(255,80,80,0.8)'; ctx.lineWidth = 2;
    ctx.strokeRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
