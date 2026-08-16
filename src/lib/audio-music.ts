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
const musicElementKeys = new WeakMap<HTMLAudioElement, string>();

export function invalidateCacheForKey(key: string): void {
  const cached = musicCache.get(key);
  if (cached) {
    cached.pause();
    cached.currentTime = 0;
    musicElementKeys.delete(cached);
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
export function applyMusicVolume(
  el: HTMLAudioElement,
  key: string | null = musicElementKeys.get(el) ?? audioState.currentMusicKey,
  fadeProgress = 1,
) {
  const boost = key && BOSS_MUSIC_KEYS.has(key) ? BOSS_MUSIC_VOLUME_BOOST : 1;
  el.volume = audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN * fadeProgress * boost;
}

// Stops and clears the current HTML audio element, then returns an element for
// the given key — either from cache (resuming position) or newly created.
function replaceCurrentTrack(key: string, fadeProgress: number): HTMLAudioElement | undefined {
  if (audioState.currentMusic) {
    audioState.currentMusic.pause();
    audioState.currentMusic = null;
  }

  const cached = musicCache.get(key);
  if (cached) {
    applyMusicVolume(cached, key, fadeProgress);
    cached.muted = audioState.muted;
    playElement(cached);
    audioState.currentMusic = cached;
    return cached;
  }

  const track = pickRandom(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? []);
  if (!track) return undefined;

  const el = new Audio(musicBase + track);
  musicElementKeys.set(el, key);
  el.loop = true;
  applyMusicVolume(el, key, fadeProgress);
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
// Uses a short interval so volume interpolation can continue when animation frames are paused.
function startTrack(key: string, transitionToken: number) {
  const el = replaceCurrentTrack(key, MUSIC_CONFIG.VOLUME_MIN);
  if (!el) return;
  const startTime = performance.now();

  const timer = setInterval(() => {
    // If a newer music transition has taken precedence, abort the current animation loop.
    if (transitionToken !== musicTransitionToken) {
      clearInterval(timer);
      return;
    }

    const elapsed = performance.now() - startTime;
    if (elapsed < FADE_IN_DELAY) return;
    const t = Math.min(1, (elapsed - FADE_IN_DELAY) / FADE_IN_DURATION);
    if (audioState.currentMusic === el) {
      applyMusicVolume(el, key, t);
    }
    if (t >= 1) {
      clearInterval(timer);
    }
  }, 30);
}

// Starts a keyed music group immediately (no crossfade), choosing one registered track
// at random or resuming a cached element.
export function playMusicImmediate(key: string) {
  musicTransitionToken += 1;
  audioState.currentMusicKey = key;
  replaceCurrentTrack(key, 1);
}

// Handles smooth fade-out of the old track, then starts (or resumes) the new keyed track.
// Checks the musicTransitionToken to abort if a new transition has been scheduled.
function fadeOutAndStartTrack(oldTrack: HTMLAudioElement, newKey: string, transitionToken: number) {
  const oldVol = oldTrack.volume;
  const startTime = performance.now();

  const timer = setInterval(() => {
    // If a newer music transition has taken precedence, abort the current animation loop.
    if (transitionToken !== musicTransitionToken) {
      clearInterval(timer);
      return;
    }

    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / FADE_OUT_DURATION);
    oldTrack.volume = Math.max(MUSIC_CONFIG.VOLUME_MIN, oldVol * (1 - t));

    if (t >= 1) {
      clearInterval(timer);
      oldTrack.pause();
      if (audioState.currentMusic === oldTrack) {
        audioState.currentMusic = null;
      }
      startTrack(newKey, transitionToken);
    }
  }, 30);
}

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

  if (audioState.currentMusic) {
    fadeOutAndStartTrack(audioState.currentMusic, key, transitionToken);
  } else {
    startTrack(key, transitionToken);
  }
}
