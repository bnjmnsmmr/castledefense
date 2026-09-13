// Feature test for Run Modifiers. Toggles two modifiers (No Walls + Iron Castle) in the
// panel, starts a new run, asserts their effects landed, ends the run, and asserts the
// Hall of Fame entry carries the modifier list and multiplier.
// Run: NODE_PATH=<dir containing playwright-core> node tools/test-modifiers.js
const { withGame } = require('./smoke');

async function run(page) {
  // Start clean: no saved run, no prior modifier selection.
  await page.evaluate(() => {
    try { localStorage.removeItem('castleDefenseModifiers'); } catch (e) {}
    clearGameState();
  });

  // Open the panel and toggle two modifiers exactly as a player would (click the cards).
  const panelState = await page.evaluate(() => {
    openModifiersPanel();
    const cards = [...document.querySelectorAll('#modifiers-body .mod-card')];
    const byName = n => cards.find(c => c.querySelector('.mod-card-name').textContent === n);
    byName('No Walls').click();
    byName('Iron Castle').click();
    const total = document.getElementById('modifiers-total').textContent;
    const onCount = document.querySelectorAll('#modifiers-body .mod-card.on').length;
    const stored = JSON.parse(localStorage.getItem('castleDefenseModifiers'));
    closeModifiersPanel();
    return { total, onCount, stored, panelShown: document.getElementById('modifiers-panel').classList.contains('show') };
  });
  console.log('panel', JSON.stringify(panelState));
  if (panelState.onCount !== 2) throw new Error('expected 2 modifier cards toggled on, got ' + panelState.onCount);
  if (!panelState.stored || panelState.stored.length !== 2) throw new Error('selection not persisted to localStorage');
  if (panelState.panelShown) throw new Error('panel should be closed');

  // Home screen should reflect the selection: a chip row + a MODIFIERS link showing the multiplier.
  const homeUi = await page.evaluate(() => {
    renderHomeScreen();
    const chipRow = document.getElementById('modifiers-chip-row');
    const link = [...document.querySelectorAll('#start-buttons-secondary .home-link-btn')].find(b => b.textContent.includes('MODIFIERS'));
    return { chips: chipRow ? chipRow.textContent : null, linkText: link ? link.textContent : null };
  });
  console.log('homeUi', JSON.stringify(homeUi));
  if (!homeUi.chips || !homeUi.chips.includes('No Walls') || !homeUi.chips.includes('Iron Castle')) throw new Error('home chip row missing selected modifiers');
  if (!homeUi.linkText || !homeUi.linkText.includes('MODIFIERS')) throw new Error('home MODIFIERS link missing');

  // Start a brand-new run: modifiers should now be baked into game state.
  const runState = await page.evaluate(() => {
    startGame(false);
    return {
      hp: game.hp, modifiers: game.modifiers, scoreMult: game.scoreMult,
      wallsTabDisplay: document.getElementById('tab-walls').style.display,
      canPlaceWall: canPlaceWall(14, 8), // a path tile
    };
  });
  console.log('runState', JSON.stringify(runState));
  if (runState.hp !== 5) throw new Error('expected iron_castle to set hp=5, got ' + runState.hp);
  if (!runState.modifiers || runState.modifiers.length !== 2) throw new Error('game.modifiers not populated');
  if (!(runState.scoreMult > 1.4 && runState.scoreMult < 1.45)) throw new Error('unexpected scoreMult ' + runState.scoreMult);
  if (runState.wallsTabDisplay !== 'none') throw new Error('walls tab should be hidden under no_walls');
  if (!runState.canPlaceWall) throw new Error('canPlaceWall should be blocked under no_walls');

  // A resumed run must keep the same modifiers (not re-roll from the current selection).
  await page.evaluate(() => { saveGameState(); });
  const resumed = await page.evaluate(() => {
    localStorage.setItem('castleDefenseModifiers', JSON.stringify([])); // change the pending selection...
    startGame(true); // ...resume should ignore it and keep the run's own saved modifiers
    return { modifiers: game.modifiers, hp: game.hp };
  });
  console.log('resumed', JSON.stringify(resumed));
  if (resumed.modifiers.length !== 2) throw new Error('resume should keep the run\'s original modifiers');

  // End the game and check the Hall of Fame + results screen picked up the modifiers.
  const ended = await page.evaluate(() => {
    endGame();
    const hof = JSON.parse(localStorage.getItem('castleDefenseHallOfFame'))[0];
    const modChips = document.querySelectorAll('#hof-body .hof-tag'); // not built yet (achievements screen not open)
    openAchievementsScreen();
    const chipsAfterOpen = document.querySelectorAll('#hof-body .hof-tag').length;
    const resultCard = [...document.querySelectorAll('#overlay .go-stat')].find(c => c.textContent.includes('Modifiers'));
    return { hofEntry: hof, chipsAfterOpen, resultCardText: resultCard ? resultCard.textContent : null };
  });
  console.log('ended', JSON.stringify(ended));
  if (!ended.hofEntry || !ended.hofEntry.modifiers || ended.hofEntry.modifiers.length !== 2) throw new Error('Hall of Fame entry missing modifiers');
  if (!(ended.hofEntry.scoreMult > 1.4)) throw new Error('Hall of Fame entry missing scoreMult');
  if (ended.chipsAfterOpen < 3) throw new Error('expected modifier + multiplier chips rendered in Hall of Fame row'); // 2 modifier chips + 1 mult chip
  if (!ended.resultCardText || !ended.resultCardText.includes('2')) throw new Error('results screen missing MODIFIERS stat card');
}

withGame(run).then(errors => {
  console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'TEST-MODIFIERS OK — no page errors');
  process.exit(errors.length ? 1 : 0);
}).catch(e => { console.error('TEST-MODIFIERS FAILED', e.message); process.exit(1); });
