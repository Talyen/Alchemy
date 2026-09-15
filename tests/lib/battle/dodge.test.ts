import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { defaultTalentEffects } from "@/lib/battle";
import { defaultGearEffects } from "@/lib/gear";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { prepareEnemyDamage } from "@/lib/battle/enemy-attack-damage";
import { scaleEnemyAbilityDamage } from "@/lib/battle/battle-enemy-setup";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { companionLibrary } from "@/lib/game-data";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import {
  dealDamage,
  incomingPhysical,
  makeCombatTexts,
  makeEffect,
  makeTestCard,
  patchBattleState,
} from "../../fixtures/battle";
import { defaultEnemyStatusValues, defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

describe("Dodge gear affixes", () => {
  it("gains Block, Armor, and Health on Dodge", () => {
    const texts = makeCombatTexts();
    const state = incomingPhysical({
      playerStatuses: defaultPlayerStatusValues({ block: 1, armor: 1 }),
      gearEffects: { ...defaultGearEffects, blockOnDodge: 4, armorOnDodge: 2, healOnDodge: 5 },
      playerHealth: 20,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      texts,
    );
    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerStatuses.armor).toBe(3);
    expect(texts.some((event) => event.kind === "notice" && event.stat === "dodge")).toBe(true);
  });

  it("keeps Dodge Armor rewards unscaled during fight pacing", () => {
    const state = incomingPhysical({
      appliesFightPacing: true,
      turn: 100,
      playerStatuses: defaultPlayerStatusValues({ armor: 1 }),
      gearEffects: { ...defaultGearEffects, armorOnDodge: 2 },
      talentEffects: { ...patchBattleState().talentEffects, armorOnDodge: 3 },
    });
    const texts = makeCombatTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      texts,
    );
    expect(result.playerStatuses.armor).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "armor", amount: 5 });
  });

  it("deals Physical and Bleed damage on Dodge", () => {
    const state = incomingPhysical({
      gearEffects: { ...defaultGearEffects, physicalOnDodge: 5, bleedOnDodge: 4 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(91);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
  });

  it("arms Opening additional Physical on the next attack", () => {
    const afterDodge = applyEnemyAbility(
      incomingPhysical({
        gearEffects: { ...defaultGearEffects, nextAttackPhysicalOnDodge: 4 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextHitPhysicalBonus).toBe(4);

    const result = dealDamage(afterDodge, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(91);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
  });

  it("arms Off-Balance as a guaranteed Crit on the next attack", () => {
    const afterDodge = applyEnemyAbility(
      incomingPhysical({
        gearEffects: { ...defaultGearEffects, nextAttackCritOnDodge: 1 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextHitCrit).toBe(true);

    const card = makeTestCard({
      id: "strike",
      effects: [makeEffect("physical", 6)],
    });
    const armed = {
      ...afterDodge,
      hand: [card],
      mana: 2,
    };
    const played = playBattleCardResolved(armed, card.id, 0);
    expect(played.state.enemyHealth).toBe(88);
    expect(played.state.flags.nextHitCrit).toBe(false);
  });

  it("does not consume Opening when the enemy Dodges", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { ...patchBattleState().flags, nextHitPhysicalBonus: 4 },
      rng: () => 0.01,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(100);
    expect(result.flags.nextHitPhysicalBonus).toBe(4);
  });

  it("adds Opening's Physical damage to a non-Physical attack", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { ...patchBattleState().flags, nextHitPhysicalBonus: 4 },
      rng: () => 0.99,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 5)] }));
    expect(result.enemyHealth).toBe(91);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
  });
});

describe("Dodge talent rewrites", () => {
  it("Riposte and Footwork copy the dodged amount without extra pacing or spending a prepared critical strike", () => {
    const state = incomingPhysical({
      appliesFightPacing: true,
      turn: 11,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      playerStatuses: defaultPlayerStatusValues({ forge: 50 }),
      flags: { ...patchBattleState().flags, nextHitCrit: true },
      talentEffects: {
        ...defaultTalentEffects,
        physicalOnDodgeEqualToAttack: true,
        blockOnDodgeEqualToAttack: true,
        flatPhysicalDamage: 50,
      },
    });
    const effect = { kind: "damage", damageType: "physical", amount: 8 } as const;
    const { incomingDamage: incoming } = prepareEnemyDamage(state, scaleEnemyAbilityDamage(state, effect));
    const result = applyEnemyAbility(state, makeEnemyTestCard({ effects: [effect] }), makeCombatTexts());
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(1000 - incoming);
    expect(result.playerStatuses.block).toBe(incoming);
    expect(result.flags.nextHitCrit).toBe(true);
  });

  it("Footwork grants Block equal to the dodged attack", () => {
    const result = applyEnemyAbility(
      incomingPhysical({
        playerStatuses: defaultPlayerStatusValues({ block: 0 }),
        talentEffects: { ...defaultTalentEffects, blockOnDodgeEqualToAttack: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(result.playerStatuses.block).toBe(8);
  });

  it("Last Gasp adds Dodge chance while below half Health", () => {
    const wounded = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      rng: () => 0.15,
      talentEffects: { ...defaultTalentEffects, dodgeChanceBelowHalfHealth: 20 },
    });
    expect(
      applyEnemyAbility(
        wounded,
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
        makeCombatTexts(),
      ).playerHealth,
    ).toBe(10);

    const healthy = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      rng: () => 0.15,
      talentEffects: { ...defaultTalentEffects, dodgeChanceBelowHalfHealth: 20 },
    });
    expect(
      applyEnemyAbility(
        healthy,
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
        makeCombatTexts(),
      ).playerHealth,
    ).toBeLessThan(30);
  });

  it("Pack Weave makes the Companion attack when you Dodge", () => {
    const result = applyEnemyAbility(
      incomingPhysical({
        activeCompanion: companionLibrary.wolf,
        talentEffects: { ...defaultTalentEffects, companionAttacksOnDodge: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(result.enemyHealth).toBeLessThan(100);
  });

  it("Torpor stops poisoned enemies from Dodging", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ poison: 4 }),
      rng: () => 0.01,
      talentEffects: { ...defaultTalentEffects, poisonPreventsEnemyDodge: true },
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("Parting Cut makes the next Physical card deal matching Bleed", () => {
    const afterDodge = applyEnemyAbility(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, partingCutOnDodge: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextPhysicalDealsBleed).toBe(true);

    const result = dealDamage(afterDodge, makeTestCard({ effects: [makeEffect("physical", 6)] }));
    expect(result.enemyHealth).toBe(88);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
    expect(result.flags.nextPhysicalDealsBleed).toBe(false);
  });

  it("Icebound strips enemy Block on Freeze and prevents Dodge while Frozen", () => {
    const freezeState = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 0, block: 7, forge: 0 },
      enemyStatuses: defaultEnemyStatusValues({ freeze: 15 }),
      talentEffects: { ...defaultTalentEffects, freezeStripBlock: true, freezePreventsEnemyDodge: true },
    });
    const frozen = applyDamageStatuses(freezeState, { kind: "damage", damageType: "freeze", amount: 10 }, 10, []);
    expect(frozen.enemyMitigation.block).toBe(0);
    expect(frozen.enemyCC.freezeSkipTurns).toBeGreaterThan(0);

    const result = dealDamage({ ...frozen, rng: () => 0.01 }, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBeLessThan(frozen.enemyHealth);
  });

  it("Lucky Foot grants Gold when you Dodge", () => {
    const result = applyEnemyAbility(
      incomingPhysical({
        gold: 10,
        talentEffects: { ...defaultTalentEffects, goldOnDodge: 1 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(result.gold).toBe(11);
  });

  it("Arrow Dance makes the next Archery card free", () => {
    const afterDodge = applyEnemyAbility(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, nextArcheryCardFreeOnDodge: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextArcheryCardFree).toBe(true);

    const card = makeTestCard({
      id: "quick-shot",
      cost: 2,
      tags: ["archery"],
      effects: [makeEffect("physical", 5)],
    });
    const played = playBattleCardResolved({ ...afterDodge, hand: [card], mana: 2 }, card.id, 0);
    expect(played.state.mana).toBe(2);
    expect(played.state.flags.nextArcheryCardFree).toBe(false);
  });

  it("Windstep makes the next Nature card free", () => {
    const afterDodge = applyEnemyAbility(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, nextNatureCardFreeOnDodge: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextNatureCardFree).toBe(true);

    const card = makeTestCard({
      id: "thorns",
      cost: 2,
      effects: [makeEffect("nature", 5)],
    });
    const played = playBattleCardResolved({ ...afterDodge, hand: [card], mana: 2 }, card.id, 0);
    expect(played.state.mana).toBe(2);
    expect(played.state.flags.nextNatureCardFree).toBe(false);
  });
});

describe("enemy Dodge", () => {
  it("Dodges a player damage packet before enemy Block and Armor", () => {
    const texts = makeCombatTexts();
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { armor: 4, block: 10, forge: 0 },
      rng: () => 0.01,
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 8)] });
    const result = dealDamage(state, card, texts);
    expect(result.enemyHealth).toBe(30);
    expect(result.enemyMitigation.block).toBe(10);
    expect(result.enemyMitigation.armor).toBe(4);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "notice",
      stat: "dodge",
      text: "Dodge",
    });
  });

  it("skips lifesteal and status riders when the enemy Dodges", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 30,
      enemyStatuses: { bleed: 0 },
      rng: () => 0.01,
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerHealth).toBe(20);
    expect(result.enemyStatuses.bleed).toBe(0);
  });

  it("does not Dodge DoT ticks", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: { burn: 8 },
      rng: () => 0.01,
    });
    const next = tickEnemyStatuses(state, makeCombatTexts());
    expect(next.enemyHealth).toBe(22);
  });

  it("does not Dodge follow-up typed hits", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.01,
    });
    const result = dealPlayerTypedHit(state, "physical", 6, makeCombatTexts());
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("does not trigger player on-Dodge gear when the enemy Dodges", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ block: 0 }),
      deck: [makeTestCard({ id: "counter-strike", effects: [makeEffect("physical", 20)] })],
      rng: () => 0.01,
      gearEffects: { ...defaultGearEffects, dodgeDrawAndPlay: 1, blockOnDodge: 5 },
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 8)] }));
    expect(result.playerStatuses.block).toBe(0);
    expect(result.deck).toHaveLength(1);
    expect(result.enemyHealth).toBe(30);
  });

  it("preserves next-hit buffs (crit, leech, poison conversion, flat bonus, parting cut) when the enemy Dodges", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.01,
      flags: {
        ...patchBattleState().flags,
        nextHitCrit: true,
        nextHitLeech: true,
        nextHitPoison: true,
        nextHitPhysicalBonus: 5,
        nextPhysicalDealsBleed: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 8)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.flags.nextHitLeech).toBe(true);
    expect(result.flags.nextHitPoison).toBe(true);
    expect(result.flags.nextHitPhysicalBonus).toBe(5);
    expect(result.flags.nextPhysicalDealsBleed).toBe(true);
  });

  it("consumes physical next-hit buffs when a physical attack connects", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      rng: () => 0.99,
      flags: {
        ...patchBattleState().flags,
        nextHitCrit: true,
        nextHitLeech: true,
        nextHitPhysicalBonus: 5,
        nextPhysicalDealsBleed: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.nextHitCrit).toBe(false);
    expect(result.flags.nextHitLeech).toBe(false);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
    expect(result.flags.nextPhysicalDealsBleed).toBe(false);
  });

  it("consumes nextHitPoison when converting an attack to poison", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      rng: () => 0.99,
      flags: {
        ...patchBattleState().flags,
        nextHitPoison: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.nextHitPoison).toBe(false);
    expect(result.enemyStatuses.poison).toBeGreaterThan(0);
  });

  it("heals via Leech and consumes nextHitLeech on the next damaging card", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      playerHealth: 20,
      playerMaxHealth: 30,
      rng: () => 0.99,
      flags: {
        ...patchBattleState().flags,
        nextHitLeech: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 6)] });
    const result = dealDamage(state, card);
    expect(result.flags.nextHitLeech).toBe(false);
    expect(result.playerHealth).toBeGreaterThan(20);
  });

  it("still deals damage when the Dodge roll misses", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.99,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(25);
  });
});

