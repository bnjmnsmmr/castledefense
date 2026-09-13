// ===== UI (HUD widgets) =====
// Guardian of Stars merchant, toasts, center banners, build tabs + tower/wall bar.

// --- GUARDIAN OF STARS ---
const GUARDIAN_LINES = [
  { at: 1, face: '🌟', angry: false, text: "Halt, young knight! You don't have enough <b>stars</b> to unlock this upgrade. Earn 10 XP by slaying enemies." },
  { at: 3, face: '🌟', angry: false, text: "I <b>said</b> you don't have enough stars. Poking the tower won't make one appear." },
  { at: 5, face: '😠', angry: true, text: "STOP. CLICKING. THE. TOWER. Go fight something!" },
  { at: 7, face: '🤬', angry: true, text: "ARE YOU SERIOUS?! I am a celestial being! I guard the STARS! I— you're still clicking, aren't you." },
];
let guardianHideTimer = null;
function guardianPester() {
  const now = performance.now();
  if (!game.guardClicks || now - (game.lastGuardClick || 0) > 6000) game.guardClicks = 0;
  game.lastGuardClick = now;
  game.guardClicks++;

  const panel = document.getElementById('guardian');
  const face = document.getElementById('guard-face');
  const text = document.getElementById('guard-text');

  if (game.guardClicks >= 9 && !((game.achievements||{})['Pest of the Realm'])) {
    // He gives up. Achievement + free star.
    face.textContent = '😮‍💨';
    panel.classList.remove('angry');
    text.innerHTML = "FINE! <b>TAKE A STAR.</b> Take it and leave me alone. I have a whole sky to run.";
    panel.classList.add('show');
    unlockAchievement('Pest of the Realm', 'Annoyed the Guardian of Stars into surrender — free upgrade star!');
    game.xp += 10; // grants exactly one upgrade point
    updateUI();
    clearTimeout(guardianHideTimer);
    guardianHideTimer = setTimeout(() => panel.classList.remove('show'), 5000);
    return;
  }

  let line = GUARDIAN_LINES[0];
  for (const l of GUARDIAN_LINES) if (game.guardClicks >= l.at) line = l;
  face.textContent = line.face;
  text.innerHTML = line.text;
  panel.classList.toggle('angry', line.angry);
  panel.classList.add('show');
  clearTimeout(guardianHideTimer);
  guardianHideTimer = setTimeout(() => { panel.classList.remove('show'); panel.classList.remove('angry'); }, 4000);
}

function buyTriBeam() {
  if (!game) return;
  const cost = game.triBeamGranted ? 0 : 150;
  if (game.gold < cost) {
    showFlash(`Not enough gold! The crystal costs ${cost} (you have ${game.gold})`);
    return;
  }
  game.gold -= cost;
  game.triBeamEquipped = true;
  game.merchantGone = true;
  document.getElementById('merchant').classList.remove('show');
  showFlash('🔮 TRI-BEAM CRYSTAL EQUIPPED — your Annihilator now fires 3 beams!');
  unlockAchievement('Tri-Beam Online', 'Equipped the Tri-Beam Crystal to the Annihilator');
  spawnParticles(C.width - 150, C.height - 200, '#aaffff', 30);
  updateUI();
}

function dismissMerchant() {
  document.getElementById('merchant').classList.remove('show');
  // he'll try again next prep phase
}


