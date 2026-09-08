import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects, type BattleCard } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyWishEffect, chooseWishCard } from "@/lib/battle/wish";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/damage-rider-leech";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 200,
    enemyMaxHealth: 200,
    playerHealth: 10,
    playerMaxHealth: 40,
    mana: 3,
    maxMana: 3,
    rng: () => 0.99,
    ...patch,
  });
}

function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [...state.hand, card] }, card.id, state.hand.length).state;
}

const wishTalents = computeTalentEffects({ wish: ["wish-mana"], mana: ["mana-arcane-mending"] });
const shieldTalents = computeTalentEffects({ block: ["block-reduce-burn", "block-to-holy"] });
const burnTalents = computeTalentEffects({ burn: ["burn-dmg-2"], forge: ["forge-to-burn"] });
const leechTalents = computeTalentEffects({ leech: ["leech-first-double"] });

const burn = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 2 }] });
const holy = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 2 }] });
const leech = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8, lifesteal: true }] });
const wish = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });

function resume(state: ReturnType<typeof battle>) {
  return { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state))), rng: () => 0.99 };
}

describe("Mana from Heaven", () => {
  it("banks every Wish without immediately refunding Mana or healing", () => {
    const initial = battle({ talentEffects: wishTalents });
    const wished = applyWishEffect(initial, wish, 3, []);
    expect(wished.mana).toBe(3);
    expect(wished.playerHealth).toBe(10);
    expect(wished.flags.pendingWishMana).toBe(3);
    const next = advanceToPlayerTurn(resume(wished));
    expect(next.mana).toBe(6);
    expect(next.playerHealth).toBe(12);
    expect(next.flags.pendingWishMana).toBe(0);
    expect(advanceToPlayerTurn(next).mana).toBe(3);
  });

  it("leaves Dark Pact with a Mana cost despite its other Wish rewards", () => {
    const initial = battle({
      talentEffects: computeTalentEffects({
        wish: ["wish-mana", "wish-health", "wish-draw"],
        gold: ["gold-on-wish"],
      }),
    });
    const next = play(initial, cardById["dark-pact"]!);
    expect(next.mana).toBe(2);
    expect(next.playerHealth).toBe(11);
    expect(next.gold).toBe(3);
    expect(next.flags.pendingWishMana).toBe(1);
    expect(chooseWishCard(next, next.wishOptions![0]!.id).flags.pendingWishMana).toBe(1);
  });

  it("keeps existing Gear Mana immediate while banking the talent reward", () => {
    const next = applyWishEffect(
      battle({ mana: 0, talentEffects: wishTalents, gearEffects: { manaOnWish: 1 } }),
      wish,
      1,
      [],
    );
    expect(next.mana).toBe(1);
    expect(next.playerHealth).toBe(12);
    expect(next.flags.pendingWishMana).toBe(1);
  });

  it("pays banked Mana on a Haste turn without carrying it into another turn", () => {
    const wished = applyWishEffect(battle({ talentEffects: wishTalents, playerStatuses: { haste: 1 } }), wish, 2, []);
    const next = endPlayerTurn(wished).state;
    expect(next.mana).toBe(5);
    expect(next.flags.pendingWishMana).toBe(0);
  });

  it("banks Wishes created by scheduled effects for the following turn", () => {
    const initial = battle({
      talentEffects: wishTalents,
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "wish", amount: 1 }] }],
    });
    const next = advanceToPlayerTurn(initial);
    expect(next.mana).toBe(3);
    expect(next.flags.pendingWishMana).toBe(1);
    expect(advanceToPlayerTurn(next).mana).toBe(4);
  });
});

