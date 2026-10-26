import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { computeTalentEffects, type BattleCard } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyWishEffect } from "@/lib/battle/wish";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/follow-up-hit-resolution";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
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
const leechTalents = computeTalentEffects({ leech: ["leech-first-double"] });

const burn = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 2 }] });
const holy = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 2 }] });
const leech = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10, lifesteal: true }] });
const wish = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });

it("Mana from Heaven leaves per-Wish gear rewards independent of the card refund", () => {
  const next = applyWishEffect(
    battle({ mana: 0, talentEffects: wishTalents, gearEffects: { manaOnWish: 1 } }),
    wish,
    1,
    [],
  );
  expect(next.mana).toBe(1);
  expect(next.playerHealth).toBe(11);
});

describe("card play rewards", () => {
  it("Faith Barrier supplies Block that Sacred Shield uses on the same card", () => {
    const next = play(
      battle({
        playerStatuses: { block: 4 },
        talentEffects: computeTalentEffects({ holy: ["holy-block-scaling"], block: ["block-to-holy"] }),
        rng: () => 0.05,
      }),
      holy,
    );
    expect(next.playerStatuses.block).toBe(6);
    expect(next.enemyHealth).toBe(198);
  });

  it("repeating Holy effects does not repeat the play reward", () => {
    const next = play(
      battle({
        talentEffects: computeTalentEffects({ holy: ["holy-block-scaling"] }),
        flags: { playNextCardTwice: true },
        rng: () => 0.05,
      }),
      holy,
    );
    expect(next.playerStatuses.block).toBe(4);
    expect(next.enemyHealth).toBe(196);
  });

  it("Thermal Vent uses Intensify, Desperate Forge, and Overheat without a feedback loop", () => {
    const next = play(
      battle({
        rng: (() => {
          let rolls = 0;
          return () => (rolls++ === 0 ? 0 : 0.99);
        })(),
        playerStatuses: { forge: 1 },
        talentEffects: computeTalentEffects({
          burn: ["burn-dmg-2"],
          forge: ["forge-strength-4", "forge-strength-5", "forge-burn-burst"],
        }),
      }),
      burn,
    );
    expect(next.playerStatuses.forge).toBe(2);
    expect(next.enemyHealth).toBe(198);
  });

  it("multiple Burn packets and repeated effects grant Forge for only the card play", () => {
    const next = play(
      battle({
        rng: (() => {
          let rolls = 0;
          return () => (rolls++ === 0 ? 0 : 0.99);
        })(),
        talentEffects: computeTalentEffects({ burn: ["burn-dmg-2"] }),
        flags: { playNextCardTwice: true },
      }),
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
    const next = advanceToPlayerTurn(
      resolveFollowUpHit(initial, { source: "player-follow-up", damageType: "burn", amount: 2 }, []),
    );
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.playerStatuses.block).toBe(0);
  });

  it("automatically played Burn cards receive the play reward", () => {
    const next = applyEnemyAbility(
      battle({
        rng: () => 0,
        playerHealth: 40,
        deck: [burn],
        talentEffects: computeTalentEffects({ burn: ["burn-dmg-2"] }),
        gearEffects: { dodgeDrawAndPlay: 1 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      [],
    );
    expect(next.playerStatuses.forge).toBe(1);
  });
});

describe("Sun-Struck Shield reflection", () => {
  it("keeps Holy-triggered Gear buildup without granting card play rewards", () => {
    const next = applyEnemyAbility(
      battle({
        talentEffects: shieldTalents,
        gearEffects: { holyStunBuildupGold: 1 },
        playerStatuses: { block: 10 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
      [],
    );
    expect(next.enemyStatuses.stun).toBe(3);
    expect(next.playerStatuses.block).toBe(0);
  });

  it.each([false, true])("does not pace reflected damage twice (pacing %s)", (appliesFightPacing) => {
    const next = processEnemyDamageEffect(
      battle({
        appliesFightPacing,
        turn: 100,
        talentEffects: shieldTalents,
        playerStatuses: { block: 10 },
      }),
      { kind: "damage", damageType: "physical", amount: 10 },
      [],
      {
        preparedDamage: { attemptedDamage: 10, incomingDamage: 10 },
        triggerBlockRetaliation: true,
      },
    );
    expect(next.enemyHealth).toBe(197);
    expect(next.playerStatuses.block).toBe(0);
  });

  it("applies enemy Holy weakness without multiplying reflection through Shatter", () => {
    const next = processEnemyDamageEffect(
      battle({
        talentEffects: { ...shieldTalents, freezeDamageBonusVsFrozen: 1 },
        currentEnemy: { traits: [{ id: "holy-vulnerability", title: "", description: "" }] },
        enemyCC: { freezeSkipTurns: 1 },
        playerStatuses: { block: 10 },
      }),
      { kind: "damage", damageType: "physical", amount: 10 },
      [],
      {
        triggerBlockRetaliation: true,
      },
    );
    expect(next.enemyHealth).toBe(196);
  });

  it("uses Block spent without attack scaling, crits, Forge consumption, or extra pacing", () => {
    const next = applyEnemyAbility(
      battle({
        playerHealth: 40,
        gold: 1000,
        playerStatuses: { block: 3, forge: 20 },
        talentEffects: {
          ...shieldTalents,
          forgeHolyDamagePercent: 100,
          holyGoldPercent: 3,
        },
        gearEffects: { flatHolyDamage: 50 },
        flags: { nextHitCrit: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 3 }] }),
      [],
    );
    expect(next.enemyHealth).toBe(199);
    expect(next.playerStatuses.block).toBe(0);
    expect(next.playerStatuses.forge).toBe(20);
    expect(next.flags.nextHitCrit).toBe(true);
  });

  it("reflects spent Block rather than the larger damage absorbed by Reinforce", () => {
    const next = applyEnemyAbility(
      battle({
        talentEffects: { ...shieldTalents, blockAbsorbPhysicalBonus: 20 },
        playerStatuses: { block: 8 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 9 }] }),
      [],
    );
    expect(next.playerStatuses.block).toBe(0);
    expect(next.enemyHealth).toBe(198);
  });

  it("respects enemy Block and does not reward fully blocked Holy damage", () => {
    const next = applyEnemyAbility(
      battle({
        talentEffects: { ...shieldTalents, holyBlockChance: 100 },
        playerStatuses: { block: 10 },
        enemyMitigation: { block: 3 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
      [],
    );
    expect(next.enemyHealth).toBe(200);
    expect(next.enemyMitigation.block).toBe(0);
    expect(next.playerStatuses.block).toBe(0);
  });

  it("retains low-Health Holy healing from reflected damage", () => {
    const next = applyEnemyAbility(
      battle({
        talentEffects: { ...shieldTalents, holyLifestealPercent: 10 },
        playerStatuses: { block: 57 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 60 }] }),
      [],
    );
    expect(next.enemyHealth).toBe(183);
    expect(next.playerStatuses.block).toBe(0);
    expect(next.playerHealth).toBe(12);
  });
});

describe("Deep Siphon", () => {
  it("boosts every explicit card Leech, including repeated effects", () => {
    const next = play(battle({ talentEffects: leechTalents, flags: { playNextCardTwice: true } }), leech);
    expect(next.playerHealth).toBe(22);
  });

  it("boosts incidental Leech and the following card independently", () => {
    const initial = battle({ talentEffects: leechTalents });
    const passive = applyLifestealAndPlayerHitTriggers(initial, 8, []);
    expect(passive.playerHealth).toBe(15);
    expect(play(passive, leech).playerHealth).toBe(21);
  });

  it("boosts explicit Leech in scheduled card effects", () => {
    const next = advanceToPlayerTurn(
      battle({
        talentEffects: leechTalents,
        pendingTurnStartEffects: [{ remainingTurns: 1, effects: leech.effects }],
      }),
    );
    expect(next.playerHealth).toBe(16);
  });

  it("Shield Slam and Weighted Guard stack in either purchase order", () => {
    const first = computeTalentEffects({ block: ["block-to-physical"], physical: ["physical-shield-bash"] });
    const second = computeTalentEffects({ physical: ["physical-shield-bash"], block: ["block-to-physical"] });
    expect(first.blockToPhysicalDamageMultiplier).toBeCloseTo(0.6);
    expect(second.blockToPhysicalDamageMultiplier).toBeCloseTo(0.6);
  });
});
