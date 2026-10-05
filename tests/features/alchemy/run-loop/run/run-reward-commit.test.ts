import "../../../../helpers/mock-audio";
import { beforeEach, expect, it } from "vitest";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { readActiveRun, readRunSession, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { cardById } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS } from "@/lib/routing";

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
    const before = readGameplayState();
    expect(claimRunReward(card.id)).not.toBeNull();
    const expected = mode === "campaign" ? "destination" : "labyrinth-map";
    expect(readGameplayState().revision).toBe(before.revision + 1);
    expect(readRunSession().activity.kind).toBe(expected);
    expect(readActiveRun().runDeck.map((item) => item.id)).toEqual([
      ...before.run.activeRun.runDeck.map((item) => item.id),
      card.id,
    ]);
    expect(readGameplayState().profile.discoveredCardIds).toContain(card.id);
    expect(readRunProfile().materialInventory.herbs).toBe(before.runProfile.materialInventory.herbs + 3);
    const save = snapshotRun();
    expect(save.currentScreen).toBe(expected);
    expect(claimRunReward(card.id)).toBeNull();
    expect(snapshotRun()).toEqual(save);
    restoreRun(save, {}, {});
    expect(readRunSession().activity.kind).toBe(expected);
    expect(readActiveRun().runDeck.map((item) => item.id)).toEqual([
      ...before.run.activeRun.runDeck.map((item) => item.id),
      card.id,
    ]);
    expect(readActiveRun().rng).toEqual(save.rng);
  },
);

it("rejects an unavailable reward without changing activity, grants, or RNG", () => {
  setRunSession({
    activity: { kind: "rewards" },
    rewardState: { ...createEmptyRewardState(), choices: [cardById["slash"]!] },
  });
  const before = readGameplayState();
  expect(claimRunReward("not-offered")).toBeNull();
  expect(readGameplayState()).toBe(before);
});
