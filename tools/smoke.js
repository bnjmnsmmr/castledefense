// Headless smoke test. Serves the repo root on a free port, boots the game in
// Chromium, places two towers, sends a wave, exercises every screen, and fails
// on any page error. Run: NODE_PATH=<dir containing playwright-core> node tools/smoke.js
// Reusable from feature tests: const { withGame } = require('./tools/smoke');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Opens the game, runs fn(page, errors), closes everything. Returns collected errors.
async function withGame(fn, opts = {}) {
  const { chromium } = require('playwright-core');
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: opts.width || 1280, height: opts.height || 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/fonts\.g|ERR_CONNECTION|ERR_NAME|Failed to load resource/.test(t)) errors.push('CONSOLE: ' + t);
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await fn(page, errors);
  } finally {
    await browser.close(); srv.close();
  }
  return errors;
}

// Click a tile twice (the touch-style confirm also works with a mouse).
async function clickTile(page, tx, ty, times = 2) {
  await page.evaluate(([tx, ty, times]) => {
    const rect = C.getBoundingClientRect();
    const sx = rect.width / C.width, sy = rect.height / C.height;
    for (let i = 0; i < times; i++) C.dispatchEvent(new MouseEvent('click', { clientX: rect.left + (tx * 40 + 20) * sx, clientY: rect.top + (ty * 40 + 20) * sy, bubbles: true }));
  }, [tx, ty, times]);
}

async function baseline(page) {
  const boot = await page.evaluate(() => ({ towers: TOWER_TYPES.length, title: document.title }));
  console.log('boot', JSON.stringify(boot));
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { game.selectedTower = 0; });
  await clickTile(page, 4, 7); await clickTile(page, 9, 5);
  const placed = await page.evaluate(() => { sendWave(); game.speed = 3; return { towers: game.towers.length, gold: game.gold, waveActive: game.waveActive }; });
  console.log('placed', JSON.stringify(placed));
  if (placed.towers !== 2) throw new Error('expected 2 towers placed');
  await page.waitForTimeout(8000);
  const state = await page.evaluate(() => ({ wave: game.wave, kills: game.kills, hp: game.hp, enemies: game.enemies.length, gold: game.gold, prep: game.prepPhase }));
  console.log('after 8s', JSON.stringify(state));
  if (state.kills < 1) throw new Error('towers killed nothing');
  const screens = await page.evaluate(() => {
    const out = [];
    for (const f of ['togglePause', 'togglePause', 'openAchievementsScreen', 'closeAchievementsScreen', 'openCustomizeScreen', 'closeCustomizeScreen', 'openCommunityScreen', 'closeCommunityScreen', 'toggleAdminPanel', 'toggleAdminPanel', 'returnToMenu']) {
      try { window[f](); out.push(f); } catch (e) { out.push(f + ':ERR ' + e.message); }
    }
    return out;
  });
  console.log('screens', screens.join(' '));
  if (screens.some(s => s.includes(':ERR'))) throw new Error('screen threw');
  await page.waitForTimeout(300);
}

module.exports = { withGame, clickTile, serve };

if (require.main === module) {
  withGame(baseline).then(errors => {
    console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'SMOKE OK — no page errors');
    process.exit(errors.length ? 1 : 0);
  }).catch(e => { console.error('SMOKE FAILED', e.message); process.exit(1); });
}
