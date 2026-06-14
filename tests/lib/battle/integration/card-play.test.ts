import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";
import { defaultTalentEffects } from "@/lib/battle";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { computeBoonManifest, defaultBoonEffects } from "@/lib/boons";

vi.spyOn(Math, "random").mockReturnValue(0.99);

describe("playBattleCardResolved — first-card-free", () => {
  it("firstPhysicalCardFree makes first physical card cost 0", () => {
    const card = makeCard({
      id: "slash",
      cost: 2,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({
      mana: 4,
      hand: [card],
      talentEffects: { ...defaultTalentEffects, firstPhysicalCardFree: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.mana).toBe(4);
    expect(result.state.flags.firstPhysicalCardFreeUsed).toBe(true);
  });

  it("first-card-free flag is consumed once and not re-used", () => {
    const card1 = makeCard({
      id: "slash1",
      cost: 2,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const card2 = makeCard({
      id: "slash2",
      cost: 2,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({
      mana: 4,
      hand: [card1, card2],
      talentEffects: { ...defaultTalentEffects, firstPhysicalCardFree: true },
    });
    const first = playBattleCardResolved(state, "slash1", 0);
    // first card free → mana still 4
    expect(first.state.mana).toBe(4);
    expect(first.state.flags.firstPhysicalCardFreeUsed).toBe(true);

    const second = playBattleCardResolved(first.state, "slash2", 0);
    // second card costs 2 → mana 2
    expect(second.state.mana).toBe(2);
  });

  it("firstPhysicalCardFree does not apply to non-physical cards", () => {
    const card = makeCard({
      id: "fire",
      cost: 2,
      effects: [{ kind: "damage", damageType: "burn", amount: 5 }],
    });
    const state = makeState({
      mana: 4,
      hand: [card],
      talentEffects: { ...defaultTalentEffects, firstPhysicalCardFree: true },
    });
    const result = playBattleCardResolved(state, "fire", 0);
    // not physical → no free, costs 2 → mana 2
    expect(result.state.mana).toBe(2);
  });
});

describe("playBattleCardResolved — Mortar and Pestle free potion", () => {
  it("first potion costs 0 with mortar and pestle boon", () => {
    const card = makeCard({
      id: "heal-potion",
      cost: 2,
      effects: [{ kind: "heal", amount: 5 }],
    });
    const manifest = computeBoonManifest(["mortar-and-pestle"]);
    const state = makeState({
      mana: 4,
      hand: [card],
      boonEffects: manifest,
    });
    const result = playBattleCardResolved(state, "heal-potion", 0);
    expect(result.state.mana).toBe(4);
    expect(result.state.flags.firstPotionFreeUsed).toBe(true);
  });

  it("non-potion card is not free even with mortar and pestle", () => {
    const card = makeCard({
      id: "slash",
      cost: 2,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const manifest = computeBoonManifest(["mortar-and-pestle"]);
    const state = makeState({
      mana: 4,
      hand: [card],
      boonEffects: manifest,
    });
    const result = playBattleCardResolved(state, "slash", 0);
    // not a potion (doesn't end with POTION_CARD_ID_SUFFIX) → costs 2 → mana 2
    expect(result.state.mana).toBe(2);
  });
});

describe("playBattleCardResolved — consume double burn damage", () => {
  it("boosts burn damage by 20% when consume card is played with Combustible talent", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card = makeCard({
      id: "combust",
      cost: 1,
      consume: true,
      effects: [{ kind: "damage", damageType: "burn", amount: 5 }],
    });
    const state = makeState({
      mana: 10,
      hand: [card],
      enemyHealth: 30,
      talentEffects: { ...defaultTalentEffects, consumeBurnDamageBonusPercent: 20, flatBurnDamage: 0 },
    });
    const result = playBattleCardResolved(state, "combust", 0);
    // burn 5 * 1.2 = 6 total dmg → health 24
    expect(result.state.enemyHealth).toBe(24);
    expect(result.state.exhausted).toHaveLength(1);
    expect(result.state.exhausted[0].id).toBe("combust");
  });
});

describe("playBattleCardResolved — runic quill draw on consume", () => {
  it("draws a card when consume card is played with runic quill boon", () => {
    const card = makeCard({
      id: "consumable",
      cost: 1,
      consume: true,
      effects: [],
    });
    const state = makeState({
      mana: 10,
      hand: [card],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" })],
      boonEffects: { ...defaultBoonEffects, runicQuillDrawOnConsume: 1 },
    });
    const result = playBattleCardResolved(state, "consumable", 0);
    expect(result.state.hand).toHaveLength(1);
    expect(result.state.flags.runicQuillUsedThisTurn).toBe(true);
  });

  it("runic quill only triggers once per turn (second consume does not draw)", () => {
    const card1 = makeCard({ id: "c1", cost: 1, consume: true, effects: [] });
    const state = makeState({
      mana: 10,
      hand: [card1],
      deck: [makeCard({ id: "d1" })],
      boonEffects: { ...defaultBoonEffects, runicQuillDrawOnConsume: 1 },
    });
    const first = playBattleCardResolved(state, "c1", 0);
    expect(first.state.flags.runicQuillUsedThisTurn).toBe(true);
    // drew 1, consumed 1 → hand still has 1
    expect(first.state.hand).toHaveLength(1);

    // second play on the same state with another consume card
    const card2 = makeCard({ id: "c2", cost: 1, consume: true, effects: [] });
    const state2 = makeState({
      mana: 10,
      hand: [card2],
      deck: [makeCard({ id: "d2" })],
      boonEffects: { ...defaultBoonEffects, runicQuillDrawOnConsume: 1 },
      flags: { ...first.state.flags },
    });
    const second = playBattleCardResolved(state2, "c2", 0);
    // quill should NOT fire again → hand 0
    expect(second.state.hand).toHaveLength(0);
  });
});

describe("playBattleCardResolved — nextCardCostReduction", () => {
  it("nextCardCostReduction reduces cost of next card", () => {
    const card = makeCard({
      id: "slash",
      cost: 3,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({
      mana: 4,
      hand: [card],
      flags: {
        firstPhysicalCardFreeUsed: false,
        firstHolyCardFreeUsed: false,
        firstBurnCardDoubledUsed: false,
        firstArmorCardDoubledUsed: false,
        firstPoisonCardFreeUsed: false,
        firstBleedCardFreeUsed: false,
        nextCardCostReduction: 2,
        goldOnFirstPoisonThisCombat: false,
        firstHolyDamageBonusUsed: false,
        firstBurnBoonDoubledUsed: false,
        firstHarmfulStatusPrevented: false,
        firstPotionFreeUsed: false,
        resonantChimeUsedThisTurn: false,
        runicQuillUsedThisTurn: false,
      },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    // cost 3 - 2 reduction = 1 → mana 4→3
    expect(result.state.mana).toBe(3);
    // nextCardCostReduction reset to 0 after play
    expect(result.state.flags.nextCardCostReduction).toBe(0);
  });
});

describe("playBattleCardResolved — play card with full hand", () => {
  it("playing a card that draws more with full hand respects MAX_HAND_SIZE", () => {
    const card = makeCard({
      id: "draw-more",
      cost: 1,
      effects: [{ kind: "draw-cards", amount: 2 }],
    });
    const hand = Array.from({ length: 7 }, (_, i) => makeCard({ id: `h${i}` }));
    const state = makeState({
      mana: 10,
      hand,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" })],
    });
    // replace card at index 0 with the draw-more card
    const modifiedHand = [card, ...hand.slice(1)];
    const modifiedState = { ...state, hand: modifiedHand };
    const result = playBattleCardResolved(modifiedState, "draw-more", 0);
    // played at index 0 → hand had 6 left + drawn (but cap at 7) → should be 6+1=7
    expect(result.state.hand.length).toBeLessThanOrEqual(7);
    expect(result.state.hand.length).toBe(7);
  });
});

describe("playBattleCardResolved — card not in hand", () => {
  it("returns unchanged state when cardId doesn't match hand[index]", () => {
    const state = makeState({
      mana: 4,
      hand: [makeCard({ id: "real-card", cost: 1 })],
    });
    const result = playBattleCardResolved(state, "wrong-card-id", 0);
    expect(result.state).toBe(state);
    expect(result.combatTexts).toEqual([]);
  });

  it("returns unchanged state when index is out of bounds", () => {
    const state = makeState({
      mana: 4,
      hand: [makeCard({ id: "card", cost: 1 })],
    });
    const result = playBattleCardResolved(state, "card", 5);
    expect(result.state).toBe(state);
    expect(result.combatTexts).toEqual([]);
  });
});

describe("playBattleCardResolved — cardsPlayedThisTurn tracking", () => {
  it("increments cardsPlayedThisTurn for each card played", () => {
    const card = makeCard({
      id: "c1",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
    const state = makeState({
      mana: 10,
      hand: [card],
      cardsPlayedThisTurn: 0,
    });
    const result = playBattleCardResolved(state, "c1", 0);
    expect(result.state.cardsPlayedThisTurn).toBe(1);
  });
});

describe("playBattleCardResolved — defensive guards", () => {
  it("prevents play when enemy health is exactly 0", () => {
    const card = makeCard({ id: "c1", cost: 1 });
    const state = makeState({ enemyHealth: 0, hand: [card] });
    const result = playBattleCardResolved(state, "c1", 0);
    expect(result.state).toBe(state);
  });

  it("allows play after enemy defeat when allowAfterEnemyDefeat is set", () => {
    const card = makeCard({
      id: "c1",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({ enemyHealth: 0, hand: [card], mana: 3 });
    const result = playBattleCardResolved(state, "c1", 0, { allowAfterEnemyDefeat: true });
    expect(result.state.hand.length).toBe(0);
    expect(result.state.discard).toHaveLength(1);
    expect(result.state.discard[0]?.id).toBe("c1");
    expect(result.state.mana).toBe(2);
  });

  it("moves killing blow card to discard when enemy dies", () => {
    const card = makeCard({
      id: "c1",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 999 }],
    });
    const state = makeState({ enemyHealth: 10, hand: [card], mana: 3 });
    const result = playBattleCardResolved(state, "c1", 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.hand.length).toBe(0);
    expect(result.state.discard).toHaveLength(1);
    expect(result.state.discard[0]?.id).toBe("c1");
  });

  it("prevents play when player is defeated", () => {
    const card = makeCard({ id: "c1", cost: 1 });
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      hand: [card],
    });
    const result = playBattleCardResolved(state, "c1", 0);
    expect(result.state).toBe(state);
  });
});

describe("canPlayCard — remove-harmful-status", () => {
  it("blocks cleanse cards when the player has no harmful statuses", () => {
    const card = makeCard({
      id: "cleanse",
      cost: 1,
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const state = makeState({ mana: 4, hand: [card] });
    expect(canPlayCard(state, card, 0)).toBe(false);
  });

  it("allows cleanse cards when the player has a harmful status", () => {
    const card = makeCard({
      id: "cauterize",
      cost: 1,
      effects: [
        { kind: "remove-harmful-status", amount: 2 },
        { kind: "self-damage", damageType: "burn", amount: 1 },
      ],
    });
    const state = makeState({
      mana: 4,
      hand: [card],
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 2, bleed: 0, freeze: 0, stun: 0 },
    });
    expect(canPlayCard(state, card, 0)).toBe(true);
  });

  it("allows mixed-purpose cleanse cards when the player has no harmful statuses", () => {
    const card = makeCard({
      id: "mixed-panacea-heal",
      cost: 1,
      effects: [
        { kind: "remove-harmful-status", amount: 1 },
        { kind: "heal", amount: 4 },
      ],
    });
    const state = makeState({ mana: 4, playerHealth: 20, hand: [card] });
    expect(canPlayCard(state, card, 0)).toBe(true);
  });

  it("blocks cleanse cards with only a self-damage cost when the player has no harmful statuses", () => {
    const card = makeCard({
      id: "cauterize",
      cost: 1,
      effects: [
        { kind: "remove-harmful-status", amount: 2 },
        { kind: "self-damage", damageType: "burn", amount: 1 },
      ],
    });
    const state = makeState({ mana: 4, hand: [card] });
    expect(canPlayCard(state, card, 0)).toBe(false);
  });

  it("playBattleCardResolved rejects cleanse-only cards with no harmful statuses", () => {
    const card = makeCard({
      id: "cleanse",
      cost: 1,
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const state = makeState({ mana: 4, hand: [card] });
    const result = playBattleCardResolved(state, "cleanse", 0);
    expect(result.state).toBe(state);
    expect(result.state.mana).toBe(4);
    expect(result.state.hand).toHaveLength(1);
  });
});
