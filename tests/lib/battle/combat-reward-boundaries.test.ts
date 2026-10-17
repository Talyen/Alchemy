import { describe, expect, it } from "vitest";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { resolveBattleStart } from "@/lib/battle/battle-start";
import { cardById } from "@/lib/game-data";
import { regressionBattle } from "../../fixtures/battle";
import { addGoldWithCombatText } from "@/lib/battle/player-rewards";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import type { CombatTextEvent } from "@/lib/battle";

describe("combat reward boundaries", () => {
  it("does not repeat an automatically played card after its first copy wins combat", () => {
    const card = { ...cardById["sunburst"]!, uid: 1 };
    const freeze = cardById["ray-of-frost"]!;
    const state = regressionBattle({
      deck: [card, freeze],
      enemyHealth: 1,
      enemyMaxHealth: 100,
      playerHealth: 10,
      playerMaxHealth: 100,
      flags: { dodgeNextAttack: true },
      gearEffects: { dodgeDrawAndPlay: 1, elementalTwinCasting: 1 },
      talentEffects: { burnCardPlayTwiceChance: 100 },
      rng: () => 0.1,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 1 }, [], {
      canDodge: true,
    }).state;
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(12);
    expect(next.discard).toHaveLength(1);
    expect(next.deck).toEqual([freeze]);
    expect(next.hand).toEqual([]);
  });

  it("settles a Companion's empty Bloodrush draw before its later Leech reward", () => {
    const state = regressionBattle({
      talentEffects: { drawOnBleedDamageChance: 100, companionLeechChance: 100 },
      gearEffects: { healthOnWish: 3 },
    });
    const next = resolveBattleStart(
      {
        runDeck: [],
        playerHealth: 14,
        maxHealth: 30,
        currentEnemy: { ...state.currentEnemy, traits: [] },
        talentEffects: state.talentEffects,
        gearEffects: state.gearEffects,
        appliesFightPacing: false,
        difficultyModifiers: [{ kind: "start-companion", companionId: "wolf" }],
      },
      { rng: () => 0.1 },
    ).state;
    expect(next.wishOptions?.length).toBeGreaterThan(0);
    expect(next.playerHealth).toBe(18);
    expect(next).not.toHaveProperty("onEmptyDraw");
  });

  it("caps combat Gold awards without losing the purse or paying phantom gain rewards", () => {
    const state = regressionBattle({
      gold: Number.MAX_SAFE_INTEGER - 1,
      playerHealth: 5,
      playerMaxHealth: 30,
      gearEffects: { healOnCombatGoldGain: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const next = addGoldWithCombatText(state, 4, texts);
    expect(next.gold).toBe(Number.MAX_SAFE_INTEGER);
    expect(next.playerHealth).toBe(7);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 1 });
    expect(addGoldWithCombatText(next, 4, [])).toBe(next);
  });

  it("restores a combat purse at the largest supported save balance", () => {
    const state = regressionBattle({ gold: Number.MAX_SAFE_INTEGER });
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.gold).toBe(state.gold);
  });
});
