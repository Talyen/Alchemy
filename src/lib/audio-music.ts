// Streaming MP3 music playback and transitions.
// Depends on shared audio state and music path constants.
// Used by App/controllers through the public lib/audio facade.
import {
  FADE_IN_DELAY,
  FADE_IN_DURATION,
  FADE_OUT_DURATION,
  MUSIC_BASE_PATH,
  MUSIC_MASTER_GAIN,
  MUSIC_KEYS,
} from "./game-constants";
import { audioState } from "./audio-state";
import { pickRandom } from "./utils";

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;

// Music player configuration grouping local variables and bounds.
const MUSIC_CONFIG = {
  TRACKS: {
    [MUSIC_KEYS.MENU]: ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3"],
    [MUSIC_KEYS.BATTLE]: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"],
    [MUSIC_KEYS.BOSS_FORGE_GOLEM]: ["The Forge Golem.mp3"],
    [MUSIC_KEYS.BOSS_FROSTWARDEN]: ["The Frostwarden.mp3"],
    [MUSIC_KEYS.BOSS_BLIGHT_TREANT]: ["The Blight Treant.mp3"],
    [MUSIC_KEYS.BOSS_IRON_BEAR]: ["The Iron Bear.mp3"],
  },
  VOLUME_MIN: 0,
} as const;

const BOSS_MUSIC_KEYS: ReadonlySet<string> = new Set([
  MUSIC_KEYS.BOSS_FORGE_GOLEM,
  MUSIC_KEYS.BOSS_FROSTWARDEN,
  MUSIC_KEYS.BOSS_BLIGHT_TREANT,
  MUSIC_KEYS.BOSS_IRON_BEAR,
]);

const BOSS_MUSIC_VOLUME_BOOST = 2;

const BOSS_MUSIC_SKIP_TIMES: Record<string, number> = {
  [MUSIC_KEYS.BOSS_IRON_BEAR]: 6,
};

// Maps a boss enemy id to its music key, falling back to undefined for non-boss or unknown ids.
export function getBossMusicKey(bossId: string): string | undefined {
  switch (bossId) {
    case "forge-golem":
      return MUSIC_KEYS.BOSS_FORGE_GOLEM;
    case "frostwarden":
      return MUSIC_KEYS.BOSS_FROSTWARDEN;
    case "blight-treant":
      return MUSIC_KEYS.BOSS_BLIGHT_TREANT;
    case "iron-bear":
      return MUSIC_KEYS.BOSS_IRON_BEAR;
    default:
      return undefined;
  }
}

// Cache of HTMLAudioElements keyed by music key, so re-entering a battle or boss fight
// resumes the same track from its saved position instead of starting from 0.
const musicCache = new Map<string, HTMLAudioElement>();

// Returns the cached element for a key, or undefined if miss.
function getCachedElement(key: string): HTMLAudioElement | undefined {
  return musicCache.get(key);
}

// Invalidates (removes) the cache entry for a key. The next playMusic call for this
// key will pick a fresh random track and create a new element.
export function invalidateCacheForKey(key: string): void {
  const cached = musicCache.get(key);
  if (cached) {
    cached.pause();
    cached.currentTime = 0;
  }
  musicCache.delete(key);
}

// Global counter tracking active scene music transitions to prevent concurrent crossfades
// from racing or playing overlapping tracks.
let musicTransitionToken = 0;

// Play wrapper handling browser autoplay blocking policies.
function playElement(el: HTMLAudioElement) {
  el.play().catch(() => {
    console.warn("Music playback blocked until user interaction");
  });
}

// Applies all active volume layers to a streaming music element.
// Volume cascaded: state-music-volume * state-master-volume * constant-music-master-gain.
export function applyMusicVolume(el: HTMLAudioElement) {
  el.volume = audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN;
}

