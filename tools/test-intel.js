// Feature test for the next-wave intel panel. Run:
// NODE_PATH=<dir containing playwright-core> node tools/test-intel.js
const { withGame } = require('./smoke');

async function testIntel(page, errors) {
  // --- Wave 1: enemy composition should match getWave(1) exactly ---
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(300);

  const wave1 = await page.evaluate(() => {
    const expected = {};
    for (const w of getWave(1)) expected[w.type] = (expected[w.type] || 0) + 1;
    const panelShown = $id('wave-intel').style.display !== 'none';
    const items = [...document.querySelectorAll('#wi-icons .wi-icon-item:not(.wi-boss-icon)')];
    const shown = {};
    items.forEach(it => {
      const cnt = it.querySelector('.wi-count').textContent.replace('×', '');
      // Identify type by title (name is unique per type at wave 1's composition)
      shown[it.title] = parseInt(cnt, 10);
    });
    const expectedNames = {};
    for (const t in expected) expectedNames[ENEMY_NAMES[t]] = expected[t];
    return { panelShown, expectedTotal: Object.values(expected).reduce((a, b) => a + b, 0), shownTotal: Object.values(shown).reduce((a, b) => a + b, 0), expectedNames, shown };
  });
  console.log('wave1', JSON.stringify(wave1));
  if (!wave1.panelShown) throw new Error('intel panel not shown during prep phase');
  if (wave1.expectedTotal !== wave1.shownTotal) throw new Error(`wave1 enemy count mismatch: expected ${wave1.expectedTotal}, shown ${wave1.shownTotal}`);
  for (const name in wave1.expectedNames) {
    if (wave1.shown[name] !== wave1.expectedNames[name]) {
      throw new Error(`wave1 count for ${name}: expected ${wave1.expectedNames[name]}, shown ${wave1.shown[name]}`);
    }
  }

  // --- Fast-forward to wave 4 (lane warning: "North pass" unlocks at wave 4) ---
  const atWave4 = await page.evaluate(() => {
    game.wave = 3; game.hp = game.hp; // ensure a clean starting point
    game.waveActive = false; game.enemies = []; game.gameOver = false;
    // Simulate clearing wave 3 by driving the same path update() uses: set wave and re-run the
    // prep-phase transition logic via the real hook so activePaths/newPathUnlocked stay correct.
    game.wave = 4;
    game.activePaths = getActivePaths(4);
    pathSet = buildPathSet(4);
    game.prepPhase = true;
    updateWaveIntel();
    const lanes = [...document.querySelectorAll('#wi-lanes .wi-lane')].map(c => ({ text: c.textContent, active: c.classList.contains('active'), newRoute: c.classList.contains('new-route') }));
    return { wave: game.wave, lanes };
  });
  console.log('wave4 lanes', JSON.stringify(atWave4));
  const newRouteChip = atWave4.lanes.find(l => l.newRoute);
  if (!newRouteChip) throw new Error('expected a NEW ROUTE lane chip at wave 4');
  if (!newRouteChip.text.includes('North pass')) throw new Error(`expected new route to be North pass, got ${newRouteChip.text}`);
  const activeCount = atWave4.lanes.filter(l => l.active).length;
  if (activeCount !== 2) throw new Error(`expected 2 active lanes at wave 4, got ${activeCount}`);

  // --- Wave 15: boss warning ---
  const atWave15 = await page.evaluate(() => {
    game.wave = 15;
    game.dailyChallenge = false;
    game.activePaths = getActivePaths(15);
    pathSet = buildPathSet(15);
    game.prepPhase = true;
    updateWaveIntel();
    const bossEl = $id('wi-boss');
    const bd = getBossForWorld(game.world);
    return { shown: bossEl.style.display !== 'none', text: bossEl.textContent, bossName: bd.name };
  });
  console.log('wave15 boss', JSON.stringify(atWave15));
  if (!atWave15.shown) throw new Error('expected boss warning to be visible on wave 15');
  if (!atWave15.text.includes(atWave15.bossName)) throw new Error(`expected boss warning to name ${atWave15.bossName}, got "${atWave15.text}"`);

  // --- Collapse toggle persists to localStorage ---
  const collapse = await page.evaluate(() => {
    const before = localStorage.getItem('castleDefenseIntelCollapsed');
    document.getElementById('wi-header').click();
    const after = localStorage.getItem('castleDefenseIntelCollapsed');
    const collapsedClass = document.getElementById('wave-intel').classList.contains('collapsed');
    document.getElementById('wi-header').click(); // restore
    return { before, after, collapsedClass };
  });
  console.log('collapse', JSON.stringify(collapse));
  if (collapse.after === collapse.before) throw new Error('collapse toggle did not change localStorage state');

  // --- Sending the wave hides the panel ---
  const afterSend = await page.evaluate(() => {
    game.wave = 4;
    game.prepPhase = true;
    updateWaveIntel();
    const shownBefore = $id('wave-intel').style.display !== 'none';
    sendWave();
    const shownAfter = $id('wave-intel').style.display !== 'none';
    return { shownBefore, shownAfter };
  });
  console.log('afterSend', JSON.stringify(afterSend));
  if (!afterSend.shownBefore) throw new Error('panel should be visible before sendWave()');
  if (afterSend.shownAfter) throw new Error('panel should hide after sendWave()');
}

withGame(testIntel, { width: 1280, height: 760 }).then(errors => {
  console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'TEST-INTEL OK — 0 page errors');
  process.exit(errors.length ? 1 : 0);
}).catch(e => { console.error('TEST-INTEL FAILED', e.message); process.exit(1); });
