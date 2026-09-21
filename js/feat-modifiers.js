// ===== FEATURE: RUN MODIFIERS =====
// Home-screen challenge toggles ("No Walls", "Half Gold", ...) that each raise a score
// multiplier. Selection persists in localStorage and is applied only when a genuine new
// run is constructed by initGame() via startGame(false) — never to a resumed run's setup
// (a resume instead restores whatever modifiers/scoreMult were already saved on that run),
// the Daily Challenge, or a loaded Community Level.

const MODIFIER_DEFS = [
  { id: 'no_walls',     icon: '🚫', name: 'No Walls',     mult: 1.15, desc: 'The WALLS build tab is disabled — towers only, no barricades on the path.' },
  { id: 'half_gold',    icon: '💰', name: 'Half Gold',    mult: 1.3,  desc: 'Starting gold and every gold source (kills, wave/world bonuses, crates, Gold Mines) are halved.' },
  { id: 'iron_castle',  icon: '🛡️', name: 'Iron Castle',  mult: 1.25, desc: `Start with just 5 hearts instead of ${DIFFICULTY.startHp}.` },
  { id: 'double_time',  icon: '⏩', name: 'Double Time',  mult: 1.2,  desc: 'Enemies move 50% faster, starting on Wave 1.' },
  { id: 'glass_towers', icon: '💎', name: 'Glass Towers', mult: 1.2,  desc: 'Towers cost 30% more gold to build and sell for nothing.' },
  { id: 'fog_of_war',   icon: '🌫️', name: 'Fog of War',   mult: 1.15, desc: 'No prep-phase notice or wave banner reveals what is coming.' },
];
const MODIFIERS_STORAGE_KEY = 'castleDefenseModifiers';
const MODIFIERS_MULT_CAP = 3;

function loadModifierSelection() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(MODIFIERS_STORAGE_KEY)) || []; } catch (e) { ids = []; }
  const known = MODIFIER_DEFS.map(m => m.id);
  return Array.isArray(ids) ? ids.filter(id => known.includes(id)) : [];
}
function saveModifierSelection(ids) {
  try { localStorage.setItem(MODIFIERS_STORAGE_KEY, JSON.stringify(ids)); } catch (e) { /* storage unavailable, ignore */ }
}
function modifiersMultiplier(ids) {
  let m = 1;
  for (const id of (ids || [])) { const d = MODIFIER_DEFS.find(x => x.id === id); if (d) m *= d.mult; }
  return Math.min(m, MODIFIERS_MULT_CAP);
}
function trimMult(m) { return String(Math.round((m || 1) * 100) / 100); }

// Truthy only while the current run is meant to have modifiers in effect. Set by the
// startGame()/startDailyChallenge()/startLevelFromPayload() hooks right before initGame()
// runs, so initGame() can read it synchronously while building the run's starting state.
let ACTIVE_RUN_MODIFIERS = null;
function modActive(id) { return !!(ACTIVE_RUN_MODIFIERS && ACTIVE_RUN_MODIFIERS.indexOf(id) !== -1); }
function beginRunModifiers(resume) { ACTIVE_RUN_MODIFIERS = resume ? null : loadModifierSelection(); }
function clearRunModifiers() { ACTIVE_RUN_MODIFIERS = null; }
// A resumed run keeps whatever modifiers (and multiplier) were already active on it.
function restoreRunModifiers(saved) {
  ACTIVE_RUN_MODIFIERS = saved.modifiers || [];
  game.modifiers = ACTIVE_RUN_MODIFIERS.slice();
  game.scoreMult = saved.scoreMult || 1;
}

function modGoldMult() { return modActive('half_gold') ? 0.5 : 1; }
function modTowerCostMult() { return modActive('glass_towers') ? 1.3 : 1; }
function modTowerCost(baseCost) { return Math.round(baseCost * modTowerCostMult()); }

function checkHandicappedHero() {
  if (game && (game.modifiers || []).length >= 3) {
    unlockAchievement('Handicapped Hero', 'Cleared World 1 with 3 or more modifiers active');
  }
}

