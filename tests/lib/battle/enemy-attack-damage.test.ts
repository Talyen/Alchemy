import { describe, expect, it } from "vitest";
import { applyEnemyLeechHealing, processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { makeTestBattleState, patchBattleState } from "../../fixtures/battle";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard } from "../../fixtures/cards";
import { processEncounterTraitActionDamage } from "@/lib/battle/encounter-trait-events";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { resolveTypedEnemyHit } from "@/lib/battle/typed-hit-resolution";
import { dealSelfDamage } from "@/lib/battle/status-helpers";

describe("enemy attack damage", () => {
  it.each(["aetherward", "block", "armor", "resistance", "dodge", "overkill", "deaths-door", "zero"] as const)(
    "separates contact, resolved damage, and Health loss for %s",
    (prevention) => {
      const state = patchBattleState({
        rng: () => (prevention === "dodge" ? 0 : 0.99),
        deathsDoorUsed: prevention !== "deaths-door",
        playerHealth: 2,
        playerMaxHealth: 30,
        mana: 3,
        playerStatuses: { block: prevention === "block" ? 4 : 0, armor: prevention === "armor" ? 4 : 0 },
        gearEffects: {
          damageReductionPerMana: prevention === "aetherward" ? 2 : 0,
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

  it("captures a player hit's Health loss before threshold healing", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
    });
    const hit = resolveTypedEnemyHit(state, { kind: "damage", damageType: "nature", amount: 4 }, 4, []);
    expect(hit.healthDamage).toBe(4);
    expect(hit.resolvedDamage).toBe(4);
    expect(hit.killed).toBe(false);
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

  it("resolves an undodgeable incoming packet and enemy leech", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 0 },
      enemyHealth: 10,
      enemyMaxHealth: 20,
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(25);
    expect(applyEnemyLeechHealing(damaged, 5, []).enemyHealth).toBeGreaterThan(10);
  });

  it("block absorbs before health is lost", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 5, armor: 0 },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(30);
    expect(damaged.playerStatuses.block).toBe(0);
  });

  it("armor absorbs then decays after damaging the player", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 3 },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(28);
    expect(damaged.playerStatuses.armor).toBe(2);
  });

  it("fires health-threshold block when damage crosses the threshold", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...base.talentEffects, healthThresholdBlock: { threshold: 50, amount: 4 } },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 20 }, []);
    expect(damaged.playerHealth).toBe(10);
    expect(damaged.playerStatuses.block).toBe(4);
  });
});
