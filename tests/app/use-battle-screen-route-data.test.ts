import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useBattleScreenRouteData } from "@/app/screen-routes/use-battle-screen-route-data";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { defaultGameSession } from "@/app/application-session";
import { resetRunDomainStore } from "../helpers/run-domain-store-test";
import { makeTestBattleState } from "../fixtures/battle";
import { battlePresentation } from "@/app/battle-presentation";

describe("useBattleScreenRouteData", () => {
  beforeEach(() => {
    resetRunDomainStore();
    battlePresentation.getState().resetPresentation();
  });

  it("retains the final battle display through settlement, presentation reset, and the outgoing fade", () => {
    const battleState = makeTestBattleState();
    dispatchGameplayCommand(
      (draft) => {
        draft.session.activity = { kind: "battle", data: { battleState } };
        draft.session.activeLabyrinthModifiers = ["tempered"];
        draft.run.activeRun.runBoons = ["test-boon"];
        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    const { result } = renderHook(() => useBattleScreenRouteData(battlePresentation));

    expect(result.current.hasActiveBattle).toBe(true);
    expect(result.current.battleScreenData.battleState).toBe(battleState);
    expect(result.current.battleScreenData.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.current.battleScreenData.runBoons).toEqual(["test-boon"]);

    const finalFrame = { ...battleState, enemyHealth: 0 };
    act(() => {
      battlePresentation.getState().setDisplayedBattle(finalFrame);
      dispatchGameplayCommand(
        (draft) => {
          draft.session.activity = { kind: "rewards" };
          draft.session.activeLabyrinthModifiers = [];
          draft.run.activeRun.runBoons = [];
          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );
    });
    expect(result.current.hasActiveBattle).toBe(false);
    expect(result.current.battleScreenData.battleState).toBe(finalFrame);
    expect(result.current.battleScreenData.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.current.battleScreenData.runBoons).toEqual(["test-boon"]);
    act(() => battlePresentation.getState().resetPresentation());
    expect(result.current.battleScreenData.battleState).toBe(finalFrame);
    expect(result.current.battleScreenData.battleState.currentEnemy).toBe(battleState.currentEnemy);
    act(() =>
      dispatchGameplayCommand(
        (draft) => {
          draft.session.activity = { kind: "inactive" };
          draft.run.navigation.screen = "game-over";
          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      ),
    );
    expect(result.current.battleScreenData.battleState).toBe(finalFrame);
  });
});
