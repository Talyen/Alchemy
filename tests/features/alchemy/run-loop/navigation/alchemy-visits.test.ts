import "../../../../helpers/mock-audio";

import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";

import { patchBattleState } from "../../../../fixtures/battle";
import { beforeEach, describe, expect, it } from "vitest";
import {
  initializeAlchemyVisit,
  brewAtCampfire,
  transmuteCard,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import { createAlchemistShopCommands } from "@/features/alchemy/run-loop/shop/alchemist-shop-commands";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { snapshotRun, restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunSession, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { parseActiveRun } from "@/lib/active-run-session";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { defaultGameSession } from "@/app/application-session";
beforeEach(() => {
  resetAllTestStores();
  setRunProgress({
    characterId: "knight",
    runPlayerHealth: 10,
    runMaxHealth: 30,
    runDeck: [cardById.slash!, cardById["health-potion"]!, cardById["mana-potion"]!],
  });
  setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
});
function reload() {
  const snapshot = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(undefined, defaultGameSession))))!;
  expect(snapshot).not.toBeNull();
  const profile = readRunProfile(defaultGameSession);
  restoreRun(snapshot, profile.talentXP, profile.unlockedTalents, defaultGameSession);
}
describe("alchemy visit transactions and resume", () => {
  it("keeps Campfire offers through reload and commits only one brew, mutually exclusive with Rest", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    const initial = readRunSession(defaultGameSession).activity;
    reload();
    expect(readRunSession(defaultGameSession).activity).toEqual(initial);
    expect(brewAtCampfire({ kind: "new", offerIndex: 99 }, defaultGameSession)).toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(3);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).not.toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(4);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(10);
    reload();
    initializeAlchemyVisit("campfire", defaultGameSession);
    expect(brewAtCampfire({ kind: "new", offerIndex: 1 }, defaultGameSession)).toBeNull();
    expect(restAtCampfire(defaultGameSession)).toBe(false);
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(4);
  });
  it("combines existing Potions for free and never permits a repeat brew after reload", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    const result = brewAtCampfire({ kind: "combine", indices: [1, 2] }, defaultGameSession);
    expect(result?.brewed).toBe(true);
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(2);
    reload();
    expect(brewAtCampfire({ kind: "combine", indices: [0, 1] }, defaultGameSession)).toBeNull();
  });
  it("Rest commits healing once and prevents brewing", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    expect(restAtCampfire(defaultGameSession)).toBe(true);
    const hp = readActiveRun(defaultGameSession).runPlayerHealth;
    expect(restAtCampfire(defaultGameSession)).toBe(false);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(hp);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).toBeNull();
  });
  it("exchanges exactly one source with fixed independent offers and survives reload", () => {
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const activity = readRunSession(defaultGameSession).activity;
    if (activity.kind !== "transmutation") throw new Error("wrong visit");
    const offers = activity.data.offers;
    const index = offers.findIndex((card) => card.id !== "slash");
    expect(transmuteCard(99, index, defaultGameSession)).toBeNull();
    expect(readRunSession(defaultGameSession).activity).toEqual(activity);
    const result = transmuteCard(0, index, defaultGameSession)!;
    expect(readActiveRun(defaultGameSession).runDeck[0]?.id).toBe(result.id);
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(3);
    reload();
    expect(transmuteCard(1, 0, defaultGameSession)).toBeNull();
    initializeAlchemyVisit("transmutation", defaultGameSession);
    expect(readRunSession(defaultGameSession).activity).toMatchObject({ data: { offers, completed: true } });
  });
  it("shop strengthening shares price, rejects insufficient Gold atomically, and spends the one service", () => {
    setRunSession({
      activity: {
        kind: "alchemist",
        data: {
          potions: [],
          mixUsed: false,
          refreshesLeft: 1,
          purchasedSlotKeys: [],
          firstPurchaseUsed: false,
          freeRefreshUsed: false,
        },
      },
    });
    const shop = createAlchemistShopCommands(
      {
        talentEffects: computeTalentEffects({}),
        homesteadEffects: { mixPotionDiscount: 0 },
      },
      defaultGameSession,
    );
    setRunProgress({ gold: 39 });
    expect(shop.strengthenPotion(1)).toBeNull();
    expect(readRunProfile(defaultGameSession).gold).toBe(39);
    expect(readActiveRun(defaultGameSession).runDeck[1]?.brewed).toBeUndefined();
    setRunProgress({ gold: 80 });
    expect(shop.strengthenPotion(1)?.brewed).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBe(40);
    expect(shop.mixPotions(1, 2)).toBeNull();
    reload();
    expect(shop.strengthenPotion(2)).toBeNull();
  });
  it("preserves spent reaction opportunities in a current battle save", () => {
    dispatchGameplayCommand(
      (draft) =>
        acceptCommand(
          initializeActiveBattle(draft, patchBattleState({ flags: { shatterUsed: true, wildfireUsed: true } })),
        ),
      undefined,
      defaultGameSession,
    );
    reload();
    expect(readBattle(defaultGameSession).battleState.flags).toMatchObject({ shatterUsed: true, wildfireUsed: true });
  });
  it("free brewing modifiers apply to Strengthen without spending Gold", () => {
    setRunProgress({ contentSystemType: "labyrinth", gold: 0 });
    setRunSession({
      activity: {
        kind: "alchemist",
        data: {
          potions: [],
          mixUsed: false,
          refreshesLeft: 1,
          purchasedSlotKeys: [],
          firstPurchaseUsed: false,
          freeRefreshUsed: false,
        },
      },
      activeLabyrinthRewardModifiers: ["open-kitchen"],
    });
    const shop = createAlchemistShopCommands(
      {
        talentEffects: computeTalentEffects({}),
        homesteadEffects: { mixPotionDiscount: 0 },
      },
      defaultGameSession,
    );
    expect(shop.strengthenPotion(1)?.brewed).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBe(0);
  });
});
