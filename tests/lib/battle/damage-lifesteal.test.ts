import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/follow-up-hit-resolution";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById } from "@/lib/game-data";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";

describe("dealDamageToEnemy — lifesteal", () => {
  it.each([
    [5, 1],
    [10, 0.5],
  ])("rounds damage %i Leech and its healing multiplier %s separately", (damage, multiplier) => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 20,
      talentEffects: { healMultiplier: multiplier },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", damage, { lifesteal: true })] });
    const texts = makeCombatTexts();
    const result = dealDamage(state, card, texts);
    expect(result.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
    expect(state.playerHealth).toBe(20);
  });
});

describe("low-health Leech bonuses", () => {
  it.each([14, 15, 16])("requires strictly below half Health at %s/30", (health) => {
    const desperate = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 30,
      talentEffects: { leechDesperateMultiplier: 20 },
    });
    expect(applyLifestealAndPlayerHitTriggers(desperate, 10, []).playerHealth - health).toBe(health < 15 ? 6 : 5);
  });
});

describe("card Leech resolution", () => {
  it("Fangs retains Clean Slate eligibility for its deferred Bleed Leech", () => {
    const card = cardById.fangs!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 39,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { poison: 4 },
      talentEffects: { cleanseOnCardOverheal: true },
      rng: () => 0.4,
    });
    const hit = playBattleCardResolved(state, card.id, 0).state;
    expect(hit.playerHealth).toBe(40);
    expect(hit.playerStatuses.poison).toBe(4);
    expect(hit.pendingCardBleedLeechHealing).toBe(2);
    expect(tickEnemyStatuses(hit, []).playerStatuses.poison).toBe(0);
    expect(detonateEnemyStatuses(hit, ["bleed"], []).playerStatuses.poison).toBe(0);
    expect(tickEnemyStatuses({ ...hit, pendingCardBleedLeechHealing: 0 }, []).playerStatuses.poison).toBe(4);
  });

  it.each([
    { enemyHealth: 1, restoredHealth: 1 },
    { enemyHealth: 10, restoredHealth: 2 },
  ])(
    "Venom Fangs Leech caps restoration at Poison Health loss with $enemyHealth enemy Health",
    ({ enemyHealth, restoredHealth }) => {
      const card = cardById["venom-fangs"]!;
      const state = patchBattleState({
        hand: [card],
        enemyHealth,
        playerHealth: 10,
        gearEffects: { flatPoisonDamage: 3 },
        rng: () => 0.99,
      });
      const result = playBattleCardResolved(state, card.id, 0).state;
      expect(result.enemyHealth).toBe(Math.max(0, enemyHealth - 4));
      expect(result.playerHealth).toBe(10 + restoredHealth);
    },
  );
});
