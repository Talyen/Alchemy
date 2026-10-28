import { makeDamageCard } from "../../fixtures/cards";
import * as dodge from "@/lib/battle/dodge";
import * as statusHelpers from "@/lib/battle/status-helpers";
import { describe, expect, it, vi } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { resolveSecondaryAction } from "@/lib/battle/action-context";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { advanceToPlayerTurn, reduceSkipTurns } from "@/lib/battle/player-turn-transition";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";
import { type BattleState, type CombatTextEvent } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, type DamageType } from "@/lib/game-data";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { findBestPlayableHandCard, findBestWishChoice } from "@/features/alchemy/run-loop/battle/playable-hand";
import { getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";

const attack = (damageType: DamageType, amount = 4) =>
  makeTestCard({ id: `test-${damageType}`, effects: [{ kind: "damage", damageType, amount }] });
function base() {
  return patchBattleState({
    rng: () => 0.99,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 100,
    playerMaxHealth: 100,
    currentEnemy: { abilityIds: ["slash", "stab"] },
    deck: Array.from({ length: 8 }, (_, i) =>
      makeTestCard({ id: `deck-${i}`, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
    ),
  });
}
function hit(state: BattleState, card = attack("physical"), texts: CombatTextEvent[] = []) {
  return applyCardEffects(state, card, texts, {
    manaAtStart: state.mana,
    origin: "played-card",
  });
}
function controlled(stat: "freeze" | "stun", amount = 12) {
  const state = base();
  return hit({ ...state, enemyStatuses: { ...state.enemyStatuses, [stat]: 40 } }, attack(stat, amount));
}
function wildfire() {
  let state = base();
  state = { ...state, enemyStatuses: { ...state.enemyStatuses, burn: 8 } };
  state = endPlayerTurn(state).state;
  return endPlayerTurn(state).state;
}
function notices(texts: CombatTextEvent[]) {
  return texts.filter((event) => event.kind === "notice").map((event) => event.text);
}

describe("CC reaction payoffs", () => {
  it("Shatter breaks defenses, preserves Freeze, and pays the setup bonus instead of a guaranteed Critical", () => {
    const prepared = controlled("freeze");
    expect(prepared.reactions).toMatchObject({ shatterDamage: 6, frostfireDamage: 6 });
    const state = { ...prepared, enemyMitigation: { ...prepared.enemyMitigation, block: 8, armor: 5 } };
    const texts: CombatTextEvent[] = [];
    const result = hit(state, attack("physical"), texts);
    expect(result.enemyHealth).toBe(78);
    expect(result.enemyMitigation).toMatchObject({ block: 0, armor: 0 });
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(result.reactions).toMatchObject({ shatterDamage: 0, frostfireDamage: 6 });
    expect(notices(texts)).toContain("Shatter");
    expect(texts.some((event) => event.kind === "damage" && event.critical)).toBe(false);
    expect(state.enemyMitigation).toMatchObject({ block: 8, armor: 5 });
  });

  it("uses ordinary prepared Criticals on the attack, without multiplying or spending bonuses on Shatter damage", () => {
    const state = controlled("freeze");
    const result = hit({ ...state, flags: { ...state.flags, nextHitCrit: true, nextPhysicalCrit: true } });
    expect(result.enemyHealth).toBe(74); // 88 - (4 * 2) - 6
    expect(result.flags).toMatchObject({ nextHitCrit: false, nextPhysicalCrit: false });
  });

  it("captures the Critical setup hit's actual damage without including its follow-up damage", () => {
    const state = base();
    const prepared = hit(
      {
        ...state,
        enemyStatuses: { ...state.enemyStatuses, freeze: 20 },
        flags: { ...state.flags, nextHitCrit: true },
        gearEffects: { ...state.gearEffects, damageOnFreezePhysical: 12 },
      },
      attack("freeze", 16),
    );
    expect(prepared.enemyHealth).toBe(56);
    expect(prepared.reactions).toMatchObject({ shatterDamage: 16, frostfireDamage: 16 });
    expect(hit(prepared, attack("physical", 1)).enemyHealth).toBe(39);
  });

  it("a small Companion receives the full earned bonus and cannot spend the hero's prepared Critical", () => {
    const state = controlled("freeze");
    const result = resolveSecondaryAction(
      { ...state, flags: { ...state.flags, nextHitCrit: true } },
      "companion",
      (current) =>
        applyCardEffects(current, attack("physical", 1), [], {
          manaAtStart: current.mana,
          origin: "companion",
        }),
    );
    expect(result.enemyHealth).toBe(81);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.reactions.shatterDamage).toBe(0);
  });

  it("pays only once in a multi-hit card and cannot refresh through Haste or extended Freeze", () => {
    const state = controlled("freeze");
    const twice = makeDamageCard("physical", [4, 4]);
    const result = hit(state, twice);
    expect(result.enemyHealth).toBe(74);
    const haste = endPlayerTurn({ ...result, playerStatuses: { ...result.playerStatuses, haste: 1 } });
    expect(haste.kind).toBe("haste");
    expect(haste.state.enemyCC.freezeSkipTurns).toBe(1);
    expect(hit(haste.state).enemyHealth).toBe(70);
    const extended = reduceSkipTurns({ ...result, enemyCC: { ...result.enemyCC, freezeSkipTurns: 2 } });
    expect(extended.enemyCC.freezeSkipTurns).toBe(1);
    expect(hit(advanceToPlayerTurn(extended)).enemyHealth).toBe(70);
  });

  it("expires both Freeze opportunities on thaw and earns fresh ones only on a new successful Freeze", () => {
    const thawed = reduceSkipTurns(controlled("freeze"));
    expect(thawed.reactions).toMatchObject({ shatterDamage: 0, frostfireDamage: 0 });
    const immune = hit({ ...thawed, enemyStatuses: { ...thawed.enemyStatuses, freeze: 80 } }, attack("freeze", 8));
    expect(immune.reactions.shatterDamage).toBe(0);
    const fresh = hit(
      {
        ...immune,
        enemyCC: { ...immune.enemyCC, cooldown: 0 },
        enemyStatuses: { ...immune.enemyStatuses, freeze: 80 },
      },
      attack("freeze", 8),
    );
    expect(fresh.reactions).toMatchObject({ shatterDamage: 4, frostfireDamage: 4 });
  });

  it("Dodge and zero attacks preserve defenses and opportunities", () => {
    const state = controlled("freeze");
    const spy = vi.spyOn(dodge, "tryDodgePlayerAttackPacket").mockReturnValueOnce(state);
    expect(hit(state).reactions).toEqual(state.reactions);
    spy.mockRestore();
    expect(hit(state, attack("physical", 0))).toBe(state);
  });

  it("secondary and delayed damage cannot initiate a payoff, but can prepare CC", () => {
    const state = controlled("freeze");
    expect(
      resolveFollowUpHit(state, { source: "player-follow-up", damageType: "physical", amount: 4 }, []).reactions,
    ).toEqual(state.reactions);
    expect(resolveSecondaryAction(state, "delayed-card", (current) => hit(current)).reactions).toEqual(state.reactions);
    expect(resolveSecondaryAction(state, "repeat", (current) => hit(current)).reactions).toEqual(state.reactions);
    const before = base();
    const prepared = resolveFollowUpHit(
      { ...before, enemyStatuses: { ...before.enemyStatuses, stun: 40 } },
      { source: "talent-derived", damageType: "stun", amount: 12 },
      [],
    );
    expect(prepared.reactions.thunderclapDamage).toBe(6);
    expect(hit(prepared, attack("nature")).enemyHealth).toBe(78);
  });

  it("non-damaging CC uses the minimum reward and extending existing CC does not replace its setup", () => {
    const state = base();
    const status = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "freeze", factor: 2 }] });
    const prepared = hit({ ...state, enemyStatuses: { ...state.enemyStatuses, freeze: 30 } }, status);
    expect(prepared.reactions.shatterDamage).toBe(2);
    expect(hit(prepared, attack("freeze", 20)).reactions.shatterDamage).toBe(2);
  });

  it("Thunderclap preserves Stun and cannot spend a new Stun produced by the same Nature hit", () => {
    const prepared = controlled("stun");
    const result = hit(prepared, attack("nature"));
    expect(result.enemyHealth).toBe(78);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.reactions.thunderclapDamage).toBe(0);
    expect(reduceSkipTurns(prepared).reactions.thunderclapDamage).toBe(0);
    const before = base();
    const created = hit(
      {
        ...before,
        enemyStatuses: { ...before.enemyStatuses, stun: 48 },
        talentEffects: { ...before.talentEffects, natureStunChance: 100 },
      },
      attack("nature"),
    );
    expect(created.enemyCC.stunSkipTurns).toBe(1);
    expect(created.reactions.thunderclapDamage).toBe(2);
  });

  it("Frostfire pays on freezing a Burning enemy and leaves Shatter independently available", () => {
    const state = base();
    const texts: CombatTextEvent[] = [];
    const result = hit(
      { ...state, enemyStatuses: { ...state.enemyStatuses, freeze: 40, burn: 8 } },
      attack("freeze", 12),
      texts,
    );
    expect(result.enemyHealth).toBe(82);
    expect(result.enemyStatuses.burn).toBe(8);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(result.reactions).toMatchObject({ frostfireDamage: 0, shatterDamage: 6 });
    expect(notices(texts)).toContain("Frostfire");
    expect(hit(result).enemyHealth).toBe(72);
    expect(notices(texts).filter((text) => text === "Frostfire")).toHaveLength(1);
  });

  it("Frostfire's Burn route keeps new Burn stacks and cannot repeat through its other route", () => {
    const prepared = controlled("freeze");
    const first = hit(prepared, attack("burn"));
    expect(first.enemyHealth).toBe(78);
    expect(first.enemyStatuses.burn).toBe(4); // bonus damage adds no Burn
    expect(first.reactions).toMatchObject({ frostfireDamage: 0, shatterDamage: 6 });
    expect(hit(first, attack("freeze", 4)).enemyHealth).toBe(74);
  });
});

