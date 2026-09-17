import { isNonPlayerAudioHost } from "./host";
import { audioUrl } from "./url";
import {
  FADE_IN_DELAY_MS,
  FADE_IN_DURATION_MS,
  FADE_OUT_DURATION_MS,
  MUSIC_BASE_PATH,
  MUSIC_BOSS_VOLUME_BOOST,
  MUSIC_FADE_TICK_MS,
  MUSIC_KEYS,
  MUSIC_MASTER_GAIN,
} from "../game-constants";
import { audioState } from "./state";
import { clamp01 } from "../math";
import { pickRandomUnsafe } from "../rng";

const musicBase = audioUrl(MUSIC_BASE_PATH);

interface MusicCatalogEntry {
  files: readonly string[];
  bossId?: string;
  skipSeconds?: number;
  isBoss: boolean;
}

/**
 * Single catalog for every playable track. Menu/battle entries list rotation
 * files; boss entries list one file each. `getBossMusicKey()` derives from the
 * same table so boss id, files, and volume treatment cannot drift apart.
 */
const MUSIC_CATALOG: Record<string, MusicCatalogEntry> = {
  [MUSIC_KEYS.MENU]: { files: ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3"], isBoss: false },
  [MUSIC_KEYS.BATTLE]: {
    files: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"],
    isBoss: false,
  },
  [MUSIC_KEYS.BOSS_FORGE_GOLEM]: { files: ["The Forge Golem.mp3"], bossId: "forge-golem", isBoss: true },
  [MUSIC_KEYS.BOSS_FROSTWARDEN]: { files: ["The Frostwarden.mp3"], bossId: "frostwarden", isBoss: true },
  [MUSIC_KEYS.BOSS_BLIGHT_TREANT]: { files: ["The Blight Treant.mp3"], bossId: "blight-treant", isBoss: true },
  [MUSIC_KEYS.BOSS_IRON_BEAR]: {
    files: ["The Iron Bear.mp3"],
    bossId: "iron-bear",
    skipSeconds: 6,
    isBoss: true,
  },
};

const BOSS_ID_TO_KEY: ReadonlyMap<string, string> = new Map(
  Object.entries(MUSIC_CATALOG).flatMap(([key, entry]) => (entry.bossId ? [[entry.bossId, key] as const] : [])),
);

export function allRegisteredMusicFiles(): string[] {
  return Object.values(MUSIC_CATALOG).flatMap((entry) => entry.files);
}

export function getBossMusicKey(bossId: string): string | undefined {
  return BOSS_ID_TO_KEY.get(bossId);
}

interface MusicTrackRecord {
  element: HTMLAudioElement;
  fadeGain: number;
}

/**
 * Live elements by music key. This map is the only owner of element identity
 * and fade progress; `audioState.currentMusic` points at one of these
 * elements (or a foreign test double) but never duplicates the bookkeeping.
 */
const musicTracks = new Map<string, MusicTrackRecord>();

function keyForElement(el: HTMLAudioElement): string | null {
  for (const [key, record] of musicTracks) {
    if (record.element === el) return key;
  }
  return audioState.currentMusic === el ? audioState.currentMusicKey : null;
}

export function invalidateCacheForKey(key: string): void {
  const record = musicTracks.get(key);
  if (record) {
    record.element.pause();
    record.element.currentTime = 0;
  }
  musicTracks.delete(key);
  if (audioState.currentMusicKey === key) {
    audioState.currentMusic = null;
    audioState.currentMusicKey = null;
  }
}

/** Test-only reset: drops cached elements, transitions, preview, and current pointers. Volumes and mute are owned by the test. */
export function resetMusicRuntimeForTests(): void {
  musicTransitionToken += 1;
  cancelMusicTransition();
  bossPreviewKey = null;
  for (const record of musicTracks.values()) {
    try {
      record.element.pause();
    } catch {}
  }
  musicTracks.clear();
  audioState.currentMusic = null;
  audioState.currentMusicKey = null;
}

export function pauseAllMusic() {
  musicTransitionToken += 1;
  cancelMusicTransition();
  for (const record of musicTracks.values()) {
    record.element.muted = true;
    record.element.pause();
  }
  if (audioState.currentMusic) {
    audioState.currentMusic.muted = true;
    audioState.currentMusic.pause();
  }
}

let musicTransitionToken = 0;
let musicTransitionTimer: ReturnType<typeof setInterval> | null = null;
// Active bestiary preview key. Cleared by any screen-driven playMusic call so
// leaving the collection (which owns its music via useAppAudioEffects) cannot
// leave a stale preview that later restores menu music without a preview.
let bossPreviewKey: string | null = null;

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
  }, MUSIC_FADE_TICK_MS);
  musicTransitionTimer = timer;
}

