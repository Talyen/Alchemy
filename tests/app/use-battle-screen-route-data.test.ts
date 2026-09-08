import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useBattleScreenRouteData } from "@/app/screen-routes/use-battle-screen-route-data";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { resetRunDomainStore } from "../helpers/run-domain-store-test";
import { makeTestBattleState } from "../fixtures/battle";

describe("useBattleScreenRouteData", () => {
  beforeEach(() => {
    resetRunDomainStore();
  });

  it("returns default battle screen data when no battle is active", () => {
    const { result } = renderHook(() => useBattleScreenRouteData());

    expect(result.current.hasActiveBattle).toBe(false);
    expect(result.current.battleScreenData.activeLabyrinthModifiers).toEqual([]);
    expect(result.current.battleScreenData.runBoons).toEqual([]);
    expect(result.current.battleScreenData.displayOverrides).toEqual({});
    expect(result.current.battleScreenData.battleState).toBeDefined();
  });

  it("reflects active battle state, boons, and labyrinth modifiers", () => {
    const battleState = makeTestBattleState();
    useGameplayStateStore.setState((prev) => ({
      ...prev,
      battle: {
        ...prev.battle,
        hasActiveBattle: true,
        battleState,
      },
      session: {
        ...prev.session,
        activeLabyrinthModifiers: ["tempered"],
      },
      run: {
        ...prev.run,
        activeRun: {
          ...prev.run.activeRun,
          runBoons: ["test-boon"],
        },
      },
    }));

    const { result } = renderHook(() => useBattleScreenRouteData());

    expect(result.current.hasActiveBattle).toBe(true);
    expect(result.current.battleScreenData.battleState).toBe(battleState);
    expect(result.current.battleScreenData.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.current.battleScreenData.runBoons).toEqual(["test-boon"]);
  });
});
