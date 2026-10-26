import { describe, expect, it } from "vitest";
import { getImmediateDamage, getImmediateDefense } from "@/lib/battle/autoplay-policy";
import { cardById, companionLibrary } from "@/lib/game-data";
import { findBestPlayableHandCard } from "@/features/alchemy/run-loop/battle/playable-hand";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import type { CombatTextEvent } from "@/lib/battle/types";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { applyEmergencyWishForEmptyDraw } from "@/lib/battle/wish";
import { applyScaledLeechHealing } from "@/lib/battle/damage-rider-leech";
import { makeTestCard, regressionBattle, type BattleStatePatch } from "../../fixtures/battle";

function fragileBattle(patch: BattleStatePatch = {}) {
  return regressionBattle({
    playerHealth: 1,
    playerMaxHealth: 30,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    deathsDoorUsed: true,
    roomScalingMultiplier: 10,
    currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
    onEmptyDraw: (state, amount, texts) =>
      resolvePendingBattleReactions(applyEmergencyWishForEmptyDraw(state, amount, texts), texts),
    ...patch,
  });
}

describe("combat admission, reward, and autoplay regressions", () => {
  it("stops Stun rewards when Stun Insight's Emergency Wish settles fatal retaliation", () => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "stun", amount: 1 }] });
    const state = fragileBattle({
      hand: [card],
      enemyStatuses: { stun: 49 },
      talentEffects: { drawOnStun: 1, blockOnStun: 4, nextCardFreeOnStun: true },
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.block).toBe(0);
    expect(next.flags.nextCardCostReduction).toBe(0);
    const survived = playBattleCardResolved({ ...state, deathsDoorUsed: false }, card.id, 0).state;
    expect(survived.deathsDoorActive).toBe(true);
    expect(survived.playerStatuses.block).toBe(4);
    expect(survived.flags.nextCardCostReduction).toBeGreaterThan(0);
  });

  it.each(["tick", "detonation"] as const)(
    "does not pay Cutpurse after a Bleed %s's Bloodrush draw defeats the hero",
    (mode) => {
      const state = fragileBattle({
        enemyStatuses: { bleed: 2 },
        talentEffects: { drawOnBleedDamageChance: 100 },
        trinketEffects: { cutpurseGoldChance: 100 },
      });
      const texts: CombatTextEvent[] = [];
      const next = mode === "tick" ? tickEnemyStatuses(state, texts) : detonateEnemyStatuses(state, ["bleed"], texts);
      expect(next.playerHealth).toBe(0);
      expect(next.gold).toBe(state.gold);
      expect(texts).toContainEqual(
        expect.objectContaining({ target: "enemy", kind: "damage", stat: "bleed", amount: 2 }),
      );
    },
  );

  it("cannot start a follow-up hit after a nested reaction has defeated its owner", () => {
    const state = fragileBattle({ playerHealth: 0, enemyHealth: 1 });
    const next = resolveFollowUpHit(state, { source: "talent-derived", damageType: "bleed", amount: 2 }, []);
    expect(next).toEqual(state);
  });

  it("stops Leech rewards after its Stun rider causes a fatal empty draw", () => {
    const state = fragileBattle({
      enemyStatuses: { stun: 49 },
      gearEffects: { stunOnLeechBelowHalfHealth: 1, leechBlockChance: 100 },
      talentEffects: { drawOnStun: 1, leechGoldChance: 100 },
    });
    const next = applyScaledLeechHealing(state, 1, []);
    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.block).toBe(0);
    expect(next.gold).toBe(state.gold);
  });
  it("validates the actual hand card when a caller carries a stale effect wrapper", () => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const state = regressionBattle({ hand: [card] });
    const stale = { ...card, effects: [{ kind: "heal" as const, amount: 1 }] };
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(canPlayCard(state, stale, 0)).toBe(false);
  });

  it("does not count next-turn packets as immediate damage or protection", () => {
    const delayed = makeTestCard({
      effects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 1,
          effects: [
            { kind: "damage", damageType: "stun", amount: 2 },
            { kind: "player-status", status: "block", amount: 4 },
          ],
        },
      ],
    });
    const state = regressionBattle();
    expect(getImmediateDamage(delayed, state)).toBe(0);
    expect(getImmediateDefense(delayed, state)).toBe(0);
    expect(getImmediateDamage(cardById["earthquake"]!, state)).toBe(2);
  });

  it("recognizes immediate Companion healing when autoplay needs protection", () => {
    const command = cardById["porcupine-quill"]!;
    const attack = cardById["slash"]!;
    const state = regressionBattle({
      hand: [attack, command],
      playerHealth: 10,
      playerMaxHealth: 30,
      activeCompanion: companionLibrary.pixie,
    });
    expect(getImmediateDefense(command, state)).toBeGreaterThan(0);
    expect(findBestPlayableHandCard(state)?.card.id).toBe(command.id);
  });
});
