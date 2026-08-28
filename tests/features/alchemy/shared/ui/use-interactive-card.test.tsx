import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useInteractiveCard } from "@/features/alchemy/shared/ui/use-interactive-card";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

describe("useInteractiveCard", () => {
  beforeEach(() => {
    useUiStore.setState({ hoveredCardId: null, shimmerState: null });
  });

  it("does not rerender for another card's hover state", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useInteractiveCard("hand", "slash-1");
    });
    const initialRenders = renders;

    act(() => useUiStore.getState().setHoveredCardId("hand-other-card"));
    expect(renders).toBe(initialRenders);

    act(() => result.current.onHoverStart());
    expect(result.current.isHovered).toBe(true);
    expect(renders).toBeGreaterThan(initialRenders);
  });
});
