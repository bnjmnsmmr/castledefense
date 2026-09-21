// Regression checks for the post-merge gap fixes: max hearts pips, Frost magnitude,
// hero stomp routing through damageEnemy, No Walls hotkey guard.
const { withGame } = require('./smoke');
withGame(async (page) => {
  const r = await page.evaluate(() => {
    clearGameState(); profile.tutorialDone = true; startGame(false);
    const out = {};
    out.pipsBefore = document.querySelectorAll('#hp-pips .hp-pip').length;
    game.relics = []; pickRelic ? null : null;
    game.maxHp = (game.maxHp || DIFFICULTY.startHp) + 5; game.hp += 5; updateUI();
    out.pipsAfter = document.querySelectorAll('#hp-pips .hp-pip').length;
    out.livePips = document.querySelectorAll('#hp-pips .hp-pip:not(.lost)').length;
    // Frost: 60% slow beats the 50% ice slow, and clears when the slow expires
    const e = { type: 0, x: 200, y: 340, hp: 40, maxHp: 40, speed: 1.2, path: [{x:200,y:340}], pathIdx: 0, dead: false, slowed: 0, untargetable: 0 };
    game.enemies.push(e);
    game.mana = 100; game.prepPhase = false; game.powerCooldowns = {};
    castPower('frost');
    out.frostMult = slowSpeedMult(e);
    e.slowed = 0; e.slowStrength = 0; applyIceSlow(e, 2);
    out.iceMult = slowSpeedMult(e);
    // Hero stomp: kill goes through damageEnemy (kills++, mana gain)
    const kills0 = game.kills, mana0 = game.mana;
    game.hero = { x: e.x, y: e.y - 40, speed: 0, phase: 'walking', bossHitT: 0 };
    game.heroTimer = 99; update(0.016);
    out.stompKilled = e.dead; out.killsDelta = game.kills - kills0; out.manaDelta = game.mana - mana0;
    // No Walls hotkey guard
    ACTIVE_RUN_MODIFIERS = ['no_walls']; game.buildMode = 'tower';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    out.buildModeAfterQ = game.buildMode;
    ACTIVE_RUN_MODIFIERS = null;
    return out;
  });
  console.log(JSON.stringify(r));
  if (r.pipsBefore !== 25 || r.pipsAfter !== 30 || r.livePips !== 30) throw new Error('pips wrong');
  if (Math.abs(r.frostMult - 0.4) > 1e-9 || Math.abs(r.iceMult - 0.5) > 1e-9) throw new Error('slow magnitude wrong');
  if (!r.stompKilled || r.killsDelta !== 1 || r.manaDelta <= 0) throw new Error('hero stomp not routed through damageEnemy');
  if (r.buildModeAfterQ !== 'tower') throw new Error('no_walls hotkey guard failed');
}).then(e => { console.log(e.length ? 'ERRORS\n' + e.join('\n') : 'GAPS TEST OK'); process.exit(e.length ? 1 : 0); })
  .catch(err => { console.log('GAPS TEST FAILED', err.message); process.exit(1); });
