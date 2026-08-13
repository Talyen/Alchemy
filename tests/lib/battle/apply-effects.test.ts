import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { CombatTextEvent } from "@/lib/battle/types";
import { applyPlayerCombatDamage, isPlayerDefeated } from "@/lib/battle/types";
import { computeTrinketManifest } from "@/lib/trinkets";
import { blockDeck, makeState, makeTestCard, statusDeck } from "../../fixtures/battle";
import { defaultPlayerStatusValues, defaultEnemyStatusValues } from "../../fixtures/default-battle-state";

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

  it("self-damage triggers Death's Door instead of defeat on first fatal hit", () => {
    const state = makeState({
      playerHealth: 1,
      playerStatuses: defaultPlayerStatusValues(),
    });
    const card = makeTestCard({ effects: [{ kind: "self-damage", damageType: "bleed", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(1);
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

  it("plays the next card's effects twice when playNextCardTwice is armed", () => {
    const card = makeTestCard({
      id: "slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({
      enemyHealth: 30,
      hand: [card],
      flags: { ...makeState().flags, playNextCardTwice: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.flags.playNextCardTwice).toBe(false);
  });

  it("guarantees a crit on the next damaging card", () => {
    const card = makeTestCard({
      id: "slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({
      enemyHealth: 30,
      hand: [card],
      flags: { ...makeState().flags, nextHitCrit: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.flags.nextHitCrit).toBe(false);
  });

  it("guarantees a crit on cleanse-player-status-to-damage and consumes the flag", () => {
    const card = makeTestCard({
      id: "exorcism",
      effects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy", removeAll: true }],
    });
    const state = makeState({
      enemyHealth: 30,
      hand: [card],
      playerStatuses: defaultPlayerStatusValues({ burn: 4 }),
      flags: { ...makeState().flags, nextHitCrit: true },
    });
    const result = playBattleCardResolved(state, "exorcism", 0);
    expect(result.state.enemyHealth).toBe(22);
    expect(result.state.flags.nextHitCrit).toBe(false);
    expect(result.state.playerStatuses.burn).toBe(0);
  });
});

describe("applyPlayerCombatDamage — phoenixFeather", () => {
  it("restores 30% max health and clears feather instead of dying", () => {
    const state = makeState({
      playerHealth: 5,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ phoenixFeather: 1 }),
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

describe("applyCardEffects — multiply-enemy-status", () => {
  it("doubles the stack with factor 2", () => {
    const state = makeState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 4 }),
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
      playerStatuses: defaultPlayerStatusValues({ burn: 4 }),
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

describe("applyCardEffects — enemy-status (fixture)", () => {
  it("applies the full enemy status amount", () => {
    const state = makeState({
      enemyStatuses: defaultEnemyStatusValues(),
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