describe("Wildfire preparation and resolution", () => {
  it("pairs natural Burn ticks, preserves Burn, and survives turn resets", () => {
    const state = wildfire();
    expect(state.enemyHealth).toBe(88);
    expect(state.enemyStatuses.burn).toBe(2);
    expect(state.reactions).toMatchObject({ wildfireDamage: 6, wildfirePendingTickDamage: null });
    const result = hit(state, attack("nature"));
    expect(result.enemyHealth).toBe(78);
    expect(result.enemyStatuses.burn).toBe(2);
    expect(result.reactions.wildfireDamage).toBe(0);
  });

  it("cannot count the same natural enemy turn twice, including after reload", () => {
    const start = base();
    const first = tickEnemyStatuses({ ...start, enemyStatuses: { ...start.enemyStatuses, burn: 8 } }, []);
    expect(first.reactions.wildfirePendingTickDamage).toBe(8);
    const restored = { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(first))), rng: () => 0.99 };
    const repeated = tickEnemyStatuses(restored, []);
    expect(repeated.reactions.wildfirePendingTickDamage).toBe(8);
    expect(repeated.reactions.wildfireDamage).toBe(0);
    expect(tickEnemyStatuses({ ...repeated, turn: repeated.turn + 1 }, []).reactions.wildfireDamage).toBe(5);
  });

  it("banks multiple rounded pairs, retains unmatched ticks, and releases after Burn disappears", () => {
    let state = wildfire();
    state = endPlayerTurn(state).state; // 2, unmatched
    expect(state.reactions).toMatchObject({ wildfireDamage: 6, wildfirePendingTickDamage: 2 });
    const first = hit(state, attack("nature", 1));
    expect(first.reactions).toMatchObject({ wildfireDamage: 0, wildfirePendingTickDamage: 2 });
    state = endPlayerTurn(state).state; // 1, pair rounds to 2
    expect(state.enemyStatuses.burn).toBe(0);
    expect(state.reactions).toMatchObject({ wildfireDamage: 8, wildfirePendingTickDamage: null });
    expect(hit(state, attack("nature", 1)).enemyHealth).toBe(state.enemyHealth - 9);
  });

  it("keeps unmatched progress across extinguished fires and counts ticks on CC-skipped enemy turns", () => {
    let state = base();
    state = {
      ...state,
      enemyStatuses: { ...state.enemyStatuses, burn: 1 },
      enemyCC: { ...state.enemyCC, freezeSkipTurns: 2 },
    };
    const first = endPlayerTurn(state);
    expect(first.kind).toBe("skipped");
    expect(first.state.reactions.wildfirePendingTickDamage).toBe(1);
    const empty = endPlayerTurn(first.state).state;
    expect(empty.reactions.wildfirePendingTickDamage).toBe(1);
    const relit = hit(empty, attack("burn", 1));
    const paired = endPlayerTurn(relit).state;
    expect(paired.reactions).toMatchObject({ wildfireDamage: 2, wildfirePendingTickDamage: null });
  });

  it("does not advance on Haste, direct Burn hits, detonations, or zero-damage natural ticks", () => {
    const state = base();
    const haste = endPlayerTurn({
      ...state,
      enemyStatuses: { ...state.enemyStatuses, burn: 8 },
      playerStatuses: { ...state.playerStatuses, haste: 1 },
    });
    expect(haste.state.reactions.wildfirePendingTickDamage).toBeNull();
    const direct = hit(state, attack("burn", 8));
    expect(direct.reactions.wildfirePendingTickDamage).toBeNull();
    expect(hit(direct, cardById.combustion!).reactions.wildfirePendingTickDamage).toBeNull();
    const weak = { ...state, enemyStatuses: { ...state.enemyStatuses, burn: 1 } };
    const immunity = vi.spyOn(statusHelpers, "getEnemyDamageMultiplier").mockReturnValue(0);
    const ticked = tickEnemyStatuses(weak, []);
    immunity.mockRestore();
    expect(ticked.enemyHealth).toBe(weak.enemyHealth);
    expect(ticked.reactions.wildfirePendingTickDamage).toBeNull();
  });

  it("uses modified tick damage once, with no extra Criticals, modifiers, buildup, or attack riders", () => {
    let state = base();
    state = {
      ...state,
      enemyStatuses: { ...state.enemyStatuses, burn: 8, bleed: 1 },
      gearEffects: { ...state.gearEffects, burnDamageBonusToBleedingPercent: 100 },
    };
    state = tickEnemyStatuses(state, []); // 16 Burn; Bleed expires
    state = { ...state, turn: state.turn + 1, enemyStatuses: { ...state.enemyStatuses, bleed: 1 } };
    state = tickEnemyStatuses(state, []); // 8 Burn
    expect(state.reactions.wildfireDamage).toBe(12);
    const texts: CombatTextEvent[] = [];
    state = {
      ...state,
      enemyStatuses: { ...state.enemyStatuses, bleed: 1 },
      flags: { ...state.flags, nextHitCrit: true },
    };
    const result = hit(state, attack("nature", 1), texts);
    expect(result.enemyHealth).toBe(state.enemyHealth - 14); // Critical Nature 2 + fixed bonus 12
    expect(result.enemyStatuses.burn).toBe(state.enemyStatuses.burn);
    expect(texts.filter((event) => event.kind === "damage" && event.stat === "burn")).toEqual([
      expect.objectContaining({ amount: 12, reactionId: "wildfire" }),
    ]);
  });

  it("resolves Thunderclap before Wildfire and preserves Stun and Burn", () => {
    const state = wildfire();
    const prepared = hit({ ...state, enemyStatuses: { ...state.enemyStatuses, stun: 40 } }, attack("stun", 12));
    const texts: CombatTextEvent[] = [];
    const result = hit(prepared, attack("nature", 1), texts);
    expect(result.enemyHealth).toBe(prepared.enemyHealth - 13);
    expect(notices(texts)).toMatchObject(["Thunderclap", "Wildfire"]);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.enemyStatuses.burn).toBe(2);
    expect(result.reactions).toMatchObject({ thunderclapDamage: 0, wildfireDamage: 0 });
  });

  it("Dodge, absorbed hits, and an already lethal attack preserve stored bursts", () => {
    const base = wildfire();
    for (const state of [
      { ...base, rng: () => 0 },
      { ...base, enemyMitigation: { ...base.enemyMitigation, block: 20 } },
      { ...base, enemyHealth: 1 },
    ])
      expect(hit(state, attack("nature")).reactions.wildfireDamage).toBe(6);
  });

  it("fatal retaliation prevents the burst, while Death's Door survival permits it", () => {
    const state = wildfire();
    const base = {
      ...state,
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyStatuses: { ...state.enemyStatuses, thorns: 20 },
    };
    const fatal = hit(base, attack("nature"));
    expect(fatal.playerHealth).toBe(0);
    expect(fatal.reactions.wildfireDamage).toBe(6);
    expect(hit({ ...base, deathsDoorActive: true }, attack("nature")).reactions.wildfireDamage).toBe(0);
  });

  it("attributes an Archery reaction kill and its ordinary kill rewards exactly once", () => {
    const state = wildfire();
    const card = cardById["lightning-arrow"]!;
    const result = playBattleCardResolved(
      {
        ...state,
        hand: [card],
        enemyHealth: 5,
        gold: 0,
        talentEffects: { ...state.talentEffects, goldOnArcheryKill: 2 },
      },
      card.id,
      0,
    );
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.gold).toBe(2);
    expect(result.state.flags.killRewardsPaid).toBe(true);
    expect(result.combatTexts.filter((text) => text.stat === "gold")).toEqual([expect.objectContaining({ amount: 2 })]);
  });
});