describe("player Dodge chance from gear", () => {
  it("adds gear Dodge chance to the 5% baseline", () => {
    const hits = patchBattleState({
      playerHealth: 30,
      rng: () => 0.07,
    });
    expect(
      applyEnemyAbility(
        hits,
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
        makeCombatTexts(),
      ).playerHealth,
    ).toBeLessThan(30);

    const dodges = patchBattleState({
      playerHealth: 30,
      rng: () => 0.07,
      gearEffects: { ...defaultGearEffects, dodgeChance: 3 },
    });
    expect(
      applyEnemyAbility(
        dodges,
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
        makeCombatTexts(),
      ).playerHealth,
    ).toBe(30);
  });
});

describe("dodged player attacks preserve hit flags", () => {
  const burnCard = () => makeTestCard({ effects: [makeEffect("burn", 10)] });
  const dodgeFirstRng = () => {
    let calls = 0;
    return () => {
      calls += 1;
      return calls === 1 ? 0.01 : 0.99;
    };
  };

  it("a dodged burn card preserves the once-per-combat burn double and hit flags", () => {
    const state = patchBattleState({
      rng: dodgeFirstRng(),
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1.5 },
      flags: { nextHitLeech: true, nextHitPhysicalBonus: 3 },
    });
    const result = dealDamage(state, burnCard(), makeCombatTexts());
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(result.flags.nextHitLeech).toBe(true);
    expect(result.flags.nextHitPhysicalBonus).toBe(3);
  });

  it("the same burn card consumes the burn double when it is not dodged", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1.5 },
    });
    const result = dealDamage(state, burnCard(), makeCombatTexts());
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
  });
});
