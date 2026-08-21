# Castle Defense - Project Notes

## About
Single-file HTML5 canvas tower defense game ("Ben's Castle Defense"). No build step, no server — one `index.html` file with all CSS/JS inline. Deployed to GitHub Pages at https://bnjmnsmmr.github.io/castledefense/

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

## Features
- 8 towers (+1 secret Annihilator via B→N key combo) with level-2 upgrades
- 9 enemy types across escalating worlds
- 8 distinct world themes (Medieval, Frozen, Desert, Deep Space, Ocean, Volcanic, Enchanted Grove, Shadow Realm)
- Home screen with animated title and menu
- Daily challenge mode (date-seeded, fixed difficulty)
- Tower customization (4 color skins per tower)
- Secret cheats: BN (Annihilator), GG (+500 gold), ASDF (rapid fire 30s), ZAP (lightning strike all enemies)
- Auto-wave, achievements, admin panel for tuning difficulty
- OG/Twitter Card meta tags with branded og-image.png

## Conventions
- No build tools — edit index.html directly
- Use CSS variables from `:root` for colors
- Tower colors come from skin system (`getTowerSkin()` / `applySkinSelections()`)
- World theme colors via `getWorldTheme()`
- `showFlash(msg)` for in-game notifications
- `unlockAchievement(name, sub)` for achievement toasts
- `spawnParticles(x, y, color, count)` for particle effects
