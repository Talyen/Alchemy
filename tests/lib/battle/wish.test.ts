import { describe, expect, it } from "vitest";
import {
  applyEmergencyWish,
  buildWishOptions,
  applyWishEffect,
  chooseWishCard,
  upgradeWishCard,
} from "@/lib/battle/wish";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { SIMPLE_HANDLERS } from "@/lib/battle/effect-handlers/simple-handlers";
import type { CombatTextEvent } from "@/lib/battle/types";
import { seededRng } from "../../fixtures/rng";
import { patchBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { cardById, BattleCardEffectSchema } from "@/lib/game-data";

describe("buildWishOptions", () => {
  it("returns shuffled options excluding the triggering card", () => {
    const card = makeTestCard({
      id: "strike",
      title: "Strike",
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 4 }],
    });
    const state = patchBattleState();
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.id !== "strike")).toBe(true);
    expect(options.every((o) => o.id && o.title)).toBe(true);
  });

  it("returns only undiscovered cards when wishUndiscoveredCards is active", () => {
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const state = patchBattleState({
      talentEffects: { wishUndiscoveredCards: true },
      discoveredCardIds: ["strike", "bash", "block"],
      rng: () => 0.99,
    });
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
    expect(options.every((o) => !["strike", "bash", "block"].includes(o.id))).toBe(true);
  });

  it("draws distinct Companion summon options from the seeded Wish pool", () => {
    const source = makeTestCard({ id: "pack-tactics", title: "Pack Tactics" });
    const first = buildWishOptions(
      patchBattleState({ deck: [cardById["wolf-companion"]!], rng: seededRng(7) }),
      source,
      true,
    );
    const second = buildWishOptions(
      patchBattleState({ deck: [cardById["wolf-companion"]!], rng: seededRng(7) }),
      source,
      true,
    );
    expect(first.map((card) => card.id)).toEqual(second.map((card) => card.id));
    expect(first).toHaveLength(3);
    expect(new Set(first.map((card) => card.id)).size).toBe(3);
    expect(first.every((card) => card.effects.some((effect) => effect.kind === "summon-companion"))).toBe(true);
  });

  it("falls back to all cards when not enough undiscovered exist", () => {
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const state = patchBattleState({
      talentEffects: { wishUndiscoveredCards: true },
      discoveredCardIds: (() => {
        const ids = [];
        for (let i = 0; i < 200; i++) ids.push(`card-${i}`);
        return ids;
      })(),
    });
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
  });
});

