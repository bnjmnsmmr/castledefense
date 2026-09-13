// ===== FEATURE: PER-WORLD LANE LAYOUTS =====
// Each world gets its own set of lanes instead of everyone sharing ALL_PATHS.
// World 1 (index 0) is the original layout, untouched, so World 1 and the
// tutorial play out exactly as before. `applyWorldMap(world)` swaps which
// lane set ALL_PATHS points to; callers are responsible for re-deriving
// pathSet/game.activePaths from it afterwards (they already did that work,
// this just makes sure they're reading from the right map when they do it).

const WORLD_MAPS = [
  { name: 'The Old Road', lanes: ALL_PATHS }, // World 1 — Greenwood, unchanged
  { // World 2 — Scorched Desert: a wide spiral of three lanes coiling toward the gate
    name: 'Spiral Dunes',
    lanes: [
      { unlockWave: 1, label: 'Outer coil', color: '#c9a24d', tiles: [
        [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],
        [16,4],[16,5],[16,6],[16,7],[16,8],[16,9],[16,10],[16,11],
        [15,11],[14,11],[13,11],[12,11],[11,11],[10,11],[9,11],[8,11],[7,11],[6,11],
        [6,10],[6,9],[6,8],[6,7],[6,6],
        [7,6],[8,6],[9,6],[10,6],[11,6],[12,6],
        [12,7],[12,8],
        [13,8],[14,8],[15,8],[16,8],[17,8],[18,8],[19,8],[20,8],[21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 5, label: 'Inner coil', color: '#e0b25a', tiles: [
        [10,16],[10,15],[10,14],[10,13],[10,12],
        [11,12],[12,12],[13,12],[14,12],[15,12],[16,12],[17,12],[18,12],[19,12],[20,12],
        [20,11],[20,10],[20,9],[20,8],[20,7],[20,6],[20,5],[20,4],
        [21,4],[22,4],[23,4],[24,4],
        [24,5],[24,6],[24,7],[24,8],
        [25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 9, label: 'Sunburnt shortcut', color: '#8b6e3a', tiles: [
        [22,0],[22,1],[22,2],[22,3],[22,4],[22,5],
        [23,5],[24,5],[25,5],[26,5],[27,5],
        [27,6],[27,7],[27,8],[28,8],[29,8],
      ] },
    ],
  },
  { // World 3 — Frozen Tundra: two long lanes running parallel, merging late, plus a late ridge route
    name: 'Twin Ice Roads',
    lanes: [
      { unlockWave: 1, label: 'North road', color: '#8ec8e0', tiles: [
        [0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4],[13,4],[14,4],[15,4],[16,4],
        [17,4],[18,4],[19,4],[20,4],[21,4],[22,4],
        [22,5],[22,6],[22,7],[22,8],
        [23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'South road', color: '#6fa8c4', tiles: [
        [0,12],[1,12],[2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [15,12],[16,12],[17,12],[18,12],[19,12],[20,12],[21,12],[22,12],
        [22,11],[22,10],[22,9],[22,8],
        [23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 8, label: 'Iceback ridge', color: '#c8e4f0', tiles: [
        [29,1],[29,2],[29,3],[29,4],[29,5],
        [28,5],[27,5],[26,5],[25,5],[24,5],[23,5],
        [23,6],[23,7],[23,8],[23,9],
        [24,9],[25,9],[26,9],
        [26,8],[27,8],[28,8],[29,8],
      ] },
    ],
  },
  { // World 4 — Volcanic Hellscape: lanes crossing each other over shared ground
    name: 'Crossfire Passes',
    lanes: [
      { unlockWave: 1, label: 'Ashen diagonal', color: '#c4501e', tiles: [
        [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],
        [10,4],[10,5],[10,6],[10,7],[10,8],[10,9],[10,10],[10,11],[10,12],[10,13],
        [11,13],[12,13],[13,13],[14,13],[15,13],[16,13],[17,13],[18,13],[19,13],[20,13],[21,13],[22,13],[23,13],[24,13],
        [24,12],[24,11],[24,10],[24,9],[24,8],
        [25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'Cinder diagonal', color: '#e07030', tiles: [
        [0,13],[1,13],[2,13],[3,13],[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],
        [10,12],[10,11],[10,10],[10,9],[10,8],[10,7],[10,6],[10,5],[10,4],[10,3],
        [11,3],[12,3],[13,3],[14,3],[15,3],[16,3],[17,3],[18,3],[19,3],[20,3],[21,3],[22,3],[23,3],[24,3],
        [24,4],[24,5],[24,6],[24,7],[24,8],
        [25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 6, label: 'Fault line', color: '#ff8030', tiles: [
        [20,0],[20,1],[20,2],[20,3],[20,4],[20,5],[20,6],[20,7],[20,8],
        [21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 10, label: 'Magma vent', color: '#ffb020', tiles: [
        [8,16],[8,15],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[8,8],[8,7],[8,6],
        [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[15,6],[16,6],[17,6],[18,6],[19,6],[20,6],
        [20,7],[20,8],
        [21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
    ],
  },
  { // World 5 — Enchanted Grove: three lanes weaving back and forth past each other
    name: 'The Weaving Thicket',
    lanes: [
      { unlockWave: 1, label: 'Willow weave', color: '#a060e0', tiles: [
        [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
        [6,4],[6,5],[6,6],[6,7],[6,8],[6,9],
        [7,9],[8,9],[9,9],[10,9],[11,9],[12,9],
        [12,8],[12,7],[12,6],[12,5],[12,4],[12,3],
        [13,3],[14,3],[15,3],[16,3],[17,3],[18,3],
        [18,4],[18,5],[18,6],[18,7],[18,8],[18,9],
        [19,9],[20,9],[21,9],[22,9],[23,9],[24,9],
        [24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'Bramble weave', color: '#60e0d0', tiles: [
        [3,16],[3,15],[3,14],[3,13],[3,12],[3,11],[3,10],
        [4,10],[5,10],[6,10],[7,10],[8,10],[9,10],
        [9,9],[9,8],[9,7],[9,6],[9,5],[9,4],
        [10,4],[11,4],[12,4],[13,4],[14,4],[15,4],
        [15,5],[15,6],[15,7],[15,8],[15,9],[15,10],
        [16,10],[17,10],[18,10],[19,10],[20,10],[21,10],
        [21,9],[21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 6, label: 'Fae shortcut', color: '#ff80d0', tiles: [
        [26,0],[26,1],[26,2],[26,3],[26,4],[26,5],[26,6],
        [25,6],[24,6],[23,6],[22,6],[21,6],[20,6],[19,6],
        [19,7],[19,8],[19,9],
        [20,9],[21,9],[22,9],[23,9],[24,9],[25,9],
        [25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
    ],
  },
  { // World 6 — Deep Space: four short direct lanes from every edge, brutal and immediate
    name: 'Four-Front Assault',
    lanes: [
      { unlockWave: 1, label: 'West breach', color: '#40a0ff', tiles: [
        [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
        [15,8],[16,8],[17,8],[18,8],[19,8],[20,8],[21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'North drop', color: '#80ff80', tiles: [
        [10,0],[10,1],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],
        [11,8],[12,8],[13,8],[14,8],[15,8],[16,8],[17,8],[18,8],[19,8],[20,8],
        [21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'South drop', color: '#ff6080', tiles: [
        [22,16],[22,15],[22,14],[22,13],[22,12],[22,11],[22,10],[22,9],[22,8],
        [23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 4, label: 'East flank', color: '#c0a0ff', tiles: [
        [29,2],[29,3],[29,4],[29,5],
        [28,5],[27,5],[26,5],[25,5],[24,5],
        [24,6],[24,7],[24,8],
        [25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
    ],
  },
  { // World 7 — Ocean Depths: one very long snake lane, a medium current, and a late short rip tide
    name: 'The Long Current',
    lanes: [
      { unlockWave: 1, label: 'The long current', color: '#40e0c0', tiles: [
        [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],
        [6,3],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
        [7,14],[8,14],[9,14],[10,14],[11,14],[12,14],
        [12,13],[12,12],[12,11],[12,10],[12,9],[12,8],[12,7],[12,6],[12,5],[12,4],[12,3],[12,2],
        [13,2],[14,2],[15,2],[16,2],[17,2],[18,2],
        [18,3],[18,4],[18,5],[18,6],[18,7],[18,8],[18,9],[18,10],[18,11],[18,12],[18,13],[18,14],
        [19,14],[20,14],[21,14],[22,14],[23,14],[24,14],
        [24,13],[24,12],[24,11],[24,10],[24,9],[24,8],
        [25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 5, label: 'Mid current', color: '#20a0a0', tiles: [
        [0,16],[1,16],[2,16],[3,16],[4,16],[5,16],[6,16],
        [6,15],[6,14],[6,13],[6,12],[6,11],[6,10],
        [7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],[14,10],
        [14,9],[14,8],[14,7],[14,6],
        [15,6],[16,6],[17,6],[18,6],[19,6],[20,6],[21,6],[22,6],
        [22,7],[22,8],
        [23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 11, label: 'Rip tide', color: '#ff6060', tiles: [
        [29,0],[29,1],[29,2],[29,3],[29,4],
        [28,4],[27,4],[26,4],[25,4],
        [25,5],[25,6],[25,7],[25,8],
        [26,8],[27,8],[28,8],[29,8],
      ] },
    ],
  },
  { // World 8 — Shadow Realm: every lane funnels into the same 3-tile killzone before the gate
    name: 'Shadowfall Funnel',
    lanes: [
      { unlockWave: 1, label: 'Western dark', color: '#30ff50', tiles: [
        [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
        [15,8],[16,8],[17,8],[18,8],[19,8],[20,8],[21,8],[22,8],[23,8],[24,8],[25,8],
        [26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'Northern dark', color: '#40ff90', tiles: [
        [14,0],[14,1],[14,2],[14,3],[14,4],
        [15,4],[16,4],[17,4],[18,4],[19,4],[20,4],[21,4],[22,4],[23,4],[24,4],[25,4],
        [25,5],[25,6],[25,7],[25,8],
        [26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 1, label: 'Southern dark', color: '#20c040', tiles: [
        [14,16],[14,15],[14,14],[14,13],[14,12],
        [15,12],[16,12],[17,12],[18,12],[19,12],[20,12],[21,12],[22,12],[23,12],[24,12],[25,12],
        [25,11],[25,10],[25,9],[25,8],
        [26,8],[27,8],[28,8],[29,8],
      ] },
      { unlockWave: 6, label: 'Eastern dark', color: '#80ffa0', tiles: [
        [29,2],[29,3],[29,4],[29,5],
        [28,5],[27,5],[26,5],[25,5],
        [25,6],[25,7],[25,8],
        [26,8],[27,8],[28,8],[29,8],
      ] },
    ],
  },
];

// Swaps which lane set ALL_PATHS points to for the given world. Callers still
// re-derive pathSet / game.activePaths right after this (they already did that
// work at every call site — initGame, startGame(resume), and the world-advance
// branch of update() — this just makes sure they read from the right map).
function applyWorldMap(world) {
  const map = WORLD_MAPS[(world - 1) % WORLD_MAPS.length];
  ALL_PATHS = map.lanes;
  if (game) game.mapName = map.name;
  groundCache = null; // terrain must be repainted against the new lanes
}

// Called only where a run can actually be mid-flight when the map switches
// (the world-advance point in update()). Towers can't stand on path tiles and
// walls can't stand off it, so anything the new map strands gets bought back
// at full price — fair, since the terrain shift happens during prep, before
// the player has committed to a wave.
function refundMisplacedBuildables() {
  if (!game) return;
  let refunded = 0, goldBack = 0;
  game.towers = (game.towers || []).filter(t => {
    if (!isPath(t.tx, t.ty) && !isCastle(t.tx, t.ty)) return true;
    goldBack += TOWER_TYPES[t.type] ? TOWER_TYPES[t.type].cost : 0;
    refunded++;
    return false;
  });
  game.walls = (game.walls || []).filter(w => {
    if (isPath(w.tx, w.ty)) return true;
    goldBack += (w.buyCost != null ? w.buyCost : (WALL_TYPES[w.type] ? WALL_TYPES[w.type].cost : 0));
    refunded++;
    return false;
  });
  if (refunded > 0) {
    game.gold += goldBack;
    showFlash(`Terrain shifted — ${refunded} tower${refunded === 1 ? '' : 's'} refunded`);
  }
}
