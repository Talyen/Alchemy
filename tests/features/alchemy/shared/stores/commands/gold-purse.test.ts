import {
  mutateGameplayForTest,
  initializeBattleForTest as initializeActiveBattle,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../../helpers/run-domain-store-test";
import { beforeEach, expect, it } from "vitest";
import { deductGold, setGold } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { commitResolvedBattle } from "@/features/alchemy/shared/stores/commands/write/run-battle";
import { readActiveRun, readBattle, readRunProfile } from "@/features/alchemy/shared/stores/session/run-reads";
import { makeTestBattleState } from "../../../../../fixtures/battle";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
});

it("profile gold write port deducts gold and clamps at zero", () => {
  setRunProgress({ gold: 10 });
  mutateGameplayForTest((draft) => deductGold(draft, 4));
  expect(readRunProfile(defaultGameSession).gold).toBe(6);
  mutateGameplayForTest((draft) => deductGold(draft, 10));
  expect(readRunProfile(defaultGameSession).gold).toBe(0);
});

it.each([
  { purse: 200, expected: 207, earned: 7 },
  { purse: Number.MAX_SAFE_INTEGER - 1, expected: Number.MAX_SAFE_INTEGER, earned: 1 },
])("commits a battle Gold change onto the live purse ($purse)", ({ purse, expected, earned }) => {
  setRunProgress({ gold: 100 });
  setRunSession({ hasActiveRun: true });
  mutateGameplayForTest((draft) => initializeActiveBattle(draft, makeTestBattleState({ gold: 100 })));
  const before = readBattle(defaultGameSession).battleState;
  mutateGameplayForTest((draft) => {
    setGold(draft, purse);
    commitResolvedBattle(draft, before, { ...before, gold: before.gold + 7 });
  });
  expect(readRunProfile(defaultGameSession).gold).toBe(expected);
  expect(readBattle(defaultGameSession).battleState.gold).toBe(expected);
  expect(readActiveRun(defaultGameSession).runGoldEarned).toBe(earned);
  expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");
});
