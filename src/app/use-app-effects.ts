// Root-level app side-effects: audio sync, display mode/brightness, global error logging,
// screen asset preloading, startup loading gate, and screen particle configurations.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MUSIC_KEYS, INITIAL_LOAD_MIN_DURATION_MS } from "@/lib/game-constants";
import {
  playMusic,
  playMusicImmediate,
  preloadAllSounds,
  resumeAudioContext,
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
      setMuted(muteInBackground && (document.hidden || !document.hasFocus()));
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
      if (gestureFiredRef.current) return;
      gestureFiredRef.current = true;
      resumeAudioContext();
      if (!audioState.currentMusic || audioState.currentMusic.paused) {
        playMusicImmediate(pickMusicKey(screenRef.current));
      }
    }

    window.addEventListener("pointerdown", resumeOnGesture, { capture: true, once: true });
    window.addEventListener("keydown", resumeOnGesture, { capture: true, once: true });
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

// Keeps the loader presentation on its fixed minimum timing while decoding all
// game art and waiting for fonts. The bar is intentionally aesthetic rather than
// a progress meter; readiness only controls when the app is revealed.
export function useInitialLoadReady({ minDurationMs = INITIAL_LOAD_MIN_DURATION_MS } = {}) {
  const skipGate = shouldSkipStartupLoadingGate();
  const [ready, setReady] = useState(() => skipGate);

  useEffect(() => {
    let cancelled = false;
    let resolveMinimumDuration = () => {};
    const minimumDuration = skipGate
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          resolveMinimumDuration = resolve;
        });
    const timer = skipGate ? undefined : window.setTimeout(resolveMinimumDuration, minDurationMs);

    void Promise.all([minimumDuration, preloadImagesInBatches(allGameArt), waitForFonts()]).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      resolveMinimumDuration();
    };
  }, [skipGate, minDurationMs]);

  return ready;
}

function waitForFonts() {
  if (!("fonts" in document)) return Promise.resolve();
  return document.fonts.ready
    .then(() => undefined)
    .catch(() => {
      console.warn("Font loading failed");
      return undefined;
    });
}

export { getScreenParticleConfig } from "./screen-particle-config";
