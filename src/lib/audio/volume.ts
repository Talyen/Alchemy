import { isNonPlayerAudioHost } from "./host";
import { audioState } from "./state";
import { applyMusicVolume, pauseAllMusic } from "./music";
import { syncActiveHtmlSfxPlayback } from "./sfx";
import { clamp01 } from "../math";

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
