import "../../../../../helpers/mock-audio";
import "../../../../../helpers/mock-flush-save";
import {
  bindGameplayMutationForTest,
  bindRunMutationForTest,
  setBattleActiveForTest as mutateHasActiveBattle,
  replaceBattleForTest as mutateSyncedBattleState,
  resetRunDomainStore,
  setRunProgress,
} from "../../../../../helpers/run-domain-store-test";
import { subscribeGameplayCommits } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { abandonRun, teardownRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readActiveRunScreen, readBattle, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/commands/run-session-command";
import { setHasActiveRun as mutateHasActiveRun } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { defaultBattleState } from "@/lib/battle";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ROUTE_SCREENS } from "@/lib/routing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
const setSyncedBattleState = bindGameplayMutationForTest(mutateSyncedBattleState);
const setHasActiveBattle = bindRunMutationForTest(mutateHasActiveBattle);
const setHasActiveRun = bindRunMutationForTest(mutateHasActiveRun);

beforeEach(() => {
  resetRunDomainStore();
});

describe("run transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRunDomainStore();
    teardownRun(defaultGameSession);
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, gold: 40, initialized: true });
    setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    setHasActiveRun(true);
  });

  it("teardownRun clears session flags and returns to menu", () => {
    teardownRun(defaultGameSession);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
    expect(readActiveRunScreen(defaultGameSession)).toBe(ROUTE_SCREENS.MENU);
  });

  it("abandonRun preserves the run-end snapshot for the End Run screen", () => {
    setHasActiveRun(true);
    setHasActiveBattle(true);
    setRunProgress({
      runTalentXP: { physical: 10 },
      runMaterialsEarned: { ...emptyInventory(), wood: 5 },
    });

    const ended = abandonRun(defaultGameSession);

    expect(ended).toBe(true);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
    expect(readRunSession(defaultGameSession).runEndTalentXP.physical).toBeGreaterThan(0);
    expect(readRunSession(defaultGameSession).runEndMaterials.wood).toBe(5);
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");

    expect(abandonRun(defaultGameSession)).toBe(false);
  });
});

describe("commit subscriptions", () => {
  it("notifies the session and gameplay commit subscriptions once per command", () => {
    const calls: string[] = [];
    const unsubscribeSession = subscribeRunSessionCommits(() => calls.push("session"), defaultGameSession);
    const unsubscribeGameplay = subscribeGameplayCommits(() => calls.push("gameplay"), defaultGameSession);
    setHasActiveBattle(true);
    unsubscribeSession();
    unsubscribeGameplay();
    expect(calls).toEqual(["session", "gameplay"]);
  });
});
