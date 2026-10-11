import { Profiler } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BossLyrics } from "@/features/alchemy/run-loop/screens/battle-screen/boss-lyrics";
import { readMusicPlayback } from "@/lib/audio";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";

vi.mock("@/lib/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio")>()),
  readMusicPlayback: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  useSettingsStore.getState().setBossLyricsEnabled(true);
  vi.mocked(readMusicPlayback).mockReturnValue({ key: MUSIC_KEYS.BOSS_BLIGHT_TREANT, currentTime: 0.7, audible: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useSettingsStore.getState().setBossLyricsEnabled(true);
});

function at(time: number, key: string = MUSIC_KEYS.BOSS_BLIGHT_TREANT, playing = true) {
  vi.mocked(readMusicPlayback).mockReturnValue({ key, currentTime: time, audible: playing });
  act(() => {
    vi.advanceTimersByTime(40);
  });
}

it("builds words without remounting earlier words and recovers after gaps, pause, and loop", () => {
  render(<BossLyrics bossId="blight-treant" />);
  const lyrics = screen.getByTestId("boss-lyrics");
  expect(lyrics.textContent).toBe("I");
  const first = lyrics.firstElementChild;
  at(1.8);
  expect(lyrics.children.length).toBeGreaterThan(1);
  expect(lyrics.firstElementChild).toBe(first);
  expect(lyrics.querySelectorAll(".text-gold-pale")).toHaveLength(1);
  at(250);
  expect(lyrics.textContent).toBe("");
  at(1.8);
  expect(lyrics.children.length).toBeGreaterThan(1);
  at(1.8, MUSIC_KEYS.BOSS_BLIGHT_TREANT, false);
  expect(lyrics.textContent).toBe("");
  at(0.7);
  expect(lyrics.textContent).toBe("I");
  at(0.7, MUSIC_KEYS.MENU);
  expect(lyrics.textContent).toBe("");
});

it("removes lyrics and polling when disabled or the boss has no timings, and cleans up on exit", () => {
  const { rerender, unmount } = render(<BossLyrics bossId="blight-treant" />);
  expect(vi.getTimerCount()).toBe(1);
  act(() => {
    useSettingsStore.getState().setBossLyricsEnabled(false);
  });
  expect(screen.queryByTestId("boss-lyrics")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  act(() => {
    useSettingsStore.getState().setBossLyricsEnabled(true);
  });
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("I");
  rerender(<BossLyrics bossId="forge-golem" />);
  expect(vi.getTimerCount()).toBe(0);
  rerender(<BossLyrics bossId="blight-treant" />);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not commit React updates for repeated samples inside the same sung word", () => {
  const commit = vi.fn();
  render(
    <Profiler id="lyrics" onRender={commit}>
      <BossLyrics bossId="blight-treant" />
    </Profiler>,
  );
  commit.mockClear();
  act(() => {
    vi.advanceTimersByTime(4000);
  });
  expect(commit).not.toHaveBeenCalled();
  at(1.8);
  expect(commit).toHaveBeenCalledOnce();
});
