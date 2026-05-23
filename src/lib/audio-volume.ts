// Volume and mute controls shared by SFX and streamed music.
// Depends on shared audio state, music volume application, and audio tuning constants.
// Used by options UI through the public lib/audio facade.
import { MASTER_GAIN } from "./game-constants";
import { audioState } from "./audio-state";
import { applyMusicVolume } from "./audio-music";
import { clamp } from "./utils";

// Local volume bounds and defaults.
const VOLUME_CONFIG = {
  VOLUME_MIN: 0.0,
  VOLUME_MAX: 1.0,
  MUTED_GAIN_VALUE: 0.0,
} as const;

// Mutes both Web Audio playback gate and the current streamed music element.
export function setMuted(value: boolean) {
  audioState.muted = value;

  if (audioState.masterGain) {
    audioState.masterGain.gain.value = audioState.muted
      ? VOLUME_CONFIG.MUTED_GAIN_VALUE
      : MASTER_GAIN * audioState.masterVolume;
  }

  if (audioState.currentMusic) {
    audioState.currentMusic.muted = audioState.muted;
  }
}

// Stores the SFX layer volume within the normalized slider range.
// Clamped to guarantee it falls within standard [0, 1] range.
export function setSfxVolume(value: number) {
  audioState.sfxVolume = clamp(value, VOLUME_CONFIG.VOLUME_MIN, VOLUME_CONFIG.VOLUME_MAX);
}

// Applies master volume to both future SFX gain and current streamed music.
export function setMasterVolume(value: number) {
  audioState.masterVolume = clamp(value, VOLUME_CONFIG.VOLUME_MIN, VOLUME_CONFIG.VOLUME_MAX);

  if (audioState.masterGain) {
    audioState.masterGain.gain.value = audioState.muted
      ? VOLUME_CONFIG.MUTED_GAIN_VALUE
      : MASTER_GAIN * audioState.masterVolume;
  }

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}

// Stores music volume and updates the active streamed track immediately.
export function setMusicVolume(value: number) {
  audioState.musicVolume = clamp(value, VOLUME_CONFIG.VOLUME_MIN, VOLUME_CONFIG.VOLUME_MAX);

  if (audioState.currentMusic) {
    applyMusicVolume(audioState.currentMusic);
  }
}
