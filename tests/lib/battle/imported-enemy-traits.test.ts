import { cardById } from "@/lib/game-data";
import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { getEnemyDamageMultiplier } from "@/lib/battle/status-helpers";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyHealingWithCombatText } from "@/lib/battle/combat-text";
import { processEnemyRegeneration } from "@/lib/battle/enemy-turn-traits";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
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
    const state = stateForEnemy("bandit", {});
    const first = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    const second = applyEnemyAbility(
      first,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    expect(first.playerHealth).toBe(92);
    expect(second.playerHealth).toBe(88);
    expect(second.flags.enemyFirstHitDoubleUsed).toBe(true);
  });

  it("does not consume Bandit's first-hit modifier on a dodged packet", () => {
    let calls = 0;
    const state = stateForEnemy("bandit", {
      rng: () => (calls++ === 0 ? 0 : 0.99),
    });
    const dodged = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    const landed = applyEnemyAbility(
      dodged,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    expect(dodged.playerHealth).toBe(100);
    expect(dodged.flags.enemyFirstHitDoubleUsed).toBe(false);
    expect(landed.playerHealth).toBe(92);
  });

  it("consumes Bandit's first-hit modifier on a fully Blocked packet", () => {
    const state = stateForEnemy("bandit", {
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    expect(result.playerStatuses.block).toBe(2);
    expect(result.playerHealth).toBe(100);
    expect(result.flags.enemyFirstHitDoubleUsed).toBe(true);
    const second = applyEnemyAbility(
      result,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    expect(second.playerHealth).toBe(98);
    expect(second.playerStatuses.block).toBe(0);
  });

  it("doubles Ogre Block removal and gives Giant Snake's poison an extra strip", () => {
    const ogre = applyEnemyAbility(
      stateForEnemy("ogre", {
        playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      [],
    );
    const snake = applyEnemyAbility(
      stateForEnemy("giant-snake", {
        playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "poison", amount: 3 }] }),
      [],
    );
    expect(ogre.playerStatuses.block).toBe(2);
    expect(ogre.playerHealth).toBe(100);
    expect(snake.playerStatuses.block).toBe(1);
    expect(snake.playerHealth).toBe(100);
  });

  it("applies player mitigation to Pyromancer Burn", () => {
    const state = stateForEnemy("pyromancer", {
      playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      talentEffects: { ...stateForEnemy("pyromancer").talentEffects, damageReduction: 2, burnDamageReduction: 2 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 3 }] }),
      [],
    );
    expect(result.playerHealth).toBe(100);
    expect(result.playerStatuses.block).toBe(2);
  });

  it("applies Burn resistance to unblocked Pyromancer attacks", () => {
    const state = stateForEnemy("pyromancer", {
      talentEffects: { ...stateForEnemy("pyromancer").talentEffects, burnDamageReduction: 2 },
    });
    expect(
      applyEnemyAbility(state, makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 3 }] }), [])
        .playerHealth,
    ).toBe(99);
  });

  it.each([
    ["fire-imp", "fireball", "burn", 3],
    ["giant-spider", "venom-fangs", "poison", 3],
    ["winter-wolf", "fangs", "freeze", 1],
  ] as const)("applies %s's %s attack rider", (id, ability, status, expected) => {
    const result = applyEnemyAbility(stateForEnemy(id), cardById[ability], []);
    expect(result.playerStatuses[status]).toBe(expected);
  });

  it.each([
    ["hellhound", "burning-blade", { burn: 1 }, 96],
    ["dire-wolf", "fangs", { bleed: 1 }, 95],
    ["banshee", "bash", { stun: 1 }, 97],
    ["ice-wraith", "frostbolt", undefined, 98],
  ] as const)("modifies %s damage from its player/enemy state", (id, ability, statuses, expectedHealth) => {
    const result = applyEnemyAbility(
      stateForEnemy(id, {
        ...(statuses ? { playerStatuses: defaultPlayerStatusValues(statuses) } : {}),
        ...(id === "ice-wraith" ? { enemyStatuses: defaultEnemyStatusValues({ freeze: 1 }) } : {}),
      }),
      cardById[ability],
      [],
    );
    expect(result.playerHealth).toBe(expectedHealth);
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

  it("purges Banshee buffs after a fully Blocked attack", () => {
    const texts: Parameters<typeof applyEnemyAbility>[2] = [];
    const result = applyEnemyAbility(
      stateForEnemy("banshee", {
        playerStatuses: defaultPlayerStatusValues({ block: 10, haste: 2 }),
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] }),
      texts,
    );
    expect(result.playerHealth).toBe(100);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.haste).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "block", text: "Purged" });
  });

  it("damages Blood Countess when either combatant restores Health and pays kill rewards", () => {
    const base = stateForEnemy("blood-countess");
    const playerHealState = stateForEnemy("blood-countess", {
      enemyHealth: 1,
      playerHealth: 90,
      gold: 0,
      gearEffects: { ...base.gearEffects, goldOnKill: 3 },
    });
    const playerHealResult = applyHealingWithCombatText(playerHealState, 1, []);
    expect(playerHealResult.enemyHealth).toBe(0);
    expect(playerHealResult.gold).toBe(3);

    const enemyHealResult = processEnemyRegeneration(
      stateForEnemy("blood-countess", { enemyHealth: 90, enemyRegeneration: 3 }),
      [],
    );
    expect(enemyHealResult.enemyHealth).toBe(92);
  });

  it("halves Brawler's first attack after Stun resolves", () => {
    const stunned = resolveStunTrigger(
      stateForEnemy("brawler", {
        enemyStatuses: defaultEnemyStatusValues({ stun: 50 }),
      }),
      [],
    );
    const result = applyEnemyAbility(
      {
        ...stunned,
        enemyCC: defaultCcState(),
      },
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
      [],
    );
    expect(result.flags.enemyBrawlerDamagePenalty).toBe(false);
    expect(result.playerHealth).toBe(95);
  });

  it("does not retain Blood Countess's retired Bleed aura", () => {
    const result = endPlayerTurn(
      stateForEnemy("blood-countess", { enemyCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 } }),
    );
    expect(result.state.playerStatuses.bleed).toBe(0);
    expect(result.enemyResolutionCombatTexts).toEqual([]);
  });
});
