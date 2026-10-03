import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FoundResourcesRow } from "@/features/alchemy/shared/ui/found-resources-row";
import { MATERIAL_IDS } from "@/lib/homestead/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Protect the shared visual contract at its measurement seam rather than repeating screen markup tests.
it.each(["md", "lg"] as const)(
  "balances %s rewards using natural widths and responds to resize and Game Size",
  (size) => {
    const pillWidth = size === "lg" ? 160 : 136;
    let availableWidth = pillWidth * 7 + 12 * 6;
    let scale = 1;
    let goldWidth = pillWidth;
    const observers = new Set<() => void>();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {
          observers.add(callback);
        }
        observe() {}
        disconnect() {
          observers.delete(this.callback);
          disconnect();
        }
      },
    );
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => availableWidth);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element) =>
        ({
          width: `${(element.getAttribute("data-reward-resource") === "gold" ? goldWidth : pillWidth) * scale}px`,
          columnGap: `${12 * scale}px`,
        }) as CSSStyleDeclaration,
    );
    const resize = () =>
      act(() => {
        for (const callback of observers) callback();
        const pending = Array.from(frames.values());
        frames.clear();
        for (const callback of pending) callback(0);
      });
    const materials = Object.fromEntries(MATERIAL_IDS.map((id) => [id, 1]));
    const { container, rerender, unmount } = render(
      <FoundResourcesRow gold={123456789} materials={materials} size={size} />,
    );
    const pills = () => Array.from(container.querySelectorAll<HTMLElement>("[data-reward-resource]"));
    const rowCounts = () => Array.from(container.firstElementChild?.children ?? []).map((row) => row.children.length);
    const order = ["gold", ...MATERIAL_IDS];
    const content = pills().map((pill) => pill.textContent);
    expect(rowCounts()).toEqual([4, 4]);

    availableWidth = pillWidth * 3 + 24;
    resize();
    expect(rowCounts()).toEqual([3, 3, 2]);
    scale = 1.2;
    resize();
    expect(rowCounts()).toEqual([2, 2, 2, 2]);
    availableWidth = 2000;
    resize();
    expect(rowCounts()).toEqual([8]);
    expect(pills().map((pill) => pill.dataset.rewardResource)).toEqual(order);
    expect(pills().map((pill) => pill.textContent)).toEqual(content);

    scale = 1;
    availableWidth = pillWidth * 6 + 60;
    rerender(<FoundResourcesRow gold={123456789} materials={{ ...materials, gems: 0 }} size={size} />);
    expect(rowCounts()).toEqual([4, 3]);
    // A wider Gold amount can require placing the shorter row first while retaining resource order.
    goldWidth = pillWidth + 100;
    availableWidth = pillWidth * 4 + 36;
    resize();
    expect(rowCounts()).toEqual([3, 4]);
    expect(pills().map((pill) => pill.dataset.rewardResource)).toEqual(order.slice(0, 7));

    rerender(<FoundResourcesRow gold={42} size={size} />);
    expect(rowCounts()).toEqual([1]);
    expect(pills()[0]?.textContent).toContain("+42");
    rerender(<FoundResourcesRow size={size} />);
    expect(container.childElementCount).toBe(0);
    expect(observers.size).toBe(0);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(frames.size).toBe(0);
  },
);
