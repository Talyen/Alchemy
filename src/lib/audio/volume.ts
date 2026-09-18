import { isNonPlayerAudioHost } from "./host";
import { audioState } from "./state";
import { applyMusicVolume, pauseAllMusic } from "./music";
import { syncActiveHtmlSfxPlayback } from "./sfx";
import { clamp01 } from "../math";

function applyMuteToElements(mutedHost: boolean) {
  syncActiveHtmlSfxPlayback();
  if (audioState.currentMusic) {
    audioState.currentMusic.muted = audioState.muted;
  }
  if (audioState.muted && mutedHost) pauseAllMusic();
}

export function setMuted(value: boolean) {
  // Read the host once: initAudioHost caches it in hostForcesMute, but
  // setMuted must also stay correct when it runs before init (or in tests).
  const mutedHost = audioState.hostForcesMute || isNonPlayerAudioHost();
  audioState.muted = value || mutedHost;
  applyMuteToElements(mutedHost);
}

export function initAudioHost() {
  audioState.hostForcesMute = isNonPlayerAudioHost();
  if (audioState.hostForcesMute) {
    audioState.muted = true;
    applyMuteToElements(true);
  }
}

export function setSfxVolume(value: number) {
  audioState.sfxVolume = clamp01(value);
  syncActiveHtmlSfxPlayback();
}

export function setMasterVolume(value: number) {
  audioState.masterVolume = clamp01(value);
  syncActiveHtmlSfxPlayback();

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}

export function setMusicVolume(value: number) {
  audioState.musicVolume = clamp01(value);

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}
