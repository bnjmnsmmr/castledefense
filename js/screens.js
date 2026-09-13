// ===== SCREENS (menus & overlays) =====
// Home, tutorial coach marks, daily challenge, customize, achievements gallery, Hall of Fame / global board, community levels, save-layout flow, share.

// ===== COMMUNITY LEVELS =====
// A level code is just base64(JSON) of tower/wall positions — no server involved.
// Players trade codes by hand (chat, forum, whatever); LOAD LEVEL decodes and
// validates it defensively since the string could have come from anyone.
const LEVELS_KEY = 'castleDefenseLevels';
const MAX_SAVED_LEVELS = 5;
const LEVEL_CODE_VERSION = 1;

function loadSavedLevels() {
  try { return JSON.parse(localStorage.getItem(LEVELS_KEY)) || []; } catch (e) { return []; }
}
function persistSavedLevels(list) {
  try { localStorage.setItem(LEVELS_KEY, JSON.stringify(list)); } catch (e) {}
}

function encodeLevelCode(obj) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); } catch (e) { return ''; }
}
function decodeLevelCode(code) {
  try { return JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))); } catch (e) { return null; }
}

function buildLevelPayload(name) {
  if (!game) return null;
  return {
    v: LEVEL_CODE_VERSION,
    name: String(name || 'My Defense').slice(0, 40),
    towers: game.towers.map(t => ({ tx: t.tx, ty: t.ty, type: t.type, level: t.level || 0 })),
    walls: (game.walls || []).map(w => ({ tx: w.tx, ty: w.ty, type: w.type })),
    world: game.world,
  };
}

// Saves the current run's layout into the local "my saved levels" list (max 5,
// oldest dropped) and returns the shareable code, or null if there's nothing to save.
function saveCurrentLayoutAsLevel(name) {
  if (!game || !game.towers.length) return null;
  const payload = buildLevelPayload(name);
  const code = encodeLevelCode(payload);
  if (!code) return null;
  let list = loadSavedLevels();
  list.unshift({
    id: Date.now(), name: payload.name, code,
    towerCount: payload.towers.length, wallCount: payload.walls.length,
    world: payload.world, createdAt: Date.now(),
  });
  if (list.length > MAX_SAVED_LEVELS) list = list.slice(0, MAX_SAVED_LEVELS);
  persistSavedLevels(list);
  return code;
}

function deleteSavedLevel(id) {
  persistSavedLevels(loadSavedLevels().filter(l => l.id !== id));
  buildCommunityBody();
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopyToClipboard(text));
  } else {
    fallbackCopyToClipboard(text);
  }
}
function fallbackCopyToClipboard(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { /* clipboard unavailable, code is still shown on screen */ }
}

function shareSavedLevel(id) {
  const lvl = loadSavedLevels().find(l => l.id === id);
  if (!lvl) return;
  copyToClipboard(lvl.code);
  SFX.play('ui_click');
  showFlash(`Code for "${lvl.name}" copied to clipboard!`);
}

function openCommunityScreen() {
  buildCommunityBody();
  const input = document.getElementById('comm-code-input');
  if (input) input.value = '';
  const status = document.getElementById('comm-load-status');
  if (status) { status.textContent = ''; status.classList.remove('ok'); }
  document.getElementById('community-panel').classList.add('show');
}
function closeCommunityScreen() {
  document.getElementById('community-panel').classList.remove('show');
}

function buildCommunityBody() {
  const list = loadSavedLevels();
  document.getElementById('comm-saved-count').textContent = list.length;
  const body = document.getElementById('comm-saved-body');
  if (!list.length) {
    body.innerHTML = `<div class="comm-empty">No saved layouts yet. Build some towers in a game, pause, and hit SAVE LAYOUT.</div>`;
    return;
  }
  body.innerHTML = list.map((l, i) => `
    <div class="comm-level-card">
      <div class="comm-level-info">
        <div class="comm-level-name" data-i="${i}"></div>
        <div class="comm-level-meta">${l.towerCount} tower${l.towerCount === 1 ? '' : 's'}${l.wallCount ? `, ${l.wallCount} wall${l.wallCount === 1 ? '' : 's'}` : ''} &middot; World ${l.world}</div>
      </div>
      <div class="comm-level-actions">
        <button class="comm-share-btn" data-id="${l.id}">SHARE</button>
        <button class="comm-del-btn" data-id="${l.id}">DELETE</button>
      </div>
    </div>
  `).join('');
  body.querySelectorAll('.comm-level-name').forEach(el => { el.textContent = list[Number(el.dataset.i)].name; });
  body.querySelectorAll('.comm-share-btn').forEach(b => b.addEventListener('click', () => shareSavedLevel(Number(b.dataset.id))));
  body.querySelectorAll('.comm-del-btn').forEach(b => b.addEventListener('click', () => deleteSavedLevel(Number(b.dataset.id))));
}

