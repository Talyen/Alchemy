import { useEffect, useLayoutEffect, useRef } from "react";
import { MUSIC_KEYS } from "@/lib/game-constants";
import {
  getBossMusicKey,
  initAudioHost,
  invalidateCacheForKey,
  isAppInBackground,
  isMusicPaused,
  isNonPlayerAudioHost,
  playMusic,
  playMusicImmediate,
  preloadAllSounds,
  setMasterVolume,
  setMusicVolume,
  setMuted,
  setSfxVolume,
} from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import { isDesktop, setDisplayMode as setPlatformDisplayMode } from "@/lib/platform";
import type { DisplayMode } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { useHasActiveBattle } from "@/features/alchemy/shared/stores/run-reads";

interface AppAudioEffectsOptions {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
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

export function useAppAudioEffects({
  masterVolume,
  musicVolume,
  sfxVolume,
  muteInBackground,
  screen,
}: AppAudioEffectsOptions) {
  const screenRef = useRef(screen);
  const gestureFiredRef = useRef(false);
  const muteInBackgroundRef = useRef(muteInBackground);

  useEffect(() => {
    setMasterVolume(masterVolume / 100);
    setMusicVolume(musicVolume / 100);
    setSfxVolume(sfxVolume / 100);
  }, [masterVolume, musicVolume, sfxVolume]);

  useEffect(() => {
    muteInBackgroundRef.current = muteInBackground;
    setMuted(isNonPlayerAudioHost() || (muteInBackground && isAppInBackground()));
  }, [muteInBackground]);

  useEffect(() => {
    initAudioHost();
    function applyBackgroundMute(event?: Event) {
      setMuted(isNonPlayerAudioHost() || (muteInBackgroundRef.current && isAppInBackground(event)));
    }

    applyBackgroundMute();
    document.addEventListener("visibilitychange", applyBackgroundMute);
    window.addEventListener("blur", applyBackgroundMute);
    window.addEventListener("focus", applyBackgroundMute);
    window.addEventListener("resize", applyBackgroundMute);
    return () => {
      document.removeEventListener("visibilitychange", applyBackgroundMute);
      window.removeEventListener("blur", applyBackgroundMute);
      window.removeEventListener("focus", applyBackgroundMute);
      window.removeEventListener("resize", applyBackgroundMute);
      setMuted(isNonPlayerAudioHost());
    };
  }, []);

  const initialScreenRef = useRef(true);

  const hasActiveBattle = useHasActiveBattle();
  const lastBattleActiveRef = useRef(hasActiveBattle);
  useEffect(() => {
    if (hasActiveBattle && !lastBattleActiveRef.current) {
      const musicKey = pickMusicKey("battle");
      invalidateCacheForKey(musicKey);
    }
    lastBattleActiveRef.current = hasActiveBattle;
    // `screen` is intentionally not a dep: the battle-start jingle cares only about
    // the battle-active transition; screen-driven music switches live below.
  }, [hasActiveBattle]);

  useEffect(() => {
    screenRef.current = screen;
    if (initialScreenRef.current) {
      // Bootstrap already started menu music; skip the first screen effect so
      // cold start doesn't restart the track.
      initialScreenRef.current = false;
      return;
    }
    playMusic(pickMusicKey(screen));
  }, [screen]);

  useEffect(() => {
    preloadAllSounds();

    function removeGestureListeners() {
      window.removeEventListener("pointerdown", resumeOnGesture, true);
      window.removeEventListener("keydown", resumeOnGesture, true);
    }

    function resumeOnGesture() {
      if (isNonPlayerAudioHost()) return;
      if (muteInBackgroundRef.current && isAppInBackground()) return;
      setMuted(false);
      if (gestureFiredRef.current) {
        removeGestureListeners();
        return;
      }
      gestureFiredRef.current = true;
      removeGestureListeners();
      if (isMusicPaused()) {
        playMusicImmediate(pickMusicKey(screenRef.current));
      }
    }

    window.addEventListener("pointerdown", resumeOnGesture, { capture: true });
    window.addEventListener("keydown", resumeOnGesture, { capture: true });
    return () => {
      removeGestureListeners();
    };
  }, []);
}

interface AppDisplayEffectsOptions {
  displayMode: DisplayMode;
  brightness: number;
  stageRef: React.RefObject<HTMLDivElement | null>;
}

export function useAppDisplayEffects({ displayMode, brightness, stageRef }: AppDisplayEffectsOptions) {
  "use no memo";
  useEffect(() => {
    document.body.dataset.displayMode = displayMode;
    if (isDesktop()) void setPlatformDisplayMode(displayMode);
  }, [displayMode]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (el) {
      const brightnessFactor = brightness / 100;
      el.style.filter = brightness > 100 ? `brightness(${brightnessFactor})` : "";
    }
  }, [brightness, stageRef]);
}

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
