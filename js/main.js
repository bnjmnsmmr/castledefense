// ===== MAIN (boot) =====
// Load-time wiring only. Everything above is declarations; this file runs them. Keep it last in index.html.

loadConfigOverrides();
applySkinSelections();

buildTowerBar();
if (IS_TOUCH) document.getElementById('hint').textContent = 'Tap a green tile to preview a tower, tap it again to build — then press SEND WAVE';
renderHomeScreen();
drawGround(); // paint the map behind the (translucent) home screen so the menu sits on the world
window.addEventListener('beforeunload', saveGameState);

// PWA: offline shell + installability (skipped when opened straight from disk)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is a bonus, never an error */ });
}
