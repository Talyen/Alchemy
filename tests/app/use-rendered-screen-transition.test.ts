// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRenderedScreenTransition } from "@/app/use-app-navigation";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { PAGE_EXIT_MS } from "@/lib/game-constants";

describe("useRenderedScreenTransition", () => {
  it("exposes a non-menu initial controller screen immediately without an exit catch-up", () => {
    const commitPendingTransition = vi.fn();
    const { result } = renderHook(() => useRenderedScreenTransition(ROUTE_SCREENS.BATTLE, commitPendingTransition));

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.BATTLE);
    expect(result.current.pagePhase).toBe("enter");
    expect(commitPendingTransition).not.toHaveBeenCalled();
  });

  it("still runs the exit/enter lag for mid-session screen changes", () => {
    vi.useFakeTimers();
    const commitPendingTransition = vi.fn();
    const { result, rerender } = renderHook(
      ({ screen }: { screen: Screen }) => useRenderedScreenTransition(screen, commitPendingTransition),
      { initialProps: { screen: ROUTE_SCREENS.MENU as Screen } },
    );

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);

    rerender({ screen: ROUTE_SCREENS.DESTINATION });
    expect(result.current.pagePhase).toBe("exit");
    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);

    act(() => {
      vi.advanceTimersByTime(PAGE_EXIT_MS);
    });

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.DESTINATION);
    expect(result.current.pagePhase).toBe("enter");
    expect(commitPendingTransition).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
