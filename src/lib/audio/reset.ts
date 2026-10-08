import { audioState } from "./state";
import { resetHtmlSfxRuntime } from "./sfx";
import { resetMusicRuntimeForTests } from "./music";
import { resetSoundPreloadCache } from "./preload";
import { stopScreenAmbience } from "./ambience";

/**
 * Single test-only reset for the audio runtime. Clears mute/host/cooldown
 * state, SFX and music runtimes, and the preload + URL caches. Volumes stay
 * owned by the test: set them before or after calling this. Adding new audio
 * module state must extend this function instead of `tests/helpers/*` so
 * tests keep one reset path.
 */
export function resetAudioRuntimeForTests(): void {
  audioState.muted = false;
  resetHtmlSfxRuntime();
  resetMusicRuntimeForTests();
  resetSoundPreloadCache();
  stopScreenAmbience();
}
