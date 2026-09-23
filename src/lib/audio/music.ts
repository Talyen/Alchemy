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

interface MusicTrackRecord {
  readonly key: string;
  readonly element: HTMLAudioElement;
  fadeGain: number;
}

type MusicPlayback =
  | { phase: "idle" }
  | { phase: "paused" | "playing"; track: MusicTrackRecord }
  | { phase: "fading-in"; track: MusicTrackRecord; timer: ReturnType<typeof setInterval> | null }
  | { phase: "fading-out"; track: MusicTrackRecord; destination: string; timer: ReturnType<typeof setInterval> | null };

const musicTracks = new Map<string, MusicTrackRecord>();
let playback: MusicPlayback = { phase: "idle" };
let bossPreviewKey: string | null = null;

function cancelTransition(): void {
  if ("timer" in playback && playback.timer !== null) clearInterval(playback.timer);
  // Replacing the state also invalidates already queued timer callbacks.
  playback = playback.phase === "idle" ? { phase: "idle" } : { phase: "playing", track: playback.track };
}

function applyTrackVolume(track: MusicTrackRecord, fadeGain = track.fadeGain): void {
  track.fadeGain = clamp01(fadeGain);
  track.element.volume = computeMusicVolume({
    musicVolume: audioState.musicVolume,
    masterVolume: audioState.masterVolume,
    fadeGain: track.fadeGain,
    isBoss: MUSIC_CATALOG[track.key]?.isBoss ?? false,
  });
}

/** Settings may change during either half of a fade; retain the actual track's gain and identity. */
export function syncMusicSettings(): void {
  if (playback.phase === "idle") return;
  applyTrackVolume(playback.track);
  playback.track.element.muted = audioState.muted;
}

function playElement(el: HTMLAudioElement): void {
  if (isNonPlayerAudioHost()) {
    el.muted = true;
    el.pause();
    return;
  }
  el.play().catch(() => {
    console.warn("Music playback blocked until user interaction");
  });
}

function resolveTrack(key: string): MusicTrackRecord | undefined {
  const cached = musicTracks.get(key);
  if (cached) return cached;
  const catalog = MUSIC_CATALOG[key];
  const file = pickRandomUnsafe(catalog?.files ?? []);
  if (!catalog || !file) return undefined;
  const element = new Audio(musicBase + file);
  element.loop = true;
  if (catalog.skipSeconds) element.currentTime = catalog.skipSeconds;
  const track = { key, element, fadeGain: 1 };
  musicTracks.set(key, track);
  return track;
}

function activateTrack(track: MusicTrackRecord, gain: number): void {
  if (playback.phase !== "idle" && playback.track !== track) playback.track.element.pause();
  playback = { phase: "playing", track };
  applyTrackVolume(track, gain);
  track.element.muted = audioState.muted;
  playElement(track.element);
}

function rampVolume(
  state: Extract<MusicPlayback, { phase: "fading-in" | "fading-out" }>,
  durationMs: number,
  delayMs: number,
  apply: (progress: number) => void,
  complete: () => void,
): void {
  playback = state;
  const startTime = performance.now();
  state.timer = setInterval(() => {
    if (playback !== state) return;
    const elapsed = performance.now() - startTime;
    if (elapsed < delayMs) return;
    const progress = Math.min(1, (elapsed - delayMs) / durationMs);
    apply(progress);
    if (progress >= 1) {
      cancelTransition();
      complete();
    }
  }, MUSIC_FADE_TICK_MS);
}

function fadeIn(track: MusicTrackRecord): void {
  activateTrack(track, 0);
  rampVolume(
    { phase: "fading-in", track, timer: null },
    FADE_IN_DURATION_MS,
    FADE_IN_DELAY_MS,
    (progress) => applyTrackVolume(track, progress),
    () => {
      playback = { phase: "playing", track };
    },
  );
}

export function isMusicPaused(): boolean {
  return playback.phase === "idle" || playback.track.element.paused;
}

export function playMusicImmediate(key: string): void {
  if (!MUSIC_CATALOG[key]) return;
  const track = resolveTrack(key);
  if (!track) return;
  bossPreviewKey = null;
  cancelTransition();
  activateTrack(track, 1);
}

export function playMusic(key: string): void {
  if (!MUSIC_CATALOG[key]) return;
  bossPreviewKey = null;
  if (playback.phase === "fading-out" && playback.destination === key) return;
  if (playback.phase === "fading-out" && playback.track.key === key) {
    const track = playback.track;
    cancelTransition();
    applyTrackVolume(track, 1);
    return;
  }
  if (playback.phase !== "idle" && playback.track.key === key && playback.phase !== "fading-out") {
    if (playback.phase === "paused") {
      cancelTransition();
      activateTrack(playback.track, 1);
    } else if (playback.track.element.paused) {
      syncMusicSettings();
      playElement(playback.track.element);
    }
    return;
  }

  if (playback.phase === "paused") playback = { phase: "idle" };
  else cancelTransition();
  if (playback.phase === "idle") {
    const track = resolveTrack(key);
    if (track) fadeIn(track);
    return;
  }
  const outgoing = playback.track;
  const startGain = outgoing.fadeGain;
  rampVolume(
    { phase: "fading-out", track: outgoing, destination: key, timer: null },
    FADE_OUT_DURATION_MS,
    0,
    (progress) => applyTrackVolume(outgoing, startGain * (1 - progress)),
    () => {
      const incoming = resolveTrack(key);
      if (incoming) fadeIn(incoming);
    },
  );
}

export function pauseAllMusic(): void {
  cancelTransition();
  bossPreviewKey = null;
  for (const { element } of musicTracks.values()) {
    element.muted = true;
    element.pause();
  }
  if (playback.phase !== "idle") playback = { phase: "paused", track: playback.track };
}

export function invalidateCacheForKey(key: string): void {
  const active = playback.phase !== "idle" && playback.track.key === key;
  const pending = playback.phase === "fading-out" && playback.destination === key;
  if (active || pending) {
    cancelTransition();
    if (active) playback = { phase: "idle" };
    else if (playback.phase !== "idle") applyTrackVolume(playback.track, 1);
    bossPreviewKey = null;
  }
  const track = musicTracks.get(key);
  if (track) {
    track.element.pause();
    track.element.currentTime = 0;
    musicTracks.delete(key);
  }
}

/** Test-only reset; volume preferences remain owned by the caller. */
export function resetMusicRuntimeForTests(): void {
  pauseAllMusic();
  musicTracks.clear();
  playback = { phase: "idle" };
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
  if (!MUSIC_CATALOG[key]) return;
  playMusic(key);
  bossPreviewKey = key;
}

export function endBossPreview(): void {
  if (bossPreviewKey === null) return;
  bossPreviewKey = null;
  playMusic(MUSIC_KEYS.MENU);
}
