// Root-level audio preference and screen music side effects.
// Depends on the audio facade, music constants, and screen type from alchemy.
import { useEffect, useRef } from "react";

import { MUSIC_KEYS } from "@/lib/game-constants";
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
import type { Screen } from "@/features/alchemy/types";

type AppAudioEffectsOptions = {
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  muteInBackground: boolean;
  screen: Screen;
};

// Applies persisted audio options and swaps menu/battle music as the route changes.
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
    // Background mute must respond to both tab visibility and focus changes, then always
    // unmute on cleanup so toggling the option cannot leave the audio graph muted.
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

  useEffect(() => {
    screenRef.current = screen;
    playMusic(screen === "battle" ? MUSIC_KEYS.BATTLE : MUSIC_KEYS.MENU);
  }, [screen]);

  useEffect(() => {
    // Eagerly start audio — works immediately when Chrome's Media Engagement Index
    // allows it for this origin. Silently caught by the browser otherwise.
    preloadAllSounds();
    playMusicImmediate(screenRef.current === "battle" ? MUSIC_KEYS.BATTLE : MUSIC_KEYS.MENU);

    // Gesture fallback: if the browser blocked audio (low MEI), retrying inside a
    // user gesture handler bypasses autoplay restrictions. Only fires once so
    // subsequent keyboard/mouse input does not restart music.
    function resumeOnGesture() {
      if (gestureFiredRef.current) return;
      gestureFiredRef.current = true;
      resumeAudioContext();
      if (!audioState.currentMusic || audioState.currentMusic.paused) {
        playMusicImmediate(screenRef.current === "battle" ? MUSIC_KEYS.BATTLE : MUSIC_KEYS.MENU);
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