// --- HOME SCREEN: a MODIFIERS link + a chip row under the primary Play/Continue button ---
function renderModifiersHomeUI(wrapMain, wrapSec) {
  if (!wrapSec || !wrapMain) return;
  const ids = loadModifierSelection();
  const mult = modifiersMultiplier(ids);
  const btn = document.createElement('button');
  btn.className = 'home-link-btn';
  btn.textContent = ids.length ? `MODIFIERS · ×${trimMult(mult)}` : 'MODIFIERS';
  btn.addEventListener('click', openModifiersPanel);
  wrapSec.appendChild(btn);

  let row = wrapMain.nextElementSibling;
  if (!row || row.id !== 'modifiers-chip-row') {
    row = document.createElement('div');
    row.id = 'modifiers-chip-row';
    row.className = 'modifiers-chip-row';
    wrapMain.insertAdjacentElement('afterend', row);
  }
  row.innerHTML = ids.length ? ids.map(id => {
    const d = MODIFIER_DEFS.find(m => m.id === id);
    return d ? `<span class="mod-chip">${d.icon} ${d.name}</span>` : '';
  }).join('') + `<span class="mod-chip mult">&times;${trimMult(mult)}</span>` : '';
}

// --- MODIFIERS PANEL (same visual language as Customize / Hall of Fame) ---
function openModifiersPanel() {
  buildModifiersBody();
  document.getElementById('modifiers-panel').classList.add('show');
  SFX.play('ui_click');
}
function closeModifiersPanel() {
  document.getElementById('modifiers-panel').classList.remove('show');
  refreshStartScreenButtons(); // picks up any change in the chip row / link label
}
function toggleModifier(id) {
  let ids = loadModifierSelection();
  ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  saveModifierSelection(ids);
  SFX.play('ui_click');
  buildModifiersBody();
}
function buildModifiersBody() {
  const body = document.getElementById('modifiers-body');
  const totalEl = document.getElementById('modifiers-total');
  if (!body || !totalEl) return;
  const ids = loadModifierSelection();
  const mult = modifiersMultiplier(ids);
  totalEl.textContent = ids.length
    ? `${ids.length} active — next new run scores ×${trimMult(mult)}`
    : 'No modifiers active — applies to your next new run, not Continue, Daily Challenge, or Community Levels';
  body.innerHTML = '';
  for (const d of MODIFIER_DEFS) {
    const on = ids.includes(d.id);
    const card = document.createElement('div');
    card.className = 'mod-card' + (on ? ' on' : '');
    card.innerHTML = `
      <div class="mod-card-icon">${d.icon}</div>
      <div class="mod-card-body">
        <div class="mod-card-name">${d.name}</div>
        <div class="mod-card-desc">${d.desc}</div>
      </div>
      <div class="mod-card-mult">&times;${d.mult}</div>
      <div class="mod-card-check">${on ? '✓' : ''}</div>
    `;
    card.addEventListener('click', () => toggleModifier(d.id));
    body.appendChild(card);
  }
}

// --- HALL OF FAME: modifier chips + multiplier next to a run's score ---
function renderModifierChips(row, entry) {
  const ids = entry && entry.modifiers;
  const meta = row && row.querySelector('.hof-meta');
  if (!ids || !ids.length || !meta) return;
  const mult = entry.scoreMult || modifiersMultiplier(ids);
  const multTag = document.createElement('span');
  multTag.className = 'hof-tag mod-mult-tag';
  multTag.textContent = '×' + trimMult(mult);
  meta.appendChild(multTag);
  for (const id of ids) {
    const d = MODIFIER_DEFS.find(m => m.id === id);
    if (!d) continue;
    const chip = document.createElement('span');
    chip.className = 'hof-tag';
    chip.title = d.name;
    chip.textContent = d.icon;
    meta.appendChild(chip);
  }
}

// --- RESULTS SCREEN: a MODIFIERS stat card ---
function renderModifierResult(container) {
  const ids = game && game.modifiers;
  const grid = container && container.querySelector('.go-grid');
  if (!ids || !ids.length || !grid) return;
  const mult = game.scoreMult || modifiersMultiplier(ids);
  const card = document.createElement('div');
  card.className = 'go-stat';
  card.innerHTML = `<div class="go-val">&times;${trimMult(mult)}</div><div class="go-lbl">Modifiers (${ids.length})</div>`;
  grid.appendChild(card);
}
