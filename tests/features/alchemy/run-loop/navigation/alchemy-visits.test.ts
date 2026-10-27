import { getTransmutationOffers, getTransmutationVariants } from "@/lib/alchemist/transmutation";
import "../../../../helpers/mock-audio";
import { initializeAlchemyVisitForTest as initializeAlchemyVisit } from "../../../../helpers/visit-initialization";
import {
  mutateGameplayForTest,
  initializeBattleForTest as initializeActiveBattle,
  resetAllTestStores,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { patchBattleState } from "../../../../fixtures/battle";
import { beforeEach, describe, expect, it } from "vitest";
import {
  brewAtCampfire,
  transmuteCard,
  selectTransmutation,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import { createAlchemistShopCommands } from "@/features/alchemy/run-loop/shop/alchemist-shop-commands";
import { snapshotRun, restoreRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readActiveRun, readRunSession, readRunProfile } from "@/features/alchemy/shared/stores/session/run-reads";
import { parseActiveRun } from "@/lib/validation";
import { cardById, type BattleCard } from "@/lib/game-data";
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
  it("rejects invalid Campfire ingredient indices without consuming the visit", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    const before = snapshotRun(defaultGameSession);
    for (const index of [-1, 3, 0.5, NaN, Infinity]) {
      expect(brewAtCampfire({ kind: "combine", indices: [index, 1] }, defaultGameSession)).toBeNull();
      expect(brewAtCampfire({ kind: "combine", indices: [1, index] }, defaultGameSession)).toBeNull();
    }
    expect(snapshotRun(defaultGameSession)).toEqual(before);
    expect(brewAtCampfire({ kind: "combine", indices: [1, 2] }, defaultGameSession)).not.toBeNull();
  });
  it("Rest commits healing once and prevents brewing", () => {
    initializeAlchemyVisit("campfire", defaultGameSession);
    expect(restAtCampfire(defaultGameSession)).toBe(true);
    const hp = readActiveRun(defaultGameSession).runPlayerHealth;
    expect(restAtCampfire(defaultGameSession)).toBe(false);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(hp);
    expect(brewAtCampfire({ kind: "new", offerIndex: 0 }, defaultGameSession)).toBeNull();
  });
  it("Herbal Hearth draws its Potion from the events stream, leaving rewards untouched", () => {
    setRunProgress({
      contentSystemType: "labyrinth",
      rng: { seed: 7, counters: { rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 } },
    });
    setRunSession({ activeLabyrinthRewardModifiers: ["herbal-hearth"] });
    initializeAlchemyVisit("campfire", defaultGameSession);
    const before = { ...readActiveRun(defaultGameSession).rng.counters };
    const deckBefore = readActiveRun(defaultGameSession).runDeck.length;
    expect(restAtCampfire(defaultGameSession)).toBe(true);
    const after = readActiveRun(defaultGameSession).rng.counters;
    expect(after.rewards).toBe(before.rewards);
    expect(after.events - before.events).toBe(1);
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(deckBefore + 1);
  });
  it("persists offers, random source choices, and previews, then alters the original card exactly once", () => {
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const initial = readRunSession(defaultGameSession).activity;
    if (initial.kind !== "transmutation") throw new Error("wrong visit");
    const choices = initial.data.transmutation!.choices;
    const rng = readActiveRun(defaultGameSession).rng;
    const deck = readActiveRun(defaultGameSession).runDeck;
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    expect(selectTransmutation({ kind: "source", index: 99, card: deck[0]! }, defaultGameSession)).toBe(false);
    expect(readRunSession(defaultGameSession).activity).toEqual(initial);
    // Reordering retains every field, but fromEntries erases their required-key types.
    const reordered = Object.fromEntries(Object.entries(deck[0]!).reverse()) as unknown as BattleCard;
    expect(selectTransmutation({ kind: "source", index: 0, card: reordered }, defaultGameSession)).toBe(true);
    const activity = readRunSession(defaultGameSession).activity;
    if (activity.kind !== "transmutation") throw new Error("wrong visit");
    expect(activity.data.transmutation).toMatchObject({ keyword: null, offerIndex: null });
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    const offers = getTransmutationOffers(activity.data);
    const offerIndex = offers.length - 1;
    const preview = offers[offerIndex]!;
    expect(selectTransmutation({ kind: "keyword", keyword: preview.transmuted! }, defaultGameSession)).toBe(true);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(deck);
    reload();
    initializeAlchemyVisit("transmutation", defaultGameSession);
    expect(readActiveRun(defaultGameSession).rng).toEqual(rng);
    expect(readRunSession(defaultGameSession).activity).toMatchObject({
      data: { transmutation: { choices, sourceIndex: 0, keyword: preview.transmuted, offerIndex } },
    });
    const result = transmuteCard(0, offerIndex, defaultGameSession)!;
    expect(result).toEqual(preview);
    expect(result.id).toBe(deck[0]!.id);
    expect(result.cost).toBe(deck[0]!.cost);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([result, ...deck.slice(1)]);
    reload();
    expect(transmuteCard(0, offerIndex, defaultGameSession)).toBeNull();
    expect(readRunSession(defaultGameSession).activity).toMatchObject({ data: { completed: true, result } });
  });

  it("Back preserves the fixed preview and a stale same-ID source rejects commitment atomically", () => {
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const source = readActiveRun(defaultGameSession).runDeck[0]!;
    selectTransmutation({ kind: "source", index: 0, card: source }, defaultGameSession);
    const selected = readRunSession(defaultGameSession).activity;
    const rng = readActiveRun(defaultGameSession).rng;
    selectTransmutation({ kind: "back" }, defaultGameSession);
    reload();
    selectTransmutation(
      { kind: "source", index: 0, card: readActiveRun(defaultGameSession).runDeck[0]! },
      defaultGameSession,
    );
    expect(readRunSession(defaultGameSession).activity).toEqual(selected);
    setRunProgress({ runDeck: [{ ...source, cost: source.cost + 1 }] });
    const before = snapshotRun(defaultGameSession);
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    expect(
      selectTransmutation(
        { kind: "source", index: 0, card: readActiveRun(defaultGameSession).runDeck[0]! },
        defaultGameSession,
      ),
    ).toBe(false);
    expect(snapshotRun(defaultGameSession)).toEqual(before);
    expect(readActiveRun(defaultGameSession).rng).toEqual(rng);
  });
  it("rejects a saved Companion addition if the deck loses its summon", () => {
    const source = cardById.slash!;
    const deck = [source, cardById["wolf-companion"]!];
    setRunProgress({ runDeck: deck });
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const activity = readRunSession(defaultGameSession).activity;
    if (activity.kind !== "transmutation") throw new Error("wrong visit");
    const variant = getTransmutationVariants(source, "companion", deck)[0]!;
    setRunSession({
      activity: {
        kind: "transmutation",
        data: {
          ...activity.data,
          transmutation: {
            choices: [{ keyword: "companion", alterations: [{ ...variant, sourceIndex: 0, source }] }],
            sourceIndex: null,
            source: null,
            keyword: null,
            offerIndex: null,
          },
        },
      },
    });
    expect(selectTransmutation({ kind: "source", index: 0, card: source }, defaultGameSession)).toBe(true);
    setRunProgress({ runDeck: [source] });
    expect(selectTransmutation({ kind: "keyword", keyword: "companion" }, defaultGameSession)).toBe(false);
    const before = snapshotRun(defaultGameSession);
    expect(transmuteCard(0, 0, defaultGameSession)).toBeNull();
    expect(snapshotRun(defaultGameSession)).toEqual(before);
  });

  it("shop strengthening shares price, rejects insufficient Gold atomically, and spends Distill once", () => {
    setRunSession({
      activity: {
        kind: "alchemist",
        data: {
          potions: [],
          brewOffers: [],
          brewUsed: false,
          distillUsed: false,
          mixUsed: false,
          refreshesLeft: 1,
          purchasedSlotKeys: [],
          firstPurchaseUsed: false,
          freeRefreshUsed: false,
        },
      },
    });
    const shop = createAlchemistShopCommands(defaultGameSession);
    setRunProgress({ gold: 39 });
    expect(shop.strengthenPotion(1)).toBeNull();
    expect(readRunProfile(defaultGameSession).gold).toBe(39);
    expect(readActiveRun(defaultGameSession).runDeck[1]?.effects).toEqual(cardById["health-potion"]!.effects);
    setRunProgress({ gold: 80 });
    expect(shop.strengthenPotion(1)?.effects).toEqual([{ kind: "heal", amount: 9 }]);
    expect(readRunProfile(defaultGameSession).gold).toBe(40);
    expect(shop.strengthenPotion(2)).toBeNull();
    reload();
    expect(shop.strengthenPotion(2)).toBeNull();
  });
  it("preserves spent reaction opportunities in a current battle save", () => {
    mutateGameplayForTest((draft) =>
      initializeActiveBattle(
        draft,
        patchBattleState({ reactions: { wildfireDamage: 3, wildfirePendingTickDamage: 2 } }),
      ),
    );
    reload();
    expect(readBattle(defaultGameSession).battleState.reactions).toMatchObject({
      wildfireDamage: 3,
      wildfirePendingTickDamage: 2,
    });
  });
  it("free brewing modifiers apply to Strengthen without spending Gold", () => {
    setRunProgress({ contentSystemType: "labyrinth", gold: 0 });
    setRunSession({
      activity: {
        kind: "alchemist",
        data: {
          potions: [],
          brewOffers: [],
          brewUsed: false,
          distillUsed: false,
          mixUsed: false,
          refreshesLeft: 1,
          purchasedSlotKeys: [],
          firstPurchaseUsed: false,
          freeRefreshUsed: false,
        },
      },
      activeLabyrinthRewardModifiers: ["open-kitchen"],
    });
    const shop = createAlchemistShopCommands(defaultGameSession);
    expect(shop.strengthenPotion(1)?.effects).toEqual([{ kind: "heal", amount: 9 }]);
    expect(readRunProfile(defaultGameSession).gold).toBe(0);
  });
});
