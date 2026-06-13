import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/apply-effects";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { defaultBattleState } from "@/lib/battle";
import type { CombatTextEvent } from "@/lib/battle/types";
import { applyPlayerCombatDamage, isPlayerDefeated } from "@/lib/battle/types";
import { computeTrinketManifest } from "@/lib/trinkets";
import { blockDeck, makeTestBattleState, makeTestCard, statusDeck } from "../../fixtures/battle";

function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ mana: 10, ...overrides });
}

describe("applyCardEffects", () => {
  it("applies damage to enemy health", () => {
    const state = makeState({ enemyHealth: 30 });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies player block status", () => {
    const state = makeState();
    const card = blockDeck(1)[0];
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("applies burn damage from status fixture deck", () => {
    const state = makeState({ enemyHealth: 30 });
    const card = statusDeck("burn", 7, 1)[0];
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(23);
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });

  it("heals the player", () => {
    const state = makeState({ playerHealth: 20 });
    const card = makeTestCard({ effects: [{ kind: "heal", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(25);
  });

  it("restores mana", () => {
    const state = makeState({ mana: 2 });
    const card = makeTestCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(4);
  });

  it("restore-mana can overflow maxMana", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeTestCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(6);
  });

  it("clamps current mana when max mana is reduced", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeTestCard({ effects: [{ kind: "lose-max-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.maxMana).toBe(2);
    expect(result.mana).toBe(2);
  });

  it("self-damage triggers Death's Door instead of defeat on first fatal hit", () => {
    const state = makeState({
      playerHealth: 1,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeTestCard({ effects: [{ kind: "self-damage", damageType: "bleed", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(isPlayerDefeated(result)).toBe(false);
  });

  it("handles consume cards via playBattleCardResolved", () => {
    const card = makeTestCard({
      id: "consumable",
      consume: true,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const stateWithHand = makeState({ hand: [card] });
    const result = playBattleCardResolved(stateWithHand, "consumable", 0);
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.exhausted).toHaveLength(1);
    expect(result.state.exhausted[0].id).toBe("consumable");
  });
});

describe("applyPlayerCombatDamage — phoenixFeather", () => {
  it("restores 30% max health and clears feather instead of dying", () => {
    const state = makeState({
      playerHealth: 5,
      playerMaxHealth: 30,
      playerStatuses: {
        block: 0,
        armor: 0,
        forge: 0,
        haste: 0,
        phoenixFeather: 1,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      },
    });
    const result = applyPlayerCombatDamage(state, 20);
    expect(result.playerHealth).toBe(9);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.deathsDoorUsed).toBe(false);
    expect(result.deathsDoorActive).toBe(false);
  });
});

describe("applyCardEffects — phoenix-feather card", () => {
  it("loses one mana crystal and grants phoenix feather status", () => {
    const state = makeState({ maxMana: 4, mana: 4 });
    const card = makeTestCard({
      id: "phoenix-feather",
      effects: [
        { kind: "lose-max-mana", amount: 1 },
        { kind: "player-status", status: "phoenixFeather", amount: 1 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.maxMana).toBe(3);
    expect(result.playerStatuses.phoenixFeather).toBe(1);
  });
});

describe("applyCardEffects — lose-mana", () => {
  it("reduces current mana, flooring at 0", () => {
    const state = makeState({ mana: 3 });
    const card = makeTestCard({ effects: [{ kind: "lose-mana", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "mana", amount: 5 });
  });
});

describe("applyCardEffects — gain-gold", () => {
  it("adds gold with potion potency multiplier", () => {
    const state = makeState({ gold: 10 });
    state.talentEffects.potionPotency = 1.5;
    const card = makeTestCard({ id: "luck-potion", effects: [{ kind: "gain-gold", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(25);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 15 });
  });
});

describe("applyCardEffects — remove-harmful-status", () => {
  it("removes harmful status types with potion potency", () => {
    const state = makeState({
      playerStatuses: { ...defaultBattleState().playerStatuses, burn: 5, poison: 3, bleed: 2 },
    });
    state.talentEffects.potionPotency = 2;
    const card = makeTestCard({ id: "panacea-potion", effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });
});

describe("applyCardEffects — unknown effect kind", () => {
  it("ignores unknown effect kinds (default case)", () => {
    const state = makeState({ mana: 3 });
    const card = makeTestCard({ effects: [{ kind: "unknown" as never, amount: 99 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });
});

describe("applyCardEffects — lose-health", () => {
  it("damages player without applying a status rider", () => {
    const state = makeState({
      playerHealth: 20,
      playerStatuses: { ...defaultBattleState().playerStatuses },
    });
    const card = makeTestCard({ effects: [{ kind: "lose-health", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(15);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "health", amount: 5 });
  });
});

describe("applyCardEffects — draw-cards", () => {
  it("draws from deck into hand", () => {
    const deck = [makeTestCard({ id: "d1" }), makeTestCard({ id: "d2" })];
    const state = makeState({ deck, hand: [] });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(0);
  });

  it("reshuffles discard when deck is empty", () => {
    const discard = [makeTestCard({ id: "d1" }), makeTestCard({ id: "d2" })];
    const state = makeState({ deck: [], discard, hand: [] });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.hand).toHaveLength(2);
    expect(result.discard).toHaveLength(0);
  });

  it("respects MAX_HAND_SIZE", () => {
    const deck = Array.from({ length: 10 }, (_, i) => makeTestCard({ id: `d${i}` }));
    const state = makeState({ deck, hand: [] });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 20 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.hand.length).toBe(7);
  });
});

describe("applyCardEffects — multiply-enemy-status", () => {
  it("doubles the stack with factor 2", () => {
    const state = makeState({
      enemyStatuses: { burn: 0, poison: 4, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "poison", factor: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.poison).toBe(8);
  });
});

describe("applyCardEffects — remove-player-status", () => {
  it("triggers Sin-Eater's Lantern heal on removal", () => {
    const manifest = computeTrinketManifest(["sin-eaters-lantern"]);
    const state = makeState({
      playerStatuses: {
        block: 0, armor: 0, forge: 0, haste: 0, burn: 4, poison: 0, bleed: 0, freeze: 0, stun: 0,
      },
      playerHealth: 15,
      trinketEffects: manifest,
    });
    const card = makeTestCard({ effects: [{ kind: "remove-player-status", status: "burn" }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerHealth).toBe(21);
  });
});

describe("applyCardEffects — buff-companion", () => {
  it("increases companion damage buff", () => {
    const state = makeState({ companionDamageBuff: 2 });
    const card = makeTestCard({ effects: [{ kind: "buff-companion", amount: 3 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.companionDamageBuff).toBe(5);
  });
});

describe("applyCardEffects — enemy-status (fixture)", () => {
  it("applies the full enemy status amount", () => {
    const state = makeState({
      enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeTestCard({
      effects: [{ kind: "enemy-status", status: "poison", amount: 4 }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.poison).toBe(4);
    expect(texts).toEqual([]);
  });
});
