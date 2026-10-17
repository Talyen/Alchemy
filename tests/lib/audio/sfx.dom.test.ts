import { expect, it, beforeEach, afterEach, vi } from "vitest";
import { stopAllSfx, playCardSound, playBattleEvent, playUISound, playVictory } from "@/lib/audio/sfx";
import { setMuted } from "@/lib/audio/volume";
import { resetAudioRuntimeForTests } from "@/lib/audio/reset";
import { installCleanAudio } from "../../helpers/audio-fixture";
import { soundedFakeAudio } from "../../helpers/fake-audio";

beforeEach(() => installCleanAudio());
afterEach(() => {
  resetAudioRuntimeForTests();
  vi.unstubAllGlobals();
});

it("routes cold combat, crafted Potion, UI and victory cues with their cleanup and mute policies", () => {
  playCardSound("slash");
  playCardSound("mixed-potion-health-potion-0-mana-potion-0");
  playUISound("error");
  playVictory();
  const [sword, potion, ui, victory] = soundedFakeAudio();
  expect(soundedFakeAudio()).toHaveLength(4);
  expect(sword?.src).toContain("sword-attack-1.");
  expect(potion?.src).toContain("ice-in-water.");
  for (const element of soundedFakeAudio()) expect(element.play).toHaveBeenCalledOnce();
  stopAllSfx();
  for (const element of [sword, potion]) expect(element?.removeAttribute).toHaveBeenCalledWith("src");
  for (const element of [ui, victory]) expect(element?.pause).not.toHaveBeenCalled();
  setMuted(true);
  for (const element of [ui, victory]) expect(element?.muted).toBe(true);
  playBattleEvent("enemyHit");
  expect(soundedFakeAudio()).toHaveLength(4);
});
