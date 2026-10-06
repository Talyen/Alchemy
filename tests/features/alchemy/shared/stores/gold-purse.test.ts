import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { restoreActiveBattle } from "@/features/alchemy/shared/stores/battle-restore";
import { beforeEach, describe, expect, it } from "vitest";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { deductGold, setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { commitResolvedBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { readBattle, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
});

describe("profile gold write port", () => {
  it("deducts gold and clamps at zero", () => {
    setRunProgress({ gold: 10 });
    dispatchGameplayCommand((draft) => acceptCommand(deductGold(draft, 4)), undefined, defaultGameSession);
    expect(readRunProfile(defaultGameSession).gold).toBe(6);
    dispatchGameplayCommand((draft) => acceptCommand(deductGold(draft, 10)), undefined, defaultGameSession);
    expect(readRunProfile(defaultGameSession).gold).toBe(0);
  });
});

it("commits a resolved battle's Gold change without replacing other purse changes in the transaction", () => {
  setRunProgress({ gold: 100 });
  setRunSession({ hasActiveRun: true });
  dispatchGameplayCommand(
    (draft) => acceptCommand(initializeActiveBattle(draft, makeTestBattleState({ gold: 100 }))),
    undefined,
    defaultGameSession,
  );
  const before = readBattle(defaultGameSession).battleState;
  dispatchGameplayCommand(
    (draft) => {
      setGold(draft, 200);
      commitResolvedBattle(draft, before, { ...before, gold: before.gold + 7 });

      return acceptCommand();
    },
    undefined,
    defaultGameSession,
  );
  expect(readRunProfile(defaultGameSession).gold).toBe(207);
  expect(readBattle(defaultGameSession).battleState.gold).toBe(207);
  expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");
});

describe.each(["opening-draw", "enemy-turn"] as const)("legacy %s hydration", (kind) => {
  it.each([
    { purse: 40, saved: 107, expected: 47 },
    { purse: 150, saved: 107, expected: 157 },
    { purse: 40, saved: 100, expected: 40 },
  ])("reconciles saved earnings once against purse $purse", ({ purse, saved, expected }) => {
    setRunProgress({ characterId: "knight", gold: 100 });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => acceptCommand(initializeActiveBattle(draft, makeTestBattleState({ gold: 100 }))),
      undefined,
      defaultGameSession,
    );
    const legacy = snapshotRun("battle", defaultGameSession);
    legacy.activeCombat!.pendingBattleTransition = {
      kind,
      resultState: makeTestBattleState({ gold: saved, turn: 3 }),
      playerTurnSkipped: false,
    };
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, purse)), undefined, defaultGameSession);
    restoreRun(legacy, {}, {}, defaultGameSession);
    expect(readRunProfile(defaultGameSession).gold).toBe(expected);
    expect(readBattle(defaultGameSession).battleState).toMatchObject({ gold: expected, turn: 3 });
    const current = JSON.parse(JSON.stringify(snapshotRun("battle", defaultGameSession)));
    expect(current.activeCombat.pendingBattleTransition).toBeNull();
    restoreRun(current, {}, {}, defaultGameSession);
    expect(readRunProfile(defaultGameSession).gold).toBe(expected);
    dispatchGameplayCommand((draft) => acceptCommand(deductGold(draft, expected + 10)), undefined, defaultGameSession);
    expect(readBattle(defaultGameSession).battleState.gold).toBe(0);
  });
  it("rolls back restored earnings and battle state when hydration fails", () => {
    const before = readGameplayState(defaultGameSession);
    expect(() =>
      dispatchGameplayCommand(
        (draft) => {
          restoreActiveBattle(draft, makeTestBattleState({ gold: 100 }), {
            kind,
            resultState: makeTestBattleState({ gold: 107 }),
            playerTurnSkipped: false,
          });
          throw new Error("abort restore");
        },
        undefined,
        defaultGameSession,
      ),
    ).toThrow("abort restore");
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });
});
