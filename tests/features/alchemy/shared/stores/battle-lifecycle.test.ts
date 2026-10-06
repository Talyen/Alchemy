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
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetAllTestStores);

it("rejects every battle command after End Run without changing progress, RNG, or revision", () => {
  const slash = { ...cardById.slash!, uid: 1 };
  dispatchRunSessionCommand(
    (transaction) => {
      initializeBattleForTest(transaction, regressionBattle({ hand: [slash], mana: 10, wishOptions: [slash] }));
      return acceptCommand();
    },
    undefined,
    defaultGameSession,
  );
  expect(abandonRun({ awardRunEndMaterials, finalizeRunXP }, defaultGameSession)).toBe(true);
  const before = readGameplayState(defaultGameSession);
  const commit = vi.fn();
  const unsubscribe = subscribeRunSessionCommits(commit, defaultGameSession);
  const started = vi.fn();
  const start = createBattleStartCommands(started, defaultGameSession);
  try {
    expect(commitCardPlay(0, slash.id, defaultGameSession)).toBeNull();
    expect(commitBattleWish(slash.id, defaultGameSession)).toBeNull();
    expect(commitEndTurn(defaultGameSession)).toBeNull();
    expect(start.startBattle({ enemyId: "goblin" })).toBeNull();
    expect(start.startBossById({ bossId: "forge-golem" })).toBe(false);
    expect(readGameplayState(defaultGameSession)).toBe(before);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
    expect(snapshotRun(undefined, defaultGameSession).activeCombat).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    expect(started).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

it("starts combat only once and preserves its activity while visiting the Menu", () => {
  dispatchRunSessionCommand(
    (transaction) => {
      setHasActiveRun(transaction, true);
      setRunDeck(transaction, getStartingDeck("knight"));
      return acceptCommand();
    },
    undefined,
    defaultGameSession,
  );
  const started = vi.fn();
  const start = createBattleStartCommands(started, defaultGameSession);
  expect(start.startBattle({ enemyId: "goblin" })).not.toBeNull();
  const before = readGameplayState(defaultGameSession);
  expect(start.startBattle({ enemyId: "goblin" })).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(before);
  expect(started).toHaveBeenCalledOnce();
  expect(snapshotRun("menu", defaultGameSession)).toMatchObject({
    currentScreen: "battle",
    activeCombat: { battleState: readBattle(defaultGameSession).battleState },
  });
});

it("resumes an unsettled victory and commits its rewards exactly once before presentation navigation", () => {
  dispatchRunSessionCommand(
    (transaction) => {
      initializeBattleForTest(
        transaction,
        regressionBattle({ enemyHealth: 0, pendingMaterials: { ...emptyInventory(), gems: 2 } }),
      );
      return acceptCommand();
    },
    undefined,
    defaultGameSession,
  );
  const saved = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun("battle", defaultGameSession))))!;
  expect(saved.activeCombat?.battleState.enemyHealth).toBe(0);
  restoreRun(saved, {}, {}, defaultGameSession);
  const settle = createVictoryCommand(() => [DESTINATIONS.CAMPFIRE], defaultGameSession);
  const before = readGameplayState(defaultGameSession);
  expect(settle()).not.toBeNull();
  const committed = readGameplayState(defaultGameSession);
  expect(committed.revision).toBe(before.revision + 1);
  expect(committed.runProfile.materialInventory.gems).toBe(before.runProfile.materialInventory.gems + 2);
  expect(readRunSession(defaultGameSession).activity.kind).toBe("rewards");
  expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
  expect(snapshotRun("battle", defaultGameSession)).toMatchObject({ currentScreen: "rewards", activeCombat: null });
  expect(settle()).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(committed);

  const rewardSave = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun("battle", defaultGameSession))))!;
  restoreRun(rewardSave, {}, {}, defaultGameSession);
  const resumed = readGameplayState(defaultGameSession);
  expect(settle()).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(resumed);
  expect(readRunSession(defaultGameSession).rewardFlow.state).toEqual(committed.session.rewardFlow.state);
});
