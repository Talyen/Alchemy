import { describe, expect, it } from "vitest";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processEnemyAttack, processEnemyDamageEffect } from "@/lib/battle/enemy-turn-attack";
import type { BattleCardEffect } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { defaultGearEffects } from "@/lib/gear";

function dodgeThenMissRng() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? 0.01 : 0.99;
  };
}

describe("unique item battle effects", () => {
  it("Wardbreaker purges enemy armor/block/forge on stun and deals holy damage per purged stack", () => {
    const baseState = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 50 },
      enemyMitigation: { armor: 10, block: 15, forge: 5 },
      gearEffects: { ...defaultGearEffects, stunPurgeDealHolyPerEffect: 2 },
    });

    const combatTexts: CombatTextEvent[] = [];
    const afterStun = resolveStunTrigger(baseState, combatTexts);

    expect(afterStun.enemyMitigation.armor).toBe(0);
    expect(afterStun.enemyMitigation.block).toBe(0);
    expect(afterStun.enemyMitigation.forge).toBe(0);

    expect(afterStun.enemyHealth).toBe(40);
  });

  it("Golden Verdict builds stun from holy and awards gold only when that stun CCs", () => {
    const nonHolyStun = patchBattleState({
      gold: 10,
      enemyHealth: 100,
      enemyStatuses: { stun: 50 },
      gearEffects: { ...defaultGearEffects, holyStunBuildupGold: 25 },
    });

    const afterNonHolyStun = resolveStunTrigger(nonHolyStun, []);
    expect(afterNonHolyStun.gold).toBe(10);

    const holyEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      amount: 15,
      damageType: "holy",
    };
    const stateBeforeHoly = patchBattleState({
      gold: 10,
      enemyHealth: 100,
      enemyStatuses: { stun: 40 },
      gearEffects: { ...defaultGearEffects, holyStunBuildupGold: 25 },
    });
    const afterHoly = applyDamageStatuses(stateBeforeHoly, holyEffect, 15, []);
    expect(afterHoly.enemyStatuses.stun).toBe(0);
    expect(afterHoly.gold).toBe(35);
  });

  it("Bloodfire Signet leeches on burn/bleed damage and cross-procs", () => {
    const baseState = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 100,
      rng: () => 0.05,
      gearEffects: { ...defaultGearEffects, burnBleedMirrorAndLeech: 1 },
    });

    const burnEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      amount: 20,
      damageType: "burn",
    };
    const combatTexts: CombatTextEvent[] = [];
    const afterBurn = applyDamageStatuses(baseState, burnEffect, 20, combatTexts);

    expect(afterBurn.enemyStatuses.burn).toBe(20);
    expect(afterBurn.enemyStatuses.bleed).toBe(20);

    expect(afterBurn.playerHealth).toBe(60);
  });

  it("Rimeheart Locket grants block on freeze damage and mana on freeze CC only when player has block", () => {
    const baseState = patchBattleState({
      playerStatuses: { block: 0 },
      enemyHealth: 100,
      enemyStatuses: { freeze: 0 },
      gearEffects: { ...defaultGearEffects, freezeGrantsBlockAndMana: 1 },
    });

    const freezeEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      amount: 25,
      damageType: "freeze",
    };
    const combatTexts: CombatTextEvent[] = [];
    const afterFreeze = applyDamageStatuses(baseState, freezeEffect, 25, combatTexts);

    expect(afterFreeze.playerStatuses.block).toBe(25);
    expect(afterFreeze.enemyStatuses.freeze).toBe(25);
  });

  it("Rimeheart Locket restores Mana from Block when freeze CC lands", () => {
    const freezeEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      amount: 15,
      damageType: "freeze",
    };
    const afterFreeze = applyDamageStatuses(
      patchBattleState({
        mana: 0,
        maxMana: 4,
        playerStatuses: { block: 0 },
        enemyHealth: 100,
        enemyStatuses: { freeze: 40 },
        gearEffects: { ...defaultGearEffects, freezeGrantsBlockAndMana: 1 },
      }),
      freezeEffect,
      15,
      [],
    );
    expect(afterFreeze.playerStatuses.block).toBe(15);
    expect(afterFreeze.mana).toBe(4);
    expect(afterFreeze.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
  });

  it("Dance of Blades draws and plays a random deck card when an attack is Dodged", () => {
    const reactionCard = makeTestCard({
      id: "counter-strike",
      title: "Counter Strike",
      effects: [{ kind: "damage", amount: 20, damageType: "physical" }],
    });

    const baseState = patchBattleState({
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { armor: 10, block: 8 },
      deck: [reactionCard],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: dodgeThenMissRng(),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      gearEffects: { ...defaultGearEffects, dodgeDrawAndPlay: 1 },
    });

    const combatTexts: CombatTextEvent[] = [];
    const afterHit = processEnemyAttack(baseState, combatTexts);

    expect(afterHit.playerHealth).toBe(100);
    expect(afterHit.playerStatuses.block).toBe(8);
    expect(afterHit.playerStatuses.armor).toBe(10);
    expect(afterHit.enemyHealth).toBe(80);
    expect(afterHit.discard.some((c) => c.id === "counter-strike")).toBe(true);
    expect(afterHit.hand.some((c) => c.id === "counter-strike")).toBe(false);
    expect(afterHit.deck).toHaveLength(0);
    expect(combatTexts.some((event) => event.kind === "notice" && event.stat === "dodge")).toBe(true);
  });

  it("Dance of Blades still plays a deck card when the hand is full", () => {
    const reactionCard = makeTestCard({
      id: "counter-strike",
      title: "Counter Strike",
      effects: [{ kind: "damage", amount: 20, damageType: "physical" }],
    });
    const filler = makeTestCard({
      id: "filler",
      title: "Filler",
      effects: [{ kind: "damage", amount: 1, damageType: "physical" }],
    });

    const baseState = patchBattleState({
      playerHealth: 100,
      playerMaxHealth: 100,
      hand: Array.from({ length: 7 }, (_, index) => ({ ...filler, id: `filler-${index}` })),
      deck: [reactionCard],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: dodgeThenMissRng(),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      gearEffects: { ...defaultGearEffects, dodgeDrawAndPlay: 1 },
    });

    const afterHit = processEnemyAttack(baseState, []);
    expect(afterHit.hand).toHaveLength(7);
    expect(afterHit.hand.some((c) => c.id === "counter-strike")).toBe(false);
    expect(afterHit.discard.some((c) => c.id === "counter-strike")).toBe(true);
    expect(afterHit.enemyHealth).toBe(80);
  });

  it("Blackfletch detonates bleed and poison on archery attacks", () => {
    const archeryCard = makeTestCard({
      id: "quick-shot",
      title: "Quick Shot",
      effects: [{ kind: "damage", amount: 5, damageType: "physical" }],
      tags: ["archery"],
    });

    const baseState = patchBattleState({
      mana: 2,
      hand: [archeryCard],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 15, poison: 10 },
      gearEffects: { ...defaultGearEffects, archeryDetonateBleedPoison: 1 },
    });

    const resolution = playBattleCardResolved(baseState, "quick-shot", 0);

    expect(resolution.state.enemyHealth).toBe(70);
    expect(resolution.state.enemyStatuses.bleed).toBe(0);
    expect(resolution.state.enemyStatuses.poison).toBe(0);
  });

  it("Twin Casting draws freeze cards when burn is played, assigns unique UID, and respects hand limit", () => {
    const burnCard = makeTestCard({
      id: "fireball",
      title: "Fireball",
      effects: [{ kind: "damage", amount: 10, damageType: "burn" }],
      tags: ["burn"],
    });
    const freezeCard = makeTestCard({
      id: "frostbolt",
      title: "Frostbolt",
      effects: [{ kind: "damage", amount: 10, damageType: "freeze" }],
      tags: ["freeze"],
    });

    const baseState = patchBattleState({
      mana: 3,
      hand: [burnCard],
      deck: [freezeCard],
      nextCardUid: 100,
      gearEffects: { ...defaultGearEffects, elementalTwinCasting: 1 },
    });

    const resolution = playBattleCardResolved(baseState, "fireball", 0);

    const drawn = resolution.state.hand.find((c) => c.id === "frostbolt");
    expect(drawn).toBeDefined();
    expect(drawn?.uid).toBe(100);
    expect(resolution.state.nextCardUid).toBe(101);
    expect(resolution.state.deck).toHaveLength(0);
  });

  it("Twin Casting draws a burn card when a freeze card is played", () => {
    const freezeCard = makeTestCard({
      id: "frostbolt",
      title: "Frostbolt",
      effects: [{ kind: "damage", amount: 10, damageType: "freeze" }],
      tags: ["freeze"],
    });
    const burnCard = makeTestCard({
      id: "fireball",
      title: "Fireball",
      effects: [{ kind: "damage", amount: 10, damageType: "burn" }],
      tags: ["burn"],
    });
    const resolution = playBattleCardResolved(
      patchBattleState({
        mana: 3,
        hand: [freezeCard],
        deck: [burnCard],
        gearEffects: { ...defaultGearEffects, elementalTwinCasting: 1 },
      }),
      "frostbolt",
      0,
    );
    expect(resolution.state.hand.some((c) => c.id === "fireball")).toBe(true);
  });

  it("Saintfall Plate triggers holy & stun retribution once per battle only", () => {
    const baseState = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 100,
      playerStatuses: { block: 5 },
      enemyHealth: 100,
      gearEffects: { ...defaultGearEffects, saintfallRetribution: 6 },
    });

    const combatTexts: CombatTextEvent[] = [];
    const afterFirstDepletion = processEnemyDamageEffect(
      baseState,
      { kind: "damage", damageType: "physical", amount: 15 },
      combatTexts,
    );

    expect(afterFirstDepletion.playerStatuses.block).toBe(0);
    expect(afterFirstDepletion.enemyStatuses.stun).toBe(6);
    expect(afterFirstDepletion.playerHealth).toBe(46);
    expect(afterFirstDepletion.flags.saintfallRetributionTriggered).toBe(true);

    const reblockedState = patchBattleState({
      ...afterFirstDepletion,
      playerStatuses: { ...afterFirstDepletion.playerStatuses, block: 5 },
      enemyStatuses: { ...afterFirstDepletion.enemyStatuses, stun: 0 },
    });

    const afterSecondDepletion = processEnemyDamageEffect(
      reblockedState,
      { kind: "damage", damageType: "physical", amount: 15 },
      [],
    );

    expect(afterSecondDepletion.playerStatuses.block).toBe(0);
    expect(afterSecondDepletion.enemyStatuses.stun).toBe(0);
    expect(afterSecondDepletion.flags.saintfallRetributionTriggered).toBe(true);
  });
});
