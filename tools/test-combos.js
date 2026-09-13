// Feature test for js/feat-combos.js — elemental combos.
// Seeds synthetic enemies with the relevant status fields and calls the
// combo hook (via damageEnemy) directly, asserting bonus damage / procs.
// Run: NODE_PATH=<dir containing playwright-core> node tools/test-combos.js
const { withGame } = require('./smoke');

function mkEnemy(x, y, extra) {
  return Object.assign({
    type: 0, x, y, hp: 1000, maxHp: 1000, speed: 1,
    path: [{ x, y }], pathIdx: 0, dead: false, slowed: 0,
  }, extra);
}

async function run(page) {
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(200);

  const results = await page.evaluate((mkEnemySrc) => {
    const mkEnemy = eval('(' + mkEnemySrc + ')');
    const out = {};

    // --- SHATTER: Cannon damage on a slowed enemy -> ×1.5, slow removed ---
    game.enemies = [];
    let e = mkEnemy(200, 200, { slowed: 2 });
    game.enemies.push(e);
    game.combos = 0;
    damageEnemy(e, 100, 'cannon');
    out.shatter = { hpLoss: 1000 - e.hp, slowedAfter: e.slowed, combos: game.combos };

    // Cooldown check: immediately re-slow and hit again with cannon -> should NOT re-proc (still 0.5s window)
    e.slowed = 2;
    const hpBefore = e.hp;
    damageEnemy(e, 100, 'cannon');
    out.shatterCooldown = { hpLoss: hpBefore - e.hp, combos: game.combos };

    // --- IGNITE: Flame damage on a poisoned enemy -> AoE burst, poison consumed ---
    game.enemies = [];
    let poisoned = mkEnemy(300, 300, { dotTimer: 3, dotDmg: 10, dotSrc: 'poison', dotTickTimer: 0.5 });
    let neighbor = mkEnemy(320, 300, {}); // within 60px burst radius
    game.enemies.push(poisoned, neighbor);
    game.combos = 0;
    const neighborHpBefore = neighbor.hp;
    damageEnemy(poisoned, 50, 'flame');
    out.ignite = {
      neighborHpLoss: neighborHpBefore - neighbor.hp, // expect 30 (3x dotDmg burst)
      dotTimerAfter: poisoned.dotTimer,
      combos: game.combos,
    };

    // Chain Reaction achievement: 5 extra neighbors within burst radius
    game.enemies = [];
    let center = mkEnemy(400, 400, { dotTimer: 3, dotDmg: 10, dotSrc: 'poison', dotTickTimer: 0.5 });
    game.enemies.push(center);
    for (let i = 0; i < 5; i++) game.enemies.push(mkEnemy(400 + i * 5, 400 + i * 5, {}));
    game.achievements = {};
    damageEnemy(center, 50, 'cannon'); // cannon also ignites
    out.chainReaction = !!game.achievements['Chain Reaction'];

    // --- CONDUCT: Tesla damage on a slowed enemy -> extra 50% dmg to 2 nearest others ---
    game.enemies = [];
    let hub = mkEnemy(500, 500, { slowed: 2 });
    let near1 = mkEnemy(520, 500, {});
    let near2 = mkEnemy(540, 500, {});
    let far = mkEnemy(700, 500, {}); // outside 90px radius
    game.enemies.push(hub, near1, near2, far);
    game.combos = 0;
    damageEnemy(hub, 40, 'tesla');
    out.conduct = {
      near1Loss: 1000 - near1.hp, near2Loss: 1000 - near2.hp, farLoss: 1000 - far.hp,
      combos: game.combos,
    };

    // --- BRITTLE: Sniper damage on a burning enemy -> ×2 ---
    game.enemies = [];
    let burning = mkEnemy(600, 600, { dotTimer: 2, dotDmg: 5, dotSrc: 'flame' });
    game.enemies.push(burning);
    game.combos = 0;
    damageEnemy(burning, 30, 'sniper');
    out.brittle = { hpLoss: 1000 - burning.hp, combos: game.combos };

    // --- Alchemist achievement at 50 combos ---
    game.achievements = {};
    game.combos = 49;
    let e2 = mkEnemy(800, 800, { slowed: 2 });
    game.enemies = [e2];
    damageEnemy(e2, 10, 'mortar');
    out.alchemist = !!game.achievements['Alchemist'];

    return out;
  }, mkEnemy.toString());

  console.log('results', JSON.stringify(results, null, 2));

  const fail = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
  fail(results.shatter.hpLoss === 150, `SHATTER expected 150 dmg (100*1.5), got ${results.shatter.hpLoss}`);
  fail(results.shatter.slowedAfter === 0, 'SHATTER should clear the slow');
  fail(results.shatter.combos === 1, 'SHATTER should count as 1 combo');
  fail(results.shatterCooldown.hpLoss === 100, `cooldown should block a re-proc (expected plain 100 dmg), got ${results.shatterCooldown.hpLoss}`);
  fail(results.shatterCooldown.combos === 1, 'cooldown should not increment combos again');
  fail(results.ignite.neighborHpLoss === 30, `IGNITE burst expected 30 dmg (3x dotDmg 10), got ${results.ignite.neighborHpLoss}`);
  fail(results.ignite.dotTimerAfter === 0, 'IGNITE should consume the poison DoT');
  fail(results.ignite.combos === 1, 'IGNITE should count as 1 combo');
  fail(results.chainReaction === true, 'Chain Reaction achievement should unlock at 5+ enemies hit');
  fail(results.conduct.near1Loss === 20 && results.conduct.near2Loss === 20, `CONDUCT expected 20 dmg (40*0.5) to both near targets, got ${results.conduct.near1Loss}/${results.conduct.near2Loss}`);
  fail(results.conduct.farLoss === 0, 'CONDUCT should not reach an enemy outside the 90px radius');
  fail(results.conduct.combos === 1, 'CONDUCT should count as 1 combo');
  fail(results.brittle.hpLoss === 60, `BRITTLE expected 60 dmg (30*2), got ${results.brittle.hpLoss}`);
  fail(results.alchemist === true, 'Alchemist achievement should unlock at 50 combos');
}

if (require.main === module) {
  withGame(run).then(errors => {
    if (errors.length) { console.log('ERRORS:\n  ' + errors.join('\n  ')); process.exit(1); }
    console.log('COMBO TEST OK — no page errors');
    process.exit(0);
  }).catch(e => { console.error('COMBO TEST FAILED', e.message); process.exit(1); });
}
