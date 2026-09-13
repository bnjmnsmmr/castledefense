// Feature test for structured endless storms (js/feat-storms.js).
// Run: NODE_PATH=<dir containing playwright-core> node tools/test-storms.js
const { withGame } = require('./smoke');

async function run(page) {
  // Boot a fresh game, then push it deep into endless territory: game.wave is the
  // per-world wave counter (resets at DIFFICULTY.wavesPerWorld), so we crank that limit
  // up so climbing past wave 30 doesn't roll over into a new world.
  await page.evaluate(() => {
    clearGameState();
    startGame(false);
    DIFFICULTY.wavesPerWorld = 200;
    game.runSeed = 424242;
    game.world = 1;
  });

  // --- 1. getWave(n) is deterministic for a fixed seed across n = 31..60 ---
  const gens = await page.evaluate(() => {
    const out = [];
    for (let n = 31; n <= 60; n++) {
      const a = getWave(n).map(w => ({ type: w.type, delay: Math.round(w.delay * 1000) }));
      const b = getWave(n).map(w => ({ type: w.type, delay: Math.round(w.delay * 1000) }));
      out.push({ n, a: JSON.stringify(a), b: JSON.stringify(b) });
    }
    return out;
  });
  for (const g of gens) {
    if (g.a !== g.b) throw new Error(`getWave(${g.n}) is not deterministic for a fixed seed`);
  }
  console.log(`getWave(31..60) deterministic: OK (${gens.length} waves checked)`);

  // Composition matches the active storm's theme (ignoring Plague's every-3rd wizard).
  const compCheck = await page.evaluate(() => {
    const bad = [];
    for (let n = 31; n <= 60; n++) {
      const storm = stormFor(n);
      const wave = getWave(n);
      const types = storm.theme.types;
      for (let i = 0; i < wave.length; i++) {
        const t = wave[i].type;
        const isPlagueWizard = storm.mutator.id === 'plague' && t === 5;
        if (!types.includes(t) && !isPlagueWizard) bad.push(`n=${n} type=${t} theme=${storm.theme.id}`);
      }
    }
    return bad;
  });
  if (compCheck.length) throw new Error('composition mismatch: ' + compCheck.slice(0, 5).join('; '));
  console.log('Composition matches storm theme: OK');

  // Storm 1 (waves 31-35) is always Swarm Storm + Fog.
  const storm1 = await page.evaluate(() => stormFor(31));
  if (storm1.theme.id !== 'swarm' || storm1.mutator.id !== 'fog') {
    throw new Error('Storm 1 should be Swarm Storm + Fog, got ' + JSON.stringify(storm1));
  }
  console.log('Storm 1 is Swarm Storm + Fog: OK');

  // A different runSeed changes later storms (but not storm 1, which is fixed).
  const seedCmp = await page.evaluate(() => {
    const before = JSON.stringify(stormFor(41));
    game.runSeed = 999999;
    const after = JSON.stringify(stormFor(41));
    game.runSeed = 424242;
    return { before, after };
  });
  console.log('Different seeds vary storm 2:', seedCmp.before !== seedCmp.after ? 'OK' : 'WARN (collided, rare but not impossible)');

  // --- 2. Mutator hooks respond to the active storm ---
  const hookCheck = await page.evaluate(() => {
    const res = {};
    // Find a wave whose storm mutator is 'fog' within our sampled range, else force wave 31.
    game.wave = 31; // storm 1: fog
    res.fogRange = stormRangeMult();
    res.fogTheme = activeStorm().mutator.id;
    game.wave = 1; // no storm active
    res.noStormRange = stormRangeMult();
    res.noStormHp = stormHpMult();
    res.noStormGold = stormGoldMult();
    res.noStormSpeed = stormSpeedMult();
    res.noStormWall = stormWallDmgMult();
    game.wave = 31;
    return res;
  });
  if (hookCheck.fogTheme !== 'fog' || hookCheck.fogRange !== 0.75) throw new Error('stormRangeMult should be 0.75 during Fog: ' + JSON.stringify(hookCheck));
  if (hookCheck.noStormRange !== 1 || hookCheck.noStormHp !== 1 || hookCheck.noStormGold !== 1 || hookCheck.noStormSpeed !== 1 || hookCheck.noStormWall !== 1) {
    throw new Error('mutator multipliers should all be 1 outside a storm: ' + JSON.stringify(hookCheck));
  }
  console.log('Mutator hooks (fog range, all-1 baseline): OK');

  // --- 3. Storm banner / chip on sendWave() at a storm boundary ---
  const bannerCheck = await page.evaluate(() => {
    game.wave = 31; // first wave of storm 1
    game.prepPhase = true;
    game.waveEnemies = [];
    sendWave();
    return {
      bannerTitle: document.getElementById('wave-banner-title').textContent,
      chipText: document.getElementById('storm-chip').textContent,
      chipVisible: document.getElementById('storm-chip').style.display !== 'none',
    };
  });
  if (!/STORM I/.test(bannerCheck.bannerTitle)) throw new Error('expected a STORM I banner, got: ' + bannerCheck.bannerTitle);
  if (!bannerCheck.chipVisible || !/SWARM STORM/.test(bannerCheck.chipText)) throw new Error('storm chip not showing theme: ' + JSON.stringify(bannerCheck));
  console.log('Storm banner + HUD chip on new storm: OK (' + bannerCheck.bannerTitle + ' / ' + bannerCheck.chipText + ')');

  // Chip clears once back below wave 31.
  const chipClears = await page.evaluate(() => {
    game.wave = 5;
    updateStormChip();
    return document.getElementById('storm-chip').style.display;
  });
  if (chipClears !== 'none') throw new Error('storm chip should hide outside a storm');
  console.log('Storm chip hides outside a storm: OK');

  // --- 4. Storm completion, score bonus, and the results-screen stat card ---
  const completion = await page.evaluate(() => {
    game.stormsSurvived = 0;
    game.stormMult = 1;
    game.world = 1; game.wave = 35; // last wave (offset 4) of storm 1
    checkStormComplete(35);
    const grid = document.createElement('div');
    grid.className = 'go-grid';
    renderStormStat(grid);
    return {
      stormsSurvived: game.stormsSurvived,
      stormMult: game.stormMult,
      bonus: stormScoreBonus(),
      cardHtml: grid.innerHTML,
    };
  });
  if (completion.stormsSurvived !== 1) throw new Error('checkStormComplete should credit a storm on its final wave');
  if (completion.stormMult <= 1) throw new Error('stormMult should exceed 1 after a storm');
  if (!/STORM BONUS/.test(completion.cardHtml)) throw new Error('renderStormStat did not append a STORM BONUS card');
  console.log('Storm completion + score bonus + stat card: OK (' + JSON.stringify({ stormsSurvived: completion.stormsSurvived, stormMult: completion.stormMult, bonus: completion.bonus }) + ')');

  // checkStormComplete must NOT fire on a non-final storm wave.
  const noFire = await page.evaluate(() => {
    game.stormsSurvived = 0;
    checkStormComplete(32); // offset 1, not the storm's last wave
    return game.stormsSurvived;
  });
  if (noFire !== 0) throw new Error('checkStormComplete should only fire on a storm\'s final wave');
  console.log('Storm completion only fires on the final wave of a storm: OK');

  // --- 5. Daily Challenge uses the daily seed, not runSeed ---
  const dailySeeded = await page.evaluate(() => {
    startDailyChallenge();
    game.wave = 41; // storm 2 — depends on the seed
    const a = JSON.stringify(stormFor(41));
    game.dailySeed = game.dailySeed + 12345; // simulate "a different day"
    const b = JSON.stringify(stormFor(41));
    return { usesDailySeed: game.dailyChallenge === true, a, b };
  });
  if (!dailySeeded.usesDailySeed) throw new Error('game.dailyChallenge should be true after startDailyChallenge()');
  console.log('Daily Challenge storms vary with dailySeed:', dailySeeded.a !== dailySeeded.b ? 'OK' : 'WARN (collided, rare but not impossible)');
}

if (require.main === module) {
  withGame(run).then(errors => {
    console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'TEST-STORMS OK — 0 page errors');
    process.exit(errors.length ? 1 : 0);
  }).catch(e => { console.error('TEST-STORMS FAILED', e.message); process.exit(1); });
}
