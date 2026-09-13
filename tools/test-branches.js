// Feature test: tower specialization branches (js/feat-branches.js).
// Run: NODE_PATH=<dir containing playwright-core> node tools/test-branches.js
const { withGame, clickTile } = require('./smoke');

const TOWER_IDS = ['arrow', 'cannon', 'ice', 'sniper', 'tesla', 'flame', 'mortar', 'poison', 'goldmine'];

async function run(page) {
  await page.evaluate(() => { clearGameState(); startGame(false); game.gold = 5000; game.xp = 5000; });

  // Find N empty, buildable, non-path tiles to place one of every branch-eligible tower on.
  const freeTiles = await page.evaluate(n => {
    const out = [];
    for (let ty = 0; ty < ROWS && out.length < n; ty++) {
      for (let tx = 0; tx < COLS && out.length < n; tx++) {
        if (isPath(tx, ty) || isCastle(tx, ty)) continue;
        out.push({ tx, ty });
      }
    }
    return out;
  }, TOWER_IDS.length);
  if (freeTiles.length !== TOWER_IDS.length) throw new Error(`could not find ${TOWER_IDS.length} free tiles, got ${freeTiles.length}`);
  const TOWERS = TOWER_IDS.map((id, idx) => ({ idx, id, tx: freeTiles[idx].tx, ty: freeTiles[idx].ty }));

  // Place one of every branch-eligible tower, then push each to level 3 (opens the chooser
  // on the 3rd upgrade click) and pick branch index 0 on odd towers, index 1 on even ones.
  for (const t of TOWERS) {
    await page.evaluate(i => { game.selectedTower = i; }, t.idx);
    await clickTile(page, t.tx, t.ty, 1);
  }
  const placed = await page.evaluate(() => game.towers.length);
  console.log('placed towers', placed);
  if (placed !== TOWERS.length) throw new Error(`expected ${TOWERS.length} towers, got ${placed}`);

  for (let i = 0; i < TOWERS.length; i++) {
    const t = TOWERS[i];
    // Level 1, level 2: plain upgrade clicks (no chooser yet)
    await clickTile(page, t.tx, t.ty, 1);
    await clickTile(page, t.tx, t.ty, 1);
    const midLevel = await page.evaluate(tx => game.towers.find(tw => tw.tx === tx).level, t.tx);
    if (midLevel !== 2) throw new Error(`${t.id}: expected level 2 before branch choice, got ${midLevel}`);

    // Level 3 click opens the chooser instead of applying immediately
    await clickTile(page, t.tx, t.ty, 1);
    const chooserOpen = await page.evaluate(() => ({
      show: document.getElementById('branch-chooser').classList.contains('show'),
      paused: game.paused,
    }));
    if (!chooserOpen.show || !chooserOpen.paused) throw new Error(`${t.id}: branch chooser did not open (show=${chooserOpen.show}, paused=${chooserOpen.paused})`);
    const stillLevel2 = await page.evaluate(tx => game.towers.find(tw => tw.tx === tx).level, t.tx);
    if (stillLevel2 !== 2) throw new Error(`${t.id}: level advanced before a branch was picked`);

    // Pick a branch via the keyboard (1 or 2), matching the "1/2 to pick" UI contract
    await page.keyboard.press(i % 2 === 0 ? '1' : '2');
    const after = await page.evaluate(tx => {
      const tw = game.towers.find(x => x.tx === tx);
      return { level: tw.level, branch: tw.branch, paused: game.paused, chooserShown: document.getElementById('branch-chooser').classList.contains('show') };
    }, t.tx);
    if (after.level !== 3 || !after.branch) throw new Error(`${t.id}: branch pick did not apply (${JSON.stringify(after)})`);
    if (after.paused || after.chooserShown) throw new Error(`${t.id}: chooser/pause did not clear after picking`);
    console.log(t.id, 'branched into', after.branch);

    // Levels 4-5 should keep scaling normally (no chooser, branch stays put)
    await clickTile(page, t.tx, t.ty, 1);
    await clickTile(page, t.tx, t.ty, 1);
    const finalState = await page.evaluate(tx => {
      const tw = game.towers.find(x => x.tx === tx);
      return { level: tw.level, branch: tw.branch };
    }, t.tx);
    if (finalState.level !== 5) throw new Error(`${t.id}: expected level 5 after two more upgrades, got ${finalState.level}`);
    if (finalState.branch !== after.branch) throw new Error(`${t.id}: branch changed unexpectedly`);
  }

  const achieved = await page.evaluate(() => !!(game.achievements && game.achievements['Specialist']));
  console.log('Specialist achievement', achieved);
  if (!achieved) throw new Error('Specialist achievement did not unlock after 5+ branch picks');

  // Combat sanity: send a wave and confirm branched towers still damage enemies
  // (multishot/pierce arrow, headshot sniper, overcharge tesla, siege cannon, etc.)
  await page.evaluate(() => { sendWave(); game.speed = 3; });
  await page.waitForTimeout(6000);
  const combat = await page.evaluate(() => ({ kills: game.kills, hp: game.hp, gold: game.gold }));
  console.log('after combat', JSON.stringify(combat));
  if (combat.kills < 1) throw new Error('branched towers killed nothing');

  // Save/load round-trip: branch must survive a reload
  await page.evaluate(() => saveGameState());
  const savedBranches = await page.evaluate(() => JSON.parse(localStorage.getItem('castleDefenseSave')).towers.map(t => t.branch));
  console.log('saved branches', JSON.stringify(savedBranches));
  if (savedBranches.some(b => !b)) throw new Error('a branch was not persisted to the save');
  await page.evaluate(() => startGame(true));
  await page.waitForTimeout(200);
  const restored = await page.evaluate(() => game.towers.map(t => t.branch));
  console.log('restored branches', JSON.stringify(restored));
  if (restored.some(b => !b)) throw new Error('a branch was not restored from the save');

  // Esc defers the chooser without spending the point or changing level
  await page.evaluate(() => { game.gold = 5000; game.xp = 5000; game.selectedTower = 0; });
  await clickTile(page, 25, 3, 1); // fresh empty tile
  await clickTile(page, 25, 3, 1); // level 1
  await clickTile(page, 25, 3, 1); // level 2
  await clickTile(page, 25, 3, 1); // opens chooser
  await page.keyboard.press('Escape');
  const deferred = await page.evaluate(() => {
    const tw = game.towers.find(t => t.tx === 25 && t.ty === 3);
    return { level: tw.level, branch: tw.branch, chooserShown: document.getElementById('branch-chooser').classList.contains('show'), paused: game.paused };
  });
  console.log('deferred', JSON.stringify(deferred));
  if (deferred.level !== 2 || deferred.branch || deferred.chooserShown || deferred.paused) {
    throw new Error('Esc did not correctly defer the branch choice: ' + JSON.stringify(deferred));
  }
}

if (require.main === module) {
  withGame(run, { width: 1400 }).then(errors => {
    console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'BRANCH TEST OK — no page errors');
    process.exit(errors.length ? 1 : 0);
  }).catch(e => { console.error('BRANCH TEST FAILED', e.message); process.exit(1); });
}
