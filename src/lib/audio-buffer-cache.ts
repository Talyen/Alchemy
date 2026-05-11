// Web Audio buffer loading, caching, and idle preloading for short sound effects.
// Depends on sound registries and the shared audio state.
// Used by SFX playback to keep repeated combat/UI sounds instant after first decode.
import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { MASTER_GAIN } from "./game-constants";
import { audioState } from "./audio-state";

const soundCache = new Map<string, AudioBuffer>();
const loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
const PRELOAD_BATCH_SIZE = 4;

// Lazily creates the AudioContext because browsers require user interaction before playback.
export function getAudioContext(): AudioContext {
  if (!audioState.context) {
    audioState.context = new AudioContext();
    audioState.masterGain = audioState.context.createGain();
    audioState.masterGain.connect(audioState.context.destination);
    audioState.masterGain.gain.value = MASTER_GAIN * audioState.masterVolume;
  }
  return audioState.context;
}

// Resumes suspended audio after a gesture so queued play calls can become audible.
export function resumeAudioContext() {
  if (audioState.context?.state === "suspended") {
    audioState.context.resume();
  }
}

// Builds sound URLs through Vite's base path so GitHub Pages deployments resolve assets.
function getSoundUrl(name: string): string {
  return import.meta.env.BASE_URL + "sounds/" + name;
}

// Loads a sound once and shares any in-flight decode with concurrent play/preload calls.
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
      return null;
    }
  })();

  loadingPromises.set(name, promise);
  return promise;
}

// Warms selected sounds without forcing callers to await cache completion.
export function preloadSounds(names: string[]) {
  names.forEach((name) => loadSoundBuffer(name));
}

// Collects every registered sound and decodes it gradually after startup.
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

// Spreads audio decoding across idle frames to keep the first rendered menu responsive.
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

// Uses browser idle time when available and falls back for environments without it.
function schedulePreloadBatch(callback: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1000 });
    return;
  }

  globalThis.setTimeout(callback, 0);
}
