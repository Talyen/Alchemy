import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  hydrateModeRunInDraft,
  parkAndDeactivateForegroundRunInDraft,
} from "@/features/alchemy/shared/stores/run-park-restore";
import { initializeActiveBattle, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  readActiveRun,
  readBattle,
  readHasActiveRun,
  readParkedRuns,
} from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

import { makeTestBattleState } from "../../../../fixtures/battle";

beforeEach(() => {
  resetRunDomainStore();
});

describe("park and restore", () => {
  it.each(["opening-draw", "enemy-turn"] as const)(
    "reads and restores parked %s combat without sharing mutable data",
    (kind) => {
      setRunProgress({ characterId: "knight", contentSystemType: "campaign" });
      setRunSession({ hasActiveRun: true });
      dispatchRunSessionCommand((draft) => {
        initializeActiveBattle(draft, makeTestBattleState({ turn: 2 }), {
          kind,
          resultState: makeTestBattleState({ turn: 3 }),
          playerTurnSkipped: false,
        });
        setScreen(draft, "battle");
      });
      dispatchRunSessionCommand(parkAndDeactivateForegroundRunInDraft);
      const snapshot = readParkedRuns().campaign;
      expect(snapshot?.activeCombat?.battleState.rng).toEqual(expect.any(Function));
      const pending = snapshot?.activeCombat?.pendingBattleTransition;
      expect(pending && "resultState" in pending && pending.resultState.rng).toEqual(expect.any(Function));
      if (!snapshot?.activeCombat || !pending || !("resultState" in pending)) throw new Error("Missing parked combat");
      snapshot.activeCombat.battleState.turn = 99;
      pending.resultState.turn = 99;
      dispatchRunSessionCommand((draft) => {
        hydrateModeRunInDraft(draft, "campaign");
      });
      expect(readBattle().battleState.turn).toBe(2);
      expect(readBattle().pendingBattleTransition).toMatchObject({ kind, resultState: { turn: 3 } });
      expect(readBattle().pendingTransitionResumeRequired).toBe(true);
    },
  );

  it("parks the live run then restores it by mode", () => {
    setRunProgress({ characterId: "knight", contentSystemType: "campaign", runPlayerHealth: 18 });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => setScreen(draft, "destination"));

    dispatchRunSessionCommand((draft) => {
      parkAndDeactivateForegroundRunInDraft(draft);
    });
    expect(readHasActiveRun()).toBe(false);
    expect(readParkedRuns().campaign?.runPlayerHealth).toBe(18);

    dispatchRunSessionCommand((draft) => {
      expect(hydrateModeRunInDraft(draft, "campaign")).toBe(true);
    });
    expect(readHasActiveRun()).toBe(true);
    expect(readActiveRun().runPlayerHealth).toBe(18);
    expect(readParkedRuns().campaign).toBeUndefined();
  });
});
