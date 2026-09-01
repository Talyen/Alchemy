import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLabyrinthEntryGuard } from "@/features/alchemy/shell/use-labyrinth-entry-guard";

describe("useLabyrinthEntryGuard", () => {
  it("resets a stale map when replacing an active non-labyrinth run", () => {
    const resetMap = vi.fn();
    const beginLabyrinth = vi.fn();
    const { result } = renderHook(() =>
      useLabyrinthEntryGuard({
        contentSystemType: "campaign",
        activeRunData: true,
        hasActiveBattle: false,
        resetMap,
        beginLabyrinth,
      }),
    );

    act(() => result.current());

    expect(resetMap).toHaveBeenCalledOnce();
    expect(beginLabyrinth).toHaveBeenCalledOnce();
  });

  it("does not begin a labyrinth without an active run or battle", () => {
    const resetMap = vi.fn();
    const beginLabyrinth = vi.fn();
    const { result } = renderHook(() =>
      useLabyrinthEntryGuard({
        contentSystemType: "labyrinth",
        activeRunData: false,
        hasActiveBattle: false,
        resetMap,
        beginLabyrinth,
      }),
    );

    act(() => result.current());

    expect(resetMap).not.toHaveBeenCalled();
    expect(beginLabyrinth).not.toHaveBeenCalled();
  });

  it("preserves an active labyrinth map", () => {
    const resetMap = vi.fn();
    const beginLabyrinth = vi.fn();
    const { result } = renderHook(() =>
      useLabyrinthEntryGuard({
        contentSystemType: "labyrinth",
        activeRunData: true,
        hasActiveBattle: false,
        resetMap,
        beginLabyrinth,
      }),
    );

    act(() => result.current());

    expect(resetMap).not.toHaveBeenCalled();
    expect(beginLabyrinth).toHaveBeenCalledOnce();
  });
});
