import { describe, expect, it } from "vitest";
import {
  BATTLE_CARD_EFFECT_KINDS,
  BattleCardEffectSchema,
  RECURSIVE_BATTLE_CARD_EFFECT_KINDS,
  TEMPLATE_EFFECT_DEFINITIONS,
  type BattleCardEffect,
} from "@/lib/game-data";
import { collectKeywordsFromBattleEffect } from "@/lib/game-data/effect-metadata";
import { EFFECT_APPLY_BY_KIND } from "@/lib/battle/effect-handlers/registry";

// Single contract for "adding a kind" (see BATTLE_HANDLERS.md): the union,
// schemas, runtime handlers, and keyword groupings must agree. Minimal effects
// below must satisfy their schema refinements.
const MINIMAL_EFFECT_BY_KIND: Record<(typeof BATTLE_CARD_EFFECT_KINDS)[number], BattleCardEffect> = {
  damage: { kind: "damage", damageType: "physical", amount: 1 },
  "player-status": { kind: "player-status", status: "block", amount: 1 },
  "enemy-status": { kind: "enemy-status", status: "burn", amount: 1 },
  heal: { kind: "heal", amount: 1 },
  "restore-mana": { kind: "restore-mana", amount: 1 },
  "lose-mana": { kind: "lose-mana", amount: 1 },
  "lose-max-mana": { kind: "lose-max-mana", amount: 1 },
  "gain-max-mana": { kind: "gain-max-mana", amount: 1 },
  "gain-gold": { kind: "gain-gold", amount: 1 },
  wish: { kind: "wish", amount: 1 },
  "summon-companion": { kind: "summon-companion", companionId: "wolf" },
  "remove-harmful-status": { kind: "remove-harmful-status", removeAll: true },
  "remove-player-status": { kind: "remove-player-status", status: "burn" },
  "self-damage": { kind: "self-damage", damageType: "burn", amount: 1 },
  "buff-companion": { kind: "buff-companion", amount: 1 },
  "companion-action": { kind: "companion-action", amount: 1 },
  "random-draw": { kind: "random-draw", minAmount: 1, maxAmount: 6 },
  "lose-health": { kind: "lose-health", amount: 1 },
  "draw-cards": { kind: "draw-cards", amount: 1 },
  "remove-enemy-armor": { kind: "remove-enemy-armor", removeAll: true },
  "multiply-enemy-status": { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
  "cleanse-player-status-to-damage": { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
  "random-damage": { kind: "random-damage", minAmount: 1, maxAmount: 6 },
  "next-hit-crit": { kind: "next-hit-crit" },
  "next-hit-leech": { kind: "next-hit-leech" },
  "play-next-card-twice": { kind: "play-next-card-twice" },
  "next-hit-poison": { kind: "next-hit-poison" },
  "next-archery-free": { kind: "next-archery-free" },
  chance: {
    kind: "chance",
    probability: 0.5,
    successEffects: [{ kind: "heal", amount: 1 }],
    failureEffects: [{ kind: "heal", amount: 1 }],
  },
  "repeat-over-turns": {
    kind: "repeat-over-turns",
    remainingTurns: 1,
    effects: [{ kind: "heal", amount: 1 }],
  },
};

describe("effect kind coverage", () => {
  it("covers every kind exactly once", () => {
    expect(new Set(Object.keys(MINIMAL_EFFECT_BY_KIND))).toEqual(new Set(BATTLE_CARD_EFFECT_KINDS));
  });

  it("template definitions cover all non-recursive kinds", () => {
    const recursive = new Set<string>(RECURSIVE_BATTLE_CARD_EFFECT_KINDS);
    const templateKinds = new Set<string>(TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.kind));
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      expect(templateKinds.has(kind)).toBe(!recursive.has(kind));
    }
  });

  it("every minimal effect satisfies its schema", () => {
    for (const [kind, effect] of Object.entries(MINIMAL_EFFECT_BY_KIND)) {
      expect(BattleCardEffectSchema.safeParse(effect).success, kind).toBe(true);
    }
  });

  it("every non-recursive kind has a battle handler", () => {
    const recursive = new Set<string>(RECURSIVE_BATTLE_CARD_EFFECT_KINDS);
    const registered = new Set(Object.keys(EFFECT_APPLY_BY_KIND));
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      expect(registered.has(kind)).toBe(!recursive.has(kind));
    }
  });

  it("every kind has a keyword grouping", () => {
    for (const [kind, effect] of Object.entries(MINIMAL_EFFECT_BY_KIND)) {
      expect(Array.isArray(collectKeywordsFromBattleEffect(effect)), kind).toBe(true);
    }
  });
});
