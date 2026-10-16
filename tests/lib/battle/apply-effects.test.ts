import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { CombatTextEvent } from "@/lib/battle/types";
import { isPlayerDefeated } from "@/lib/battle/battle-outcome";
import { computeTrinketManifest } from "@/lib/trinkets";
import { blockDeck, makeState, makeTestCard, statusDeck } from "../../fixtures/battle";

describe("applyCardEffects", () => {
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
      flags: { playNextCardTwice: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.flags.playNextCardTwice).toBe(false);
  });

  it("does not repeat card effects when the first copy defeats the enemy", () => {
    const card = makeTestCard({
      id: "slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const state = makeState({
      enemyHealth: 8,
      hand: [card],
      flags: { playNextCardTwice: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(0);
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
      flags: { nextHitCrit: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.flags.nextHitCrit).toBe(false);
  });

  it.each([
    [0, 28],
    [4, 20],
  ])("cleanses received Burn after %i existing stacks, critically hits, and consumes the flag", (burn, enemyHealth) => {
    const card = makeTestCard({
      id: "exorcism",
      effects: [
        { kind: "self-damage", damageType: "burn", amount: 1 },
        { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
      ],
    });
    const state = makeState({
      enemyHealth: 30,
      hand: [card],
      playerStatuses: { burn },
      flags: { nextHitCrit: true },
    });
    const result = playBattleCardResolved(state, "exorcism", 0);
    expect(result.state.enemyHealth).toBe(enemyHealth);
    expect(result.state.flags.nextHitCrit).toBe(false);
    expect(result.state.playerStatuses.burn).toBe(0);
  });
});

it("applyCardEffects — phoenix-feather card deals burn damage and grants phoenix feather status", () => {
  const state = makeState({ enemyHealth: 20 });
  const card = makeTestCard({
    id: "phoenix-feather",
    effects: [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "player-status", status: "phoenixFeather", amount: 1 },
    ],
  });
  const texts: CombatTextEvent[] = [];
  const result = applyCardEffects(state, card, texts);
  expect(result.enemyHealth).toBe(19);
  expect(result.enemyStatuses.burn).toBe(1);
  expect(result.playerStatuses.phoenixFeather).toBe(1);
});

it("applyCardEffects — unknown effect kind ignores unknown effect kinds (default case)", () => {
  const state = makeState({ mana: 3 });
  const card = makeTestCard({ effects: [{ kind: "unknown" as never, amount: 99 }] });
  const texts: CombatTextEvent[] = [];
  const result = applyCardEffects(state, card, texts);
  expect(result).toBe(state);
  expect(texts).toEqual([]);
});

describe("applyCardEffects — multiply-enemy-status", () => {
  it("doubles the stack with factor 2", () => {
    const state = makeState({
      enemyStatuses: { poison: 4 },
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "poison", factor: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.poison).toBe(8);
  });

  it("halves added stun stacks against a braced enemy like every other stack source", () => {
    const state = makeState({
      enemyStatuses: { stun: 3 },
      currentEnemy: {
        id: "braced-test-enemy",
        title: "Braced Test Enemy",
        subtitle: "",
        descriptionLines: [],
        art: "",
        enemyType: "boss",
        traits: [{ id: "braced" }],
        abilityIds: ["slash", "bash", "block"],
      } as never,
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "stun", factor: 2 }] });
    const result = applyCardEffects(state, card, []);

    expect(result.enemyStatuses.stun).toBe(5);
  });
});

it("applyCardEffects — remove-player-status triggers Sin-Eater's Lantern heal on removal", () => {
  const manifest = computeTrinketManifest(["sin-eaters-lantern"]);
  const state = makeState({
    playerStatuses: { burn: 4 },
    playerHealth: 15,
    trinketEffects: manifest,
  });
  const card = makeTestCard({ effects: [{ kind: "remove-player-status", status: "burn" }] });
  const texts: CombatTextEvent[] = [];
  const result = applyCardEffects(state, card, texts);
  expect(result.playerStatuses.burn).toBe(0);
  expect(result.playerHealth).toBe(21);
});

it("applyCardEffects — enemy-status (fixture) applies the full enemy status amount", () => {
  const state = makeState({});
  const card = makeTestCard({
    effects: [{ kind: "enemy-status", status: "poison", amount: 4 }],
  });
  const texts: CombatTextEvent[] = [];
  const result = applyCardEffects(state, card, texts);
  expect(result.enemyStatuses.poison).toBe(4);
  expect(texts).toEqual([{ target: "enemy", kind: "multiply", stat: "poison", amount: 4 }]);
});
