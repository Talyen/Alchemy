import { Profiler } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BossLyrics } from "@/features/alchemy/run-loop/screens/battle-screen/boss-lyrics";
import { readMusicPlayback } from "@/lib/audio";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";
import { useSettingsStore } from "@/features/alchemy/shared/stores/react/settings-store";

vi.mock("@/lib/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio")>()),
  readMusicPlayback: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  installCatalogs(catalogs);
  vi.useFakeTimers();
  useSettingsStore.getState().setBossLyricsEnabled(true);
  vi.mocked(readMusicPlayback).mockReturnValue({ key: MUSIC_KEYS.BOSS_BLIGHT_TREANT, currentTime: 0.7, audible: true });
});
afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useSettingsStore.getState().setBossLyricsEnabled(true);
  await localization.changeLanguage("en");
});

function at(time: number, key: string = MUSIC_KEYS.BOSS_BLIGHT_TREANT, playing = true) {
  vi.mocked(readMusicPlayback).mockReturnValue({ key, currentTime: time, audible: playing });
  act(() => {
    vi.advanceTimersByTime(40);
  });
}

it("keeps sung words verbatim, localizes vocal cues, and recovers after gaps, pause, and loop", async () => {
  const { rerender } = render(<BossLyrics bossId="blight-treant" />);
  const lyrics = screen.getByTestId("boss-lyrics");
  expect(lyrics.textContent).toBe("I");
  const first = lyrics.firstElementChild;
  at(1.8);
  expect(lyrics.textContent).toBe("I was a grove");
  expect(lyrics.firstElementChild).toBe(first);
  expect(lyrics.querySelectorAll(".text-gold-pale")).toHaveLength(1);
  await act(async () => {
    await localization.changeLanguage("en-XA");
  });
  expect(lyrics.textContent).toBe("I was a grove");
  expect(lyrics.getAttribute("aria-label")).not.toBe("Song lyrics");
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
  await act(async () => {
    await localization.changeLanguage("en");
  });
  rerender(<BossLyrics bossId="iron-bear" />);
  const ironLyrics = screen.getByTestId("boss-lyrics");
  at(156, MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(ironLyrics.textContent).toBe("[growls]");
  await act(async () => {
    await localization.changeLanguage("de");
  });
  expect(ironLyrics.textContent).toBe("[Knurren]");
  at(164, MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(ironLyrics.textContent).toBe("Feed the mountain.");
  at(218, MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(ironLyrics.textContent).toBe("[Gesänge]");
  at(230, MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(ironLyrics.textContent).toBe("");
});

it("switches each boss using media time and stops polling when disabled, unsupported, or unmounted", () => {
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
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("");
  at(31, MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("Built");
  rerender(<BossLyrics bossId="frostwarden" />);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("");
  at(27, MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("Where");
  rerender(<BossLyrics bossId="iron-bear" />);
  at(6, MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("");
  at(31.1, MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("From");
  rerender(<BossLyrics bossId="blood-countess" />);
  at(20, MUSIC_KEYS.BOSS_BLOOD_COUNTESS);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("");
  at(21, MUSIC_KEYS.BOSS_BLOOD_COUNTESS);
  expect(screen.getByTestId("boss-lyrics").textContent).toBe("I");
  rerender(<BossLyrics bossId="unknown-boss" />);
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