describe("applyWishEffect", () => {
  it("returns same state when wish amount is 0", () => {
    const state = patchBattleState();
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 0, texts);
    expect(result).toBe(state);
  });

  it("returns same state when wish amount is negative", () => {
    const state = patchBattleState();
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, -1, texts);
    expect(result).toBe(state);
  });

  it("sets wishOptions when no existing wish is active", () => {
    const state = patchBattleState({ wishOptions: null, wishQueue: [] });
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishOptions).toHaveLength(3);
  });

  it("queues extra wishes when an existing wish is active", () => {
    const initialOptions = [makeTestCard({ id: "card-1", title: "Card 1" })];
    const state = patchBattleState({ wishOptions: initialOptions, wishQueue: [] });
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.wishOptions).toBe(initialOptions);
    expect(result.wishQueue).toHaveLength(1);
  });

  it.each<{
    name: string;
    talentGoldOnWish?: number;
    trinketWishingWellGoldOnWish?: number;
    gearGoldGainPercent?: number;
    wishes: number;
    expectedGold: number;
    expectedGoldTextAmount?: number;
  }>([
    {
      name: "awards goldOnWish per wish count",
      talentGoldOnWish: 5,
      wishes: 2,
      expectedGold: 10,
      expectedGoldTextAmount: 10,
    },
    {
      name: "awards goldOnWish per wish",
      talentGoldOnWish: 3,
      wishes: 1,
      expectedGold: 3,
    },
    {
      name: "awards wishingWellGoldOnWish per wish",
      trinketWishingWellGoldOnWish: 7,
      wishes: 1,
      expectedGold: 7,
    },
    {
      name: "scales wishingWellGoldOnWish combat text with goldGainPercent",
      trinketWishingWellGoldOnWish: 7,
      gearGoldGainPercent: 50,
      wishes: 1,
      expectedGold: 11,
      expectedGoldTextAmount: 11,
    },
  ])(
    "$name",
    ({
      talentGoldOnWish,
      trinketWishingWellGoldOnWish,
      gearGoldGainPercent,
      wishes,
      expectedGold,
      expectedGoldTextAmount,
    }) => {
      const base = patchBattleState();
      const state = patchBattleState({
        ...(talentGoldOnWish !== undefined
          ? { talentEffects: { ...base.talentEffects, goldOnWish: talentGoldOnWish } }
          : {}),
        ...(trinketWishingWellGoldOnWish !== undefined
          ? { trinketEffects: { ...base.trinketEffects, wishingWellGoldOnWish: trinketWishingWellGoldOnWish } }
          : {}),
        ...(gearGoldGainPercent !== undefined
          ? { gearEffects: { ...base.gearEffects, goldGainPercent: gearGoldGainPercent } }
          : {}),
      });
      const card = makeTestCard({ id: "strike", title: "Strike" });
      const texts: CombatTextEvent[] = [];
      const result = applyWishEffect(state, card, wishes, texts);
      expect(result.gold).toBe(expectedGold);
      if (expectedGoldTextAmount !== undefined) {
        expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: expectedGoldTextAmount }]);
      }
    },
  );

  it("heals player with healthOnWish per wish", () => {
    const state = patchBattleState({
      playerHealth: 20,
      talentEffects: { healthOnWish: 4 },
    });
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.playerHealth).toBe(24);
  });

  it("removes harmful status with removeHarmfulStatusOnWish", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 5, poison: 3 },
      talentEffects: { removeHarmfulStatusOnWish: true },
    });
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(3);
  });

  it("combines multiple gold bonuses from same wish", () => {
    const state = patchBattleState({
      talentEffects: {
        goldOnWish: 8,
      },
      trinketEffects: { wishingWellGoldOnWish: 2 },
    });
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(10);
  });

  it("applies per-wish effects for each wish count", () => {
    const state = patchBattleState({
      playerHealth: 20,
      talentEffects: { healthOnWish: 3, goldOnWish: 2 },
    });
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 3, texts);
    expect(result.playerHealth).toBe(29);
    expect(result.gold).toBe(6);
  });
});

describe("applyEmergencyWish", () => {
  it("opens the normal Wish choices and applies normal Wish rewards", () => {
    const state = patchBattleState({
      deck: [],
      hand: [],
      discard: [],
      talentEffects: { goldOnWish: 4 },
    });
    const result = applyEmergencyWish(state, []);

    expect(result.wishOptions).toHaveLength(3);
    expect(result.gold).toBe(4);
  });

  it("can trigger again after the chosen emergency card is exhausted", () => {
    const initial = applyEmergencyWish(
      patchBattleState({ deck: [], hand: [], discard: [], wishOptions: null, wishQueue: [] }),
    );
    const chosen = initial.wishOptions?.[0];
    expect(chosen).toBeDefined();
    const afterChoice = chooseWishCard(initial, chosen!.id);
    const exhausted = {
      ...afterChoice,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [...afterChoice.exhausted, chosen!],
      wishOptions: null,
      wishQueue: [],
    };

    expect(applyEmergencyWish(exhausted).wishOptions).toHaveLength(3);
  });
});

