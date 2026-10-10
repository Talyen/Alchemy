import { getTransmutationOffers } from "@/lib/alchemist/transmutation";
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
  selectTransmutation,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import { createAlchemistShopCommands } from "@/features/alchemy/run-loop/shop/alchemist-shop-commands";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { snapshotRun, restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunSession, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { parseActiveRun } from "@/lib/active-run-session";
import { cardById, computeTalentEffects, getCardKeywords } from "@/lib/game-data";
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
  const snapshot = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(defaultGameSession))))!;
  expect(snapshot).not.toBeNull();
  const profile = readRunProfile(defaultGameSession);
  restoreRun(snapshot, profile.talentXP, profile.unlockedTalents, defaultGameSession);
}
describe("alchemy visit transactions and resume", () => {
  it("keeps Campfire offers through reload and commits only one brew, mutually exclusive with Rest", () => {
    setRunProgress({ runDeck: [cardById.slash!, cardById["health-potion"]!] });
    initializeAlchemyVisit("campfire", defaultGameSession);
    const initial = readRunSession(defaultGameSession).activity;
    reload();
    expect(readRunSession(defaultGameSession).activity).toEqual(initial);
    expect(brewAtCampfire({ kind: "new", offerIndex: 99 }, defaultGameSession)).toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(2);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).not.toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(3);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(10);
    reload();
    initializeAlchemyVisit("campfire", defaultGameSession);
    expect(brewAtCampfire({ kind: "new", offerIndex: 1 }, defaultGameSession)).toBeNull();
    expect(restAtCampfire(defaultGameSession)).toBe(false);
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(3);
  });
  it("combines existing Potions for free and preserves the spent visit after reload", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    const result = brewAtCampfire({ kind: "combine", indices: [1, 2] }, defaultGameSession);
    expect(result?.title).toBe("Mixed Potion");
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(2);
    reload();
    expect(brewAtCampfire({ kind: "combine", indices: [0, 1] }, defaultGameSession)).toBeNull();
  });
  it("requires mixing when two eligible instances exist, including duplicate Potion types", () => {
    setRunProgress({ gold: 0, runDeck: [cardById["health-potion"]!, cardById["health-potion"]!] });
    initializeAlchemyVisit("campfire", defaultGameSession);
    const before = snapshotRun(defaultGameSession);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).toBeNull();
    expect(brewAtCampfire({ kind: "combine", indices: [0, 0] }, defaultGameSession)).toBeNull();
    expect(snapshotRun(defaultGameSession)).toEqual(before);
    const result = brewAtCampfire({ kind: "combine", indices: [0, 1] }, defaultGameSession);
    expect(result?.effects).toEqual([{ kind: "heal", amount: 16 }]);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([result]);
    expect(readRunProfile(defaultGameSession).gold).toBe(0);
  });
  it("counts Mixed Potions as brewing ingredients", () => {
    setRunProgress({
      runDeck: [cardById.slash!, cardById["health-potion"]!, cardById["mixed-potion"]!],
    });
    initializeAlchemyVisit("campfire", defaultGameSession);
    const before = snapshotRun(defaultGameSession);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).toBeNull();
    expect(snapshotRun(defaultGameSession)).toEqual(before);
    expect(brewAtCampfire({ kind: "combine", indices: [1, 2] }, defaultGameSession)).not.toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(2);
  });
  it("Rest commits healing once and prevents brewing", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    expect(restAtCampfire(defaultGameSession)).toBe(true);
    const hp = readActiveRun(defaultGameSession).runPlayerHealth;
    expect(restAtCampfire(defaultGameSession)).toBe(false);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(hp);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).toBeNull();
  });
  it("persists each selection without rerolls and exchanges once only on Continue", () => {
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const initial = readRunSession(defaultGameSession).activity;
    if (initial.kind !== "transmutation") throw new Error("wrong visit");
    const choices = initial.data.transmutation!.choices;
    const rng = readActiveRun(defaultGameSession).rng;
    const deck = readActiveRun(defaultGameSession).runDeck;
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    expect(selectTransmutation({ kind: "source", index: 99, card: deck[0]! }, defaultGameSession)).toBe(false);
    expect(readRunSession(defaultGameSession).activity).toEqual(initial);
    expect(selectTransmutation({ kind: "source", index: 0, card: deck[0]! }, defaultGameSession)).toBe(true);
    reload();
    expect(selectTransmutation({ kind: "keyword", keyword: choices[0]!.keyword }, defaultGameSession)).toBe(true);
    const activity = readRunSession(defaultGameSession).activity;
    if (activity.kind !== "transmutation") throw new Error("wrong visit");
    const offers = getTransmutationOffers(activity.data);
    expect(offers).toHaveLength(3);
    expect(offers.every((card) => card.id !== deck[0]!.id && getCardKeywords(card).includes(choices[0]!.keyword))).toBe(
      true,
    );
    expect(selectTransmutation({ kind: "outcome", index: 0 }, defaultGameSession)).toBe(true);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(deck);
    reload();
    initializeAlchemyVisit("transmutation", defaultGameSession);
    expect(readActiveRun(defaultGameSession).rng).toEqual(rng);
    const selected = readRunSession(defaultGameSession).activity;
    expect(selected).toMatchObject({
      data: { transmutation: { choices, sourceIndex: 0, keyword: choices[0]!.keyword, offerIndex: 0 } },
    });
    const result = transmuteCard(0, 0, defaultGameSession)!;
    expect(result.id).toBe(offers[0]!.id);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([result, ...deck.slice(1)]);
    reload();
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    expect(readRunSession(defaultGameSession).activity).toMatchObject({ data: { completed: true, result } });
  });

  it("Back preserves offers and stale same-ID source modifications reject the exchange atomically", () => {
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const source = readActiveRun(defaultGameSession).runDeck[0]!;
    selectTransmutation({ kind: "source", index: 0, card: source }, defaultGameSession);
    const initial = readRunSession(defaultGameSession).activity;
    if (initial.kind !== "transmutation") throw new Error("wrong visit");
    const keyword = initial.data.transmutation!.choices[0]!.keyword;
    const rng = readActiveRun(defaultGameSession).rng;
    selectTransmutation({ kind: "keyword", keyword }, defaultGameSession);
    selectTransmutation({ kind: "outcome", index: 0 }, defaultGameSession);
    selectTransmutation({ kind: "back", to: "keyword" }, defaultGameSession);
    expect(readRunSession(defaultGameSession).activity).toEqual(initial);
    selectTransmutation({ kind: "keyword", keyword }, defaultGameSession);
    selectTransmutation({ kind: "outcome", index: 0 }, defaultGameSession);
    setRunProgress({ runDeck: [{ ...source, cost: source.cost + 1 }] });
    const before = snapshotRun(defaultGameSession);
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    expect(snapshotRun(defaultGameSession)).toEqual(before);
    expect(readActiveRun(defaultGameSession).rng).toEqual(rng);
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
    expect(readActiveRun(defaultGameSession).runDeck[1]?.effects).toEqual(cardById["health-potion"]!.effects);
    setRunProgress({ gold: 80 });
    expect(shop.strengthenPotion(1)?.effects).toEqual([{ kind: "heal", amount: 9 }]);
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
    expect(shop.strengthenPotion(1)?.effects).toEqual([{ kind: "heal", amount: 9 }]);
    expect(readRunProfile(defaultGameSession).gold).toBe(0);
  });
});