describe("card play rewards", () => {
  it("Faith Barrier supplies Block that Sacred Shield uses on the same card", () => {
    const next = play(
      battle({ talentEffects: computeTalentEffects({ holy: ["holy-block-scaling"], block: ["block-to-holy"] }) }),
      holy,
    );
    expect(next.playerStatuses.block).toBe(2);
    expect(next.enemyHealth).toBe(197);
  });

  it("repeating Holy effects does not repeat the play reward", () => {
    const next = play(
      battle({
        talentEffects: computeTalentEffects({ holy: ["holy-block-scaling"] }),
        flags: { playNextCardTwice: true },
      }),
      holy,
    );
    expect(next.playerStatuses.block).toBe(2);
    expect(next.enemyHealth).toBe(196);
  });

  it("Thermal Vent supplies Forge that Ignite uses on the same card", () => {
    const next = play(battle({ talentEffects: burnTalents }), burn);
    expect(next.enemyHealth).toBe(197);
    expect(next.playerStatuses.forge).toBe(0);
  });

  it("Thermal Vent uses Intensify, Desperate Forge, and Overheat without a feedback loop", () => {
    const next = play(
      battle({
        talentEffects: computeTalentEffects({
          burn: ["burn-dmg-2"],
          forge: ["forge-strength-4", "forge-strength-5", "forge-burn-burst"],
        }),
      }),
      burn,
    );
    expect(next.playerStatuses.forge).toBe(4);
    expect(next.enemyHealth).toBe(190);
  });

  it("multiple Burn packets and repeated effects grant Forge for only the card play", () => {
    const next = play(
      battle({ talentEffects: computeTalentEffects({ burn: ["burn-dmg-2"] }), flags: { playNextCardTwice: true } }),
      { ...burn, effects: [...burn.effects, ...burn.effects] },
    );
    expect(next.playerStatuses.forge).toBe(1);
    expect(next.enemyHealth).toBe(192);
  });

  it("triggered and scheduled damage do not grant card play rewards", () => {
    const initial = battle({
      talentEffects: computeTalentEffects({ burn: ["burn-dmg-2"], holy: ["holy-block-scaling"] }),
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [...burn.effects, ...holy.effects] }],
    });
    const next = advanceToPlayerTurn(dealPlayerTypedHit(initial, "burn", 2, []));
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.playerStatuses.block).toBe(0);
  });

  it("automatically played Burn cards receive the play reward", () => {
    const next = processEnemyAttack(
      battle({
        playerHealth: 40,
        deck: [burn],
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
        talentEffects: computeTalentEffects({ burn: ["burn-dmg-2"] }),
        gearEffects: { dodgeDrawAndPlay: 1 },
        rng: () => 0,
      }),
      [],
    );
    expect(next.playerStatuses.forge).toBe(1);
  });
});

describe("Sun-Struck Shield reflection", () => {
  it("keeps Holy-triggered Gear buildup without granting card play rewards", () => {
    const next = processEnemyAttack(
      battle({
        talentEffects: { ...shieldTalents, blockOnHolyCard: 2 },
        gearEffects: { holyStunBuildupGold: 1 },
        playerStatuses: { block: 20 },
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      }),
      [],
    );
    expect(next.enemyStatuses.stun).toBe(3);
    expect(next.playerStatuses.block).toBe(10);
  });

  it.each([false, true])("does not pace reflected damage twice (pacing %s)", (appliesFightPacing) => {
    const next = processEnemyDamageEffect(
      battle({
        appliesFightPacing,
        turn: 100,
        talentEffects: shieldTalents,
        playerStatuses: { block: 100 },
      }),
      { kind: "damage", damageType: "physical", amount: 10 },
      [],
      {
        incomingDamage: 10,
        triggerBlockRetaliation: true,
      },
    );
    expect(next.enemyHealth).toBe(197);
    expect(next.playerStatuses.block).toBe(90);
  });

  it("applies enemy Holy weakness without multiplying reflection through Shatter", () => {
    const next = processEnemyDamageEffect(
      battle({
        talentEffects: { ...shieldTalents, freezeDoubleDamage: true },
        currentEnemy: { traits: [{ id: "holy-vulnerability", title: "", description: "" }] },
        enemyCC: { freezeSkipTurns: 1 },
        playerStatuses: { block: 20 },
      }),
      { kind: "damage", damageType: "physical", amount: 10 },
      [],
      {
        triggerBlockRetaliation: true,
      },
    );
    expect(next.enemyHealth).toBe(194);
  });

  it("uses Block spent without attack scaling, crits, Forge consumption, or extra pacing", () => {
    const next = processEnemyAttack(
      battle({
        playerHealth: 40,
        gold: 1000,
        playerStatuses: { block: 100, forge: 20 },
        talentEffects: { ...shieldTalents, forgeToHoly: true, holyGoldPercent: 3, holyBlockPercentFromDamage: 15 },
        gearEffects: { flatHolyDamage: 50 },
        flags: { nextHitCrit: true },
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 3 }],
      }),
      [],
    );
    expect(next.enemyHealth).toBe(199);
    expect(next.playerStatuses.block).toBe(97);
    expect(next.playerStatuses.forge).toBe(20);
    expect(next.flags.nextHitCrit).toBe(true);
  });

  it("reflects spent Block rather than the larger damage absorbed by Reinforce", () => {
    const next = processEnemyAttack(
      battle({
        talentEffects: { ...shieldTalents, blockAbsorbPhysicalBonus: 20 },
        playerStatuses: { block: 100 },
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 9 }],
      }),
      [],
    );
    expect(next.playerStatuses.block).toBe(92);
    expect(next.enemyHealth).toBe(198);
  });

  it("respects enemy Block and does not reward fully blocked Holy damage", () => {
    const next = processEnemyAttack(
      battle({
        talentEffects: { ...shieldTalents, holyBlockPercentFromDamage: 100 },
        playerStatuses: { block: 20 },
        enemyMitigation: { block: 3 },
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      }),
      [],
    );
    expect(next.enemyHealth).toBe(200);
    expect(next.enemyMitigation.block).toBe(0);
    expect(next.playerStatuses.block).toBe(10);
  });

  it("retains Holy healing and Block rewards on reflected damage", () => {
    const next = processEnemyAttack(
      battle({
        talentEffects: { ...shieldTalents, holyLifestealPercent: 10, holyBlockPercentFromDamage: 15 },
        playerStatuses: { block: 100 },
        enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 60 }],
      }),
      [],
    );
    expect(next.enemyHealth).toBe(182);
    expect(next.playerStatuses.block).toBe(43);
    expect(next.playerHealth).toBe(12);
  });
});