describe("chooseWishCard", () => {
  it("assigns unique uid when card is added to hand", () => {
    const card = makeTestCard({ id: "chosen-card", title: "Chosen" });
    const state = patchBattleState({
      wishOptions: [card],
      wishQueue: [],
      nextCardUid: 42,
      hand: [],
    });
    const result = chooseWishCard(state, "chosen-card");
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].uid).toBe(42);
    expect(result.nextCardUid).toBe(43);
  });

  it("reserves a chosen card with a unique uid when the hand is full", () => {
    const card = makeTestCard({ id: "chosen-card", title: "Chosen" });
    const fullHand = Array.from({ length: MAX_HAND_SIZE }, (_, i) =>
      makeTestCard({ id: `c-${i}`, title: `Card ${i}` }),
    );
    const state = patchBattleState({
      wishOptions: [card],
      wishQueue: [],
      nextCardUid: 100,
      hand: fullHand,
      discard: [],
    });
    const result = chooseWishCard(state, "chosen-card");
    expect(result.discard).toHaveLength(0);
    expect(result.pendingHandCards).toHaveLength(1);
    expect(result.pendingHandCards[0].uid).toBe(100);
    expect(result.nextCardUid).toBe(101);
  });

  it("returns state unchanged when chosen card is not in wishOptions", () => {
    const state = patchBattleState({
      wishOptions: [makeTestCard({ id: "card-a", title: "A" })],
      wishQueue: [],
      nextCardUid: 1,
    });
    const result = chooseWishCard(state, "non-existent-card");
    expect(result).toBe(state);
  });

  it("sets wishOptions to null when no queue and card selected", () => {
    const card = makeTestCard({ id: "only-card", title: "Only" });
    const state = patchBattleState({
      wishOptions: [card],
      wishQueue: [],
      hand: [],
    });
    const result = chooseWishCard(state, "only-card");
    expect(result.wishOptions).toBeNull();
    expect(result.wishQueue).toEqual([]);
  });
});