function loadLevelFromInput() {
  const input = document.getElementById('comm-code-input');
  const status = document.getElementById('comm-load-status');
  const code = input ? input.value.trim() : '';
  status.classList.remove('ok');
  if (!code) { status.textContent = 'Paste a level code first.'; return; }
  const payload = decodeLevelCode(code);
  if (!payload || !Array.isArray(payload.towers)) {
    status.textContent = 'That code could not be read — check it was copied in full.';
    return;
  }
  status.classList.add('ok');
  status.textContent = `Loading "${payload.name || 'Community Level'}"...`;
  startLevelFromPayload(payload);
}

// Starts a fresh run seeded with someone else's (or your own saved) tower layout.
// Every tile is re-validated against the current map/tower list rather than trusted —
// the code could have been hand-edited or come from an older version of the game.
function startLevelFromPayload(payload) {
  closeCommunityScreen();
  const world = Math.max(1, Math.min(WORLD_THEMES.length, Math.floor(Number(payload.world)) || 1));
  clearRunModifiers(); // community levels never carry run modifiers
  game = initGame();
  game.world = world;

  let spent = 0;
  const seen = new Set();
  const placedTowers = [];
  for (const t of (payload.towers || [])) {
    const tx = Math.floor(t.tx), ty = Math.floor(t.ty);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
    if (isPath(tx, ty) || isCastle(tx, ty)) continue;
    const key = tx + ',' + ty;
    if (seen.has(key)) continue;
    const type = Math.max(0, Math.min(TOWER_TYPES.length - 1, Math.floor(Number(t.type)) || 0));
    if (TOWER_TYPES[type].secret) continue; // no smuggling the Annihilator in via a level code
    seen.add(key);
    const level = Math.max(0, Math.min(5, Math.floor(Number(t.level)) || 0));
    placedTowers.push({ tx, ty, type, level, cooldown: 0, angle: 0 });
    spent += TOWER_TYPES[type].cost;
  }
  const placedWalls = [];
  for (const w of (payload.walls || [])) {
    const tx = Math.floor(w.tx), ty = Math.floor(w.ty);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
    if (!isPath(tx, ty) || isCastle(tx, ty)) continue;
    const key = tx + ',' + ty;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = Math.max(0, Math.min(WALL_TYPES.length - 1, Math.floor(Number(w.type)) || 0));
    const def = WALL_TYPES[type];
    placedWalls.push({ tx, ty, type, hp: def.hp, maxHp: def.hp, buyCost: def.cost });
    spent += def.cost;
  }

  game.towers = placedTowers;
  game.walls = placedWalls;
  game.gold = DIFFICULTY.startGold + spent; // enough that the imported layout reads as "already bought"
  game.communityLevel = true;
  game.communityLevelName = String(payload.name || 'Community Level').slice(0, 60);
  clearGameState(); // this is a one-off mode, not the resumable "continue" save

  game.prepPhase = true;
  game.betweenWaves = false;
  game.waveActive = false;
  const ov = document.getElementById('overlay');
  ov.classList.remove('home-mode');
  ov.style.display = 'none';
  setGameChromeVisible(true);
  document.body.style.background = getWorldTheme().bgBase;
  groundCache = null;
  document.getElementById('send-wave-btn').style.display = 'block';
  document.getElementById('hint').style.display = 'block';
  const awBtn = document.getElementById('auto-wave-btn');
  awBtn.style.display = 'block';
  awBtn.textContent = 'AUTO-WAVE: OFF';
  awBtn.classList.remove('on');
  document.getElementById('speed-btn').style.display = 'block';
  document.getElementById('pause-toggle-btn').style.display = 'flex';
  updateSpeedBtn();
  buildTowerBar();
  stopHomeMusic();
  startMusic();
  updateUI();
  resize();
  render();
  requestAnimationFrame(loop);
  showFlash(`Loaded "${game.communityLevelName}" — ${placedTowers.length} towers ready!`);
}


// ===== SAVE LAYOUT (pause menu) =====
function openSaveLayoutFlow() {
  if (!game || !game.towers.length) { showFlash('Place some towers first!'); return; }
  const box = document.getElementById('save-layout-box');
  if (!box) return;
  const count = loadSavedLevels().length;
  box.style.display = 'block';
  box.innerHTML = `
    <div class="save-layout-form">
      <input type="text" id="save-layout-name" class="text-input" placeholder="Name this layout" maxlength="40" value="World ${game.world} Defense">
      <button onclick="confirmSaveLayout()">SAVE &amp; GET CODE</button>
      <div class="save-layout-hint">${count}/${MAX_SAVED_LEVELS} saved layouts${count >= MAX_SAVED_LEVELS ? ' — oldest will be replaced' : ''}</div>
      <div id="save-layout-result"></div>
    </div>
  `;
}
function confirmSaveLayout() {
  const nameInput = document.getElementById('save-layout-name');
  const name = (nameInput && nameInput.value.trim()) || `World ${game.world} Defense`;
  const code = saveCurrentLayoutAsLevel(name);
  const result = document.getElementById('save-layout-result');
  if (!result) return;
  if (!code) { result.textContent = 'Could not save — try again.'; return; }
  SFX.play('unlock');
  result.innerHTML = `
    <div class="save-layout-code-lbl">Saved! Share this code:</div>
    <textarea readonly class="save-layout-code" onclick="this.select()"></textarea>
    <button class="secondary-btn" onclick="copyToClipboard(this.previousElementSibling.value); showFlash('Code copied!')">COPY CODE</button>
  `;
  result.querySelector('.save-layout-code').value = code;
}

