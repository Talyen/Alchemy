import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { companionLibrary, defaultCompanionBondLevels } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const countessAndCinder = [
  { id: "blood-countess", title: "Profane Blood", description: "" },
  { id: "cinder-skin", title: "Cinder Skin", description: "" },
];

describe("Leech and reaction ordering", () => {
  it("Blessed Leech does not heal a second time when the Holy hit already has explicit Leech", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "holy", amount: 20, lifesteal: true }],
    });
    const state = patchBattleState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { holyLifestealPercent: 50, leechHealingBonus: 1 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(21);
    expect(next.enemyHealth).toBe(80);

    const ordinary = { ...card, effects: [{ kind: "damage", damageType: "holy", amount: 20 } as const] };
    expect(playBattleCardResolved({ ...state, hand: [ordinary] }, ordinary.id, 0).state.playerHealth).toBe(21);
  });

  it("turn decay pays depletion rewards even when turn-start Purge immediately refills Block", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      playerStatuses: { block: 1 },
      enemyMitigation: { armor: 1 },
      deck: Array.from({ length: 4 }, () => makeTestCard()),
      talentEffects: { blockDepletedHeal: 2 },
      gearEffects: {
        turnStartPurgeChance: 100,
        blockOnPurge: 2,
        blockDepletedHeal: 3,
        thornsOnBlockDepleted: 3,
        thornsOnRetainedBlock: 5,
      },
      rng: () => 0.99,
    });
    const next = advanceToPlayerTurn(state);
    expect(next.playerHealth).toBe(15);
    expect(next.playerStatuses).toMatchObject({ block: 2, thorns: 3 });
    expect(next.enemyMitigation.armor).toBe(0);
  });

  it("fatal retaliation from turn-decay healing stops Forge grants and scheduled attacks", () => {
    const state = patchBattleState({
      turn: 2,
      playerHealth: 1,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      playerStatuses: { block: 1 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      roomScalingMultiplier: 4,
      currentEnemy: { traits: countessAndCinder },
      deck: Array.from({ length: 4 }, () => makeTestCard()),
      talentEffects: { blockDepletedHeal: 1 },
      gearEffects: { forgeEveryThreeTurns: 1 },
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "damage", damageType: "burn", amount: 200 }] }],
      rng: () => 0.99,
    });
    const next = advanceToPlayerTurn(state);
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(99);
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.pendingTurnStartEffects).toEqual(state.pendingTurnStartEffects);
  });

  it("fatal retaliation from Aftertaste stops Leftovers and later Consume rewards", () => {
    const card = makeTestCard({ consume: true, effects: [] });
    const state = patchBattleState({
      turn: 1,
      playerHealth: 1,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      roomScalingMultiplier: 4,
      currentEnemy: { traits: countessAndCinder },
      talentEffects: { healOnConsume: 1, goldOnConsume: 4, goldOnConsumeChance: 100 },
      rng: () => 0.1,
    });
    const next = handlePostPlayCardDestination(state, card);
    expect(next.playerHealth).toBe(0);
    expect(next.gold).toBe(state.gold);
    expect(next.exhausted).toEqual([card]);

    const safe = handlePostPlayCardDestination({ ...state, currentEnemy: { ...state.currentEnemy, traits: [] } }, card);
    expect(safe.playerHealth).toBe(2);
    expect(safe.gold).toBe(state.gold + 4);
  });

  it("settles Unbinding Strike's armor retaliation before Watchdog can heal with a Companion", () => {
    const state = patchBattleState({
      turn: 1,
      playerHealth: 1,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      playerStatuses: { block: 1, armor: 1 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      roomScalingMultiplier: 4,
      currentEnemy: {
        traits: [
          { id: "unbinding-strike", title: "Unbinding Strike", description: "" },
          { id: "cinder-skin", title: "Cinder Skin", description: "" },
        ],
      },
      activeCompanion: companionLibrary.pixie,
      talentEffects: {
        companionAttackOnBlockDepletedBelowHalf: true,
        companionBondLevels: { ...defaultCompanionBondLevels, pixie: 3 },
      },
      gearEffects: { stunOnArmorLostToAttack: 1 },
      rng: () => 0.99,
    });
    const texts: Array<import("@/lib/battle").CombatTextEvent> = [];
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 1 }, texts, {
      canDodge: true,
    }).state;
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(99);
    expect(texts.some((event) => event.kind === "heal")).toBe(false);
  });
});
