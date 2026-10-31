import { describe, expect, it } from "vitest";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { detonateEnemyStatuses, applyEnemyDotDamage } from "@/lib/battle/dot-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyElementalReactionDamage } from "@/lib/battle/elemental-reactions";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { makeDamageCard } from "../../fixtures/cards";

const card = makeTestCard();
const deck = () => Array.from({ length: 4 }, (_, index) => makeTestCard({ id: `draw-${index}` }));
const state = (rng: () => number) =>
  patchBattleState({
    deck: deck(),
    hand: [],
    discard: [],
    enemyHealth: 100,
    enemyMaxHealth: 100,
    trinketEffects: { tatteredPagesBurnDrawChance: 10 },
    rng,
  });
const hit = (current: ReturnType<typeof state>, damageType: "burn" | "poison", amount = 5) =>
  resolvePlayerHit(
    current,
    { source: "card-attack", card, effect: { kind: "damage", damageType, amount }, resolvedDamage: amount },
    [],
  );

describe("Tattered Pages", () => {
  it("rolls once per successful Burn hit, without a first-per-turn limit", () => {
    let rolls = 0;
    const start = state(() => {
      rolls++;
      return 0.01;
    });
    const first = hit(start, "burn", 25);
    const second = hit(first, "burn", 1);
    expect(second.hand).toHaveLength(2);
    expect(rolls).toBe(2);
  });

  it("does not draw on a failed roll, zero damage, or a non-Burn hit", () => {
    let rolls = 0;
    const start = state(() => {
      rolls++;
      return 0.99;
    });
    const missed = hit(start, "burn");
    const zero = hit(missed, "burn", 0);
    const poison = hit(zero, "poison");
    expect(poison.hand).toHaveLength(0);
    expect(rolls).toBe(1);
  });

  it("does not roll when Block absorbs a Burn hit", () => {
    const calls = [0, 0];
    const burn = makeDamageCard("burn", 5);
    const run = (equipped: boolean, index: number) => {
      const start = patchBattleState({
        deck: deck(),
        hand: [],
        enemyMitigation: { block: 20 },
        trinketEffects: { tatteredPagesBurnDrawChance: equipped ? 10 : 0 },
        rng: () => {
          calls[index]!++;
          return 0.99;
        },
      });
      return dealDamage(start, burn);
    };
    const equipped = run(true, 0);
    const plain = run(false, 1);
    expect(equipped.enemyHealth).toBe(plain.enemyHealth);
    expect(equipped.hand).toHaveLength(0);
    expect(calls[0]).toBe(calls[1]);
  });

  it("rolls for a Burn follow-up, tick, and detonation", () => {
    const start = state(() => 0.01);
    const follow = resolvePlayerHit(start, { source: "player-follow-up", damageType: "burn", amount: 3 }, []);
    const tick = tickEnemyStatuses(follow, []);
    const detonated = detonateEnemyStatuses(tick, ["burn"], []);
    expect(detonated.hand).toHaveLength(3);
  });

  it("does not roll for a pulse after earlier damage exhausted the target's Health", () => {
    let rolls = 0;
    const start = {
      ...state(() => {
        rolls++;
        return 0;
      }),
      enemyHealth: 2,
    };
    const result = applyEnemyDotDamage(
      start,
      [
        { status: "poison", finalDamage: 2, nextStacks: 0 },
        { status: "burn", finalDamage: 5, nextStacks: 0 },
      ],
      [],
    );
    expect(result.hand).toHaveLength(0);
    expect(rolls).toBe(0);
  });

  it("does not recurse through Burn-colored elemental reactions", () => {
    let rolls = 0;
    const start = state(() => {
      rolls++;
      return 0;
    });
    const result = applyElementalReactionDamage(start, { id: "bloodboil", damage: 5 }, []);
    expect(result.hand).toHaveLength(0);
    expect(rolls).toBe(0);
  });
});
