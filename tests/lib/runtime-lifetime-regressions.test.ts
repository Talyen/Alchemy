import { afterEach, expect, it, vi } from "vitest";
import { createSessionLifetime } from "@/features/alchemy/shared/stores/session/session-lifetime";
import { createSfxPlayer } from "@/lib/audio/sfx-player";
import { createMusicPlayer } from "@/lib/audio/music-player";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { createFakeAudioElement } from "../helpers/fake-audio";

afterEach(() => vi.useRealTimers());

it("session clocks release synchronously fired timers before reused IDs can cancel newer work", () => {
  const lifetime = createSessionLifetime();
  const callbacks: Array<() => void> = [];
  const clear = vi.fn();
  let immediate = true;
  const clock = lifetime.ownClock({
    now: () => 0,
    setTimeout(callback) {
      if (immediate) callback();
      else callbacks.push(callback);
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: clear,
  });
  const callback = vi.fn();
  const timer = clock.setTimeout(() => {
    immediate = false;
    clock.setTimeout(callback, 1);
  }, 0);
  clock.clearTimeout(timer);
  expect(clear).toHaveBeenCalledTimes(1);
  callbacks[0]!();
  expect(callback).not.toHaveBeenCalled();
  lifetime.close();
});

it("SFX owns delayed cues before calling a scheduler and tolerates scheduling failure", () => {
  const element = createFakeAudioElement();
  const schedule = vi.fn((callback: () => void) => {
    callback();
    return 1 as unknown as ReturnType<typeof setTimeout>;
  });
  const player = createSfxPlayer({
    createElement: () => element,
    readSettings: () => ({ muted: false, sfxVolume: 1, masterVolume: 1 }),
    now: () => 0,
    schedule,
    cancel: vi.fn(),
  });
  player.play("hit", { delay: 1 });
  expect(element.play).toHaveBeenCalledOnce();
  schedule.mockImplementationOnce(() => {
    throw new Error("scheduler unavailable");
  });
  expect(() => player.play("later", { delay: 1 })).not.toThrow();
  player.reset();
  expect(element.pause).toHaveBeenCalledOnce();
});

function musicHarness() {
  vi.useFakeTimers();
  const elements: Array<ReturnType<typeof createFakeAudioElement>> = [];
  const deps = {
    createElement: (file: string) => {
      const element = createFakeAudioElement(file);
      elements.push(element);
      return element;
    },
    selectFile: vi.fn((files: readonly string[]) => files[0]),
    readSettings: () => ({ musicVolume: 1, masterVolume: 1, muted: false }),
    canPlay: () => true,
    now: () => Date.now(),
    schedule: vi.fn((callback: () => void, interval: number) => setInterval(callback, interval)),
    cancel: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
    reportFailure: vi.fn(),
  };
  return { deps, elements, player: createMusicPlayer(deps) };
}

it("music selection failures preserve the current track and remain retryable", () => {
  const { player, deps, elements } = musicHarness();
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  deps.selectFile.mockImplementationOnce(() => {
    throw new Error("catalog provider unavailable");
  });
  expect(() => player.playMusicImmediate(MUSIC_KEYS.BATTLE)).not.toThrow();
  expect(player.readMusicPlayback()?.key).toBe(MUSIC_KEYS.MENU);
  expect(elements[0]?.paused).toBe(false);
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(player.readMusicPlayback()?.key).toBe(MUSIC_KEYS.BATTLE);
  player.reset();
});

it("a failed music fade scheduler cannot strand a track at zero volume", () => {
  const { player, deps } = musicHarness();
  deps.schedule.mockImplementationOnce(() => {
    throw new Error("timer unavailable");
  });
  expect(() => player.playMusic(MUSIC_KEYS.MENU)).not.toThrow();
  expect(player.readMusicPlayback()).toMatchObject({ key: MUSIC_KEYS.MENU, audible: true });
  player.reset();
});

it("pausing music attempts every cached track even when one media pause throws", () => {
  const { player, elements } = musicHarness();
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  elements[0]!.pause.mockImplementationOnce(() => {
    throw new Error("detached media");
  });
  expect(() => player.pauseAllMusic()).not.toThrow();
  expect(elements[1]?.paused).toBe(true);
  expect(elements[1]?.muted).toBe(true);
  player.reset();
});
