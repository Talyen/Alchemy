import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setScreenAmbience, stopScreenAmbience } from "@/lib/audio/ambience";
import { audioState } from "@/lib/audio/state";
import { setMasterVolume, setMuted, setSfxVolume } from "@/lib/audio/volume";
import { SFX_AMBIENCE_VOLUME } from "@/lib/game-constants";
import { installCleanAudio } from "../../helpers/audio-fixture";
import { createdFakeAudio, lastFakeAudio } from "../../helpers/fake-audio";

beforeEach(() => {
  installCleanAudio();
  audioState.masterVolume = 1;
  audioState.sfxVolume = 0.5;
});
afterEach(() => {
  stopScreenAmbience();
  vi.unstubAllGlobals();
});

it("replaces room loops, ignores stale callbacks, follows volume/mute, and releases them on exit", () => {
  setScreenAmbience("campfire");
  const camp = lastFakeAudio()!;
  const staleError = camp.onerror!;
  expect(camp.loop).toBe(true);
  expect(camp.play).toHaveBeenCalledOnce();
  expect(camp.volume).toBeCloseTo(SFX_AMBIENCE_VOLUME * 0.5);
  setScreenAmbience("labyrinth-map");
  const labyrinth = lastFakeAudio()!;
  expect(camp.pause).toHaveBeenCalledOnce();
  expect(camp.removeAttribute).toHaveBeenCalledWith("src");
  staleError();
  expect(labyrinth.pause).not.toHaveBeenCalled();
  setMasterVolume(0.5);
  setSfxVolume(0.25);
  expect(labyrinth.volume).toBeCloseTo(SFX_AMBIENCE_VOLUME * 0.5 * 0.25);
  setMuted(true);
  expect(labyrinth.pause).toHaveBeenCalledOnce();
  setMuted(false);
  const resumed = lastFakeAudio()!;
  expect(resumed.play).toHaveBeenCalledOnce();
  setScreenAmbience("menu");
  expect(resumed.pause).toHaveBeenCalledOnce();
  const count = createdFakeAudio.length;
  setMuted(false);
  expect(createdFakeAudio).toHaveLength(count);
});

it("keeps non-player hosts silent and lets navigation continue when audio is unavailable", () => {
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Electron/28.0.0" });
  setScreenAmbience("campfire");
  expect(createdFakeAudio).toHaveLength(0);
  vi.unstubAllGlobals();
  vi.stubGlobal("Audio", undefined);
  expect(() => setScreenAmbience("labyrinth-map")).not.toThrow();
  expect(() => stopScreenAmbience()).not.toThrow();
});
