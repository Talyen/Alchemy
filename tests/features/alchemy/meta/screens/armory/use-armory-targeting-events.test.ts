import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { useArmoryTargetingEvents } from "@/features/alchemy/meta/screens/armory/use-armory-targeting-events";

type Options = Parameters<typeof useArmoryTargetingEvents>[0];

const modes = [
  { name: "salvage", salvageMode: true, activeCurrencyId: null },
  { name: "currency", salvageMode: false, activeCurrencyId: "voidstone" },
] as const;

const regions = [
  { name: "workspace", currency: true, salvage: false, context: false },
  { name: "inventory-item", currency: true, salvage: false, context: true },
  { name: "equipment-slot", currency: true, salvage: false, context: true },
  { name: "trinket-slot", currency: true, salvage: false, context: true },
  { name: "trinket-item", currency: true, salvage: false, context: true },
  { name: "crafting-currency", currency: true, salvage: false, context: true },
  { name: "crafting-strip", currency: true, salvage: true, context: false },
  { name: "salvage-toggle", currency: true, salvage: true, context: false },
  { name: "confirmation-dialog", currency: true, salvage: false, context: false },
  { name: "salvageable", currency: false, salvage: true, context: false },
  { name: "outside", currency: false, salvage: false, context: false },
];

function createTarget(region: string, descendant: string) {
  const container = document.createElement("div");
  if (region === "salvageable") container.dataset.salvageable = "true";
  else if (region !== "outside") {
    container.dataset.testid = region === "confirmation-dialog" ? region : `armory-${region}`;
  }
  container.innerHTML = "<span></span><svg><path /></svg>";
  document.body.append(container);
  const target = container.querySelector(descendant);
  if (!target) throw new Error(`Missing ${descendant} target`);
  return target;
}

function dispatchMouse(target: EventTarget, type = "click") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function dispatchCancellations() {
  dispatchMouse(document.body);
  dispatchMouse(document.body, "contextmenu");
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("useArmoryTargetingEvents", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    resetEscapeStackForTests();
  });

  describe.each(modes)("$name targeting", (mode) => {
    it.each(regions)("classifies HTML and SVG descendants in $name", (region) => {
      const clearTargeting = vi.fn();
      renderHook(() => useArmoryTargetingEvents({ ...mode, salvageTarget: null, clearTargeting }));

      for (const descendant of ["span", "svg", "path"]) {
        const target = createTarget(region.name, descendant);
        clearTargeting.mockClear();
        dispatchMouse(target);
        expect(clearTargeting, `${descendant} click`).toHaveBeenCalledTimes(region[mode.name] ? 0 : 1);
        clearTargeting.mockClear();
        const event = dispatchMouse(target, "contextmenu");
        expect(clearTargeting, `${descendant} contextmenu`).toHaveBeenCalledTimes(region.context ? 0 : 1);
        expect(event.defaultPrevented).toBe(region.name === "workspace");
      }
    });

    it("preserves right-click exceptions nested inside the workspace", () => {
      const clearTargeting = vi.fn();
      renderHook(() => useArmoryTargetingEvents({ ...mode, salvageTarget: null, clearTargeting }));
      const target = createTarget("equipment-slot", "path");
      const workspace = document.createElement("div");
      workspace.dataset.testid = "armory-workspace";
      document.body.append(workspace);
      workspace.append(target.closest('[data-testid="armory-equipment-slot"]')!);
      expect(dispatchMouse(target, "contextmenu").defaultPrevented).toBe(false);
      expect(clearTargeting).not.toHaveBeenCalled();
    });

    it("cancels immediately after activation and on Escape, blur, or hidden document", () => {
      const clearTargeting = vi.fn();
      renderHook(() => useArmoryTargetingEvents({ ...mode, salvageTarget: null, clearTargeting }));
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      dispatchCancellations();
      expect(clearTargeting).toHaveBeenCalledTimes(5);
    });

    it("ignores visibility changes while the document is visible", () => {
      const clearTargeting = vi.fn();
      renderHook(() => useArmoryTargetingEvents({ ...mode, salvageTarget: null, clearTargeting }));
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(clearTargeting).not.toHaveBeenCalled();
    });
  });

  it.each(["inactive", "confirmation"])("does not handle cancellation when %s", (state) => {
    const clearTargeting = vi.fn();
    renderHook(() =>
      useArmoryTargetingEvents({
        salvageMode: state === "confirmation",
        activeCurrencyId: null,
        salvageTarget: state === "confirmation" ? { definitionId: "sword", instanceId: "s-1", affixes: [] } : null,
        clearTargeting,
      }),
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    dispatchCancellations();
    expect(clearTargeting).not.toHaveBeenCalled();
  });

  it("uses the latest callback and replaces mode rules without accumulating listeners", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const initialProps: Options = { ...modes[0], salvageTarget: null, clearTargeting: first };
    const { rerender, unmount } = renderHook(useArmoryTargetingEvents, { initialProps });
    rerender({ ...initialProps, clearTargeting: latest });
    dispatchMouse(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    latest.mockClear();

    const target = createTarget("workspace", "path");
    for (let index = 0; index < 2; index++) {
      rerender({ ...initialProps, ...modes[1], clearTargeting: latest });
      dispatchMouse(target);
      expect(latest).not.toHaveBeenCalled();
      rerender({ ...initialProps, clearTargeting: latest });
      dispatchMouse(target);
      expect(latest).toHaveBeenCalledTimes(1);
      latest.mockClear();
    }
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    unmount();
    dispatchCancellations();
    expect(latest).not.toHaveBeenCalled();
  });

  it.each(["inactive", "confirmation"])("tears down and resumes all handlers across %s", (state) => {
    const clearTargeting = vi.fn();
    const initialProps: Options = { ...modes[0], salvageTarget: null, clearTargeting };
    const { rerender } = renderHook(useArmoryTargetingEvents, { initialProps });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    rerender({
      ...initialProps,
      salvageMode: state === "confirmation",
      salvageTarget: state === "confirmation" ? { definitionId: "sword", instanceId: "s-1", affixes: [] } : null,
    });
    dispatchCancellations();
    expect(clearTargeting).not.toHaveBeenCalled();
    rerender(initialProps);
    dispatchCancellations();
    expect(clearTargeting).toHaveBeenCalledTimes(5);
  });
});
