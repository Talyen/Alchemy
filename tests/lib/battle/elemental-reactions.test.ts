import { scoreAvailableReactions } from "@/lib/battle/reaction-score";
import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyEnemyHealingWithCombatText } from "@/lib/battle/enemy-healing";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { resolveSecondaryAction } from "@/lib/battle/action-context";
import { projectEnemyDotDamage } from "@/lib/battle/dot-resolve";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { getEnemyAbilityCard, type DamageType } from "@/lib/game-data";
import { patchBattleState, makeTestCard, type BattleStatePatch } from "../../fixtures/battle";
import type { BattleState, CombatTextEvent } from "@/lib/battle";

function base(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 200,
    enemyMaxHealth: 200,
    playerHealth: 200,
    playerMaxHealth: 200,
    rng: () => 0.99,
    appliesFightPacing: false,
    ...patch,
  });
}
function hit(state: BattleState, damageType: DamageType, texts: CombatTextEvent[] = [], amount = 4) {
  return applyCardEffects(state, makeTestCard({ effects: [{ kind: "damage", damageType, amount }] }), texts, {
    manaAtStart: state.mana,
    origin: "played-card",
  });
}
function reactions(texts: CombatTextEvent[]) {
  return texts.flatMap((event) => (event.kind === "notice" && event.signal === "reaction" ? [event.reactionId] : []));
}

