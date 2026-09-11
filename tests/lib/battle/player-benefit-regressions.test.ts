import { describe, expect, it } from "vitest";
import { companionLibrary } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { removeHarmfulPlayerStatuses, applyCardHealing } from "@/lib/battle/status-player";
import { applyLeechHealing } from "@/lib/battle/damage-rider-leech";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("player benefit regressions", () => {
  it.each([false, true])("Free Follow-up survives the next turn, including Companion Stun: %s", (companion) => {
    const card = makeTestCard({ cost: 1, effects: [] });
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 100 },
      talentEffects: { nextCardFreeOnStun: true },
      activeCompanion: {
        ...companionLibrary.wolf,
        turnStartEffects: [{ kind: "damage", damageType: "stun", amount: 1 }],
      },
    });
    const stunned = companion ? processCompanionTurnStart(state, []) : resolveStunTrigger(state, []);
    expect(stunned.flags.nextCardCostReduction).toBeGreaterThan(0);
    const nextTurn = advanceToPlayerTurn(stunned);
    const result = playBattleCardResolved({ ...nextTurn, mana: 0, hand: [card] }, card.id, 0).state;
    expect(result.hand).toHaveLength(0);
    expect(result.flags.nextCardCostReduction).toBe(0);
  });

  it.each(["burn", "poison", "bleed", "health-cost", "self-damage"] as const)(
    "Desperate Guard responds to a surviving half-Health crossing from %s",
    (source) => {
      const state = patchBattleState({
        playerHealth: 50,
        playerMaxHealth: 100,
        talentEffects: { healthThresholdBlock: { threshold: 50, amount: 6 } },
      });
      const result =
        source === "health-cost" || source === "self-damage"
          ? applyCardEffects(
              state,
              makeTestCard({
                effects: [
                  source === "health-cost"
                    ? { kind: "lose-health", amount: 1 }
                    : { kind: "self-damage", damageType: "burn", amount: 1 },
                ],
              }),
              [],
            )
          : tickPlayerStatuses({ ...state, playerStatuses: { ...state.playerStatuses, [source]: 1 } }, []);
      expect(result.playerHealth).toBe(49);
      expect(result.playerStatuses.block).toBe(6);
    },
  );

  it("Paralytic Venom can stop the upcoming enemy action when a Poison tick Stuns", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: 40 },
      talentEffects: { poisonStunChance: 100 },
    });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAbility).toBe(false);
    expect(result.state.lastEnemyAbilityId).toBe(state.lastEnemyAbilityId);
    expect(result.state.playerHealth).toBe(state.playerHealth);
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.enemyCC.stunSkipTurns).toBe(0);
  });

  it("Last Resort cleanses the harmful status inflicted by the triggering attack", () => {
    const state = patchBattleState({
      playerHealth: 26,
      playerMaxHealth: 100,
      playerStatuses: { burn: 1 },
      talentEffects: { cleanseBelowHealthPercent: 25 },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "poison", amount: 2 }, []);
    expect(result.playerHealth).toBe(24);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.burn).toBe(0);
  });

  it("Mending boosts cleansing and incidental Leech as well as card healing, once each", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 100,
      playerStatuses: { poison: 1 },
      talentEffects: { healMultiplier: 1.1, healOnStatusCleanse: 10 },
    });
    expect(removeHarmfulPlayerStatuses(state, 1, []).playerHealth).toBe(21);
    expect(applyLeechHealing(state, 10, []).playerHealth).toBe(21);
    expect(applyCardEffects(state, makeTestCard({ effects: [{ kind: "heal", amount: 10 }] }), []).playerHealth).toBe(
      21,
    );
    const full = { ...state, playerHealth: 90, talentEffects: { ...state.talentEffects, cleanseOnCardOverheal: true } };
    expect(applyCardHealing(full, 10, []).playerStatuses.poison).toBe(0);
  });
});
