// ===== AUDIO =====
// Procedural music (per-world themes) and the shared WebAudio SFX engine. Zero assets.

// --- BACKGROUND MUSIC: quiet procedural ambient loop, themed per world ---
// Each world gets its own mode, register, oscillator character, and pacing. The
// schedulers re-read getWorldMusic() every cycle, so the score shifts automatically
// when the player crosses into a new world.
let musicCtx = null, musicGain = null, musicMuted = false, musicRunning = false;
let homeMusicRunning = false;
function startHomeMusic() {
  if (musicMuted || homeMusicRunning || musicRunning) return;
  if (!musicCtx) {
    try {
      musicCtx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = musicCtx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(musicCtx.destination);
    } catch (e) { return; }
  }
  homeMusicRunning = true;
  // Gentle ambient drone for the menu
  function homeDrone() {
    if (!homeMusicRunning || musicMuted) { homeMusicRunning = false; return; }
    const t0 = musicCtx.currentTime;
    // Low pad chord
    [110, 165, 220].forEach((freq, i) => {
      const osc = musicCtx.createOscillator();
      const g = musicCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 1.5);
      g.gain.linearRampToValueAtTime(0, t0 + 6);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t0 + i * 0.3);
      osc.stop(t0 + 6.5);
    });
    setTimeout(homeDrone, 5500);
  }
  homeDrone();
}

function stopHomeMusic() {
  homeMusicRunning = false;
}
const MUSIC_VOLUME = 0.05; // deliberately quiet

const WORLD_MUSIC = [
  // 1. Greenwood — D dorian, warm and calm (the original castle mood)
  { chord: [146.83, 174.61, 220.00, 261.63], melody: [293.66, 349.23, 392.00, 440.00, 523.25],
    droneType: 'sine', melodyType: 'triangle', melodyGap: 1800, melodyChance: 0.6, droneDur: 8 },
  // 2. Scorched Desert — D phrygian dominant, exotic heat-shimmer
  { chord: [146.83, 155.56, 185.00, 220.00], melody: [293.66, 311.13, 369.99, 440.00, 466.16, 587.33],
    droneType: 'sine', melodyType: 'sawtooth', melodyGap: 1400, melodyChance: 0.65, droneDur: 7, melodyVol: 0.18 },
  // 3. Frozen Tundra — high sparse A minor, glassy and still
  { chord: [110.00, 130.81, 164.81, 220.00], melody: [440.00, 523.25, 659.25, 880.00],
    droneType: 'sine', melodyType: 'sine', melodyGap: 2600, melodyChance: 0.5, droneDur: 10 },
  // 4. Volcanic Hellscape — low grinding minor seconds, menace
  { chord: [73.42, 77.78, 110.00, 146.83], melody: [146.83, 155.56, 220.00, 233.08, 293.66],
    droneType: 'sawtooth', melodyType: 'triangle', melodyGap: 1200, melodyChance: 0.7, droneDur: 6, droneVol: 0.3 },
  // 5. Enchanted Grove — C lydian sparkle, fairy-tale bright
  { chord: [130.81, 164.81, 196.00, 246.94], melody: [523.25, 587.33, 659.25, 739.99, 987.77],
    droneType: 'sine', melodyType: 'triangle', melodyGap: 1500, melodyChance: 0.65, droneDur: 8 },
  // 6. Deep Space — whole-tone drift, weightless
  { chord: [110.00, 138.59, 174.61, 220.00], melody: [440.00, 493.88, 554.37, 622.25, 698.46],
    droneType: 'sine', melodyType: 'sine', melodyGap: 3200, melodyChance: 0.45, droneDur: 12 },
  // 7. Ocean Depths — G pentatonic, slow floating swells
  { chord: [98.00, 123.47, 146.83, 196.00], melody: [392.00, 440.00, 523.25, 587.33, 698.46],
    droneType: 'sine', melodyType: 'triangle', melodyGap: 2400, melodyChance: 0.55, droneDur: 10 },
  // 8. Shadow Realm — dark diminished murmur, barely-there dread
  { chord: [69.30, 82.41, 98.00, 116.54], melody: [138.59, 164.81, 196.00, 233.08, 277.18],
    droneType: 'sawtooth', melodyType: 'sawtooth', melodyGap: 2800, melodyChance: 0.4, droneDur: 9, droneVol: 0.28, melodyVol: 0.15 },
];

function getWorldMusic() {
  let idx = 0;
  if (game && game.forcedThemeIdx !== undefined && game.forcedThemeIdx !== null) idx = game.forcedThemeIdx;
  else if (game) idx = (game.world - 1) % WORLD_MUSIC.length;
  return WORLD_MUSIC[idx];
}

