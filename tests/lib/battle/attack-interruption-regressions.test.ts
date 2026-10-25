import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { applyEmergencyWishForEmptyDraw } from "@/lib/battle/wish";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("attack interruptions", () => {
  it.each(["armor", "block"] as const)("Wardbreaker removes %s before the triggering hit is mitigated", (stat) => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
    const state = regressionBattle({
      hand: [card],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { [stat]: 10 },
      gearEffects: { attackPurgeOncePerTurn: 1 },
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.enemyHealth).toBe(26);
    expect(next.enemyMitigation[stat]).toBe(0);
    expect(next.uniqueGear.wardbreakerPurgeUsed).toBe(true);
    expect(state.enemyMitigation[stat]).toBe(10);
  });

  it.each(["card", "follow-up"])("a fatal Bloodrush Wish stops later %s hit reactions", (source) => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "bleed", amount: 2 }] });
    const state = regressionBattle({
      hand: [card],
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { drawOnBleedDamageChance: 100, burnOnWish: 1, bleedPoisonDamageChance: 100 },
      trinketEffects: { cutpurseGoldChance: 100 },
    });
    const combatTexts: CombatTextEvent[] = [];
    const next =
      source === "card"
        ? (() => {
            const result = playBattleCardResolved(state, card.id, 0);
            combatTexts.push(...result.combatTexts);
            return result.state;
          })()
        : resolveFollowUpHit(
            {
              ...state,
              hand: [],
              onEmptyDraw: (current, amount, texts) =>
                resolvePendingBattleReactions(applyEmergencyWishForEmptyDraw(current, amount, texts), texts),
            },
            { source: "player-follow-up", damageType: "bleed", amount: 2 },
            combatTexts,
          );
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(27);
    expect(next.enemyStatuses.poison).toBe(0);
    expect(next.gold).toBe(state.gold);
    expect(combatTexts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "bleed", amount: 2 }),
    );
  });
});
