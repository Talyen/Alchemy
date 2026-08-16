// Root-level app side-effects: audio sync, display mode/brightness, global error logging,
// screen asset preloading, startup loading gate, and screen particle configurations.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { advanceStartupBar, computeStartupLoadTarget } from "@/app/startup-bar-progress";
import {
  IMAGE_PRELOAD_BATCH_SIZE,
  FONT_PRELOAD_TIMEOUT_MS,
  INITIAL_LOAD_MIN_DURATION_MS,
  MUSIC_KEYS,
  STARTUP_BAR_REVEAL_THRESHOLD,
} from "@/lib/game-constants";
import {
  playMusic,
  playMusicImmediate,
  preloadAllSounds,
  setMasterVolume,
  setMusicVolume,
  setMuted,
  setSfxVolume,
} from "@/lib/audio";
import { audioState } from "@/lib/audio-state";
import { getBossMusicKey, invalidateCacheForKey } from "@/lib/audio-music";
import { logError } from "@/lib/error-logger";
import { allGameArt } from "@/lib/game-data";
import { preloadImagesInBatches } from "@/lib/image-preload";
import type { DisplayMode, Screen } from "@/features/alchemy/shared/types";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { useHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { shouldSkipStartupLoadingGate } from "@/features/alchemy/shared/utils";

// ── Audio Effects ──

interface AppAudioEffectsOptions {
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  muteInBackground: boolean;
  screen: Screen;
}

function pickMusicKey(screen: Screen): string {
  if (screen !== "battle") return MUSIC_KEYS.MENU;
  const battleStore = readBattle();
  if (!battleStore.hasActiveBattle) return MUSIC_KEYS.BATTLE;
  const enemy = battleStore.battleState.currentEnemy;
  if (enemy.enemyType !== "boss") return MUSIC_KEYS.BATTLE;
  return getBossMusicKey(enemy.id) ?? MUSIC_KEYS.BATTLE;
}

export function useAppAudioEffects({ masterVol, musicVol, sfxVol, muteInBackground, screen }: AppAudioEffectsOptions) {
  const screenRef = useRef(screen);
  const gestureFiredRef = useRef(false);

  useEffect(() => {
    setMasterVolume(masterVol / 100);
  }, [masterVol]);
  useEffect(() => {
    setMusicVolume(musicVol / 100);
  }, [musicVol]);
  useEffect(() => {
    setSfxVolume(sfxVol / 100);
  }, [sfxVol]);

  useEffect(() => {
    function applyBackgroundMute() {
      setMuted(muteInBackground && document.hidden);
    }

    applyBackgroundMute();
    document.addEventListener("visibilitychange", applyBackgroundMute);
    window.addEventListener("blur", applyBackgroundMute);
    window.addEventListener("focus", applyBackgroundMute);
    return () => {
      document.removeEventListener("visibilitychange", applyBackgroundMute);
      window.removeEventListener("blur", applyBackgroundMute);
      window.removeEventListener("focus", applyBackgroundMute);
      setMuted(false);
    };
  }, [muteInBackground]);

  const initialScreenRef = useRef(true);

  const hasActiveBattle = useHasActiveBattle();
  const lastBattleActiveRef = useRef(hasActiveBattle);
  useEffect(() => {
    if (hasActiveBattle && !lastBattleActiveRef.current) {
      const musicKey = pickMusicKey(screen);
      invalidateCacheForKey(musicKey);
    }
    lastBattleActiveRef.current = hasActiveBattle;
  }, [hasActiveBattle, screen]);

  useEffect(() => {
    screenRef.current = screen;
    if (initialScreenRef.current) {
      initialScreenRef.current = false;
      return;
    }
    playMusic(pickMusicKey(screen));
  }, [screen]);

  useEffect(() => {
    preloadAllSounds();

    function resumeOnGesture() {
      if (!document.hidden) setMuted(false);
      if (gestureFiredRef.current) return;
      gestureFiredRef.current = true;
      if (!audioState.currentMusic || audioState.currentMusic.paused) {
        playMusicImmediate(pickMusicKey(screenRef.current));
      }
    }

    window.addEventListener("pointerdown", resumeOnGesture, { capture: true });
    window.addEventListener("keydown", resumeOnGesture, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", resumeOnGesture, true);
      window.removeEventListener("keydown", resumeOnGesture, true);
    };
  }, []);
}

// ── Display Effects ──

interface AppDisplayEffectsOptions {
  displayMode: DisplayMode;
  brightness: number;
  stageRef: React.RefObject<HTMLDivElement | null>;
}

export function useAppDisplayEffects({ displayMode, brightness, stageRef }: AppDisplayEffectsOptions) {
  "use no memo";
  useEffect(() => {
    document.body.dataset.displayMode = displayMode;
  }, [displayMode]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (el) {
      // Dimming is handled by a cheap black overlay in App. Values above 100 still
      // need the stage filter to preserve exact brightness multiplication semantics.
      const brightnessFactor = brightness / 100;
      // eslint-disable-next-line react-compiler/react-compiler -- intentional DOM mutation inside useLayoutEffect
      el.style.filter = brightness > 100 ? `brightness(${brightnessFactor})` : "";
    }
  }, [brightness, stageRef]);
}

