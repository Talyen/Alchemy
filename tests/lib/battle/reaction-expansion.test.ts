import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { tickEnemyStatuses, tickEnemyPoison } from "@/lib/battle/status-ticks";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { resolveSecondaryAction } from "@/lib/battle/action-context";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { setEnemyStatus } from "@/lib/battle/status-state";
import { getReactionBonus } from "@/lib/battle/elemental-reaction-state";
import { getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import type { BattleState, CombatTextEvent } from "@/lib/battle";
import { cardById, type DamageType } from "@/lib/game-data";
import { patchBattleState, makeTestCard, type BattleStatePatch } from "../../fixtures/battle";

const attack = (damageType: DamageType, amount = 4) =>
  makeTestCard({ effects: [{ kind: "damage", damageType, amount }] });
function base(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 100,
    playerMaxHealth: 100,
    rng: () => 0.99,
    ...patch,
  });
}
function hit(state: BattleState, type: DamageType, texts: CombatTextEvent[] = [], amount = 4) {
  return applyCardEffects(state, attack(type, amount), texts, {
    manaAtStart: state.mana,
    origin: state.action?.source === "companion" ? "companion" : "played-card",
  });
}
function reactions(texts: CombatTextEvent[]) {
  return texts.flatMap((event) => (event.kind === "notice" && event.signal === "reaction" ? [event.reactionId] : []));
}

describe("Consecration", () => {
  it("consecrates a visible wound once and consumes the mark on its next natural tick", () => {
    const start = base({ enemyStatuses: { bleed: 8 } });
    const marked = hit(hit(start, "holy"), "holy");
    expect(marked.reactions.consecrated).toBe(true);
    const texts: CombatTextEvent[] = [];
    const result = tickEnemyStatuses(marked, texts);
    expect(result.enemyHealth).toBe(82); // two Holy hits, Bleed 8, Holy bonus 2
    expect(result.reactions.consecrated).toBe(false);
    expect(reactions(texts)).toEqual(["consecration"]);
    expect(tickEnemyStatuses(result, []).enemyHealth).toBe(82);
    expect(start.reactions.consecrated).toBe(false);
  });

  it("requires positive Holy Health damage and Bleed already present before that packet", () => {
    expect(hit(base(), "holy").reactions.consecrated).toBe(false);
    expect(
      hit(base({ enemyStatuses: { bleed: 8 }, enemyMitigation: { block: 20 } }), "holy").reactions.consecrated,
    ).toBe(false);
    expect(hit(base({ enemyStatuses: { bleed: 8 } }), "holy", [], 0).reactions.consecrated).toBe(false);
    const bleeding = hit(hit(base(), "holy"), "bleed");
    expect(bleeding.reactions.consecrated).toBe(false);
  });

  it("respects Bleed then Holy within one card, and rejects the reversed ordering", () => {
    const bleed = { kind: "damage" as const, damageType: "bleed" as const, amount: 4 };
    const holy = { kind: "damage" as const, damageType: "holy" as const, amount: 4 };
    expect(applyCardEffects(base(), makeTestCard({ effects: [bleed, holy] }), []).reactions.consecrated).toBe(true);
    expect(applyCardEffects(base(), makeTestCard({ effects: [holy, bleed] }), []).reactions.consecrated).toBe(false);
  });

  it("cancels on cleanse or detonation without converting an extra tick into a natural payoff", () => {
    const marked = hit(base({ enemyStatuses: { bleed: 8 } }), "holy");
    expect(setEnemyStatus(marked, "bleed", 0).reactions.consecrated).toBe(false);
    const texts: CombatTextEvent[] = [];
    const detonated = detonateEnemyStatuses(marked, ["bleed"], texts);
    expect(detonated.reactions.consecrated).toBe(false);
    expect(reactions(texts)).toEqual([]);
  });

  it("lets preserved Bleed be consecrated again, without retaining a spent mark", () => {
    const marked = hit(base({ enemyStatuses: { bleed: 8 }, gearEffects: { bleedDecaysByHalf: 1 } }), "holy");
    const first = tickEnemyStatuses(marked, []);
    expect(first.enemyStatuses.bleed).toBe(4);
    expect(first.reactions.consecrated).toBe(false);
    const texts: CombatTextEvent[] = [];
    tickEnemyStatuses(hit(first, "holy"), texts);
    expect(reactions(texts)).toEqual(["consecration"]);
  });

  it("isolates eligible Companion attacks from secondary repeats", () => {
    const state = base({ enemyStatuses: { bleed: 8 } });
    expect(resolveSecondaryAction(state, "repeat", (current) => hit(current, "holy")).reactions.consecrated).toBe(
      false,
    );
    expect(resolveSecondaryAction(state, "companion", (current) => hit(current, "holy")).reactions.consecrated).toBe(
      true,
    );
  });

  it("preserves and consumes the mark across reload, defaults missing data, and rejects orphan marks", () => {
    const marked = hit(base({ enemyStatuses: { bleed: 8 } }), "holy");
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(marked)));
    expect(restored.reactions.consecrated).toBe(true);
    const used = tickEnemyStatuses({ ...restored, rng: () => 0.99 }, []);
    expect(PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(used))).reactions.consecrated).toBe(false);
    expect(PersistedBattleStateSchema.parse(base({ reactions: { consecrated: true } })).reactions.consecrated).toBe(
      false,
    );
    expect(PersistedBattleStateSchema.parse({ ...marked, reactions: {} }).reactions.consecrated).toBe(false);
    expect(
      PersistedBattleStateSchema.parse({ ...marked, reactions: { consecrated: "true" } }).reactions.consecrated,
    ).toBe(false);
  });
});

