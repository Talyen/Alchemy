import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { processEncounterTraitActionDamage } from "@/lib/battle/encounter-trait-events";
import { applyEnemyLeechHealing, processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { resolveTypedEnemyHit } from "@/lib/battle/typed-hit-resolution";
import { describe, expect, it } from "vitest";
import { makeTestBattleState, patchBattleState } from "../../fixtures/battle";
import { makeTestCard as makeEnemyTestCard, makeTestCard } from "../../fixtures/cards";
import * as talentBattle from "../../fixtures/talent-battle";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("enemy attack damage", () => {
  it.each(["bleed", "poison"] as const)("halves incoming %s damage while Block is present", (damageType) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 2 },
      talentEffects: {
        ...(damageType === "bleed" ? { blockHalvesBleedDamage: true } : { blockHalvesPoisonDamage: true }),
      },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 4 }, []);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerHealth).toBe(29);
  });

  it.each(["aetherward", "block", "armor", "resistance", "dodge", "overkill", "deaths-door", "zero"] as const)(
    "separates contact, resolved damage, and Health loss for %s",
    (prevention) => {
      const state = patchBattleState({
        rng: () => (prevention === "dodge" ? 0 : 0.99),
        deathsDoorUsed: prevention !== "deaths-door",
        playerHealth: 2,
        playerMaxHealth: 30,
        mana: prevention === "aetherward" ? 4 : 3,
        playerStatuses: { block: prevention === "block" ? 4 : 0, armor: prevention === "armor" ? 4 : 0 },
        gearEffects: {
          damageReductionPerMana: prevention === "aetherward" ? 1 : 0,
          resistPhysical: prevention === "resistance" ? 100 : 0,
        },
      });
      const result = resolveEnemyAttackHit(
        state,
        { kind: "damage", damageType: "physical", amount: prevention === "zero" ? 0 : 4 },
        [],
        {
          canDodge: true,
        },
      );
      expect(result).toMatchObject({
        attemptedDamage: prevention === "zero" ? 0 : 4,
        resolvedDamage: prevention === "overkill" || prevention === "deaths-door" ? 4 : 0,
        healthDamage: prevention === "overkill" ? 2 : prevention === "deaths-door" ? 1 : 0,
        landed: prevention !== "dodge" && prevention !== "zero",
        dodged: prevention === "dodge",
        killed: prevention === "overkill",
      });
    },
  );

  it("captures a player hit's Health loss before threshold healing", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
    });
    const hit = resolveTypedEnemyHit(state, { kind: "damage", damageType: "nature", amount: 4 }, 4, []);
    expect(hit.facts.healthDamage).toBe(4);
    expect(hit.facts.resolvedDamage).toBe(4);
    expect(hit.facts.killed).toBe(false);
    expect(hit.state.enemyHealth).toBeGreaterThan(2);
  });

  it.each([
    ["burn", "armorMitigatesBurn"],
    ["bleed", "armorMitigatesBleed"],
  ] as const)("Armor protects against direct %s hits with the matching talent", (damageType, talent) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { armor: 3, block: 2 },
      talentEffects: { [talent]: true },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 7 }, []);
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses[damageType]).toBe(2);
    expect(result.playerStatuses.armor).toBe(2);
    expect(result.playerStatuses.block).toBe(0);
    expect(state.playerHealth).toBe(30);
  });

  it("Fireward also protects against Cauterize's self-inflicted Burn", () => {
    const state = patchBattleState({ playerStatuses: { armor: 3 }, talentEffects: { armorMitigatesBurn: true } });
    const result = dealSelfDamage(state, 1, "burn", []);
    expect(result.healthLost).toBe(0);
    expect(result.state.playerHealth).toBe(state.playerHealth);
  });

  it.each(["sunder", "caustic", "banshee"])("Reactive Guard rewards Armor broken by %s", (source) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { armor: source === "caustic" ? 2 : 1 },
      talentEffects: { armorBreakBlock: 5 },
      currentEnemy: { traits: [{ id: source, title: source, description: "" }] },
      rng: () => 0.99,
    });
    const result =
      source === "caustic"
        ? processEncounterTraitActionDamage(state, [])
        : applyEnemyAbility(
            state,
            makeTestCard({
              effects:
                source === "sunder"
                  ? [{ kind: "remove-enemy-armor", amount: 1 }]
                  : [{ kind: "damage", damageType: "physical", amount: 1 }],
            }),
            [],
          );
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("resolves an undodgeable incoming packet and enemy leech", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 0 },
      enemyHealth: 10,
      enemyMaxHealth: 20,
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(25);
    expect(applyEnemyLeechHealing(damaged, 5, []).enemyHealth).toBeGreaterThan(10);
  });

  it("block absorbs before health is lost", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 5, armor: 0 },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(30);
    expect(damaged.playerStatuses.block).toBe(0);
  });

  it("armor absorbs then decays after damaging the player", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 3 },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(28);
    expect(damaged.playerStatuses.armor).toBe(2);
  });

  it("fires health-threshold block when damage crosses the threshold", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...base.talentEffects, healthThresholdBlock: { threshold: 50, amount: 4 } },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 20 }, []);
    expect(damaged.playerHealth).toBe(10);
    expect(damaged.playerStatuses.block).toBe(4);
  });
});

