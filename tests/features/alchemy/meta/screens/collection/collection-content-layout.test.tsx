import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionContentLayout } from "@/features/alchemy/meta/screens/collection/collection-content-layout";
import { FadeSlot } from "@/features/alchemy/shared/ui/use-fade";
import { MOTION_FADE_MS } from "@/lib/game-constants";

const observers: { notify: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];

beforeEach(() => {
  localStorage.removeItem("alchemy-disable-animations");
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      constructor(notify: () => void) {
        observers.push({ notify, disconnect: this.disconnect });
      }
      observe() {}
    },
  );
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = computedStyle(element);
    const measured = element.querySelector<HTMLElement>("[data-height]");
    return new Proxy(style, {
      get(target, property) {
        if (property === "height" && measured) return `${measured.dataset.height}px`;
        if (property === "rowGap") return "16px";
        return Reflect.get(target, property);
      },
    });
  });
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("alchemy-disable-animations");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function view(height: number, withPagination = true) {
  return (
    <CollectionContentLayout pagination={withPagination ? <button data-height="40">Next page</button> : null}>
      <div data-height={height} data-testid="grid">
        Cards
      </div>
    </CollectionContentLayout>
  );
}

function layout(): HTMLElement {
  return screen.getByTestId("grid").parentElement!.parentElement!.parentElement!;
}

it("measures natural grid height and pagination, retargets changes, and releases its observer", () => {
  const { rerender, unmount } = render(view(400.5));
  const wrapper = layout();
  expect(wrapper.style.height).toBe("456.5px");
  expect(wrapper.style.transition).toBe("height 200ms ease-out");
  expect(wrapper.className).toContain("overflow-visible");
  expect(screen.getByTestId("grid").style.transform).toBe("");

  rerender(view(600));
  act(() => observers.at(-1)!.notify());
  expect(wrapper.style.height).toBe("656px");
  // A second destination replaces the target without a timer or completion lock.
  rerender(view(300));
  act(() => observers.at(-1)!.notify());
  expect(wrapper.style.height).toBe("356px");

  rerender(view(300, false));
  expect(wrapper.style.height).toBe("300px");
  expect(screen.queryByRole("button")).toBeNull();
  rerender(view(300));
  expect(wrapper.style.height).toBe("356px");
  unmount();
  expect(observers.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true);
  act(() => observers.forEach((observer) => observer.notify()));
});

it("holds outgoing height until FadeSlot actually replaces the grid", () => {
  vi.useFakeTimers();
  const fadingView = (tab: string, height: number) => (
    <CollectionContentLayout pagination={null}>
      <FadeSlot swapKey={tab}>
        <div data-height={height} data-testid="grid">
          {tab}
        </div>
      </FadeSlot>
    </CollectionContentLayout>
  );
  const { container, rerender } = render(fadingView("Cards", 600));
  const wrapper = container.firstElementChild as HTMLElement;
  expect(wrapper.style.height).toBe("600px");
  rerender(fadingView("Bestiary", 400));
  act(() => observers.at(-1)!.notify());
  expect(screen.getByTestId("grid").textContent).toBe("Cards");
  expect(wrapper.style.height).toBe("600px");
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
  act(() => observers.at(-1)!.notify());
  expect(screen.getByTestId("grid").textContent).toBe("Bestiary");
  expect(wrapper.style.height).toBe("400px");
});

it("settles immediately when animations are disabled and updates the live preference", () => {
  localStorage.setItem("alchemy-disable-animations", "true");
  const { rerender } = render(view(400));
  expect(layout().style.transition).toBe("none");
  rerender(view(600));
  act(() => observers.at(-1)!.notify());
  expect(layout().style.height).toBe("656px");
  localStorage.removeItem("alchemy-disable-animations");
  act(() => window.dispatchEvent(new Event("storage")));
  expect(layout().style.transition).toBe("height 200ms ease-out");
});
