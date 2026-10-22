import { useRef } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHandPointer } from "@/features/alchemy/run-loop/screens/battle-screen/use-hand-pointer";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { BattleCard } from "@/lib/game-data";

const cards: BattleCard[] = [];
const visible: string[] = [];
const click = vi.fn();
function Hand({ hidden = visible }: { hidden?: string[] }) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const pointer = useHandPointer(cards, hidden, buttons);
  return (
    <div {...pointer} data-testid="hand">
      {["a", "b"].map((key) => (
        <div key={key} data-hand-slot={key} data-hand-hidden={hidden.includes(key) || undefined}>
          <button
            ref={(node) => {
              buttons.current[key] = node;
            }}
            onClick={() => click(key)}
          >
            {key}
          </button>
        </div>
      ))}
    </div>
  );
}

const frames = new Map<number, FrameRequestCallback>();
let resize: () => void;
beforeEach(() => {
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  click.mockClear();
  useUiStore.getState().clearCardHover();
});
afterEach(() => {
  cleanup();
  frames.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup() {
  const view = render(<Hand />);
  const hand = view.getByTestId("hand");
  const slots = [...hand.querySelectorAll<HTMLElement>("[data-hand-slot]")];
  let offset = 0;
  const bounds = vi.spyOn(hand, "getBoundingClientRect").mockImplementation(() => new DOMRect(offset, 0, 200, 150));
  for (const [index, slot] of slots.entries()) {
    vi.spyOn(slot, "getBoundingClientRect").mockImplementation(() => new DOMRect(offset + index * 100, 0, 100, 150));
    Object.defineProperties(slot, { offsetWidth: { value: 100 }, offsetHeight: { value: 150 } });
    Object.defineProperties(slot.querySelector("button")!, {
      offsetWidth: { value: 100 },
      offsetHeight: { value: 150 },
    });
  }
  return {
    ...view,
    hand,
    bounds,
    move: (x: number) => fireEvent.mouseMove(hand, { clientX: x, clientY: 50 }),
    shift: () => {
      offset = 100;
    },
  };
}

describe("hand pointer geometry", () => {
  it("shares measurements within a frame and follows moving ancestors on the next frame", () => {
    const view = setup();
    view.move(40);
    expect(useUiStore.getState().hoveredCardId).toBe("hand-a");
    view.move(140);
    expect(useUiStore.getState().hoveredCardId).toBe("hand-b");
    expect(view.bounds).toHaveBeenCalledOnce();
    view.shift();
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(16));
    });
    view.move(140);
    expect(useUiStore.getState().hoveredCardId).toBe("hand-a");
    expect(view.bounds).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(frames.size).toBe(0);
  });

  it.each(["scroll", "resize", "observer"])("invalidates before the next frame on %s", (event) => {
    const view = setup();
    view.move(140);
    view.shift();
    if (event === "observer") act(() => resize());
    else fireEvent(window, new Event(event));
    view.move(140);
    expect(useUiStore.getState().hoveredCardId).toBe("hand-a");
    expect(view.bounds).toHaveBeenCalledTimes(2);
  });

  it("remeasures clicks immediately and excludes newly hidden cards", () => {
    const view = setup();
    view.move(140);
    view.shift();
    fireEvent.click(view.hand, { clientX: 140, clientY: 50, detail: 1 });
    expect(click).toHaveBeenCalledExactlyOnceWith("a");
    view.rerender(<Hand hidden={["a"]} />);
    expect(useUiStore.getState().hoveredCardId).toBeNull();
    fireEvent.click(view.hand, { clientX: 140, clientY: 50, detail: 1 });
    expect(click).toHaveBeenCalledOnce();
    view.move(350);
    expect(useUiStore.getState().hoveredCardId).toBeNull();
  });
});
