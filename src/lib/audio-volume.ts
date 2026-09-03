import { isNonPlayerAudioHost } from "./audio-host";
import { audioState } from "./audio-state";
import { applyMusicVolume, pauseAllMusic } from "./audio-music";
import { syncActiveHtmlSfxPlayback } from "./audio-sfx";
import { clamp } from "./math";

function applyMuteToElements() {
  syncActiveHtmlSfxPlayback();
  if (audioState.currentMusic) {
    audioState.currentMusic.muted = audioState.muted;
  }
  if (audioState.muted && isNonPlayerAudioHost()) pauseAllMusic();
}

export function setMuted(value: boolean) {
  audioState.muted = value || audioState.hostForcesMute || isNonPlayerAudioHost();
  applyMuteToElements();
}

export function initAudioHost() {
  audioState.hostForcesMute = isNonPlayerAudioHost();
  if (audioState.hostForcesMute) {
    audioState.muted = true;
    applyMuteToElements();
  }
}

export function setSfxVolume(value: number) {
  audioState.sfxVolume = clamp(value, 0, 1);
  syncActiveHtmlSfxPlayback();
}

export function setMasterVolume(value: number) {
  audioState.masterVolume = clamp(value, 0, 1);
  syncActiveHtmlSfxPlayback();

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}

export function setMusicVolume(value: number) {
  audioState.musicVolume = clamp(value, 0, 1);

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}