function startMusic() {
  if (musicRunning) return;
  try {
    musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = musicCtx.createGain();
    musicGain.gain.value = musicMuted ? 0 : MUSIC_VOLUME;
    musicGain.connect(musicCtx.destination);
    musicRunning = true;
    scheduleMusicDrone();
    scheduleMusicMelody();
  } catch (e) { /* audio unsupported */ }
}

function scheduleMusicDrone() {
  if (!musicRunning) return;
  const m = getWorldMusic();
  const t0 = musicCtx.currentTime;
  const dur = m.droneDur;
  for (const freq of m.chord) {
    const osc = musicCtx.createOscillator();
    const g = musicCtx.createGain();
    osc.type = m.droneType;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(m.droneVol || 0.5, t0 + 2);
    g.gain.linearRampToValueAtTime(m.droneVol || 0.5, t0 + dur - 2);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(musicGain);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
  }
  setTimeout(scheduleMusicDrone, dur * 1000 - 400);
}

function scheduleMusicMelody() {
  if (!musicRunning) return;
  const playNote = () => {
    if (!musicRunning) return;
    const m = getWorldMusic();
    if (Math.random() < m.melodyChance) { // leave gaps for a sparse, unobtrusive melody
      const freq = m.melody[Math.floor(Math.random() * m.melody.length)];
      const t0 = musicCtx.currentTime;
      const osc = musicCtx.createOscillator();
      const g = musicCtx.createGain();
      osc.type = m.melodyType;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(m.melodyVol || 0.35, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
      osc.connect(g); g.connect(musicGain);
      osc.start(t0); osc.stop(t0 + 1.9);
    }
    setTimeout(playNote, m.melodyGap + Math.random() * 1400);
  };
  playNote();
}

function toggleMusic() {
  musicMuted = !musicMuted;
  document.getElementById('music-toggle-btn').classList.toggle('muted', musicMuted);
  if (sfxGain && sfxCtx) sfxGain.gain.linearRampToValueAtTime(musicMuted ? 0 : SFX_VOLUME, sfxCtx.currentTime + 0.2);
  if (!musicRunning) { startMusic(); return; }
  if (musicGain) {
    musicGain.gain.linearRampToValueAtTime(musicMuted ? 0 : MUSIC_VOLUME, musicCtx.currentTime + 0.3);
  }
}

// ===== SOUND EFFECTS ENGINE =====
// One shared AudioContext + master gain for every effect in the game (procedural, zero assets).
// SFX.play(name) is throttled per-sound so dense waves never turn into noise soup.
let sfxCtx = null, sfxGain = null;
const SFX_VOLUME = 0.5;
const sfxLastPlayed = {};

function sfxContext() {
  if (!sfxCtx) {
    try {
      sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
      sfxGain = sfxCtx.createGain();
      sfxGain.gain.value = musicMuted ? 0 : SFX_VOLUME;
      sfxGain.connect(sfxCtx.destination);
    } catch (e) { return null; }
  }
  if (sfxCtx.state === 'suspended') sfxCtx.resume();
  return sfxCtx;
}

function sfxTone(type, f0, f1, dur, vol, delay = 0) {
  const ac = sfxContext(); if (!ac || !sfxGain) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(f0, 1), t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function sfxNoise(dur, vol, filterFreq, filterType = 'lowpass', delay = 0) {
  const ac = sfxContext(); if (!ac || !sfxGain) return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const flt = ac.createBiquadFilter(); flt.type = filterType; flt.frequency.value = filterFreq;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(flt); flt.connect(g); g.connect(sfxGain);
  src.start(t0);
}

const SFX = {
  // min ms between repeats of the same sound
  throttle: {
    shot_arrow: 70, shot_flame: 130, shot_tesla: 90, shot_annihilator: 90,
    shot_ice: 80, shot_poison: 80, death: 60, coin: 55, ui_click: 60,
  },
  play(name) {
    const now = performance.now();
    const min = this.throttle[name] || 40;
    if (sfxLastPlayed[name] && now - sfxLastPlayed[name] < min) return;
    sfxLastPlayed[name] = now;
    const fn = this.lib[name];
    if (fn) { try { fn(); } catch (e) { /* audio unsupported */ } }
  },
  lib: {
    ui_click()  { sfxTone('triangle', 640, 860, 0.05, 0.16); },
    place()     { sfxNoise(0.09, 0.28, 520); sfxTone('triangle', 190, 120, 0.13, 0.4); },
    wall_place(){ sfxTone('triangle', 150, 90, 0.2, 0.45); sfxNoise(0.16, 0.3, 380); },
    wall_hit()  { sfxNoise(0.07, 0.22, 700); sfxTone('square', 120, 80, 0.06, 0.14); },
    wall_break(){ sfxNoise(0.45, 0.5, 300); sfxTone('sawtooth', 130, 45, 0.35, 0.35); },
    sell()      { sfxTone('square', 500, 240, 0.14, 0.16); sfxTone('sine', 1180, 0, 0.06, 0.2, 0.1); },
    upgrade()   { sfxTone('triangle', 380, 900, 0.2, 0.3); sfxTone('sine', 1400, 1900, 0.14, 0.18, 0.12); },
    error()     { sfxTone('square', 150, 0, 0.09, 0.16); sfxTone('square', 118, 0, 0.12, 0.16, 0.1); },
    coin()      { sfxTone('sine', 988, 0, 0.06, 0.2); sfxTone('sine', 1319, 0, 0.09, 0.2, 0.06); },
    death()     { sfxTone('triangle', 260, 70, 0.13, 0.3); sfxNoise(0.06, 0.2, 900); },
    hurt()      { sfxTone('sawtooth', 170, 60, 0.3, 0.4); sfxNoise(0.25, 0.35, 320); },
    boss()      { sfxTone('sawtooth', 98, 60, 0.7, 0.35); sfxTone('sawtooth', 49, 38, 0.9, 0.3, 0.05); sfxNoise(0.45, 0.3, 190); },
    boss_cast() { sfxTone('sine', 220, 660, 0.55, 0.22); sfxTone('sine', 330, 990, 0.5, 0.14, 0.06); },
    boss_slam() { sfxTone('sine', 60, 28, 0.5, 0.6); sfxNoise(0.4, 0.5, 260); },
    boss_shield(){ sfxTone('triangle', 300, 780, 0.4, 0.26); sfxTone('sine', 600, 1200, 0.3, 0.16, 0.08); },
    boss_die()  { [330, 262, 196, 147, 98].forEach((f, i) => sfxTone('sawtooth', f, f * 0.6, 0.4, 0.3, i * 0.11)); sfxNoise(0.7, 0.4, 200, 'lowpass', 0.4); },
    horn()      { sfxTone('sawtooth', 196, 0, 0.5, 0.16); sfxTone('sawtooth', 294, 0, 0.5, 0.14, 0.12); sfxTone('sawtooth', 392, 0, 0.65, 0.14, 0.24); },
    clear()     { [523, 659, 784, 1047].forEach((f, i) => sfxTone('triangle', f, 0, 0.22, 0.22, i * 0.08)); },
    flawless()  { [659, 784, 988, 1319].forEach((f, i) => sfxTone('sine', f, 0, 0.3, 0.22, i * 0.07)); },
    unlock()    { sfxTone('triangle', 440, 880, 0.35, 0.28); sfxTone('triangle', 880, 1760, 0.4, 0.2, 0.2); },
    shot_arrow()       { sfxTone('triangle', 900, 320, 0.07, 0.14); sfxNoise(0.03, 0.1, 3200, 'highpass'); },
    shot_cannon()      { sfxTone('sine', 95, 38, 0.24, 0.5); sfxNoise(0.2, 0.4, 340); },
    shot_ice()         { sfxTone('sine', 1250, 1850, 0.1, 0.13); sfxTone('sine', 2100, 2600, 0.07, 0.08, 0.03); },
    shot_sniper()      { sfxNoise(0.07, 0.35, 2400, 'highpass'); sfxTone('square', 210, 60, 0.12, 0.2); },
    shot_tesla()       { sfxTone('sawtooth', 780, 110, 0.09, 0.14); sfxNoise(0.05, 0.14, 3400, 'highpass'); },
    shot_flame()       { sfxNoise(0.16, 0.13, 850); },
    shot_mortar()      { sfxTone('sine', 72, 42, 0.32, 0.55); sfxNoise(0.26, 0.4, 240); },
    shot_poison()      { sfxTone('sine', 320, 130, 0.13, 0.2); sfxNoise(0.07, 0.1, 620); },
    shot_annihilator() { sfxTone('sawtooth', 1600, 200, 0.12, 0.12); sfxTone('sine', 3000, 500, 0.1, 0.08); },
  },
};

// Soft click for every UI button/card press
document.addEventListener('click', e => {
  if (e.target.closest('button, .tower-btn, .cust-skin-opt')) SFX.play('ui_click');
});

function playAchievementSound() {
  [523.25, 659.25, 783.99].forEach((f, i) => sfxTone('triangle', f, 0, 0.35, 0.3, i * 0.09));
}


function playFart() {
  const dur = 0.25 + Math.random() * 0.15;
  const startFreq = 90 + Math.random() * 40;
  sfxTone('sawtooth', startFreq, startFreq * 0.25, dur, 0.35);
}


function playEvilLaugh() {
  const notes = [220, 196, 174.6, 146.8, 130.8]; // descending "ha-ha-ha-ha-haaa"
  notes.forEach((freq, i) => {
    sfxTone('sawtooth', freq, freq * 0.85, i === notes.length - 1 ? 0.5 : 0.14, 0.4, i * 0.16);
  });
}
