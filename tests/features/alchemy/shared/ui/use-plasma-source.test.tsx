import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import {
  usePlasmaBaseline,
  usePlasmaInteraction,
  usePlasmaDisplayColorPair,
} from "@/features/alchemy/shared/ui/use-plasma-source";

const red = { primary: "#ff0000", secondary: "#440000" };
const blue = { primary: "#0000ff", secondary: "#000044" };

describe("plasma source hooks", () => {
  beforeEach(() => useUiStore.setState(useUiStore.getInitialState(), true));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("registers, replaces, and cleans up an interaction source", () => {
    const { rerender, unmount } = renderHook(({ active, colorPair }) => usePlasmaInteraction(colorPair, active), {
      initialProps: { active: true, colorPair: red },
    });
    expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(red);

    act(() => rerender({ active: true, colorPair: blue }));
    expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(blue);

    unmount();
    expect(useUiStore.getState().plasmaInteraction).toBeNull();
  });

  it("registers a baseline independently", () => {
    const { unmount } = renderHook(() => usePlasmaBaseline(red));
    expect(useUiStore.getState().plasmaBaseline?.colorPair).toEqual(red);
    unmount();
    expect(useUiStore.getState().plasmaBaseline).toBeNull();
  });

  it("does not clear a newer interaction owner when an older owner leaves", () => {
    const first = renderHook(({ active }) => usePlasmaInteraction(red, active), {
      initialProps: { active: true },
    });
    const second = renderHook(({ active }) => usePlasmaInteraction(blue, active), {
      initialProps: { active: true },
    });
    expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(blue);

    act(() => first.rerender({ active: false }));
    expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(blue);

    first.unmount();
    second.unmount();
  });

  it("filters transient hover colors and bridges exit gaps before restoring the latest baseline", () => {
    vi.useFakeTimers();
    useUiStore.setState({ plasmaBaseline: { ownerId: "baseline", colorPair: red } });
    const display = renderHook(() => usePlasmaDisplayColorPair());
    const setHover = (colorPair: typeof blue | null) =>
      act(() =>
        useUiStore.setState({
          plasmaInteraction: colorPair ? { ownerId: "hover", colorPair } : null,
        }),
      );
    setHover(blue);
    act(() => vi.advanceTimersByTime(79));
    expect(display.result.current).toEqual(red);
    setHover(null);
    act(() => vi.advanceTimersByTime(120));
    expect(display.result.current).toEqual(red);
    setHover(blue);
    act(() => vi.advanceTimersByTime(80));
    expect(display.result.current).toEqual(blue);
    setHover(null);
    act(() => vi.advanceTimersByTime(119));
    expect(display.result.current).toEqual(blue);
    setHover(blue);
    act(() => vi.advanceTimersByTime(80));
    expect(display.result.current).toEqual(blue);
    setHover(null);
    act(() => useUiStore.setState({ plasmaBaseline: null }));
    act(() => vi.advanceTimersByTime(120));
    expect(display.result.current).toBeNull();
    display.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
