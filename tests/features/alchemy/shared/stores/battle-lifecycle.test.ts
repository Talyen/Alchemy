import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, expect, it, vi } from "vitest";
import { commitBattleWish, commitCardPlay, commitEndTurn } from "@/features/alchemy/shared/stores/battle-commands";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { abandonRun, restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { finalizeRunXP, setHasActiveRun, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createVictoryCommand } from "@/features/alchemy/run-loop/run/victory-commands";
import { awardRunEndMaterials } from "@/features/alchemy/run-loop/run/run-materials";
import { cardById, getStartingDeck } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";
import { parseActiveRun } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { regressionBattle } from "../../../../fixtures/battle";
import { initializeBattleForTest, resetAllTestStores } from "../../../../helpers/run-domain-store-test";

beforeEach(resetAllTestStores);

it("rejects every battle command after End Run without changing progress, RNG, or revision", () => {
  const slash = { ...cardById.slash!, uid: 1 };
  dispatchRunSessionCommand((transaction) => {
    initializeBattleForTest(transaction, regressionBattle({ hand: [slash], mana: 10, wishOptions: [slash] }));
    return acceptCommand();
  });
  expect(abandonRun({ awardRunEndMaterials, finalizeRunXP })).toBe(true);
  const before = readGameplayState();
  const commit = vi.fn();
  const unsubscribe = subscribeRunSessionCommits(commit);
  const started = vi.fn();
  const start = createBattleStartCommands(started);
  try {
    expect(commitCardPlay(0, slash.id)).toBeNull();
    expect(commitBattleWish(slash.id)).toBeNull();
    expect(commitEndTurn()).toBeNull();
    expect(start.startBattle({ enemyId: "goblin" })).toBeNull();
    expect(start.startBossById({ bossId: "forge-golem" })).toBe(false);
    expect(readGameplayState()).toBe(before);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(snapshotRun().activeCombat).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    expect(started).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

it("starts combat only once and preserves its activity while visiting the Menu", () => {
  dispatchRunSessionCommand((transaction) => {
    setHasActiveRun(transaction, true);
    setRunDeck(transaction, getStartingDeck("knight"));
    return acceptCommand();
  });
  const started = vi.fn();
  const start = createBattleStartCommands(started);
  expect(start.startBattle({ enemyId: "goblin" })).not.toBeNull();
  const before = readGameplayState();
  expect(start.startBattle({ enemyId: "goblin" })).toBeNull();
  expect(readGameplayState()).toBe(before);
  expect(started).toHaveBeenCalledOnce();
  expect(snapshotRun("menu")).toMatchObject({
    currentScreen: "battle",
    activeCombat: { battleState: readBattle().battleState },
  });
});

it("resumes an unsettled victory and commits its rewards exactly once before presentation navigation", () => {
  dispatchRunSessionCommand((transaction) => {
    initializeBattleForTest(
      transaction,
      regressionBattle({ enemyHealth: 0, pendingMaterials: { ...emptyInventory(), gems: 2 } }),
    );
    return acceptCommand();
  });
  const saved = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun("battle"))))!;
  expect(saved.activeCombat?.battleState.enemyHealth).toBe(0);
  restoreRun(saved, {}, {});
  const settle = createVictoryCommand(() => [DESTINATIONS.CAMPFIRE]);
  const before = readGameplayState();
  expect(settle()).not.toBeNull();
  const committed = readGameplayState();
  expect(committed.revision).toBe(before.revision + 1);
  expect(committed.runProfile.materialInventory.gems).toBe(before.runProfile.materialInventory.gems + 2);
  expect(readRunSession().activity.kind).toBe("rewards");
  expect(readBattle().hasActiveBattle).toBe(false);
  expect(snapshotRun("battle")).toMatchObject({ currentScreen: "rewards", activeCombat: null });
  expect(settle()).toBeNull();
  expect(readGameplayState()).toBe(committed);

  const rewardSave = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun("battle"))))!;
  restoreRun(rewardSave, {}, {});
  const resumed = readGameplayState();
  expect(settle()).toBeNull();
  expect(readGameplayState()).toBe(resumed);
  expect(readRunSession().rewardFlow.state).toEqual(committed.session.rewardFlow.state);
});
