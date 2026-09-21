# Castle Defense - Project Notes

## About
HTML5 canvas tower defense game ("Ben's Castle Defense"). No build step, no bundler, no server — `index.html` (markup only) loads plain CSS from `css/` and classic `<script>` files from `js/` in a fixed order. PWA sidecar files: `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`. Deployed to GitHub Pages at https://bnjmnsmmr.github.io/castledefense/

## PWA
- Installable: manifest (fullscreen, landscape) + `sw.js` (stale-while-revalidate shell cache, cache name — currently `castle-defense-v5`; bump it on meaningful releases). Registered from `js/main.js`, skipped on `file:`.
- **`sw.js` ASSETS lists every css/js file.** If you add a new module, add it there too or installed players never receive it.
- Icons drawn programmatically (canvas → PNG); regenerate by re-rendering if the brand changes.

## Architecture
- **Shared global scope, no modules.** Every file is a classic script; top-level `const`/`let`/`function` declarations are visible to every later file and to inline `onclick` handlers in index.html. There is no `import`/`export` and no namespace object — do not introduce ES modules (they would break inline handlers and change scoping).
- **Load order matters only at load time.** Functions may reference anything in any file because they run after all scripts load. Top-level *statements* (anything executed while a file loads) may only reference files above it. All boot-time calls live in `js/main.js`, which is last. Keep new load-time work there.
- **Rendering**: HTML5 Canvas (`#c`), tile-based grid (COLS x ROWS, TILE=40px).
- **Game state**: `game` object initialized by `initGame()`, started by `startGame(resume)`.
- **Persistence**: `localStorage` for saves (`castleDefenseSave`), admin config (`castleDefenseConfig`), skins (`castleDefenseSkins`), daily best (`castleDefenseDailyBest`), lifetime profile (`castleDefenseProfile`), local board (`castleDefenseHallOfFame`), leaderboard identity (`castleDefenseIdentity`), saved level codes (`castleDefenseLevels`).
- **Optional backend**: `server/` (Cloudflare Worker + D1) powers the global leaderboard; the game runs fully standalone without it.
- **Deployment**: GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) — pushes to main auto-deploy the whole repo.

## Module map (load order = this order)
| File | Owns |
|---|---|
| `css/base.css` | `:root` design tokens, HUD, tower bar, buttons, toasts, banners |
| `css/screens.css` | Every overlay/panel: start/results, pause, admin, merchant, guardian, home, community, customize, achievements, Hall of Fame, leaderboard, tutorial coach marks |
| `css/responsive.css` | Mobile / short-screen / coarse-pointer media queries |
| `js/config.js` | **Pure data.** `TILE/COLS/ROWS`, `ALL_PATHS`, `DIFFICULTY`, `TOWER_TYPES`, `WALL_TYPES`, `TOWER_INFO`, `SKIN_PALETTE`, `ADJECTIVES/NOUNS`, `ACHIEVEMENT_DEFS`, `SKIN_UNLOCKS`, `ENEMY_DEFS`, `BOSS_DEFS`, `BOSS_ABILITIES`, `WORLD_THEMES`, `ENEMY_NAMES`. New tunables go here. |
| `js/core.js` | Canvas `C`/`ctx`, `game`, `$id()` DOM cache, lane helpers (`isPath`, `wallAt`…), admin overrides (`loadConfigOverrides`), run save (`saveGameState`/`requestSave`/`loadGameState`), `profile`, skins runtime, Hall of Fame, leaderboard client |
| `js/audio.js` | Music (`WORLD_MUSIC`, `startMusic`), SFX engine (`SFX`, `sfxTone`, `sfxNoise`), UI click sound |
| `js/render-world.js` | `WALL_SPRITES`, `TOWER_SPRITES`, `resize`, ground cache, `drawCastle`, `drawWalls`, `drawTowers`, placement ghosts |
| `js/render-enemies.js` | Offscreen buffer compositing, `ENEMY_DRAWERS`, one `drawX()` per enemy type |
| `js/render-fx.js` | Projectiles, particles, shockwaves, boss bar, damage numbers, shake, hero, nugget, crates, wave notice |
| `js/waves.js` | `getWave(n)` composition table + endless generator, `pathToPixels`, `sendWave`, `spawnWave`, auto-wave |
| `js/game.js` | `initGame`/`startGame`, `loop`/`update`/`render`, speed/pause, boss abilities, `damageEnemy`, `updateUI`, `endGame`, wall placement, crates |
| `js/feat-relics.js` | Relic draft between worlds — `RELICS` pool, `openRelicDraft`/`pickRelic`, `hasRelic`/`relicMult`, `renderRelicTray`/`renderRelicChips` |
| `js/screens.js` | Home, tutorial, daily challenge, customize, achievements gallery, leaderboard UI, community levels, save-layout flow, share |
| `js/admin.js` | Admin tuning panel |
| `js/ui.js` | Guardian merchant, `notify`/`showFlash`, `showBannerText`, build tabs + `buildTowerBar` |
| `js/input.js` | Canvas mouse/touch, keyboard, secret combos |
| `js/main.js` | Boot only: `loadConfigOverrides()`, `applySkinSelections()`, `buildTowerBar()`, `renderHomeScreen()`, SW registration |

