import { makeTestCard } from "../../../../fixtures/cards";
import { mutateGameplayForTest, resetAllTestStores, setRunProgress } from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyRewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS } from "@/lib/routing";
import { createRunRngState } from "@/lib/rng";

import {
  addRunMaterialsEarned,
  beginDestinationClaim,
  beginRewardClaim,
  cancelDestinationClaim,
  clearRunMaterialsEarned,
  releaseRewardClaim,
  setCompanionRewardCards,
  setRewardState,
  nextRunRandom,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetAllTestStores();
});

describe("session write-port", () => {
  const rewardCard: BattleCard = makeTestCard({
    id: "fireball",
    title: "Fireball",
    cost: 3,
    effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
  });

  it("gates beginRewardClaim on one claim at a time so empty skips can finalize", () => {
    expect(mutateGameplayForTest((draft) => beginRewardClaim(draft))).toBe(true);
    expect(readRunSession(defaultGameSession).rewardFlow.claim.kind === "reward").toBe(true);
    expect(mutateGameplayForTest((draft) => beginRewardClaim(draft))).toBe(false);

    mutateGameplayForTest((draft) => releaseRewardClaim(draft));
    expect(readRunSession(defaultGameSession).rewardFlow.claim.kind === "reward").toBe(false);

    mutateGameplayForTest((draft) => setCompanionRewardCards(draft, [rewardCard]));
    expect(mutateGameplayForTest((draft) => beginRewardClaim(draft))).toBe(true);
    expect(readRunSession(defaultGameSession).rewardFlow.claim.kind === "reward").toBe(true);
    expect(mutateGameplayForTest((draft) => beginRewardClaim(draft))).toBe(false);

    mutateGameplayForTest((draft) => releaseRewardClaim(draft));
    expect(readRunSession(defaultGameSession).rewardFlow.claim.kind === "reward").toBe(false);
  });

  it("validates destination claims against offered destinations", () => {
    expect(mutateGameplayForTest((draft) => beginDestinationClaim(draft, DESTINATIONS.MYSTERY))).toBe(false);
    expect(readRunSession(defaultGameSession).rewardFlow.claim).toEqual({ kind: "idle" });

    mutateGameplayForTest((draft) =>
      setRewardState(draft, { ...createEmptyRewardState([DESTINATIONS.MYSTERY]), gold: 30 }),
    );
    expect(mutateGameplayForTest((draft) => beginDestinationClaim(draft, DESTINATIONS.MYSTERY))).toBe(true);
    expect(readRunSession(defaultGameSession).rewardFlow.claim).toEqual({
      kind: "destination",
      destination: DESTINATIONS.MYSTERY,
    });
    expect(mutateGameplayForTest((draft) => beginDestinationClaim(draft, DESTINATIONS.CAMPFIRE))).toBe(false);

    mutateGameplayForTest((draft) => cancelDestinationClaim(draft));
    expect(readRunSession(defaultGameSession).rewardFlow.claim).toEqual({ kind: "idle" });
  });
});

describe("progress write-port", () => {
  it("nextRunRandom advances per-stream counters independently within [0, 1)", () => {
    setRunProgress({ rng: createRunRngState(0x8000_0000) });
    const first = mutateGameplayForTest((draft) => nextRunRandom(draft, "rewards"));
    const second = mutateGameplayForTest((draft) => nextRunRandom(draft, "rewards"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(second).not.toBe(first);
    expect(readActiveRun(defaultGameSession).rng.counters.rewards).toBe(2);
    expect(readActiveRun(defaultGameSession).rng.counters.world).toBe(0);
  });

  it("addRunMaterialsEarned aggregates across grants and clear empties the tally", () => {
    mutateGameplayForTest((draft) => {
      addRunMaterialsEarned(draft, { wood: 2, iron: 0, herbs: 1, food: 0, gems: 0, stone: 0, hide: 0 });
      addRunMaterialsEarned(draft, { wood: 3, iron: 1, herbs: 0, food: 0, gems: 2, stone: 0, hide: 0 });
    });
    expect(readActiveRun(defaultGameSession).runMaterialsEarned).toEqual({
      ...emptyInventory(),
      wood: 5,
      iron: 1,
      herbs: 1,
      gems: 2,
    });
    mutateGameplayForTest((draft) => clearRunMaterialsEarned(draft));
    expect(readActiveRun(defaultGameSession).runMaterialsEarned).toEqual(emptyInventory());
  });
});
