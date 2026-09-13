// ===== FEATURE: Tower targeting priority + tower inspect card =====
// Owns: per-tower target-mode selection (pickTarget), the #tower-card inspect
// popover (kills/damage/target-mode/sell), and the results-screen MVP tower card.
// Hooked into: js/game.js (pickTarget call + damageEnemy source param + endGame),
// js/input.js (hover/click card show, T hotkey), js/screens.js (chrome hide,
// community level payload), js/core.js (save/load one field).

const TARGET_MODES = ['first', 'last', 'strong', 'weak', 'near'];
const TARGET_MODE_LABEL = { first: 'FIRST', last: 'LAST', strong: 'STRONGEST', weak: 'WEAKEST', near: 'NEAREST' };
// Per-tower sensible defaults; anything not listed defaults to 'near' (matches old behavior).
const DEFAULT_TARGET_MODE_BY_ID = { sniper: 'strong', ice: 'first' };

function defaultTargetModeForType(typeIdx) {
  const id = TOWER_TYPES[typeIdx] && TOWER_TYPES[typeIdx].id;
  return DEFAULT_TARGET_MODE_BY_ID[id] || 'near';
}
function getTargetMode(t) {
  if (!t.targetMode) t.targetMode = defaultTargetModeForType(t.type);
  return t.targetMode;
}

// Furthest-along-path enemies score highest for 'first'; combines the tile index
// the enemy has reached with how far it's traveled into the current segment.
function enemyProgress(e) {
  if (!e.path || e.path.length < 2) return e.pathIdx || 0;
  const idx = e.pathIdx || 0;
  const cur = e.path[idx], next = e.path[idx + 1];
  if (!next) return idx;
  const segLen = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
  const traveled = Math.hypot(e.x - cur.x, e.y - cur.y);
  return idx + Math.min(1, traveled / segLen);
}

// Replaces the old "nearest enemy in range" scan with one that scores every
// in-range enemy according to this tower's targetMode and keeps the best.
function pickTarget(t, def, cx, cy) {
  const mode = getTargetMode(t);
  let best = null, bestScore = -Infinity;
  for (const e of game.enemies) {
    if (e.dead || e.untargetable > 0) continue;
    const d = Math.hypot(e.x - cx, e.y - cy);
    if (d > def.range * stormRangeMult()) continue; // Fog storm shrinks range (js/feat-storms.js)
    let score;
    switch (mode) {
      case 'first': score = enemyProgress(e); break;
      case 'last': score = -enemyProgress(e); break;
      case 'strong': score = e.hp; break;
      case 'weak': score = -e.hp; break;
      default: score = -d; break; // 'near'
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

// ===== TOWER INSPECT CARD =====
let towerCardEl = null;
let hoveredCardTower = null;
function ensureTowerCardEl() {
  if (towerCardEl) return towerCardEl;
  towerCardEl = document.createElement('div');
  towerCardEl.id = 'tower-card';
  document.body.appendChild(towerCardEl);
  return towerCardEl;
}
function hideTowerCard() {
  if (towerCardEl) towerCardEl.classList.remove('show');
}
function showTowerCard(t) {
  if (!t || !game) { hideTowerCard(); return; }
  game.selectedTowerRef = t;
  const el = ensureTowerCardEl();
  const base = TOWER_TYPES[t.type];
  const mode = getTargetMode(t);
  const canTarget = !base.income; // Gold Mine never attacks, hide the mode control
  el.innerHTML = `
    <div class="tc-name">${base.name} <span class="tc-lvl">Lv.${t.level || 0}</span></div>
    <div class="tc-row"><span>Kills</span><b>${t.kills || 0}</b></div>
    <div class="tc-row"><span>Damage dealt</span><b>${Math.round(t.dmgDealt || 0)}</b></div>
    ${canTarget ? `<button type="button" class="tc-mode" id="tc-mode-btn">TARGET: ${TARGET_MODE_LABEL[mode]}</button>` : ''}
    <button type="button" class="tc-sell" id="tc-sell-btn">SELL</button>
  `;
  el.classList.add('show');
  // Position above the tower tile, clamped inside the viewport.
  const rect = C.getBoundingClientRect();
  const sx = rect.width / C.width, sy = rect.height / C.height;
  const px = rect.left + (t.tx * TILE + TILE / 2) * sx;
  const py = rect.top + t.ty * TILE * sy;
  el.style.left = '0px'; el.style.top = '0px';
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = px - w / 2, top = py - h - 10;
  left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
  top = Math.max(8, Math.min(window.innerHeight - h - 8, top));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  const modeBtn = document.getElementById('tc-mode-btn');
  if (modeBtn) modeBtn.onclick = ev => { ev.stopPropagation(); cycleTargetMode(t); };
  const sellBtn = document.getElementById('tc-sell-btn');
  if (sellBtn) sellBtn.onclick = ev => { ev.stopPropagation(); sellTowerFromCard(t); };
}
// Desktop hover: only re-render the card when the hovered tower actually changes
// (mousemove fires far too often to redo this every frame).
function handleTowerHoverUpdate() {
  if (IS_TOUCH || !game) return;
  const h = game.towers.find(t => t.hover);
  if (h === hoveredCardTower) return;
  hoveredCardTower = h;
  if (h) showTowerCard(h); else hideTowerCard();
}
function cycleTargetMode(t) {
  if (!t) return;
  const cur = getTargetMode(t);
  t.targetMode = TARGET_MODES[(TARGET_MODES.indexOf(cur) + 1) % TARGET_MODES.length];
  SFX.play('ui_click');
  showTowerCard(t);
  requestSave();
}
// Mirrors the trash-mode sell math in js/input.js (same refund rate, sound, particles).
function sellTowerFromCard(t) {
  if (!game) return;
  const idx = game.towers.indexOf(t);
  if (idx === -1) return;
  const refund = Math.floor(TOWER_TYPES[t.type].cost * DIFFICULTY.sellRefundRate);
  game.towers.splice(idx, 1);
  game.gold += refund;
  if (game.selectedTowerRef === t) game.selectedTowerRef = null;
  if (hoveredCardTower === t) hoveredCardTower = null;
  SFX.play('sell');
  spawnParticles(t.tx * TILE + TILE / 2, t.ty * TILE + TILE / 2, '#e8b64c', 12);
  showFlash(`Sold for ${refund} gold`);
  hideTowerCard();
  updateUI();
}

// ===== RESULTS SCREEN MVP CARD =====
function renderMvpCard(container) {
  if (!container || !game || !game.towers || !game.towers.length) return;
  let mvp = null;
  for (const t of game.towers) {
    if (!t.kills && !t.dmgDealt) continue;
    if (!mvp || t.kills > mvp.kills || (t.kills === mvp.kills && t.dmgDealt > mvp.dmgDealt)) mvp = t;
  }
  if (!mvp) return;
  const base = TOWER_TYPES[mvp.type];
  const card = document.createElement('div');
  card.className = 'go-stat mvp-stat';
  card.innerHTML = `<div class="go-val">${base.name}</div><div class="go-lbl">MVP TOWER · LV.${mvp.level || 0}</div><div class="go-delta">${mvp.kills || 0} kills · ${Math.round(mvp.dmgDealt || 0)} dmg</div>`;
  container.appendChild(card);
}
