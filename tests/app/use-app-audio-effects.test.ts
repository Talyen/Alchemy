import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAppInBackground, useAppAudioEffects } from "@/app/use-app-effects";
import { isNonPlayerAudioHost, setMuted } from "@/lib/audio";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";

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

  function renderAudio(muteInBackground = true) {
    const rendered = renderHook(() =>
      useAppAudioEffects({
        masterVolume: 50,
        musicVolume: 50,
        sfxVolume: 50,
        muteInBackground,
        screen: "menu",
      }),
    );
    unmountAudio = rendered.unmount;
    return rendered;
  }

  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    vi.mocked(setMuted).mockClear();
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
});
