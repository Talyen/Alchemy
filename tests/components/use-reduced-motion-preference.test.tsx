import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useReducedMotionPreference", () => {
  it("shares listeners, updates every consumer, and releases them after the last unmount", () => {
    const media = new EventTarget();
    let matches = false;
    Object.defineProperty(media, "matches", { get: () => matches });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media as MediaQueryList),
    );
    const addMedia = vi.spyOn(media, "addEventListener");
    const removeMedia = vi.spyOn(media, "removeEventListener");
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const first = renderHook(useReducedMotionPreference);
    const second = renderHook(useReducedMotionPreference);
    expect(first.result.current).toBe(false);
    expect(second.result.current).toBe(false);
    expect(addMedia).toHaveBeenCalledTimes(1);
    expect(addWindow.mock.calls.filter(([event]) => event === "storage")).toHaveLength(1);

    act(() => {
      matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(true);

    first.unmount();
    expect(removeMedia).not.toHaveBeenCalled();
    act(() => {
      matches = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(second.result.current).toBe(false);
    second.unmount();
    expect(removeMedia).toHaveBeenCalledTimes(1);
    expect(removeWindow.mock.calls.filter(([event]) => event === "storage")).toHaveLength(1);
  });

  it("honors the disable flag on mount, storage updates, and remount", () => {
    localStorage.setItem("alchemy-disable-animations", "true");
    const first = renderHook(useReducedMotionPreference);
    expect(first.result.current).toBe(true);
    act(() => {
      localStorage.removeItem("alchemy-disable-animations");
      window.dispatchEvent(new StorageEvent("storage", { key: "alchemy-disable-animations" }));
    });
    expect(first.result.current).toBe(false);
    first.unmount();

    localStorage.setItem("alchemy-disable-animations", "true");
    const replacement = renderHook(useReducedMotionPreference);
    expect(replacement.result.current).toBe(true);
  });
});
