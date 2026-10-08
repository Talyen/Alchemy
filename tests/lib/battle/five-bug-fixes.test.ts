import { describe, expect, it } from "vitest";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { applyResonantChimeTrinket } from "@/lib/battle/card-play-effects";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { cardById } from "@/lib/game-data";
import { defaultTalentEffects } from "@/lib/battle";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("Five targeted bug fixes", () => {
  describe("Bug 1: Block depletion triggered when pre-damage strip + damage absorbs all Block", () => {
    it("triggers blockDepletedHeal when attack strips Block and damage depletes the remainder", () => {
      // Player has 5 block. Sundered Guard strips 2 block, leaving 3.
      // Attack deals 5 physical damage: 3 absorbed by block, 2 hits health.
      // Total block lost = 2 (strip) + 3 (absorb) = 5 (all initial block depleted).
      const state = patchBattleState({
        rng: () => 0.99,
        playerHealth: 50,
        playerMaxHealth: 100,
        playerStatuses: { block: 5 },
        talentEffects: { ...defaultTalentEffects, blockDepletedHeal: 8 },
        currentEnemy: { traits: [{ id: "sundered-guard", title: "Sundered Guard", description: "" }] },
      });

      const combatTexts: CombatTextEvent[] = [];
      const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 5 }, combatTexts, {
        canDodge: false,
      });

      // Block is completely depleted
      expect(result.state.playerStatuses.block).toBe(0);
      // Health: 50 - 2 (excess damage) + 8 (blockDepletedHeal) = 56
      expect(result.state.playerHealth).toBe(56);
      expect(combatTexts).toContainEqual({
        target: "player",
        kind: "heal",
        stat: "health",
        amount: 8,
      });
    });

    it("does not trigger blockDepletedHeal when Block is not fully depleted", () => {
      // Player has 10 block. Sundered Guard strips 2, leaving 8.
      // Attack deals 4 physical damage: 4 absorbed by block, 4 block remains.
      const state = patchBattleState({
        rng: () => 0.99,
        playerHealth: 50,
        playerMaxHealth: 100,
        playerStatuses: { block: 10 },
        talentEffects: { ...defaultTalentEffects, blockDepletedHeal: 8 },
        currentEnemy: { traits: [{ id: "sundered-guard", title: "Sundered Guard", description: "" }] },
      });

      const combatTexts: CombatTextEvent[] = [];
      const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, combatTexts, {
        canDodge: false,
      });

      expect(result.state.playerStatuses.block).toBe(4);
      expect(result.state.playerHealth).toBe(50);
      expect(combatTexts).not.toContainEqual(expect.objectContaining({ kind: "heal", stat: "health" }));
    });
  });

  describe("Bug 2: Resonant Chime preserves combat flags while marking itself used", () => {
    it("preserves existing flags via writeCombatFlag when granting mana", () => {
      const state = patchBattleState({
        mana: 1,
        maxMana: 3,
        cardsPlayedThisTurn: 3,
        trinketEffects: { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
        flags: { pendingCinderSkinReaction: true },
      });

      const combatTexts: CombatTextEvent[] = [];
      const next = applyResonantChimeTrinket(state, combatTexts);

      expect(next.mana).toBe(2);
      expect(next.flags.resonantChimeUsedThisTurn).toBe(true);
      expect(next.flags.pendingCinderSkinReaction).toBe(true);
      expect(combatTexts).toContainEqual({
        target: "player",
        kind: "status",
        stat: "mana",
        amount: 1,
      });
    });
  });

  describe("Bug 3: decayArmorAfterDamage in resolveCardHit receives combatTexts", () => {
    it("decays enemy armor when hit by a damaging card", () => {
      const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
      const state = patchBattleState({
        enemyHealth: 50,
        enemyMaxHealth: 50,
        enemyMitigation: { armor: 3 },
      });

      const combatTexts: CombatTextEvent[] = [];
      const result = resolvePlayerHit(
        state,
        {
          source: "card-attack",
          card,
          effect: card.effects.find((effect) => effect.kind === "damage")!,
          resolvedDamage: 6,
        },
        combatTexts,
      );

      // Enemy armor decays by 1 after taking damage
      expect(result.enemyMitigation.armor).toBe(2);
    });
  });

  describe("Bug 4: Archery reactions use Broadhead without orphaned archeryBleedChance bypass", () => {
    it("applies Bleed according to Broadhead talent and does not double-apply via dead chance flag", () => {
      const card = makeTestCard({
        tags: ["archery"],
        effects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      });
      const state = patchBattleState({
        enemyHealth: 50,
        enemyMaxHealth: 50,
        talentEffects: { ...defaultTalentEffects, archeryBleedDamageChance: 100 },
        rng: () => 0.1,
      });

      const combatTexts: CombatTextEvent[] = [];
      const result = resolvePlayerHit(
        state,
        {
          source: "card-attack",
          card,
          effect: card.effects.find((effect) => effect.kind === "damage")!,
          resolvedDamage: 10,
        },
        combatTexts,
      );

      // Broadhead applies derived bleed damage via tryTalentTypedHit using TALENT_CONVERSION_BLEED_FRACTION (30% of 10 = 3)
      expect(result.enemyStatuses.bleed).toBe(3);
    });
  });

  describe("Bug 5: drawPhysicalOnBleedTick emits draw combat feedback", () => {
    it("emits draw combat text when a physical card is drawn on bleed tick", () => {
      const physicalCard = cardById["slash"]!;
      const state = patchBattleState({
        deck: [physicalCard],
        enemyHealth: 50,
        enemyMaxHealth: 50,
        enemyStatuses: { bleed: 4 },
        talentEffects: { ...defaultTalentEffects, drawPhysicalOnBleedTick: true },
      });

      const combatTexts: CombatTextEvent[] = [];
      const result = tickEnemyStatuses(state, combatTexts);

      expect(result.hand).toContainEqual(expect.objectContaining({ id: "slash" }));
      expect(combatTexts).toContainEqual({
        target: "player",
        kind: "status",
        stat: "draw",
        amount: 1,
      });
    });
  });
});
