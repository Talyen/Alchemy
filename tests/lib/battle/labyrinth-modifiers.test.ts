import { describe, expect, it } from "vitest";
import {
  createBattleState,
  endPlayerTurn,
  playBattleCardResolved,
  processCompanionTurnStart,
  tickEnemyStatuses,
  tickPlayerStatuses,
} from "@/lib/battle";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { addEnemyStatus } from "@/lib/battle/types";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/damage-rider-leech";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { applyWishEffect, chooseWishCard } from "@/lib/battle/wish";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tryDodgeEnemyAttackPacket, tryDodgePlayerAttackPacket } from "@/lib/battle/dodge";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";
import { ENCOUNTER_TRAITS, type EncounterCombatTraitId } from "@/lib/content-systems/encounter-traits";
import { cardById, type BattleCard, type DamageType } from "@/lib/game-data";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function state(overrides: BattleStatePatch = {}) {
  return patchBattleState({
    contentSystemType: "labyrinth",
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyAttackEffects: [],
    currentEnemy: { traits: [] },
    rng: () => 0.99,
    ...overrides,
  });
}

function attack(type: DamageType = "physical", amount = 4, overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "attack",
    uid: 1,
    title: "Attack",
    art: "",
    descriptionLines: [],
    cost: 0,
    effects: [{ kind: "damage", damageType: type, amount }],
    ...overrides,
  };
}

function enemy(...ids: EncounterCombatTraitId[]) {
  return { traits: ids.map((id) => ENCOUNTER_TRAITS[id].enemyTrait) };
}

function play(current: ReturnType<typeof state>, card: BattleCard) {
  return playBattleCardResolved({ ...current, hand: [card] }, card.id, 0).state;
}

