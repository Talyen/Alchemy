// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { usePlasmaBaseline, usePlasmaInteraction } from "@/features/alchemy/shared/ui/use-plasma-source";

const red = { primary: "#ff0000", secondary: "#440000" };
const blue = { primary: "#0000ff", secondary: "#000044" };

describe("plasma source hooks", () => {
  beforeEach(() => useUiStore.setState(useUiStore.getInitialState(), true));

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
});