describe("Bloodboil", () => {
  it("uses same-phase damage facts, including the final Burn stack, and resolves after Consecration", () => {
    const texts: CombatTextEvent[] = [];
    const result = tickEnemyStatuses(
      base({ enemyStatuses: { burn: 1, bleed: 4 }, reactions: { consecrated: true } }),
      texts,
    );
    expect(reactions(texts)).toEqual(["consecration", "bloodboil"]);
    expect(result.enemyHealth).toBe(93); // Burn 1, Bleed 4, Consecration 1, Bloodboil 1
    expect(result.enemyStatuses).toMatchObject({ burn: 0, bleed: 0 });
    expect(result.reactions.wildfirePendingTickDamage).toBe(1); // bonus does not fund Wildfire
  });

  it("pays the combined quarter once without adding Burn or disturbing Wildfire preparation", () => {
    const texts: CombatTextEvent[] = [];
    const result = tickEnemyStatuses(base({ enemyStatuses: { burn: 8, bleed: 4 } }), texts);
    expect(result.enemyHealth).toBe(85);
    expect(result.enemyStatuses.burn).toBe(4);
    expect(result.reactions.wildfirePendingTickDamage).toBe(8);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 3, additive: false });
  });

  it("does not combine separate phases or detonations", () => {
    const first = tickEnemyStatuses(base({ enemyStatuses: { burn: 8 } }), []);
    const texts: CombatTextEvent[] = [];
    tickEnemyStatuses(setEnemyStatus(setEnemyStatus(first, "burn", 0), "bleed", 4), texts);
    detonateEnemyStatuses(base({ enemyStatuses: { burn: 8, bleed: 4 } }), ["burn", "bleed"], texts);
    tickEnemyPoison(base({ enemyStatuses: { burn: 8, bleed: 4, poison: 3 } }), texts);
    expect(reactions(texts)).toEqual([]);
  });

  it("counts a CC-skipped natural enemy phase", () => {
    const result = endPlayerTurn(base({ enemyStatuses: { burn: 8, bleed: 4 }, enemyCC: { stunSkipTurns: 1 } }));
    expect(result.kind).toBe("skipped");
    expect(result.state.enemyHealth).toBe(85);
  });

  it("stops after lethal ticks or a lethal Consecration instead of announcing unapplied bonuses", () => {
    for (const health of [8, 12, 13]) {
      const texts: CombatTextEvent[] = [];
      const result = tickEnemyStatuses(
        base({ enemyHealth: health, enemyStatuses: { burn: 8, bleed: 4 }, reactions: { consecrated: true } }),
        texts,
      );
      expect(result.enemyHealth).toBe(0);
      expect(reactions(texts)).toEqual(health === 13 ? ["consecration"] : []);
    }
  });
});

