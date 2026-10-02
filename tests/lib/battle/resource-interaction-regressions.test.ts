import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyGearCcPhysicalDamage } from "@/lib/battle/scaled-damage";
import { applyHealingWithCombatText } from "@/lib/battle/player-rewards";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("resource interactions", () => {
  it("Stunning and Shattering Gear damage decays enemy Armor", () => {
    const state = patchBattleState({ enemyMitigation: { armor: 3 } });
    const texts: CombatTextEvent[] = [];
    const next = applyGearCcPhysicalDamage(state, 4, texts);
    expect(next.enemyHealth).toBe(state.enemyHealth - 1);
    expect(next.enemyMitigation.armor).toBe(2);
    const protectedState = patchBattleState({
      enemyMitigation: { armor: 3 },
      currentEnemy: { traits: [{ id: "unbreakable", title: "Unbreakable", description: "" }] },
    });
    expect(applyGearCcPhysicalDamage(protectedState, 4, []).enemyMitigation.armor).toBe(3);
  });

  it("Profane Blood damage from healing decays enemy Armor", () => {
    const state = patchBattleState({
      playerHealth: 10,
      enemyMitigation: { armor: 3 },
      currentEnemy: { traits: [{ id: "blood-countess", title: "Profane Blood", description: "" }] },
    });
    const next = applyHealingWithCombatText(state, 1, []);
    expect(next.enemyHealth).toBe(state.enemyHealth - 1);
    expect(next.enemyMitigation.armor).toBe(2);
  });

  it("Melting Point shows the Armor it removes", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 6 },
      talentEffects: { burnRemovesEnemyArmor: true },
      rng: () => 0.99,
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 3 }] });
    const texts: CombatTextEvent[] = [];
    const next = applyCardEffects(state, card, texts);
    expect(next.enemyMitigation.armor).toBe(2);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "armor", amount: 3, impact: false });
  });

  it("Flay shows Armor actually removed by its halving proc", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 7 },
      talentEffects: { bleedHalveArmorChance: 100 },
      rng: () => 0.99,
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const next = applyCardEffects(state, card, texts);
    expect(next.enemyMitigation.armor).toBe(3);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "armor", amount: 3, impact: false });
  });

  it("Sunder shows its Forge-based Armor removal", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 8 },
      playerStatuses: { forge: 3 },
      talentEffects: { physicalStripArmorByForge: true },
      rng: () => 0.99,
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const next = applyCardEffects(state, card, texts);
    expect(next.enemyMitigation.armor).toBe(4);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "armor", amount: 3, impact: false });
  });
});
