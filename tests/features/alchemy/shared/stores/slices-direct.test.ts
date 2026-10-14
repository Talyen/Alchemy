import { mutateGameplayForTest, resetAllTestStores, setRunProgress } from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyRewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { createRunRngState } from "@/lib/rng";

import {
  addRunMaterialsEarned,
  awardMysteryXP,
  beginDestinationClaim,
  beginRewardClaim,
  cancelDestinationClaim,
  clearRunMaterialsEarned,
  clearTransientSession,
  recordRunObtainedItem,
  releaseRewardClaim,
  setCompanionRewardCards,
  setPendingCharacterId,
  setRewardState,
  setRoomsEncountered,
  setScreen,
  setHasActiveRun,
  nextRunRandom,
  resetProgress,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readActiveRunScreen, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetAllTestStores();
});

describe("navigation write-port", () => {
  it("setScreen accepts direct values and updater functions", () => {
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.BATTLE));
    expect(readActiveRunScreen(defaultGameSession)).toBe("battle");
    mutateGameplayForTest((draft) => setScreen(draft, (prev) => (prev === "battle" ? ROUTE_SCREENS.REWARDS : prev)));
    expect(readActiveRunScreen(defaultGameSession)).toBe("rewards");
  });

  it("resetNavigation returns to the menu from any screen", () => {
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.SHOP));
    mutateGameplayForTest((draft) => setScreen(draft, "menu"));
    expect(readActiveRunScreen(defaultGameSession)).toBe("menu");
  });
});

describe("session write-port", () => {
  const rewardCard: BattleCard = {
    id: "fireball",
    title: "Fireball",
    descriptionLines: [""],
    art: "",
    cost: 3,
    effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
  };

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

  it("clearTransientSession restores initial transient fields", () => {
    mutateGameplayForTest((draft) => {
      setHasActiveRun(draft, true);
      setPendingCharacterId(draft, "rogue");
      clearTransientSession(draft);
    });
    const cleared = readRunSession(defaultGameSession);
    expect(cleared.hasActiveRun).toBe(false);
    expect(cleared.rewardFlow.claim.kind).not.toBe("reward");
    expect(cleared.rewardFlow.claim).toEqual({ kind: "idle" });
    expect(cleared.pendingCharacterId).toBeNull();
  });
});

describe("progress write-port", () => {
  it("nextRunRandom advances per-stream counters independently within [0, 1)", () => {
    setRunProgress({ rng: createRunRngState(() => 0.5) });
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

  it("recordRunObtainedItem appends gear and trinket grants in order", () => {
    const instance = { instanceId: "obtained-armor", definitionId: "leather-armor-basic" as const, affixes: [] };
    mutateGameplayForTest((draft) => {
      recordRunObtainedItem(draft, { kind: "gear", instance });
      recordRunObtainedItem(draft, { kind: "trinket", trinketId: "bone-charm" });
    });
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([
      { kind: "gear", instance },
      { kind: "trinket", trinketId: "bone-charm" },
    ]);
  });

  it("resetProgress preserves character while clearing run-scoped tallies", () => {
    setRunProgress({ characterId: "rogue" });
    mutateGameplayForTest((draft) => {
      awardMysteryXP(draft, "burn", 50);
      setRoomsEncountered(draft, 7);
      resetProgress(draft);
    });
    const reset = readActiveRun(defaultGameSession);
    expect(reset.characterId).toBe("rogue");
    expect(reset.runTalentXP).toEqual({});
    expect(reset.roomsEncountered).toBe(0);
    expect(reset.initialized).toBe(false);
  });
});
