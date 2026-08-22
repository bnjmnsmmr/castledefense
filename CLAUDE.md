# Castle Defense - Project Notes

## About
Single-file HTML5 canvas tower defense game ("Ben's Castle Defense"). No build step, no server — one `index.html` file with all CSS/JS inline, plus PWA sidecar files (`manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`). Deployed to GitHub Pages at https://bnjmnsmmr.github.io/castledefense/

## PWA
- Installable: manifest (fullscreen, landscape) + `sw.js` (stale-while-revalidate shell cache, cache name — currently `castle-defense-v2`; bump it on meaningful releases). Registered from index.html, skipped on `file:`.
- Icons drawn programmatically (canvas → PNG); regenerate by re-rendering if the brand changes.

## Architecture
- **Single file**: `/index.html` (~4500 lines) — CSS variables in `:root`, all JS in one `<script>` block
- **Rendering**: HTML5 Canvas (`#c`), tile-based grid (COLS x ROWS, TILE=40px)
- **Game state**: `game` object initialized by `initGame()`, started by `startGame(resume)`
- **Persistence**: `localStorage` for saves (`castleDefenseSave`), admin config (`castleDefenseConfig`), skins (`castleDefenseSkins`), daily best (`castleDefenseDailyBest`), lifetime profile (`castleDefenseProfile`), local board (`castleDefenseHallOfFame`), leaderboard identity (`castleDefenseIdentity`)
- **Optional backend**: `server/` (Cloudflare Worker + D1) powers the global leaderboard; the game runs fully standalone without it
- **Deployment**: GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) — pushes to main auto-deploy

## Key sections (approximate line ranges)
- CSS variables & styles: 1-380
- HUD / overlay HTML: 380-510
- Tower definitions (`TOWER_TYPES`): ~577
- Tower sprites (`TOWER_SPRITES`): ~603
- Skin system (`SKIN_PALETTE`, `TOWER_SKIN_OPTIONS`): ~743
- Enemy definitions (`ENEMY_DEFS`): ~810
- World themes (`WORLD_THEMES`): ~860
- Save/load system: ~998
- Home screen / daily challenge / customize: ~1027-1200
- Wave generation: ~1350
- `initGame()` / `startGame()`: ~1436
- Achievements: ~1510
- Terrain rendering (`buildGroundCache`): ~1740
- Castle drawing (`drawCastle`): ~1770
- Enemy sprites: ~2400
- Game loop (`loop`, `update`, `render`): ~3350
- Secret keyboard combos: ~4360
- Tower bar UI (`buildTowerBar`): ~4500

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

## Sound
- Music is themed per world: `WORLD_MUSIC` (mode/register/oscillator/pacing per theme), read by `getWorldMusic()` each drone/melody cycle so the score shifts automatically on world change.
- Shared WebAudio engine (`sfxContext()`, `sfxTone()`, `sfxNoise()`, `SFX.play(name)`) — one AudioContext + master gain for all effects, per-sound throttling. All procedural, zero assets.
- Per-tower firing sounds (`shot_<towerId>`), kill/coin/hurt/place/sell/upgrade/error/horn/clear/flawless/unlock effects, soft UI click on every button.
- Music (ambient drone + melody) has its own context; the 🔊 button mutes both music and SFX.

## Resource economy
- **Wall cost scaling**: `DIFFICULTY.wallCostScale` (default 0.15 = 15% per world). `getWallCost(typeIdx)` returns `Math.floor(baseCost * (1 + (world-1) * wallCostScale))`. Walls store `buyCost` at placement time so sell refunds are accurate even if world changes.
- **Gold Mine tower**: income tower (key `0`). Generates `DIFFICULTY.goldMineRate` gold/sec (default 2), scaling +50% per upgrade level. No targeting, no projectiles — the update loop `continue`s past combat for `base.income` towers. Shows a floating +gold number every second.
- **Supply Crates**: `spawnSupplyCrates()` runs at the start of every prep phase. 1-3 crates (more in later worlds) on random empty non-path tiles. Click to collect (`collectCrate(tx, ty)` → bonus gold + coin SFX + particles). Crates clear when the wave starts.
- Achievements: "Gold Rush" (place 3 Gold Mines), "Crate Hoarder" (collect 20 crates in a run). Tracked via `game.goldMinesPlaced` / `game.cratesCollected`.
- All new economy values are tunable in the admin panel under "Upgrades & economy".

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

## Conventions
- No build tools — edit index.html directly
- Use CSS variables from `:root` for colors
- Tower colors come from skin system (`getTowerSkin()` / `applySkinSelections()`)
- World theme colors via `getWorldTheme()`
- `showFlash(msg)` for in-game notifications
- `unlockAchievement(name, sub)` for achievement toasts
- `spawnParticles(x, y, color, count)` for particle effects