// Stops and clears the current HTML audio element, then returns an element for
// the given (key, track) pair — either from cache (resuming position) or newly created.
function replaceCurrentTrack(key: string, track: string, volume: number) {
  if (audioState.currentMusic) {
    audioState.currentMusic.pause();
    audioState.currentMusic.currentTime = 0;
    audioState.currentMusic = null;
  }

  const boost = BOSS_MUSIC_KEYS.has(key) ? BOSS_MUSIC_VOLUME_BOOST : 1;
  const effectiveVolume = volume * boost;

  const cached = musicCache.get(key);
  if (cached) {
    cached.volume = effectiveVolume;
    cached.muted = audioState.muted;
    playElement(cached);
    audioState.currentMusic = cached;
    return cached;
  }

  const el = new Audio(musicBase + track);
  el.loop = true;
  el.volume = effectiveVolume;
  el.muted = audioState.muted;
  const skipTime = BOSS_MUSIC_SKIP_TIMES[key];
  if (skipTime) {
    el.currentTime = skipTime;
  }
  playElement(el);
  musicCache.set(key, el);
  audioState.currentMusic = el;
  return el;
}

// Starts a keyed track with the standard delayed fade-in used for scene transitions.
// Leverages requestAnimationFrame for smooth volume interpolation.
function startTrack(key: string, track: string) {
  const el = replaceCurrentTrack(key, track, MUSIC_CONFIG.VOLUME_MIN);
  const boost = BOSS_MUSIC_KEYS.has(key) ? BOSS_MUSIC_VOLUME_BOOST : 1;
  const startTime = performance.now();

  function fadeIn() {
    const elapsed = performance.now() - startTime;
    if (elapsed < FADE_IN_DELAY) {
      requestAnimationFrame(fadeIn);
      return;
    }
    const t = Math.min(1, (elapsed - FADE_IN_DELAY) / FADE_IN_DURATION);
    if (audioState.currentMusic === el) {
      el.volume = audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN * t * boost;
    }
    if (t < 1) {
      requestAnimationFrame(fadeIn);
    }
  }

  requestAnimationFrame(fadeIn);
}

// Starts a keyed music group immediately (no crossfade), choosing one registered track
// at random or resuming a cached element.
export function playMusicImmediate(key: string) {
  musicTransitionToken += 1;
  audioState.currentMusicKey = key;

  const cached = getCachedElement(key);
  const track = cached?.src
    ? pathFromSrc(cached.src)
    : pickRandom(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? []);
  if (!track) return;

  // Inlined startTrackImmediate logic to reduce indirection.
  replaceCurrentTrack(key, track, audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN);
}

// Extracts the filename portion from an absolute Audio element src URL.
function pathFromSrc(src: string): string | undefined {
  const parts = src.split("/");
  return parts[parts.length - 1];
}

// Handles smooth fade-out of the old track, then starts (or resumes) the new keyed track.
// Checks the musicTransitionToken to abort if a new transition has been scheduled.
function fadeOutAndStartTrack(oldTrack: HTMLAudioElement, newKey: string, newTrack: string, transitionToken: number) {
  const oldVol = oldTrack.volume;
  const startTime = performance.now();

  function fadeOut() {
    // If a newer music transition has taken precedence, abort the current animation loop.
    if (transitionToken !== musicTransitionToken) return;

    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / FADE_OUT_DURATION);
    oldTrack.volume = Math.max(MUSIC_CONFIG.VOLUME_MIN, oldVol * (1 - t));

    if (t < 1) {
      requestAnimationFrame(fadeOut);
      return;
    }

    oldTrack.pause();
    if (audioState.currentMusic === oldTrack) {
      audioState.currentMusic = null;
    }
    startTrack(newKey, newTrack);
  }

  requestAnimationFrame(fadeOut);
}

// Crossfades to a keyed music group unless that group is already active.
export function playMusic(key: string) {
  if (key === audioState.currentMusicKey) {
    if (audioState.currentMusic?.paused) {
      playElement(audioState.currentMusic);
    }
    return;
  }

  const transitionToken = musicTransitionToken + 1;
  musicTransitionToken = transitionToken;
  audioState.currentMusicKey = key;

  const cached = getCachedElement(key);
  const track = cached?.src
    ? pathFromSrc(cached.src)
    : pickRandom(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? []);
  if (!track) return;

  if (audioState.currentMusic) {
    fadeOutAndStartTrack(audioState.currentMusic, key, track, transitionToken);
  } else {
    startTrack(key, track);
  }
}
