import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { readActivityData, shopItemSlotKey } from "@/lib/active-run-session";
import { restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { commitCardPlay } from "@/features/alchemy/shared/stores/battle-commands";
import {
  mutateGearForTest,
  resetAllTestStores,
  resetGearForTest,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { makeActiveRunData } from "./active-run-data-fixture";
import { cardById, trinketLibrary, cardMagnitude, withCardDescription, getCardKeywords } from "@/lib/game-data";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { makeMinimalActiveRunInput } from "../../../../fixtures/active-run";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { defaultGameSession } from "@/app/application-session";
import { savedActivityFixture } from "../../../../fixtures/run-activity";

const ownedTrinket = trinketLibrary[0]!;
const otherTrinket = trinketLibrary[1]!;

describe("saved battle card recovery", () => {
  beforeEach(() => {
    resetAllTestStores();
  });

  it.each([false, true])(
    "playing a resumed summon grants no Consume XP or reactions (hidden flag: %s)",
    (hiddenConsume) => {
      const companion = cardById["wolf-companion"]!;
      const summon = withCardDescription(
        {
          ...companion,
          ...(hiddenConsume ? { consume: true } : {}),
          uid: 7,
          corrupted: true,
          effects: [...companion.effects, { kind: "heal", amount: 5 }],
        },
        [
          ...companion.description!.slice(0, -1),
          {
            role: "effect",
            parts: ["Restore ", cardMagnitude({ kind: "heal", effectIndex: 1, field: "amount" }), " Health"],
          },
          companion.description!.at(-1)!,
        ],
      );
      const battleState = makeTestBattleState({
        hand: [summon],
        deck: [cardById.slash!],
        playerHealth: 10,
        mana: 3,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { ...makeTestBattleState().enemyStatuses, burn: 4, poison: 4 },
      });
      const input = makeMinimalActiveRunInput({
        runDeck: [summon],
        runPlayerHealth: 10,
        runTalentXP: { consume: 7, companion: 3 },
        activity: savedActivityFixture("battle", { battleState }),
      });
      const loaded = evaluateSaveCandidates([
        JSON.stringify({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION, activeRun: input }),
      ]);
      restoreRun(loaded.data.activeRun, {}, {}, defaultGameSession);
      const restored = readBattle(defaultGameSession).battleState;
      expect(getCardKeywords(restored.hand[0]!)).not.toContain("consume");

      // Make every Consume reward deterministic so a missed trigger cannot hide behind RNG.
      setRunSession({
        activity: {
          kind: "battle",
          data: {
            battleState: {
              ...restored,
              currentEnemy: {
                ...restored.currentEnemy,
                traits: [{ id: "insatiable", title: "Insatiable", description: "" }],
              },
              talentEffects: {
                ...restored.talentEffects,
                consumeHealMultiplier: 1,
                healOnConsume: 9,
                drawOnConsume: 1,
                drawOnConsumeChance: 100,
                forgeOnConsume: 9,
                forgeOnConsumeChance: 100,
                goldOnConsume: 9,
                goldOnConsumeChance: 100,
                consumeDetonatesBurnChance: 100,
              },
              gearEffects: {
                ...restored.gearEffects,
                armorOnConsume: 9,
                manaOnPaidConsume: 1,
                poisonTickOnConsume: 1,
                drawOnLastHandConsume: 1,
              },
              trinketEffects: { ...restored.trinketEffects, runicQuillDrawOnConsume: 1 },
            },
          },
        },
      });
      expect(
        commitCardPlay(readBattle(defaultGameSession).battleState, 0, summon.id, defaultGameSession),
      ).not.toBeNull();
      const after = readBattle(defaultGameSession).battleState;
      expect(after.activeCompanion?.id).toBe("wolf");
      expect(after).toMatchObject({
        mana: 2,
        playerHealth: 15,
        gold: restored.gold,
        enemyHealth: 100,
        enemyPhysicalDamageBonus: 0,
      });
      expect(after.playerStatuses).toMatchObject({ armor: 0, forge: 0 });
      expect(after.enemyStatuses).toMatchObject({ burn: 4, poison: 4 });
      expect(after.hand).toHaveLength(0);
      expect(after.deck).toEqual(restored.deck);
      expect(after.discard).toHaveLength(0);
      expect(after.exhausted).toHaveLength(1);
      expect(readActiveRun(defaultGameSession).runTalentXP).toMatchObject({ consume: 7, companion: 4 });

      const savedAgain = makeMinimalActiveRunInput({
        runDeck: readActiveRun(defaultGameSession).runDeck,
        runPlayerHealth: after.playerHealth,
        runTalentXP: readActiveRun(defaultGameSession).runTalentXP,
        activity: savedActivityFixture("battle", { battleState: after }),
      });
      const reloaded = evaluateSaveCandidates([
        JSON.stringify({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION, activeRun: savedAgain }),
      ]);
      restoreRun(reloaded.data.activeRun, {}, {}, defaultGameSession);
      const resumed = readBattle(defaultGameSession).battleState;
      expect(resumed.exhausted).toEqual(after.exhausted);
      expect(getCardKeywords(resumed.exhausted[0]!)).not.toContain("consume");
      expect(resumed.hand).toHaveLength(0);
      expect(readActiveRun(defaultGameSession).runTalentXP).toMatchObject({ consume: 7, companion: 4 });
    },
  );

  it("restores modified summons and current Talents without replaying rewards", () => {
    const summon = { ...cardById["wolf-companion"]!, consume: true, cost: 0, uid: 7 };
    const battleState = makeTestBattleState({
      hand: [summon],
      exhausted: [{ ...summon, uid: 8 }],
      mana: 2,
      playerStatuses: { ...makeTestBattleState().playerStatuses, armor: 9, forge: 4 },
    });
    const activeRun = makeMinimalActiveRunInput({
      runDeck: [summon],
      activity: savedActivityFixture("battle", { battleState }),
    });
    const loaded = evaluateSaveCandidates([
      JSON.stringify({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION, activeRun }),
    ]);
    restoreRun(
      loaded.data.activeRun,
      {},
      {
        armor: ["armor-block-burst"],
        consume: ["consume-second-helping", "consume-last-supper", "consume-leftovers"],
        wish: ["wish-mana"],
        leech: ["leech-first-double", "leech-bleed-chance"],
      },
      defaultGameSession,
    );
    const restored = readBattle(defaultGameSession).battleState;
    expect(restored).not.toBeNull();
    expect(restored!.hand).toEqual([{ ...cardById["wolf-companion"]!, cost: 0, uid: 7 }]);
    expect(restored!.exhausted).toEqual([{ ...cardById["wolf-companion"]!, cost: 0, uid: 8 }]);
    expect(restored!.playerStatuses).toMatchObject({ armor: 9, forge: 4 });
    expect(restored!.mana).toBe(2);
    expect(restored!.talentEffects).toMatchObject({
      armorOnBlockCard: 6,
      armorOnBlockCardChance: 10,
      drawOnConsume: 1,
      drawOnConsumeChance: 10,
      forgeOnConsume: 1,
      forgeOnConsumeChance: 10,
      goldOnConsume: 4,
      goldOnConsumeChance: 10,
      wishCardRefundsMana: true,
      leechHealingBonus: 1,
      leechCleanseChance: 10,
    });
  });

  it.each(["opening-draw", "enemy-turn"] as const)(
    "restores card content in every pile and pending %s result",
    (kind) => {
      const card = cardById["molten-bulwark"]!;
      const damaged = {
        ...card,
        uid: 1,
        effects: [{ kind: "heal", amount: 9 }, { kind: "invalid" }],
        descriptionLines: ["Restore 9 Health", "Unknown action"],
        corrupted: true,
      };
      const healthy = withCardDescription(
        {
          ...card,
          uid: 2,
          cost: 0,
          effects: [{ kind: "heal", amount: 9 }],
          descriptionLines: ["Restore 9 Health"],
          corrupted: true,
        },
        [
          {
            role: "effect",
            parts: [
              "Restore ",
              cardMagnitude({ kind: "heal", effectIndex: 0, field: "amount" }, { corrupted: true }),
              " Health",
            ],
          },
        ],
      );
      const cards = [damaged, healthy];
      const battleState = {
        ...makeTestBattleState(),
        deck: cards.map((entry, index) => ({ ...entry, uid: index + 3 })),
        hand: cards,
        discard: cards.map((entry, index) => ({ ...entry, uid: index + 5 })),
        exhausted: cards.map((entry, index) => ({ ...entry, uid: index + 7 })),
        wishOptions: cards,
        wishQueue: [cards],
      };
      const activeRun = makeMinimalActiveRunInput({
        runDeck: cards,
        activity: savedActivityFixture("battle", {
          battleState,
          pendingBattleTransition: { kind, resultState: battleState, playerTurnSkipped: false },
        }),
      });
      const loaded = evaluateSaveCandidates([
        JSON.stringify({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION, activeRun }),
      ]);
      expect(loaded.status.kind).toBe("ok");
      const reloaded = evaluateSaveCandidates([JSON.stringify(loaded.data)]);
      expect(reloaded.data.activeRun).not.toBeNull();
      if (!reloaded.data.activeRun) throw new Error("Expected restored active run");
      restoreRun(reloaded.data.activeRun, {}, {}, defaultGameSession);
      const restored = readBattle(defaultGameSession);
      const expected = [{ ...card, uid: 1 }, healthy];
      for (const state of [restored.battleState]) {
        expect(state.deck).toEqual(expected.map((entry, index) => ({ ...entry, uid: index + 3 })));
        expect(state.hand).toEqual(expected);
        expect(state.discard).toEqual(expected.map((entry, index) => ({ ...entry, uid: index + 5 })));
        expect(state.exhausted).toEqual(expected.map((entry, index) => ({ ...entry, uid: index + 7 })));
        expect(state.wishOptions).toEqual(expected);
        expect(state.wishQueue).toEqual([expected]);
      }
    },
  );
});

describe("run restore shop offering repair", () => {
  beforeEach(() => {
    resetAllTestStores();
    resetGearForTest();
  });

  it("strips owned trinkets from a restored Trinket Shop and remaps purchased keys", () => {
    mutateGearForTest((gear) => gear.addTrinket(ownedTrinket.id));

    restoreRun(
      makeActiveRunData({
        activity: savedActivityFixture("trinket-shop", {
          trinketIds: [ownedTrinket.id, otherTrinket.id],
          refreshesLeft: 1,
          freeRefreshUsed: false,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [shopItemSlotKey(otherTrinket.id, 1)],
        }),
      }),
      {},
      {},
      defaultGameSession,
    );

    const shop = readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop");
    expect(shop.trinkets.map((entry) => entry.id)).toEqual([otherTrinket.id]);
    expect(shop.purchasedSlotKeys).toEqual([shopItemSlotKey(otherTrinket.id, 0)]);
    expect(readActiveRunScreen(defaultGameSession)).toBe("trinket-shop");
  });

  it("leaves an exhausted restored Trinket Shop as a sold-out shelf with zero refreshes", () => {
    mutateGearForTest((gear) => {
      for (const trinket of trinketLibrary) {
        gear.addTrinket(trinket.id);
      }
    });

    restoreRun(
      makeActiveRunData({
        activity: savedActivityFixture("trinket-shop", {
          trinketIds: [ownedTrinket.id, otherTrinket.id],
          refreshesLeft: 1,
          freeRefreshUsed: false,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [shopItemSlotKey(ownedTrinket.id, 0)],
        }),
      }),
      {},
      {},
      defaultGameSession,
    );

    const shop = readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop");
    expect(shop.trinkets).toEqual([]);
    expect(shop.purchasedSlotKeys).toEqual([]);
    expect(shop.refreshesLeft).toBe(0);
    expect(readActiveRunScreen(defaultGameSession)).toBe("trinket-shop");
  });

  it("strips owned unique gear from a restored Gear Shop", () => {
    const ownedUnique = { instanceId: "owned-wardbreaker", definitionId: "wardbreaker", affixes: [] };
    const shelfUnique = { instanceId: "shelf-wardbreaker", definitionId: "wardbreaker", affixes: [] };
    const shelfBasic = { instanceId: "shelf-basic", definitionId: "leather-armor-basic", affixes: [] };
    mutateGearForTest((gear) => gear.addInstance(ownedUnique, "knight"));

    restoreRun(
      makeActiveRunData({
        characterId: "knight",
        activity: savedActivityFixture("equipment-shop", {
          gear: [shelfUnique, shelfBasic],
          refreshesLeft: 1,
          freeRefreshUsed: false,
          firstPurchaseUsed: true,
          purchasedSlotKeys: ["shelf-basic", "shelf-wardbreaker"],
        }),
      }),
      {},
      {},
      defaultGameSession,
    );

    const shop = readActivityData(readRunSession(defaultGameSession).activity, "equipment-shop");
    expect(shop.gear.map((item) => item.instanceId)).toEqual(["shelf-basic"]);
    expect(shop.purchasedSlotKeys).toEqual(["shelf-basic"]);
  });
});
