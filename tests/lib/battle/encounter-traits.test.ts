// Combat behavior tests for shared encounter traits.
import { describe, expect, it } from "vitest";
import { addEnemyStatus, endPlayerTurn, playBattleCardResolved, tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import type { BattleCard, BestiaryEntry } from "@/lib/game-data";
import { createTestBattleState } from "./test-state";

function enemyWith(...ids: (keyof typeof ENCOUNTER_TRAITS)[]): BestiaryEntry {
  return {
    id: "trait-test-enemy",
    title: "Trait Test Enemy",
    subtitle: "",
    descriptionLines: [],
    art: "",
    enemyType: "boss",
    traits: ids.map((id) => ENCOUNTER_TRAITS[id].enemyTrait),
    attackEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
  };
}

function card(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card",
    uid: 1,
    title: "Test Card",
    descriptionLines: [],
    art: "",
    cost: 0,
    effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    ...overrides,
  };
}

describe("encounter trait enemy actions", () => {
  it("scales buffs and damage with room depth only when the enemy attacks", () => {
    const currentEnemy = enemyWith("tempered", "reinforced", "zealot");
    const state = createTestBattleState({
      currentEnemy,
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 1 }],
      roomScalingMultiplier: 2,
      playerHealth: 30,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBe(2);
    expect(result.state.enemyMitigation.block).toBe(4);
    expect(result.state.playerHealth).toBe(25);
  });

  it("does not activate recurring traits on a skipped enemy action", () => {
    const currentEnemy = enemyWith("tempered", "zealot");
    const state = createTestBattleState({
      currentEnemy,
      enemyAttackEffects: currentEnemy.attackEffects,
      enemyStunSkipTurns: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBe(0);
    expect(result.state.playerHealth).toBe(state.playerHealth);
  });

  it("uses battle RNG for Septic", () => {
    const currentEnemy = enemyWith("septic");
    const poison = endPlayerTurn(createTestBattleState({ currentEnemy, enemyAttackEffects: [], rng: () => 0.1 })).state;
    const bleed = endPlayerTurn(createTestBattleState({ currentEnemy, enemyAttackEffects: [], rng: () => 0.9 })).state;
    expect(poison.playerStatuses.poison).toBe(1);
    expect(bleed.playerStatuses.bleed).toBe(1);
  });

  it("applies Plated, Reinforced, and Overgrowth before the attack", () => {
    const currentEnemy = enemyWith("plated", "reinforced", "overgrowth");
    const result = endPlayerTurn(
      createTestBattleState({
        currentEnemy,
        enemyAttackEffects: [],
        enemyHealth: 10,
        enemyMaxHealth: 20,
        roomScalingMultiplier: 2,
      }),
    ).state;
    expect(result.enemyMitigation.armor).toBe(2);
    expect(result.enemyMitigation.block).toBe(4);
    expect(result.enemyHealth).toBe(12);
  });

  it.each([
    ["combustible", "burn", 1],
    ["chilling", "freeze", 1],
    ["concussive", "stun", 1],
  ] as const)("applies %s typed damage and build-up", (traitId, status, amount) => {
    const currentEnemy = enemyWith(traitId);
    const result = endPlayerTurn(createTestBattleState({ currentEnemy, enemyAttackEffects: [] })).state;
    expect(result.playerStatuses[status]).toBe(amount);
    expect(result.playerHealth).toBe(30 - amount);
  });

  it("applies Zealot Holy damage without a status rider", () => {
    const currentEnemy = enemyWith("zealot");
    const result = endPlayerTurn(createTestBattleState({ currentEnemy, enemyAttackEffects: [] })).state;
    expect(result.playerHealth).toBe(28);
  });

  it("Caustic strips scaled Armor even when its hit is blocked", () => {
    const currentEnemy = enemyWith("caustic");
    const base = createTestBattleState();
    const result = endPlayerTurn(
      createTestBattleState({
        currentEnemy,
        enemyAttackEffects: [],
        roomScalingMultiplier: 2,
        playerStatuses: { ...base.playerStatuses, block: 10, armor: 3 },
      }),
    ).state;
    expect(result.playerStatuses.armor).toBe(1);
    expect(result.playerStatuses.poison).toBe(0);
  });

  it("Flesheater leeches from its hit and the following Bleed tick", () => {
    const currentEnemy = enemyWith("flesheater");
    const first = endPlayerTurn(
      createTestBattleState({ currentEnemy, enemyAttackEffects: [], enemyHealth: 10, enemyMaxHealth: 20 }),
    ).state;
    expect(first.enemyHealth).toBe(11);
    expect(first.playerStatuses.bleed).toBe(1);
    expect(first.pendingEnemyBleedLeechHealing).toBe(1);

    const texts: Parameters<typeof tickPlayerStatuses>[1] = [];
    const second = tickPlayerStatuses(first, texts);
    expect(second.enemyHealth).toBe(12);
    expect(second.pendingEnemyBleedLeechHealing).toBe(0);
  });

  it.each([
    ["anti-Leech talents", { blockEnemyLeech: true }, 0],
    ["Freeze regeneration blocking", { freezeBlocksRegen: true }, 1],
  ] as const)("Flesheater respects %s on its hit and Bleed tick", (_label, talentOverrides, enemyFreezeSkipTurns) => {
    const currentEnemy = enemyWith("flesheater");
    const base = createTestBattleState();
    const first = endPlayerTurn(
      createTestBattleState({
        currentEnemy,
        enemyAttackEffects: [],
        enemyHealth: 10,
        enemyMaxHealth: 20,
        enemyFreezeSkipTurns,
        talentEffects: { ...base.talentEffects, ...talentOverrides },
      }),
    ).state;
    expect(first.enemyHealth).toBe(10);

    const second = tickPlayerStatuses(first, []);
    expect(second.enemyHealth).toBe(10);
    expect(second.pendingEnemyBleedLeechHealing).toBe(0);
  });
});

describe("encounter trait card events", () => {
  it("retaliates once per multi-hit card and still retaliates after lethal damage", () => {
    const currentEnemy = enemyWith("thorns", "holy-retribution");
    const played = card({
      effects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "burn", amount: 2 },
      ],
    });
    const state = createTestBattleState({
      currentEnemy,
      enemyHealth: 1,
      enemyMaxHealth: 1,
      playerHealth: 10,
      hand: [played],
      mana: 1,
      turnPhase: "player",
    });
    const result = playBattleCardResolved(state, played.id, 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(8);
  });

  it("moves a played card to its destination when retaliation defeats the player", () => {
    const currentEnemy = enemyWith("thorns");
    const played = card({ consume: true });
    const result = playBattleCardResolved(
      createTestBattleState({
        currentEnemy,
        hand: [played],
        mana: 1,
        playerHealth: 1,
        deathsDoorUsed: true,
        turnPhase: "player",
      }),
      played.id,
      0,
    );

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.hand).toEqual([]);
    expect(result.state.exhausted).toContainEqual(played);
  });

  it("triggers Consume, Wish, and Nature reactions once per played card", () => {
    const currentEnemy = enemyWith("insatiable", "jealous", "rooted");
    const played = card({
      consume: true,
      effects: [
        { kind: "damage", damageType: "nature", amount: 1 },
        { kind: "wish", amount: 3 },
      ],
    });
    const state = createTestBattleState({ currentEnemy, hand: [played], mana: 1, turnPhase: "player" });
    const result = playBattleCardResolved(state, played.id, 0);
    expect(result.state.enemyPhysicalDamageBonus).toBe(2);
    expect(result.state.enemyMitigation.block).toBe(1);
  });

  it("activates Divine Aegis once on the first downward half-health crossing", () => {
    const currentEnemy = enemyWith("divine-aegis");
    const played = card({ effects: [{ kind: "damage", damageType: "holy", amount: 6 }] });
    const state = createTestBattleState({
      currentEnemy,
      enemyHealth: 10,
      enemyMaxHealth: 10,
      hand: [played],
      mana: 1,
      turnPhase: "player",
    });
    const first = playBattleCardResolved(state, played.id, 0).state;
    expect(first.enemyMitigation.armor).toBe(2);
    expect(first.enemyMitigation.block).toBe(4);
    expect(first.flags.divineAegisTriggered).toBe(true);
  });

  it("Braced halves Stun build-up", () => {
    const currentEnemy = enemyWith("braced");
    const played = card({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] });
    const state = createTestBattleState({ currentEnemy, hand: [played], mana: 1, turnPhase: "player" });
    const result = playBattleCardResolved(state, played.id, 0).state;
    expect(result.enemyStatuses.stun).toBe(2);
  });

  it("Braced halves indirect Stun build-up", () => {
    const state = createTestBattleState({ currentEnemy: enemyWith("braced") });
    expect(addEnemyStatus(state, "stun", 3).enemyStatuses.stun).toBe(2);
  });

  it("uses the persistent Physical bonus on later enemy attacks", () => {
    const currentEnemy = enemyWith("insatiable");
    const played = card({ consume: true, effects: [] });
    const afterCard = playBattleCardResolved(
      createTestBattleState({ currentEnemy, hand: [played], mana: 1, turnPhase: "player" }),
      played.id,
      0,
    ).state;
    const afterTurn = endPlayerTurn({
      ...afterCard,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    }).state;
    expect(afterTurn.playerHealth).toBe(afterCard.playerHealth - 2);
  });

  it("activates Divine Aegis when a DoT crosses half health", () => {
    const currentEnemy = enemyWith("divine-aegis");
    const base = createTestBattleState();
    const result = tickEnemyStatuses(
      createTestBattleState({
        currentEnemy,
        enemyHealth: 6,
        enemyMaxHealth: 10,
        enemyStatuses: { ...base.enemyStatuses, burn: 2 },
      }),
      [],
    );
    expect(result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyMitigation.armor).toBe(2);
    expect(result.enemyMitigation.block).toBe(4);
  });
});