// --- TOAST NOTIFICATION SYSTEM ---
const TOAST_ICONS = {
  info:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.25"/><rect x="11" y="10" width="2" height="7" rx="1" fill="currentColor"/><circle cx="12" cy="7" r="1.3"/></svg>',
  success: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z"/></svg>',
  warning: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z"/></svg>',
  danger:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4 12.6L14.6 16 12 13.4 9.4 16 8 14.6l2.6-2.6L8 9.4 9.4 8l2.6 2.6L14.6 8 16 9.4 13.4 12l2.6 2.6z"/></svg>',
  epic:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 5 5 .7-3.6 3.6.9 5.2L12 14l-4.3 2.5.9-5.2L5 7.7 10 7z"/></svg>',
};
function notify(type, msg) {
  const stack = document.getElementById('toast-stack');
  while (stack.childElementCount >= 3) stack.removeChild(stack.firstChild);
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = TOAST_ICONS[type] + '<span></span>';
  t.querySelector('span').textContent = msg;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3500);
}
// Compatibility wrapper — infers toast type from message content
function showFlash(msg) {
  let type = 'info';
  if (/⚠️|Not enough|No tower|No upgrade/.test(msg)) type = 'warning';
  if (/attack|CURSED|lose/i.test(msg)) type = 'danger';
  if (/Sold|ON —|refund/i.test(msg)) type = 'success';
  if (/⬆️|⭐|☢️|Upgrade|UNLOCKED|unlocked/.test(msg)) type = 'epic';
  notify(type, msg.replace(/[⚠️⬆️⭐☢️🗑️🔁👆🦸🧙‍♂️]/gu, '').trim());
}

// --- CENTER BANNER (waves, worlds, milestones) ---
function showBannerText(title, sub, dur = 2100) {
  const b = document.getElementById('wave-banner');
  document.getElementById('wave-banner-title').textContent = title;
  document.getElementById('wave-banner-sub').textContent = sub || '';
  b.classList.remove('play');
  void b.offsetWidth;
  b.classList.add('play');
  clearTimeout(showBannerText._t);
  showBannerText._t = setTimeout(() => b.classList.remove('play'), dur);
}
function showWaveBanner(waveNum, sub) { showBannerText('WAVE ' + waveNum, sub, 2100); }
function showWorldBanner(worldNum, sub) { showBannerText('WORLD ' + worldNum, sub, 2600); }


// --- TOWER BAR ---
function setBuildMode(mode) {
  if (!game) return;
  game.buildMode = mode;
  game.trashMode = false;
  game.pendingTile = null;
  buildTowerBar();
}

function updateBuildTabs() {
  const wrap = document.getElementById('build-tabs');
  if (!wrap) return;
  const on = !!(game && game.running && !game.gameOver);
  wrap.classList.toggle('show', on);
  if (!on) return;
  document.getElementById('tab-towers').classList.toggle('on', game.buildMode !== 'wall');
  document.getElementById('tab-walls').classList.toggle('on', game.buildMode === 'wall');
}

function buildWallBar() {
  const bar = document.getElementById('tower-bar');
  bar.innerHTML = '';
  WALL_TYPES.forEach((w, i) => {
    const cost = getWallCost(i);
    const btn = document.createElement('div');
    btn.className = 'tower-btn' + (i === (game ? game.selectedWall : 0) ? ' selected' : '');
    btn.innerHTML = `<canvas width="48" height="48"></canvas>
      <div class="name">${w.name}</div><div class="cost">${cost}g</div>
      <div class="hp-tag">${w.hp} HP</div><div class="key">[${w.key}]</div>
      <div class="tb-tooltip"><div class="tt-name">${w.name}</div>
        <div class="tt-row">Toughness <b>${w.hp} HP</b></div>
        <div class="tt-row">Cost <b>${cost} gold</b></div>
        <div class="tt-special">★ Built on the path. Enemies stop and smash through it — flyers pass over.</div>
      </div>`;
    btn.dataset.wall = i;
    const c = btn.querySelector('canvas').getContext('2d');
    WALL_SPRITES[w.id](c, 0);
    btn.addEventListener('click', () => {
      if (game) { game.selectedWall = i; game.trashMode = false; }
      updateTowerBar();
    });
    bar.appendChild(btn);
  });
  appendSellButton(bar);
  updateBuildTabs();
}

