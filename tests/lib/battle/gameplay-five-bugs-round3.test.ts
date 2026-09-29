import { describe, expect, it } from "vitest";
import { defaultTalentEffects } from "@/lib/battle";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { computeTalentEffects } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

describe("gameplay five bugs round 3", () => {
  describe("1. Clean Getaway triggers cleanse rewards once per Dodge", () => {
    it("grants blockOnCleanse once even when multiple statuses reach zero", () => {
      const state = patchBattleState({
        playerHealth: 50,
        playerMaxHealth: 100,
        playerStatuses: defaultPlayerStatusValues({ burn: 1, bleed: 1, poison: 1 }),
        talentEffects: { ...defaultTalentEffects, cleanseStacksOnDodge: 5 },
        gearEffects: { blockOnCleanse: 3 },
        rng: () => 0.99,
      });

      const result = applyDodgeTalentStatuses(state, []);

      // All three statuses reach zero, but reward fires only once
      expect(result.playerStatuses.burn).toBe(0);
      expect(result.playerStatuses.bleed).toBe(0);
      expect(result.playerStatuses.poison).toBe(0);
      expect(result.playerStatuses.block).toBe(3);
    });

    it("grants manaOnCleanse once even when multiple statuses reach zero", () => {
      const state = patchBattleState({
        mana: 1,
        playerStatuses: defaultPlayerStatusValues({ burn: 2, poison: 2 }),
        talentEffects: { ...defaultTalentEffects, cleanseStacksOnDodge: 5 },
        gearEffects: { manaOnCleanse: 2 },
        rng: () => 0.99,
      });

      const result = applyDodgeTalentStatuses(state, []);

      expect(result.playerStatuses.burn).toBe(0);
      expect(result.playerStatuses.poison).toBe(0);
      // Bug: was 1 + 2*2 = 5, should be 1 + 2*1 = 3
      expect(result.mana).toBe(3);
    });
  });

  describe("2. Toxic Pollen applies Poison through derived-hit resolver", () => {
    it("applies Poison through Block and Armor instead of bypassing them", () => {
      const card = makeTestCard({ tags: ["nature"] });
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyMitigation: { armor: 5 },
        rng: () => 0.99,
        talentEffects: { ...defaultTalentEffects, naturePoisonChance: 100 },
      });
      const effect = { kind: "damage" as const, damageType: "nature" as const, amount: 10 };

      const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 10 }, []);

      // Derived poison hit: 10 * 0.5 fraction = 5, reduced by armor
      // Bug: was addEnemyStatus(poison, 10) bypassing everything
      expect(result.enemyStatuses.poison).toBeLessThan(10);
      expect(result.enemyStatuses.poison).toBeGreaterThan(0);
    });

    it("skips derived Poison hit when enemy is already defeated", () => {
      const card = makeTestCard({ tags: ["nature"] });
      const state = patchBattleState({
        enemyHealth: 3,
        enemyMaxHealth: 100,
        rng: () => 0.99,
        talentEffects: { ...defaultTalentEffects, naturePoisonChance: 100 },
      });
      const effect = { kind: "damage" as const, damageType: "nature" as const, amount: 10 };

      const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 10 }, []);

      expect(result.enemyHealth).toBe(0);
      // Bug: was applying poison even to dead enemies
      expect(result.enemyStatuses.poison).toBe(0);
    });
  });

  describe("3. Scorching Light no longer has orphaned duplicate burn path", () => {
    it("applies burn only once through the derived-hit resolver", () => {
      const card = makeTestCard({ tags: ["holy"] });
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        rng: () => 0.01,
        talentEffects: { ...computeTalentEffects({ holy: ["holy-scorching-light"] }), holyBurnDamageChance: 100 },
      });
      const effect = { kind: "damage" as const, damageType: "holy" as const, amount: 10 };

      const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 10 }, []);

      // Scorching Light uses fraction: 1, so burn = 10 through derived hit
      // Bug: dead holyBurnChance path would have doubled this if ever accidentally set
      expect(result.enemyStatuses.burn).toBe(10);
    });
  });

  describe("4. Lacerate applies Bleed through derived-hit resolver", () => {
    it("applies Bleed through Armor instead of bypassing it", () => {
      const card = makeTestCard();
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyMitigation: { armor: 5 },
        rng: () => 0.99,
        talentEffects: { ...computeTalentEffects({ physical: ["physical-lacerate"] }), physicalBleedChance: 100 },
      });
      const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 10 };

      const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 10 }, []);

      // Derived bleed hit: 10 * 0.25 fraction = 2.5 → round(2.5) = 3, reduced by armor
      // Bug: was addEnemyStatus(bleed, 10) bypassing everything
      expect(result.enemyStatuses.bleed).toBeLessThan(10);
      expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
    });
  });

  describe("5. Briar Patch applies Bleed through derived-hit resolver", () => {
    it("applies Bleed through Block and Armor instead of bypassing them", () => {
      const card = makeTestCard({ tags: ["nature"] });
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyMitigation: { armor: 5 },
        rng: () => 0.99,
        talentEffects: { ...defaultTalentEffects, natureBleedChance: 100 },
      });
      const effect = { kind: "damage" as const, damageType: "nature" as const, amount: 10 };

      const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 10 }, []);

      // Derived bleed hit: 10 * 0.25 fraction = 2.5 → round(2.5) = 3, reduced by armor
      // Bug: was addEnemyStatus(bleed, 10) bypassing everything
      expect(result.enemyStatuses.bleed).toBeLessThan(10);
      expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
    });

    it("skips derived Bleed hit when enemy is already defeated", () => {
      const card = makeTestCard({ tags: ["nature"] });
      const state = patchBattleState({
        enemyHealth: 3,
        enemyMaxHealth: 100,
        rng: () => 0.99,
        talentEffects: { ...defaultTalentEffects, natureBleedChance: 100 },
      });
      const effect = { kind: "damage" as const, damageType: "nature" as const, amount: 10 };

      const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 10 }, []);

      expect(result.enemyHealth).toBe(0);
      expect(result.enemyStatuses.bleed).toBe(0);
    });
  });
});
