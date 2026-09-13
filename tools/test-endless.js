// Ad-hoc: storms engage at world 9 wave 1 with default settings.
const { withGame } = require('./smoke');
withGame(async (page) => {
  const r = await page.evaluate(() => {
    clearGameState(); startGame(false);
    game.world = 9; game.wave = 1;
    const n = endlessWaveNumber(1);
    const s = activeStorm();
    const w = getWave(1);
    game.world = 3; const none = activeStorm(); const w3 = getWave(1);
    return { n, storm: s && s.theme.name + '/' + s.mutator.name, spawns: w.length, types: [...new Set(w.map(x => x.type))], campaignStorm: none, w3len: w3.length };
  });
  console.log(JSON.stringify(r));
  if (r.n !== 31 || !r.storm || r.campaignStorm !== null) throw new Error('endless mapping wrong');
}).then(e => { console.log(e.length ? 'ERRORS ' + e.join('\n') : 'ENDLESS OK'); process.exit(e.length ? 1 : 0); });
