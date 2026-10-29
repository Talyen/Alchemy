import { describe, expect, it } from "vitest";
import { battleSnapshot } from "@/lib/battle";
import { resetTurnFlags } from "@/lib/battle/combat-flags";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { tickEnemyPoison } from "@/lib/battle/status-ticks";
import { normalizePersistedBattleState } from "@/lib/validation";
import { makeDamageCard } from "../../fixtures/cards";
import { enemyState } from "../../fixtures/enemy-battle";

const attack = makeDamageCard("physical", 5);
const hit = (state: ReturnType<typeof enemyState>, origin?: "companion") => {
  const effect = attack.effects[0];
  if (!effect || effect.kind !== "damage") throw new Error("Missing attack effect");
  return dealDamageToEnemy(state, attack, effect, [], origin ? { manaAtStart: state.mana, origin } : undefined);
};

describe("Cracked Halo", () => {
  it("applies once to the second hit of a multi-hit card", () => {
    const result = applyCardEffects(enemyState("seraph"), makeDamageCard("physical", [5, 5, 5]), []);
    expect(result.enemyHealth).toBe(83);
    expect(result.flags.crackedHaloAttackHitsThisTurn).toBe(2);
  });

  it("adds two damage only to the second landed attack, including a Companion hit, and resets each turn", () => {
    const first = hit(enemyState("seraph"));
    expect(first.enemyHealth).toBe(95);
    const second = hit(first, "companion");
    expect(second.enemyHealth).toBe(88);
    const third = hit(second);
    expect(third.enemyHealth).toBe(83);
    const newTurn = { ...third, flags: resetTurnFlags(third.flags) };
    expect(hit(newTurn).enemyHealth).toBe(78);
    expect(hit(hit(newTurn)).enemyHealth).toBe(71);
  });

  it("counts attacks absorbed by Block and applies the bonus before mitigation", () => {
    const state = enemyState("seraph", { enemyMitigation: { armor: 0, block: 8, forge: 0 } });
    const first = hit(state);
    expect(first.enemyHealth).toBe(100);
    expect(first.enemyMitigation.block).toBe(3);
    const second = hit(first);
    expect(second.enemyHealth).toBe(96);
    expect(second.enemyMitigation.block).toBe(0);
  });

  it("does not count dodged attacks", () => {
    const dodged = hit(enemyState("seraph", { rng: () => 0 }));
    expect(dodged.enemyHealth).toBe(100);
    expect(dodged.flags.crackedHaloAttackHitsThisTurn).toBe(0);
    const landed = hit({ ...dodged, rng: () => 0.99 });
    expect(landed.enemyHealth).toBe(95);
    expect(landed.flags.crackedHaloAttackHitsThisTurn).toBe(1);
  });

  it("does not count Poison ticks or change Will-o’-Wisp’s Flickering", () => {
    const base = enemyState("seraph");
    const poisoned = { ...base, enemyStatuses: { ...base.enemyStatuses, poison: 2 } };
    const afterTick = tickEnemyPoison(poisoned, []);
    expect(afterTick.flags.crackedHaloAttackHitsThisTurn).toBe(0);
    expect(hit(afterTick).flags.crackedHaloAttackHitsThisTurn).toBe(1);
    const wisp = enemyState("will-o-wisp");
    expect(wisp.currentEnemy.traits.map((trait) => trait.id)).toContain("flickering");
    expect(hit(hit(wisp)).flags.crackedHaloAttackHitsThisTurn).toBe(0);
  });

  it("preserves the pending second hit across a saved-battle round trip", () => {
    const first = hit(enemyState("seraph"));
    const snapshot = normalizePersistedBattleState(battleSnapshot(first));
    expect(snapshot.flags.crackedHaloAttackHitsThisTurn).toBe(1);
    const resumed = { ...first, ...snapshot };
    expect(hit(resumed).enemyHealth).toBe(88);
  });
});