const MENU_ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  resume: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5h3v14H5zM10 5l10 7-10 7z"/></svg>',
  daily: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 8h14v10H5V10z"/></svg>',
  customize: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.9C21.9 6 17.5 2 12 2zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.76-4.24L13 11h7V4l-2.35 2.35z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2h3v4c0 2.2-1.8 4-4 4h-.4A6 6 0 0 1 13 16.9V19h4v2H7v-2h4v-2.1A6 6 0 0 1 6.4 13H6c-2.2 0-4-1.8-4-4V5h3V3zm-1 4v2c0 1.1.9 2 2 2V7H4zm16 0h-2v4c1.1 0 2-.9 2-2V7z"/></svg>',
  community: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.66-8 4.5V21h16v-2.5c0-2.84-4.7-4.5-8-4.5zm8.5-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm1.2 2.2c1.3.7 2.3 1.8 2.3 3.3V21h-3v-2.5c0-1.3-.5-2.4-1.3-3.2.7-.2 1.4-.2 2-.1zM3.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-1.2 2.2c-.6-.1-1.3-.1-2 .1C-.5 15 0 16.1 0 17.4V21h3v-2.5c0-1.5 1-2.6 2.3-3.3-1-.6-2-1-3-1z"/></svg>',
};
function menuBtn(icon, label, onclick, secondary) {
  return `<button class="${secondary ? 'secondary-btn' : ''}" onclick="${onclick}"><span class="mi">${MENU_ICONS[icon]}</span>${label}</button>`;
}
function refreshStartScreenButtons() {
  const saved = loadGameState();
  const wrapMain = document.getElementById('start-buttons-main');
  const wrapSec = document.getElementById('start-buttons-secondary');
  if (!wrapMain || !wrapSec) return;
  const dailyBest = getDailyBest().best || 0;

  // Three big primary actions
  let mainHtml = '';
  if (saved) {
    mainHtml += menuBtn('resume', `CONTINUE — World ${saved.world}, Wave ${saved.wave}`, 'startGame(true)', false);
  } else {
    mainHtml += menuBtn('play', 'PLAY', 'startGame(false)', false);
  }
  mainHtml += menuBtn('community', 'COMMUNITY LEVELS', 'openCommunityScreen()', true);
  mainHtml += menuBtn('customize', 'CUSTOMIZE', 'openCustomizeScreen()', true);
  wrapMain.innerHTML = mainHtml;
  wrapMain.querySelectorAll('button').forEach(b => b.classList.add('home-btn-main'));

  // Smaller secondary links
  const achCount = ACHIEVEMENT_DEFS.filter(d => profile.achievements[d.name]).length;
  const hofTop = loadHallOfFame()[0];
  let secHtml = '';
  secHtml += `<button class="home-link-btn" onclick="startDailyChallenge()">DAILY CHALLENGE${dailyBest ? ` &middot; best ${dailyBest}` : ''}</button>`;
  secHtml += `<button class="home-link-btn" onclick="openAchievementsScreen()">HALL OF FAME${hofTop ? ` &middot; best ${hofTop.score} waves` : (achCount ? ` &middot; ${achCount}/${ACHIEVEMENT_DEFS.length}` : '')}</button>`;
  if (saved) secHtml += `<button class="home-link-btn" onclick="startGame(false)">NEW GAME</button>`;
  wrapSec.innerHTML = secHtml;
  renderModifiersHomeUI(wrapMain, wrapSec);
}


// ===== HOME SCREEN =====
const TUT_STEPS_HTML = `
  <div class="tut-step">
    <div class="tut-num">1</div>
    <div class="tut-text"><strong>Pick a tower</strong> from the bar at the bottom (or press 1-8).<span class="dim">Hover a card to see what it does. Every tower unlocks a brand-new attack when upgraded.</span></div>
  </div>
  <div class="tut-step">
    <div class="tut-num">2</div>
    <div class="tut-text"><strong>Click any green tile</strong> to place it. Towers cost gold 🪙.<span class="dim">You can't build on the brown path or on the castle.</span></div>
  </div>
  <div class="tut-step">
    <div class="tut-num">3</div>
    <div class="tut-text"><strong>Enemies walk the path</strong> toward your castle. Towers shoot automatically.<span class="dim">If an enemy reaches the castle, you lose a ❤️. Hit 0 and it's game over.</span></div>
  </div>
`;

