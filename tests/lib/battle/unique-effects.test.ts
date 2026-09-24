import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it, vi } from "vitest";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import type { BattleCardEffect } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { damageOnlyEffects } from "@/lib/battle/card-classification";
import { defaultGearEffects } from "@/lib/gear";
import { prepareUniqueCardPlay, processArcheryEchoes } from "@/lib/battle/unique-card-effects";

function dodgeThenMissRng() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls <= 2 ? 0.01 : 0.99;
  };
}

describe("unique item battle effects", () => {
  it("Wardbreaker purges one benefit per turn without dealing Holy damage", () => {
    const baseState = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { armor: 10, block: 15, forge: 5 },
      gearEffects: { ...defaultGearEffects, attackPurgeOncePerTurn: 1 },
    });

    const combatTexts: CombatTextEvent[] = [];
    const afterPurge = resolvePlayerHit(baseState, { source: "attack-purge" }, combatTexts);

    expect(afterPurge.enemyMitigation.armor).toBe(0);
    expect(afterPurge.enemyMitigation.block).toBe(15);
    expect(afterPurge.enemyMitigation.forge).toBe(5);

    expect(afterPurge.enemyHealth).toBe(100);
    expect(afterPurge.uniqueGear.wardbreakerPurgeUsed).toBe(true);
    expect(combatTexts).toContainEqual(expect.objectContaining({ target: "enemy", stat: "armor", signal: "purge" }));
    const sameTurn = resolvePlayerHit(afterPurge, { source: "attack-purge" }, []);
    expect(sameTurn.enemyMitigation.block).toBe(15);
    const nextTurn = advanceToPlayerTurn(sameTurn);
    expect(nextTurn.uniqueGear.wardbreakerPurgeUsed).toBe(false);
    expect(resolvePlayerHit(nextTurn, { source: "attack-purge" }, []).enemyMitigation.block).toBe(0);
  });

  it("Wardbreaker purges beneficial enemy statuses after mitigation and ignores harmful statuses", () => {
    const baseState = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { thorns: 3, burnBonus: 2, poison: 4 },
      gearEffects: { ...defaultGearEffects, attackPurgeOncePerTurn: 1 },
    });

    const afterPurge = resolvePlayerHit(baseState, { source: "attack-purge" }, []);

    expect(afterPurge.enemyStatuses).toMatchObject({ thorns: 0, burnBonus: 2, poison: 4 });
    const nextTurn = advanceToPlayerTurn(afterPurge);
    const afterBonus = resolvePlayerHit(nextTurn, { source: "attack-purge" }, []);
    expect(afterBonus.enemyStatuses).toMatchObject({ burnBonus: 0, poison: 4 });
  });

  it("Wardbreaker saves its turn use until an enemy gains a benefit", () => {
    const state = patchBattleState({ gearEffects: { ...defaultGearEffects, attackPurgeOncePerTurn: 1 } });
    const empty = resolvePlayerHit(state, { source: "attack-purge" }, []);
    expect(empty.uniqueGear.wardbreakerPurgeUsed).toBe(false);
    const protectedEnemy = { ...empty, enemyMitigation: { ...empty.enemyMitigation, block: 4 } };
    const purged = resolvePlayerHit(protectedEnemy, { source: "attack-purge" }, []);
    expect(purged.enemyMitigation.block).toBe(0);
    expect(purged.uniqueGear.wardbreakerPurgeUsed).toBe(true);
  });

  it("Wardbreaker purge triggers when playing an attack card", () => {
    const strikeCard = makeTestCard({
      id: "strike",
      title: "Strike",
      effects: [{ kind: "damage", amount: 10, damageType: "holy" }],
    });

    const baseState = patchBattleState({
      mana: 3,
      hand: [strikeCard],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { armor: 4, block: 0, forge: 0 },
      gearEffects: { ...defaultGearEffects, attackPurgeOncePerTurn: 1 },
    });

    const resolution = playBattleCardResolved(baseState, "strike", 0);

    expect(resolution.state.enemyMitigation.armor).toBe(0);
    expect(resolution.state.enemyHealth).toBe(90);
  });

  it("Golden Verdict awards gold when Holy damage completes a Stun", () => {
    const nonHolyStun = patchBattleState({
      gold: 10,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 60 },
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

    expect(afterBurn.playerHealth).toBe(50);
    const second = applyDamageStatuses(afterBurn, burnEffect, 20, []);
    expect(second.playerHealth).toBe(60);
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

  it("Rimeheart Locket restores uncapped Mana from Block when freeze CC lands", () => {
    const freezeEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      amount: 15,
      damageType: "freeze",
    };
    const afterFreeze = applyDamageStatuses(
      patchBattleState({
        mana: 0,
        maxMana: 10,
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
    expect(afterFreeze.mana).toBe(8);
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
      gearEffects: { ...defaultGearEffects, dodgeDrawAndPlay: 1 },
    });

    const combatTexts: CombatTextEvent[] = [];
    const afterHit = applyEnemyAbility(
      baseState,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      combatTexts,
    );

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
      gearEffects: { ...defaultGearEffects, dodgeDrawAndPlay: 1 },
    });

    const afterHit = applyEnemyAbility(
      baseState,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(afterHit.hand).toHaveLength(7);
    expect(afterHit.hand.some((c) => c.id === "counter-strike")).toBe(false);
    expect(afterHit.discard.some((c) => c.id === "counter-strike")).toBe(true);
    expect(afterHit.enemyHealth).toBe(80);
  });

  it.each([
    [100, 95, 15, 10],
    [35, 30, 15, 10],
    [34, 0, 0, 0],
  ])("Blackfletch checks Health after the arrow at %i Health", (health, expectedHealth, bleed, poison) => {
    const archeryCard = makeTestCard({
      id: "quick-shot",
      effects: [{ kind: "damage", amount: 5, damageType: "physical" }],
      tags: ["archery"],
    });
    const state = patchBattleState({
      mana: 2,
      hand: [archeryCard],
      enemyHealth: health,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 15, poison: 10 },
      gearEffects: { ...defaultGearEffects, archeryDetonateBleedPoison: 1 },
    });
    const result = playBattleCardResolved(state, "quick-shot", 0).state;
    expect(result.enemyHealth).toBe(expectedHealth);
    expect(result.enemyStatuses.bleed).toBe(bleed);
    expect(result.enemyStatuses.poison).toBe(poison);
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

  it.each([
    { roll: 0.1, expected: "freeze-second" },
    { roll: 0.9, expected: "burn-second" },
  ])("Twin Casting preserves mixed-card selection with roll $roll", ({ roll, expected }) => {
    const rng = vi.fn().mockReturnValueOnce(roll).mockReturnValueOnce(0.9);
    const card = makeTestCard({ id: "mixed", cost: 0, tags: ["burn", "freeze"], effects: [] });
    const deck = [
      makeTestCard({ id: "freeze-first", tags: ["freeze"], effects: [] }),
      makeTestCard({ id: "burn-first", tags: ["burn"], effects: [] }),
      makeTestCard({ id: "freeze-second", tags: ["freeze"], effects: [] }),
      makeTestCard({ id: "burn-second", tags: ["burn"], effects: [] }),
    ];
    const state = patchBattleState({
      hand: [card],
      deck,
      nextCardUid: 100,
      gearEffects: { elementalTwinCasting: 1 },
      rng,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.hand.map(({ id, uid }) => ({ id, uid }))).toEqual([{ id: expected, uid: 100 }]);
    expect(result.deck.map(({ id }) => id)).toEqual(deck.filter(({ id }) => id !== expected).map(({ id }) => id));
    expect(result.nextCardUid).toBe(101);
    expect(rng).toHaveBeenCalledTimes(2);
    expect(state.deck).toEqual(deck);
  });

  it("Twin Casting does not refill an empty deck from discard", () => {
    const rng = vi.fn(() => 0.1);
    const card = makeTestCard({ id: "mixed", cost: 0, tags: ["burn", "freeze"], effects: [] });
    const discarded = makeTestCard({ id: "freeze", tags: ["freeze"], effects: [] });
    const state = patchBattleState({
      hand: [card],
      deck: [],
      discard: [discarded],
      nextCardUid: 100,
      gearEffects: { elementalTwinCasting: 1 },
      rng,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.hand).toEqual([]);
    expect(result.deck).toEqual([]);
    expect(result.discard).toEqual([discarded, card]);
    expect(result.nextCardUid).toBe(100);
    expect(rng).toHaveBeenCalledTimes(1);
  });

  it("Saintfall Plate triggers holy retribution and heal on every block depletion", () => {
    const baseState = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 100,
      playerStatuses: { block: 5 },
      enemyHealth: 100,
      gearEffects: { ...defaultGearEffects, saintfallRetribution: 4 },
    });

    const combatTexts: CombatTextEvent[] = [];
    const afterFirstDepletion = processEnemyDamageEffect(
      baseState,
      { kind: "damage", damageType: "physical", amount: 15 },
      combatTexts,
    );

    expect(afterFirstDepletion.playerStatuses.block).toBe(0);
    expect(afterFirstDepletion.enemyStatuses.stun).toBe(0);
    expect(afterFirstDepletion.playerHealth).toBe(44);

    const reblockedState = patchBattleState({
      ...afterFirstDepletion,
      playerStatuses: { ...afterFirstDepletion.playerStatuses, block: 5 },
    });

    const afterSecondDepletion = processEnemyDamageEffect(
      reblockedState,
      { kind: "damage", damageType: "physical", amount: 15 },
      [],
    );

    expect(afterSecondDepletion.playerStatuses.block).toBe(0);
    expect(afterSecondDepletion.enemyStatuses.stun).toBe(0);
    expect(afterSecondDepletion.playerHealth).toBe(38);
  });

  it("damageTypePool selects from the provided element pool on card play", () => {
    const astralCard = makeTestCard({
      id: "astral-arrow",
      title: "Astral Arrow",
      effects: [
        {
          kind: "damage",
          damageType: "holy",
          damageTypePool: ["freeze", "burn", "holy"],
          amount: 4,
        },
      ],
    });

    const baseState = patchBattleState({
      mana: 3,
      hand: [astralCard],
      enemyHealth: 50,
      enemyMaxHealth: 50,
    });

    const resolution = playBattleCardResolved(baseState, "astral-arrow", 0);
    expect(resolution.state.enemyHealth).toBe(46);
    const hasStatus =
      resolution.state.enemyStatuses.freeze > 0 ||
      resolution.state.enemyStatuses.burn > 0 ||
      resolution.state.enemyHealth === 46;
    expect(hasStatus).toBe(true);
  });
});

describe("damageOnlyEffects", () => {
  it("preserves scheduled damage inside repeat-over-turns for echoes and repeats", () => {
    const scheduled: BattleCardEffect = {
      kind: "repeat-over-turns",
      remainingTurns: 2,
      effects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    } as BattleCardEffect;
    const filtered = damageOnlyEffects([scheduled]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ kind: "repeat-over-turns", remainingTurns: 2 });
    expect((filtered[0] as { effects: BattleCardEffect[] }).effects).toHaveLength(1);
  });

  it("drops repeat-over-turns wrappers with no damage inside", () => {
    const scheduled: BattleCardEffect = {
      kind: "repeat-over-turns",
      remainingTurns: 2,
      effects: [{ kind: "draw-cards", amount: 1 }],
    } as BattleCardEffect;
    expect(damageOnlyEffects([scheduled])).toHaveLength(0);
  });
});

