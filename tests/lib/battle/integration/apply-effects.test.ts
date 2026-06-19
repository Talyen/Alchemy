import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";

vi.spyOn(Math, "random").mockReturnValue(0.99);
import { applyCardEffects, defaultTalentEffects } from "@/lib/battle";
import { type CombatTextEvent } from "@/lib/battle/types";

describe("applyCardEffects — perManaCrystal scaling", () => {
  it("perManaCrystal with 0 amount yields 0 block", () => {
    const state = makeState({ mana: 10, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 0 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("perManaCrystal scales with maxMana", () => {
    const state = makeState({ mana: 10, maxMana: 5 });
    const card = makeCard({ effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 3 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // perManaCrystal: 3 * maxMana(5) = 15 block
    expect(result.playerStatuses.block).toBe(15);
  });

  it("perManaCrystal with minimal maxMana (floor=1)", () => {
    const state = makeState({ mana: 10, maxMana: 1 });
    const card = makeCard({ effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 4 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // perManaCrystal: 4 * 1 = 4 block
    expect(result.playerStatuses.block).toBe(4);
  });
});

describe("applyCardEffects — empty and zero-edge effects", () => {
  it("card with no effects does nothing", () => {
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const card = makeCard({ effects: [] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });

  it("heal with 0 amount does not change health", () => {
    const state = makeState({ playerHealth: 20 });
    const card = makeCard({ effects: [{ kind: "heal", amount: 0 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(20);
  });

  it("gain-gold with 0 amount does not change gold", () => {
    const state = makeState({ gold: 5 });
    const card = makeCard({ effects: [{ kind: "gain-gold", amount: 0 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(5);
  });

  it("draw-cards with 0 amount does nothing", () => {
    const state = makeState({ deck: [makeCard({ id: "d1" })], hand: [] });
    const card = makeCard({ effects: [{ kind: "draw-cards", amount: 0 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.hand).toHaveLength(0);
    expect(result.deck).toHaveLength(1);
  });
});

describe("applyCardEffects — effect ordering", () => {
  it("heal then damage: both applied in order", () => {
    const state = makeState({ mana: 10, playerHealth: 15, enemyHealth: 30 });
    const card = makeCard({
      effects: [
        { kind: "heal", amount: 5 },
        { kind: "damage", damageType: "physical", amount: 10 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // heal 5 → health 20, then damage 10 → enemy health 20
    expect(result.playerHealth).toBe(20);
    expect(result.enemyHealth).toBe(20);
  });

  it("restore mana then lose mana produces correct net", () => {
    const state = makeState({ mana: 3, maxMana: 4 });
    const card = makeCard({
      effects: [
        { kind: "restore-mana", amount: 3 },
        { kind: "lose-mana", amount: 2 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // restore: 3→6, lose: 6→4
    expect(result.mana).toBe(4);
  });
});

describe("applyCardEffects — potion potency", () => {
  it("potion potency multiplier of 0 makes heal do nothing", () => {
    const state = makeState({ playerHealth: 15, talentEffects: { ...defaultTalentEffects, potionPotency: 0 } });
    const card = makeCard({ id: "heal-potion", effects: [{ kind: "heal", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // potionPotency=0 → 10*0 = 0 heal → no change
    expect(result.playerHealth).toBe(15);
  });
});

describe("applyCardEffects — overheal conversion to block", () => {
  it("healing above max health converts excess to block when talent is active", () => {
    const state = makeState({
      playerHealth: 28,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, overhealToBlockRatio: 0.5 },
    });
    const card = makeCard({ effects: [{ kind: "heal", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // heal 5: 28→30 (capped at max), 3 overheal * 0.5 = 1.5 → round(1.5) = 2 block
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(2);
  });
});

describe("applyCardEffects — self-damage with zero amount", () => {
  it("self-damage with 0 amount does nothing", () => {
    const state = makeState({
      playerHealth: 20,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeCard({ effects: [{ kind: "self-damage", damageType: "burn", amount: 0 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(20);
    expect(result.playerStatuses.burn).toBe(0);
  });
});

describe("applyCardEffects — all mana effects in one card", () => {
  it("gain-max-mana, restore-mana, lose-max-mana, lose-mana in sequence", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeCard({
      effects: [
        { kind: "gain-max-mana", amount: 2 },
        { kind: "restore-mana", amount: 3 },
        { kind: "lose-max-mana", amount: 1 },
        { kind: "lose-mana", amount: 1 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // start: mana=4, max=4
    // gain-max 2: mana=4+2=6, max=4+2=6
    // restore 3: mana=6+3=9, max=6
    // lose-max 1: max=5, mana=min(5,9)=5
    // lose-mana 1: mana=max(0,5-1)=4
    expect(result.mana).toBe(4);
    expect(result.maxMana).toBe(5);
  });
});
