import { expect, it, vi } from "vitest";

// A live run must be constructible when save validation is unavailable.
vi.mock("@/lib/validation", () => {
  throw new Error("Save validation reached from live run domain");
});

import { ACTIVE_RUN_PROGRESS_KEYS, createEmptyRewardState, serializePendingReward } from "@/lib/active-run-session";
import { createInitialActiveRunFields } from "@/features/alchemy/shared/stores/session/run-state-init";

it("run domain isolation constructs seeded progress and reward activities without the save parser", () => {
  const run = createInitialActiveRunFields(null, "knight", () => 42);
  expect(run.rng.seed).toBe(42);
  expect(run.runDeck.length).toBeGreaterThan(0);
  expect([...ACTIVE_RUN_PROGRESS_KEYS].sort()).toEqual(Object.keys(run).sort());
  expect(run.runGoldEarned).toBe(0);
  expect(run.runHistoryPartial).toBe(false);
  const reward = createEmptyRewardState();
  reward.choices = [run.runDeck[0]!];
  expect(serializePendingReward(reward)).toEqual({
    rewardType: "card",
    choiceIds: [run.runDeck[0]!.id],
    companionChoiceIds: [],
    selectedId: null,
    gold: 0,
    materials: reward.materials,
    destinations: [],
    selectedBossId: null,
    lastVictoryEnemyType: null,
    lastVictoryContentSystem: null,
  });
});
