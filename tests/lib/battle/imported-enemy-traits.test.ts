import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { getEnemyDamageMultiplier } from "@/lib/battle/status-helpers";
import { processEnemyAttack, processEnemyTraitActionStart } from "@/lib/battle/enemy-turn-attack";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { resolvePlayerCrowdControlTriggers } from "@/lib/battle/status-cc";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { makeTestBattleState } from "../../fixtures/battle";
import {
  defaultCcState,
  defaultEnemyStatusValues,
  defaultPlayerStatusValues,
} from "../../fixtures/default-battle-state";

function stateForEnemy(id: string, overrides: Partial<ReturnType<typeof makeTestBattleState>> = {}) {
  const enemy = enemyBestiary.find((candidate) => candidate.id === id);
  if (!enemy) throw new Error(`Unknown enemy ${id}`);
  return makeTestBattleState({
    currentEnemy: enemy,
    enemyAttackEffects: enemy.attackEffects,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 100,
    playerMaxHealth: 100,
    rng: () => 0.99,
    appliesFightPacing: false,
    ...overrides,
  });
}

describe("imported enemy trait damage rules", () => {
  it.each([
    ["will-o-wisp", "physical", 0.7],
    ["ogre", "holy", 1.3],
    ["giant-spider", "burn", 1.3],
    ["dire-wolf", "physical", 0.9],
    ["paladin", "holy", 0.7],
    ["ice-wraith", "physical", 0.7],
    ["yeti", "freeze", 0.7],
    ["earth-elemental", "burn", 0.8],
  ] as const)("applies %s %s multiplier", (id, damageType, expected) => {
    const state = stateForEnemy(id);
    expect(getEnemyDamageMultiplier(state, damageType)).toBe(expected);
  });
});

