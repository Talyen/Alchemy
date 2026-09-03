import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAppInBackground, useAppAudioEffects } from "@/app/use-app-effects";
import {
  invalidateCacheForKey,
  isMusicPaused,
  isNonPlayerAudioHost,
  playMusic,
  playMusicImmediate,
  setMasterVolume,
  setMusicVolume,
  setMuted,
  setSfxVolume,
} from "@/lib/audio";
import { MUSIC_KEYS } from "@/lib/game-constants";
import type { Screen } from "@/lib/routing";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";

const battleActive = vi.hoisted(() => ({ value: false }));

vi.mock("@/features/alchemy/shared/stores/run-reads", () => ({
  readBattle: () => ({ hasActiveBattle: false }),
  useHasActiveBattle: () => battleActive.value,
}));

vi.mock("@/lib/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio")>()),
  setMuted: vi.fn(),
  setMasterVolume: vi.fn(),
  setMusicVolume: vi.fn(),
  setSfxVolume: vi.fn(),
  preloadAllSounds: vi.fn(),
  playMusic: vi.fn(),
  playMusicImmediate: vi.fn(),
  isMusicPaused: vi.fn(() => false),
  invalidateCacheForKey: vi.fn(),
  isNonPlayerAudioHost: vi.fn(() => false),
}));

describe("isAppInBackground", () => {
  afterEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    vi.unstubAllGlobals();
  });

  it("treats a hidden document as background", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    expect(isAppInBackground()).toBe(true);
  });

  it("treats window blur as background even when the document stays visible", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    expect(isAppInBackground({ type: "blur" })).toBe(true);
  });

  it("treats window focus as foreground when the document is visible", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    expect(isAppInBackground({ type: "focus" })).toBe(false);
  });

  it("does not wait for a click to treat a focused visible window as foreground", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    const hasFocus = vi.spyOn(Document.prototype, "hasFocus").mockReturnValue(true);
    vi.stubGlobal("navigator", {
      ...navigator,
      userActivation: { hasBeenActive: false, isActive: false },
    });
    expect(isAppInBackground()).toBe(false);
    hasFocus.mockRestore();
  });
});

describe("useAppAudioEffects mute-in-background", () => {
  let unmountAudio: (() => void) | undefined;

  function renderAudio(muteInBackground = true, screen: Screen = "menu") {
    const rendered = renderHook(() =>
      useAppAudioEffects({
        masterVolume: 50,
        musicVolume: 50,
        sfxVolume: 50,
        muteInBackground,
        screen,
      }),
    );
    unmountAudio = rendered.unmount;
    return rendered;
  }

  beforeEach(() => {
    battleActive.value = false;
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    vi.mocked(setMuted).mockClear();
    vi.mocked(setMasterVolume).mockClear();
    vi.mocked(setMusicVolume).mockClear();
    vi.mocked(setSfxVolume).mockClear();
    vi.mocked(playMusic).mockClear();
    vi.mocked(playMusicImmediate).mockClear();
    vi.mocked(invalidateCacheForKey).mockClear();
    vi.mocked(isMusicPaused).mockReturnValue(false);
    vi.mocked(isNonPlayerAudioHost).mockReturnValue(false);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    unmountAudio?.();
    unmountAudio = undefined;
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("mutes on blur while the page is still visible", () => {
    renderAudio(true);
    vi.mocked(setMuted).mockClear();

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(setMuted).toHaveBeenCalledWith(true);
  });

  it("unmutes on focus when the page is visible", () => {
    renderAudio(true);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    vi.mocked(setMuted).mockClear();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(setMuted).toHaveBeenCalledWith(false);
  });

  it("does not mute on blur when the option is off", () => {
    renderAudio(false);
    vi.mocked(setMuted).mockClear();

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(setMuted).toHaveBeenCalledWith(false);
  });

  it("does not unmute on a pointer gesture while the document is hidden", () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    renderAudio(true);
    vi.mocked(setMuted).mockClear();

    act(() => {
      window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(setMuted).not.toHaveBeenCalledWith(false);
  });

  it("unmutes on a pointer gesture while the page is focused and visible", () => {
    const hasFocus = vi.spyOn(Document.prototype, "hasFocus").mockReturnValue(true);
    renderAudio(true);
    vi.mocked(setMuted).mockClear();

    act(() => {
      window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(setMuted).toHaveBeenCalledWith(false);
    hasFocus.mockRestore();
  });

  it("force-mutes a non-player host even when mute-in-background is off", () => {
    vi.mocked(isNonPlayerAudioHost).mockReturnValue(true);
    const hasFocus = vi.spyOn(Document.prototype, "hasFocus").mockReturnValue(true);
    renderAudio(false);
    expect(setMuted).toHaveBeenCalledWith(true);
    hasFocus.mockRestore();
  });

  it("stays muted through a click in a non-player host", () => {
    vi.mocked(isNonPlayerAudioHost).mockReturnValue(true);
    const hasFocus = vi.spyOn(Document.prototype, "hasFocus").mockReturnValue(true);
    renderAudio(true);
    vi.mocked(setMuted).mockClear();

    act(() => {
      window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(setMuted).not.toHaveBeenCalledWith(false);
    hasFocus.mockRestore();
  });

  it("syncs settings percentages as fractional volumes", () => {
    renderAudio(true);
    expect(setMasterVolume).toHaveBeenCalledWith(0.5);
    expect(setMusicVolume).toHaveBeenCalledWith(0.5);
    expect(setSfxVolume).toHaveBeenCalledWith(0.5);
  });

  it("plays battle music when the screen changes to battle", () => {
    const rendered = renderHook(
      ({ screen }: { screen: Screen }) =>
        useAppAudioEffects({
          masterVolume: 50,
          musicVolume: 50,
          sfxVolume: 50,
          muteInBackground: true,
          screen,
        }),
      { initialProps: { screen: "menu" as Screen } },
    );
    unmountAudio = rendered.unmount;
    vi.mocked(playMusic).mockClear();

    rendered.rerender({ screen: "battle" });

    expect(playMusic).toHaveBeenCalledWith(MUSIC_KEYS.BATTLE);
  });

  it("refreshes the menu music cache when a battle starts", () => {
    const rendered = renderHook(
      ({ screen }: { screen: Screen }) =>
        useAppAudioEffects({
          masterVolume: 50,
          musicVolume: 50,
          sfxVolume: 50,
          muteInBackground: true,
          screen,
        }),
      { initialProps: { screen: "menu" as Screen } },
    );
    unmountAudio = rendered.unmount;
    vi.mocked(invalidateCacheForKey).mockClear();
    battleActive.value = true;

    rendered.rerender({ screen: "menu" });

    expect(invalidateCacheForKey).toHaveBeenCalledWith(MUSIC_KEYS.MENU);
  });

  it("resumes paused music on a foreground gesture", () => {
    vi.mocked(isMusicPaused).mockReturnValue(true);
    const hasFocus = vi.spyOn(Document.prototype, "hasFocus").mockReturnValue(true);
    renderAudio(true);
    vi.mocked(playMusicImmediate).mockClear();

    act(() => {
      window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(playMusicImmediate).toHaveBeenCalledWith(MUSIC_KEYS.MENU);
    hasFocus.mockRestore();
  });
});
