import { restoreActiveBattle } from "@/features/alchemy/shared/stores/battle-restore";
import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { addGold, deductGold, setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { commitResolvedBattle, initializeActiveBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { readBattle, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { makeTestBattleState } from "../../../../fixtures/battle";

beforeEach(() => {
  resetRunDomainStore();
});

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

it("commits a resolved battle's Gold change without replacing other purse changes in the transaction", () => {
  setRunProgress({ gold: 100 });
  setRunSession({ hasActiveRun: true });
  dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, makeTestBattleState({ gold: 100 })));
  const before = readBattle().battleState;
  dispatchRunSessionCommand((draft) => {
    setGold(draft, 200);
    commitResolvedBattle(draft, before, { ...before, gold: before.gold + 7 });
  });
  expect(readRunProfile().gold).toBe(207);
  expect(readBattle().battleState.gold).toBe(207);
  expect(readBattle()).not.toHaveProperty("pendingBattleTransition");
});

describe.each(["opening-draw", "enemy-turn"] as const)("legacy %s hydration", (kind) => {
  it.each([
    { purse: 40, saved: 107, expected: 47 },
    { purse: 150, saved: 107, expected: 157 },
    { purse: 40, saved: 100, expected: 40 },
  ])("reconciles saved earnings once against purse $purse", ({ purse, saved, expected }) => {
    setRunProgress({ characterId: "knight", gold: 100 });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, makeTestBattleState({ gold: 100 })));
    const legacy = snapshotRun("battle");
    legacy.activeCombat!.pendingBattleTransition = {
      kind,
      resultState: makeTestBattleState({ gold: saved, turn: 3 }),
      playerTurnSkipped: false,
    };
    dispatchRunSessionCommand((draft) => setGold(draft, purse));
    restoreRun(legacy, {}, {});
    expect(readRunProfile().gold).toBe(expected);
    expect(readBattle().battleState).toMatchObject({ gold: expected, turn: 3 });
    const current = JSON.parse(JSON.stringify(snapshotRun("battle")));
    expect(current.activeCombat.pendingBattleTransition).toBeNull();
    restoreRun(current, {}, {});
    expect(readRunProfile().gold).toBe(expected);
    dispatchRunSessionCommand((draft) => deductGold(draft, expected + 10));
    expect(readBattle().battleState.gold).toBe(0);
  });
  it("rolls back restored earnings and battle state when hydration fails", () => {
    const before = readGameplayState();
    expect(() =>
      dispatchRunSessionCommand((draft) => {
        restoreActiveBattle(draft, makeTestBattleState({ gold: 100 }), {
          kind,
          resultState: makeTestBattleState({ gold: 107 }),
          playerTurnSkipped: false,
        });
        throw new Error("abort restore");
      }),
    ).toThrow("abort restore");
    expect(readGameplayState()).toBe(before);
  });
});