describe("reaction persistence and selection", () => {
  it("reload preserves spent CC opportunities, completed Wildfires, and unmatched ticks without duplicating rewards", () => {
    const first = controlled("freeze");
    let state = hit(first);
    state = { ...state, reactions: { ...state.reactions, wildfireDamage: 3, wildfirePendingTickDamage: 2 } };
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.reactions).toEqual(state.reactions);
    const resumed = { ...restored, rng: () => 0.99 };
    expect(hit(resumed).enemyHealth).toBe(state.enemyHealth - 4);
    const claimed = hit(resumed, attack("nature", 1));
    expect(claimed.reactions).toMatchObject({ wildfireDamage: 0, wildfirePendingTickDamage: 2 });
    expect(PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(claimed))).reactions).toEqual(claimed.reactions);
  });

  it("defaults missing progress, ignores retired flags, and repairs unsafe fields independently", () => {
    const state = controlled("freeze");
    const { reactions: _, ...old } = state;
    const restored = PersistedBattleStateSchema.parse({
      ...old,
      flags: { ...old.flags, shatterUsed: false, wildfireUsed: false },
    });
    expect(restored.reactions.shatterDamage).toBe(0);
    expect(restored.flags).not.toHaveProperty("wildfireUsed");
    const repaired = PersistedBattleStateSchema.parse({
      ...state,
      reactions: {
        shatterDamage: Number.MAX_SAFE_INTEGER + 1,
        frostfireDamage: -1,
        thunderclapDamage: 20,
        wildfirePendingTickDamage: 1.5,
        wildfireDamage: 3,
      },
    });
    expect(repaired.reactions).toEqual({
      shatterDamage: 0,
      frostfireDamage: 0,
      thunderclapDamage: 0,
      consecrated: false,
      wildfirePendingTickDamage: null,
      wildfireLastTickTurn: null,
      wildfireDamage: 3,
    });
  });

  it("automatic card and Wish selection recognize a lethal reaction without drawing RNG or mutating readiness", () => {
    const nature = attack("nature", 4);
    const physical = attack("physical", 6);
    const state = {
      ...wildfire(),
      enemyHealth: 7,
      mana: 1,
      hand: [physical, nature],
      wishOptions: null,
      rng: () => {
        throw new Error("selection rolled RNG");
      },
    };
    const before = { ...state.reactions };
    expect(findBestPlayableHandCard(state)?.card.id).toBe(nature.id);
    expect(findBestWishChoice({ ...state, wishOptions: [physical, nature] })?.id).toBe(nature.id);
    expect(state.reactions).toEqual(before);
    expect(getEffectiveDamageScore(makeTestCard({ effects: [...nature.effects, ...nature.effects] }), state)).toBe(11);
  });

  it("scores chance branches, random types, and commanded Companions without duplicating a stored payoff", () => {
    const state = wildfire();
    const twice = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "nature", amount: 1 }],
          failureEffects: [],
        },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    expect(getEffectiveDamageScore(twice, state)).toBe(7.5);
    const random = makeTestCard({
      effects: [{ kind: "random-damage", damageTypePool: ["nature", "holy"], minAmount: 1, maxAmount: 1 }],
    });
    expect(getEffectiveDamageScore(random, state)).toBe(4);
    const companion = {
      id: "skeleton" as const,
      title: "Companion",
      art: "",
      turnStartEffects: [{ kind: "damage" as const, damageType: "nature" as const, amount: 1 }],
    };
    const command = makeTestCard({ effects: [{ kind: "companion-action", amount: 2 }] });
    expect(getEffectiveDamageScore(command, { ...state, activeCompanion: companion })).toBe(8);
    const zero = {
      ...companion,
      turnStartEffects: [{ kind: "damage" as const, damageType: "nature" as const, amount: 0 }],
    };
    expect(
      getEffectiveDamageScore(command, {
        ...state,
        activeCompanion: zero,
        flags: { ...state.flags, companionNextAttackBonus: 1 },
      }),
    ).toBe(6);
  });

  it("keeps long random-type cards bounded and carries defense changes into the next finisher", () => {
    const prepared = controlled("freeze");
    const state = { ...prepared, reactions: { ...prepared.reactions, shatterDamage: 0 } };
    const card = makeTestCard({
      effects: Array.from({ length: 6 }, () => ({ kind: "random-damage" as const, minAmount: 1, maxAmount: 1 })),
    });
    // Venomflash also pays at least 2 when Poison precedes the first Burn in the sequence.
    const firstPoisonThenBurn = 1 - (7 / 8) ** 6 - 0.5 * (1 - (6 / 8) ** 6);
    expect(getEffectiveDamageScore(card, state)).toBeCloseTo(6 + 6 * (1 - (7 / 8) ** 6) + 2 * firstPoisonThenBurn);
    const before = wildfire();
    const kingbreaker = {
      ...before,
      gearEffects: { ...before.gearEffects, armorIncreasesStun: 1 },
      enemyMitigation: { ...before.enemyMitigation, armor: 5, block: 3 },
    };
    const follow = makeTestCard({
      effects: [
        { kind: "damage", damageType: "stun", amount: 0 },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    expect(getEffectiveDamageScore(follow, kingbreaker)).toBe(7);
  });

  it("scores defense removal and does not count blocked, zero, delayed, or converted attacks as reaction finishers", () => {
    const prepared = controlled("freeze");
    const physical = attack("physical", 4);
    const state = { ...prepared, enemyMitigation: { ...prepared.enemyMitigation, block: 8, armor: 5 } };
    expect(getEffectiveDamageScore(physical, state)).toBe(23);
    expect(getEffectiveDamageScore(attack("physical", 0), state)).toBe(0);
    expect(getEffectiveDamageScore(physical, { ...state, flags: { ...state.flags, nextHitPoison: true } })).toBe(4);
    const delayed = makeTestCard({
      effects: [{ kind: "repeat-over-turns", remainingTurns: 1, effects: [physical.effects[0]!] }],
    });
    expect(getEffectiveDamageScore(delayed, state)).toBe(4);
    const blocked = { ...wildfire(), enemyMitigation: { ...state.enemyMitigation, block: 20 } };
    expect(getEffectiveDamageScore(attack("nature", 4), blocked)).toBe(4);
  });
});
