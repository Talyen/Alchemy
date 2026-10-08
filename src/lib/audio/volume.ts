import { isNonPlayerAudioHost } from "./host";
import { audioState } from "./state";
import { syncMusicSettings, pauseAllMusic } from "./music";
import { syncActiveHtmlSfxPlayback } from "./sfx";
import { clamp01 } from "../math";
import { syncScreenAmbience } from "./ambience";

function syncPlaybackSettings() {
  syncActiveHtmlSfxPlayback();
  syncMusicSettings();
  syncScreenAmbience();
}

export function setMuted(value: boolean) {
  // Window visibility can change after startup; host muting cannot be latched.
  const mutedHost = isNonPlayerAudioHost();
  audioState.muted = value || mutedHost;
  syncPlaybackSettings();
  if (mutedHost) pauseAllMusic();
}

export function initAudioHost() {
  setMuted(audioState.muted);
}

export function setSfxVolume(value: number) {
  audioState.sfxVolume = clamp01(value);
  syncActiveHtmlSfxPlayback();
  syncScreenAmbience();
}

export function setMasterVolume(value: number) {
  audioState.masterVolume = clamp01(value);
  syncPlaybackSettings();
}

export function setMusicVolume(value: number) {
  audioState.musicVolume = clamp01(value);
  syncMusicSettings();
}
