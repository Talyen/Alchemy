import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { DEFAULT_MUSIC_VOLUME, MASTER_GAIN, MUSIC_BASE_PATH } from "./game-constants";

// Real-asset audio engine — loads OGG files from public/sounds/ as decoded Web Audio
// buffers. Sounds are lazy-loaded on first play and cached for instant reuse. Music
// continues to stream via HTMLAudioElement (MP3) because looping background tracks
// are large and don't benefit from buffer caching.
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;
let sfxVolume = 0.35;
let musicVolume = DEFAULT_MUSIC_VOLUME;

const soundCache = new Map<string, AudioBuffer>();
const loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
const PRELOAD_BATCH_SIZE = 4;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = MASTER_GAIN;
  }
  return audioContext;
}

function resumeContext() {
  if (audioContext?.state === "suspended") {
    audioContext.resume();
  }
}

function getSoundUrl(name: string): string {
  return import.meta.env.BASE_URL + "sounds/" + name;
}

// Loads a single sound file into a decoded AudioBuffer. Cached forever after first
// decode so repeated plays (e.g. sword swings) are instant.
async function loadSoundBuffer(name: string): Promise<AudioBuffer | null> {
  if (soundCache.has(name)) {
    return soundCache.get(name)!;
  }

  if (loadingPromises.has(name)) {
    return loadingPromises.get(name)!;
  }

  const promise = (async () => {
    try {
      const response = await fetch(getSoundUrl(name));
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
      soundCache.set(name, buffer);
      return buffer;
    } catch {
      return null;
    }
  })();

  loadingPromises.set(name, promise);
  return promise;
}

// Pre-loads a list of sounds into the buffer cache so first playback is instant.
// Fire-and-forget: promises are tracked internally so playBuffer shares them.
export function preloadSounds(names: string[]) {
  names.forEach((name) => loadSoundBuffer(name));
}

// Eagerly loads every registered sound asset in idle batches so startup remains
// interactive while the cache warms in the background.
export function preloadAllSounds() {
  const names = new Set<string>([
    ...Object.values(cardSounds).flat(),
    ...Object.values(enemyAttackSounds).flat(),
    ...Object.values(battleEventSounds),
    ...Object.values(uiSounds),
    ...Object.values(stingerSounds),
  ]);
  preloadSoundsWhenIdle([...names]);
}

// Spreads audio decoding work across idle frames because decoding all SFX during
// the first effect can make the freshly rendered menu feel disabled.
function preloadSoundsWhenIdle(names: string[]) {
  let index = 0;

  function preloadNextBatch() {
    preloadSounds(names.slice(index, index + PRELOAD_BATCH_SIZE));
    index += PRELOAD_BATCH_SIZE;

    if (index < names.length) {
      schedulePreloadBatch(preloadNextBatch);
    }
  }

  schedulePreloadBatch(preloadNextBatch);
}

// Uses browser idle time when available and falls back to a short timer for
// environments without requestIdleCallback.
function schedulePreloadBatch(callback: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1000 });
    return;
  }

  globalThis.setTimeout(callback, 0);
}