/**
 * Pure volume curve. Boss tracks get the shared boost before the clamp, so at
 * full volume both menu and boss saturate at 1.0 and the boost only separates
 * them at lower settings. Kept as-is for compatibility; covered by tests.
 */
export function computeMusicVolume({
  musicVolume,
  masterVolume,
  fadeGain = 1,
  isBoss = false,
}: {
  musicVolume: number;
  masterVolume: number;
  fadeGain?: number;
  isBoss?: boolean;
}): number {
  const boost = isBoss ? MUSIC_BOSS_VOLUME_BOOST : 1;
  return clamp01(musicVolume * masterVolume * MUSIC_MASTER_GAIN * clamp01(fadeGain) * boost);
}

export function applyMusicVolume(el: HTMLAudioElement, key: string | null = keyForElement(el), fadeProgress?: number) {
  const record = key !== null ? musicTracks.get(key) : undefined;
  const owned = record?.element === el;
  if (owned && fadeProgress !== undefined) {
    record.fadeGain = clamp01(fadeProgress);
  }
  const fadeGain = fadeProgress !== undefined ? clamp01(fadeProgress) : owned ? record.fadeGain : 1;
  el.volume = computeMusicVolume({
    musicVolume: audioState.musicVolume,
    masterVolume: audioState.masterVolume,
    fadeGain,
    isBoss: key !== null && (MUSIC_CATALOG[key]?.isBoss ?? false),
  });
}

export function isMusicPaused(): boolean {
  return !audioState.currentMusic || audioState.currentMusic.paused;
}

function replaceCurrentTrack(key: string, fadeProgress: number): HTMLAudioElement | undefined {
  if (audioState.currentMusic) {
    audioState.currentMusic.pause();
    audioState.currentMusic = null;
  }

  const cached = musicTracks.get(key);
  if (cached) {
    applyMusicVolume(cached.element, key, fadeProgress);
    cached.element.muted = audioState.muted;
    playElement(cached.element);
    audioState.currentMusic = cached.element;
    return cached.element;
  }

  const catalog = MUSIC_CATALOG[key];
  const track = pickRandomUnsafe(catalog?.files ?? []);
  if (!track) return undefined;

  const el = new Audio(musicBase + track);
  el.loop = true;
  musicTracks.set(key, { element: el, fadeGain: clamp01(fadeProgress) });
  applyMusicVolume(el, key, fadeProgress);
  el.muted = audioState.muted;
  if (catalog?.skipSeconds) {
    el.currentTime = catalog.skipSeconds;
  }
  playElement(el);
  audioState.currentMusic = el;
  return el;
}

function startTrack(key: string, transitionToken: number) {
  const el = replaceCurrentTrack(key, 0);
  if (!el) return;

  rampVolume({
    transitionToken,
    delayMs: FADE_IN_DELAY_MS,
    durationMs: FADE_IN_DURATION_MS,
    apply: (t) => {
      if (audioState.currentMusic === el) {
        applyMusicVolume(el, key, t);
      }
    },
  });
}

export function playMusicImmediate(key: string) {
  bossPreviewKey = null;
  musicTransitionToken += 1;
  cancelMusicTransition();
  audioState.currentMusicKey = key;
  replaceCurrentTrack(key, 1);
}

function fadeOutAndStartTrack(oldTrack: HTMLAudioElement, newKey: string, transitionToken: number) {
  const oldKey = keyForElement(oldTrack);
  const oldRecord = oldKey !== null ? musicTracks.get(oldKey) : undefined;
  const startFadeGain = oldRecord?.element === oldTrack ? oldRecord.fadeGain : 1;

  rampVolume({
    transitionToken,
    durationMs: FADE_OUT_DURATION_MS,
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
  // Screen-driven switches own the music; a preview only survives until the
  // next explicit switch. previewBossMusic re-sets the key after calling.
  bossPreviewKey = null;
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

/**
 * Bestiary boss preview. CollectionScreen is the only preview caller; the
 * screen-driven switch in `useAppAudioEffects` owns everything else. The
 * module dedupes repeats and remembers whether a preview is active, so tab
 * and page changes restore menu music exactly when a preview was playing.
 * playMusic() clears the preview, so the key is set after the switch.
 */
export function previewBossMusic(key: string): void {
  if (bossPreviewKey === key) return;
  playMusic(key);
  bossPreviewKey = key;
}

export function endBossPreview(): void {
  if (bossPreviewKey === null) return;
  bossPreviewKey = null;
  playMusic(MUSIC_KEYS.MENU);
}