## Performance conventions
- Per-frame code uses `$id('x')` (cached) instead of `document.getElementById`. Only for elements in the static markup; anything rebuilt via `innerHTML` must be looked up fresh.
- `updateUI()` calls `requestSave()`; the loop flushes to localStorage at most once per second via `flushSaveIfDue`. Call `saveGameState()` directly only where the save must land immediately (pause, quit, `beforeunload`).
- Ground is pre-rendered to an offscreen canvas (`buildGroundCache`) and only rebuilt when the active lane set or theme changes. Enemy sprites composite through shared offscreen buffers.

## Smoke test
`python3 -m http.server 8123` then drive `http://localhost:8123/index.html` with Playwright (Chromium is preinstalled in the remote env): load, `startGame(false)`, dispatch two clicks on a grass tile to place a tower, `sendWave()`, wait, assert no `pageerror`. A `net::ERR_CONNECTION_RESET` for fonts.googleapis.com is the sandbox, not the game.

## Per-world lane layouts
- `js/feat-maps.js` — `WORLD_MAPS[0..7]` gives each world its own lane set instead of everyone sharing one `ALL_PATHS`. Index 0 (`The Old Road`) is literally a reference to the original `ALL_PATHS` array from `js/config.js`, so World 1 and the tutorial are pixel-identical to before. `ALL_PATHS` is `let` in `js/config.js` specifically so this file can reassign it.
- `applyWorldMap(world)` swaps `ALL_PATHS = WORLD_MAPS[(world-1) % 8].lanes`, stamps `game.mapName`, and nulls `groundCache`. It does **not** touch `pathSet`/`game.activePaths` — every call site already recomputes those right after with the correct wave, so it just makes sure they read from the right map when they do. Called from `initGame()`, `startGame(resume)` (after `game.world` is known, before the saved wave's paths are derived), the world-advance branch of `update()` (before `getActivePaths` runs), and `startLevelFromPayload()` for community level codes.
- `refundMisplacedBuildables()` is only wired at the world-advance point — the one place a run can be mid-flight when the map swaps. It refunds, at full price, any tower now sitting on a path/castle tile and any wall no longer on the new path, then flashes `"Terrain shifted — N towers refunded"`.
- Every lane still must end `…[27,8],[28,8],[29,8]` and only touch castle tiles (`x>=28, y in 6..10`) in that final approach — `tools/test-maps.js` asserts adjacency, bounds, and that on every world.
- Each map has a distinct lane character matching its `WORLD_THEMES` theme (not the same names — `game.mapName` shows in the world-clear banner alongside the theme name): Spiral Dunes (Desert, 3 coiling lanes), Twin Ice Roads (Frozen, two parallel lanes merging late + a late ridge), Crossfire Passes (Volcanic, lanes sharing/crossing ground), The Weaving Thicket (Grove, 3 interleaved S-curves), Four-Front Assault (Space, 4 short direct lanes from every edge), The Long Current (Ocean, one very long snake + a medium + a late short lane), Shadowfall Funnel (Shadow, all lanes converge into the same 3-tile chokepoint before the gate).

## Walls (barricades)
- `WALL_TYPES` (Palisade / Rampart / Stone / Bulwark) — built **on the path**, which is the opposite of towers. `game.walls` holds `{tx, ty, type, hp, maxHp}`; persisted in the save.
- **They do not reroute anything.** This game runs on fixed lanes (`ALL_PATHS`) with no pathfinding, so walls physically stop the horde, which then smashes through. That buys towers free seconds against a bunched-up crowd — that IS the mechanic. Adding rerouting would mean A* plus maze-TD rules and is a different game.
- Blocking lives in the enemy move loop: if `wallAt()` finds a wall on the *next* path tile, the enemy stops and `damageWall(w, wallDps(e) * dt)`. Flying enemies (`def.flying`) and burrowed bosses (`e.untargetable`) pass straight over.
- `wallDps(e)` scales with `enemySize(e)`; bosses hit 6×. `damageWall` guards with `w.destroyed` so two enemies finishing the same wall in one frame can't double-splice.
- Placement rules in `canPlaceWall()`: path only, not the castle, not a lane's spawn tile, not on a tower or existing wall, and not on a tile an enemy currently occupies. Selling refunds pro-rata by remaining HP.
- UI: `#build-tabs` toggles `game.buildMode` between `'tower'` and `'wall'`; `buildTowerBar()` renders whichever is active. Hotkeys Q/W/E/R pick walls (and flip the mode), 1-8 flip back to towers. Tunable in the admin panel.

## Bosses
- `BOSS_DEFS` — one named boss per world (cycles past 8), spawned on the **final wave of each world** (`spawnWave`); excluded from the Daily Challenge, which is meant to be a short sharp gauntlet.
- A boss is a normal enemy type wearing a costume: `sizeMult` / `hpMult` / `speedMult` plus an `abilities` list. `enemySize(e)` returns the per-enemy size (never read `ENEMY_DEFS[..].size` directly for a live enemy).
- Abilities (`BOSS_ABILITIES`, `fireBossAbility`): `slam` + `freeze` knock towers offline (`t.stunned`), `summon` calls minions, `barrier` grants a damage shield, `regen` heals, `burrow` sets `e.untargetable` (towers and projectiles skip those), `rage` is a passive speed-up as HP drops.
- Each cast is telegraphed (`b.castT` / `castLabel`) on the on-screen boss bar (`drawBossBar`). Shockwave rings via `game.shockwaves` / `updateDrawShockwaves`.
- A boss reaching the castle costs **5 hearts**, not 1. Killing one pays a bounty + a permanent "Slayer of X" trophy.

## First-run tutorial
- `TUTORIAL_STEPS` + coach-mark overlay (`#coach`): a spotlight ring over a target element plus a message card. Steps advance on **real player actions** via `tutorialEvent(kind)` — `select` / `place` / `send` / `kill` / `upgrade` — never on timers.
- Runs once for a brand-new player (`tutorialShouldRun()` checks `profile.stats.gamesPlayed` / `profile.tutorialDone` only — do NOT check `loadGameState()` here, `updateUI()` writes a save before the tutorial starts). Replayable from the home screen (`replayTutorial()`), skippable.

## Hall of Fame & sharing
- `castleDefenseHallOfFame`: top 10 local runs (`recordHallOfFame` returns the 1-based rank, shown as a badge on the results screen). Rendered by `buildHallOfFame()`.
- `shareRun()` uses the Web Share API when available, else copies to clipboard.
- The Hall of Fame screen has two tabs driven by `buildLeaderboard()` — local (`buildHallOfFame`) and global (`buildGlobalBoard`).

## Global leaderboard
- **Off by default.** `LEADERBOARD_API` is an empty string in index.html; the game behaves exactly as before and the GLOBAL tab explains how to switch it on. Set it to a deployed Worker URL to enable.
- Backend lives in `server/` — Cloudflare Worker + D1. See `server/README.md` for the ~5-minute deploy and the anti-cheat/privacy reasoning.
- **No PII, by construction.** No accounts, no free text. A player is an opaque `castleDefenseIdentity` token generated in-browser plus a codename that is only ever *indices* into `ADJECTIVES`/`NOUNS` + a 4-digit number, validated the same way server-side — so arbitrary text cannot reach the database. This is why there is no "enter your name" box; players reroll instead (`rerollCodename()`). **Keep the word lists in index.html and server/worker.js in sync.**
- Submission is fire-and-forget on game over; any network failure silently leaves the local Hall of Fame as the record. Never block UI on it.
- Server rejects implausible runs (score must equal `(world-1)*15+wave`, bounded kills/bosses/duration) and rate-limits on token + hashed IP. Client-authoritative scores can never be fully trusted — see the README before treating the board as competitive.
- Render server-supplied values defensively: names via `textContent`, numbers via `Number()` coercion.

## Meta-progression (lifetime profile)
- `castleDefenseProfile` in localStorage: lifetime stats (totalKills, wavesCleared, bestScore/World/Wave, gamesPlayed), global achievement record, notified-skin list. `profile` / `saveProfile()` / `loadProfile()`.
- `ACHIEVEMENT_DEFS` is the canonical gallery list (secrets show as "???" until earned); `unlockAchievement()` records globally too. Gallery screen: `openAchievementsScreen()` (`#achievements-panel`).
- Skins are trophies: `SKIN_UNLOCKS` maps palette ids to lifetime conditions (`isSkinUnlocked()`); locked skins are greyed in Customize; `checkSkinUnlockNotifications()` toasts new unlocks after waves/achievements.

## Next-wave intel panel
- `js/feat-intel.js` owns `#wave-intel`, docked just above the SEND WAVE button during `game.prepPhase`: an icon row (enemy sprites drawn once via `ENEMY_DRAWERS` into cached offscreen canvases, `×count`, hover title = name + trait), a lane chip strip (`ALL_PATHS`, pulses `.new-route` when `getActivePaths(wave)` grew), a boss warning on the final wave of a world (name + `BOSS_ABILITY_LABEL`d abilities), and a rough HP-vs-DPS "Comfortable/Tight/Danger" estimate — all computed by `computeWaveIntel()` from `getWave(game.wave)`.
- Updated via `updateWaveIntel()` at every site `game.prepPhase` becomes `true` (`startGame`/`update()` in js/game.js, `startDailyChallenge()` in js/screens.js), hidden via `hideWaveIntel()` in `sendWave()` (js/waves.js) and `setGameChromeVisible(false)` (js/screens.js) — not polled per-frame.
- `drawIntelMapHints()` is called from `render()` every frame during prep: a pulsing glow/arrow at a newly-unlocked lane's spawn tile plus a dashed preview of that lane.
- Collapsible (`toggleWaveIntelCollapsed()`), remembered in `castleDefenseIntelCollapsed`. At `max-height:620px` only the icon row shows; at `max-width:1000px` it shrinks but never overlaps the tower bar or SEND WAVE.

## Mobile / touch
- `IS_TOUCH` (pointer: coarse). Canvas taps use a two-tap confirm: first tap arms `game.pendingTile` + shows ghost/range, second tap on the same tile executes (build/upgrade/sell).
- Canvas click handler computes tile coords from the event (never rely on mousemove).
- Responsive media queries (`max-width: 1000px` / `max-height: 620px`) shrink HUD, tower cards, buttons; tooltips + keyboard hints hidden on coarse pointers.

## Enemy rendering
- `drawEnemies()` paints each character into a shared offscreen buffer (`enemyBufCv`), builds an ink silhouette (`enemyOutCv`), and composites outline-under-sprite for a unified comic-style look. Drawer fns target the global `ctx` (declared `let` so it can be retargeted). `ENEMY_DRAWERS` maps type index → drawer.
- Enemies pop in via `spawnT`; bosses (size ≥ 16) get a framed HP bar; first Dark Knight of each wave triggers a banner + horn + shake (`game.bossAnnounced`).

## Enemy affixes / elites
- `js/feat-affixes.js`. From wave 6 onward (counted continuously as `(world-1)*wavesPerWorld + wave`), each non-boss spawn has a `DIFFICULTY.affixChance` (0.12 base, +0.02/world, capped 0.35) chance to roll one affix from `AFFIX_DEFS`: `armored`, `hasty`, `splitter`, `thief`, `sapper`, `vampiric`, `shielded`. Rolled in `affixMaybeApply(ent)`, called right before the enemy is pushed in `update()`'s spawn block (js/game.js). Bosses (`ent.boss`) never roll.
- Hooks: `damageEnemy(e, dmg, source)` now takes an optional `source` (a tower id, threaded through direct-hit projectiles via `p.towerId`) and calls `affixModifyDamage`/`affixOnDeath`; the castle-reach branch calls `affixOnReachCastle`; `wallDps(e)` (js/core.js) multiplies by `affixWallDpsMult(e)`; `drawEnemies()` (js/render-enemies.js) calls `drawAffixAura(e)` before compositing and `drawAffixTag(e)` after.
- Rewards: affixed kills pay +50% gold and +1 xp (on top of the normal reward), tracked via `game.affixKills`; hitting 50 in a run unlocks "Elite Hunter" (`ACHIEVEMENT_DEFS`). First sighting of each affix in a run fires an `notify('epic', …)` toast (`game.affixesSeen`).
- Rendering caps at 30 name tags on screen per frame (`AFFIX_TAG_LIMIT`) to avoid clutter with big waves.

## Sound
- Music is themed per world: `WORLD_MUSIC` (mode/register/oscillator/pacing per theme), read by `getWorldMusic()` each drone/melody cycle so the score shifts automatically on world change.
- Shared WebAudio engine (`sfxContext()`, `sfxTone()`, `sfxNoise()`, `SFX.play(name)`) — one AudioContext + master gain for all effects, per-sound throttling. All procedural, zero assets.
- Per-tower firing sounds (`shot_<towerId>`), kill/coin/hurt/place/sell/upgrade/error/horn/clear/flawless/unlock effects, soft UI click on every button.
- Music (ambient drone + melody) has its own context; the 🔊 button mutes both music and SFX.

## Elemental combos
- `js/feat-combos.js` — bonus damage when one tower's status effect (slow / poison / burn) is capitalized on by a different tower's hit. Hooked with one line at the top of `damageEnemy(e, dmg, source)` in `js/game.js`: `dmg = comboOnHit(e, dmg, source);`. `source` is the firing tower's `TOWER_TYPES` id, passed at each attack call site (tesla chain, flame cone) or tagged onto the projectile as `p.src` at creation and read back at impact.
- Status is read from existing fields: `e.slowed > 0` (ice), and `e.dotTimer > 0` + `e.dotSrc` (which tower applied the current burn/poison tick — `'poison'` / `'flame'` / `'cannon'`; `e.dotSrc` is a new field set alongside every existing `e.dotTimer` assignment).
- `COMBO_DEFS` in the feat file holds the tunable multipliers. SHATTER (Cannon/Mortar vs slowed, ×1.5, clears the slow), IGNITE (Flame/Cannon vs poisoned, consumes the DoT into a 3× instant AoE burst), CONDUCT (Tesla vs slowed, extra 50% dmg to the 2 nearest other enemies within 90px), BRITTLE (Sniper vs burning, ×2). Each enemy has a 0.5s internal cooldown (`e._comboCdUntil`) so Flame's fast ticks can't re-proc every frame.
- OVERGROWTH: in the Enchanted Grove world only (`getWorldTheme().name` contains "Grove"), an active poison tick always spreads to the nearest un-poisoned neighbor — hooked with one line (`overgrowthSpread(e);`) from the poison DoT tick loop.
- `game.combos` counts combos triggered this run; achievements "Alchemist" (50 in a run) and "Chain Reaction" (an IGNITE hitting 5+ enemies). Popup text via `spawnDamageNum(..., 'combo')` (pink, added to the size/color maps in `js/render-fx.js`), a bright `sfxTone` chime, and a "COMBOS" stat card on the results screen (`renderComboStat()`, one line from `endGame()`). Tower tooltips show a one-line `⚡` combo hint from `TOWER_INFO[id].combo`.

## Resource economy
- **Wall cost scaling**: `DIFFICULTY.wallCostScale` (default 0.15 = 15% per world). `getWallCost(typeIdx)` returns `Math.floor(baseCost * (1 + (world-1) * wallCostScale))`. Walls store `buyCost` at placement time so sell refunds are accurate even if world changes.
- **Gold Mine tower**: income tower (key `0`). Generates `DIFFICULTY.goldMineRate` gold/sec (default 2), scaling +50% per upgrade level. No targeting, no projectiles — the update loop `continue`s past combat for `base.income` towers. Shows a floating +gold number every second.
- **Supply Crates**: `spawnSupplyCrates()` runs at the start of every prep phase. 1-3 crates (more in later worlds) on random empty non-path tiles. Click to collect (`collectCrate(tx, ty)` → bonus gold + coin SFX + particles). Crates clear when the wave starts.
- Achievements: "Gold Rush" (place 3 Gold Mines), "Crate Hoarder" (collect 20 crates in a run). Tracked via `game.goldMinesPlaced` / `game.cratesCollected`.
- All new economy values are tunable in the admin panel under "Upgrades & economy", along with `manaPerKill`/`manaRegen`, `affixChance`, `stormWaveLength`/`stormScoreBonusPerStorm`.

## Tower targeting & inspect card
- `js/feat-targeting.js` owns per-tower targeting priority and the tower inspect card. `t.targetMode` is one of `'first'/'last'/'strong'/'weak'/'near'` (path progress furthest/least, HP highest/lowest, or nearest-in-range — the old default). `pickTarget(t, def, cx, cy)` replaces the inline nearest-enemy scan in `update()` (js/game.js); `getTargetMode(t)` lazily assigns a per-tower default the first time it's read (`DEFAULT_TARGET_MODE_BY_ID`: Sniper → `strong`, Ice → `first`, everything else → `near`) so old saves and community-level codes without the field still work. Persisted as one field in `saveGameState`/`startGame(resume)` (js/core.js, js/game.js) and in community level codes (`buildLevelPayload`/`startLevelFromPayload`, js/screens.js), validated against `TARGET_MODES` on load.
- Clicking an existing tower (desktop click or the second touch tap) shows `#tower-card` — name/level, kills, damage dealt, a cycling TARGET MODE button, and a Sell button — without changing the existing upgrade-on-click behavior; the card is purely informational. Desktop also shows it on hover (`handleTowerHoverUpdate()`, gated on the hovered tower actually changing). Hotkey **T** cycles the target mode of `game.selectedTowerRef` (the last tower the card was shown for). `setGameChromeVisible(false)` hides the card (covers game-over and return-to-menu).
- `t.kills` / `t.dmgDealt` are tracked by an optional `source` param on `damageEnemy(e, dmg, source)`, threaded through every tower attack path (tesla chain/arc, flame cone, arrow/sniper/standard projectiles via `projectile.source`, poison DoT ticks via `enemy.dotSource`). The results screen adds a "MVP TOWER" stat card via `renderMvpCard()` (one hook in `endGame`, js/game.js) when any tower dealt damage.
## Structured endless & storm mutators
- `js/feat-storms.js`: worlds 1-8 are the campaign; from world 9 on `endlessWaveNumber()` maps each per-world wave onto a continuous counter starting at 31 (also reached by a single world configured longer than 30 waves), and `getWave(n)` calls `endlessWave(n, ...)`, which groups waves into deterministic 5-wave **storms** — a themed enemy mix (`STORM_THEMES`: Swarm/Iron/Night/Siege) plus a run-wide **mutator** (`STORM_MUTATORS`: Fog, Blood Moon, Plague, Quake, Frenzy, Gold Rush, Eclipse). Storm 1 is always Swarm Storm + Fog; later storms are picked by `stormFor(n)` from a `mulberry32` stream seeded off `game.runSeed` (or `game.dailySeed` in Daily Challenge) — fully deterministic per seed, never `Math.random()`.
- Mutators apply as pure multiplier/query helpers at their existing call sites: `stormRangeMult()` (tower targeting range), `stormHpMult()`/`stormSpeedMult()` (enemy spawn), `stormGoldMult()` (kill gold), `stormWallDmgMult()` (`wallDps`), `stormCrateMult()` (`spawnSupplyCrates`), `stormTowerOffline(id)` (Eclipse — skipped in the tower loop).
- The final (5th) wave of each storm gets a mini-boss via `addStormMiniBoss()`, hooked into `spawnWave()`'s existing final-world-boss branch as the `else` case — it reuses `getBossForWorld`/`BOSS_DEFS` at reduced HP, so it never collides with the real world-ending boss fight.
- `sendWave()` calls `announceStormIfNew()` (banner + `#storm-chip` HUD pill); `render()` calls `drawStormOverlay()` for a faint per-mutator screen tint. Surviving a storm's last wave (`checkStormComplete`, hooked where `game.wave` is about to increment) raises `game.stormMult` (a display-only bonus, `stormScoreBonus()`) shown as a "STORM BONUS" card on the results screen — it never changes the `(world-1)*wavesPerWorld+wave` score the leaderboard validates. Achievements: "Storm Chaser" (3 storms), "Eye of the Storm" (survive an Eclipse storm).
## Run modifiers
- `js/feat-modifiers.js` — home-screen challenge toggles (No Walls, Half Gold, Iron Castle, Double Time, Glass Towers, Fog of War), each with a score multiplier (`MODIFIER_DEFS`), stacked multiplicatively and capped at ×3 (`modifiersMultiplier`). Selection persists in `castleDefenseModifiers` (localStorage) and is only read into effect for a genuine new run.
- `ACTIVE_RUN_MODIFIERS` is the live, run-scoped flag `modActive(id)` checks; it's set by `beginRunModifiers(resume)` (called from `startGame`, `null` on resume) and explicitly cleared by `startDailyChallenge`/`startLevelFromPayload` so Daily Challenge and Community Levels never inherit it. `initGame()` reads it once to seed `game.hp`/`game.gold`/`game.modifiers`/`game.scoreMult`; a resumed run instead calls `restoreRunModifiers(saved)` to keep the modifiers it was saved with.
- Effect hooks: `canPlaceWall`/`updateBuildTabs`/`buildTowerBar` (no_walls), `modGoldMult()` multiplied at every gold-add site (half_gold), `spdMult` in `getWave()` (double_time), `modTowerCost()` at the tower cost reads in `js/ui.js`/`js/input.js` plus a zeroed sell refund (glass_towers), `drawWaveNotice()`/`showWaveBanner()` early-outs (fog_of_war).
- Persisted on the run (`game.modifiers`, `game.scoreMult`) and in the save (`saveGameState`); carried into the Hall of Fame entry and rendered as chips (`renderModifierChips`, reusing `.hof-tag`) and a results-screen stat card (`renderModifierResult`). Included in the payload to `submitScoreToLeaderboard` for a future server to read — the validated `score` field itself is untouched. "Handicapped Hero" achievement: clear World 1 with 3+ modifiers active.

## Features
- 9 towers (+1 secret Annihilator via B→N key combo) with level-2 signature attacks and a level-3 specialization branch each, including the Gold Mine (income tower)
- Per-tower targeting priority (First/Last/Strong/Weak/Near) with an inspect card, tower kill/damage stats and an MVP card on the results screen
- Elemental combos between towers (Shatter, Ignite, Conduct, Brittle, Overgrowth)
- Castle Powers: four mana-fuelled active spells (Fireball, Rally, Frost, Repair) on hotkeys F/G/V/H
- Relic draft after every world clear (roguelite perks), enemy affixes/elites from wave 6, per-world lane layouts
- Next-wave intel panel in the prep phase; run modifiers with score multipliers; structured endless storms after world 8
- 4 wall types built on the path — enemies stop and smash through them, flyers pass over
- 9 enemy types across escalating worlds, plus 8 named bosses (one per world, final wave)
- 8 distinct world themes (Medieval, Frozen, Desert, Deep Space, Ocean, Volcanic, Enchanted Grove, Shadow Realm)
- Home screen with animated title and menu
- Daily challenge mode (date-seeded, fixed difficulty)
- Tower customization (4 color skins per tower)
- Secret cheats: BN (Annihilator), GG (+500 gold), ASDF (rapid fire 30s), ZAP (lightning strike all enemies)
- Auto-wave, achievements, admin panel for tuning difficulty
- Game speed toggle (1×/2×/3×, persisted in save), pause menu (P key or ⏸ button), Space sends the wave
- Flawless-wave bonus gold + "Flawless Defense" achievement; wave-cleared banner shows earnings; gold popups on kills
- Results screen on game over: stat cards (waves/kills/towers/achievements) with lifetime deltas from `game.profileStart`, NEW PERSONAL BEST badge, chips for achievements earned that run
- Home/pause/game-over overlays are translucent with backdrop blur over the live map; HUD + tower bar hide while menus are up (`setGameChromeVisible`)
- Global leaderboard (optional, off until a Worker URL is configured) with anonymous codenames, Today/Week/All-time boards, and your rank on the results screen
- OG/Twitter Card meta tags with branded og-image.png

## Castle Powers (active spells)
- `js/feat-powers.js` (loaded after `js/game.js`, before `js/screens.js`). Four active spells on a shared `game.mana` (0-100) bar: 🔥 Fireball (F, 35 mana, 12s cd, 90px blast), ⚡ Rally (G, 25 mana, 20s cd, reloads every tower + 30% fire rate for 5s via `game.rallyTimer`), ❄️ Frost (V, 30 mana, 18s cd, sets `e.slowed` + `e.slowStrength = 0.6` on every enemy — `slowSpeedMult()` takes the stronger of the ice slow and `slowStrength`, which clears when the slow expires), 🔨 Repair (H, 40 mana, 25s cd, full-heals `game.walls` + 1 heart).
- Mana charges from kills (`DIFFICULTY.manaPerKill`, default 4; bosses +25, via a hook in `damageEnemy`) and `DIFFICULTY.manaRegen`/s (default 2) while a wave is active — not during prep, when only Repair is usable.
- `#powers-bar` (vertical stack, right edge; horizontal above the tower bar under ~1000px/620px) is built once by `buildPowersBar()` and refreshed each frame by `updatePowersBar(dt)` (called from `loop()`), which only touches the DOM when the rounded mana value or a cooldown's ceiling second changes.
- Fireball is a targeted power: `castPower('fireball')` arms `game.powerTargeting = 'fireball'`, drawn as a range ring by `drawPowerTargeting()` (hooked into `render()`); the next canvas click is consumed by `powerHandleCanvasClick()`, hooked at the top of the click handler in `js/input.js`. Escape cancels.
- State (`mana`, `powerCooldowns`, `powersCast`) persists in the run save (`saveGameState()`/`startGame(resume)`) with backward-compatible `|| 0` / `|| {}` defaults. "Archmage" achievement fires at 25 casts in a run.
## Relics (roguelite draft)
- `js/feat-relics.js` — on every world clear (never in Daily Challenge) the prep phase pauses and `#relic-draft` offers 3 of the 15 `RELICS` (click or keys 1/2/3). Picks persist as `game.relics` (id array), saved/restored via `saveGameState()`/`startGame(resume)`, and render as icons in the top-left `#relic-tray` (native `title` tooltip) and as chips on the results screen (`renderRelicChips`).
- Effects are read passively through `hasRelic(id)` / `relicMult(kind)` / `getSellRefundRate()`, wired into existing systems via tiny hooks: tower stats (`applyRelicTowerDef`), ice slow stacking (`applyIceSlow`/`slowSpeedMult`), gold-from-kills, Gold Mine income, wall cost, sell refund, crate gold. `updateRelics(dt)` (called once from `update()`) drives the two passive per-frame relics: Masons' wall regen and Quartermaster's bonus mid-wave crate.
- `second_wind` is checked in `trySecondWind()` where hearts would hit 0 — survives at 1 heart, once per world (tracked by `game.secondWindUsedWorld`). "Collector" achievement unlocks at 5 held relics.
- While the draft overlay is open, a keydown listener registered before `js/input.js`'s (load order matters) swallows every key via `stopImmediatePropagation` so game hotkeys can't fire underneath; `sendWave()` also no-ops on `game.relicDraftActive`.
- `fortify` raises `game.maxHp` (persisted); `updateUI()` rebuilds the HP pips in groups of 5 whenever max hearts change, and Repair/castle damage states read `game.maxHp`.

## Conventions
- No build tools — edit index.html directly
- Use CSS variables from `:root` for colors
- Tower colors come from skin system (`getTowerSkin()` / `applySkinSelections()`)
- World theme colors via `getWorldTheme()`
- `showFlash(msg)` for in-game notifications
- `unlockAchievement(name, sub)` for achievement toasts
- `spawnParticles(x, y, color, count)` for particle effects

## Tower specialization branches
- `js/feat-branches.js` (loaded between `js/game.js` and `js/screens.js`). `TOWER_BRANCHES[towerId]` is a `[{id, name, desc, apply(t,def)}, {...}]` pair per tower (arrow/cannon/ice/sniper/tesla/flame/mortar/poison/goldmine).
- At level 3, the upgrade click in `js/input.js` opens `#branch-chooser` (built/injected by the feat file, `game.paused=true` while open) instead of applying the level-up; picking a card (click, or keys `1`/`2`) spends the point, sets `t.branch`, and resumes. `Esc` defers — level stays at 2, nothing is spent, try again later.
- Stat-only branches mutate `def` via `branchModifyDef(t, def, base)`, hooked once per tower per frame in `update()` right after the level-based `def` is built. Non-stat branches have dedicated hooks: `branchFrostNovaPulse` (ice, every 4th shot), `branchProjectileDmg` (mortar Bunker Buster vs size≥14), a `damageEnemy` wrap for Wildfire (flame) death-spread, and `applyBankInterest()` called on wave-clear for Gold Mine's Bank branch. Poison's Plague widens the existing infection spread (radius/chance) by checking `e.branch`.
- `t.branch` persists in `saveGameState`/`startGame(resume)` (`js/core.js`, `js/game.js`) and in community level codes (`js/screens.js`, revalidated against `TOWER_BRANCHES` on load since level codes are untrusted).
- `drawBranchBadge(t, cx, cy)` hook in `drawTowers()` (`js/render-world.js`) draws a small star/diamond glyph for branch index 0/1.
- Achievement "Specialist": branch 5 towers in one run (`game.branchesChosen`).
- Cannon's "Siege" is implemented as `rate /= 0.7` (≈1.43× slower) because `rate` is cooldown seconds; the inspect card shows the branch name next to the level.