// Core playback helper. Creates a one-shot buffer source with a per-play gain node
// so volume can be tweaked per sound without mutating cached buffers.
function playBuffer(name: string, volume = 1) {
  if (isMuted) return;
  resumeContext();

  loadSoundBuffer(name).then((buffer) => {
    if (!buffer) return;
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume * sfxVolume;
    source.connect(gain);
    gain.connect(masterGain!);
    source.start();
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============= Public SFX API =============

export function playCardSound(cardId: string) {
  const sounds = cardSounds[cardId];
  if (!sounds) return;
  playBuffer(pickRandom(sounds));
}

export function playEnemyAttack(enemyId: string) {
  const sounds = enemyAttackSounds[enemyId];
  if (!sounds) return;
  playBuffer(pickRandom(sounds));
}

export function playBattleEvent(event: keyof typeof battleEventSounds) {
  const name = battleEventSounds[event];
  playBuffer(name);
}

export function playUISound(event: keyof typeof uiSounds) {
  const name = uiSounds[event];
  // UI sounds sit quieter than combat so they don't compete.
  playBuffer(name, 0.6);
}

export function playVictory() {
  playBuffer(stingerSounds.victory, 0.8);
}

export function playDefeat() {
  playBuffer(stingerSounds.defeat, 0.7);
}

// Legacy convenience wrappers — these map old call sites onto the new typed events
// so we don't have to rewrite every import site in one sweep.
export function playDamage() { playBattleEvent("enemyHit"); }
export function playBuff() { playBattleEvent("playerHeal"); }

// ============= Volume / Mute =============

export function setMuted(value: boolean) {
  isMuted = value;
  if (currentMusic) {
    currentMusic.muted = isMuted;
  }
}

export function getMuted(): boolean {
  return isMuted;
}

export function setSfxVolume(value: number) {
  sfxVolume = Math.max(0, Math.min(1, value));
}

export function getSfxVolume(): number {
  return sfxVolume;
}

// ============= Music (streaming MP3) =============

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;
const FADE_OUT_DURATION = 300;
const FADE_IN_DELAY = 600;
const FADE_IN_DURATION = 1400;
const MUSIC_MASTER_GAIN = 0.5; // Halve overall music output so the slider provides finer control.

const musicTracks: Record<string, string[]> = {
  menu: ["Menu 1.mp3"],
  battle: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3"],
};

let currentMusic: HTMLAudioElement | null = null;
let currentKey: string | null = null;

function applyMusicVolume(el: HTMLAudioElement) {
  el.volume = musicVolume * MUSIC_MASTER_GAIN;
}

function startTrack(track: string) {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
  const el = new Audio(musicBase + track);
  el.loop = true;
  el.volume = 0;
  el.muted = isMuted;
  el.play().catch(() => {});
  currentMusic = el;

  const startTime = performance.now();
  function fadeIn() {
    const elapsed = performance.now() - startTime;
    if (elapsed < FADE_IN_DELAY) return void requestAnimationFrame(fadeIn);
    const t = Math.min(1, (elapsed - FADE_IN_DELAY) / FADE_IN_DURATION);
    if (currentMusic === el) el.volume = musicVolume * MUSIC_MASTER_GAIN * t;
    if (t < 1) requestAnimationFrame(fadeIn);
  }
  requestAnimationFrame(fadeIn);
}

function startTrackImmediate(track: string) {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
  const el = new Audio(musicBase + track);
  el.loop = true;
  el.volume = musicVolume * MUSIC_MASTER_GAIN;
  el.muted = isMuted;
  el.play().catch(() => {});
  currentMusic = el;
}

export function playMusicImmediate(key: string) {
  currentKey = key;
  const tracks = musicTracks[key];
  if (!tracks) return;
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  startTrackImmediate(track);
}

export function playMusic(key: string) {
  if (key === currentKey) {
    if (currentMusic?.paused) {
      currentMusic.play().catch(() => {});
    }
    return;
  }
  currentKey = key;
  const tracks = musicTracks[key];
  if (!tracks) return;
  const track = tracks[Math.floor(Math.random() * tracks.length)];

  if (currentMusic) {
    const old = currentMusic;
    const oldVol = old.volume;
    const startTime = performance.now();
    function fadeOut() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / FADE_OUT_DURATION);
      if (old) old.volume = Math.max(0, oldVol * (1 - t));
      if (t < 1) return void requestAnimationFrame(fadeOut);
      old.pause();
      currentMusic = null;
      startTrack(track);
    }
    return void requestAnimationFrame(fadeOut);
  }

  startTrack(track);
}

export function stopMusic() {
  currentKey = null;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

export function setMusicVolume(value: number) {
  musicVolume = Math.max(0, Math.min(1, value));
  if (currentMusic) {
    applyMusicVolume(currentMusic);
  }
}

export function getMusicVolume(): number {
  return musicVolume;
}
