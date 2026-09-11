import { describe, expect, it } from "vitest";
import {
  addEnemyStatus,
  endPlayerTurn,
  playBattleCardResolved,
  regrowEnemyThorns,
  tickEnemyStatuses,
  tickPlayerStatuses,
} from "@/lib/battle";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { companionLibrary, enemyById, type BattleCard, type BestiaryEntry } from "@/lib/game-data";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { damageEnemyHealth } from "@/lib/battle/types";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { makeTestBattleState, patchBattleState } from "../../fixtures/battle";
import { defaultCcState } from "../../fixtures/default-battle-state";

function enemyWith(...ids: Array<keyof typeof ENCOUNTER_TRAITS>): BestiaryEntry {
  return {
    id: "trait-test-enemy",
    title: "Trait Test Enemy",
    subtitle: "",
    descriptionLines: [],
    art: "",
    enemyType: "boss",
    traits: ids.map((id) => ENCOUNTER_TRAITS[id].enemyTrait),
    abilityIds: ["slash", "bash", "block"],
  };
}

function card(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card",
    uid: 1,
    title: "Test Card",
    descriptionLines: [],
    art: "",
    cost: 0,
    effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    ...overrides,
  };
}

describe("encounter trait enemy actions", () => {
  it("scales buffs and damage with room depth only when the enemy attacks", () => {
    const currentEnemy = {
      ...enemyWith("tempered", "reinforced", "zealot"),
      abilityIds: ["slash", "bash", "frostbolt"],
    };
    const state = makeTestBattleState({
      currentEnemy,
      roomScalingMultiplier: 2,
      playerHealth: 30,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBe(2);
    expect(result.state.enemyMitigation.block).toBe(4);
    expect(result.state.playerHealth).toBe(20);
  });

  it("keeps per-turn stat gains on a skipped enemy action but skips action riders", () => {
    const currentEnemy = enemyWith("tempered", "zealot");
    const state = makeTestBattleState({
      currentEnemy,
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
    });
    const result = endPlayerTurn(state);

    expect(result.state.enemyMitigation.forge).toBe(1);
    expect(result.state.playerHealth).toBe(state.playerHealth);
  });

  it("uses battle RNG for Septic", () => {
    const currentEnemy = enemyWith("septic");
    const poison = endPlayerTurn(makeTestBattleState({ currentEnemy, rng: () => 0.1 })).state;
    const bleed = endPlayerTurn(makeTestBattleState({ currentEnemy, rng: () => 0.9 })).state;
    expect(poison.playerStatuses.poison).toBe(1);
    expect(bleed.playerStatuses.bleed).toBe(1);
  });

  it("applies Plated, Reinforced, and Overgrowth before the attack", () => {
    const currentEnemy = {
      ...enemyWith("plated", "reinforced", "overgrowth"),
      abilityIds: ["slash", "bash", "frostbolt"],
    };
    const result = endPlayerTurn(
      makeTestBattleState({
        currentEnemy,
        enemyHealth: 10,
        enemyMaxHealth: 20,
        roomScalingMultiplier: 2,
      }),
    ).state;
    expect(result.enemyMitigation.armor).toBe(2);
    expect(result.enemyMitigation.block).toBe(4);
    expect(result.enemyHealth).toBe(12);
  });

  it.each([
    ["combustible", "burn", 1],
    ["chilling", "freeze", 1],
    ["concussive", "stun", 1],
  ] as const)("applies %s typed damage and build-up", (traitId, status, amount) => {
    const currentEnemy = enemyWith(traitId);
    const result = endPlayerTurn(makeTestBattleState({ currentEnemy })).state;
    expect(result.playerStatuses[status]).toBe(amount);
    expect(result.playerHealth).toBe(30 - amount);
  });

  it("applies Zealot Holy damage without a status rider", () => {
    const currentEnemy = enemyWith("zealot");
    const result = endPlayerTurn(makeTestBattleState({ currentEnemy })).state;
    expect(result.playerHealth).toBe(28);
  });

  it("Caustic strips scaled Armor even when its hit is blocked", () => {
    const currentEnemy = enemyWith("caustic");
    const base = makeTestBattleState();
    const result = endPlayerTurn(
      makeTestBattleState({
        currentEnemy,
        roomScalingMultiplier: 2,
        playerStatuses: { ...base.playerStatuses, block: 10, armor: 3 },
      }),
    ).state;
    expect(result.playerStatuses.armor).toBe(1);
    expect(result.playerStatuses.poison).toBe(0);
  });

  it("Flesheater leeches from its hit and the following Bleed tick", () => {
    const currentEnemy = enemyWith("flesheater");
    const first = endPlayerTurn(makeTestBattleState({ currentEnemy, enemyHealth: 10, enemyMaxHealth: 20 })).state;
    expect(first.enemyHealth).toBe(11);
    expect(first.playerStatuses.bleed).toBe(1);
    expect(first.pendingEnemyBleedLeechHealing).toBe(1);

    const texts: Parameters<typeof tickPlayerStatuses>[1] = [];
    const second = tickPlayerStatuses(first, texts);
    expect(second.enemyHealth).toBe(12);
    expect(second.pendingEnemyBleedLeechHealing).toBe(0);
  });

  it.each([
    ["anti-Leech talents", { blockEnemyLeech: true }, 0],
    ["Freeze regeneration blocking", { freezeBlocksRegen: true }, 1],
  ] as const)("Flesheater respects %s on its hit and Bleed tick", (_label, talentOverrides, enemyFreezeSkipTurns) => {
    const currentEnemy = enemyWith("flesheater");
    const base = makeTestBattleState();
    const first = endPlayerTurn(
      makeTestBattleState({
        currentEnemy,
        enemyHealth: 10,
        enemyMaxHealth: 20,
        enemyCC: { stunSkipTurns: 0, freezeSkipTurns: enemyFreezeSkipTurns, cooldown: 0 },
        talentEffects: { ...base.talentEffects, ...talentOverrides },
      }),
    ).state;
    expect(first.enemyHealth).toBe(10);

    const second = tickPlayerStatuses(first, []);
    expect(second.enemyHealth).toBe(10);
    expect(second.pendingEnemyBleedLeechHealing).toBe(0);
  });
});

describe("encounter trait card events", () => {
  it.each(["thorns", "holy-retribution"] as const)("retaliates against random damage with %s", (trait) => {
    const played = card({ effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 6 }] });
    const state = patchBattleState({
      currentEnemy: enemyWith(trait),
      enemyStatuses: { thorns: trait === "thorns" ? 1 : 0 },
      flags: { legacyEnemyThornsReady: trait === "thorns" },
      playerHealth: 10,
      hand: [played],
      mana: 1,
      turnPhase: "player",
      rng: () => 0.5,
    });
    const result = playBattleCardResolved(state, played.id, 0);
    expect(result.state.playerHealth).toBe(9);
  });

  it("retaliates once per multi-hit card and still retaliates after lethal damage", () => {
    const currentEnemy = enemyWith("thorns", "holy-retribution");
    const played = card({
      effects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "burn", amount: 2 },
      ],
    });
    const state = patchBattleState({
      currentEnemy,
      enemyHealth: 1,
      enemyMaxHealth: 1,
      enemyStatuses: { thorns: 1 },
      flags: { legacyEnemyThornsReady: currentEnemy.traits.some((trait) => trait.id === "thorns") },
      playerHealth: 10,
      hand: [played],
      mana: 1,
      turnPhase: "player",
    });
    const result = playBattleCardResolved(state, played.id, 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(8);
    expect(result.state.enemyStatuses.thorns).toBe(0);
  });

  it("only retaliates while holding thorns and regrows the stack each round", () => {
    const currentEnemy = enemyWith("thorns");
    const played = card({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = patchBattleState({
      currentEnemy,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { thorns: 1 },
      flags: { legacyEnemyThornsReady: currentEnemy.traits.some((trait) => trait.id === "thorns") },
      playerHealth: 10,
      hand: [played, { ...played, uid: 2 }],
      mana: 2,
      turnPhase: "player",
    });
    const first = playBattleCardResolved(state, played.id, 0);
    expect(first.state.playerHealth).toBe(9);
    expect(first.state.enemyStatuses.thorns).toBe(0);
    const second = playBattleCardResolved(first.state, played.id, 0);
    expect(second.state.playerHealth).toBe(9);
    const regrown = regrowEnemyThorns(second.state, []);
    expect(regrown.enemyStatuses.thorns).toBe(1);
  });

  it("burns the attacker when the enemy has cinder-skin", () => {
    const currentEnemy: BestiaryEntry = {
      id: "fire-elemental",
      title: "Fire Elemental",
      subtitle: "Elite",
      descriptionLines: [],
      art: "",
      enemyType: "elite",
      traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "Deals 1 Burn damage when attacked" }],
      abilityIds: ["slash", "bash", "block"],
    };
    const played = card({
      effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const result = playBattleCardResolved(
      makeTestBattleState({
        currentEnemy,
        hand: [played],
        mana: 1,
        playerHealth: 10,
        turnPhase: "player",
      }),
      played.id,
      0,
    );
    expect(result.state.playerStatuses.burn).toBeGreaterThan(0);
  });

  it("shares Cinder Skin between spells and Physical cards", () => {
    const spell = card({ id: "spell", uid: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] });
    const physical = card({ id: "physical", uid: 2 });
    const currentEnemy = {
      ...enemyWith(),
      traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "Reacts to Physical cards" }],
    };
    const state = makeTestBattleState({ currentEnemy, hand: [spell, physical], mana: 2, playerHealth: 10 });
    const afterSpell = playBattleCardResolved(state, spell.id, 0).state;
    expect(afterSpell.playerStatuses.burn).toBe(1);
    expect(afterSpell.flags.cinderSkinUsedThisTurn).toBe(true);
    const afterPhysical = playBattleCardResolved(afterSpell, physical.id, 0).state;
    expect(afterPhysical.playerStatuses.burn).toBe(1);
    expect(afterPhysical.flags.cinderSkinUsedThisTurn).toBe(true);
  });

  it("limits cinder-skin and holy-retribution to once per turn each", () => {
    const currentEnemy: BestiaryEntry = {
      ...enemyWith("holy-retribution"),
      traits: [
        ...enemyWith("holy-retribution").traits,
        { id: "cinder-skin", title: "Cinder Skin", description: "Deals 1 Burn damage when attacked\nOnce per turn" },
      ],
    };
    const firstCard = card({ uid: 1, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const secondCard = card({ uid: 2, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const state = patchBattleState({
      currentEnemy,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      hand: [firstCard, secondCard],
      mana: 2,
      playerHealth: 10,
      turnPhase: "player",
    });
    const first = playBattleCardResolved(state, firstCard.id, 0);
    expect(first.state.playerHealth).toBe(8);
    expect(first.state.playerStatuses.burn).toBe(1);
    expect(first.state.flags.cinderSkinUsedThisTurn).toBe(true);
    expect(first.state.flags.holyRetributionUsedThisTurn).toBe(true);
    const second = playBattleCardResolved(first.state, secondCard.id, 0);
    expect(second.state.playerHealth).toBe(8);
    expect(second.state.playerStatuses.burn).toBe(1);
  });

  it("resets cinder-skin and holy-retribution on the next player turn", () => {
    const currentEnemy: BestiaryEntry = {
      ...enemyWith("holy-retribution"),
      traits: [
        ...enemyWith("holy-retribution").traits,
        { id: "cinder-skin", title: "Cinder Skin", description: "Deals 1 Burn damage when attacked\nOnce per turn" },
      ],
    };
    const firstCard = card({ uid: 1, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const secondCard = card({ uid: 2, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const thirdCard = card({ uid: 3, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const state = patchBattleState({
      currentEnemy,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      hand: [firstCard, secondCard],
      mana: 2,
      playerHealth: 10,
      turnPhase: "player",
    });
    const first = playBattleCardResolved(state, firstCard.id, 0);
    const second = playBattleCardResolved(first.state, secondCard.id, 0);
    const nextTurn = { ...advanceToPlayerTurn(second.state), hand: [thirdCard], mana: 1 };
    expect(nextTurn.flags.cinderSkinUsedThisTurn).toBe(false);
    expect(nextTurn.flags.holyRetributionUsedThisTurn).toBe(false);
    const third = playBattleCardResolved(nextTurn, thirdCard.id, 0);
    expect(third.state.playerHealth).toBe(second.state.playerHealth - 2);
    expect(third.state.playerStatuses.burn).toBe(second.state.playerStatuses.burn + 1);
  });

  it("moves a played card to its destination when retaliation defeats the player", () => {
    const currentEnemy = enemyWith("thorns");
    const played = card({ consume: true });
    const result = playBattleCardResolved(
      patchBattleState({
        currentEnemy,
        enemyStatuses: { thorns: 1 },
        flags: { legacyEnemyThornsReady: currentEnemy.traits.some((trait) => trait.id === "thorns") },
        hand: [played],
        mana: 1,
        playerHealth: 1,
        deathsDoorUsed: true,
        turnPhase: "player",
      }),
      played.id,
      0,
    );

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.hand).toEqual([]);
    expect(result.state.exhausted).toContainEqual(played);
  });

  it("feeds Insatiable once when one Consume card resolves twice", () => {
    const played = card({ consume: true, effects: [] });
    const state = patchBattleState({
      currentEnemy: enemyWith("insatiable"),
      hand: [played],
      flags: { playNextCardTwice: true },
    });
    const result = playBattleCardResolved(state, played.id, 0).state;
    expect(result.exhausted).toHaveLength(1);
    expect(result.enemyPhysicalDamageBonus).toBe(1);
  });

  it("triggers Consume, Wish, and Nature reactions once per played card", () => {
    const currentEnemy = enemyWith("insatiable", "jealous", "rooted");
    const played = card({
      consume: true,
      effects: [
        { kind: "damage", damageType: "nature", amount: 1 },
        { kind: "wish", amount: 3 },
      ],
    });
    const state = makeTestBattleState({ currentEnemy, hand: [played], mana: 1, turnPhase: "player" });
    const result = playBattleCardResolved(state, played.id, 0);
    expect(result.state.enemyPhysicalDamageBonus).toBe(2);
    expect(result.state.enemyMitigation.block).toBe(1);
  });

  it("activates Divine Aegis once on the first downward half-health crossing", () => {
    const currentEnemy = enemyWith("divine-aegis");
    const played = card({ effects: [{ kind: "damage", damageType: "holy", amount: 6 }] });
    const state = makeTestBattleState({
      currentEnemy,
      enemyHealth: 10,
      enemyMaxHealth: 10,
      hand: [played],
      mana: 1,
      turnPhase: "player",
    });
    const first = playBattleCardResolved(state, played.id, 0).state;
    expect(first.enemyMitigation.armor).toBe(2);
    expect(first.enemyMitigation.block).toBe(4);
    expect(first.flags.divineAegisTriggered).toBe(true);
  });

  it("Braced halves Stun build-up", () => {
    const currentEnemy = enemyWith("braced");
    const played = card({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] });
    const state = makeTestBattleState({ currentEnemy, hand: [played], mana: 1, turnPhase: "player" });
    const result = playBattleCardResolved(state, played.id, 0).state;
    expect(result.enemyStatuses.stun).toBe(2);
  });

  it("Braced halves indirect Stun build-up", () => {
    const state = makeTestBattleState({ currentEnemy: enemyWith("braced") });
    expect(addEnemyStatus(state, "stun", 3).enemyStatuses.stun).toBe(2);
  });

  it("uses the persistent Physical bonus on later enemy attacks", () => {
    const currentEnemy = { ...enemyWith("insatiable"), abilityIds: ["block", "bash", "slash"] };
    const played = card({ consume: true, effects: [] });
    const afterCard = playBattleCardResolved(
      makeTestBattleState({ currentEnemy, hand: [played], mana: 1, turnPhase: "player" }),
      played.id,
      0,
    ).state;
    const afterTurn = endPlayerTurn({
      ...afterCard,
      rng: () => 0.99,
    }).state;
    const withoutBonus = endPlayerTurn({ ...afterCard, enemyPhysicalDamageBonus: 0, rng: () => 0.99 }).state;
    expect(afterTurn.playerHealth).toBe(withoutBonus.playerHealth - 1);
  });

  it("activates Divine Aegis when a DoT crosses half health", () => {
    const currentEnemy = enemyWith("divine-aegis");
    const base = makeTestBattleState();
    const result = tickEnemyStatuses(
      makeTestBattleState({
        currentEnemy,
        enemyHealth: 6,
        enemyMaxHealth: 10,
        enemyStatuses: { ...base.enemyStatuses, burn: 2 },
      }),
      [],
    );
    expect(result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyMitigation.armor).toBe(2);
    expect(result.enemyMitigation.block).toBe(4);
  });

  it("activates Divine Aegis when physical bleed detonation crosses half health", () => {
    const currentEnemy = enemyWith("divine-aegis");
    const base = makeTestBattleState();
    const played = card({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const result = playBattleCardResolved(
      makeTestBattleState({
        currentEnemy,
        enemyHealth: 10,
        enemyMaxHealth: 10,
        enemyStatuses: { ...base.enemyStatuses, bleed: 6 },
        talentEffects: { ...base.talentEffects, physicalDetonatesBleed: true },
        hand: [played],
        mana: 1,
        turnPhase: "player",
      }),
      played.id,
      0,
    ).state;
    expect(result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyMitigation.armor).toBe(2);
    expect(result.enemyMitigation.block).toBe(4);
  });

  it("preserves Bleed above Blackfletch range without activating Divine Aegis", () => {
    const currentEnemy = enemyWith("divine-aegis");
    const base = makeTestBattleState();
    const played = card({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
    const result = playBattleCardResolved(
      makeTestBattleState({
        currentEnemy,
        enemyHealth: 10,
        enemyMaxHealth: 10,
        enemyStatuses: { ...base.enemyStatuses, bleed: 6 },
        gearEffects: { ...base.gearEffects, archeryDetonateBleedPoison: 1 },
        hand: [played],
        mana: 1,
        turnPhase: "player",
      }),
      played.id,
      0,
    ).state;
    expect(result.flags.divineAegisTriggered).toBe(false);
    expect(result.enemyHealth).toBe(9);
    expect(result.enemyStatuses.bleed).toBe(6);
    expect(result.enemyMitigation.armor).toBe(0);
    expect(result.enemyMitigation.block).toBe(0);
  });
});

describe("Cinder Skin Health damage reactions", () => {
  const makeState = () =>
    patchBattleState({
      currentEnemy: enemyById["fire-elemental"],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerHealth: 30,
      playerMaxHealth: 30,
      rng: () => 0.99,
      hand: [card()],
      mana: 1,
    });

  it("lets a Companion trigger the shared reaction before cards and DoTs", () => {
    const state = { ...makeState(), activeCompanion: companionLibrary.wolf };
    const afterCompanion = processCompanionTurnStart(state, []);
    expect(afterCompanion.playerHealth).toBe(29);
    expect(afterCompanion.flags.cinderSkinUsedThisTurn).toBe(true);
    const afterCard = playBattleCardResolved(afterCompanion, afterCompanion.hand[0]!.id, 0).state;
    const afterDot = tickEnemyStatuses({ ...afterCard, enemyStatuses: { ...afterCard.enemyStatuses, poison: 2 } }, []);
    expect(afterDot.playerHealth).toBe(29);
    expect(afterDot.playerStatuses.burn).toBe(1);
  });

  it("triggers from damage over time, including a lethal tick", () => {
    for (const health of [1, 100]) {
      const state = makeState();
      const next = tickEnemyStatuses(
        { ...state, enemyHealth: health, enemyStatuses: { ...state.enemyStatuses, poison: 2 } },
        [],
      );
      expect(next.playerHealth).toBe(29);
      expect(next.flags.cinderSkinUsedThisTurn).toBe(true);
    }
  });

  it("does not spend the reaction on blocked or dodged cards", () => {
    for (const dodge of [false, true]) {
      const state = makeState();
      const prevented = playBattleCardResolved(
        {
          ...state,
          rng: () => (dodge ? 0 : 0.99),
          enemyMitigation: { ...state.enemyMitigation, block: dodge ? 0 : 20 },
        },
        state.hand[0]!.id,
        0,
      ).state;
      expect(prevented.enemyHealth).toBe(100);
      expect(prevented.flags.cinderSkinUsedThisTurn).toBe(false);
      expect(prevented.playerHealth).toBe(30);
    }
  });

  it("retaliates after Consume damage from a non-damaging card", () => {
    const played = card({ consume: true, effects: [{ kind: "player-status", status: "forge", amount: 1 }] });
    const state = makeState();
    const result = playBattleCardResolved(
      { ...state, hand: [played], gearEffects: { ...state.gearEffects, burnOnConsume: 1 } },
      played.id,
      0,
    ).state;
    expect(result.playerHealth).toBe(29);
    expect(result.flags.pendingCinderSkinReaction).toBe(false);
    expect(result.flags.cinderSkinUsedThisTurn).toBe(true);
  });

  it("retains the first damage trigger even if Second Wind restores the lost Health", () => {
    const state = makeState();
    const played = card({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const currentEnemy = {
      ...state.currentEnemy,
      traits: [...state.currentEnemy.traits, ...enemyWith("second-wind").traits],
    };
    const result = playBattleCardResolved(
      { ...state, currentEnemy, enemyHealth: 51, hand: [played] },
      played.id,
      0,
    ).state;
    expect(result.enemyHealth).toBeGreaterThan(51);
    expect(result.playerHealth).toBe(29);
    expect(result.flags.pendingCinderSkinReaction).toBe(false);
  });

  it("drains a saved pending reaction once without retriggering on counter-damage", () => {
    const state = makeState();
    const defended = {
      ...state,
      playerStatuses: { ...state.playerStatuses, block: 1 },
      gearEffects: { ...state.gearEffects, stunOnBlockDepleted: 1 },
    };
    const queued = damageEnemyHealth(defended, 1).state;
    const resumed = normalizePersistedBattleState(queued);
    expect(resumed.flags.pendingCinderSkinReaction).toBe(true);
    const resolved = resolvePendingBattleReactions({ ...resumed, rng: state.rng }, []);
    expect(resolved.playerHealth).toBe(30);
    expect(resolved.enemyHealth).toBe(98);
    expect(resolved.flags.pendingCinderSkinReaction).toBe(false);
    expect(resolvePendingBattleReactions(resolved, [])).toBe(resolved);
  });

  it("keeps room scaling and retaliates against a lethal card", () => {
    const state = makeState();
    const result = playBattleCardResolved(
      { ...state, enemyHealth: 1, roomScalingMultiplier: 2 },
      state.hand[0]!.id,
      0,
    ).state;
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(28);
    expect(result.flags.cinderSkinUsedThisTurn).toBe(true);
  });
});
