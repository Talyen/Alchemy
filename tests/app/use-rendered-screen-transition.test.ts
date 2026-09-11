import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRenderedScreenTransition } from "@/app/use-app-navigation";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { PAGE_EXIT_MS } from "@/lib/game-constants";
describe("useRenderedScreenTransition", () => {
  it("exposes a non-menu initial controller screen immediately without an exit catch-up", () => {
    const { result } = renderHook(() => useRenderedScreenTransition(ROUTE_SCREENS.BATTLE));

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.BATTLE);
    expect(result.current.pagePhase).toBe("enter");
  });

  it("still runs the exit/enter lag for mid-session screen changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ screen }: { screen: Screen }) => useRenderedScreenTransition(screen), {
      initialProps: { screen: ROUTE_SCREENS.MENU as Screen },
    });

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);

    rerender({ screen: ROUTE_SCREENS.DESTINATION });
    expect(result.current.pagePhase).toBe("exit");
    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);

    act(() => {
      vi.advanceTimersByTime(resolveGameDelay(PAGE_EXIT_MS));
    });

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.DESTINATION);
    expect(result.current.pagePhase).toBe("enter");

    vi.useRealTimers();
  });

  it("cancels exit when the controller screen reverts before PAGE_EXIT_MS", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ screen }: { screen: Screen }) => useRenderedScreenTransition(screen), {
      initialProps: { screen: ROUTE_SCREENS.MENU as Screen },
    });

    rerender({ screen: ROUTE_SCREENS.DESTINATION });
    expect(result.current.pagePhase).toBe("exit");
    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);

    rerender({ screen: ROUTE_SCREENS.MENU });
    expect(result.current.pagePhase).toBe("enter");
    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);

    act(() => {
      vi.advanceTimersByTime(resolveGameDelay(PAGE_EXIT_MS));
    });

    expect(result.current.renderedScreen).toBe(ROUTE_SCREENS.MENU);
    expect(result.current.pagePhase).toBe("enter");

    vi.useRealTimers();
  });
});
