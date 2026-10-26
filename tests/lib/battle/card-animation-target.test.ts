import { describe, expect, it, vi } from "vitest";
import { cardById, enemyById, type BattleCardEffect } from "@/lib/game-data";
import { getBattleCardAnimationTarget } from "@/lib/battle/card-animation-target";
import { inspectBattleCardDamage } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const hit = (amount: number): BattleCardEffect => ({ kind: "damage", damageType: "physical", amount });
const block = (amount: number): BattleCardEffect => ({ kind: "player-status", status: "block", amount });

describe("card flight follows the dominant direct result", () => {
  it.each([
    [0, "player"],
    [2, "player"],
    [6, "enemy"],
    [20, "enemy"],
  ] as const)("resolves Shield Bash in order from %i starting Block", (amount, target) => {
    const card = cardById["shield-bash"]!;
    const state = patchBattleState({ hand: [card], playerStatuses: { block: amount } });
    expect(getBattleCardAnimationTarget(card, state)).toBe(target);
  });

  it("uses known gear and talent amounts for both recipients rather than authored literals", () => {
    const card = makeTestCard({ effects: [block(2), hit(4)] });
    const state = patchBattleState({ gearEffects: { flatBlockGained: 5 } });
    expect(getBattleCardAnimationTarget(card, state)).toBe("player");
    expect(
      getBattleCardAnimationTarget(
        card,
        patchBattleState({
          gearEffects: { flatBlockGained: 5, flatPhysicalDamage: 2 },
          talentEffects: { flatPhysicalDamage: 2 },
        }),
      ),
    ).toBe("enemy");
  });

  it("excludes costs and consumption, including a large self-damage cost before an attack", () => {
    const card = makeTestCard({
      consume: true,
      effects: [
        { kind: "lose-health", amount: 10 },
        { kind: "self-damage", damageType: "burn", amount: 8 },
        { kind: "lose-mana", amount: 3 },
        hit(2),
      ],
    });
    expect(
      getBattleCardAnimationTarget(card, patchBattleState({ playerHealth: 40, playerMaxHealth: 40, mana: 10 })),
    ).toBe("enemy");
  });

  it("does not let triggered Thorns or healing rewards outrank the card's authored effects", () => {
    const card = makeTestCard({ effects: [block(2), hit(4)] });
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 40,
      trinketEffects: { ironwoodBucklerThornsOnBlock: 30 },
    });
    const observed = inspectBattleCardDamage(card, state).outcomes.get("0")?.directAmounts;
    expect(observed).toEqual({
      kind: "exact",
      amounts: [{ target: "player", kind: "status", stat: "block", amount: 2 }],
    });
    expect(getBattleCardAnimationTarget(card, state)).toBe("enemy");
    const followUp = makeTestCard({ effects: [block(6), { kind: "damage", damageType: "burn", amount: 3 }] });
    expect(getBattleCardAnimationTarget(followUp, patchBattleState({ flags: { nextHitPhysicalBonus: 30 } }))).toBe(
      "player",
    );
  });

  it("ranks adjusted healing power before its health cap, consistently with pre-defense attack power", () => {
    const card = makeTestCard({ effects: [{ kind: "heal", amount: 10 }, hit(4)] });
    expect(getBattleCardAnimationTarget(card, patchBattleState({ playerHealth: 10, playerMaxHealth: 30 }))).toBe(
      "player",
    );
    expect(getBattleCardAnimationTarget(card, patchBattleState({ playerHealth: 29, playerMaxHealth: 30 }))).toBe(
      "player",
    );
    expect(getBattleCardAnimationTarget(card, patchBattleState({ playerHealth: 30, playerMaxHealth: 30 }))).toBe(
      "player",
    );
    const empty = makeTestCard({ effects: [{ kind: "heal", amount: 0 }, hit(4)] });
    expect(getBattleCardAnimationTarget(empty, patchBattleState())).toBe("enemy");
  });

  it("keeps buff-only cards on the player and resolves ties by the authored primary recipient", () => {
    expect(
      getBattleCardAnimationTarget(
        makeTestCard({ effects: [block(2), { kind: "player-status", status: "thorns", amount: 8 }] }),
        patchBattleState(),
      ),
    ).toBe("player");
    for (const [effects, target] of [
      [[block(4), hit(4)], "player"],
      [[hit(4), block(4)], "enemy"],
      [[block(0), hit(0)], "player"],
    ] as const) {
      expect(getBattleCardAnimationTarget(makeTestCard({ effects: [...effects] }), patchBattleState())).toBe(target);
    }
  });

  it("compares the largest single effect rather than summing smaller effects toward one side", () => {
    const card = makeTestCard({ effects: [hit(4), hit(4), block(6)] });
    expect(getBattleCardAnimationTarget(card, patchBattleState())).toBe("player");
    const mergedBuffs = makeTestCard({ effects: [block(2), block(2), hit(3)] });
    expect(getBattleCardAnimationTarget(mergedBuffs, patchBattleState())).toBe("enemy");
  });

  it("compares resolved stack gains rather than percentage, multiplier or duration literals", () => {
    const multiplied = makeTestCard({
      effects: [block(3), { kind: "multiply-enemy-status", status: "burn", factor: 10 }],
    });
    expect(getBattleCardAnimationTarget(multiplied, patchBattleState({ enemyStatuses: { burn: 0 } }))).toBe("player");
    expect(getBattleCardAnimationTarget(multiplied, patchBattleState({ enemyStatuses: { burn: 1 } }))).toBe("enemy");
    const timed = makeTestCard({ effects: [{ kind: "player-status", status: "haste", amount: 100 }, hit(3)] });
    expect(getBattleCardAnimationTarget(timed, patchBattleState())).toBe("enemy");
  });

  it("falls back deterministically for uncertain mixed-recipient outcomes and nonnumeric actions", () => {
    const card = makeTestCard({ effects: [block(4), { kind: "random-damage", minAmount: 1, maxAmount: 8 }] });
    expect(getBattleCardAnimationTarget(card, patchBattleState())).toBe("player");
    expect(
      getBattleCardAnimationTarget(makeTestCard({ effects: [{ kind: "next-hit-crit" }] }), patchBattleState()),
    ).toBe("player");
    const chance = makeTestCard({
      effects: [{ kind: "chance", probability: 0.5, successEffects: [block(2)], failureEffects: [hit(20)] }],
    });
    expect(getBattleCardAnimationTarget(chance, patchBattleState())).toBe("player");
    const impossibleBranch = makeTestCard({
      effects: [{ kind: "chance", probability: 0, successEffects: [block(100)], failureEffects: [hit(6)] }],
    });
    expect(getBattleCardAnimationTarget(impossibleBranch, patchBattleState())).toBe("enemy");
    const failureOnly = makeTestCard({
      effects: [block(2), { kind: "chance", probability: 0, successEffects: [], failureEffects: [hit(6)] }],
    });
    expect(getBattleCardAnimationTarget(failureOnly, patchBattleState())).toBe("enemy");
    const pooled = makeTestCard({
      effects: [{ kind: "player-status", status: "block", statusPool: ["block", "armor"], amount: 4 }, hit(6)],
    });
    expect(getBattleCardAnimationTarget(pooled, patchBattleState())).toBe("enemy");
  });

  it("uses the immutable pre-play state without enemy mitigation, Critical/Dodge rolls or live RNG", () => {
    const card = cardById["shield-bash"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      playerStatuses: { block: 10 },
      currentEnemy: enemyById["will-o-wisp"],
      enemyMitigation: { armor: 50, block: 50 },
      flags: { nextHitCrit: true },
      rng,
    });
    const before = JSON.stringify(state);
    expect(getBattleCardAnimationTarget(card, state)).toBe("enemy");
    expect(JSON.stringify(state)).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    // Ranking remains presentation-only; the real card retains both recipients.
    const actual = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    expect(actual.state.playerStatuses.block).toBe(12);
    expect(actual.state.enemyHealth).toBe(state.enemyHealth);
  });
});