// ── Global Error Handlers ──

function stackOf(value: unknown): string | undefined {
  const stack = (value as { stack?: unknown } | null)?.stack;
  return typeof stack === "string" ? stack : undefined;
}

function messageOf(value: unknown): string {
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(value);
}

export function useGlobalErrorHandlers(): void {
  useEffect(() => {
    function onGlobalError(event: ErrorEvent) {
      logError(
        event.message,
        "global",
        { filename: event.filename, lineno: event.lineno, colno: event.colno },
        stackOf(event.error),
      );
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason: unknown = event.reason;
      logError(messageOf(reason), "promise", undefined, stackOf(reason));
    }

    window.addEventListener("error", onGlobalError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onGlobalError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}

// ── Initial Load Readiness Gate ──

// Warms all game art and fonts, then reveals once the smoothed bar has caught
// real progress (and the short minimum presentation time has elapsed).
export function useInitialLoadReady({
  minDurationMs = INITIAL_LOAD_MIN_DURATION_MS,
  bootstrapReady = false,
}: {
  minDurationMs?: number;
  bootstrapReady?: boolean;
} = {}) {
  const skipGate = shouldSkipStartupLoadingGate();
  const bootstrapReadyRef = useRef(bootstrapReady);

  const [ready, setReady] = useState(() => skipGate);
  const [progress, setProgress] = useState(() => (skipGate ? 1 : 0));

  useEffect(() => {
    bootstrapReadyRef.current = bootstrapReady;
  }, [bootstrapReady]);

  useEffect(() => {
    let cancelled = false;

    if (skipGate) {
      void preloadImagesInBatches(allGameArt, IMAGE_PRELOAD_BATCH_SIZE);
      void waitForFonts();
      return () => {
        cancelled = true;
      };
    }

    let display = 0;
    let imageLoaded = 0;
    let imageTotal = allGameArt.filter(Boolean).length;
    let fontsReady = false;
    let minElapsed = false;
    let imagesSettled = imageTotal === 0;
    let rafId = 0;
    let lastTs = 0;
    let published = -1;

    function workComplete() {
      return imagesSettled && fontsReady && bootstrapReadyRef.current;
    }

    function tick(timestamp: number) {
      if (cancelled) return;
      if (lastTs === 0) lastTs = timestamp;
      const dt = (timestamp - lastTs) / 1000;
      lastTs = timestamp;
      const complete = workComplete();
      const target = computeStartupLoadTarget({
        imageLoaded,
        imageTotal,
        fontsReady,
        bootstrapReady: bootstrapReadyRef.current,
      });
      display = advanceStartupBar(display, dt, target, complete);
      const quantized = Math.round(display * 192) / 192;
      if (quantized !== published) {
        published = quantized;
        setProgress(quantized);
      }
      if (complete && minElapsed && display >= STARTUP_BAR_REVEAL_THRESHOLD) {
        setProgress(1);
        setReady(true);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    }

    rafId = window.requestAnimationFrame(tick);
    const timer = window.setTimeout(() => {
      minElapsed = true;
    }, minDurationMs);

    void preloadImagesInBatches(allGameArt, IMAGE_PRELOAD_BATCH_SIZE, (loaded, total) => {
      imageLoaded = loaded;
      imageTotal = total;
      if (total === 0 || loaded >= total) imagesSettled = true;
    }).then(() => {
      imagesSettled = true;
    });

    void waitForFonts().then(() => {
      fontsReady = true;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(rafId);
    };
  }, [skipGate, minDurationMs]);

  return { ready, progress };
}

function waitForFonts() {
  if (!("fonts" in document)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (warning?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (warning) console.warn(warning);
      resolve();
    };
    const timeout = window.setTimeout(() => finish("Font loading timed out"), FONT_PRELOAD_TIMEOUT_MS);
    void document.fonts.ready.then(
      () => finish(),
      () => finish("Font loading failed"),
    );
  });
}

export { getScreenParticleConfig } from "./screen-particle-config";