function appendSellButton(bar) {
  const trashBtn = document.createElement('div');
  trashBtn.className = 'tower-btn danger-card';
  trashBtn.id = 'trash-btn';
  trashBtn.innerHTML = `<canvas width="48" height="48"></canvas><div class="name">Sell</div><div class="cost">${Math.round(DIFFICULTY.sellRefundRate*100)}% back</div><div class="key">[X]</div>`;
  const sc = trashBtn.querySelector('canvas').getContext('2d');
  sc.strokeStyle = '#b3362e'; sc.lineWidth = 3;
  sc.strokeRect(14,16,20,24);
  sc.beginPath(); sc.moveTo(10,16); sc.lineTo(38,16); sc.stroke();
  sc.fillStyle = '#b3362e'; sc.fillRect(20,10,8,4);
  sc.beginPath(); sc.moveTo(19,22); sc.lineTo(19,34); sc.moveTo(24,22); sc.lineTo(24,34); sc.moveTo(29,22); sc.lineTo(29,34); sc.stroke();
  trashBtn.addEventListener('click', () => {
    if (game) game.trashMode = !game.trashMode;
    updateTowerBar();
  });
  bar.appendChild(trashBtn);
}

function buildTowerBar() {
  if (game && game.buildMode === 'wall') { buildWallBar(); return; }
  const bar = document.getElementById('tower-bar');
  bar.innerHTML = '';
  TOWER_TYPES.forEach((t, i) => {
    if (t.secret && !(game && game.annihilatorUnlocked)) return;
    const btn = document.createElement('div');
    btn.className = 'tower-btn' + (i === 0 ? ' selected' : '') + (t.secret ? ' secret-tower' : '');
    const info = TOWER_INFO[t.id] || {};
    const tooltipRows = t.income
      ? `<div class="tt-row">Income <b>${DIFFICULTY.goldMineRate} gold/s</b></div>`
      : `<div class="tt-row">Damage <b>${t.pctDmg ? Math.round(t.pctDmg*100)+'% max HP' : t.dmg}</b></div>
        <div class="tt-row">Speed <b>${info.rate || '—'}</b></div>
        <div class="tt-row">Range <b>${info.range || '—'}</b></div>`;
    btn.innerHTML = `<canvas width="48" height="48"></canvas>
      <div class="name">${t.name}</div><div class="cost">${t.cost}g</div><div class="key">[${t.key}]</div>
      <div class="tb-tooltip"><div class="tt-name">${t.name}</div>
        ${tooltipRows}
        ${info.spec ? `<div class="tt-special">★ ${info.spec}</div>` : ''}
      </div>`;
    btn.dataset.idx = i;
    const mc = btn.querySelector('canvas').getContext('2d');
    const drawFn = TOWER_SPRITES[t.id];
    if (drawFn) drawFn(mc, 0.8); // static frame for the card
    applySpriteTint(mc, t.id);
    btn.addEventListener('click', () => {
      if (game) { game.selectedTower = i; game.trashMode = false; }
      updateTowerBar();
      tutorialEvent('select');
    });
    bar.appendChild(btn);
  });

  appendSellButton(bar);
  updateBuildTabs();
}

function updateTowerBar() {
  const btns = document.querySelectorAll('.tower-btn');
  btns.forEach((b) => {
    if (b.id === 'trash-btn') {
      b.classList.toggle('selected', !!(game && game.trashMode));
      return;
    }
    if (b.dataset.wall !== undefined) {
      const wi = parseInt(b.dataset.wall);
      b.classList.toggle('selected', game && wi === game.selectedWall && !game.trashMode);
      b.classList.toggle('broke', !(game && game.gold >= getWallCost(wi)));
      return;
    }
    const i = parseInt(b.dataset.idx);
    b.classList.toggle('selected', game && i === game.selectedTower && !game.trashMode);
    const canAfford = game && game.gold >= TOWER_TYPES[i].cost;
    b.classList.toggle('broke', !canAfford);
  });
  updateBuildTabs();
}
