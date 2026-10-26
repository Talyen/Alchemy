import {
  FADE_IN_DELAY_MS,
  FADE_IN_DURATION_MS,
  FADE_OUT_DURATION_MS,
  MUSIC_FADE_TICK_MS,
  MUSIC_KEYS,
} from "../game-constants";
import { clamp01 } from "../math";
import { releaseAudioElement } from "./element";
import { MUSIC_CATALOG, computeMusicVolume } from "./music-catalog";

interface MusicSettings {
  musicVolume: number;
  masterVolume: number;
  muted: boolean;
}

type MusicElement = Pick<
  HTMLAudioElement,
  "volume" | "muted" | "loop" | "currentTime" | "paused" | "play" | "pause" | "removeAttribute" | "load"
>;

interface MusicPlayerDependencies {
  createElement: (file: string) => MusicElement;
  selectFile: (files: readonly string[]) => string | undefined;
  readSettings: () => MusicSettings;
  canPlay: () => boolean;
  now: () => number;
  schedule: (callback: () => void, intervalMs: number) => ReturnType<typeof setInterval>;
  cancel: (timer: ReturnType<typeof setInterval>) => void;
  reportFailure: (message: string) => void;
}

interface MusicTrackRecord {
  readonly key: string;
  readonly element: MusicElement;
  fadeGain: number;
}

type MusicPlayback =
  | { phase: "idle" }
  | { phase: "paused" | "playing"; track: MusicTrackRecord }
  | { phase: "fading-in"; track: MusicTrackRecord; timer: ReturnType<typeof setInterval> | null }
  | { phase: "fading-out"; track: MusicTrackRecord; destination: string; timer: ReturnType<typeof setInterval> | null };

