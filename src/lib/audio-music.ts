import { isNonPlayerAudioHost } from "./audio-host";
import {
  FADE_IN_DELAY,
  FADE_IN_DURATION,
  FADE_OUT_DURATION,
  MUSIC_BASE_PATH,
  MUSIC_MASTER_GAIN,
  MUSIC_KEYS,
} from "./game-constants";
import { audioState } from "./audio-state";
import { clamp, pickRandomUnsafe } from "./utils";

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;

const MUSIC_CONFIG = {
  TRACKS: {
    [MUSIC_KEYS.MENU]: ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3"],
    [MUSIC_KEYS.BATTLE]: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"],
  },
  VOLUME_MIN: 0,
} as const;

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

export function getBossMusicKey(bossId: string): string | undefined {
  return BOSS_MUSIC_ENTRIES.find(([, boss]) => boss.bossId === bossId)?.[0];
}

const musicCache = new Map<string, HTMLAudioElement>();
const musicElementKeys = new WeakMap<HTMLAudioElement, string>();
const musicElementFadeGains = new WeakMap<HTMLAudioElement, number>();

export function invalidateCacheForKey(key: string): void {
  const cached = musicCache.get(key);
  if (cached) {
    cached.pause();
    cached.currentTime = 0;
    musicElementKeys.delete(cached);
    musicElementFadeGains.delete(cached);
  }
  musicCache.delete(key);
}

export function pauseAllMusic() {
  musicTransitionToken += 1;
  cancelMusicTransition();
  for (const el of musicCache.values()) {
    el.muted = true;
    el.pause();
  }
  if (audioState.currentMusic) {
    audioState.currentMusic.muted = true;
    audioState.currentMusic.pause();
  }
}

let musicTransitionToken = 0;
let musicTransitionTimer: ReturnType<typeof setInterval> | null = null;

function cancelMusicTransition(): void {
  if (musicTransitionTimer === null) return;
  clearInterval(musicTransitionTimer);
  musicTransitionTimer = null;
}

function playElement(el: HTMLAudioElement) {
  if (isNonPlayerAudioHost()) {
    el.muted = true;
    el.pause();
    return;
  }
  el.play().catch(() => {
    console.warn("Music playback blocked until user interaction");
  });
}

const RAMP_TICK_MS = 30;

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
  cancelMusicTransition();
  const startTime = performance.now();

  const timer = setInterval(() => {
    if (transitionToken !== musicTransitionToken) {
      clearInterval(timer);
      if (musicTransitionTimer === timer) musicTransitionTimer = null;
      return;
    }

    const elapsed = performance.now() - startTime;
    if (elapsed < delayMs) return;
    const t = Math.min(1, (elapsed - delayMs) / durationMs);
    apply(t);
    if (t >= 1) {
      clearInterval(timer);
      if (musicTransitionTimer === timer) musicTransitionTimer = null;
      onComplete?.();
    }
  }, RAMP_TICK_MS);
  musicTransitionTimer = timer;
}

export function applyMusicVolume(
  el: HTMLAudioElement,
  key: string | null = musicElementKeys.get(el) ?? audioState.currentMusicKey,
  fadeProgress?: number,
) {
  if (fadeProgress !== undefined) musicElementFadeGains.set(el, clamp(fadeProgress, 0, 1));
  const fadeGain = clamp(fadeProgress ?? musicElementFadeGains.get(el) ?? 1, 0, 1);
  const boost = key && BOSS_MUSIC_KEYS.has(key) ? BOSS_MUSIC_VOLUME_BOOST : 1;
  el.volume = clamp(
    audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN * fadeGain * boost,
    MUSIC_CONFIG.VOLUME_MIN,
    1,
  );
}

export function isMusicPaused(): boolean {
  return !audioState.currentMusic || audioState.currentMusic.paused;
}

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
  const track = pickRandomUnsafe(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? boss?.tracks ?? []);
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

export function playMusicImmediate(key: string) {
  musicTransitionToken += 1;
  cancelMusicTransition();
  audioState.currentMusicKey = key;
  replaceCurrentTrack(key, 1);
}

function fadeOutAndStartTrack(oldTrack: HTMLAudioElement, newKey: string, transitionToken: number) {
  const oldKey = musicElementKeys.get(oldTrack) ?? audioState.currentMusicKey;
  const startFadeGain = musicElementFadeGains.get(oldTrack) ?? 1;

  rampVolume({
    transitionToken,
    durationMs: FADE_OUT_DURATION,
    apply: (t) => {
      applyMusicVolume(oldTrack, oldKey, startFadeGain * (1 - t));
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
  cancelMusicTransition();
  audioState.currentMusicKey = key;

  if (audioState.currentMusic) {
    fadeOutAndStartTrack(audioState.currentMusic, key, transitionToken);
  } else {
    startTrack(key, transitionToken);
  }
}