describe("Talent enemy attack damage", () => {
  const { talents, battle } = talentBattle;

  it("a lethal shield counter prevents Earth Elemental's Block-break damage", () => {
    const state = battle({
      enemyHealth: 1,
      playerStatuses: { block: 2 },
      talentEffects: talents("block", "block-reduce-burn"),
      currentEnemy: { traits: [{ id: "earth-elemental", title: "Earth Elemental", description: "" }] },
    });
    const after = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      [],
    );
    expect(after.enemyHealth).toBe(0);
    expect(after.playerHealth).toBe(state.playerHealth);
  });

  it("Smoke Screen damages a Burning enemy on each Dodge", () => {
    const state = battle({
      talentEffects: talents("burn", "burn-dmg-5"),
      enemyStatuses: { burn: 1 },
      rng: () => 0.01,
    });
    const first = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      [],
    );
    expect(first.enemyHealth).toBe(98);
    expect(
      applyEnemyAbility(
        first,
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
        [],
      ).enemyHealth,
    ).toBe(96);
    expect(
      applyEnemyAbility(
        { ...state, enemyStatuses: { ...state.enemyStatuses, burn: 0 } },
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
        [],
      ).enemyHealth,
    ).toBe(100);
  });

  it("Sun-Struck Shield reacts to attacks depleting Block but not reflected damage", () => {
    const state = battle({
      talentEffects: talents("block", "block-reduce-burn"),
      playerStatuses: { block: 4 },
    });
    expect(
      applyEnemyAbility(
        state,
        makeEnemyTestCard({
          effects: [
            { kind: "damage", damageType: "physical", amount: 2 },
            { kind: "damage", damageType: "physical", amount: 2 },
          ],
        }),
        [],
      ).enemyHealth,
    ).toBe(99);
    expect(
      processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 2 }, [], {
        skipTraitReactions: true,
      }).enemyHealth,
    ).toBe(100);
    expect(
      applyEnemyAbility(
        { ...state, playerStatuses: { ...state.playerStatuses, block: 0 } },
        makeEnemyTestCard({
          effects: [
            { kind: "damage", damageType: "physical", amount: 2 },
            { kind: "damage", damageType: "physical", amount: 2 },
          ],
        }),
        [],
      ).enemyHealth,
    ).toBe(100);
  });

  it("a lethal Sun-Struck Shield counter stops the remaining enemy hits", () => {
    const state = battle({
      enemyHealth: 1,
      playerStatuses: { block: 2 },
      talentEffects: talents("block", "block-reduce-burn"),
    });
    const after = applyEnemyAbility(
      state,
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 2 },
          { kind: "damage", damageType: "physical", amount: 100 },
        ],
      }),
      [],
    );
    expect(after.enemyHealth).toBe(0);
    expect(after.playerHealth).toBe(state.playerHealth);
    expect(after.deathsDoorUsed).toBe(false);
  });

  it("Sun-Struck Shield can grant Holy Block without creating another enemy attack", () => {
    const state = battle({
      playerHealth: 40,
      playerMaxHealth: 40,
      playerStatuses: { block: 2 },
      talentEffects: { ...talents("block", "block-reduce-burn"), holyBlockPercentFromDamage: 100 },
    });
    const after = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      [],
    );
    expect(after.playerStatuses.block).toBe(1);
    expect(after.enemyHealth).toBe(99);
  });
});

