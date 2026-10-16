import { describe, expect, it } from "vitest";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { cardById, enemyById, getEnemyAbilityCard } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
function battle(patch: Parameters<typeof patchBattleState>[0] = {}) {
  return patchBattleState({
    playerHealth: 1,
    playerMaxHealth: 40,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    deathsDoorUsed: true,
    currentEnemy: enemyById["fire-elemental"]!,
    rng: () => 0.99,
    ...patch,
  });
}
describe("retaliation cutoffs", () => {
  it("Saintfall settles its Holy retaliation before healing", () => {
    const initial = battle({
      playerStatuses: { block: 2 },
      gearEffects: { saintfallRetribution: 4 },
    });
    const out = resolveEnemyAttackHit(initial, { kind: "damage", damageType: "burn", amount: 2 }, [], {
      canDodge: false,
    }).state;
    expect(out.playerHealth).toBe(0);
  });
  it("Thorns settles retaliation before Spiteful healing and Venomspine damage", () => {
    const initial = battle({
      playerStatuses: { block: 1, thorns: 2 },
      gearEffects: { healOnFirstThornsDamageEachTurn: 4, poisonOnThornsDamage: 3 },
    });
    const out = applyEnemyAbility(initial, getEnemyAbilityCard("fireball"), []);
    expect(out.playerHealth).toBe(0);
    expect(out.enemyStatuses.poison).toBe(0);
  });
  it("Wardbreaker settles Purging damage before the interrupted card hit", () => {
    const card = cardById.fireball!;
    const initial = battle({
      hand: [card],
      enemyHealth: 3,
      enemyMitigation: { armor: 1 },
      gearEffects: { attackPurgeOncePerTurn: 1, holyOnPurge: 1 },
    });
    const out = playBattleCardResolved(initial, card.id, 0).state;
    expect(out.playerHealth).toBe(0);
    expect(out.enemyHealth).toBe(2);
  });
  it("a turn-start Emergency Wish settles before Gear regeneration", () => {
    const initial = battle({
      turn: 2,
      talentEffects: { burnOnWish: 1 },
      gearEffects: { healthPerTurn: 4 },
    });
    const out = advanceToPlayerTurn(initial, []);
    expect(out.playerHealth).toBe(0);
    expect(out.enemyHealth).toBe(99);
  });
});
