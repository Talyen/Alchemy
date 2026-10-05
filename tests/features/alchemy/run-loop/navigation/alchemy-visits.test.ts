import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { patchBattleState } from "../../../../fixtures/battle";
import "../../../../helpers/mock-audio";
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
  const snapshot = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun())))!;
  expect(snapshot).not.toBeNull();
  const profile = readRunProfile();
  restoreRun(snapshot, profile.talentXP, profile.unlockedTalents);
}
describe("alchemy visit transactions and resume", () => {
  it("keeps Campfire offers through reload and commits only one brew, mutually exclusive with Rest", () => {
    initializeAlchemyVisit("campfire");
    const initial = readRunSession().activity;
    reload();
    expect(readRunSession().activity).toEqual(initial);
    expect(brewAtCampfire({ kind: "new", offerIndex: 99 })).toBeNull();
    expect(readActiveRun().runDeck).toHaveLength(3);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 })).not.toBeNull();
    expect(readActiveRun().runDeck).toHaveLength(4);
    expect(readActiveRun().runPlayerHealth).toBe(10);
    reload();
    initializeAlchemyVisit("campfire");
    expect(brewAtCampfire({ kind: "new", offerIndex: 1 })).toBeNull();
    expect(restAtCampfire()).toBe(false);
    expect(readActiveRun().runDeck).toHaveLength(4);
  });
  it("combines existing Potions for free and never permits a repeat brew after reload", () => {
    initializeAlchemyVisit("campfire");
    const result = brewAtCampfire({ kind: "combine", indices: [1, 2] });
    expect(result?.brewed).toBe(true);
    expect(readActiveRun().runDeck).toHaveLength(2);
    reload();
    expect(brewAtCampfire({ kind: "combine", indices: [0, 1] })).toBeNull();
  });
  it("Rest commits healing once and prevents brewing", () => {
    initializeAlchemyVisit("campfire");
    expect(restAtCampfire()).toBe(true);
    const hp = readActiveRun().runPlayerHealth;
    expect(restAtCampfire()).toBe(false);
    expect(readActiveRun().runPlayerHealth).toBe(hp);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 })).toBeNull();
  });
  it("exchanges exactly one source with fixed independent offers and survives reload", () => {
    initializeAlchemyVisit("transmutation");
    const activity = readRunSession().activity;
    if (activity.kind !== "transmutation") throw new Error("wrong visit");
    const offers = activity.data.offers;
    const index = offers.findIndex((card) => card.id !== "slash");
    expect(transmuteCard(99, index)).toBeNull();
    expect(readRunSession().activity).toEqual(activity);
    const result = transmuteCard(0, index)!;
    expect(readActiveRun().runDeck[0]?.id).toBe(result.id);
    expect(readActiveRun().runDeck).toHaveLength(3);
    reload();
    expect(transmuteCard(1, 0)).toBeNull();
    initializeAlchemyVisit("transmutation");
    expect(readRunSession().activity).toMatchObject({ data: { offers, completed: true } });
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
    const shop = createAlchemistShopCommands({
      talentEffects: computeTalentEffects({}),
      homesteadEffects: { mixPotionDiscount: 0 },
    });
    setRunProgress({ gold: 39 });
    expect(shop.strengthenPotion(1)).toBeNull();
    expect(readRunProfile().gold).toBe(39);
    expect(readActiveRun().runDeck[1]?.brewed).toBeUndefined();
    setRunProgress({ gold: 80 });
    expect(shop.strengthenPotion(1)?.brewed).toBe(true);
    expect(readRunProfile().gold).toBe(40);
    expect(shop.mixPotions(1, 2)).toBeNull();
    reload();
    expect(shop.strengthenPotion(2)).toBeNull();
  });
  it("preserves spent reaction opportunities in a current battle save", () => {
    setRunSession({ activity: { kind: "battle" } });
    dispatchGameplayCommand((draft) =>
      acceptCommand(
        initializeActiveBattle(draft, patchBattleState({ flags: { shatterUsed: true, wildfireUsed: true } })),
      ),
    );
    reload();
    expect(readGameplayState().battle.battleState.flags).toMatchObject({ shatterUsed: true, wildfireUsed: true });
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
    const shop = createAlchemistShopCommands({
      talentEffects: computeTalentEffects({}),
      homesteadEffects: { mixPotionDiscount: 0 },
    });
    expect(shop.strengthenPotion(1)?.brewed).toBe(true);
    expect(readRunProfile().gold).toBe(0);
  });
});
