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
import type { Screen } from "@/features/alchemy/shared/types";

type AppAudioEffectsOptions = {
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  muteInBackground: boolean;
  screen: Screen;
};

// Applies persisted audio options and swaps menu/battle music as the route changes.
// Music streaming (~45 MB of MP3s) is deferred until the first user gesture so it
// doesn't compete with the JS bundle and CSS during the critical startup window.
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

  const initialScreenRef = useRef(true);

  useEffect(() => {
    screenRef.current = screen;
    // Skip the first playMusic call — the gesture handler owns music startup so
    // it can start at the correct saved volume without an audible level jump.
    if (initialScreenRef.current) {
      initialScreenRef.current = false;
      return;
    }
    playMusic(screen === "battle" ? MUSIC_KEYS.BATTLE : MUSIC_KEYS.MENU);
  }, [screen]);

  useEffect(() => {
    // Sound effect preloading starts immediately (the work is spread across idle
    // callbacks so it doesn't compete with the first render). Music playback is
    // gated on the first user gesture (below) so the ~45 MB of MP3s are not fetched
    // during the critical startup window.
    preloadAllSounds();

    // Gesture fallback: starts music inside a user gesture handler so autoplay
    // restrictions never block audible playback. Only fires once.
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
