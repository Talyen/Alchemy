import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { InteractionPlasmaBackground } from "@/features/alchemy/shared/ui/interaction-plasma-background";

const tracking = vi.hoisted(() => ({ update: null as (() => void) | null, stop: vi.fn() }));
vi.mock("@floating-ui/dom", () => ({
  autoUpdate: (_anchor: Element, _stage: Element, update: () => void) => {
    tracking.update = update;
    update();
    return tracking.stop;
  },
}));
vi.mock("@/features/alchemy/shared/ui/keyword-plasma-background", () => ({
  KeywordPlasmaBackground: ({ colorPair, active }: { colorPair: unknown; active: boolean }) => (
    <div data-testid="plasma-renderer" data-colors={JSON.stringify(colorPair)} data-active={active} />
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

const red = { primary: "#ff0000", secondary: "#440000" };
const blue = { primary: "#0000ff", secondary: "#000044" };

it("anchors to the registered control through stage scaling, tooltip entry, and interrupted exit", () => {
  vi.useFakeTimers();
  function Scene({ colors }: { colors: typeof red | null }) {
    return (
      <div data-testid="stage">
        <InteractionPlasmaBackground colorPair={colors} intensity={100} />
        <button>First</button>
        <button>Second</button>
        <div role="tooltip">
          <button>Tooltip action</button>
        </div>
      </div>
    );
  }
  const view = render(<Scene colors={null} />);
  const stage = screen.getByTestId("stage");
  Object.defineProperties(stage, { clientWidth: { value: 1000 }, clientHeight: { value: 800 } });
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 500, height: 400 } as DOMRect);
  const first = screen.getByRole("button", { name: "First" });
  const firstBounds = vi
    .spyOn(first, "getBoundingClientRect")
    .mockReturnValue({ left: 200, top: 150, width: 100, height: 40 } as DOMRect);
  fireEvent.mouseOver(first);
  view.rerender(<Scene colors={red} />);
  const halo = screen.getByTestId("interaction-plasma-background");
  expect(halo.style.width).toBe("328px");
  expect(halo.style.height).toBe("208px");
  expect(halo.style.left).toBe("136px");
  expect(halo.style.top).toBe("136px");
  expect(halo.style.opacity).toBe("1");

  // A tall opaque card must retain an exterior halo on all sides. The old
  // height cap squeezed its brightest region entirely beneath the artwork.
  firstBounds.mockReturnValue({ left: 200, top: 100, width: 150, height: 210 } as DOMRect);
  act(() => tracking.update?.());
  expect(halo.style.width).toBe("428px");
  expect(halo.style.height).toBe("548px");
  expect(halo.style.left).toBe("136px");
  expect(halo.style.top).toBe("36px");
  firstBounds.mockReturnValue({ left: 200, top: 150, width: 100, height: 40 } as DOMRect);
  act(() => tracking.update?.());

  fireEvent.mouseOver(screen.getByRole("button", { name: "Tooltip action" }));
  view.rerender(<Scene colors={blue} />);
  expect(halo.style.left).toBe("136px");
  // An unrelated hover cannot steal a still-registered keyboard-focus palette.
  fireEvent.mouseOver(screen.getByRole("button", { name: "Second" }));
  expect(halo.style.left).toBe("136px");

  view.rerender(<Scene colors={null} />);
  expect(halo.style.opacity).toBe("0");
  expect(halo.style.left).toBe("136px");
  expect(screen.getByTestId("plasma-renderer").dataset.colors).toBe(JSON.stringify(blue));
  expect(screen.getByTestId("plasma-renderer").dataset.active).toBe("true");
  act(() => vi.advanceTimersByTime(350));
  fireEvent.focusIn(first);
  view.rerender(<Scene colors={red} />);
  act(() => vi.advanceTimersByTime(350));
  expect(screen.getByTestId("plasma-renderer").dataset.active).toBe("true");
  view.rerender(<Scene colors={null} />);
  act(() => vi.advanceTimersByTime(700));
  expect(screen.getByTestId("plasma-renderer").dataset.active).toBe("false");
  expect(tracking.stop).toHaveBeenCalled();
});

it("keeps the halo hidden when decorative motion is disabled", () => {
  localStorage.setItem("alchemy-disable-animations", "true");
  const view = render(<InteractionPlasmaBackground colorPair={red} intensity={100} />);
  expect(screen.getByTestId("interaction-plasma-background").style.opacity).toBe("0");
  expect(screen.getByTestId("plasma-renderer").dataset.active).toBe("false");
  view.rerender(<InteractionPlasmaBackground colorPair={blue} intensity={100} />);
  expect(screen.getByTestId("plasma-renderer").dataset.active).toBe("false");
});