describe("Labyrinth player benefits", () => {
  it.each([
    ["heavy-hand", "physical"],
    ["consecrated", "holy"],
    ["wildheart", "nature"],
  ] as const)("%s doubles one attack, survives saving, and resets next turn", (id, type) => {
    const card = attack(type);
    const first = play(state({ encounterBenefits: [id] }), card);
    expect(first.enemyHealth).toBe(92);
    const saved = normalizePersistedBattleState(JSON.parse(JSON.stringify(first)));
    const second = play({ ...saved, rng: () => 0.99 }, card);
    expect(second.enemyHealth).toBe(88);
    expect(play(endPlayerTurn(second).state, card).enemyHealth).toBe(80);
  });

  it("Unbroken preserves player Block through ordinary and extra turns", () => {
    const ordinary = endPlayerTurn(state({ encounterBenefits: ["unbroken"], playerStatuses: { block: 9 } })).state;
    const haste = endPlayerTurn(
      state({ encounterBenefits: ["unbroken"], playerStatuses: { block: 9, haste: 1 } }),
    ).state;
    expect(ordinary.playerStatuses.block).toBe(9);
    expect(haste.playerStatuses.block).toBe(9);
    expect(endPlayerTurn(state({ playerStatuses: { block: 9 } })).state.playerStatuses.block).toBe(5);
  });

  it("White Heat preserves Forge without creating recoverable Forge debt", () => {
    const next = play(
      state({ encounterBenefits: ["white-heat"], playerStatuses: { forge: 3 }, gearEffects: { recoverSpentForge: 1 } }),
      attack(),
    );
    expect(next.playerStatuses.forge).toBe(3);
    expect(next.uniqueGear.spentForge).toBe(0);
    expect(next.enemyHealth).toBe(93);
  });

  it("Ironclad prevents Armor decay from attacks and harmful statuses", () => {
    const current = state({
      encounterBenefits: ["ironclad"],
      playerStatuses: { armor: 2, poison: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    expect(processEnemyAttack(current, []).playerStatuses.armor).toBe(2);
    expect(tickPlayerStatuses(current, []).playerStatuses.armor).toBe(2);
  });

  it("Eternal Flame preserves Burn; Venomous slows Poison with minimum decay", () => {
    const current = state({ encounterBenefits: ["eternal-flame", "venomous"], enemyStatuses: { burn: 8, poison: 10 } });
    const next = tickEnemyStatuses(current, []);
    expect(next.enemyHealth).toBe(82);
    expect(next.enemyStatuses.burn).toBe(8);
    expect(next.enemyStatuses.poison).toBe(9);
    expect(
      tickEnemyStatuses(state({ encounterBenefits: ["venomous"], enemyStatuses: { poison: 1 } }), []).enemyStatuses
        .poison,
    ).toBe(0);
    expect(detonateEnemyStatuses(current, ["burn"], []).enemyStatuses.burn).toBe(0);
  });

  it("remaining Poison damage uses Venomous decay", () => {
    const next = detonateEnemyStatuses(
      state({ encounterBenefits: ["venomous"], enemyStatuses: { poison: 10 } }),
      ["poison"],
      [],
      "remaining-ticks",
    );
    expect(next.enemyHealth).toBe(45);
    expect(next.enemyStatuses.poison).toBe(0);
  });

  it.each([
    ["thunderstruck", "stun"],
    ["bitter-cold", "freeze"],
    ["deep-wounds", "bleed"],
  ] as const)("%s doubles buildup without doubling immediate damage", (id, type) => {
    const next = play(state({ encounterBenefits: [id] }), attack(type));
    expect(next.enemyHealth).toBe(96);
    expect(next.enemyStatuses[type]).toBe(8);
  });

  it("Stun and Freeze benefits still respect enemy immunity and resistance", () => {
    const current = state({ encounterBenefits: ["thunderstruck", "bitter-cold"], enemyCC: { cooldown: 1 } });
    expect(addEnemyStatus(current, "stun", 4).enemyStatuses.stun).toBe(0);
    expect(addEnemyStatus(current, "freeze", 4).enemyStatuses.freeze).toBe(0);
    expect(
      addEnemyStatus(state({ encounterBenefits: ["bitter-cold"], currentEnemy: enemy("winterborn") }), "freeze", 4)
        .enemyStatuses.freeze,
    ).toBe(4);
  });

  it("Blood Feast doubles Leech and caps healing at maximum Health", () => {
    const current = state({ encounterBenefits: ["blood-feast"], playerHealth: 10, playerMaxHealth: 30 });
    expect(applyLifestealAndPlayerHitTriggers(current, 8, []).playerHealth).toBe(18);
    expect(applyLifestealAndPlayerHitTriggers({ ...current, playerHealth: 29 }, 8, []).playerHealth).toBe(30);
  });

  it("Wishful expands only the first Wish, including multiple queued Wishes", () => {
    const card = attack();
    let next = applyWishEffect(state({ encounterBenefits: ["wishful"] }), card, 2, []);
    expect(next.wishOptions).toHaveLength(4);
    expect(next.wishQueue[0]).toHaveLength(3);
    next = chooseWishCard(next, next.wishOptions![0]!.id);
    next = chooseWishCard(next, next.wishOptions![0]!.id);
    next = endPlayerTurn(next).state;
    expect(applyWishEffect(next, card, 1, []).wishOptions).toHaveLength(4);
  });

  it("Fleeting applies to Consume cards; Quickdraw is spent once per turn", () => {
    const arrow = attack("physical", 1, { cost: 2, tags: ["archery"] });
    const current = state({ encounterBenefits: ["fleeting", "quickdraw"] });
    expect(computeEffectiveCost(current, { ...arrow, consume: true }).effectiveCost).toBe(0);
    const next = play(current, arrow);
    expect(computeEffectiveCost(next, arrow).effectiveCost).toBe(2);
    expect(computeEffectiveCost(endPlayerTurn(next).state, arrow).effectiveCost).toBe(1);
    expect(computeEffectiveCost(current, { ...arrow, consume: true, cost: 0 }).effectiveCost).toBe(0);
  });

  it("starting benefits initialize once and clear for non-Labyrinth battles", () => {
    const options = {
      runDeck: [],
      currentEnemy: state().currentEnemy,
      encounterBenefits: ["phoenix-nest", "wellspring", "bramblecoat"] as const,
      rng: () => 0.99,
      appliesFightPacing: false,
    };
    const next = createBattleState({
      ...options,
      encounterBenefits: [...options.encounterBenefits],
      contentSystemType: "labyrinth",
    });
    expect(next.playerStatuses.phoenixFeather).toBe(1);
    expect(next.playerStatuses.thorns).toBe(3);
    expect(next.mana).toBe(next.maxMana + 1);
    expect(
      endPlayerTurn({ ...next, playerStatuses: { ...next.playerStatuses, thorns: 0 } }).state.playerStatuses.thorns,
    ).toBe(3);
    const ordinary = createBattleState({
      ...options,
      encounterBenefits: [...options.encounterBenefits],
      contentSystemType: "campaign",
    });
    expect(ordinary.encounterBenefits).toEqual([]);
    expect(ordinary.mana).toBe(ordinary.maxMana);
  });

  it("Eager Pack acts twice on summoning without consuming first-attack bonuses", () => {
    const companion = cardById["wolf-companion"]!;
    const ordinary = play(state({ mana: 10 }), companion);
    const eager = play(state({ mana: 10, encounterBenefits: ["eager-pack", "heavy-hand"] }), companion);
    expect(ordinary.enemyHealth).toBe(100);
    const twice = processCompanionTurnStart(processCompanionTurnStart(ordinary, []), []);
    expect(eager.enemyHealth).toBe(twice.enemyHealth);
    expect(eager.flags.encounterPhysicalUsed).toBe(false);
    expect(eager.activeCompanion?.id).toBe("wolf");
  });

  it("Elusive helps player Dodge without changing enemy Dodge", () => {
    const current = state({ encounterBenefits: ["elusive"], rng: () => 0.1 });
    expect(tryDodgeEnemyAttackPacket(current, [], true)).not.toBeNull();
    expect(tryDodgePlayerAttackPacket(current, [])).toBeNull();
    expect(
      tryDodgeEnemyAttackPacket(
        { ...current, rng: () => 0.8, gearEffects: { ...current.gearEffects, dodgeChance: 100 } },
        [],
        true,
      ),
    ).toBeNull();
  });

  it("Restorative heals before the enemy attack, once per turn", () => {
    const next = endPlayerTurn(
      state({
        encounterBenefits: ["restorative"],
        playerHealth: 10,
        enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 5 }],
      }),
    ).state;
    expect(next.playerHealth).toBe(7);
    const dead = endPlayerTurn(
      state({ encounterBenefits: ["restorative"], playerHealth: 0, deathsDoorUsed: true }),
    ).state;
    expect(dead.playerHealth).toBe(0);
  });
});

describe("Labyrinth enemy modifiers", () => {
  it("Unbreakable and Whitehot preserve enemy defenses and damage only", () => {
    const current = state({
      currentEnemy: enemy("unbreakable", "whitehot"),
      enemyMitigation: { armor: 2, forge: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const hit = play(current, attack());
    expect(hit.enemyMitigation.armor).toBe(2);
    const next = processEnemyAttack(hit, []);
    expect(next.enemyMitigation.forge).toBe(3);
    expect(next.playerHealth).toBe(current.playerHealth - 7);
  });

  it("Entrenched preserves enemy Block", () => {
    expect(
      endPlayerTurn(state({ currentEnemy: enemy("entrenched"), enemyMitigation: { block: 9 } })).state.enemyMitigation
        .block,
    ).toBe(9);
  });

  it.each([
    ["toxic", "poison"],
    ["bloodletter", "bleed"],
  ] as const)("%s applies its damage type", (id, type) => {
    const next = endPlayerTurn(state({ currentEnemy: enemy(id) })).state;
    expect(next.playerHealth).toBe(29);
    expect(next.playerStatuses[type]).toBe(1);
  });

  it("Thornhide retaliates once, regrows, and respects a Dodged attack", () => {
    const current = state({ currentEnemy: enemy("thornhide"), enemyStatuses: { thorns: 2 } });
    const first = play(current, attack());
    expect(first.playerHealth).toBe(28);
    expect(first.enemyStatuses.thorns).toBe(0);
    expect(play(first, attack()).playerHealth).toBe(28);
    expect(endPlayerTurn(first).state.enemyStatuses.thorns).toBe(2);
    expect(play({ ...current, rng: () => 0 }, attack()).playerHealth).toBe(30);
  });

  it("Ravenous leeches from actual damage and its following Bleed tick", () => {
    const current = state({
      currentEnemy: enemy("ravenous"),
      enemyHealth: 50,
      enemyAttackEffects: [{ kind: "damage", damageType: "bleed", amount: 4 }],
    });
    const next = processEnemyAttack(current, []);
    expect(next.enemyHealth).toBe(52);
    expect(tickPlayerStatuses(next, []).enemyHealth).toBe(54);
    const blocked = processEnemyAttack({ ...current, playerStatuses: { ...current.playerStatuses, block: 10 } }, []);
    expect(blocked.enemyHealth).toBe(50);
  });

  it("Second Wind triggers once, survives saves, and cannot revive enemies", () => {
    const current = state({ currentEnemy: enemy("second-wind"), enemyHealth: 60 });
    const next = play(current, attack("holy", 15));
    expect(next.enemyHealth).toBe(65);
    const restored = normalizePersistedBattleState(JSON.parse(JSON.stringify(next)));
    expect(play({ ...restored, rng: () => 0.99 }, attack("holy", 20)).enemyHealth).toBe(45);
    expect(play(current, attack("holy", 70)).enemyHealth).toBe(0);
  });

  it("Executioner strengthens Physical attacks only below half Health", () => {
    const current = state({
      currentEnemy: enemy("executioner"),
      enemyHealth: 49,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    expect(processEnemyAttack(current, []).playerHealth).toBe(22);
    expect(processEnemyAttack({ ...current, enemyHealth: 50 }, []).playerHealth).toBe(26);
  });

  it("Thick Hide reuses the existing 50% Physical resistance", () => {
    expect(play(state({ currentEnemy: enemy("thick-hide") }), attack("physical", 8)).enemyHealth).toBe(96);
  });

  it("legacy snapshots default to no player benefits", () => {
    const saved = JSON.parse(JSON.stringify(state()));
    delete saved.encounterBenefits;
    delete saved.flags.encounterPhysicalUsed;
    const restored = normalizePersistedBattleState(saved);
    expect(restored.encounterBenefits).toEqual([]);
    expect(restored.flags.encounterPhysicalUsed).toBe(false);
  });
});
