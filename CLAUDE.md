# Castle Defense - Project Notes

## About
HTML5 canvas tower defense game ("Ben's Castle Defense"). No build step, no bundler, no server — `index.html` (markup only) loads plain CSS from `css/` and classic `<script>` files from `js/` in a fixed order. PWA sidecar files: `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`. Deployed to GitHub Pages at https://bnjmnsmmr.github.io/castledefense/

## PWA
- Installable: manifest (fullscreen, landscape) + `sw.js` (stale-while-revalidate shell cache, cache name — currently `castle-defense-v3`; bump it on meaningful releases). Registered from `js/main.js`, skipped on `file:`.
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
- All new economy values are tunable in the admin panel under "Upgrades & economy".

## Tower targeting & inspect card
- `js/feat-targeting.js` owns per-tower targeting priority and the tower inspect card. `t.targetMode` is one of `'first'/'last'/'strong'/'weak'/'near'` (path progress furthest/least, HP highest/lowest, or nearest-in-range — the old default). `pickTarget(t, def, cx, cy)` replaces the inline nearest-enemy scan in `update()` (js/game.js); `getTargetMode(t)` lazily assigns a per-tower default the first time it's read (`DEFAULT_TARGET_MODE_BY_ID`: Sniper → `strong`, Ice → `first`, everything else → `near`) so old saves and community-level codes without the field still work. Persisted as one field in `saveGameState`/`startGame(resume)` (js/core.js, js/game.js) and in community level codes (`buildLevelPayload`/`startLevelFromPayload`, js/screens.js), validated against `TARGET_MODES` on load.
- Clicking an existing tower (desktop click or the second touch tap) shows `#tower-card` — name/level, kills, damage dealt, a cycling TARGET MODE button, and a Sell button — without changing the existing upgrade-on-click behavior; the card is purely informational. Desktop also shows it on hover (`handleTowerHoverUpdate()`, gated on the hovered tower actually changing). Hotkey **T** cycles the target mode of `game.selectedTowerRef` (the last tower the card was shown for). `setGameChromeVisible(false)` hides the card (covers game-over and return-to-menu).
- `t.kills` / `t.dmgDealt` are tracked by an optional `source` param on `damageEnemy(e, dmg, source)`, threaded through every tower attack path (tesla chain/arc, flame cone, arrow/sniper/standard projectiles via `projectile.source`, poison DoT ticks via `enemy.dotSource`). The results screen adds a "MVP TOWER" stat card via `renderMvpCard()` (one hook in `endGame`, js/game.js) when any tower dealt damage.

## Features
- 9 towers (+1 secret Annihilator via B→N key combo) with level-2 upgrades, including the Gold Mine (income tower)
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
- `js/feat-powers.js` (loaded after `js/game.js`, before `js/screens.js`). Four active spells on a shared `game.mana` (0-100) bar: 🔥 Fireball (F, 35 mana, 12s cd, 90px blast), ⚡ Rally (G, 25 mana, 20s cd, reloads every tower + 30% fire rate for 5s via `game.rallyTimer`), ❄️ Frost (V, 30 mana, 18s cd, sets `e.slowed` on every enemy — reuses the Ice tower's fixed 50% slow, not a separate magnitude), 🔨 Repair (H, 40 mana, 25s cd, full-heals `game.walls` + 1 heart).
- Mana charges from kills (`DIFFICULTY.manaPerKill`, default 4; bosses +25, via a hook in `damageEnemy`) and `DIFFICULTY.manaRegen`/s (default 2) while a wave is active — not during prep, when only Repair is usable.
- `#powers-bar` (vertical stack, right edge; horizontal above the tower bar under ~1000px/620px) is built once by `buildPowersBar()` and refreshed each frame by `updatePowersBar(dt)` (called from `loop()`), which only touches the DOM when the rounded mana value or a cooldown's ceiling second changes.
- Fireball is a targeted power: `castPower('fireball')` arms `game.powerTargeting = 'fireball'`, drawn as a range ring by `drawPowerTargeting()` (hooked into `render()`); the next canvas click is consumed by `powerHandleCanvasClick()`, hooked at the top of the click handler in `js/input.js`. Escape cancels.
- State (`mana`, `powerCooldowns`, `powersCast`) persists in the run save (`saveGameState()`/`startGame(resume)`) with backward-compatible `|| 0` / `|| {}` defaults. "Archmage" achievement fires at 25 casts in a run.
## Relics (roguelite draft)
- `js/feat-relics.js` — on every world clear (never in Daily Challenge) the prep phase pauses and `#relic-draft` offers 3 of the 15 `RELICS` (click or keys 1/2/3). Picks persist as `game.relics` (id array), saved/restored via `saveGameState()`/`startGame(resume)`, and render as icons in the top-left `#relic-tray` (native `title` tooltip) and as chips on the results screen (`renderRelicChips`).
- Effects are read passively through `hasRelic(id)` / `relicMult(kind)` / `getSellRefundRate()`, wired into existing systems via tiny hooks: tower stats (`applyRelicTowerDef`), ice slow stacking (`applyIceSlow`/`slowSpeedMult`), gold-from-kills, Gold Mine income, wall cost, sell refund, crate gold. `updateRelics(dt)` (called once from `update()`) drives the two passive per-frame relics: Masons' wall regen and Quartermaster's bonus mid-wave crate.
- `second_wind` is checked in `trySecondWind()` where hearts would hit 0 — survives at 1 heart, once per world (tracked by `game.secondWindUsedWorld`). "Collector" achievement unlocks at 5 held relics.
- While the draft overlay is open, a keydown listener registered before `js/input.js`'s (load order matters) swallows every key via `stopImmediatePropagation` so game hotkeys can't fire underneath; `sendWave()` also no-ops on `game.relicDraftActive`.
- Known gap: the HP HUD only ever renders 25 pips, so `fortify`'s +5 max hearts increases `game.hp` functionally (more hits absorbed) without extra pips showing.

## Conventions
- No build tools — edit index.html directly
- Use CSS variables from `:root` for colors
- Tower colors come from skin system (`getTowerSkin()` / `applySkinSelections()`)
- World theme colors via `getWorldTheme()`
- `showFlash(msg)` for in-game notifications
- `unlockAchievement(name, sub)` for achievement toasts
- `spawnParticles(x, y, color, count)` for particle effects