describe("Venomflash", () => {
  it("rewards Combustion's fresh ignition even when the same hit detonates its Burn", () => {
    const state = base({ enemyStatuses: { poison: 12 } });
    const combustion = cardById.combustion!;
    const texts: CombatTextEvent[] = [];
    const first = applyCardEffects(state, combustion, texts);
    expect(first.enemyHealth).toBe(95); // Burn hit 1, detonation 1, Venomflash 3.
    expect(first.enemyStatuses).toMatchObject({ poison: 12, burn: 0 });
    expect(reactions(texts)).toEqual(["venomflash"]);
    const secondTexts: CombatTextEvent[] = [];
    expect(applyCardEffects(first, combustion, secondTexts).enemyHealth).toBe(90);
    expect(reactions(secondTexts)).toEqual(["venomflash"]);
    const twice = makeTestCard({ effects: [...combustion.effects, ...combustion.effects] });
    expect(getEffectiveDamageScore(twice, state)).toBe(8); // Authored hits 2, two ignition bonuses 6.
    expect(state.enemyStatuses).toMatchObject({ poison: 12, burn: 0 });
  });

  it("rewards fresh ignition, preserves Poison, and cannot repeat while Burn remains", () => {
    const state = base({ enemyStatuses: { poison: 12 } });
    const texts: CombatTextEvent[] = [];
    const first = hit(state, "burn", texts);
    expect(first.enemyHealth).toBe(93);
    expect(first.enemyStatuses).toMatchObject({ poison: 12, burn: 4 });
    expect(reactions(texts)).toEqual(["venomflash"]);
    const repeated: CombatTextEvent[] = [];
    expect(hit(first, "burn", repeated).enemyHealth).toBe(89);
    expect(reactions(repeated)).toEqual([]);
    expect(reactionsAfterIgnition(setEnemyStatus(first, "burn", 0))).toEqual(["venomflash"]);
  });

  it("requires an eligible positive Burn hit, not a proc, repeat, blocked hit, or a lethal finisher", () => {
    const state = base({ enemyStatuses: { poison: 12 } });
    for (const source of ["repeat", "retaliation", "delayed-card", "reward"] as const) {
      expect(resolveSecondaryAction(state, source, (current) => hit(current, "burn")).enemyHealth).toBe(96);
      expect(
        resolveSecondaryAction(base({ enemyStatuses: { bleed: 8 } }), source, (current) => hit(current, "holy"))
          .reactions.consecrated,
      ).toBe(false);
    }
    expect(hit(base({ enemyStatuses: { poison: 12 }, enemyMitigation: { block: 20 } }), "burn").enemyHealth).toBe(100);
    const texts: CombatTextEvent[] = [];
    hit(base({ enemyHealth: 3, enemyStatuses: { poison: 12 } }), "burn", texts);
    expect(reactions(texts)).toEqual([]);
    const companionTexts: CombatTextEvent[] = [];
    resolveSecondaryAction(state, "companion", (current) => hit(current, "burn", companionTexts));
    expect(reactions(companionTexts)).toEqual(["venomflash"]);
  });

  it("respects ordered effects and forecasts a fresh ignition only once without RNG or mutation", () => {
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "poison", amount: 12 },
        { kind: "damage", damageType: "burn", amount: 4 },
        { kind: "damage", damageType: "burn", amount: 4 },
      ],
    });
    const state = base();
    const texts: CombatTextEvent[] = [];
    expect(applyCardEffects(state, card, texts).enemyHealth).toBe(77);
    expect(reactions(texts)).toEqual(["venomflash"]);
    const snapshot = structuredClone({ ...state, rng: undefined });
    const scoredState = {
      ...state,
      rng: () => {
        throw new Error("scoring RNG");
      },
    };
    expect(getEffectiveDamageScore(card, scoredState)).toBe(23);
    expect({ ...state, rng: undefined }).toEqual(snapshot);
    const reversed = makeTestCard({ effects: [...card.effects].reverse() });
    expect(getEffectiveDamageScore(reversed, state)).toBe(20);
  });

  it("pays a Venomflash kill and ordinary kill rewards exactly once", () => {
    const card = attack("burn");
    const texts: CombatTextEvent[] = [];
    const result = playBattleCardResolved(
      base({
        hand: [card],
        enemyHealth: 6,
        enemyStatuses: { poison: 12 },
        gold: 0,
        gearEffects: { goldOnKill: 2 },
      }),
      card.id,
      0,
    );
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.gold).toBe(2);
    expect(result.state.flags.killRewardsPaid).toBe(true);
    tickEnemyStatuses(result.state, texts);
    expect(texts).toEqual([]);
    expect(reactions(result.combatTexts)).toEqual(["venomflash"]);
  });

  it("does not let ordinary Gear/talent follow-ups prepare attack reactions", () => {
    for (const source of ["player-follow-up", "talent-fixed", "talent-derived"] as const) {
      const texts: CombatTextEvent[] = [];
      const state = base({ enemyStatuses: { poison: 12, bleed: 8 } });
      expect(resolveFollowUpHit(state, { source, damageType: "holy", amount: 4 }, texts).reactions.consecrated).toBe(
        false,
      );
      expect(resolveFollowUpHit(state, { source, damageType: "burn", amount: 4 }, texts).enemyHealth).toBe(96);
      expect(reactions(texts)).toEqual([]);
    }
  });

  it("does not count delayed Consecration as immediate attack damage", () => {
    expect(getEffectiveDamageScore(attack("holy"), base({ enemyStatuses: { bleed: 40 } }))).toBe(4);
  });
});

function reactionsAfterIgnition(state: BattleState) {
  const texts: CombatTextEvent[] = [];
  hit(state, "burn", texts);
  return reactions(texts);
}

it("rounds combined reaction damage exactly at safe-integer boundaries", () => {
  const max = Number.MAX_SAFE_INTEGER;
  expect(getReactionBonus(max, max)).toBe(4503599627370496);
  expect(getReactionBonus(4, 2)).toBe(2);
  expect(getReactionBonus(0)).toBe(0);
  expect(getReactionBonus(1)).toBe(1);
});
