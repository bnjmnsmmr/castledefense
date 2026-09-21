// Feature test: relic draft between worlds. Run:
// NODE_PATH=<dir containing playwright-core> node tools/test-relics.js
const { withGame } = require('./smoke');

async function run(page) {
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(200);

  // Fresh run: no relics, tray hidden.
  const fresh = await page.evaluate(() => ({
    relics: game.relics, trayDisplay: document.getElementById('relic-tray').style.display,
  }));
  if (!Array.isArray(fresh.relics) || fresh.relics.length !== 0) throw new Error('expected game.relics to start empty, got ' + JSON.stringify(fresh.relics));
  console.log('fresh state', JSON.stringify(fresh));

  // Force a world clear without grinding 15 waves: jump straight to the last
  // wave of world 1 and let the normal wave-clear path fire the draft.
  const jumped = await page.evaluate(() => {
    game.wave = DIFFICULTY.wavesPerWorld;
    game.enemies = [];
    game.waveEnemies = [];
    game.waveSpawnIdx = 0;
    game.betweenWaves = false;
    game.prepPhase = false; // update() only runs outside prep
    game.waveStartHp = game.hp;
    game.waveActive = true; // satisfies the "wave complete" check on next update()
    return { wave: game.wave, world: game.world };
  });
  console.log('jumped to', JSON.stringify(jumped));

  // Drive a couple of frames so update() sees waveActive && no enemies -> wave clear.
  await page.evaluate(() => new Promise(res => { requestAnimationFrame(() => requestAnimationFrame(res)); }));
  await page.waitForTimeout(1600); // openRelicDraft() is scheduled 1200ms after the world banner

  const drafted = await page.evaluate(() => ({
    world: game.world,
    draftActive: game.relicDraftActive,
    offers: (game.relicDraftOffers || []).map(r => r.id),
    overlayShown: document.getElementById('relic-draft').classList.contains('show'),
    cardCount: document.querySelectorAll('.relic-card').length,
  }));
  console.log('drafted', JSON.stringify(drafted));
  if (!drafted.draftActive) throw new Error('expected relicDraftActive after world clear');
  if (drafted.offers.length !== 3) throw new Error('expected 3 relic offers, got ' + drafted.offers.length);
  if (!drafted.overlayShown || drafted.cardCount !== 3) throw new Error('expected the draft overlay to show 3 cards');

  // Sending the wave / pressing space while the draft is up must be swallowed.
  const blockedSend = await page.evaluate(() => { sendWave(); return game.prepPhase; });
  if (blockedSend !== true) throw new Error('sendWave() should be a no-op while the relic draft is open');

  // Pick relic #1 via the keyboard hotkey (also exercises the input-blocking listener).
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  const picked = await page.evaluate(() => ({
    relics: game.relics,
    draftActive: game.relicDraftActive,
    overlayShown: document.getElementById('relic-draft').classList.contains('show'),
    trayChips: document.querySelectorAll('#relic-tray .relic-chip').length,
    saved: JSON.parse(localStorage.getItem('castleDefenseSave') || '{}').relics,
  }));
  console.log('picked', JSON.stringify(picked));
  if (picked.relics.length !== 1) throw new Error('expected 1 relic picked, got ' + JSON.stringify(picked.relics));
  if (picked.draftActive) throw new Error('draft should be closed after picking');
  if (picked.overlayShown) throw new Error('overlay should be hidden after picking');
  if (picked.trayChips !== 1) throw new Error('expected 1 chip in the relic tray');
  if (!Array.isArray(picked.saved) || picked.saved.length !== 1) throw new Error('expected relics to persist in the save, got ' + JSON.stringify(picked.saved));

  // relicMult / hasRelic sanity: force-grant every relic and check the read helpers.
  const helperCheck = await page.evaluate(() => {
    game.relics = RELICS.map(r => r.id);
    const out = {
      treasuryGoldMult: relicMult('gold'),
      alchemistMult: relicMult('goldMine'),
      vanguardMult: relicMult('wallCost'),
      sellRate: getSellRefundRate(),
      hasFrostbite: hasRelic('frostbite'),
      hasNonsense: hasRelic('not_a_relic'),
    };
    return out;
  });
  console.log('helperCheck', JSON.stringify(helperCheck));
  if (helperCheck.treasuryGoldMult !== 1.1) throw new Error('treasury gold mult wrong: ' + helperCheck.treasuryGoldMult);
  if (helperCheck.alchemistMult !== 1.5) throw new Error('alchemist mult wrong');
  if (helperCheck.vanguardMult !== 0.7) throw new Error('vanguard mult wrong');
  if (helperCheck.sellRate !== 0.8) throw new Error('scrapper sell rate wrong');
  if (!helperCheck.hasFrostbite || helperCheck.hasNonsense) throw new Error('hasRelic() sanity check failed');

  // Collector achievement fires at 5 relics (already holds 15 from the block above,
  // but unlockAchievement was never triggered on that direct assignment — pick one
  // more through the real flow to confirm the threshold check itself works).
  const collectorCheck = await page.evaluate(() => {
    game.relics = ['frostbite', 'masons', 'quartermaster', 'sharpshooter'];
    game.achievements = {};
    game.relicDraftActive = true;
    game.relicDraftOffers = [{ id: 'treasury', name: 'Treasury', emoji: '💰', desc: 'x' }];
    pickRelic(0);
    return { relics: game.relics, collector: !!(game.achievements || {})['Collector'] };
  });
  console.log('collectorCheck', JSON.stringify(collectorCheck));
  if (collectorCheck.relics.length !== 5) throw new Error('expected 5 relics after pick');
  if (!collectorCheck.collector) throw new Error('expected Collector achievement to unlock at 5 relics');

  // Daily Challenge must never offer a draft.
  const dailySkip = await page.evaluate(() => {
    game.dailyChallenge = true;
    game.relicDraftActive = false;
    openRelicDraft();
    return game.relicDraftActive;
  });
  if (dailySkip) throw new Error('relic draft must not open during Daily Challenge');

  // Results screen renders relic chips.
  const resultsCheck = await page.evaluate(() => {
    game.dailyChallenge = false;
    game.relics = ['fortify', 'overclock'];
    endGame();
    const el = document.getElementById('go-relics');
    return { html: el ? el.innerHTML : null, chipCount: document.querySelectorAll('.go-relic-chip').length };
  });
  console.log('resultsCheck chipCount', resultsCheck.chipCount);
  if (!resultsCheck.html || resultsCheck.chipCount !== 2) throw new Error('expected 2 relic chips on the results screen, got ' + JSON.stringify(resultsCheck));
}

if (require.main === module) {
  withGame(run).then(errors => {
    console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'RELIC TEST OK — no page errors');
    process.exit(errors.length ? 1 : 0);
  }).catch(e => { console.error('RELIC TEST FAILED', e.message); process.exit(1); });
}