describe("Unique Gear enemy attack damage", () => {
  const { battle, attack, play, dodge } = uniqueGearBattle;

  it("Viper's Courtesy survives automatic plays and benefits one successful Physical card hit", () => {
    const dodged = dodge(battle({ gearEffects: { dodgeReadiesVenomousHit: 1 } }));
    expect(dodged.uniqueGear.viperReady).toBe(true);
    const automatic = applyCardEffects(dodged, attack("physical"), []);
    expect(automatic.uniqueGear.viperReady).toBe(true);
    const result = play({ ...automatic, rng: () => 0.99 }, attack("physical"));
    expect(result.enemyStatuses.poison).toBe(5);
    expect(result.enemyStatuses.bleed).toBe(5);
    expect(result.uniqueGear.viperReady).toBe(false);
  });

  it("Wrenflight grants a non-additive Dodge bonus and draws an Archery card on Dodge", () => {
    const arrow = attack("physical", { tags: ["archery"] });
    const state = play(battle({ gearEffects: { archeryDodgeAndDraw: 1 }, deck: [arrow] }), arrow);
    expect(state.uniqueGear.wrenflightActive).toBe(true);
    let calls = 0;
    const result = applyEnemyAbility(
      {
        ...state,
        rng: () => (calls++ === 0 ? 0.1 : 0.99),
      },
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 20 }] }),
      [],
    );
    expect(result.playerHealth).toBe(100);
    expect(result.hand).toHaveLength(1);
    expect(advanceToPlayerTurn(result).uniqueGear.wrenflightActive).toBe(false);
  });

  it("Laughing Guard spends old Block before Dodge bonuses and preserves the remainder between turns", () => {
    const result = dodge(
      battle({ playerStatuses: { block: 20 }, gearEffects: { dodgeSpendsPreservedBlock: 1, blockOnDodge: 5 } }),
    );
    expect(result.playerStatuses.block).toBe(10);
    expect(result.enemyHealth).toBe(990);
    expect(advanceToPlayerTurn(result).playerStatuses.block).toBe(10);
  });

  it("Knight's Answer requires absorbed damage, grants one free Physical card, and does not protect Armor", () => {
    const state = battle({ playerStatuses: { block: 2, armor: 1 }, gearEffects: { blockReadiesFreePhysical: 1 } });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 10 }, []);
    expect(result.playerHealth).toBe(93);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.uniqueGear.knightsAnswerReady).toBe(true);
    const played = play({ ...result, mana: 0 }, attack("physical"));
    expect(played.uniqueGear.knightsAnswerReady).toBe(false);
    expect(computeEffectiveCost(played, attack("physical")).effectiveCost).toBe(2);
    const unblocked = processEnemyDamageEffect(
      { ...state, playerStatuses: { ...state.playerStatuses, block: 0 } },
      { kind: "damage", damageType: "physical", amount: 10 },
      [],
    );
    expect(unblocked.uniqueGear.knightsAnswerReady).toBe(false);
  });

  it("Wildheart's Favor makes the next Nature card free and all of its hits critical", () => {
    const card = attack("nature", {
      effects: [
        { kind: "damage", damageType: "nature", amount: 10 },
        { kind: "damage", damageType: "nature", amount: 5 },
      ],
    });
    const state = dodge(battle({ gearEffects: { dodgeReadiesNatureCrit: 1 }, mana: 0 }));
    const result = play({ ...state, rng: () => 0.99 }, card);
    expect(result.enemyHealth).toBe(970);
    expect(result.mana).toBe(0);
    expect(result.uniqueGear.wildheartReady).toBe(false);
  });
});
