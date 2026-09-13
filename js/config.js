// ===== CONFIG (pure data) =====
// Every tunable table lives here: map lanes, difficulty, towers, walls, enemies, bosses, themes, achievements. No logic beyond tiny lookups.

// --- CONSTANTS ---
const TILE = 40;
const COLS = 30;
const ROWS = 17;
const PATH_COLOR = '#2a2520';
const GRASS_COLOR = '#1a2a1a';
const CASTLE_COLOR = '#8b7355';

// Path waypoints (tile coords) — multiple paths, unlock at different waves
const ALL_PATHS = [
  { // Path 1: Original S-curve from west (wave 1+)
    unlockWave: 1, label: 'West gate', color: '#2a2520',
    tiles: [
      [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],
      [8,7],[8,6],[8,5],[8,4],[8,3],
      [9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],
      [15,4],[15,5],[15,6],[15,7],[15,8],[15,9],[15,10],[15,11],[15,12],[15,13],
      [16,13],[17,13],[18,13],[19,13],[20,13],
      [20,12],[20,11],[20,10],[20,9],[20,8],
      [21,8],[22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
    ]
  },
  { // Path 2: From north, winds down (wave 4+)
    unlockWave: 4, label: 'North pass', color: '#252a20',
    tiles: [
      [12,0],[12,1],[12,2],[12,3],[12,4],[12,5],
      [13,5],[14,5],[15,5],[16,5],[17,5],
      [17,6],[17,7],[17,8],[17,9],[17,10],
      [18,10],[19,10],[20,10],[21,10],
      [21,9],[21,8],
      [22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
    ]
  },
  { // Path 3: From south, winds up (wave 7+)
    unlockWave: 7, label: 'South marsh', color: '#20252a',
    tiles: [
      [5,16],[5,15],[5,14],[5,13],[5,12],
      [6,12],[7,12],[8,12],[9,12],[10,12],
      [10,11],[10,10],[10,9],[10,8],[10,7],
      [11,7],[12,7],[13,7],
      [13,8],[13,9],[13,10],[13,11],[13,12],[13,13],[13,14],
      [14,14],[15,14],[16,14],[17,14],[18,14],
      [18,13],[18,12],[18,11],[18,10],
      [19,10],[20,10],[21,10],
      [21,9],[21,8],
      [22,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],[29,8],
    ]
  },
  { // Path 4: From north-east, short and dangerous (wave 10+)
    unlockWave: 10, label: 'Mountain trail', color: '#2a2025',
    tiles: [
      [24,0],[24,1],[24,2],[24,3],[24,4],
      [25,4],[26,4],[27,4],
      [27,5],[27,6],[27,7],[27,8],
      [28,8],[29,8],
    ]
  },
];


// ===== TUNABLE DIFFICULTY / ECONOMY CONFIG (editable via admin.html) =====
const DIFFICULTY = {
  startGold: 250,
  startHp: 25,
  wavesPerWorld: 15,
  waveHpGrowth: 0.25,        // hpMult = (1 + (wave-1)*waveHpGrowth + upgradesSpent*upgradeHpGrowth) * worldFactor
  upgradeHpGrowth: 0.12,
  worldHpGrowth: 0.7,        // worldFactor = 1 + (world-1)*worldHpGrowth
  waveSpeedGrowth: 0.03,
  worldSpeedGrowth: 0.15,
  maxSpeedMult: 3.2,
  upgradesExtraEnemies: 2.5, // bonus enemies spawned per upgrade point spent
  worldExtraEnemies: 4,      // bonus enemies spawned per world beyond 1
  xpPerUpgradePoint: 10,
  sellRefundRate: 0.5,
  wallCostScale: 0.15,
  goldMineRate: 2,
  supplyCrateMin: 25,
  supplyCrateMax: 55,
  towerUpgradeDmgPerLevel: 0.15,
  towerUpgradeRangePerLevel: 0.08,
  towerUpgradeRateMult: 0.93,
  towerUpgradeAmmoPerLevel: 1,
  towerUpgradeReloadMult: 0.94,
  stormWaveLength: 5,          // waves per storm past wave 30 (endless mode — see js/feat-storms.js)
  stormScoreBonusPerStorm: 0.25, // score-bonus multiplier added per storm survived
};

const TOWER_TYPES = [
  { id:'arrow',  name:'Arrow',   cost:25,  range:120, rate:0.8, dmg:8,   color:'#66aaff', projColor:'#aaccff', projSpeed:6, key:'1', ammo:8,  reload:2.5 },
  { id:'cannon', name:'Cannon',  cost:50,  range:100, rate:2.5, dmg:35,  color:'#ff6644', projColor:'#ffaa66', projSpeed:4, splash:45, key:'2', ammo:4, reload:3.5 },
  { id:'ice',    name:'Ice',     cost:50,  range:110, rate:1.2, dmg:5,   color:'#44ddff', projColor:'#bbffff', projSpeed:5, slow:0.4, slowDur:2.5, key:'3', ammo:6, reload:3 },
  { id:'sniper', name:'Sniper',  cost:50,  range:220, rate:3.5, dmg:70,  color:'#ff44ff', projColor:'#ffaaff', projSpeed:12, key:'4', ammo:3, reload:4 },
  { id:'tesla',  name:'Tesla',   cost:100,  range:90,  rate:0.5, dmg:12,  color:'#aaff44', projColor:'#ccff88', projSpeed:0, chain:3, key:'5', ammo:10, reload:3 },
  { id:'flame',  name:'Flame',   cost:50,  range:70,  rate:0.15,dmg:3,   color:'#ffaa22', projColor:'#ffcc44', projSpeed:0, cone:true, key:'6', ammo:30, reload:2 },
  { id:'mortar', name:'Mortar',  cost:50,  range:180, rate:4.0, dmg:50,  color:'#aa8844', projColor:'#ccaa66', projSpeed:3, splash:60, key:'7', ammo:2, reload:5 },
  { id:'poison', name:'Poison',  cost:50,  range:100, rate:2.0, dmg:4,   color:'#44cc66', projColor:'#66ff88', projSpeed:5, dot:8, dotDur:4, key:'8', ammo:5, reload:3 },
  { id:'goldmine', name:'Gold Mine', cost:80, range:0, rate:1, dmg:0, color:'#e8b64c', projColor:'#ffe6a0', projSpeed:0, key:'0', ammo:9999, reload:0.1, income:true, incomeDesc:'Earns gold to fund your towers' },
  { id:'annihilator', name:'Annihilator', cost:25, range:12*40, rate:0.05, dmg:125, pctDmg:0.25, color:'#ffffff', projColor:'#ffffff', projSpeed:0, chain:99, key:'9', ammo:9999, reload:0.1, secret:true },
];

// ===== WALLS =====
// Barricades built ON the path. They do not reroute anything — this game runs on
// fixed lanes with no pathfinding — they physically stop the horde, which then
// has to smash through. That buys your towers free seconds against a bunched-up
// crowd, which is the whole point. Flying enemies sail straight over.
const WALL_TYPES = [
  { id:'palisade', name:'Palisade', cost:60,  hp:250,  key:'Q', wood:'#7a5b38', trim:'#573f24' },
  { id:'rampart',  name:'Rampart',  cost:110, hp:550,  key:'W', wood:'#6b5138', trim:'#4a6238' },
  { id:'stone',    name:'Stone',    cost:200, hp:1100, key:'E', wood:'#6b6f76', trim:'#4a4d53' },
  { id:'bulwark',  name:'Bulwark',  cost:350, hp:2200, key:'R', wood:'#3d4148', trim:'#5c626b' },
];
const DEFAULT_WALLS = WALL_TYPES.map(w => ({ id: w.id, cost: w.cost, hp: w.hp }));


// Tooltip metadata per tower id
const TOWER_INFO = {
  arrow:  { rate:'Fast',   range:'Long',   spec:'Lv.2: Multishot — fires a volley of bolts' },
  cannon: { rate:'Slow',   range:'Medium', spec:'Lv.2: Napalm — splash sets enemies burning' },
  ice:    { rate:'Medium', range:'Medium', spec:'Lv.2: Freeze Nova — slows everything nearby' },
  sniper: { rate:'V. slow',range:'V. long',spec:'Lv.2: Piercing — one shot hits enemies in a line' },
  tesla:  { rate:'Fast',   range:'Short',  spec:'Lv.2: Arc Explosion — chain jumps splash nearby foes' },
  flame:  { rate:'V. fast',range:'Short',  spec:'Lv.2: Ignition — the cone sets enemies on fire' },
  mortar: { rate:'V. slow',range:'Long',   spec:'Lv.2: Cluster Bombs — impact scatters bomblets' },
  poison: { rate:'Slow',   range:'Medium', spec:'Lv.2: Infectious — poison spreads between enemies' },
  goldmine: { rate:'—', range:'—', spec:'💰 Earns gold to buy more towers! Lv.2: +50% income. Does not attack.' },
  annihilator: { rate:'Insane', range:'12 blocks', spec:'☢️ 4 zaps kill anything. You cheated for this.' },
};

// ===== TOWER CUSTOMIZATION (skins) =====
const SKIN_PALETTE = [
  { id:'crimson', name:'Crimson', color:'#d6474a', proj:'#ffb0b0' },
  { id:'azure',   name:'Azure',   color:'#4aa8e0', proj:'#bfe6ff' },
  { id:'gold',    name:'Gilded',  color:'#e8b64c', proj:'#ffe6a0' },
  { id:'violet',  name:'Violet',  color:'#9b6dd6', proj:'#dcc4f5' },
];

// Display names are picked from fixed word lists, never typed. That is a
// deliberate privacy choice for a game aimed at kids: no free text can reach
// the server, so there is no PII and nothing to moderate. Players reroll
// instead of choosing. These lists must stay in sync with server/worker.js.
const ADJECTIVES = [
  'Brave', 'Swift', 'Iron', 'Golden', 'Mighty', 'Clever', 'Silent', 'Royal',
  'Fierce', 'Noble', 'Stormy', 'Blazing', 'Frosty', 'Shadow', 'Crimson', 'Azure',
  'Jolly', 'Lucky', 'Bold', 'Sunny', 'Cosmic', 'Emerald', 'Thunder', 'Mystic',
  'Gallant', 'Rugged', 'Nimble', 'Radiant', 'Valiant', 'Wandering', 'Ancient', 'Merry',
];
const NOUNS = [
  'Falcon', 'Badger', 'Dragon', 'Knight', 'Otter', 'Wolf', 'Griffin', 'Turtle',
  'Phoenix', 'Bear', 'Fox', 'Hawk', 'Lion', 'Raven', 'Stag', 'Tiger',
  'Wizard', 'Archer', 'Ranger', 'Guardian', 'Paladin', 'Sentry', 'Warden', 'Champion',
  'Comet', 'Boulder', 'Lantern', 'Anvil', 'Compass', 'Beacon', 'Bastion', 'Banner',
];

// Canonical achievement list for the gallery. Secrets show as "???" until earned.
const ACHIEVEMENT_DEFS = [
  { name: 'Flawless Defense', desc: 'Clear a wave without losing a single heart' },
  { name: 'World 1 Cleared', desc: 'Survive all the waves of World 1 — Greenwood' },
  { name: 'World 2 Cleared', desc: 'Survive all the waves of World 2 — Scorched Desert' },
  { name: 'World 3 Cleared', desc: 'Survive all the waves of World 3 — Frozen Tundra' },
  { name: 'World 4 Cleared', desc: 'Survive all the waves of World 4 — Volcanic Hellscape' },
  { name: 'World 5 Cleared', desc: 'Survive all the waves of World 5 — Enchanted Grove' },
  { name: 'World 6 Cleared', desc: 'Survive all the waves of World 6 — Deep Space' },
  { name: 'World 7 Cleared', desc: 'Survive all the waves of World 7 — Ocean Depths' },
  { name: 'World 8 Cleared', desc: 'Survive all the waves of World 8 — Shadow Realm' },
  { name: 'The Annihilator', secret: true },
  { name: 'Tri-Beam Online', secret: true },
  { name: 'Pest of the Realm', secret: true },
  { name: 'Rapid Fire', secret: true },
  { name: 'Thunderstruck', secret: true },
  { name: 'GG Easy Money', secret: true },
  { name: 'Gold Rush', desc: 'Place 3 Gold Mines in a single run' },
  { name: 'Crate Hoarder', desc: 'Collect 20 supply crates in a single run' },
  { name: 'Storm Chaser', desc: 'Survive 3 storms in a single endless run' },
  { name: 'Eye of the Storm', desc: 'Survive an Eclipse storm' },
];

// Skin colors are trophies: each palette color has a lifetime unlock condition.
const SKIN_UNLOCKS = {
  crimson: { desc: 'Slay 250 enemies (lifetime)', test: p => (p.stats.totalKills || 0) >= 250 },
  azure:   { desc: 'Clear World 1', test: p => !!p.achievements['World 1 Cleared'] },
  gold:    { desc: 'Slay 1,000 enemies (lifetime)', test: p => (p.stats.totalKills || 0) >= 1000 },
  violet:  { desc: 'Earn the Flawless Defense achievement', test: p => !!p.achievements['Flawless Defense'] },
};

// Enemy types
const ENEMY_DEFS = [
  { id:'grunt',    hp:40,  speed:1.2, reward:10,  color:'#cc4444', size:10, xp:1 },  // 0
  { id:'fast',     hp:25,  speed:2.2, reward:12,  color:'#44cc44', size:8,  xp:1 },   // 1
  { id:'tank',     hp:150, speed:0.7, reward:25,  color:'#cc8844', size:14, xp:2 },  // 2
  { id:'boss',     hp:500, speed:0.5, reward:100, color:'#ff2222', size:18, xp:5 },  // 3
  { id:'swarm',    hp:15,  speed:1.8, reward:5,   color:'#cccc44', size:5,  xp:1 },   // 4
  { id:'wizard',   hp:60,  speed:0.9, reward:20,  color:'#aa44ff', size:10, xp:2 },  // 5 - heals nearby enemies
  { id:'bat',      hp:20,  speed:2.5, reward:8,   color:'#554466', size:7, flying:true, xp:1 },  // 6 - flies (ignores path curves, cuts corners)
  { id:'shield',   hp:80,  speed:0.8, reward:18,  color:'#4488cc', size:11, shield:40, xp:2 }, // 7 - absorbs first 40 dmg with shield
  { id:'necro',    hp:100, speed:0.6, reward:35,  color:'#22aa44', size:12, xp:3 },  // 8 - revives dead enemies nearby
];

// ===== BOSSES =====
// A boss is a normal enemy type wearing a BOSS_DEFS costume: bigger, far tougher,
// and driven by timed abilities. One guards the final wave of every world.
function enemySize(e) {
  return ENEMY_DEFS[e.type].size * (e.sizeMult || 1);
}

const BOSS_DEFS = [
  { id:'ironmaw',  name:'IRONMAW',        title:'Warlord of the Greenwood',   type:2, sizeMult:2.0, hpMult:14, speedMult:0.55, abilities:['slam','summon'] },
  { id:'sandwyrm', name:'THE SAND WYRM',  title:'Devourer of Caravans',       type:2, sizeMult:2.2, hpMult:16, speedMult:0.6,  abilities:['burrow','summon'] },
  { id:'hoarfrost',name:'HOARFROST',      title:'The Unmelting Crown',        type:7, sizeMult:2.0, hpMult:15, speedMult:0.5,  abilities:['barrier','freeze'] },
  { id:'cinderking',name:'THE CINDER KING',title:'He Who Burns the Sky',      type:3, sizeMult:2.2, hpMult:18, speedMult:0.6,  abilities:['rage','slam'] },
  { id:'thornqueen',name:'THE THORN QUEEN',title:'Root of the Deep Grove',    type:5, sizeMult:2.0, hpMult:16, speedMult:0.55, abilities:['regen','summon'] },
  { id:'voidmaw',  name:'VOIDMAW',        title:'That Which Eats Starlight',  type:8, sizeMult:2.1, hpMult:18, speedMult:0.5,  abilities:['barrier','summon'] },
  { id:'leviathan',name:'THE LEVIATHAN',  title:'Tide of a Drowned World',    type:2, sizeMult:2.4, hpMult:20, speedMult:0.45, abilities:['slam','regen'] },
  { id:'nulllord', name:'THE NULL LORD',  title:'Final Shadow',               type:3, sizeMult:2.5, hpMult:24, speedMult:0.55, abilities:['rage','barrier','summon'] },
];
function getBossForWorld(world) {
  return BOSS_DEFS[(world - 1) % BOSS_DEFS.length];
}
// Ability tuning. Each fires on its own cooldown while the boss is alive.
const BOSS_ABILITIES = {
  slam:    { cd: 7.0, telegraph: 1.1 },  // shockwave: damages the castle unless it's killed in time? no — stuns towers nearby
  summon:  { cd: 9.0, telegraph: 1.2 },  // calls minions to its position
  barrier: { cd: 11.0, telegraph: 0.9 }, // absorbs a chunk of damage for a while
  regen:   { cd: 8.0, telegraph: 0.8 },  // heals itself
  rage:    { cd: 0,   telegraph: 0 },    // passive: speeds up as it loses health
  freeze:  { cd: 10.0, telegraph: 1.0 }, // silences nearby towers briefly
  burrow:  { cd: 12.0, telegraph: 1.0 }, // becomes untargetable and skips ahead
};


// ===== WORLD THEMES =====
const WORLD_THEMES = [
  // 1. Greenwood (default, current look)
  {
    name: 'Greenwood',
    bgBase: '#2a3d22',
    groundTones: ['#31452a','#2d4126','#354a2c','#293a20','#3a5031','#2f4527'],
    sunlightColor: 'rgba(196,205,120,0.07)',
    dirtBase: '#6b5138',
    dirtTones: ['#6b5138','#75593c','#5f4830','#7d6244','#685036'],
    turfTones: ['#4a6238','#3d5530'],
    decorGrass: ['#2c4423','#3d5a2f'],
    flowerColors: ['#d8d055','#d8828f','#e8e0e5'],
    rockColor: '#7d7f82', rockHighlight: '#9a9c9e',
    vignetteColor: 'rgba(8,12,6,0.4)',
    castleStone: '#8b9096', castleStoneDark: '#7d8288', castleStoneLight: '#6e7378',
    castleRoof: ['#8f4a42','#a35a50','#5e2f2a'],
    castleDoor: ['#5e4426','#43301a'],
    flagColor: ['#c23a30','#8f2820'],
  },
  // 2. Scorched Desert
  {
    name: 'Scorched Desert',
    bgBase: '#c2a24d',
    groundTones: ['#cba94f','#b8963e','#d4b85c','#a88b35','#dcc56a','#bfa043'],
    sunlightColor: 'rgba(255,220,140,0.09)',
    dirtBase: '#8b6e3a',
    dirtTones: ['#8b6e3a','#9a7d44','#7a5f2e','#a4894e','#806830'],
    turfTones: ['#9e8a5a','#8d7a4c'],
    decorGrass: ['#7a6b30','#968245'],
    flowerColors: ['#e8a030','#d45030','#f0c050'],
    rockColor: '#9a7a55', rockHighlight: '#b89a70',
    vignetteColor: 'rgba(60,30,5,0.35)',
    castleStone: '#c4a870', castleStoneDark: '#b09560', castleStoneLight: '#a08550',
    castleRoof: ['#c47028','#d88838','#8a4818'],
    castleDoor: ['#6e4820','#4a3010'],
    flagColor: ['#d4a020','#a07818'],
  },
  // 3. Frozen Tundra
  {
    name: 'Frozen Tundra',
    bgBase: '#b8ccd8',
    groundTones: ['#c0d4de','#a8bcc8','#d0e0e8','#9ab0be','#c8d8e2','#b0c4d0'],
    sunlightColor: 'rgba(200,220,255,0.08)',
    dirtBase: '#8aa0b0',
    dirtTones: ['#8aa0b0','#94aab8','#7e96a6','#9eb4c2','#849cac'],
    turfTones: ['#98b8c8','#88a8b8'],
    decorGrass: ['#6890a0','#80a8b8'],
    flowerColors: ['#d0e8ff','#a0c8e8','#e8f0ff'],
    rockColor: '#90a8b8', rockHighlight: '#b0c8d8',
    vignetteColor: 'rgba(20,30,50,0.3)',
    castleStone: '#a8bcc8', castleStoneDark: '#94aab8', castleStoneLight: '#8098a8',
    castleRoof: ['#4a6a80','#5a7a90','#3a5068'],
    castleDoor: ['#4a6070','#344858'],
    flagColor: ['#4a90c0','#3470a0'],
  },
  // 4. Volcanic Hellscape
  {
    name: 'Volcanic Hellscape',
    bgBase: '#1a0a08',
    groundTones: ['#221008','#2a1410','#1e0c06','#301818','#18080a','#261210'],
    sunlightColor: 'rgba(255,80,20,0.06)',
    dirtBase: '#3a1a10',
    dirtTones: ['#3a1a10','#442018','#30140c','#4a2820','#361812'],
    turfTones: ['#4a2018','#3a1810'],
    decorGrass: ['#2a1208','#3a1a10'],
    flowerColors: ['#ff4420','#ff8030','#ffb020'],
    rockColor: '#2a2028', rockHighlight: '#3a3038',
    vignetteColor: 'rgba(10,0,0,0.5)',
    castleStone: '#3a2828', castleStoneDark: '#2e2020', castleStoneLight: '#221818',
    castleRoof: ['#601010','#802018','#400808'],
    castleDoor: ['#301010','#200808'],
    flagColor: ['#ff3010','#cc2008'],
  },
  // 5. Enchanted Grove
  {
    name: 'Enchanted Grove',
    bgBase: '#1a2838',
    groundTones: ['#1e2e40','#1a2a3a','#222e44','#162638','#243248','#1c2c3e'],
    sunlightColor: 'rgba(160,120,255,0.08)',
    dirtBase: '#3a2850',
    dirtTones: ['#3a2850','#443060','#302048','#4a3868','#362652'],
    turfTones: ['#305868','#28485a'],
    decorGrass: ['#204050','#306068'],
    flowerColors: ['#c080ff','#60e0d0','#ff80d0'],
    rockColor: '#4a3868', rockHighlight: '#6a58a0',
    vignetteColor: 'rgba(10,5,30,0.4)',
    castleStone: '#5a4878', castleStoneDark: '#4a3868', castleStoneLight: '#3a2858',
    castleRoof: ['#6030a0','#7840b0','#481888'],
    castleDoor: ['#3a2060','#281048'],
    flagColor: ['#a040e0','#7830b0'],
  },
  // 6. Deep Space
  {
    name: 'Deep Space',
    bgBase: '#08081a',
    groundTones: ['#0c0c20','#0a0a1c','#0e0e24','#080818','#101028','#0c0c1e'],
    sunlightColor: 'rgba(100,140,255,0.05)',
    dirtBase: '#303040',
    dirtTones: ['#303040','#383848','#282838','#404050','#343444'],
    turfTones: ['#282848','#202040'],
    decorGrass: ['#181838','#202848'],
    flowerColors: ['#40a0ff','#80ff80','#ff6080'],
    rockColor: '#404058', rockHighlight: '#585870',
    vignetteColor: 'rgba(0,0,10,0.5)',
    castleStone: '#484858', castleStoneDark: '#383848', castleStoneLight: '#303040',
    castleRoof: ['#2a3050','#344060','#1e2440'],
    castleDoor: ['#282838','#1a1a28'],
    flagColor: ['#4060c0','#3050a0'],
  },
  // 7. Ocean Depths
  {
    name: 'Ocean Depths',
    bgBase: '#0a2830',
    groundTones: ['#0e3038','#0c2c34','#12343c','#0a282e','#143840','#0e2e36'],
    sunlightColor: 'rgba(80,200,220,0.06)',
    dirtBase: '#2a5050',
    dirtTones: ['#2a5050','#305858','#244848','#366060','#2c5454'],
    turfTones: ['#1a4848','#143c3c'],
    decorGrass: ['#104040','#185050'],
    flowerColors: ['#ff6060','#ff9040','#40e0c0'],
    rockColor: '#305058', rockHighlight: '#406870',
    vignetteColor: 'rgba(0,10,20,0.5)',
    castleStone: '#3a5860', castleStoneDark: '#2e4c54', castleStoneLight: '#244048',
    castleRoof: ['#1a5050','#206060','#143838'],
    castleDoor: ['#1a3838','#102828'],
    flagColor: ['#20a0a0','#188080'],
  },
  // 8. Shadow Realm
  {
    name: 'Shadow Realm',
    bgBase: '#0a0a0c',
    groundTones: ['#0e0e10','#0c0c0e','#101014','#0a0a0c','#121216','#0e0e12'],
    sunlightColor: 'rgba(40,255,80,0.04)',
    dirtBase: '#1a1a20',
    dirtTones: ['#1a1a20','#1e1e26','#16161c','#22222a','#1c1c22'],
    turfTones: ['#182818','#102010'],
    decorGrass: ['#0a1a0a','#102810'],
    flowerColors: ['#30ff50','#40ff90','#80ffa0'],
    rockColor: '#282830', rockHighlight: '#383840',
    vignetteColor: 'rgba(0,0,0,0.6)',
    castleStone: '#282830', castleStoneDark: '#1e1e26', castleStoneLight: '#16161c',
    castleRoof: ['#1a2a1a','#203020','#101810'],
    castleDoor: ['#141a14','#0a100a'],
    flagColor: ['#20c040','#189030'],
  },
];

function getWorldTheme() {
  if (game && game.forcedThemeIdx !== undefined && game.forcedThemeIdx !== null) return WORLD_THEMES[game.forcedThemeIdx];
  const w = (game ? game.world : 1);
  const idx = ((w - 1) % WORLD_THEMES.length);
  return WORLD_THEMES[idx];
}

// Pristine defaults, captured before any admin-panel overrides are applied (used by "Reset to Defaults")

const ENEMY_NAMES = ['SKELETONS','GOBLINS','OGRES','DARK KNIGHT','RATS','WIZARDS','BATS','SHIELD BEARERS','NECROMANCERS'];