/** Owns cached tracks, transitions, and previews for one playback lifetime. */
export function createMusicPlayer(deps: MusicPlayerDependencies) {
  const musicTracks = new Map<string, MusicTrackRecord>();
  let playback: MusicPlayback = { phase: "idle" };
  let bossPreviewKey: string | null = null;
  let playAttempt: object | null = null;

  function reportFailure(message: string): void {
    try {
      deps.reportFailure(message);
    } catch {
      // Diagnostics cannot interrupt playback cleanup or reject an async handler.
    }
  }

  function cancelTransition(): void {
    const timer = "timer" in playback ? playback.timer : null;
    // Revoke callbacks before cancellation, which can fail at the scheduler seam.
    playback = playback.phase === "idle" ? { phase: "idle" } : { phase: "playing", track: playback.track };
    if (timer !== null) {
      try {
        deps.cancel(timer);
      } catch {
        reportFailure("Music fade could not be cancelled");
      }
    }
  }

  function applyTrackVolume(track: MusicTrackRecord, fadeGain = track.fadeGain): void {
    const settings = deps.readSettings();
    track.fadeGain = clamp01(fadeGain);
    track.element.volume = computeMusicVolume({
      musicVolume: settings.musicVolume,
      masterVolume: settings.masterVolume,
      fadeGain: track.fadeGain,
      isBoss: MUSIC_CATALOG[track.key]?.bossId !== undefined,
    });
  }

  /** Settings may change during either half of a fade; retain the actual track's gain and identity. */
  function syncMusicSettings(): void {
    if (playback.phase === "idle") return;
    applyTrackVolume(playback.track);
    playback.track.element.muted = playback.phase === "paused" || !deps.canPlay() || deps.readSettings().muted;
  }

  function playElement(el: MusicElement): void {
    const attempt = {};
    playAttempt = attempt;
    if (!deps.canPlay()) {
      el.muted = true;
      el.pause();
      return;
    }
    const reportPlayFailure = () => {
      if (playAttempt === attempt) reportFailure("Music playback blocked until user interaction");
    };
    try {
      void Promise.resolve(el.play()).catch(reportPlayFailure);
    } catch {
      reportPlayFailure();
    }
  }

  function resolveTrack(key: string): MusicTrackRecord | undefined {
    const cached = musicTracks.get(key);
    if (cached) return cached;
    const catalog = MUSIC_CATALOG[key];
    if (!catalog) return undefined;
    let element: MusicElement | undefined;
    try {
      const file = deps.selectFile(catalog.files);
      if (!file) return undefined;
      element = deps.createElement(file);
      element.loop = true;
      if (catalog.skipSeconds) element.currentTime = catalog.skipSeconds;
    } catch {
      if (element) releaseAudioElement(element);
      reportFailure("Music track could not be initialized");
      return undefined;
    }
    const track = { key, element, fadeGain: 1 };
    musicTracks.set(key, track);
    return track;
  }

  function activateTrack(track: MusicTrackRecord, gain: number): void {
    if (playback.phase !== "idle" && playback.track !== track) pauseTrack(playback.track.element);
    playback = { phase: "playing", track };
    applyTrackVolume(track, gain);
    track.element.muted = deps.readSettings().muted;
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
    const startTime = deps.now();
    try {
      state.timer = deps.schedule(() => {
        if (playback !== state) return;
        const elapsed = deps.now() - startTime;
        if (elapsed < delayMs) return;
        const progress = Math.min(1, (elapsed - delayMs) / durationMs);
        apply(progress);
        if (progress >= 1) {
          cancelTransition();
          complete();
        }
      }, MUSIC_FADE_TICK_MS);
    } catch {
      // Optional fades cannot leave a playing track silent or trap navigation.
      cancelTransition();
      apply(1);
      complete();
      reportFailure("Music fade could not be scheduled");
    }
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

  function isMusicPaused(): boolean {
    return playback.phase === "idle" || playback.track.element.paused;
  }

  function playMusicImmediate(key: string): void {
    if (!Object.hasOwn(MUSIC_CATALOG, key)) return;
    const track = resolveTrack(key);
    if (!track) return;
    bossPreviewKey = null;
    cancelTransition();
    activateTrack(track, 1);
  }

  function playMusic(key: string): void {
    if (!Object.hasOwn(MUSIC_CATALOG, key)) return;
    bossPreviewKey = null;
    if (playback.phase === "fading-out" && playback.destination === key) return;
    if (playback.phase === "fading-out" && playback.track.key === key) {
      const track = playback.track;
      cancelTransition();
      activateTrack(track, 1);
      return;
    }
    if (playback.phase !== "idle" && playback.track.key === key) {
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
        else applyTrackVolume(outgoing, 1);
      },
    );
  }

  function pauseTrack(element: MusicElement): void {
    // Muting and pausing are independent attempts. An outgoing source must
    // stay silent even when pause fails, without blocking its replacement.
    try {
      element.muted = true;
    } catch {
      reportFailure("Music track could not be muted");
    }
    try {
      element.pause();
    } catch {
      reportFailure("Music track could not be paused");
    }
  }

  function pauseAllMusic(): void {
    playAttempt = null;
    cancelTransition();
    bossPreviewKey = null;
    if (playback.phase !== "idle") playback = { phase: "paused", track: playback.track };
    for (const { element } of musicTracks.values()) {
      pauseTrack(element);
    }
  }

  function invalidateCacheForKey(key: string): void {
    const active = playback.phase !== "idle" && playback.track.key === key;
    const pending = playback.phase === "fading-out" && playback.destination === key;
    if (active || pending) {
      cancelTransition();
      if (active) {
        playAttempt = null;
        playback = { phase: "idle" };
      } else if (playback.phase !== "idle") applyTrackVolume(playback.track, 1);
      bossPreviewKey = null;
    }
    const track = musicTracks.get(key);
    if (track) {
      musicTracks.delete(key);
      releaseAudioElement(track.element);
    }
  }

  /** Release this player's tracks and timers; subsequent requests start a fresh lifetime. */
  function reset(): void {
    cancelTransition();
    playAttempt = null;
    bossPreviewKey = null;
    playback = { phase: "idle" };
    for (const [key, { element }] of musicTracks) {
      musicTracks.delete(key);
      releaseAudioElement(element);
    }
  }

  /**
   * Bestiary boss preview. CollectionScreen is the only preview caller; the
   * screen-driven switch in `useAppAudioEffects` owns everything else. The
   * module dedupes repeats and remembers whether a preview is active, so tab
   * and page changes restore menu music exactly when a preview was playing.
   * playMusic() clears the preview, so the key is set after the switch.
   */
  function previewBossMusic(key: string): void {
    if (bossPreviewKey === key && !isMusicPaused()) return;
    if (!Object.hasOwn(MUSIC_CATALOG, key)) return;
    playMusic(key);
    bossPreviewKey = key;
  }

  function endBossPreview(): void {
    if (bossPreviewKey === null) return;
    bossPreviewKey = null;
    playMusic(MUSIC_KEYS.MENU);
  }

  function readMusicPlayback(): { key: string; currentTime: number; audible: boolean } | null {
    if (playback.phase === "idle") return null;
    const { key, element } = playback.track;
    return { key, currentTime: element.currentTime, audible: !element.paused && !element.muted && element.volume > 0 };
  }

  return {
    readMusicPlayback,
    syncMusicSettings,
    isMusicPaused,
    playMusicImmediate,
    playMusic,
    pauseAllMusic,
    invalidateCacheForKey,
    reset,
    previewBossMusic,
    endBossPreview,
  };
}
