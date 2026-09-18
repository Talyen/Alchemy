/**
 * Shared setup for audio playback tests (sfx/music/volume/host/preload).
 * Combines the canonical runtime reset with the `Audio` element stub so new
 * audio tests need one call. Volumes stay owned by the test: set them before
 * or after calling this. To swap stub options mid-test without resetting
 * runtime state, call `installFakeAudio` directly instead.
 */
import { resetAudioRuntimeForTests } from "@/lib/audio";
import { installFakeAudio, type FakeAudioOptions } from "./fake-audio";

export function installCleanAudio(options: FakeAudioOptions = {}): void {
  resetAudioRuntimeForTests();
  installFakeAudio(options);
}
