// Volume and mute controls shared by SFX and streamed music.
// Depends on shared audio state, music volume application, and audio tuning constants.
// Used by options UI through the public lib/audio facade.
import { MASTER_GAIN } from "./game-constants";
import { audioState } from "./audio-state";
import { applyMusicVolume } from "./audio-music";
import { clamp } from "./utils";

// Mutes both Web Audio playback gate and the current streamed music element.
export function setMuted(value: boolean) {
  audioState.muted = value;
  if (audioState.currentMusic) {
    audioState.currentMusic.muted = audioState.muted;
  }
}

// Reports the current global mute state for options UI initialization.
export function getMuted(): boolean {
  return audioState.muted;
}

// Stores the SFX layer volume within the normalized slider range.
export function setSfxVolume(value: number) {
  audioState.sfxVolume = clamp(value, 0, 1);
}

// Reports the current SFX volume for options UI initialization.
export function getSfxVolume(): number {
  return audioState.sfxVolume;
}

// Applies master volume to both future SFX gain and current streamed music.
export function setMasterVolume(value: number) {
  audioState.masterVolume = clamp(value, 0, 1);
  if (audioState.masterGain) {
    audioState.masterGain.gain.value = MASTER_GAIN * audioState.masterVolume;
  }
  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}

// Reports the current master volume for options UI initialization.
export function getMasterVolume(): number {
  return audioState.masterVolume;
}

// Stores music volume and updates the active streamed track immediately.
export function setMusicVolume(value: number) {
  audioState.musicVolume = clamp(value, 0, 1);
  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}

// Reports the current music volume for options UI initialization.
export function getMusicVolume(): number {
  return audioState.musicVolume;
}
