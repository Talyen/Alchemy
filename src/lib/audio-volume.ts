// Volume and mute controls shared by SFX and streamed music.
// Used by options UI through the public lib/audio facade.
import { isNonPlayerAudioHost } from "./audio-host";
import { audioState } from "./audio-state";
import { applyMusicVolume, pauseAllMusic } from "./audio-music";
import { syncActiveHtmlSfxPlayback } from "./audio-sfx";
import { clamp } from "./utils";

function applyMuteToElements() {
  syncActiveHtmlSfxPlayback();
  if (audioState.currentMusic) {
    audioState.currentMusic.muted = audioState.muted;
  }
  if (audioState.muted && isNonPlayerAudioHost()) pauseAllMusic();
}

// Mutes streamed music and in-flight HTMLAudio SFX. Non-player hosts stay muted.
export function setMuted(value: boolean) {
  audioState.muted = value || isNonPlayerAudioHost();
  applyMuteToElements();
}

if (isNonPlayerAudioHost()) setMuted(true);

// Stores the SFX layer volume within the normalized slider range [0, 1].
export function setSfxVolume(value: number) {
  audioState.sfxVolume = clamp(value, 0, 1);
  syncActiveHtmlSfxPlayback();
}

// Applies master volume to both in-flight SFX and current streamed music.
export function setMasterVolume(value: number) {
  audioState.masterVolume = clamp(value, 0, 1);
  syncActiveHtmlSfxPlayback();

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}

// Stores music volume and updates the active streamed track immediately.
export function setMusicVolume(value: number) {
  audioState.musicVolume = clamp(value, 0, 1);

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}
