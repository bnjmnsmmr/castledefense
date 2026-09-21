// Validates every per-world lane layout (WORLD_MAPS / applyWorldMap, js/feat-maps.js):
// each lane is a connected chain of orthogonally-adjacent tiles inside the grid,
// ends at the castle gate [29,8], and never touches the castle interior before
// its last couple of tiles. Run: NODE_PATH=<dir with playwright-core> node tools/test-maps.js
const { withGame } = require('./smoke');

async function run(page) {
  await page.evaluate(() => { clearGameState(); startGame(false); });
  await page.waitForTimeout(200);

  const results = await page.evaluate(() => {
    function isCastle(x, y) { return x >= 28 && y >= 6 && y <= 10; }
    const out = [];
    for (let world = 1; world <= 8; world++) {
      game.world = world;
      applyWorldMap(world);
      const map = WORLD_MAPS[(world - 1) % WORLD_MAPS.length];
      const errs = [];
      for (const lane of map.lanes) {
        const tiles = lane.tiles;
        if (!tiles || !tiles.length) { errs.push(`${lane.label}: empty lane`); continue; }
        for (let i = 0; i < tiles.length; i++) {
          const [x, y] = tiles[i];
          if (x < 0 || x >= COLS || y < 0 || y >= ROWS) errs.push(`${lane.label}: tile ${i} (${x},${y}) out of grid`);
          if (i > 0) {
            const [px, py] = tiles[i - 1];
            const d = Math.abs(x - px) + Math.abs(y - py);
            if (d !== 1) errs.push(`${lane.label}: tile ${i} (${x},${y}) not orthogonally adjacent to previous (${px},${py})`);
          }
        }
        const [lx, ly] = tiles[tiles.length - 1];
        if (lx !== 29 || ly !== 8) errs.push(`${lane.label}: does not end at [29,8], ends at [${lx},${ly}]`);
        for (let i = 0; i < tiles.length - 2; i++) {
          const [x, y] = tiles[i];
          if (isCastle(x, y)) errs.push(`${lane.label}: castle interior tile before the end, index ${i} (${x},${y})`);
        }
        const [sx, sy] = tiles[0];
        const onEdge = sx === 0 || sx === COLS - 1 || sy === 0 || sy === ROWS - 1;
        if (!onEdge) errs.push(`${lane.label}: start [${sx},${sy}] is not on a map edge`);
      }
      out.push({ world, name: map.name, lanes: map.lanes.length, errs });
    }
    return out;
  });

  for (const r of results) {
    console.log(`World ${r.world} (${r.name}): ${r.lanes} lanes${r.errs.length ? ' — FAILURES:' : ' — OK'}`);
    for (const e of r.errs) console.log('  ' + e);
  }
  const failed = results.filter(r => r.errs.length);
  if (failed.length) throw new Error(`${failed.length} world map(s) failed validation`);

  // Render one frame on the last-applied map and make sure nothing throws.
  await page.evaluate(() => { resize(); render(); });
  await page.waitForTimeout(100);
}

if (require.main === module) {
  withGame(run).then(errors => {
    console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'MAPS OK — 0 page errors');
    process.exit(errors.length ? 1 : 0);
  }).catch(e => { console.error('MAP TEST FAILED', e.message); process.exit(1); });
}
