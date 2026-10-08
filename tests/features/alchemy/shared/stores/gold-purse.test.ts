import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";

import { beforeEach, describe, expect, it } from "vitest";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { deductGold, setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { commitResolvedBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { readBattle, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";

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