describe("reaction finishers", () => {
  it("Shatter strips Block before mitigation, leaves Armor and Freeze intact, and spends readiness once", () => {
    const start = base({
      enemyCC: { freezeSkipTurns: 1 },
      reactions: { shatterDamage: 10 },
      enemyMitigation: { block: 100, armor: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const result = hit(start, "physical", texts);
    expect(reactions(texts)).toEqual(["shatter"]);
    expect(result.enemyMitigation.block).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(result.reactions.shatterDamage).toBe(0);
    expect(result.enemyHealth).toBe(188);
    expect(start.enemyMitigation.block).toBe(100);
  });

  it("requires natural setup and a substantial current DoT pool, with no reverse Frostfire route", () => {
    const burning = base({ enemyStatuses: { burn: 40, freeze: 100 } });
    expect(reactionsAfter(burning, "freeze")).toEqual([]);
    expect(
      reactionsAfter(
        base({ enemyCC: { freezeSkipTurns: 1 }, reactions: { frostfireDamage: 10 }, enemyStatuses: { burn: 40 } }),
        "burn",
      ),
    ).toEqual([]);
    expect(
      reactionsAfter(base({ enemyStatuses: { poison: 1 }, reactions: { naturalPoisonDamage: 40 } }), "burn"),
    ).toEqual([]);
  });

  it("Frostfire detonates all remaining Burn and strips all Armor without consuming Freeze", () => {
    const start = base({
      enemyStatuses: { burn: 40, freeze: 100 },
      enemyMitigation: { armor: 30 },
      reactions: { naturalBurnDamage: 20 },
    });
    const texts: CombatTextEvent[] = [];
    const result = hit(start, "freeze", texts, 20);
    expect(reactions(texts)).toEqual(["frostfire"]);
    expect(result.enemyStatuses.burn).toBe(0);
    expect(result.enemyMitigation.armor).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(result.reactions.naturalBurnDamage).toBe(0);
  });

  it("Rupture detonates remaining Bleed, preserves Stun, and applies exactly half healing", () => {
    const start = base({
      enemyHealth: 150,
      enemyStatuses: { bleed: 24 },
      enemyCC: { stunSkipTurns: 1 },
      reactions: { naturalBleedDamage: 20, ruptureDamage: 10 },
    });
    const texts: CombatTextEvent[] = [];
    const result = hit(start, "bleed", texts);
    expect(reactions(texts)).toEqual(["rupture"]);
    expect(result.enemyStatuses.bleed).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.reactions.healingReductionTurns).toBe(2);
    expect(
      applyEnemyHealingWithCombatText(result, 20, [], { skipFightPacing: true }).enemyHealth - result.enemyHealth,
    ).toBe(10);
  });

  it("Consecration grants 25% of actual combined reaction damage as Hero Block", () => {
    const start = base({ enemyStatuses: { bleed: 40 }, reactions: { naturalBleedDamage: 20 } });
    const texts: CombatTextEvent[] = [];
    const result = hit(start, "holy", texts);
    const damage = texts.reduce(
      (total, event) =>
        total +
        (event.kind === "damage" && event.reactionId === "consecration" ? (event.healthLost ?? event.amount) : 0),
      0,
    );
    expect(reactions(texts)).toEqual(["consecration"]);
    expect(damage).toBe(45);
    expect(result.playerStatuses.block).toBe(11);
    expect(result.enemyStatuses.bleed).toBe(0);
  });

  it("Venomflash includes every remaining Poison/Burn tick and purges one enemy benefit", () => {
    const start = base({ enemyStatuses: { poison: 32, thorns: 3 }, reactions: { naturalPoisonDamage: 20 } });
    const expectedPoison = projectEnemyDotDamage(start, "poison", "remaining-ticks");
    const texts: CombatTextEvent[] = [];
    const result = hit(start, "burn", texts);
    expect(reactions(texts)).toEqual(["venomflash"]);
    expect(start.enemyHealth - result.enemyHealth).toBeGreaterThanOrEqual(expectedPoison + 5 + 4);
    expect(result.enemyStatuses.poison).toBe(0);
    expect(result.enemyStatuses.burn).toBe(0);
    expect(result.enemyStatuses.thorns).toBe(0);
  });

  it("limits a multi-hit card to one reaction and leaves unused ingredients available", () => {
    const start = base({
      enemyStatuses: { poison: 24, bleed: 24 },
      enemyCC: { freezeSkipTurns: 1 },
      reactions: { naturalPoisonDamage: 20, naturalBleedDamage: 20, shatterDamage: 10 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(
      start,
      makeTestCard({
        effects: [
          { kind: "damage", damageType: "holy", amount: 4 },
          { kind: "damage", damageType: "burn", amount: 4 },
          { kind: "damage", damageType: "physical", amount: 4 },
        ],
      }),
      texts,
      { manaAtStart: start.mana, origin: "played-card" },
    );
    expect(reactions(texts)).toEqual(["consecration"]);
    expect(result.enemyStatuses.poison).toBe(24);
    expect(result.reactionSpent).toBeUndefined();
    expect(result.reactions.shatterDamage).toBe(10);
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "holy", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 4 },
      ],
    });
    expect(scoreAvailableReactions(card, start)).toBe(29);
  });

  it("natural ticks only establish readiness and never trigger Bloodboil", () => {
    const texts: CombatTextEvent[] = [];
    const result = tickEnemyStatuses(base({ enemyStatuses: { burn: 40, bleed: 20 } }), texts);
    expect(reactions(texts)).toEqual([]);
    expect(result.reactions.naturalBurnDamage).toBeGreaterThan(0);
    expect(result.reactions.naturalBleedDamage).toBe(20);
  });

  it("Toxic Shock only releases on a fresh successful Stun and consumes Poison", () => {
    const start = base({ enemyStatuses: { poison: 24, stun: 100 }, reactions: { naturalPoisonDamage: 20 } });
    const texts: CombatTextEvent[] = [];
    const result = hit(start, "stun", texts, 20);
    expect(reactions(texts)).toEqual(["toxicShock"]);
    expect(result.enemyStatuses.poison).toBe(0);
    expect(result.reactions.weakenNextAttack).toBe(true);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(reactionsAfter({ ...result, enemyHealth: 200 }, "stun")).toEqual([]);
  });

  it("Toxic Shock weakens every hit of the next actual attack and survives utility", () => {
    const start = base({ reactions: { weakenNextAttack: true } });
    const utility = {
      ...getEnemyAbilityCard("slash"),
      effects: [{ kind: "player-status" as const, status: "block" as const, amount: 1 }],
    };
    const afterUtility = applyEnemyAbility(start, utility, []);
    expect(afterUtility.reactions.weakenNextAttack).toBe(true);
    const multiHit = {
      ...getEnemyAbilityCard("slash"),
      effects: [
        { kind: "damage" as const, damageType: "physical" as const, amount: 10 },
        { kind: "damage" as const, damageType: "physical" as const, amount: 10 },
      ],
    };
    const normal = applyEnemyAbility(
      { ...afterUtility, reactions: { ...afterUtility.reactions, weakenNextAttack: false } },
      multiHit,
      [],
    );
    const weakened = applyEnemyAbility(afterUtility, multiHit, []);
    expect(normal.playerHealth).toBe(180);
    expect(weakened.playerHealth).toBe(190);
    expect(weakened.reactions.weakenNextAttack).toBe(false);
  });

  it("save/resume preserves paid readiness and pending debuffs without refreshing them", () => {
    const state = base({ reactions: { naturalPoisonDamage: 30, weakenNextAttack: true, healingReductionTurns: 2 } });
    const saved = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(saved.reactions).toMatchObject({
      naturalPoisonDamage: 30,
      weakenNextAttack: true,
      healingReductionTurns: 2,
    });
    expect(PersistedBattleStateSchema.parse({ ...state, reactions: {} }).reactions.weakenNextAttack).toBe(false);
    const legacy = PersistedBattleStateSchema.parse({
      ...state,
      enemyCC: { ...state.enemyCC, freezeSkipTurns: 1, stunSkipTurns: 1 },
      reactions: {
        shatterDamage: 0,
        frostfireDamage: 0,
        thunderclapDamage: 12,
        wildfireDamage: 5,
        wildfirePendingTickDamage: 3,
      },
    });
    expect(legacy.reactions).toMatchObject({
      ruptureDamage: 12,
      naturalBurnDamage: 13,
      shatterDamage: 0,
      frostfireDamage: 0,
    });
  });

  it("secondary attacks cannot spend primary reaction readiness", () => {
    const start = base({ enemyCC: { freezeSkipTurns: 1 }, reactions: { shatterDamage: 10 } });
    const texts: CombatTextEvent[] = [];
    const result = resolveSecondaryAction(start, "repeat", (current) => hit(current, "physical", texts));
    expect(reactions(texts)).toEqual([]);
    expect(result.reactions.shatterDamage).toBe(10);
  });
});
function reactionsAfter(state: BattleState, type: DamageType) {
  const texts: CombatTextEvent[] = [];
  hit(state, type, texts);
  return reactions(texts);
}
