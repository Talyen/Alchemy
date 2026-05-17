// Root-level audio preference and screen music side effects.
// Depends on the audio facade, music constants, and screen type from alchemy.
import { useEffect, useRef } from "react";

import { MUSIC_KEYS } from "@/lib/game-constants";
import { playMusic, playMusicImmediate, setMasterVolume, setMusicVolume, setMuted, setSfxVolume } from "@/lib/audio";
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
  const musicStartedRef = useRef(false);

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
    const key = screen === "battle" ? MUSIC_KEYS.BATTLE : MUSIC_KEYS.MENU;
    if (!musicStartedRef.current) {
      // First music start is immediate to avoid fade-from-silence; later screen changes
      // use crossfade so battle/menu transitions still feel deliberate.
      musicStartedRef.current = true;
      playMusicImmediate(key);
    } else {
      playMusic(key);
    }
  }, [screen]);
}