describe("imported enemy attack reactions", () => {
  it("doubles Bandit's first successful damage packet only", () => {
    const state = stateForEnemy("bandit", {
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const first = processEnemyAttack(state, []);
    const second = processEnemyAttack(first, []);
    expect(first.playerHealth).toBe(92);
    expect(second.playerHealth).toBe(88);
    expect(second.flags.enemyFirstHitDoubleUsed).toBe(true);
  });

  it("does not consume Bandit's first-hit modifier on a dodged packet", () => {
    let calls = 0;
    const state = stateForEnemy("bandit", {
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
      rng: () => (calls++ === 0 ? 0 : 0.99),
    });
    const dodged = processEnemyAttack(state, []);
    const landed = processEnemyAttack(dodged, []);
    expect(dodged.playerHealth).toBe(100);
    expect(dodged.flags.enemyFirstHitDoubleUsed).toBe(false);
    expect(landed.playerHealth).toBe(92);
  });

  it("consumes Bandit's first-hit modifier on a fully Blocked packet", () => {
    const state = stateForEnemy("bandit", {
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
    });
    const result = processEnemyAttack(state, []);
    expect(result.playerStatuses.block).toBe(2);
    expect(result.playerHealth).toBe(100);
    expect(result.flags.enemyFirstHitDoubleUsed).toBe(true);
    const second = processEnemyAttack(result, []);
    expect(second.playerHealth).toBe(98);
    expect(second.playerStatuses.block).toBe(0);
  });

  it("doubles Ogre Block removal and gives Giant Snake's poison an extra strip", () => {
    const ogre = processEnemyAttack(
      stateForEnemy("ogre", {
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
        playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      }),
      [],
    );
    const snake = processEnemyAttack(
      stateForEnemy("giant-snake", {
        enemyAttackEffects: [{ kind: "damage", damageType: "poison", amount: 3 }],
        playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      }),
      [],
    );
    expect(ogre.playerStatuses.block).toBe(2);
    expect(ogre.playerHealth).toBe(100);
    expect(snake.playerStatuses.block).toBe(1);
    expect(snake.playerHealth).toBe(100);
  });

  it("lets Pyromancer Burn bypass Block and player damage reduction", () => {
    const state = stateForEnemy("pyromancer", {
      playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      talentEffects: { ...stateForEnemy("pyromancer").talentEffects, damageReduction: 2, burnDamageReduction: 2 },
    });
    const result = processEnemyAttack(state, []);
    expect(result.playerHealth).toBe(97);
    expect(result.playerStatuses.block).toBe(5);
  });

  it.each([
    ["fire-imp", "burn", 3],
    ["giant-spider", "poison", 3],
    ["winter-wolf", "freeze", 1],
  ] as const)("applies %s's %s attack rider", (id, status, expected) => {
    const result = processEnemyAttack(stateForEnemy(id), []);
    expect(result.playerStatuses[status]).toBe(expected);
  });

  it.each([
    ["hellhound", { burn: 1 }, 93],
    ["dire-wolf", { bleed: 1 }, 97],
    ["banshee", { stun: 1 }, 97],
    ["ice-wraith", undefined, 98],
  ] as const)("modifies %s damage from its player/enemy state", (id, statuses, expectedHealth) => {
    const result = processEnemyAttack(
      stateForEnemy(id, {
        ...(statuses ? { playerStatuses: defaultPlayerStatusValues(statuses) } : {}),
        ...(id === "ice-wraith" ? { enemyStatuses: defaultEnemyStatusValues({ freeze: 1 }) } : {}),
      }),
      [],
    );
    expect(result.playerHealth).toBe(expectedHealth);
  });

  it("primes Blood Cultist's next attack when a Bleed tick hurts the player", () => {
    const state = stateForEnemy("blood-cultist", {
      playerStatuses: defaultPlayerStatusValues({ bleed: 3 }),
    });
    const result = tickPlayerStatuses(state, []);
    expect(result.playerHealth).toBe(97);
    expect(result.flags.enemyNextAttackCrit).toBe(true);
  });

  it("gives Vampire a seeded leech roll and primes when it reaches full Health", () => {
    let calls = 0;
    const state = stateForEnemy("vampire", {
      enemyHealth: 95,
      rng: () => (calls++ === 0 ? 0.99 : 0),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = processEnemyAttack(state, []);
    expect(result.enemyHealth).toBe(100);
    expect(result.flags.enemyNextAttackBonus).toBe(1);
  });

  it("chains Cleric healing, Zealot Holy priming, and Paladin Block", () => {
    const cleric = processEnemyAttack(
      stateForEnemy("cleric", {
        enemyHealth: 90,
        enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 1 }],
      }),
      [],
    );
    const zealot = processEnemyAttack(
      stateForEnemy("zealot", {
        enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 1 }],
      }),
      [],
    );
    const paladin = processEnemyAttack(
      stateForEnemy("paladin", {
        enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 1 }],
      }),
      [],
    );
    expect(cleric.enemyHealth).toBe(91);
    expect(zealot.flags.enemyNextAttackHolyBonus).toBe(1);
    expect(paladin.enemyMitigation.block).toBe(1);

    const zealotTurn2 = processEnemyAttack(zealot, []);
    expect(zealotTurn2.flags.enemyNextAttackHolyBonus).toBe(1);
  });

  it("gives Yeti Block when the player becomes Frozen", () => {
    const state = stateForEnemy("yeti", {
      playerHealth: 10,
      playerMaxHealth: 10,
      playerStatuses: defaultPlayerStatusValues({ freeze: 5 }),
    });
    const result = resolvePlayerCrowdControlTriggers(state, []);
    expect(result.enemyMitigation.block).toBe(1);
    expect(result.playerCC.freezeSkipTurns).toBeGreaterThan(0);
  });

  it("halves Brawler's first attack after Stun resolves", () => {
    const stunned = resolveStunTrigger(
      stateForEnemy("brawler", {
        enemyStatuses: defaultEnemyStatusValues({ stun: 50 }),
      }),
      [],
    );
    const result = processEnemyAttack(
      {
        ...stunned,
        enemyCC: defaultCcState(),
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      },
      [],
    );
    expect(result.flags.enemyBrawlerDamagePenalty).toBe(false);
    expect(result.playerHealth).toBe(95);
  });

  it("applies boss auras during skipped turns", () => {
    const texts = [] as Parameters<typeof processEnemyTraitActionStart>[1];
    const result = processEnemyTraitActionStart(
      stateForEnemy("blood-countess", { enemyCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 } }),
      texts,
    );
    expect(result.playerStatuses.bleed).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "bleed", amount: 1 });
  });
});
