// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useArmoryTargetingEvents } from "@/features/alchemy/meta/screens/armory/use-armory-targeting-events";

describe("useArmoryTargetingEvents", () => {
  it("calls clearTargeting on Escape when salvageMode is active", async () => {
    const clearTargeting = vi.fn();

    renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: true,
        activeCurrencyId: null,
        salvageTarget: null,
        clearTargeting,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(clearTargeting).toHaveBeenCalledTimes(1);
  });

  it("calls clearTargeting on Escape when activeCurrencyId is set", async () => {
    const clearTargeting = vi.fn();

    renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: false,
        activeCurrencyId: "ruby",
        salvageTarget: null,
        clearTargeting,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(clearTargeting).toHaveBeenCalledTimes(1);
  });

  it("does not call clearTargeting on Escape when salvageTarget is already set", async () => {
    const clearTargeting = vi.fn();

    renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: true,
        activeCurrencyId: null,
        salvageTarget: { definitionId: "sword", instanceId: "s-1", affixes: [] },
        clearTargeting,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(clearTargeting).not.toHaveBeenCalled();
  });

  it("calls clearTargeting on outside click when salvageMode is active", async () => {
    const clearTargeting = vi.fn();

    renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: true,
        activeCurrencyId: null,
        salvageTarget: null,
        clearTargeting,
      }),
    );

    act(() => {
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(clearTargeting).toHaveBeenCalledTimes(1);
  });

  it("does not register listeners when both salvageMode and activeCurrencyId are inactive", async () => {
    const clearTargeting = vi.fn();

    renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: false,
        activeCurrencyId: null,
        salvageTarget: null,
        clearTargeting,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(clearTargeting).not.toHaveBeenCalled();
  });

  it("removes listeners on unmount", () => {
    const clearTargeting = vi.fn();

    const { unmount } = renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: true,
        activeCurrencyId: null,
        salvageTarget: null,
        clearTargeting,
      }),
    );

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(clearTargeting).not.toHaveBeenCalled();
  });
});
