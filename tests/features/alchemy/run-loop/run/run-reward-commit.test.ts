import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import "../../../../helpers/mock-audio";

import * as destinationFlow from "@/features/alchemy/shared/run-flow/destination-flow";
import { beforeEach, expect, it, vi } from "vitest";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { readActiveRun, readRunSession, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { cardById } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS } from "@/lib/routing";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetRunDomainStore);

it.each(["campaign", "labyrinth"] as const)(
  "commits the %s reward and resume location together before navigation",
  (mode) => {
    setRunProgress({ contentSystemType: mode });
    const card = cardById["slash"]!;
    setRunSession({
      activity: { kind: "rewards" },
      rewardState: {
        ...createEmptyRewardState([DESTINATIONS.NORMAL_COMBAT]),
        choices: [card],
        materials: { ...emptyInventory(), herbs: 3 },
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: mode,
      },
    });
    const before = readGameplayState(defaultGameSession);
    expect(claimRunReward(card.id, defaultGameSession)).not.toBeNull();
    const expected = mode === "campaign" ? "destination" : "labyrinth-map";
    expect(readGameplayState(defaultGameSession).revision).toBe(before.revision + 1);
    expect(readRunSession(defaultGameSession).activity.kind).toBe(expected);
    expect(readActiveRun(defaultGameSession).runDeck.map((item) => item.id)).toEqual([
      ...before.run.activeRun.runDeck.map((item) => item.id),
      card.id,
    ]);
    expect(readGameplayState(defaultGameSession).profile.discoveredCardIds).toContain(card.id);
    expect(readRunProfile(defaultGameSession).materialInventory.herbs).toBe(
      before.runProfile.materialInventory.herbs + 3,
    );
    const save = snapshotRun(defaultGameSession);
    expect(save.activity.kind).toBe(expected);
    expect(claimRunReward(card.id, defaultGameSession)).toBeNull();
    expect(snapshotRun(defaultGameSession)).toEqual(save);
    restoreRun(save, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).activity.kind).toBe(expected);
    expect(readActiveRun(defaultGameSession).runDeck.map((item) => item.id)).toEqual([
      ...before.run.activeRun.runDeck.map((item) => item.id),
      card.id,
    ]);
    expect(readActiveRun(defaultGameSession).rng).toEqual(save.rng);
  },
);

it("rejects an unavailable reward without changing activity, grants, or RNG", () => {
  setRunSession({
    activity: { kind: "rewards" },
    rewardState: { ...createEmptyRewardState(), choices: [cardById["slash"]!] },
  });
  const before = readGameplayState(defaultGameSession);
  expect(claimRunReward("not-offered", defaultGameSession)).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(before);
});

it("commits the next act and its offer from transaction values before a cancelled navigation", () => {
  const card = cardById.slash!;
  setRunProgress({ currentAct: 1, destinationIndexInAct: 7, runPlayerHealth: 14, gold: 30 });
  setRunSession({
    activity: { kind: "rewards" },
    rewardState: {
      ...createEmptyRewardState(),
      choices: [card],
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: "campaign",
    },
  });
  const before = readGameplayState(defaultGameSession);
  const result = claimRunReward(card.id, defaultGameSession);
  expect(result?.nextScreen).toBe("destination");
  expect(readGameplayState(defaultGameSession).revision).toBe(before.revision + 1);
  expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toHaveLength(3);
  expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).not.toContain(DESTINATIONS.BOSS_COMBAT);
  const save = snapshotRun(defaultGameSession);
  expect(save).toMatchObject({
    currentAct: 2,
    destinationIndexInAct: 0,
    activity: {
      kind: "destination",
      data: { destinations: readRunSession(defaultGameSession).rewardFlow.state.destinations },
    },
  });
  restoreRun(save, {}, {}, defaultGameSession);
  expect(claimRunReward(card.id, defaultGameSession)).toBeNull();
  expect(readActiveRun(defaultGameSession).runDeck.filter((item) => item.id === card.id)).toHaveLength(1);
});

it("rolls back a reward, act advancement and RNG if next-offer construction fails", () => {
  const card = cardById.slash!;
  setRunSession({
    activity: { kind: "rewards" },
    rewardState: {
      ...createEmptyRewardState(),
      choices: [card],
      materials: { ...emptyInventory(), wood: 3 },
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: "campaign",
    },
  });
  const before = readGameplayState(defaultGameSession);
  const sample = vi.spyOn(destinationFlow, "createInitialDestinationResult").mockImplementationOnce(() => {
    throw new Error("offer failed");
  });
  try {
    expect(() => claimRunReward(card.id, defaultGameSession)).toThrow("offer failed");
    expect(readGameplayState(defaultGameSession)).toBe(before);
  } finally {
    sample.mockRestore();
  }
});

it.each([false, true])(
  "commits the next Wildwood stage without ending the gauntlet when a card is claimed: %s",
  (claimed) => {
    const deck = Array.from({ length: 7 }, () => cardById.slash!);
    const card = cardById["health-potion"]!;
    setRunProgress({ contentSystemType: "wildwood", runDeck: deck });
    setRunSession({
      activity: { kind: "rewards" },
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "reward" },
      rewardState: {
        ...createEmptyRewardState(),
        choices: [card],
        lastVictoryEnemyType: "boss",
        lastVictoryContentSystem: "wildwood",
      },
    });
    const before = readGameplayState(defaultGameSession);
    const result = claimRunReward(claimed ? card.id : null, defaultGameSession);
    expect(result?.runEnded).toBe(false);
    expect(result?.nextScreen).toBe(claimed ? "wildwood-removal" : "battle");
    expect(readGameplayState(defaultGameSession).revision).toBe(before.revision + 1);
    const saved = snapshotRun(defaultGameSession);
    expect(saved.activity.kind).toBe(claimed ? "wildwood-removal" : "battle");
    expect(saved.wildwoodDraft?.phase).toBe(claimed ? "removal" : "battle");
    expect(saved.runDeck).toHaveLength(deck.length + (claimed ? 1 : 0));
    restoreRun(saved, {}, {}, defaultGameSession);
    expect(readActiveRun(defaultGameSession).rng).toEqual(saved.rng);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
    expect(claimRunReward(card.id, defaultGameSession)).toBeNull();
  },
);
