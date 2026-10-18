import { processEncounterTraitActionDamage } from "@/lib/battle/encounter-trait-events";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { resolveTypedEnemyHit } from "@/lib/battle/typed-hit-resolution";
import type { CombatTextEvent } from "@/lib/battle/types";
import { describe, expect, it, vi } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

describe("enemy attack damage", () => {
  it.each(["bleed", "poison"] as const)("halves incoming %s damage while Block is present", (damageType) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 2 },
      talentEffects: {
        ...(damageType === "bleed" ? { blockHalvesBleedDamage: true } : { blockHalvesPoisonDamage: true }),
      },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 4 }, []);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerHealth).toBe(29);
  });

  it.each(["aetherward", "block", "armor", "resistance", "dodge", "overkill", "deaths-door", "zero"] as const)(
    "separates contact, resolved damage, and Health loss for %s",
    (prevention) => {
      const state = patchBattleState({
        rng: () => (prevention === "dodge" ? 0 : 0.99),
        deathsDoorUsed: prevention !== "deaths-door",
        playerHealth: 2,
        playerMaxHealth: 30,
        mana: prevention === "aetherward" ? 4 : 3,
        playerStatuses: { block: prevention === "block" ? 4 : 0, armor: prevention === "armor" ? 4 : 0 },
        gearEffects: {
          damageReductionPerMana: prevention === "aetherward" ? 1 : 0,
          resistPhysical: prevention === "resistance" ? 100 : 0,
        },
      });
      const result = resolveEnemyAttackHit(
        state,
        { kind: "damage", damageType: "physical", amount: prevention === "zero" ? 0 : 4 },
        [],
        {
          canDodge: true,
        },
      );
      expect(result).toMatchObject({
        attemptedDamage: prevention === "zero" ? 0 : 4,
        resolvedDamage: prevention === "overkill" || prevention === "deaths-door" ? 4 : 0,
        healthDamage: prevention === "overkill" ? 2 : prevention === "deaths-door" ? 1 : 0,
        landed: prevention !== "dodge" && prevention !== "zero",
        dodged: prevention === "dodge",
        killed: prevention === "overkill",
      });
    },
  );

  it.each(["victory", "defeat"])("ended battles reject incoming hits before Dodge or damage: %s", (outcome) => {
    const state = patchBattleState({
      playerHealth: outcome === "defeat" ? 0 : 30,
      enemyHealth: outcome === "victory" ? 0 : 30,
      flags: { dodgeNextAttack: true },
      gearEffects: { blockOnDodge: 4 },
      rng: () => {
        throw new Error("Ended battles must not roll");
      },
    });
    const effect = { kind: "damage", damageType: "physical", amount: 4 } as const;
    const texts: Parameters<typeof processEnemyDamageEffect>[2] = [];
    expect(resolveEnemyAttackHit(state, effect, texts, { canDodge: true })).toEqual({
      state,
      attemptedDamage: 0,
      resolvedDamage: 0,
      healthDamage: 0,
      blockLost: 0,
      healthAfterHit: state.playerHealth,
      landed: false,
      dodged: false,
      killed: false,
    });
    expect(processEnemyDamageEffect(state, effect, texts)).toBe(state);
    expect(texts).toEqual([]);
  });

  it("reports post-dodge player health in healthAfterHit when dodge triggers healing", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 100,
      flags: { dodgeNextAttack: true },
      talentEffects: { healOnDodge: 10 },
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 8 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(true);
    expect(result.state.playerHealth).toBe(40);
    expect(result.healthAfterHit).toBe(40);
  });

  it("a zero-damage attack cannot trigger Dodge healing or spend RNG", () => {
    const rng = vi.fn(() => 0);
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { healOnDodge: 1 },
      rng,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 0 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(false);
    expect(result.state.playerHealth).toBe(10);
    expect(result.state.playerDodgeCount).toBe(state.playerDodgeCount);
    expect(rng).not.toHaveBeenCalled();
  });

  it("pre-hit eligibility snapshot in resolveTypedEnemyHit preserves eligibility snapshot when applying damage status riders", () => {
    const eligibility = patchBattleState({
      playerStatuses: { block: 0 },
      gearEffects: { freezeGrantsBlockAndMana: 1 },
    });
    const state = patchBattleState({
      playerStatuses: { block: 5 },
      gearEffects: { freezeGrantsBlockAndMana: 1 },
      enemyHealth: 50,
    });

    const combatTexts: CombatTextEvent[] = [];
    const result = resolveTypedEnemyHit(
      state,
      { kind: "damage", damageType: "freeze", amount: 4 },
      4,
      combatTexts,
      eligibility,
    );

    expect(result.state.playerStatuses.block).toBe(5 + 4);
  });

  it("captures a player hit's Health loss before threshold healing", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
    });
    const hit = resolveTypedEnemyHit(state, { kind: "damage", damageType: "nature", amount: 4 }, 4, []);
    expect(hit.facts.healthDamage).toBe(4);
    expect(hit.facts.resolvedDamage).toBe(4);
    expect(hit.facts.killed).toBe(false);
    expect(hit.state.enemyHealth).toBeGreaterThan(2);
  });

  it.each([
    ["burn", "armorMitigatesBurn"],
    ["bleed", "armorMitigatesBleed"],
  ] as const)("Armor protects against direct %s hits with the matching talent", (damageType, talent) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { armor: 3, block: 2 },
      talentEffects: { [talent]: true },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 7 }, []);
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses[damageType]).toBe(2);
    expect(result.playerStatuses.armor).toBe(2);
    expect(result.playerStatuses.block).toBe(0);
    expect(state.playerHealth).toBe(30);
  });

  it("Fireward also protects against Cauterize's self-inflicted Burn", () => {
    const state = patchBattleState({ playerStatuses: { armor: 3 }, talentEffects: { armorMitigatesBurn: true } });
    const result = dealSelfDamage(state, 1, "burn", []);
    expect(result.healthLost).toBe(0);
    expect(result.state.playerHealth).toBe(state.playerHealth);
  });

  it.each(["sunder", "caustic", "banshee"])("Reactive Guard rewards Armor broken by %s", (source) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { armor: source === "caustic" ? 2 : 1 },
      talentEffects: { armorBreakBlock: 5 },
      currentEnemy: { traits: [{ id: source, title: source, description: "" }] },
      rng: () => 0.99,
    });
    const result =
      source === "caustic"
        ? processEncounterTraitActionDamage(state, [])
        : applyEnemyAbility(
            state,
            makeTestCard({
              effects:
                source === "sunder"
                  ? [{ kind: "remove-enemy-armor", amount: 1 }]
                  : [{ kind: "damage", damageType: "physical", amount: 1 }],
            }),
            [],
          );
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("halves holy damage when receiveHalfHolyDamage talent is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfHolyDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 10 }] }),
      [],
    );
    expect(result.playerHealth).toBe(25);
  });

  it("emits full healing potency when block-depleted heal overheals", () => {
    const texts: Parameters<typeof applyEnemyAbility>[2] = [];
    const state = patchBattleState({
      playerHealth: 29,
      playerMaxHealth: 30,
      playerStatuses: { block: 5, armor: 0 },
      talentEffects: { blockDepletedHeal: 4 },
    });
    const result = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      texts,
    );
    expect(result.playerHealth).toBe(30);
    expect(texts.find((t) => t.kind === "heal")).toEqual({
      target: "player",
      kind: "heal",
      stat: "health",
      amount: 4,
    });
  });
});
