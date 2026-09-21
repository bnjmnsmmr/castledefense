// Feature test for Castle Powers (mana bar + Fireball/Rally/Frost/Repair).
// Run: NODE_PATH=<dir containing playwright-core> node tools/test-powers.js
const { withGame, clickTile } = require('./smoke');

async function run(page) {
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(200);

  // --- powers-bar exists and is visible while a run is live ---
  const barVisible = await page.evaluate(() => {
    const bar = document.getElementById('powers-bar');
    return !!bar && getComputedStyle(bar).display !== 'none';
  });
  if (!barVisible) throw new Error('powers-bar not visible during a run');

  // --- Repair works during prep phase; Fireball does not ---
  const prepState = await page.evaluate(() => ({ prepPhase: game.prepPhase, fireballOk: powerAvailable(POWERS.find(p => p.id === 'fireball')), repairOk: powerAvailable(POWERS.find(p => p.id === 'repair')) }));
  console.log('prep gating', JSON.stringify(prepState));
  if (!prepState.prepPhase) throw new Error('expected to start in prep phase');
  if (prepState.fireballOk) throw new Error('fireball should be locked during prep phase');
  if (!prepState.repairOk) throw new Error('repair should be usable during prep phase');

  // --- Repair: damage a wall + the castle, then cast Repair and confirm full heal ---
  await page.evaluate(() => {
    game.gold = 99999;
    game.mana = 100;
    placeWall(8, 8); // a west-gate path tile
    const w = game.walls[0];
    w.hp = 1;
    game.hp = DIFFICULTY.startHp - 3;
  });
  await page.evaluate(() => castPower('repair'));
  const afterRepair = await page.evaluate(() => ({ wallHp: game.walls[0].hp, wallMax: game.walls[0].maxHp, hp: game.hp, startHp: DIFFICULTY.startHp, cd: game.powerCooldowns.repair, powersCast: game.powersCast }));
  console.log('after repair', JSON.stringify(afterRepair));
  if (afterRepair.wallHp !== afterRepair.wallMax) throw new Error('repair did not fully heal the wall');
  if (afterRepair.hp !== afterRepair.startHp - 2) throw new Error('repair did not heal exactly 1 heart');
  if (!(afterRepair.cd > 0)) throw new Error('repair did not enter cooldown');
  if (afterRepair.powersCast !== 1) throw new Error('powersCast counter did not increment');

  // --- Insufficient mana: repair costs 40, drop mana low, expect refusal (cooldown untouched) ---
  await page.evaluate(() => { game.mana = 5; game.powerCooldowns.repair = 0; });
  const denied = await page.evaluate(() => { castPower('repair'); return { cd: game.powerCooldowns.repair, mana: game.mana }; });
  if (denied.cd !== 0 || denied.mana !== 5) throw new Error('repair should have been denied for insufficient mana');

  // --- Send a wave, then test Fireball targeting + damage, Frost slow, Rally reload ---
  await page.evaluate(() => { game.mana = 100; game.selectedTower = 0; });
  await clickTile(page, 4, 7); // arrow tower off the west-gate lane
  await page.evaluate(() => sendWave());
  await page.waitForTimeout(1500);

  const beforeFireball = await page.evaluate(() => ({ enemies: game.enemies.filter(e => !e.dead).length, hp0: (game.enemies.find(e => !e.dead) || {}).hp }));
  console.log('before fireball', JSON.stringify(beforeFireball));

  const fireballResult = await page.evaluate(() => {
    const e = game.enemies.find(en => !en.dead);
    if (!e) return { skipped: true };
    game.mana = 100;
    castPower('fireball'); // arms targeting
    const targeting = game.powerTargeting;
    const handled = powerHandleCanvasClick(Math.floor(e.x / TILE), Math.floor(e.y / TILE), e.x, e.y);
    return { targeting, handled, cd: game.powerCooldowns.fireball, hpAfter: e.dead ? 0 : e.hp, mana: game.mana };
  });
  console.log('fireball result', JSON.stringify(fireballResult));
  if (!fireballResult.skipped) {
    if (fireballResult.targeting !== 'fireball') throw new Error('fireball did not arm targeting mode');
    if (!fireballResult.handled) throw new Error('powerHandleCanvasClick did not consume the click');
    if (!(fireballResult.cd > 0)) throw new Error('fireball did not enter cooldown');
  }

  const frostResult = await page.evaluate(() => {
    game.mana = 100; game.powerCooldowns.frost = 0;
    const alive = game.enemies.filter(e => !e.dead);
    castPower('frost');
    return { slowed: alive.every(e => e.slowed > 0), cd: game.powerCooldowns.frost };
  });
  console.log('frost result', JSON.stringify(frostResult));
  if (!frostResult.slowed) throw new Error('frost did not slow every enemy');
  if (!(frostResult.cd > 0)) throw new Error('frost did not enter cooldown');

  const rallyResult = await page.evaluate(() => {
    game.mana = 100; game.powerCooldowns.rally = 0;
    const t = game.towers[0];
    t.ammo = 0; t.cooldown = 99;
    castPower('rally');
    return { ammo: t.ammo, cooldown: t.cooldown, rallyTimer: game.rallyTimer, cd: game.powerCooldowns.rally };
  });
  console.log('rally result', JSON.stringify(rallyResult));
  if (rallyResult.ammo <= 0) throw new Error('rally did not reload ammo');
  if (rallyResult.cooldown !== 0) throw new Error('rally did not reset tower cooldown');
  if (!(rallyResult.rallyTimer > 0)) throw new Error('rally did not set rallyTimer');

  // --- Mana regenerates over time during a wave ---
  await page.evaluate(() => { game.mana = 0; });
  await page.waitForTimeout(1500);
  const manaAfterWait = await page.evaluate(() => game.mana);
  console.log('mana after wait', manaAfterWait);
  if (!(manaAfterWait > 0)) throw new Error('mana did not regenerate during the wave');

  // --- Save/restore round-trips mana + cooldowns ---
  await page.evaluate(() => { game.mana = 42; game.powerCooldowns.fireball = 7; game.powersCast = 3; saveGameState(); });
  const roundTrip = await page.evaluate(() => {
    const saved = loadGameState();
    return { mana: saved.mana, fireballCd: saved.powerCooldowns.fireball, powersCast: saved.powersCast };
  });
  console.log('save round-trip', JSON.stringify(roundTrip));
  if (roundTrip.mana !== 42 || roundTrip.fireballCd !== 7 || roundTrip.powersCast !== 3) throw new Error('mana/cooldowns did not persist in the save');

  // --- Hotkeys work (F arms fireball targeting) ---
  await page.evaluate(() => { game.mana = 100; game.powerCooldowns.fireball = 0; game.powerTargeting = null; game.prepPhase = false; });
  await page.keyboard.press('f');
  const afterHotkey = await page.evaluate(() => game.powerTargeting);
  if (afterHotkey !== 'fireball') throw new Error('F hotkey did not arm Fireball targeting');
  await page.keyboard.press('Escape');
  const afterEscape = await page.evaluate(() => game.powerTargeting);
  if (afterEscape !== null) throw new Error('Escape did not cancel targeting');

  // --- Chrome hides with the rest of the HUD on game over ---
  await page.evaluate(() => { game.hp = 0; endGame(); });
  await page.waitForTimeout(200);
  const hiddenAfterGameOver = await page.evaluate(() => !document.getElementById('powers-bar').classList.contains('show'));
  if (!hiddenAfterGameOver) throw new Error('powers-bar did not hide on game over');
}

if (require.main === module) {
  withGame(run).then(errors => {
    console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'POWERS TEST OK — no page errors');
    process.exit(errors.length ? 1 : 0);
  }).catch(e => { console.error('POWERS TEST FAILED', e.message); process.exit(1); });
}
