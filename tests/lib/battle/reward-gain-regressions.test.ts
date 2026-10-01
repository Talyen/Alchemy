import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("rewards track actual gains", () => {
  it("Thunderstone Nature damage can pay Seed Money, capped to actual Health lost", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyMaxHealth: 40,
      enemyStatuses: { stun: 100 },
      talentEffects: { goldOnNatureDamageChance: 10 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
      rng: () => 0.01,
    });
    const next = resolveStunTrigger(state, []);
    expect(next.enemyHealth).toBe(0);
    expect(next.gold - state.gold).toBe(3);
  });

  it("Unburdened pays Cleansing Status for both Stun and Freeze removed", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 40,
      playerStatuses: { stun: 1, freeze: 1 },
      talentEffects: computeTalentEffects({ dodge: ["dodge-unburdened"], health: ["health-max-2"] }),
    });
    const next = applyDodgeTalentStatuses(state, []);
    expect(next.playerStatuses).toMatchObject({ stun: 0, freeze: 0 });
    expect(next.playerHealth).toBe(14);
  });

  it("Counterplate still fires when Reactive Guard and Armored Surge replace the lost Armor", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      playerStatuses: { armor: 1 },
      talentEffects: computeTalentEffects({ armor: ["armor-break-block", "armor-block-burst"] }),
      gearEffects: { stunOnArmorLostToAttack: 2 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: () => 0.05,
    });
    const next = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      [],
    );
    expect(next.playerStatuses.armor).toBe(3);
    expect(next.enemyHealth).toBe(98);
    expect(next.enemyStatuses.stun).toBe(2);
  });

  it("Second Wind cannot erase Briarplate's reward for Thorns damage", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      playerStatuses: { thorns: 2 },
      enemyHealth: 51,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
      gearEffects: { armorOnThornsDamage: 2, healOnFirstThornsDamageEachTurn: 3, poisonOnThornsDamage: 2 },
      rng: () => 0.99,
    });
    const next = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      [],
    );
    expect(next.flags.secondWindTriggered).toBe(true);
    expect(next.enemyHealth).toBeGreaterThan(state.enemyHealth);
    expect(next.playerStatuses.armor).toBe(2);
    expect(next.playerHealth).toBe(22);
    expect(next.flags.spitefulHealedThisTurn).toBe(true);
    expect(next.enemyStatuses.poison).toBe(2);
  });

  it("fully blocked Thorns cannot grant damage rewards", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      playerStatuses: { thorns: 2 },
      enemyMitigation: { block: 20 },
      gearEffects: { armorOnThornsDamage: 2, healOnFirstThornsDamageEachTurn: 3, poisonOnThornsDamage: 2 },
      rng: () => 0.99,
    });
    const next = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      [],
    );
    expect(next.playerStatuses.armor).toBe(0);
    expect(next.playerHealth).toBe(19);
    expect(next.flags.spitefulHealedThisTurn).toBe(false);
    expect(next.enemyStatuses.poison).toBe(0);
  });

  it.each(["draw", "random"])("%s draw feedback includes cards reserved beyond the full hand", (mode) => {
    const card =
      mode === "random" ? cardById["roll-the-dice"]! : makeTestCard({ effects: [{ kind: "draw-cards", amount: 2 }] });
    const state = patchBattleState({
      hand: Array.from({ length: 7 }, () => makeTestCard()),
      deck: Array.from({ length: 2 }, () => makeTestCard()),
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyCardEffects(state, card, texts);
    expect(next.pendingHandCards).toHaveLength(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "draw", amount: 2 });
  });
});
