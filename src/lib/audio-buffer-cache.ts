// Web Audio buffer loading, caching, and idle preloading for short sound effects.
// Depends on sound registries and the shared audio state.
// Used by SFX playback to keep repeated combat/UI sounds instant after first decode.
import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { MASTER_GAIN } from "./game-constants";
import { audioState } from "./audio-state";
import { logError } from "./error-logger";

// Configuration for local buffer caching and preloading.
const BUFFER_CACHE_CONFIG = {
  SOUNDS_BASE_PATH: "sounds/",
  IDLE_CALLBACK_TIMEOUT_MS: 1000,
  PRELOAD_BATCH_SIZE: 4,
} as const;

// In-memory cache for fully decoded AudioBuffer objects.
const soundCache = new Map<string, AudioBuffer>();

// Tracks active fetch/decode promises to coalesce duplicate, concurrent load requests.
const loadingPromises = new Map<string, Promise<AudioBuffer | null>>();

// Lazily creates the AudioContext because browsers require user interaction before playback.
// Creates a master GainNode to clamp total audio amplitude under comfortable limits.
export function getAudioContext(): AudioContext {
  if (!audioState.context) {
    audioState.context = new AudioContext();
    audioState.masterGain = audioState.context.createGain();
    audioState.masterGain.connect(audioState.context.destination);

    // Cascades: masterGain = constant_master_gain * user_master_volume
    audioState.masterGain.gain.value = audioState.muted ? 0 : MASTER_GAIN * audioState.masterVolume;
  }
  return audioState.context;
}

// Resumes suspended audio after a gesture so queued play calls can become audible.
// Essential to comply with browsers' Autoplay Policy.
export function resumeAudioContext() {
  if (!audioState.context) return;

  if (audioState.context.state === "suspended") {
    void audioState.context.resume().then(() => {
      audioState.audioUnlocked = true;
    });
  } else if (audioState.context.state === "running") {
    audioState.audioUnlocked = true;
  }
}

// Synchronous cache lookup so playBuffer can avoid the Promise/microtask path for cached sounds.
// Prevents input lag between clicking and hearing UI/combat feedback.
export function getCachedBuffer(name: string): AudioBuffer | null {
  return soundCache.get(name) ?? null;
}

// Builds sound URLs through Vite's base path so GitHub Pages deployments resolve assets correctly.
function getSoundUrl(name: string): string {
  return import.meta.env.BASE_URL + BUFFER_CACHE_CONFIG.SOUNDS_BASE_PATH + name;
}

// Loads a sound once and shares the in-flight decode with concurrent play/preload calls.
// This coalescence prevents double fetches if multiple identical cards or events trigger at once.
export async function loadSoundBuffer(name: string): Promise<AudioBuffer | null> {
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
      logError("Failed to load or decode sound", "audio", { name });
      return null;
    } finally {
      loadingPromises.delete(name);
    }
  })();

  loadingPromises.set(name, promise);
  return promise;
}

// Warms selected sounds without forcing callers to await cache completion.
export function preloadSounds(names: string[]) {
  names.forEach((name) => {
    void loadSoundBuffer(name);
  });
}

// Collects every registered sound and decodes it gradually after startup.
export function preloadAllSounds() {
  getAudioContext();
  resumeAudioContext();

  const names = new Set<string>([
    ...Object.values(cardSounds).flat(),
    ...Object.values(enemyAttackSounds).flat(),
    ...Object.values(battleEventSounds),
    ...Object.values(uiSounds),
    ...Object.values(stingerSounds),
  ]);

  // Eagerly preload latency-critical sounds so first interactions and first card transfers are instant.
  preloadSounds([...Object.values(uiSounds), battleEventSounds.drawTransfer]);

  // Defer the rest to idle time so they don't block the initial render.
  preloadSoundsWhenIdle([...names]);
}

// Spreads audio decoding across idle frames to keep the first rendered menu responsive.
function preloadSoundsWhenIdle(names: string[]) {
  let index = 0;

  function preloadNextBatch() {
    preloadSounds(names.slice(index, index + BUFFER_CACHE_CONFIG.PRELOAD_BATCH_SIZE));
    index += BUFFER_CACHE_CONFIG.PRELOAD_BATCH_SIZE;

    if (index < names.length) {
      schedulePreloadBatch(preloadNextBatch);
    }
  }

  schedulePreloadBatch(preloadNextBatch);
}

// Uses browser idle time when available and falls back for environments without it (e.g. testing context).
function schedulePreloadBatch(callback: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: BUFFER_CACHE_CONFIG.IDLE_CALLBACK_TIMEOUT_MS });
    return;
  }

  globalThis.setTimeout(callback, 0);
}
