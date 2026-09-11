import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addGold,
  commitBattleTransition,
  deductGold,
  initializeActiveBattle,
  setGold,
  setScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  hydrateModeRunInDraft,
  parkAndDeactivateForegroundRunInDraft,
} from "@/features/alchemy/shared/stores/run-park-restore";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { makeTestBattleState } from "../../../../fixtures/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";

beforeEach(() => {
  resetRunDomainStore();
});

describe.each(["opening-draw", "enemy-turn"] as const)("pending %s gold", (kind) => {
  function startBattle(resultGold = 107): void {
    setRunProgress({ characterId: "knight", contentSystemType: "campaign", gold: 100 });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => {
      initializeActiveBattle(draft, makeTestBattleState({ gold: 100, turn: 2 }), {
        kind,
        resultState: makeTestBattleState({ gold: resultGold, turn: 3 }),
        playerTurnSkipped: false,
      });
      setScreen(draft, "battle");
    });
  }

  function finishTransition(): void {
    dispatchRunSessionCommand((draft) => {
      const pending = draft.battle.pendingBattleTransition;
      if (pending && "resultState" in pending) commitBattleTransition(draft, pending.resultState, null);
    });
  }

  it.each([
    { purse: 40, resultGold: 107, expected: 47 },
    { purse: 150, resultGold: 107, expected: 157 },
    { purse: 40, resultGold: 100, expected: 40 },
  ])("preserves parked earnings with purse $purse and saved result $resultGold", ({ purse, resultGold, expected }) => {
    startBattle(resultGold);
    dispatchRunSessionCommand(parkAndDeactivateForegroundRunInDraft);
    dispatchRunSessionCommand((draft) => setGold(draft, purse));
    dispatchRunSessionCommand((draft) => {
      expect(hydrateModeRunInDraft(draft, "campaign")).toBe(true);
    });

    expect(readRunProfile().gold).toBe(purse);
    expect(readBattle().battleState.gold).toBe(purse);
    expect(readBattle().pendingBattleTransition).toMatchObject({ kind, resultState: { gold: expected, turn: 3 } });
    expect(readBattle().pendingTransitionResumeRequired).toBe(true);

    finishTransition();
    expect(readRunProfile().gold).toBe(expected);
    expect(readBattle().battleState).toMatchObject({ gold: expected, turn: 3 });
    expect(readBattle().pendingBattleTransition).toBeNull();
    expect(readBattle().pendingTransitionResumeRequired).toBe(false);
    finishTransition();
    expect(readRunProfile().gold).toBe(expected);
  });

  it("keeps pending earnings through repeated live purse writes and clamps spending at zero", () => {
    startBattle();
    const rng = readGameplayState().run.activeRun.rng;
    dispatchRunSessionCommand((draft) => setGold(draft, 40));
    dispatchRunSessionCommand((draft) => deductGold(draft, 100));
    expect(readRunProfile().gold).toBe(0);
    expect(readBattle().battleState.gold).toBe(0);
    expect(readBattle().pendingBattleTransition).toMatchObject({ resultState: { gold: 7 } });

    dispatchRunSessionCommand((draft) => setGold(draft, 150));
    finishTransition();
    expect(readRunProfile().gold).toBe(157);
    expect(readGameplayState().run.activeRun.rng).toEqual(rng);
    expect(readBattle().battleState).not.toHaveProperty("rng");
  });

  it("retains unapplied earnings across repeated serialized save and restore", () => {
    startBattle();
    const saved = JSON.parse(JSON.stringify(snapshotRun("battle")));
    dispatchRunSessionCommand((draft) => setGold(draft, 40));
    restoreRun(saved, {}, {});
    const restoredSave = JSON.parse(JSON.stringify(snapshotRun("battle")));
    restoreRun(restoredSave, {}, {});

    expect(readRunProfile().gold).toBe(40);
    expect(readBattle().pendingBattleTransition).toMatchObject({ resultState: { gold: 47 } });
    finishTransition();
    expect(readRunProfile().gold).toBe(47);
  });

  it("rolls back the purse and both battle snapshots together", () => {
    startBattle();
    const before = readGameplayState();
    expect(() =>
      dispatchRunSessionCommand((draft) => {
        setGold(draft, 40);
        throw new Error("cancel purchase");
      }),
    ).toThrow("cancel purchase");
    expect(readGameplayState()).toBe(before);
    expect(readRunProfile().gold).toBe(100);
    expect(readBattle().battleState.gold).toBe(100);
    expect(readBattle().pendingBattleTransition).toMatchObject({ resultState: { gold: 107 } });
  });
});

it.each<PersistedBattleTransition | null>([null, { kind: "continue-end-turn" }, { kind: "legacy-enemy-turn" }])(
  "syncs the purse without a pending result (%j)",
  (pending) => {
    dispatchRunSessionCommand((draft) => {
      setGold(draft, 40);
      initializeActiveBattle(draft, makeTestBattleState({ gold: 100 }), pending);
    });
    expect(readBattle().battleState.gold).toBe(40);
    dispatchRunSessionCommand((draft) => setGold(draft, 150));
    expect(readBattle().battleState.gold).toBe(150);
    expect(readBattle().pendingBattleTransition).toEqual(pending);
  },
);

describe("profile gold write port", () => {
  it("writes spend and earn through profile gold", () => {
    dispatchRunSessionCommand((draft) => setGold(draft, 40));
    dispatchRunSessionCommand((draft) => addGold(draft, 5));
    expect(readRunProfile().gold).toBe(45);
  });

  it("adds earned gold onto the purse", () => {
    setRunProgress({ gold: 10 });
    dispatchRunSessionCommand((draft) => addGold(draft, 5));
    expect(readRunProfile().gold).toBe(15);
  });

  it("deducts gold and clamps at zero", () => {
    setRunProgress({ gold: 10 });
    dispatchRunSessionCommand((draft) => deductGold(draft, 4));
    expect(readRunProfile().gold).toBe(6);
    dispatchRunSessionCommand((draft) => deductGold(draft, 10));
    expect(readRunProfile().gold).toBe(0);
  });
});
