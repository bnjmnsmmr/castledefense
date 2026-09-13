// Feature test for js/feat-targeting.js: targeting-mode picker, per-tower defaults,
// mode cycling, tower stat tracking (kills/dmgDealt) and the inspect-card DOM.
// Run: NODE_PATH=<dir with playwright-core> node tools/test-targeting.js
const { withGame, clickTile } = require('./smoke');

async function run(page, errors) {
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(200);

  // Place a real tower (arrow, id "arrow") via the normal two-tap-capable click flow.
  await page.evaluate(() => { game.selectedTower = 0; });
  await clickTile(page, 4, 7);

  const result = await page.evaluate(() => {
    const out = {};
    const t = game.towers[0];
    const cx = t.tx * TILE + TILE / 2, cy = t.ty * TILE + TILE / 2;
    const def = { ...TOWER_TYPES[t.type], range: 1000 }; // huge range so every seeded enemy is "in range"

    // Four enemies with independently-controlled distance / hp / path-progress,
    // positioned relative to the tower's own center (cx, cy) so distance is exact.
    function mkEnemy(id, dx, hp, pathIdx) {
      const x = cx + dx, y = cy;
      const path = [];
      for (let i = 0; i <= pathIdx + 1; i++) path.push({ x: i === pathIdx ? x : cx + i * 1000, y });
      return { id, type: 0, x, y, hp, maxHp: hp, path, pathIdx, dead: false, untargetable: 0 };
    }
    const C_ = mkEnemy('C', 10, 10, 0);    // nearest, weakest, least progress
    const A_ = mkEnemy('A', 50, 120, 2);   // mid everything
    const D_ = mkEnemy('D', 150, 999, 1);  // strongest
    const B_ = mkEnemy('B', 300, 200, 5);  // furthest along, furthest away
    game.enemies = [C_, A_, D_, B_];

    const pick = mode => { t.targetMode = mode; const p = pickTarget(t, def, cx, cy); return p && p.id; };
    out.near = pick('near');
    out.first = pick('first');
    out.last = pick('last');
    out.strong = pick('strong');
    out.weak = pick('weak');

    // Out-of-range enemies must never be picked.
    t.targetMode = 'near';
    def.range = 5; // nobody is within 5px of the tower center
    out.outOfRangePick = pickTarget(t, def, cx, cy);

    // Per-tower defaults.
    const sniperIdx = TOWER_TYPES.findIndex(x => x.id === 'sniper');
    const iceIdx = TOWER_TYPES.findIndex(x => x.id === 'ice');
    const arrowIdx = TOWER_TYPES.findIndex(x => x.id === 'arrow');
    out.sniperDefault = getTargetMode({ type: sniperIdx });
    out.iceDefault = getTargetMode({ type: iceIdx });
    out.arrowDefault = getTargetMode({ type: arrowIdx });

    // Cycling wraps through all five modes back to the start.
    const cycled = { ...t, targetMode: 'near' };
    const seen = [cycled.targetMode];
    for (let i = 0; i < 5; i++) { cycleTargetMode(cycled); seen.push(cycled.targetMode); }
    out.cycleSequence = seen;

    // Damage/kill attribution: a direct damageEnemy(..., dmg, tower) call should
    // update the tower's stat fields, and the inspect card should render them.
    const victim = mkEnemy('V', 20, 30, 0);
    game.enemies.push(victim);
    damageEnemy(victim, 10, t);
    out.dmgAfterHit = t.dmgDealt;
    damageEnemy(victim, 999, t); // lethal — should also bump kills
    out.dmgAfterKill = t.dmgDealt;
    out.killsAfterKill = t.kills;

    showTowerCard(t);
    const card = document.getElementById('tower-card');
    out.cardShown = !!card && card.classList.contains('show');
    out.cardHasKills = card ? card.textContent.includes(String(t.kills)) : false;
    hideTowerCard();
    out.cardHiddenAfter = !document.getElementById('tower-card').classList.contains('show');

    // Save/load round-trips the chosen mode.
    t.targetMode = 'strong';
    saveGameState();
    const saved = JSON.parse(localStorage.getItem('castleDefenseSave'));
    out.savedMode = saved.towers[0].targetMode;

    return out;
  });
  console.log('result', JSON.stringify(result));

  const expect = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
  expect(result.near === 'C', `near should pick C, got ${result.near}`);
  expect(result.first === 'B', `first should pick B, got ${result.first}`);
  expect(result.last === 'C', `last should pick C, got ${result.last}`);
  expect(result.strong === 'D', `strong should pick D, got ${result.strong}`);
  expect(result.weak === 'C', `weak should pick C, got ${result.weak}`);
  expect(result.outOfRangePick === null, `out-of-range pick should be null, got ${JSON.stringify(result.outOfRangePick)}`);
  expect(result.sniperDefault === 'strong', `sniper default should be strong, got ${result.sniperDefault}`);
  expect(result.iceDefault === 'first', `ice default should be first, got ${result.iceDefault}`);
  expect(result.arrowDefault === 'near', `arrow default should be near, got ${result.arrowDefault}`);
  expect(JSON.stringify(result.cycleSequence) === JSON.stringify(['near', 'first', 'last', 'strong', 'weak', 'near']),
    `cycle sequence wrong: ${JSON.stringify(result.cycleSequence)}`);
  expect(result.dmgAfterHit === 10, `dmgDealt after first hit should be 10, got ${result.dmgAfterHit}`);
  expect(result.dmgAfterKill === 1009, `dmgDealt after kill should be 1009, got ${result.dmgAfterKill}`);
  expect(result.killsAfterKill === 1, `kills should be 1, got ${result.killsAfterKill}`);
  expect(result.cardShown, 'tower card should be shown');
  expect(result.cardHasKills, 'tower card should render the kill count');
  expect(result.cardHiddenAfter, 'tower card should hide after hideTowerCard()');
  expect(result.savedMode === 'strong', `saved targetMode should be strong, got ${result.savedMode}`);

  if (errors.length) throw new Error('page errors: ' + errors.join('\n'));
}

withGame(run).then(errors => {
  console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'TARGETING TEST OK');
  process.exit(errors.length ? 1 : 0);
}).catch(e => { console.error('TARGETING TEST FAILED', e.message); process.exit(1); });