describe("prepareUniqueCardPlay flag matrix", () => {
  const gear = (overrides = {}) => ({ ...defaultGearEffects, ...overrides });

  it("arms final spark only when the card spends all remaining mana", () => {
    const burnPhysical = () =>
      makeTestCard({
        cost: 3,
        tags: ["burn"],
        effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      });
    const armed = prepareUniqueCardPlay(
      patchBattleState({ mana: 3, gearEffects: gear({ lastManaElementalRepeat: 1 }) }),
      burnPhysical(),
      3,
    );
    expect(armed.repeatCount).toBe(1);
    expect(armed.state.uniqueGear.finalSparkUsed).toBe(true);

    const spareMana = prepareUniqueCardPlay(
      patchBattleState({ mana: 4, gearEffects: gear({ lastManaElementalRepeat: 1 }) }),
      burnPhysical(),
      3,
    );
    expect(spareMana.repeatCount).toBe(0);

    const broke = prepareUniqueCardPlay(
      patchBattleState({ mana: 0, gearEffects: gear({ lastManaElementalRepeat: 1 }) }),
      burnPhysical(),
      0,
    );
    expect(broke.repeatCount).toBe(0);
  });

  it("stacks everkeen and final spark repeats and consumes everkeen", () => {
    const prepared = prepareUniqueCardPlay(
      patchBattleState({
        mana: 2,
        gearEffects: gear({ lastManaElementalRepeat: 1, forgeReadiesPhysicalRepeat: 1 }),
        uniqueGear: { everkeenReady: true },
      }),
      makeTestCard({
        cost: 2,
        tags: ["freeze"],
        effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
      }),
      2,
    );
    expect(prepared.repeatCount).toBe(2);
    expect(prepared.state.uniqueGear.everkeenReady).toBe(false);
    expect(prepared.state.uniqueGear.finalSparkUsed).toBe(true);
  });

  it("crits nature cards while wildheart is ready and consumes it", () => {
    const prepared = prepareUniqueCardPlay(
      patchBattleState({
        gearEffects: gear({ dodgeReadiesNatureCrit: 1 }),
        uniqueGear: { wildheartReady: true },
      }),
      makeTestCard({ tags: ["nature"], effects: [{ kind: "damage", damageType: "nature", amount: 4 }] }),
      1,
    );
    expect(prepared.critical).toBe(true);
    expect(prepared.state.uniqueGear.wildheartReady).toBe(false);
  });
});

describe("processArcheryEchoes", () => {
  it("clears queued echoes even when the echo gear is disabled", () => {
    const echo = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
    const state = patchBattleState({
      enemyHealth: 40,
      uniqueGear: { archeryEchoes: [echo] },
      gearEffects: { ...defaultGearEffects, archeryEchoNextTurn: 0 },
    });
    const result = processArcheryEchoes(state, []);
    expect(result.uniqueGear.archeryEchoes).toEqual([]);
    expect(result.enemyHealth).toBe(40);
  });
});
