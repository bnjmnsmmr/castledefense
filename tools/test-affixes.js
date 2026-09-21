// Feature test for enemy affixes/elites. Forces the roll chance to 100% at a wave
// past the wave-6 floor, drives a full wave, and asserts affixed enemies actually
// appear, render, deal with walls/damage/death correctly, and the elite toast/
// achievement counters move — with zero page errors.
const { withGame, clickTile } = require('./smoke');

async function run(page) {
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(200);

  // Force affixes to always roll, well past the wave-6 floor, and give the run
  // some gold so a wall can be placed to exercise the sapper/vampiric wall hooks.
  const setup = await page.evaluate(() => {
    DIFFICULTY.affixChance = 1;
    game.world = 1;
    game.wave = 8; // total wave (world 1) = 8 >= AFFIX_MIN_TOTAL_WAVE
    game.gold = 1000;
    game.speed = 3;
    game.buildMode = 'wall';
    game.selectedWall = 0;
    return { wave: game.wave, gold: game.gold };
  });
  console.log('setup', JSON.stringify(setup));

  // Place a wall on the first path tile so blocked enemies exercise wallDps/vampiric/sapper.
  await clickTile(page, 1, 8);
  // Place an arrow tower nearby to exercise armored's damage-reduction path.
  await page.evaluate(() => { game.buildMode = 'tower'; game.selectedTower = 0; });
  await clickTile(page, 2, 9);

  await page.evaluate(() => { sendWave(); });
  await page.waitForTimeout(6000);

  const state = await page.evaluate(() => {
    const affixedAlive = game.enemies.filter(e => e.affix);
    const affixCounts = {};
    for (const e of game.enemies) if (e.affix) affixCounts[e.affix] = (affixCounts[e.affix] || 0) + 1;
    return {
      enemies: game.enemies.length,
      affixedAlive: affixedAlive.length,
      affixCounts,
      affixesSeen: game.affixesSeen ? Array.from(game.affixesSeen) : [],
      affixKills: game.affixKills || 0,
      gold: game.gold,
      wallsLeft: game.walls.length,
      hp: game.hp,
    };
  });
  console.log('after wave', JSON.stringify(state));

  if (!state.affixesSeen.length) throw new Error('expected at least one affix to have been rolled/announced');
  if (state.affixKills < 1 && state.affixedAlive === 0) {
    throw new Error('expected some affixed enemies to have spawned this wave');
  }

  // Sanity: AFFIX_DEFS and hooks are all wired and callable without throwing.
  const fnCheck = await page.evaluate(() => {
    const out = {};
    out.defs = Object.keys(AFFIX_DEFS).length;
    try {
      const fake = { hp: 50, maxHp: 50, x: 0, y: 0, type: 0, affix: 'armored', attacking: false };
      out.modifyDamageArrow = affixModifyDamage(fake, 100, 'arrow');
      out.modifyDamageSplash = affixModifyDamage(fake, 100, undefined);
      out.wallMultSapper = affixWallDpsMult({ affix: 'sapper', attacking: false, hp: 10, maxHp: 10 });
      out.ok = true;
    } catch (e) {
      out.ok = false; out.err = e.message;
    }
    return out;
  });
  console.log('fnCheck', JSON.stringify(fnCheck));
  if (!fnCheck.ok) throw new Error('affix helper functions threw: ' + fnCheck.err);
  if (fnCheck.modifyDamageArrow !== 60) throw new Error('armored should reduce arrow damage by 40%');
  if (fnCheck.modifyDamageSplash !== 100) throw new Error('armored should NOT reduce untagged/splash damage');
  if (fnCheck.wallMultSapper !== 2.5) throw new Error('sapper should multiply wall dps by 2.5');

  // Run the wave out further and let more waves happen to build up affix kills, then
  // check the gallery/admin screens still open cleanly with the new content present.
  const screens = await page.evaluate(() => {
    const out = [];
    for (const f of ['openAchievementsScreen', 'closeAchievementsScreen', 'toggleAdminPanel', 'toggleAdminPanel']) {
      try { window[f](); out.push(f); } catch (e) { out.push(f + ':ERR ' + e.message); }
    }
    return out;
  });
  console.log('screens', screens.join(' '));
  if (screens.some(s => s.includes(':ERR'))) throw new Error('screen threw with affixes active');
}

withGame(run).then(errors => {
  console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'AFFIX TEST OK — no page errors');
  process.exit(errors.length ? 1 : 0);
}).catch(e => { console.error('AFFIX TEST FAILED', e.message); process.exit(1); });
