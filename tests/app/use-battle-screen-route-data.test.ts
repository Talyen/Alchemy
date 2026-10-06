import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useBattleScreenRouteData } from "@/app/screen-routes/use-battle-screen-route-data";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { resetRunDomainStore } from "../helpers/run-domain-store-test";
import { makeTestBattleState } from "../fixtures/battle";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

describe("useBattleScreenRouteData", () => {
  beforeEach(() => {
    resetRunDomainStore();
    useBattlePresentationStore.getState().resetPresentation();
  });

  it("retains the final battle display through settlement, presentation reset, and the outgoing fade", () => {
    const battleState = makeTestBattleState();
    useGameplayStateStore.setState((prev) => ({
      ...prev,
      session: {
        ...prev.session,
        activity: { kind: "battle", data: { battleState, battleStartState: null } },
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

    const finalFrame = { ...battleState, enemyHealth: 0 };
    act(() => {
      useBattlePresentationStore.getState().setDisplayedBattle(finalFrame);
      useGameplayStateStore.setState((state) => ({
        ...state,
        session: { ...state.session, activity: { kind: "rewards" }, activeLabyrinthModifiers: [] },
        run: { ...state.run, activeRun: { ...state.run.activeRun, runBoons: [] } },
      }));
    });
    expect(result.current.hasActiveBattle).toBe(false);
    expect(result.current.battleScreenData.battleState).toBe(finalFrame);
    expect(result.current.battleScreenData.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.current.battleScreenData.runBoons).toEqual(["test-boon"]);
    act(() => useBattlePresentationStore.getState().resetPresentation());
    expect(result.current.battleScreenData.battleState).toBe(finalFrame);
    expect(result.current.battleScreenData.battleState.currentEnemy).toBe(battleState.currentEnemy);
    act(() =>
      useGameplayStateStore.setState((state) => ({
        ...state,
        session: { ...state.session, activity: { kind: "inactive" } },
        run: { ...state.run, navigation: { screen: "game-over" } },
      })),
    );
    expect(result.current.battleScreenData.battleState).toBe(finalFrame);
  });
});