describe("new wish talents", () => {
  it("wishTrinketChoice can fail or grant either Forge or Armor", () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const state = patchBattleState({
        talentEffects: { wishTrinketChoice: true },
        rng: seededRng(seed),
      });
      const result = applyWishEffect(state, makeTestCard(), 1, []);
      outcomes.add(`${result.playerStatuses.forge}:${result.playerStatuses.armor}`);
    }
    expect(outcomes).toEqual(new Set(["0:0", "1:0", "0:1"]));
  });

  it("wishBlockBelowHealthPct grants 6 block below 30% health threshold", () => {
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const stateBelow = patchBattleState({
      playerHealth: 8,
      playerMaxHealth: 30,
      playerStatuses: { block: 0 },
      talentEffects: { wishBlockBelowHealthPct: 30, wishBlockAmount: 6 },
    });
    const stateAbove = patchBattleState({
      playerHealth: 15,
      playerMaxHealth: 30,
      playerStatuses: { block: 0 },
      talentEffects: { wishBlockBelowHealthPct: 30, wishBlockAmount: 6 },
    });

    const resultBelow = applyWishEffect(stateBelow, card, 1, []);
    expect(resultBelow.playerStatuses.block).toBe(6);

    const resultAbove = applyWishEffect(stateAbove, card, 1, []);
    expect(resultAbove.playerStatuses.block).toBe(0);
  });

  it("wishCardsUpgraded upgrades card numeric values by 1", () => {
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const state = patchBattleState({
      talentEffects: { wishCardsUpgraded: true },
    });
    const options = buildWishOptions(state, card);

    options.forEach((o) => {
      const original = patchBattleState().deck.find((d) => d.id === o.id);
      if (original) {
        o.effects.forEach((eff, idx) => {
          if ("amount" in eff && eff.amount !== undefined) {
            const origEff = original.effects[idx];
            if (origEff && "amount" in origEff && origEff.amount !== undefined) {
              expect(eff.amount).toBe(origEff.amount + 1);
            }
          }
        });
      }
    });
  });

  it("Wish gear grants Mana only from zero and triggers Arcane Mending", () => {
    const state = patchBattleState({
      mana: 0,
      maxMana: 4,
      playerHealth: 10,
      gearEffects: { manaOnWish: 2 },
      talentEffects: { healthPerMana: 1, wishCardRefundsMana: true },
    });
    const next = applyWishEffect(state, makeTestCard(), 2, []);
    expect(next.mana).toBe(2);
    expect(next.playerHealth).toBe(12);
    expect(applyWishEffect({ ...state, mana: 4 }, makeTestCard(), 1, []).mana).toBe(4);
  });

  it("wishBurnTrigger applies burn damage on wish", () => {
    const card = makeTestCard({ id: "strike", title: "Strike" });
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      talentEffects: { burnOnWish: 3 },
    });
    const result = applyWishEffect(state, card, 1, []);
    expect(result.enemyHealth).toBe(27);
  });

  it.each([0, 0.4, 1, 2])(
    "scaled empty draws only grants an emergency Wish for a positive resolved draw at multiplier %s",
    (multiplier) => {
      const state = patchBattleState({ deck: [], discard: [], hand: [] });
      const next = SIMPLE_HANDLERS["random-draw"](
        state,
        makeTestCard(),
        { kind: "random-draw", minAmount: 1, maxAmount: 1 },
        multiplier,
        [],
      );
      if (Math.round(multiplier) > 0) {
        expect(next.wishOptions?.length).toBeGreaterThan(0);
        expect(next.wishQueue).toEqual([]);
      } else {
        expect(next.wishOptions).toBeNull();
        expect(next.wishQueue).toEqual([]);
      }
    },
  );

  it("Powerful Wish upgrades Tithe's fixed damage and Gold values", () => {
    const tithe = upgradeWishCard(cardById.tithe!);
    expect(tithe.descriptionLines).toEqual(["Deal 3 Holy damage", "Gain 2 Gold"]);
    expect(tithe.effects).toEqual([
      { kind: "damage", damageType: "holy", amount: 3 },
      { kind: "gain-gold", amount: 2 },
    ]);
    expect(tithe.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success)).toBe(true);
    const played = playBattleCardResolved(
      patchBattleState({ hand: [tithe], gold: 100, enemyHealth: 100, enemyMaxHealth: 100, rng: () => 0.99 }),
      tithe.id,
      0,
    ).state;
    expect(played.enemyHealth).toBe(97);
    expect(played.gold).toBe(102);
  });

  it("Wishfire adds Burn buildup and applies Melting Point to its Burn hit", () => {
    const state = patchBattleState({
      enemyStatuses: { burn: 1 },
      enemyMitigation: { armor: 10 },
      gearEffects: { burnOnWish: 2 },
      talentEffects: { burnRemovesEnemyArmor: true },
    });
    const next = applyWishEffect(state, undefined, 1, []);
    expect(next.enemyHealth).toBe(state.enemyHealth - 2);
    expect(next.enemyStatuses.burn).toBe(3);
    expect(next.enemyMitigation.armor).toBe(7);
  });

  it("Vital Wish cannot cancel Desperate Wish earned below half Health", () => {
    const state = patchBattleState({
      playerHealth: 19,
      playerMaxHealth: 40,
      talentEffects: { healthOnWish: 1, wishBlockBelowHealthPct: 50, wishBlockAmount: 2 },
    });
    const result = applyWishEffect(state, cardById.wish!, 1, []);
    expect(result.playerHealth).toBe(20);
    expect(result.playerStatuses.block).toBe(2);
  });

  it("a fatal Wish retaliation stops rewards from subsequent Wishes", () => {
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 40,
      deathsDoorUsed: true,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { burnOnWish: 1, goldOnWish: 1 },
      rng: () => 0.99,
    });
    const result = applyCardEffects(state, makeTestCard({ effects: [{ kind: "wish", amount: 2 }] }), []);
    expect(result.playerHealth).toBe(0);
    expect(result.gold).toBe(state.gold + 1);
    expect(result.enemyHealth).toBe(state.enemyHealth - 1);
    expect(result.flags.pendingCinderSkinReaction).toBe(false);
  });

  it.each(["stun", "bleed"] as const)("opens an Emergency Wish after an empty %s reward draw", (damageType) => {
    const card = damageType === "stun" ? cardById.bash! : cardById["predators-focus"]!;
    const state = patchBattleState({
      hand: [card],
      deck: [],
      discard: [],
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { stun: damageType === "stun" ? 9 : 0 },
      talentEffects: {
        drawOnStun: damageType === "stun" ? 1 : 0,
        drawOnBleedDamageChance: damageType === "bleed" ? 10 : 0,
      },
      rng: () => 0.09,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    if (damageType === "stun") expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(result.wishOptions?.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("onEmptyDraw");
  });
});
