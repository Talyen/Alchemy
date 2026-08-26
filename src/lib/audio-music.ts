// Streaming MP3 music playback and transitions.
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
import { clamp, pickRandom } from "./utils";

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;

const MUSIC_CONFIG = {
  TRACKS: {
    [MUSIC_KEYS.MENU]: ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3"],
    [MUSIC_KEYS.BATTLE]: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"],
  },
  VOLUME_MIN: 0,
} as const;

// One row per boss track: the boss id ↔ music key mapping, files, and optional
// intro skip live only here.
interface BossMusicRow {
  bossId: string;
  tracks: readonly string[];
  skipSeconds?: number;
}

const BOSS_MUSIC = {
  [MUSIC_KEYS.BOSS_FORGE_GOLEM]: { bossId: "forge-golem", tracks: ["The Forge Golem.mp3"] },
  [MUSIC_KEYS.BOSS_FROSTWARDEN]: { bossId: "frostwarden", tracks: ["The Frostwarden.mp3"] },
  [MUSIC_KEYS.BOSS_BLIGHT_TREANT]: { bossId: "blight-treant", tracks: ["The Blight Treant.mp3"] },
  [MUSIC_KEYS.BOSS_IRON_BEAR]: { bossId: "iron-bear", tracks: ["The Iron Bear.mp3"], skipSeconds: 6 },
} satisfies Record<string, BossMusicRow>;

type BossMusicEntry = [key: string, boss: BossMusicRow];

const BOSS_MUSIC_ENTRIES = Object.entries(BOSS_MUSIC) as BossMusicEntry[];

const BOSS_MUSIC_KEYS: ReadonlySet<string> = new Set(BOSS_MUSIC_ENTRIES.map(([key]) => key));

const BOSS_MUSIC_VOLUME_BOOST = 2;

function bossMusic(key: string): BossMusicRow | undefined {
  return BOSS_MUSIC[key as keyof typeof BOSS_MUSIC];
}

// Maps a boss enemy id to its music key, falling back to undefined for non-boss or unknown ids.
export function getBossMusicKey(bossId: string): string | undefined {
  return BOSS_MUSIC_ENTRIES.find(([, boss]) => boss.bossId === bossId)?.[0];
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

const RAMP_TICK_MS = 30;

/**
 * Single volume-ramp pump shared by fade-in and crossfade. Runs a short interval
 * so interpolation continues when animation frames are paused, aborts when a
 * newer music transition takes precedence, and completes once t reaches 1.
 */
function rampVolume({
  transitionToken,
  delayMs = 0,
  durationMs,
  apply,
  onComplete,
}: {
  transitionToken: number;
  durationMs: number;
  delayMs?: number;
  apply: (t: number) => void;
  onComplete?: () => void;
}): void {
  const startTime = performance.now();

  const timer = setInterval(() => {
    if (transitionToken !== musicTransitionToken) {
      clearInterval(timer);
      return;
    }

    const elapsed = performance.now() - startTime;
    if (elapsed < delayMs) return;
    const t = Math.min(1, (elapsed - delayMs) / durationMs);
    apply(t);
    if (t >= 1) {
      clearInterval(timer);
      onComplete?.();
    }
  }, RAMP_TICK_MS);
}

// Applies all active volume layers to a streaming music element.
// Volume cascaded: state-music-volume * state-master-volume * constant-music-master-gain.
export function applyMusicVolume(
  el: HTMLAudioElement,
  key: string | null = musicElementKeys.get(el) ?? audioState.currentMusicKey,
  fadeProgress = 1,
) {
  const boost = key && BOSS_MUSIC_KEYS.has(key) ? BOSS_MUSIC_VOLUME_BOOST : 1;
  el.volume = clamp(
    audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN * fadeProgress * boost,
    MUSIC_CONFIG.VOLUME_MIN,
    1,
  );
}

// True when no music element is live or it is paused (autoplay gate).
export function isMusicPaused(): boolean {
  return !audioState.currentMusic || audioState.currentMusic.paused;
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

  const boss = bossMusic(key);
  const track = pickRandom(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? boss?.tracks ?? []);
  if (!track) return undefined;

  const el = new Audio(musicBase + track);
  musicElementKeys.set(el, key);
  el.loop = true;
  applyMusicVolume(el, key, fadeProgress);
  el.muted = audioState.muted;
  if (boss?.skipSeconds) {
    el.currentTime = boss.skipSeconds;
  }
  playElement(el);
  musicCache.set(key, el);
  audioState.currentMusic = el;
  return el;
}

// Starts a keyed track with the standard delayed fade-in used for scene transitions.
function startTrack(key: string, transitionToken: number) {
  const el = replaceCurrentTrack(key, MUSIC_CONFIG.VOLUME_MIN);
  if (!el) return;

  rampVolume({
    transitionToken,
    delayMs: FADE_IN_DELAY,
    durationMs: FADE_IN_DURATION,
    apply: (t) => {
      if (audioState.currentMusic === el) {
        applyMusicVolume(el, key, t);
      }
    },
  });
}

// Starts a keyed music group immediately (no crossfade), choosing one registered track
// at random or resuming a cached element.
export function playMusicImmediate(key: string) {
  musicTransitionToken += 1;
  audioState.currentMusicKey = key;
  replaceCurrentTrack(key, 1);
}

// Handles smooth fade-out of the old track, then starts (or resumes) the new keyed track.
function fadeOutAndStartTrack(oldTrack: HTMLAudioElement, newKey: string, transitionToken: number) {
  const oldVol = oldTrack.volume;

  rampVolume({
    transitionToken,
    durationMs: FADE_OUT_DURATION,
    apply: (t) => {
      oldTrack.volume = Math.max(MUSIC_CONFIG.VOLUME_MIN, oldVol * (1 - t));
    },
    onComplete: () => {
      oldTrack.pause();
      if (audioState.currentMusic === oldTrack) {
        audioState.currentMusic = null;
      }
      startTrack(newKey, transitionToken);
    },
  });
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
