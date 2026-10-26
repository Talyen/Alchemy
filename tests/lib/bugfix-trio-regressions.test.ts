import { describe, expect, it } from "vitest";
import { SaveDataSchema, isCombatGoldOverride } from "@/lib/validation";
import { applyCardEffects, defaultBattleState } from "@/lib/battle";
import { isStandardPotionCard } from "@/lib/game-data";
import { HALF_DIVISOR, TRANSMUTATION_KEYWORD_GROUPS, TRANSMUTATION_PREFIXES, UI_GOLD } from "@/lib/game-constants";
import { scoreCombatCards } from "../../src/app/playthrough/combat-policy";
import { makeMinimalActiveRunInput } from "../fixtures/active-run";
import { savedActivityFixture } from "../fixtures/run-activity";
import { scoreAvailableReactions } from "@/lib/battle/reaction-score";
import { patchBattleState, makeTestCard } from "../fixtures/battle";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { CombatTextEvent } from "@/lib/battle/types";

describe("bugfix trio regressions", () => {
  it("rounds fractional live-combat gold instead of flooring it", () => {
    expect(isCombatGoldOverride(10.9, 11)).toBe(true);
    expect(isCombatGoldOverride(10.9, 10)).toBe(false);
    const result = SaveDataSchema.safeParse({
      gold: 0,
      activeRun: makeMinimalActiveRunInput({
        activity: savedActivityFixture("battle", { battleState: { ...defaultBattleState(), gold: 10.9 } }),
      }),
    });
    expect(result.success, JSON.stringify(result.success ? "" : result.error?.issues)).toBe(true);
    if (result.success) expect(result.data.gold).toBe(11);
  });

  it("averages reaction payoffs across integer random hits before lethal cutoffs", () => {
    const base = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerHealth: 100,
      playerMaxHealth: 100,
      appliesFightPacing: false,
      encounterBenefits: ["wildheart"],
      currentEnemy: { abilityIds: ["slash", "stab"] },
      deck: Array.from({ length: 8 }, (_, i) =>
        makeTestCard({ id: `deck-${i}`, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
      ),
      enemyStatuses: { burn: 8 },
    });
    const state = { ...endPlayerTurn(endPlayerTurn(base).state).state, enemyHealth: 6 };
    const random = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["nature", "holy"] }],
    });
    const expected = [1, 2, 3, 4].reduce(
      (sum, amount) =>
        sum +
        (["nature", "holy"] as const).reduce(
          (subtotal, damageType) =>
            subtotal +
            scoreAvailableReactions(
              makeTestCard({
                effects: [{ kind: "damage", damageType, amount }],
              }),
              state,
            ),
          0,
        ) /
          8,
      0,
    );
    expect(expected).toBe(0.75);
    expect(scoreAvailableReactions(random, state)).toBe(expected);
  });

  it("clears detonated Bleed before a conditional follow-up and reaction finisher", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { bleed: 10, burn: 1 },
      reactions: { wildfireDamage: 3 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "bleed", amount: 2, detonateAllBleed: true },
        { kind: "damage", damageType: "physical", amount: 4, doubleIfEnemyBleeding: true },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    // 2 direct + 12 detonation + 4 Physical + 1 Nature leaves 1 for Wildfire.
    expect(scoreAvailableReactions(card, state)).toBe(1);
  });

  it("carries fresh Bleed into a conditional lethal hit before a reaction finisher", () => {
    const state = patchBattleState({
      enemyHealth: 13,
      enemyMaxHealth: 13,
      enemyStatuses: { burn: 1 },
      reactions: { wildfireDamage: 3 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "bleed", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 5, doubleIfEnemyBleeding: true },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(0);
  });

  it("deducts DoT detonation damage from enemy health so lethal detonations stop subsequent hits", () => {
    const state = patchBattleState({
      enemyHealth: 10,
      enemyMaxHealth: 10,
      enemyStatuses: { burn: 20 },
      reactions: { wildfireDamage: 10 },
    });
    const lethalCombustion = makeTestCard({
      effects: [
        { kind: "damage", damageType: "burn", amount: 1, detonateAllBurn: true },
        { kind: "damage", damageType: "nature", amount: 2 },
      ],
    });
    // Hit 1 deals 1 damage + detonates 20 Burn, killing the 10-HP enemy.
    // Hit 2 (Nature, which would otherwise trigger Wildfire) does not land on a defeated enemy.
    expect(scoreAvailableReactions(lethalCombustion, state)).toBe(0);
  });

  it("distinguishes player statuses in projection keys so chance branches do not drop cleansed states", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 10 },
      playerStatuses: { burn: 5 },
      reactions: { wildfireDamage: 10 },
    });
    const multiBranch = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }],
          failureEffects: [{ kind: "damage", damageType: "holy", amount: 5 }],
        },
        {
          kind: "cleanse-player-status-to-damage",
          status: "burn",
          damageType: "nature",
        },
      ],
    });
    // Success branch cleanses Burn on hit 1 so hit 2 does not trigger Wildfire.
    // Failure branch keeps Burn on hit 1, so hit 2 cleanses Burn as Nature, triggering Wildfire (10 damage).
    // Distinct playerStatuses prevent false merging, yielding 0.5 * 10 = 5.
    expect(scoreAvailableReactions(multiBranch, state)).toBe(5);
  });

  it("projects remove-enemy-armor before physical hits and Shatter scoring", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyMitigation: { armor: 10, block: 0, forge: 0 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 5 },
    });
    const sunder = makeTestCard({
      effects: [
        { kind: "remove-enemy-armor", halve: true },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
    });
    // Armor halves from 10 to 5.
    // Physical hit 3 triggers Shatter on the 5 remaining armor.
    // Shatter scores remaining armor (5) + shatter damage (5) = 10, not 10 + 5 = 15.
    expect(scoreAvailableReactions(sunder, state)).toBe(10);
  });

  it("projects multiply-enemy-status before DoT detonation reactions", () => {
    const state = patchBattleState({
      enemyHealth: 14,
      enemyMaxHealth: 14,
      enemyStatuses: { burn: 2, bleed: 5 },
      reactions: { wildfireDamage: 3 },
    });
    const multiplyAndDetonate = makeTestCard({
      effects: [
        { kind: "multiply-enemy-status", status: "bleed", factor: 2 },
        { kind: "damage", damageType: "bleed", amount: 1, detonateAllBleed: true },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    // Doubling Bleed leaves two HP after detonation, so Wildfire can only score one.
    expect(scoreAvailableReactions(multiplyAndDetonate, state)).toBe(1);
  });

  it("clears player statuses when projecting remove-harmful-status", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { burn: 5 },
      reactions: { wildfireDamage: 10 },
    });
    const cleanseThenAttack = makeTestCard({
      effects: [
        { kind: "remove-harmful-status", removeAll: true },
        { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "nature" },
      ],
    });
    // First effect cleanses player burn to 0.
    // Second effect sees 0 burn, so deals 0 damage and triggers no Wildfire reaction.
    expect(scoreAvailableReactions(cleanseThenAttack, state)).toBe(0);
  });

  it("projects player-status block before equal-to-block attacks to trigger Shatter", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 0 },
      enemyMitigation: { armor: 10, block: 0, forge: 0 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 5 },
    });
    const blockThenBash = makeTestCard({
      effects: [
        { kind: "player-status", status: "block", amount: 10 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    });
    // First effect grants 10 Block to player.
    // Second effect deals 10 Physical damage (equal to 10 Block).
    // Enemy is frozen with 10 Armor and Shatter: Shatter triggers, scoring 10 (armor) + 5 (shatterDamage) = 15.
    expect(scoreAvailableReactions(blockThenBash, state)).toBe(15);
  });

  it("projects next-hit-poison so subsequent attacks convert to poison and trigger reactions", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { burn: 0, poison: 0 },
    });
    const poisonThenBurn = makeTestCard({
      effects: [
        { kind: "next-hit-poison" },
        { kind: "damage", damageType: "physical", amount: 3 },
        { kind: "damage", damageType: "burn", amount: 2 },
      ],
    });
    // First effect sets nextHitPoison.
    // Second effect converts physical to 3 poison damage, adding 3 poison stacks to the enemy.
    // Third effect deals 2 burn damage against the now-poisoned enemy, triggering Venomflash (2 bonus damage).
    expect(scoreAvailableReactions(poisonThenBurn, state)).toBe(2);
  });

  it("keeps equal-status branches with different mana distinct before mana-scaled attacks", () => {
    const state = patchBattleState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 5,
      enemyMaxHealth: 5,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { frostfireDamage: 10 },
      talentEffects: { burnDamagePerMana: 100 },
    });
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "lose-mana", amount: 4 }],
          failureEffects: [],
        },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(2);
  });

  it("converts the action's starting mana even after restoration or an earlier conversion", () => {
    const state = patchBattleState({
      mana: 1,
      maxMana: 5,
      enemyHealth: 6,
      enemyMaxHealth: 6,
      enemyMitigation: { armor: 10, block: 0, forge: 0 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 5 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "restore-mana", amount: 3 },
        { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 1 },
        { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 1 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(14);
  });

  it("preserves existing mana overflow when projecting capped restoration", () => {
    const state = patchBattleState({
      mana: 6,
      maxMana: 3,
      enemyHealth: 8,
      enemyMaxHealth: 8,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { frostfireDamage: 10 },
      talentEffects: { burnDamagePerMana: 100 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "restore-mana", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(1);
  });

  it("includes Forge and gear Block bonuses before scoring a Shield Slam", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      playerStatuses: { forge: 4 },
      gearEffects: { flatBlockGained: 2 },
      talentEffects: { forgeBlockPercent: 100 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 20 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "player-status", status: "block", amount: 1 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    });
    // Seven Block plus four Forge damage leaves nine HP for Shatter.
    expect(scoreAvailableReactions(card, state)).toBe(9);
  });

  it("projects healing before evaluating health-threshold damage bonuses", () => {
    const base = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      playerHealth: 9,
      playerMaxHealth: 20,
      talentEffects: { physicalDoubledBelowHalfHealth: true },
    });
    // 9 HP is below half health (9 * 2 < 20).
    // Without heal: Physical 5 doubles to 10.
    const unhealedAttack = makeTestCard({
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    // With heal 2: player reaches 11 HP (above half health, 11 * 2 >= 20),
    // so physical damage does not double (deals 5).
    const healThenAttack = makeTestCard({
      effects: [
        { kind: "heal", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 5 },
      ],
    });
    // Compare enemy health remaining or reaction score impact:
    // With an enemy frozen with Shatter damage:
    const frozenState = {
      ...base,
      enemyCC: { ...base.enemyCC, freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { ...base.reactions, shatterDamage: 20 },
    };
    // Unhealed attack: deals 10 physical, leaving 10 HP for Shatter -> scores 10.
    expect(scoreAvailableReactions(unhealedAttack, frozenState)).toBe(10);
    // Heal-then-attack: deals 5 physical, leaving 15 HP for Shatter -> scores 15.
    expect(scoreAvailableReactions(healThenAttack, frozenState)).toBe(15);
  });

  it("projects Health costs through survival mechanics and stops hits only after actual defeat", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      playerHealth: 4,
      playerMaxHealth: 20,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 20 },
    });
    const fatalSacrifice = makeTestCard({
      effects: [
        { kind: "lose-health", amount: 5 },
        { kind: "damage", damageType: "physical", amount: 5 },
      ],
    });
    expect(applyCardEffects(state, fatalSacrifice, []).playerHealth).toBe(1);
    expect(scoreAvailableReactions(fatalSacrifice, state)).toBe(15);
    const defeated = { ...state, deathsDoorUsed: true };
    expect(applyCardEffects(defeated, fatalSacrifice, []).playerHealth).toBe(0);
    expect(scoreAvailableReactions(fatalSacrifice, defeated)).toBe(0);
    const healAfterDefeat = {
      ...fatalSacrifice,
      effects: [fatalSacrifice.effects[0]!, { kind: "heal" as const, amount: 5 }, fatalSacrifice.effects[1]!],
    };
    expect(applyCardEffects(defeated, healAfterDefeat, []).playerHealth).toBe(0);
    expect(scoreAvailableReactions(healAfterDefeat, defeated)).toBe(0);
    const revived = { ...defeated, playerStatuses: { ...state.playerStatuses, phoenixFeather: 1 } };
    expect(applyCardEffects(revived, fatalSacrifice, []).playerHealth).toBeGreaterThan(0);
    expect(scoreAvailableReactions(fatalSacrifice, revived)).toBe(15);
  });

  it("includes a prepared Whiplash hit before capping a later reaction at remaining Health", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: { stunSkipTurns: 1 },
      reactions: { thunderclapDamage: 30 },
      flags: { nextStunAttackBonus: 4 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "stun", amount: 3 },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    applyCardEffects(state, card, texts);
    expect(texts).toContainEqual(expect.objectContaining({ additive: false, amount: 30, healthLost: 22 }));
    // Seven Stun and one Nature leave 22 Health for Thunderclap.
    expect(scoreAvailableReactions(card, state)).toBe(22);
  });

  it("projects gain-max-mana before max-mana scaled damage calculations", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      mana: 2,
      maxMana: 2,
      gearEffects: { burnDamagePerManaPercent: 100 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { frostfireDamage: 30 },
    });
    // Burn damage receives (maxMana * 100%) / 100 bonus multiplier.
    // Base 5 damage with maxMana=2 gets +200% = 15 damage, leaving 15 for Frostfire.
    const withoutMaxManaGain = makeTestCard({
      effects: [{ kind: "damage", damageType: "burn", amount: 5 }],
    });
    expect(scoreAvailableReactions(withoutMaxManaGain, state)).toBe(15);

    // With gain-max-mana 1: maxMana becomes 3, getting +300% = 20 damage, leaving 10 for Frostfire.
    const withMaxManaGain = makeTestCard({
      effects: [
        { kind: "gain-max-mana", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 5 },
      ],
    });
    expect(scoreAvailableReactions(withMaxManaGain, state)).toBe(10);
  });

  it("re-exports isStandardPotionCard from @/lib/game-data barrel", () => {
    const healthPotion = makeTestCard({ id: "health-potion" });
    const slash = makeTestCard({ id: "slash" });
    expect(isStandardPotionCard(healthPotion)).toBe(true);
    expect(isStandardPotionCard(slash)).toBe(false);
  });

  it("caps emergency defense in combat policy using HALF_DIVISOR", () => {
    const attack = makeTestCard({ id: "attack", effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const defense = makeTestCard({
      id: "defense",
      cost: 1,
      effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 10 }],
    });
    const state = patchBattleState({
      mana: 3,
      maxMana: 3,
      playerHealth: 20,
      playerMaxHealth: 20,
      hand: [attack, defense],
    });
    const scores = scoreCombatCards([attack, defense], state, "greedy-effective-damage", 2);
    // bestAttack is 10; defense is capped at bestAttack / HALF_DIVISOR = 10 / 2 = 5.
    expect(scores[1]).toBe(10 / HALF_DIVISOR);
  });

  it("projects self-damage health loss and status application before follow-up cleanses", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 20,
      playerStatuses: { burn: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { burn: 5 },
      reactions: { wildfireDamage: 10 },
    });
    const exorcism = makeTestCard({
      effects: [
        { kind: "self-damage", damageType: "burn", amount: 2 },
        { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "nature" },
      ],
    });
    // Self-damage applies 2 Burn to player. Cleanse converts 2 Burn to Nature damage.
    // Nature damage against burning enemy triggers Wildfire reaction (10 damage).
    expect(scoreAvailableReactions(exorcism, state)).toBe(10);

    // If self-damage is lethal (with Death's Door already expended), subsequent hits and reactions score 0.
    const fragileState = patchBattleState({
      ...state,
      playerHealth: 2,
      deathsDoorUsed: true,
    });
    expect(scoreAvailableReactions(exorcism, fragileState)).toBe(0);
  });

  it("projects repeated execution when playNextCardTwice combat flag is set", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { poison: 5, burn: 0 },
      flags: { playNextCardTwice: true },
    });
    const burnAttack = makeTestCard({
      effects: [{ kind: "damage", damageType: "burn", amount: 3 }],
    });
    // Hit 1 deals 3 Burn, triggering Venomflash because enemy has Poison and Burn was 0.
    // Venomflash payoff is getReactionBonus(poison: 5) = 3.
    // Hit 2 deals 3 Burn again without repeating Venomflash.
    expect(scoreAvailableReactions(burnAttack, state)).toBe(3);
  });

  it("re-exports transmutation keywords, prefixes, and ui gold from game-constants barrel", () => {
    expect(TRANSMUTATION_PREFIXES.physical).toBe("Brutal");
    expect(TRANSMUTATION_PREFIXES.holy).toBe("Hallowed");
    expect(TRANSMUTATION_KEYWORD_GROUPS).toBeDefined();
    expect(UI_GOLD.base).toBe("#cd9b51");
  });
});