describe("Deep Siphon", () => {
  it("boosts every explicit card Leech, including repeated effects", () => {
    const next = play(battle({ talentEffects: leechTalents, flags: { playNextCardTwice: true } }), leech);
    expect(next.playerHealth).toBe(20);
    expect(next.flags.firstLeechCardDoubledUsed).toBe(false);
  });

  it("does not boost incidental Leech or let it spend the card bonus", () => {
    const initial = battle({ talentEffects: leechTalents });
    const passive = applyLifestealAndPlayerHitTriggers(initial, 8, []);
    expect(passive.playerHealth).toBe(14);
    expect(play(passive, leech).playerHealth).toBe(19);
  });

  it("boosts explicit Leech in scheduled card effects", () => {
    const next = advanceToPlayerTurn(
      battle({
        talentEffects: leechTalents,
        pendingTurnStartEffects: [{ remainingTurns: 1, effects: leech.effects }],
      }),
    );
    expect(next.playerHealth).toBe(15);
  });
});

describe("talent save compatibility", () => {
  it("defaults new rewards without changing old combat manifests", () => {
    const saved = JSON.parse(
      JSON.stringify(
        battle({
          talentEffects: { manaOnWish: 1, firstLeechCardDoubled: true, forgeOnBurnDealt: 1, holyOnAttackBlocked: 1 },
        }),
      ),
    );
    delete saved.flags.pendingWishMana;
    for (const key of [
      "manaNextTurnOnWish",
      "holyReflectionBlockLostPercent",
      "blockOnHolyCard",
      "forgeOnBurnCard",
      "cardLeechBonusPercent",
    ])
      delete saved.talentEffects[key];
    const restored = PersistedBattleStateSchema.parse(saved);
    expect(restored.flags.pendingWishMana).toBe(0);
    expect(restored.talentEffects.manaNextTurnOnWish).toBe(0);
    expect(restored.talentEffects.firstLeechCardDoubled).toBe(true);
    expect(restored.talentEffects.holyOnAttackBlocked).toBe(1);
    expect(restored.talentEffects.forgeOnBurnDealt).toBe(1);
    expect(applyWishEffect({ ...restored, rng: () => 0.99, mana: 0 }, wish, 1, []).mana).toBe(1);
  });
});
