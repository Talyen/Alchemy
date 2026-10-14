import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { applyCardEffects } from "@/lib/battle";
import { cardById } from "@/lib/game-data";
import { checkHealthThresholds } from "@/lib/battle/status-player";
import { applyAbilityDamage } from "@/lib/battle/enemy-ability-damage";
import { createEnemyAbilityContext } from "@/lib/battle/enemy-ability-context";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { buildWishOptions } from "@/lib/battle/wish";

const oversized = Number.MAX_VALUE;
function restore(patch: Record<string, unknown>) {
  return {
    ...PersistedBattleStateSchema.parse({ ...defaultBattleState(), appliesFightPacing: false, ...patch }),
    rng: () => 0.99,
  };
}

describe("saved battle recovery boundaries", () => {
  it("repairs malformed card healing dictionaries before a Potion is played", () => {
    const state = restore({
      playerHealth: 10,
      playerMaxHealth: 50,
      talentEffects: { cardHealMultipliers: null, cardHealBonus: { "health-potion": "broken" } },
    });
    expect(applyCardEffects(state, cardById["health-potion"]!, []).playerHealth).toBe(18);
  });
  it("drops malformed threshold rewards before the next Health loss", () => {
    const state = restore({
      playerHealth: 20,
      playerMaxHealth: 50,
      talentEffects: {
        healthThresholdArmor: [null, { threshold: 50, amount: 3 }],
        healthThresholdBlockOnce: { threshold: 50, amount: "broken" },
      },
    });
    const result = checkHealthThresholds(30, 20, state, []);
    expect(result.playerStatuses.armor).toBe(3);
    expect(result.playerStatuses.block).toBe(0);
  });
  it("rejects unsafe talent counts before Wish selection can loop indefinitely", () => {
    const state = restore({ talentEffects: { wishExtraChoices: oversized, potionPotency: 1.2 } });
    expect(state.talentEffects.wishExtraChoices).toBe(0);
    expect(state.talentEffects.potionPotency).toBe(1.2);
  });
  it("bounds recovered Wish work to the available cards even for large safe counts", () => {
    const state = restore({ talentEffects: { wishExtraChoices: 1e12 } });
    let rolls = 0;
    const options = buildWishOptions(
      {
        ...state,
        rng: () => {
          if (++rolls > 10000) throw new Error("Wish selection exceeded its card pool");
          return 0.99;
        },
      },
      undefined,
    );
    expect(options.length).toBeGreaterThan(0);
    expect(new Set(options.map((card) => card.id)).size).toBe(options.length);
  });
  it("repairs malformed Trinket rewards before healing changes status stacks", () => {
    const state = restore({
      playerHealth: 10,
      playerMaxHealth: 50,
      trinketEffects: { grovesFavorThornsOnHealthRestore: "2", firstBurnDoubled: "false" },
    });
    const result = applyCardEffects(state, cardById["health-potion"]!, []);
    expect(result.playerStatuses.thorns).toBe(0);
    expect(state.trinketEffects.firstBurnDoubled).toBe(false);
  });
  it("repairs defenses and statuses too large for combat to decrement", () => {
    const state = restore({
      enemyMitigation: { armor: oversized, block: 2, forge: 0 },
      playerStatuses: { poison: oversized },
      enemyStatuses: { burn: oversized },
    });
    expect(state.enemyMitigation.armor).toBe(0);
    expect(state.enemyMitigation.block).toBe(2);
    expect(state.playerStatuses.poison).toBe(0);
    expect(state.enemyStatuses.burn).toBe(0);
  });
  it("restarts an unsafe Death's Door grace counter with the ordinary recovery window", () => {
    const state = restore({
      deathsDoorActive: true,
      deathsDoorUsed: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: oversized,
    });
    expect(state.deathsDoorGraceTurnsRemaining).toBeNull();
    expect(advanceToPlayerTurn(state).deathsDoorGraceTurnsRemaining).toBe(1);
  });
  it("drops overflowing difficulty damage instead of making enemy attacks harmless", () => {
    const state = restore({
      playerHealth: 50,
      playerMaxHealth: 50,
      difficultyModifiers: [{ kind: "enemy-damage-multiplier", amount: oversized }],
    });
    expect(state.difficultyModifiers).toEqual([]);
    const result = applyAbilityDamage(
      state,
      { kind: "damage", damageType: "physical", amount: 6 },
      createEnemyAbilityContext(state, true),
      [],
    );
    expect(result.playerHealth).toBeLessThan(50);
  });
});
