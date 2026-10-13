import { snapshotSessionSave } from "@/features/alchemy/shared/storage";
import { savedActivityFixture, savedActivityData } from "../../../../fixtures/run-activity";
import "../../../../helpers/mock-audio";

import "../../../../helpers/mock-flush-save";
import { beforeEach, expect, it, vi } from "vitest";
import { commitBattleWish, commitCardPlay, commitEndTurn } from "@/features/alchemy/shared/stores/battle-commands";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { abandonRun, restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveRun, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createVictoryCommand } from "@/features/alchemy/run-loop/run/victory-commands";
import { cardById, getStartingDeck } from "@/lib/game-data";
import { parseActiveRun } from "@/lib/validation";
import { emptyInventory } from "@/lib/homestead/inventory";
import { regressionBattle } from "../../../../fixtures/battle";
import {
  mutateRunForTest,
  initializeBattleForTest,
  resetAllTestStores,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { gridLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetAllTestStores);

it("rejects every battle command after End Run without changing progress, RNG, or revision", () => {
  const slash = { ...cardById.slash!, uid: 1 };
  mutateRunForTest((transaction) => {
    initializeBattleForTest(transaction, regressionBattle({ hand: [slash], mana: 10, wishOptions: [slash] }));
  });
  expect(abandonRun(defaultGameSession)).toBe(true);
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
    expect(snapshotSessionSave(defaultGameSession).activeRun).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    expect(started).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

it("starts combat only once and preserves its activity while visiting the Menu", () => {
  mutateRunForTest((transaction) => {
    setHasActiveRun(transaction, true);
    setRunDeck(transaction, getStartingDeck("knight"));
  });
  const started = vi.fn();
  const start = createBattleStartCommands(started, defaultGameSession);
  expect(start.startBattle({ enemyId: "goblin" })).not.toBeNull();
  const before = readGameplayState(defaultGameSession);
  expect(start.startBattle({ enemyId: "goblin" })).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(before);
  expect(started).toHaveBeenCalledOnce();
  expect(snapshotRun(defaultGameSession)).toMatchObject({
    activity: savedActivityFixture("battle", { battleState: readBattle(defaultGameSession).battleState }),
  });
});

it.each([
  ["campaign", 2, 4],
  ["labyrinth", 3, 5],
  ["wildwood", 2, 10],
] as const)("uses %s progression for its shared combat material budget", (mode, band, quantity) => {
  setRunProgress({
    contentSystemType: mode,
    currentAct: mode === "campaign" ? band : 1,
    roomsEncountered: mode === "wildwood" ? band : 11,
  });
  if (mode === "labyrinth") {
    setRunSession({ labyrinthMap: { ...gridLabyrinthMapFixture(), currentFloor: band } });
  }
  const battle = regressionBattle({ enemyHealth: 0, contentSystemType: mode });
  if (mode === "wildwood") battle.currentEnemy = { ...battle.currentEnemy, enemyType: "boss" };
  mutateRunForTest((transaction) => {
    initializeBattleForTest(transaction, battle);
  });
  const settle = createVictoryCommand(defaultGameSession);
  expect(settle()).not.toBeNull();
  const reward = readRunSession(defaultGameSession).rewardFlow.state;
  expect(Object.values(reward.materials).reduce((sum, value) => sum + value, 0)).toBe(quantity);
  expect(settle()).toBeNull();
  expect(readRunSession(defaultGameSession).rewardFlow.state).toEqual(reward);
});

it("resumes an unsettled victory and commits its rewards exactly once before presentation navigation", () => {
  mutateRunForTest((transaction) => {
    initializeBattleForTest(
      transaction,
      regressionBattle({ enemyHealth: 0, pendingMaterials: { ...emptyInventory(), gems: 2 } }),
    );
  });
  const saved = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(defaultGameSession))))!;
  expect(savedActivityData(saved, "battle")?.battleState.enemyHealth).toBe(0);
  restoreRun(saved, {}, {}, defaultGameSession);
  const settle = createVictoryCommand(defaultGameSession);
  const before = readGameplayState(defaultGameSession);
  expect(settle()).not.toBeNull();
  const committed = readGameplayState(defaultGameSession);
  expect(committed.revision).toBe(before.revision + 1);
  expect(committed.runProfile.materialInventory.gems).toBe(before.runProfile.materialInventory.gems + 2);
  expect(readRunSession(defaultGameSession).activity.kind).toBe("rewards");
  expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
  expect(snapshotRun(defaultGameSession).activity.kind).toBe("rewards");
  expect(settle()).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(committed);

  const rewardSave = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(defaultGameSession))))!;
  restoreRun(rewardSave, {}, {}, defaultGameSession);
  const resumed = readGameplayState(defaultGameSession);
  expect(settle()).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(resumed);
  expect(readRunSession(defaultGameSession).rewardFlow.state).toEqual(committed.session.rewardFlow.state);
});

it.each([
  { name: "enemy phase", patch: { turnPhase: "enemy" as const } },
  { name: "defeated player", patch: { playerHealth: 0, deathsDoorUsed: true } },
])("rejects all player input during $name without resource, discovery, XP, RNG or revision changes", ({ patch }) => {
  const slash = { ...cardById.slash!, uid: 1 };
  mutateRunForTest((transaction) => {
    initializeBattleForTest(transaction, regressionBattle({ ...patch, hand: [slash], mana: 10, wishOptions: [slash] }));
  });
  const before = readGameplayState(defaultGameSession);
  const commit = vi.fn();
  const unsubscribe = subscribeRunSessionCommits(commit, defaultGameSession);
  try {
    expect(commitCardPlay(0, slash.id, defaultGameSession)).toBeNull();
    expect(commitBattleWish(slash.id, defaultGameSession)).toBeNull();
    expect(commitEndTurn(defaultGameSession)).toBeNull();
    expect(readGameplayState(defaultGameSession)).toBe(before);
    expect(commit).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});
