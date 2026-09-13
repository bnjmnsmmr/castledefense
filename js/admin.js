// ===== ADMIN PANEL =====
// In-game tuning panel: reads/writes castleDefenseConfig overrides for DIFFICULTY, towers, walls, enemies.

function toggleAdminPanel() {
  const panel = document.getElementById('admin-panel');
  const opening = !panel.classList.contains('show');
  if (opening) {
    if (game && game.dailyChallenge) { showFlash('⚠️ Admin panel is disabled during Daily Challenge — everyone plays the same difficulty'); return; }
    buildAdminForm();
    if (game) game.paused = true;
  } else {
    if (game) { game.paused = false; saveGameState(); }
  }
  panel.classList.toggle('show', opening);
}

function buildAdminForm() {
  for (const key in DEFAULT_DIFFICULTY) {
    const el = document.getElementById('ad_' + key);
    if (el) el.value = DIFFICULTY[key];
  }
  const towerBody = document.getElementById('admin-tower-body');
  towerBody.innerHTML = '';
  for (const t of TOWER_TYPES) {
    const label = t.secret ? t.name + ' (secret)' : t.name;
    const tr = document.createElement('tr');
    tr.className = 'row';
    tr.innerHTML = `<td>${label}</td>
      <td><input type="number" id="at_${t.id}_cost" value="${t.cost}"></td>
      <td><input type="number" id="at_${t.id}_range" value="${t.range}"></td>
      <td><input type="number" step="0.05" id="at_${t.id}_rate" value="${t.rate}"></td>
      <td><input type="number" step="0.5" id="at_${t.id}_dmg" value="${t.dmg}"></td>
      <td><input type="number" id="at_${t.id}_ammo" value="${t.ammo}"></td>
      <td><input type="number" step="0.1" id="at_${t.id}_reload" value="${t.reload}"></td>`;
    towerBody.appendChild(tr);
  }
  const wallBody = document.getElementById('admin-wall-body');
  wallBody.innerHTML = '';
  for (const w of WALL_TYPES) {
    const tr = document.createElement('tr');
    tr.className = 'row';
    tr.innerHTML = `<td>${w.name}</td>
      <td><input type="number" id="aw_${w.id}_cost" value="${w.cost}"></td>
      <td><input type="number" id="aw_${w.id}_hp" value="${w.hp}"></td>`;
    wallBody.appendChild(tr);
  }
  const enemyBody = document.getElementById('admin-enemy-body');
  enemyBody.innerHTML = '';
  for (const e of ENEMY_DEFS) {
    const tr = document.createElement('tr');
    tr.className = 'row';
    tr.innerHTML = `<td>${e.id}</td>
      <td><input type="number" id="ae_${e.id}_hp" value="${e.hp}"></td>
      <td><input type="number" step="0.1" id="ae_${e.id}_speed" value="${e.speed}"></td>
      <td><input type="number" id="ae_${e.id}_reward" value="${e.reward}"></td>
      <td><input type="number" id="ae_${e.id}_xp" value="${e.xp}"></td>`;
    enemyBody.appendChild(tr);
  }
}

function adminNumVal(id, fallback) {
  const el = document.getElementById(id);
  const v = el ? parseFloat(el.value) : NaN;
  return isNaN(v) ? fallback : v;
}

function readAdminConfig() {
  const cfg = { difficulty: {}, towers: {}, enemies: {}, walls: {} };
  for (const key in DEFAULT_DIFFICULTY) cfg.difficulty[key] = adminNumVal('ad_' + key, DEFAULT_DIFFICULTY[key]);
  for (const w of WALL_TYPES) {
    cfg.walls[w.id] = { cost: adminNumVal('aw_' + w.id + '_cost', w.cost), hp: adminNumVal('aw_' + w.id + '_hp', w.hp) };
  }
  for (const t of TOWER_TYPES) {
    cfg.towers[t.id] = {
      cost: adminNumVal('at_' + t.id + '_cost', t.cost),
      range: adminNumVal('at_' + t.id + '_range', t.range),
      rate: adminNumVal('at_' + t.id + '_rate', t.rate),
      dmg: adminNumVal('at_' + t.id + '_dmg', t.dmg),
      ammo: adminNumVal('at_' + t.id + '_ammo', t.ammo),
      reload: adminNumVal('at_' + t.id + '_reload', t.reload),
    };
  }
  for (const e of ENEMY_DEFS) {
    cfg.enemies[e.id] = {
      hp: adminNumVal('ae_' + e.id + '_hp', e.hp),
      speed: adminNumVal('ae_' + e.id + '_speed', e.speed),
      reward: adminNumVal('ae_' + e.id + '_reward', e.reward),
      xp: adminNumVal('ae_' + e.id + '_xp', e.xp),
    };
  }
  return cfg;
}

// Applies a config object to the LIVE game objects immediately (no reload needed)
function applyAdminConfig(cfg) {
  if (cfg.difficulty) Object.assign(DIFFICULTY, cfg.difficulty);
  if (cfg.towers) for (const t of TOWER_TYPES) if (cfg.towers[t.id]) Object.assign(t, cfg.towers[t.id]);
  if (cfg.enemies) for (const e of ENEMY_DEFS) if (cfg.enemies[e.id]) Object.assign(e, cfg.enemies[e.id]);
  if (cfg.walls) for (const w of WALL_TYPES) if (cfg.walls[w.id]) Object.assign(w, cfg.walls[w.id]);
  if (typeof buildTowerBar === 'function' && game) buildTowerBar();
  if (typeof updateUI === 'function' && game) updateUI();
}

function setAdminStatus(msg, isError) {
  const el = document.getElementById('admin-status');
  el.textContent = msg;
  el.style.color = isError ? '#e0766f' : '#9fd68f';
  clearTimeout(setAdminStatus._t);
  setAdminStatus._t = setTimeout(() => { el.textContent = ''; }, 3500);
}

function saveAdminConfig() {
  const cfg = readAdminConfig();
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cfg));
  applyAdminConfig(cfg);
  setAdminStatus('✓ Saved and applied — changes are live now');
}

function exportAdminConfig() {
  const cfg = readAdminConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'castle-defense-config.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setAdminStatus('✓ Downloaded castle-defense-config.json');
}

function importAdminConfig(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const cfg = JSON.parse(reader.result);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cfg));
      applyAdminConfig(cfg);
      buildAdminForm();
      setAdminStatus('✓ Imported, saved, and applied');
    } catch (err) {
      setAdminStatus('✗ That file is not valid JSON', true);
    }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

function resetAdminDefaults() {
  if (!confirm('Reset every value back to the shipped defaults? This clears your saved config.')) return;
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  const cfg = { difficulty: DEFAULT_DIFFICULTY, towers: {}, enemies: {}, walls: {} };
  for (const t of DEFAULT_TOWERS) cfg.towers[t.id] = t;
  for (const e of DEFAULT_ENEMIES) cfg.enemies[e.id] = e;
  for (const w of DEFAULT_WALLS) cfg.walls[w.id] = w;
  applyAdminConfig(cfg);
  buildAdminForm();
  setAdminStatus('✓ Reset to defaults and applied');
}

// Wave definitions
