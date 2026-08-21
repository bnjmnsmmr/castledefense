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
- **Persistence**: `localStorage` for saves (`castleDefenseSave`), admin config (`castleDefenseConfig`), skins (`castleDefenseSkins`), daily best (`castleDefenseDailyBest`)
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
- `castleDefenseHallOfFame`: top 10 local runs (`recordHallOfFame` returns the 1-based rank, shown as a badge on the results screen). Rendered by `buildHallOfFame()` at the top of the achievements screen.
- `shareRun()` uses the Web Share API when available, else copies to clipboard. A **global** leaderboard would need a backend (and, for a kids' audience, a hard look at COPPA/usernames) — deliberately not built.

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

## Features
- 8 towers (+1 secret Annihilator via B→N key combo) with level-2 upgrades
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
- OG/Twitter Card meta tags with branded og-image.png

## Conventions
- No build tools — edit index.html directly
- Use CSS variables from `:root` for colors
- Tower colors come from skin system (`getTowerSkin()` / `applySkinSelections()`)
- World theme colors via `getWorldTheme()`
- `showFlash(msg)` for in-game notifications
- `unlockAchievement(name, sub)` for achievement toasts
- `spawnParticles(x, y, color, count)` for particle effects
