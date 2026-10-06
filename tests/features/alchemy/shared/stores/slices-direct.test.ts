import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyRewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { createRunRngState } from "@/lib/rng";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
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
} from "@/features/alchemy/shared/stores/run-session-write-port";

import { setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";

import { nextRunRandom, resetProgress } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readActiveRunScreen, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetAllTestStores();
});

describe("navigation write-port", () => {
  it("setScreen accepts direct values and updater functions", () => {
    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.BATTLE)));
    expect(readActiveRunScreen()).toBe("battle");
    dispatchGameplayCommand((draft) =>
      acceptCommand(setScreen(draft, (prev) => (prev === "battle" ? ROUTE_SCREENS.REWARDS : prev))),
    );
    expect(readActiveRunScreen()).toBe("rewards");
  });

  it("resetNavigation returns to the menu from any screen", () => {
    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.SHOP)));
    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")));
    expect(readActiveRunScreen()).toBe("menu");
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
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginRewardClaim(draft)))).toBe(true);
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(true);
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginRewardClaim(draft)))).toBe(false);

    dispatchGameplayCommand((draft) => acceptCommand(releaseRewardClaim(draft)));
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(false);

    dispatchGameplayCommand((draft) => acceptCommand(setCompanionRewardCards(draft, [rewardCard])));
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginRewardClaim(draft)))).toBe(true);
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(true);
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginRewardClaim(draft)))).toBe(false);

    dispatchGameplayCommand((draft) => acceptCommand(releaseRewardClaim(draft)));
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(false);
  });

  it("validates destination claims against offered destinations", () => {
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginDestinationClaim(draft, DESTINATIONS.MYSTERY)))).toBe(
      false,
    );
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "idle" });

    dispatchGameplayCommand((draft) =>
      acceptCommand(setRewardState(draft, { ...createEmptyRewardState([DESTINATIONS.MYSTERY]), gold: 30 })),
    );
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginDestinationClaim(draft, DESTINATIONS.MYSTERY)))).toBe(
      true,
    );
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "destination", destination: DESTINATIONS.MYSTERY });
    expect(dispatchGameplayCommand((draft) => acceptCommand(beginDestinationClaim(draft, DESTINATIONS.CAMPFIRE)))).toBe(
      false,
    );

    dispatchGameplayCommand((draft) => acceptCommand(cancelDestinationClaim(draft)));
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "idle" });
  });

  it("clearTransientSession restores initial transient fields", () => {
    dispatchGameplayCommand((draft) => {
      setHasActiveRun(draft, true);
      setPendingCharacterId(draft, "rogue");
      clearTransientSession(draft);

      return acceptCommand();
    });
    const cleared = readRunSession();
    expect(cleared.hasActiveRun).toBe(false);
    expect(cleared.rewardFlow.claim.kind).not.toBe("reward");
    expect(cleared.rewardFlow.claim).toEqual({ kind: "idle" });
    expect(cleared.pendingCharacterId).toBeNull();
  });
});

describe("progress write-port", () => {
  it("nextRunRandom advances per-stream counters independently within [0, 1)", () => {
    setRunProgress({ rng: createRunRngState(() => 0.5) });
    const first = dispatchGameplayCommand((draft) => acceptCommand(nextRunRandom(draft, "rewards")));
    const second = dispatchGameplayCommand((draft) => acceptCommand(nextRunRandom(draft, "rewards")));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(second).not.toBe(first);
    expect(readActiveRun().rng.counters.rewards).toBe(2);
    expect(readActiveRun().rng.counters.world).toBe(0);
  });

  it("addRunMaterialsEarned aggregates across grants and clear empties the tally", () => {
    dispatchGameplayCommand((draft) => {
      addRunMaterialsEarned(draft, { wood: 2, iron: 0, herbs: 1, food: 0, gems: 0, stone: 0, hide: 0 });
      addRunMaterialsEarned(draft, { wood: 3, iron: 1, herbs: 0, food: 0, gems: 2, stone: 0, hide: 0 });

      return acceptCommand();
    });
    expect(readActiveRun().runMaterialsEarned).toEqual({
      ...emptyInventory(),
      wood: 5,
      iron: 1,
      herbs: 1,
      gems: 2,
    });
    dispatchGameplayCommand((draft) => acceptCommand(clearRunMaterialsEarned(draft)));
    expect(readActiveRun().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("recordRunObtainedItem appends gear and trinket grants in order", () => {
    const instance = { instanceId: "obtained-armor", definitionId: "leather-armor-basic" as const, affixes: [] };
    dispatchGameplayCommand((draft) => {
      recordRunObtainedItem(draft, { kind: "gear", instance });
      recordRunObtainedItem(draft, { kind: "trinket", trinketId: "bone-charm" });

      return acceptCommand();
    });
    expect(readActiveRun().runObtainedItems).toEqual([
      { kind: "gear", instance },
      { kind: "trinket", trinketId: "bone-charm" },
    ]);
  });

  it("resetProgress preserves character while clearing run-scoped tallies", () => {
    setRunProgress({ characterId: "rogue" });
    dispatchGameplayCommand((draft) => {
      awardMysteryXP(draft, "burn", 50);
      setRoomsEncountered(draft, 7);
      resetProgress(draft);

      return acceptCommand();
    });
    const reset = readActiveRun();
    expect(reset.characterId).toBe("rogue");
    expect(reset.runTalentXP).toEqual({});
    expect(reset.roomsEncountered).toBe(0);
    expect(reset.initialized).toBe(false);
  });
});