function setGameChromeVisible(show) {
  document.getElementById('ui').style.display = show ? 'flex' : 'none';
  document.getElementById('tower-bar').style.display = show ? 'flex' : 'none';
  document.getElementById('build-tabs').classList.toggle('show', show);
}

function renderHomeScreen() {
  setGameChromeVisible(false);
  const ov = document.getElementById('overlay');
  ov.classList.add('home-mode');
  const kills = profile.stats.totalKills || 0;
  const best = profile.stats.bestScore || 0;
  const profileLine = (kills > 0 || best > 0) ? `
    <div class="home-profile">
      <span><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c1 3 2 4 4 5-2 1-3 2-4 5-1-3-2-4-4-5 2-1 3-2 4-5z"/></svg><b>${kills.toLocaleString()}</b> lifetime kills</span>
      ${best ? `<span><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2h3v4c0 2.2-1.8 4-4 4h-.4A6 6 0 0 1 13 16.9V19h4v2H7v-2h4v-2.1A6 6 0 0 1 6.4 13H6c-2.2 0-4-1.8-4-4V5h3V3z"/></svg>best: <b>World ${profile.stats.bestWorld}, Wave ${profile.stats.bestWave}</b></span>` : ''}
    </div>` : '';
  ov.innerHTML = `
    <div class="home-screen">
      <h1 class="home-title home-title-lg">BEN'S CASTLE DEFENSE</h1>
      <div class="home-sub home-sub-lg">Defend the castle. Survive the waves. Outsmart the horde.</div>
      ${profileLine}
      <div id="start-buttons-main" class="home-main-btns"></div>
      <div id="start-buttons-secondary" class="home-secondary-row"></div>
      <button class="how-to-btn" onclick="toggleTutorial()">HOW TO PLAY</button>
      <button class="how-to-btn" onclick="replayTutorial()" style="margin-top:2px">REPLAY INTERACTIVE TUTORIAL</button>
      <div class="tut-steps" id="tut-steps" style="display:none">${TUT_STEPS_HTML}</div>
      <div class="home-hints">
        <span><kbd>1&ndash;8</kbd> towers</span>
        <span><kbd>Q&ndash;R</kbd> walls</span>
        <span><kbd>Space</kbd> send wave</span>
        <span><kbd>P</kbd> pause</span>
        <span><kbd>X</kbd> sell mode</span>
      </div>
    </div>
  `;
  refreshStartScreenButtons();
  startHomeMusic();
}


// ===== FIRST-RUN TUTORIAL (interactive coach marks) =====
// Steps advance on what the player actually DOES, not on timers — so a kid who
// already figured it out is never held up, and one who is stuck always sees the target.
const TUTORIAL_STEPS = [
  { id:'welcome', title:'DEFEND THE CASTLE', text:'Waves of monsters march down the <b>dirt road</b> toward your castle on the right. Build towers beside the road to stop them.', target:null, advance:'button' },
  { id:'pick',    title:'PICK A TOWER',      text:'Tap the <b>Arrow</b> tower at the bottom. It is cheap, fast, and good against everything.', target:'#tower-bar', advance:'select', wait:'Pick a tower to continue' },
  { id:'place',   title:'PLACE IT',          text:'Now click any <b>green tile</b> next to the road. Towers only shoot what walks past, so hug the path.', target:'#c', advance:'place', wait:'Place your tower to continue' },
  { id:'send',    title:'SEND THE WAVE',     text:'Ready? Hit <b>SEND WAVE</b> (or press Space). Your towers fire on their own — just watch.', target:'#send-wave-btn', advance:'send', wait:'Send the wave to continue' },
  { id:'kill',    title:'GOLD AND STARS',    text:'Every kill drops <b>gold</b> to build more towers, and <b>XP</b> toward upgrade stars. Keep the road covered.', target:null, advance:'kill' },
  { id:'upgrade', title:'UPGRADE A TOWER',   text:'Kills earn <b>upgrade stars</b> (watch the XP bar). Once you have one, click a tower you already built — every tower unlocks a brand-new attack at Lv.2.', target:'#c', advance:'upgrade', wait:'Upgrade a tower to finish' },
  { id:'done',    title:'YOU ARE READY',     text:'Hearts are lives — lose them all and the run ends. Survive <b>15 waves</b> to clear a world and face its <b>boss</b>. Good luck!', target:null, advance:'button' },
];
let tutorial = null;
let pendingTutorialReplay = false;

// Home-screen entry point: start a brand-new run with the coach marks forced on
function replayTutorial() {
  pendingTutorialReplay = true;
  startGame(false);
}

// Whether a brand-new run should be coached. The caller decides "is this a fresh
// run" (startGame only calls us when there was no save to resume) — checking for a
// save here would misfire, since updateUI() writes one before we ever get called.
function tutorialShouldRun() {
  if (profile.stats.gamesPlayed) return false;      // they've played before
  if (profile.tutorialDone) return false;
  return true;
}

function tutorialStart(force) {
  if (!force && !tutorialShouldRun()) return;
  tutorial = { idx: 0 };
  document.getElementById('coach').classList.add('show');
  tutorialRender();
}

function tutorialStop(skipped) {
  tutorial = null;
  document.getElementById('coach').classList.remove('show');
  profile.tutorialDone = true;
  saveProfile();
  if (skipped) showFlash('Tutorial skipped — replay it any time from HOW TO PLAY');
}

function tutorialNext() {
  if (!tutorial) return;
  tutorial.idx++;
  if (tutorial.idx >= TUTORIAL_STEPS.length) { tutorialStop(false); return; }
  tutorialRender();
}

// Called from gameplay when the player does something the tutorial is waiting on
function tutorialEvent(kind) {
  if (!tutorial) return;
  const step = TUTORIAL_STEPS[tutorial.idx];
  if (step && step.advance === kind) tutorialNext();
}

function tutorialRender() {
  if (!tutorial) return;
  const step = TUTORIAL_STEPS[tutorial.idx];
  if (!step) { tutorialStop(false); return; }
  document.getElementById('coach-step').textContent = `Step ${tutorial.idx + 1} of ${TUTORIAL_STEPS.length}`;
  document.getElementById('coach-title').textContent = step.title;
  document.getElementById('coach-text').innerHTML = step.text;

  // Button steps advance on click; action steps wait for the player to act
  const isButtonStep = step.advance === 'button';
  document.getElementById('coach-next').style.display = isButtonStep ? '' : 'none';
  const waitEl = document.getElementById('coach-wait');
  waitEl.style.display = isButtonStep ? 'none' : '';
  waitEl.textContent = step.wait || '';

  const spot = document.getElementById('coach-spot');
  const box = document.getElementById('coach-box');
  const target = step.target ? document.querySelector(step.target) : null;
  const visible = target && target.offsetParent !== null;

  if (visible) {
    const r = target.getBoundingClientRect();
    const pad = step.target === '#c' ? -Math.min(r.width, r.height) * 0.22 : 8;
    spot.style.display = '';
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';
    // Put the message where it won't cover the thing it points at
    const boxH = box.offsetHeight || 150;
    const above = r.top > boxH + 30;
    box.style.left = Math.max(12, Math.min(window.innerWidth - 342, r.left + r.width / 2 - 165)) + 'px';
    box.style.top = (above ? r.top - boxH - 18 : Math.min(window.innerHeight - boxH - 12, r.bottom + 18)) + 'px';
  } else {
    spot.style.display = 'none';
    box.style.left = 'calc(50% - 165px)';
    box.style.top = '58%';
  }
}
window.addEventListener('resize', () => { if (tutorial) tutorialRender(); });

function toggleTutorial() {
  const el = document.getElementById('tut-steps');
  if (!el) return;
  el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

function returnToMenu() {
  if (game) game.running = false;
  for (const id of ['send-wave-btn', 'auto-wave-btn', 'speed-btn', 'hint', 'pause-toggle-btn']) {
    document.getElementById(id).style.display = 'none';
  }
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('coach').classList.remove('show');
  tutorial = null;
  document.getElementById('merchant').classList.remove('show');
  document.getElementById('guardian').classList.remove('show');
  document.getElementById('overlay').style.display = 'flex';
  renderHomeScreen();
}


// ===== DAILY CHALLENGE =====
const DAILY_BEST_KEY = 'castleDefenseDailyBest';
let dailyDefaultConfigActive = false;

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function getDailySeed() { return hashStr(todayStr()); }

function getDailyBest() {
  try { return JSON.parse(localStorage.getItem(DAILY_BEST_KEY)) || { best: 0 }; } catch (e) { return { best: 0 }; }
}
function saveDailyBest(score) {
  const cur = getDailyBest();
  if (score > (cur.best || 0)) {
    try { localStorage.setItem(DAILY_BEST_KEY, JSON.stringify({ best: score, date: todayStr() })); } catch (e) {}
    return true;
  }
  return false;
}

// Reset difficulty/tower/enemy numbers to the shipped defaults, bypassing any admin-panel overrides,
// so every player faces the same Daily Challenge. Restored via restoreConfigAfterDaily().
function applyDefaultConfigForDaily() {
  Object.assign(DIFFICULTY, DEFAULT_DIFFICULTY);
  for (const t of TOWER_TYPES) { const d = DEFAULT_TOWERS.find(x => x.id === t.id); if (d) { t.cost = d.cost; t.range = d.range; t.rate = d.rate; t.dmg = d.dmg; t.ammo = d.ammo; t.reload = d.reload; } }
  for (const e of ENEMY_DEFS) { const d = DEFAULT_ENEMIES.find(x => x.id === e.id); if (d) Object.assign(e, d); }
  for (const w of WALL_TYPES) { const d = DEFAULT_WALLS.find(x => x.id === w.id); if (d) { w.cost = d.cost; w.hp = d.hp; } }
  dailyDefaultConfigActive = true;
}
function restoreConfigAfterDaily() {
  if (!dailyDefaultConfigActive) return;
  loadConfigOverrides(); // re-applies whatever admin config is saved, on top of the restored defaults
  dailyDefaultConfigActive = false;
}

// Does NOT touch the normal "continue" save (unlike startGame) — the Daily Challenge is a separate mode.
function startDailyChallenge() {
  applyDefaultConfigForDaily();
  clearRunModifiers(); // the Daily Challenge never carries run modifiers
  game = initGame();
  game.dailyChallenge = true;
  const seed = getDailySeed();
  game.dailySeed = seed;
  game.hp = 3;
  game.gold = 100;
  game.forcedThemeIdx = seed % WORLD_THEMES.length;
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
  awBtn.textContent = 'AUTO-WAVE: OFF';
  awBtn.classList.remove('on');
  document.getElementById('speed-btn').style.display = 'block';
  document.getElementById('pause-toggle-btn').style.display = 'flex';
  updateSpeedBtn();
  buildTowerBar();
  stopHomeMusic();
  startMusic();
  updateUI();
  resize();
  render();
  requestAnimationFrame(loop);
  showFlash(`🗓️ Daily Challenge — seed ${todayStr()} — survive as many waves as you can!`);
}


// ===== TOWER CUSTOMIZATION SCREEN =====
function openCustomizeScreen() {
  buildCustomizeForm();
  document.getElementById('customize-panel').classList.add('show');
}
function closeCustomizeScreen() {
  document.getElementById('customize-panel').classList.remove('show');
}
function buildCustomizeForm() {
  const wrap = document.getElementById('customize-body');
  wrap.innerHTML = '';
  for (const t of TOWER_TYPES) {
    if (t.secret) continue;
    const opts = TOWER_SKIN_OPTIONS[t.id];
    if (!opts) continue;
    const curSel = skinSelections[t.id] || 'default';
    const card = document.createElement('div');
    card.className = 'cust-tower-card';
    const statsLine = t.income
      ? `Cost ${t.cost}g &middot; income tower`
      : `Cost ${t.cost}g &middot; Dmg ${t.dmg} &middot; Range ${t.range} &middot; Rate ${t.rate}s`;
    card.innerHTML = `<div class="cust-tower-name">${t.name}</div><div class="cust-tower-stats" style="font-size:11px;color:var(--parchment-dim);margin:-6px 0 10px;">${statsLine}</div><div class="cust-skin-row"></div>`;
    wrap.appendChild(card);
    const row = card.querySelector('.cust-skin-row');
    const drawFn = TOWER_SPRITES[t.id];
    opts.forEach(opt => {
      const unlocked = isSkinUnlocked(opt.id);
      const box = document.createElement('div');
      box.className = 'cust-skin-opt' + (opt.id === curSel ? ' selected' : '') + (unlocked ? '' : ' locked');
      const label = unlocked ? opt.name : `${ACH_LOCK_SVG.replace('width="14" height="14"', 'width="9" height="9"')} ${opt.name}`;
      const swatchColor = opt.color || 'var(--border-brass)';
      box.style.cssText = `border-left: 4px solid ${swatchColor}; min-width: 110px;` + (opt.id === curSel ? ` box-shadow: 0 0 18px ${swatchColor}44;` : '');
      box.innerHTML = `<canvas width="96" height="96"></canvas><div class="cust-skin-label">${label}</div><div class="cust-skin-desc" style="font-size:9.5px;color:var(--parchment-dim);opacity:0.8;text-align:center;">${opt.id === 'default' ? 'original colors' : 'tinted skin'}</div>`;
      if (!unlocked && SKIN_UNLOCKS[opt.id]) box.title = 'Locked — ' + SKIN_UNLOCKS[opt.id].desc;
      const cvEl = box.querySelector('canvas');
      const cv = cvEl.getContext('2d');
      cv.save();
      cv.translate(24, 20);
      if (drawFn) drawFn(cv, 0.8 * 1.5);
      cv.restore();
      if (opt.id !== 'default') {
        cv.save();
        cv.globalCompositeOperation = 'source-atop';
        cv.globalAlpha = 0.5;
        cv.fillStyle = opt.color;
        cv.fillRect(0, 0, 96, 96);
        cv.restore();
      }
      box.addEventListener('click', () => {
        if (!isSkinUnlocked(opt.id)) {
          SFX.play('error');
          notify('warning', `Locked — ${SKIN_UNLOCKS[opt.id] ? SKIN_UNLOCKS[opt.id].desc : 'keep playing to unlock'}`);
          return;
        }
        setTowerSkin(t.id, opt.id);
        buildCustomizeForm();
      });
      row.appendChild(box);
    });
  }
}


// ===== ACHIEVEMENT GALLERY SCREEN =====
const ACH_TROPHY_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2h3v4c0 2.2-1.8 4-4 4h-.4A6 6 0 0 1 13 16.9V19h4v2H7v-2h4v-2.1A6 6 0 0 1 6.4 13H6c-2.2 0-4-1.8-4-4V5h3V3zm-1 4v2c0 1.1.9 2 2 2V7H4zm16 0h-2v4c1.1 0 2-.9 2-2V7z"/></svg>';
const ACH_LOCK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/></svg>';

function openAchievementsScreen() {
  buildLeaderboard();
  buildAchievementsList();
  document.getElementById('achievements-panel').classList.add('show');
}
function closeAchievementsScreen() {
  document.getElementById('achievements-panel').classList.remove('show');
}
// Which board the Hall of Fame screen is showing
let lbView = 'local';      // 'local' | 'global'
let lbPeriod = 'all';      // 'today' | 'week' | 'all'

function buildLeaderboard() {
  const tabs = document.getElementById('lb-tabs');
  tabs.innerHTML = '';
  const mk = (label, active, onClick) => {
    const b = document.createElement('button');
    b.className = 'lb-tab' + (active ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  tabs.appendChild(mk('YOUR BEST RUNS', lbView === 'local', () => { lbView = 'local'; buildLeaderboard(); }));
  tabs.appendChild(mk('GLOBAL', lbView === 'global', () => { lbView = 'global'; buildLeaderboard(); }));
  if (lbView === 'local') buildHallOfFame();
  else buildGlobalBoard();
}

function buildHallOfFame() {
  const body = document.getElementById('hof-body');
  const list = loadHallOfFame();
  if (!list.length) {
    body.innerHTML = '<div class="hof-empty">No runs recorded yet — play a game and your best attempts land here.</div>';
    return;
  }
  body.innerHTML = '';
  list.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'hof-row' + (i === 0 ? ' top' : '');
    row.innerHTML = `<div class="hof-rank">#${i + 1}</div>
      <div class="hof-score">${r.score} <span>waves</span></div>
      <div class="hof-meta">
        <span>World ${r.world}, Wave ${r.wave}</span>
        <span>${(r.kills || 0).toLocaleString()} kills</span>
        <span>${r.towers || 0} towers</span>
        ${r.bosses ? `<span>${r.bosses} boss${r.bosses > 1 ? 'es' : ''}</span>` : ''}
        ${r.mode === 'daily' ? '<span class="hof-tag">Daily</span>' : ''}
      </div>
      <div class="hof-date">${r.date || ''}</div>`;
    renderModifierChips(row, r);
    body.appendChild(row);
  });
}

async function buildGlobalBoard() {
  const body = document.getElementById('hof-body');
  const id = getPlayerIdentity();

  if (!leaderboardEnabled()) {
    body.innerHTML = `<div class="lb-note">
      The global leaderboard is <b>not switched on yet</b>. It needs a small server —
      the whole thing (a Cloudflare Worker plus its database) is in the
      <code>server/</code> folder of this project, with a five-minute setup guide.
      Once it's deployed, paste the URL into <code>LEADERBOARD_API</code> in
      <code>index.html</code> and this tab fills up.<br><br>
      Your runs are still being saved locally under <b>YOUR BEST RUNS</b>.
    </div>`;
    return;
  }

  // Period picker + your identity card, then the rows
  body.innerHTML = `
    <div class="lb-periods">
      ${['today', 'week', 'all'].map(p =>
        `<button class="lb-period ${p === lbPeriod ? 'on' : ''}" data-p="${p}">${
          p === 'today' ? 'TODAY' : p === 'week' ? 'THIS WEEK' : 'ALL TIME'}</button>`).join('')}
    </div>
    <div class="lb-you">
      You play as <b>${codenameOf(id)}</b>
      <span id="lb-you-rank"></span>
      <button class="lb-reroll" onclick="rerollCodename()">NEW NAME</button>
    </div>
    <div id="lb-rows"><div class="hof-empty">Loading the global board…</div></div>`;
  body.querySelectorAll('.lb-period').forEach(b =>
    b.addEventListener('click', () => { lbPeriod = b.dataset.p; buildGlobalBoard(); }));

  const data = await fetchLeaderboard(lbPeriod, 'run');
  const rows = document.getElementById('lb-rows');
  if (!rows) return; // screen closed while we were waiting
  if (!data) {
    rows.innerHTML = '<div class="hof-empty">Could not reach the leaderboard right now. Your runs are safe locally — try again in a bit.</div>';
    return;
  }
  const rankEl = document.getElementById('lb-you-rank');
  if (rankEl && data.you) rankEl.textContent = `· your best here: ${Number(data.you.score) || 0} waves (#${Number(data.you.rank) || 0})`;

  if (!data.entries.length) {
    rows.innerHTML = '<div class="hof-empty">Nobody has posted a score for this period yet. Be the first.</div>';
    return;
  }
  rows.innerHTML = '';
  const n = (v) => Number(v) || 0; // never interpolate raw server values into markup
  for (const e of data.entries) {
    const rank = n(e.rank), bosses = n(e.bosses);
    const row = document.createElement('div');
    row.className = 'hof-row' + (rank === 1 ? ' top' : '') + (e.you ? ' you' : '');
    row.innerHTML = `<div class="hof-rank">#${rank}</div>
      <div class="hof-score">${n(e.score)} <span>waves</span></div>
      <div class="hof-meta">
        <span class="lb-name"></span>
        <span>World ${n(e.world)}, Wave ${n(e.wave)}</span>
        <span>${n(e.kills).toLocaleString()} kills</span>
        ${bosses ? `<span>${bosses} boss${bosses > 1 ? 'es' : ''}</span>` : ''}
      </div>`;
    // Names come from the server — render as text, never as markup
    row.querySelector('.lb-name').textContent = e.name + (e.you ? ' (you)' : '');
    rows.appendChild(row);
  }
  const foot = document.createElement('div');
  foot.className = 'lb-note';
  foot.style.marginTop = '12px';
  const players = Number(data.players) || 0;
  foot.textContent = `${players.toLocaleString()} player${players === 1 ? '' : 's'} on this board.`;
  rows.appendChild(foot);
}

function buildAchievementsList() {
  const body = document.getElementById('achievements-body');
  const defs = [...ACHIEVEMENT_DEFS];
  // One trophy per boss, so the road ahead is visible while still locked.
  // Built here rather than in ACHIEVEMENT_DEFS because BOSS_DEFS is declared later in the file.
  for (const b of BOSS_DEFS) {
    defs.push({ name: 'Slayer of ' + titleCase(b.name), desc: `Defeat ${b.name}, ${b.title} — guardian of the final wave of its world` });
  }
  // Achievements earned beyond the canonical list (e.g. deep endless worlds) still show up
  for (const name in profile.achievements) {
    if (!defs.some(d => d.name === name)) defs.push({ name, desc: profile.achievements[name].sub || '' });
  }
  let unlockedCount = 0;
  body.innerHTML = '';
  for (const d of defs) {
    const earned = profile.achievements[d.name];
    if (earned) unlockedCount++;
    const card = document.createElement('div');
    card.className = 'ach-card ' + (earned ? 'unlocked' : 'locked');
    const title = (earned || !d.secret) ? d.name : '???';
    const desc = earned
      ? (earned.sub || d.desc || 'Unlocked!')
      : (d.secret ? 'A secret waits to be discovered. Keep experimenting...' : d.desc);
    card.innerHTML = `<div class="ach-icon">${earned ? ACH_TROPHY_SVG : ACH_LOCK_SVG}</div>
      <div><div class="ach-name"></div><div class="ach-desc"></div></div>
      ${earned && earned.date ? `<div class="ach-date">${earned.date}</div>` : ''}`;
    card.querySelector('.ach-name').textContent = title;
    card.querySelector('.ach-desc').textContent = desc;
    body.appendChild(card);
  }
  const bossLine = profile.stats.bossesSlain ? ` · ${profile.stats.bossesSlain} bosses slain` : '';
  document.getElementById('ach-progress').textContent =
    `${unlockedCount} of ${defs.length} achievements · ${(profile.stats.totalKills || 0).toLocaleString()} lifetime kills · ${(profile.stats.wavesCleared || 0).toLocaleString()} waves cleared${bossLine}`;
}


// ===== SHARE A RUN =====
const GAME_URL = 'https://bnjmnsmmr.github.io/castledefense/';
function buildShareText() {
  if (!game) return '';
  const score = (game.world - 1) * DIFFICULTY.wavesPerWorld + game.wave;
  const bits = [`I survived ${score} waves (World ${game.world}, Wave ${game.wave})`,
                `slew ${game.kills} monsters`];
  if (game.bossesSlain) bits.push(`and felled ${game.bossesSlain} boss${game.bossesSlain > 1 ? 'es' : ''}`);
  return `Ben's Castle Defense — ${bits.join(', ')}. Can you beat that?\n${GAME_URL}`;
}
async function shareRun() {
  const text = buildShareText();
  const btn = document.getElementById('share-btn');
  const flash = (msg) => { if (btn) { const o = btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = o; }, 1800); } };
  try {
    if (navigator.share) {
      await navigator.share({ title: "Ben's Castle Defense", text, url: GAME_URL });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // user dismissed the sheet
  }
  try {
    await navigator.clipboard.writeText(text);
    flash('COPIED!');
  } catch (e) {
    flash('COPY FAILED');
  }
}
