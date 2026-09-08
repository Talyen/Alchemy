import { describe, expect, it } from "vitest";
import { computeTalentEffects, companionLibrary, type BattleCard, type KeywordId } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyLeechHealing } from "@/lib/battle/damage-rider-leech";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { advanceToPlayerTurn, reduceSkipTurns } from "@/lib/battle/player-turn-transition";
import { buildWishOptions, chooseWishCard } from "@/lib/battle/wish";
import { addGoldWithCombatText } from "@/lib/battle/combat-text";
import { applyCleanseHeals } from "@/lib/battle/status-player";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function talents(keyword: KeywordId, ...ids: string[]) {
  return computeTalentEffects({ [keyword]: ids });
}

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 30,
    playerMaxHealth: 30,
    mana: 20,
    maxMana: 20,
    rng: () => 0.99,
    ...patch,
  });
}

function attack(id: string, damageType: "physical" | "nature" | "bleed" | "holy" = "physical", amount = 2): BattleCard {
  return makeTestCard({
    id,
    uid: Number(id.replace(/\D/g, "")) || 1,
    cost: 1,
    effects: [{ kind: "damage", damageType, amount }],
  });
}

function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [...state.hand, card] }, card.id, state.hand.length).state;
}

describe("repeatable talent replacements", () => {
  it.each([3, 7])("keeps The Returning Flight card when %i enemy-phase draws fill the hand", (count) => {
    const returning = { ...attack("returning42"), tags: ["archery" as const] };
    const state = battle({
      hand: Array.from({ length: count }, (_, i) => attack(`held-${i}`)),
      deck: Array.from({ length: 4 }, (_, i) => attack(`deck-${i}`)),
      discard: [returning],
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { lastArcheryUid: returning.uid },
    });
    const after = advanceToPlayerTurn(state);
    expect(after.hand).toHaveLength(MAX_HAND_SIZE);
    expect(after.discard).toContainEqual(returning);
    expect(after.uniqueGear.returningFlightUid).toBeNull();
    expect(after.hand.length + after.deck.length + after.discard.length).toBe(count + 5);
  });

  it("a lethal shield counter prevents Earth Elemental's Block-break damage", () => {
    const state = battle({
      enemyHealth: 1,
      playerStatuses: { block: 1 },
      talentEffects: talents("block", "block-reduce-burn"),
      currentEnemy: { traits: [{ id: "earth-elemental", title: "Earth Elemental", description: "" }] },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
    const after = processEnemyAttack(state, []);
    expect(after.enemyHealth).toBe(0);
    expect(after.playerHealth).toBe(state.playerHealth);
  });

  it("Sanguine Overflow survives an unselected attack branch until an attack is attempted", () => {
    const state = battle({ flags: { sanguinePhysicalBonus: 3 } });
    const missed = play(
      state,
      makeTestCard({
        effects: [
          {
            kind: "chance",
            probability: 0,
            successEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
            failureEffects: [],
          },
        ],
      }),
    );
    expect(missed.flags.sanguinePhysicalBonus).toBe(3);
    const after = play(missed, attack("next"));
    expect(missed.enemyHealth - after.enemyHealth).toBe(5);
    expect(after.flags.sanguinePhysicalBonus).toBe(0);
    expect(play({ ...missed, rng: () => 0 }, attack("dodged")).flags.sanguinePhysicalBonus).toBe(0);
  });

  it("accumulates Coordinated Strike and spends it on only one Companion damage packet", () => {
    let state = battle({
      talentEffects: talents("companion", "companion-tame"),
      activeCompanion: {
        ...companionLibrary.wolf,
        turnStartEffects: [
          { kind: "damage", damageType: "physical", amount: 1 },
          { kind: "damage", damageType: "physical", amount: 1 },
        ],
      },
    });
    state = play(play(state, attack("1")), attack("2"));
    expect(state.flags.companionNextAttackBonus).toBe(2);
    const after = processCompanionTurnStart(state, []);
    expect(state.enemyHealth - after.enemyHealth).toBe(4);
    expect(after.flags.companionNextAttackBonus).toBe(0);
    expect(after.enemyHealth - processCompanionTurnStart(after, []).enemyHealth).toBe(2);
  });

  it("keeps a Companion bonus through a utility action and consumes a dodged attack", () => {
    const state = battle({
      activeCompanion: companionLibrary["golden-retriever"],
      flags: { companionNextAttackBonus: 4 },
    });
    expect(processCompanionTurnStart(state, []).flags.companionNextAttackBonus).toBe(4);
    expect(
      processCompanionTurnStart({ ...state, activeCompanion: companionLibrary.wolf, rng: () => 0 }, []).flags
        .companionNextAttackBonus,
    ).toBe(0);
  });

  it.each(["poison", "bleed"] as const)(
    "boosts Leech against %s without doubling the bonus for two afflictions",
    (status) => {
      const state = battle({
        playerHealth: 10,
        talentEffects: talents("leech", "leech-nature-chance"),
        enemyStatuses: { [status]: 2 },
      });
      expect(applyLeechHealing(state, 4, []).playerHealth).toBe(16);
      expect(
        applyLeechHealing({ ...state, enemyStatuses: { ...state.enemyStatuses, poison: 2, bleed: 2 } }, 4, [])
          .playerHealth,
      ).toBe(16);
    },
  );

  it("pays Dark Recovery next turn based on Mana at turn end, even if the enemy drains Mana", () => {
    const state = battle({
      mana: 0,
      maxMana: 3,
      talentEffects: talents("mana", "mana-arcane-wish"),
      enemyAttackEffects: [],
    });
    const ended = endPlayerTurn(state);
    expect(ended.state.mana).toBe(4);
    expect(ended.state.flags.darkRecoveryMana).toBe(0);
    expect(advanceToPlayerTurn({ ...state, mana: 0, flags: { ...state.flags, darkRecoveryMana: 0 } }).mana).toBe(3);
    expect(endPlayerTurn({ ...state, mana: 1 }).state.mana).toBe(3);
  });

  it("guarantees the only undiscovered Wish card and expands each queued offer", () => {
    const pool = getOfferableCardPool();
    const missing = pool.find((card) => card.id !== "wish")!;
    const state = battle({
      talentEffects: talents("wish", "wish-undiscovered", "wish-extra-choice"),
      discoveredCardIds: pool.filter((card) => card.id !== missing.id).map((card) => card.id),
    });
    const options = buildWishOptions(state, makeTestCard({ id: "wish" }));
    expect(options).toHaveLength(4);
    expect(options.map((card) => card.id)).toContain(missing.id);
    expect(new Set(options.map((card) => card.id)).size).toBe(4);
    expect(
      buildWishOptions({ ...state, discoveredCardIds: pool.map((card) => card.id) }, makeTestCard({ id: "wish" })),
    ).toHaveLength(4);
  });

  it("pays Roads Not Taken only for a valid selection, including full hands and queued Wishes", () => {
    const options = [attack("1"), attack("2"), attack("3"), attack("4")];
    const state = battle({
      talentEffects: talents("wish", "wish-gold"),
      wishOptions: options,
      wishQueue: [options.slice(0, 2)],
      hand: Array.from({ length: MAX_HAND_SIZE }, (_, i) => attack(`hand-${i}`)),
    });
    expect(chooseWishCard(state, "invalid")).toBe(state);
    const after = chooseWishCard(state, "1");
    expect(after.playerStatuses.block).toBe(3);
    expect(after.discard.at(-1)?.id).toBe("1");
    const final = chooseWishCard(after, "2");
    expect(final.playerStatuses.block).toBe(4);
    expect(chooseWishCard(final, "2")).toBe(final);
  });

  it("Wish selection cannot turn an absent reward into Block through Forge", () => {
    const options = [attack("1"), attack("2")];
    const state = battle({ playerStatuses: { forge: 5 }, talentEffects: { forgeToBlock: true }, wishOptions: options });
    expect(chooseWishCard(state, "1").playerStatuses.block).toBe(0);
    const noDeclines = {
      ...state,
      wishOptions: options.slice(0, 1),
      talentEffects: { ...state.talentEffects, blockPerDeclinedWishCard: 1 },
    };
    expect(chooseWishCard(noDeclines, "1").playerStatuses.block).toBe(0);
  });

  it("refreshes Sanguine Overflow without stacking or triggering at full Health", () => {
    const state = battle({ playerHealth: 28, talentEffects: talents("leech", "leech-block-enemy") });
    const healed = applyLeechHealing(state, 2, []);
    expect(healed.flags.sanguinePhysicalBonus).toBe(3);
    expect(applyLeechHealing({ ...healed, playerHealth: 29 }, 1, []).flags.sanguinePhysicalBonus).toBe(3);
    const hit = play(healed, attack("multi", "physical", 2));
    expect(healed.enemyHealth - hit.enemyHealth).toBe(5);
    expect(hit.flags.sanguinePhysicalBonus).toBe(0);
    expect(applyLeechHealing(hit, 4, []).flags.sanguinePhysicalBonus).toBe(0);
  });

  it("Bloodrush draws on a normal Bleed tick, never on application or detonation", () => {
    const state = battle({
      talentEffects: talents("bleed", "bleed-rip-and-tear"),
      deck: [attack("drawn")],
      enemyStatuses: { bleed: 2 },
    });
    expect(tickEnemyStatuses(state, []).hand.map((card) => card.id)).toEqual(["drawn"]);
    expect(detonateEnemyStatuses(state, ["bleed"], []).hand).toEqual([]);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, bleed: 0 } }, attack("bleed", "bleed")).hand,
    ).toEqual([]);
    expect(endPlayerTurn(state).state.hand.map((card) => card.id)).toContain("drawn");
  });

  it("Tailwind draws for repeated Dodges and retains those cards into the next hand", () => {
    const state = battle({
      talentEffects: { ...talents("dodge", "dodge-rolling-recovery"), dodgeChance: 95 },
      rng: () => 0.5,
      deck: Array.from({ length: 10 }, (_, i) => attack(`draw-${i}`)),
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
      ],
    });
    const dodged = processEnemyAttack(state, []);
    expect(dodged.hand).toHaveLength(2);
    const after = endPlayerTurn(state).state;
    expect(after.hand.length).toBeGreaterThan(5);
    expect(after.hand.some((card) => card.id === "draw-9")).toBe(true);
  });

  it("Follow-through rewards consecutive cards once per card and resets next turn", () => {
    const arrow = {
      ...attack("arrow"),
      tags: ["archery" as const],
      effects: [
        { kind: "damage" as const, damageType: "physical" as const, amount: 2 },
        { kind: "damage" as const, damageType: "physical" as const, amount: 2 },
      ],
    };
    const state = battle({ talentEffects: talents("archery", "archery-hail") });
    const first = play(state, arrow);
    const second = play(first, arrow);
    const third = play(second, arrow);
    expect(state.enemyHealth - first.enemyHealth).toBe(4);
    expect(first.enemyHealth - second.enemyHealth).toBe(6);
    expect(second.enemyHealth - third.enemyHealth).toBe(6);
    const nextTurn = advanceToPlayerTurn(third);
    expect(nextTurn.enemyHealth - play(nextTurn, arrow).enemyHealth).toBe(4);
  });

  it("Armor Siphon steals before damage once per card, including doubled card effects", () => {
    const card = makeTestCard({
      ...attack("leech", "holy"),
      effects: [
        { kind: "damage", damageType: "holy", amount: 1, lifesteal: true },
        { kind: "damage", damageType: "holy", amount: 1, lifesteal: true },
      ],
    });
    const state = battle({
      talentEffects: talents("leech", "leech-trinket-siphon"),
      enemyMitigation: { armor: 8 },
      flags: { playNextCardTwice: true },
    });
    expect(play(state, card).playerStatuses.armor).toBe(1);
    expect(play({ ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } }, card).playerStatuses.armor).toBe(
      0,
    );
  });

  it("Clean Slate cannot recursively cleanse through Cleansing Status healing", () => {
    const card = makeTestCard({ id: "heal", effects: [{ kind: "heal", amount: 2 }] });
    const state = battle({
      talentEffects: talents("health", "health-campfire", "health-max-2"),
      playerStatuses: { poison: 3, bleed: 3, burn: 3 },
    });
    const healed = play(state, card);
    expect(
      [healed.playerStatuses.poison, healed.playerStatuses.bleed, healed.playerStatuses.burn].filter(
        (value) => value === 0,
      ),
    ).toHaveLength(1);
    expect(applyCleanseHeals(state).playerStatuses).toEqual(state.playerStatuses);
    const exact = play({ ...state, playerHealth: 28 }, card);
    expect(exact.playerStatuses).toEqual(state.playerStatuses);
  });

  it("Coinmail grants Block from actual Gold earned and can repeat", () => {
    const state = battle({ talentEffects: talents("gold", "gold-elite-drop"), gearEffects: { goldGainPercent: 100 } });
    const once = addGoldWithCombatText(state, 2, []);
    const twice = addGoldWithCombatText(once, 2, []);
    expect(twice.gold - state.gold).toBe(8);
    expect(twice.playerStatuses.block).toBe(4);
    expect(addGoldWithCombatText(twice, 0)).toBe(twice);
  });

  it("Bramblegrowth and Briar Patch reward repeated Nature–Physical sequences", () => {
    const state = battle({ talentEffects: talents("nature", "nature-natural-armor", "nature-briar-patch") });
    const nature = play(state, attack("nature", "nature"));
    expect(nature.playerStatuses.thorns).toBe(1);
    const physical = play(nature, attack("physical"));
    expect(physical.enemyStatuses.bleed).toBe(2);
    const repeated = play(play(physical, attack("nature2", "nature")), attack("physical2"));
    expect(repeated.playerStatuses.thorns).toBe(2);
    expect(repeated.enemyStatuses.bleed).toBe(4);
    expect(play(repeated, attack("physical3")).enemyStatuses.bleed).toBe(4);
  });

  it("Smoke Screen is a fixed conditional Dodge bonus", () => {
    const state = battle({
      talentEffects: talents("burn", "burn-dmg-5"),
      enemyStatuses: { burn: 1 },
      rng: () => 0.075,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    expect(processEnemyAttack(state, []).playerDodgeCount).toBe(1);
    expect(
      processEnemyAttack({ ...state, enemyStatuses: { ...state.enemyStatuses, burn: 100 } }, []).playerDodgeCount,
    ).toBe(1);
    expect(
      processEnemyAttack({ ...state, enemyStatuses: { ...state.enemyStatuses, burn: 0 } }, []).playerDodgeCount,
    ).toBe(0);
  });

  it("Sun-Struck Shield reacts to blocked attacks but not reflected damage", () => {
    const state = battle({
      talentEffects: talents("block", "block-reduce-burn"),
      playerStatuses: { block: 10 },
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
      ],
    });
    expect(processEnemyAttack(state, []).enemyHealth).toBe(98);
    expect(
      processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 2 }, [], {
        skipTraitReactions: true,
      }).enemyHealth,
    ).toBe(100);
    expect(
      processEnemyAttack({ ...state, playerStatuses: { ...state.playerStatuses, block: 0 } }, []).enemyHealth,
    ).toBe(100);
  });

  it("a lethal Sun-Struck Shield counter stops the remaining enemy hits", () => {
    const state = battle({
      enemyHealth: 1,
      playerStatuses: { block: 1 },
      talentEffects: talents("block", "block-reduce-burn"),
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 1 },
        { kind: "damage", damageType: "physical", amount: 100 },
      ],
    });
    const after = processEnemyAttack(state, []);
    expect(after.enemyHealth).toBe(0);
    expect(after.playerHealth).toBe(state.playerHealth);
    expect(after.deathsDoorUsed).toBe(false);
  });

  it("Glacial Barrier requires a new Freeze and Thaw Dividend requires natural recovery", () => {
    const state = battle({
      enemyHealth: 10,
      enemyMaxHealth: 10,
      talentEffects: talents("freeze", "freeze-block-healing", "freeze-prevent-scaling"),
      deck: [attack("drawn")],
    });
    const frozen = play(state, { ...attack("freeze"), effects: [{ kind: "damage", damageType: "freeze", amount: 6 }] });
    expect(frozen.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(frozen.playerStatuses.block).toBe(3);
    const recovered = reduceSkipTurns({ ...frozen, enemyCC: { ...frozen.enemyCC, freezeSkipTurns: 1 } });
    expect(recovered.hand.map((card) => card.id)).toContain("drawn");
    expect(reduceSkipTurns(recovered).hand).toEqual(recovered.hand);
    expect(reduceSkipTurns({ ...frozen, enemyHealth: 0 }).hand).toEqual(frozen.hand);
    expect(reduceSkipTurns({ ...frozen, playerHealth: 0 }).hand).toEqual(frozen.hand);
  });

  it("retains pending bonuses and sequencing through save/load, defaulting absent fields", () => {
    const state = battle({
      flags: {
        previousCardWasArchery: true,
        previousCardWasNature: true,
        companionNextAttackBonus: 4,
        sanguinePhysicalBonus: 3,
        darkRecoveryMana: 1,
      },
    });
    const saved = JSON.parse(JSON.stringify(state));
    expect(PersistedBattleStateSchema.parse(saved).flags).toEqual(state.flags);
    for (const key of [
      "previousCardWasArchery",
      "previousCardWasNature",
      "companionNextAttackBonus",
      "sanguinePhysicalBonus",
      "darkRecoveryMana",
    ])
      delete saved.flags[key];
    expect(PersistedBattleStateSchema.parse(saved).flags).toEqual(battle().flags);
  });

  it("Tailwind and Pack Weave both trigger on each Dodge without playing drawn cards", () => {
    const state = battle({
      talentEffects: {
        ...computeTalentEffects({
          dodge: ["dodge-rolling-recovery"],
          companion: ["companion-loyal", "companion-tame"],
        }),
        dodgeChance: 95,
      },
      activeCompanion: companionLibrary.wolf,
      deck: [attack("draw1"), attack("draw2")],
      flags: { companionNextAttackBonus: 2 },
      rng: () => 0.5,
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
      ],
    });
    const after = processEnemyAttack(state, []);
    expect(after.hand).toHaveLength(2);
    expect(after.enemyHealth).toBe(96);
    expect(after.flags.companionNextAttackBonus).toBe(0);
    expect(after.cardsPlayedThisTurn).toBe(0);
  });

  it("Sun-Struck Shield can grant Holy Block without creating another enemy attack", () => {
    const state = battle({
      playerStatuses: { block: 20 },
      talentEffects: { ...talents("block", "block-reduce-burn"), holyBlockPercentFromDamage: 100 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
    const after = processEnemyAttack(state, []);
    expect(after.playerStatuses.block).toBe(20);
    expect(after.enemyHealth).toBe(99);
  });

  it("repeated Wish choices combine Coinmail, Generous Wish and Roads Not Taken without Mana refunds", () => {
    const state = battle({
      talentEffects: computeTalentEffects({
        wish: ["wish-extra-choice", "wish-gold"],
        gold: ["gold-elite-drop", "gold-on-wish"],
      }),
    });
    const wish = makeTestCard({ id: "wish", cost: 1, effects: [{ kind: "wish", amount: 1 }] });
    let next = state;
    for (let i = 0; i < 3; i++) {
      next = play(next, wish);
      expect(next.wishOptions).toHaveLength(4);
      next = chooseWishCard(next, next.wishOptions![0]!.id);
    }
    expect(next.gold).toBe(9);
    expect(next.mana).toBe(state.mana - 3);
    expect(next.playerStatuses.block).toBe(15);
  });

  it("card Leech can trigger Clean Slate and Sanguine Overflow without recursive healing", () => {
    const state = battle({
      playerHealth: 29,
      playerStatuses: { poison: 3, bleed: 3 },
      talentEffects: computeTalentEffects({
        leech: ["leech-block-enemy"],
        health: ["health-campfire", "health-max-2"],
      }),
    });
    const leech = makeTestCard({
      id: "leech",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4, lifesteal: true }],
    });
    const after = play(state, leech);
    expect(after.playerHealth).toBe(30);
    expect(after.flags.sanguinePhysicalBonus).toBe(3);
    expect([after.playerStatuses.poison, after.playerStatuses.bleed].filter((value) => value === 0)).toHaveLength(1);
  });

  it("Dark Recovery pays once after restoring a pending enemy-phase snapshot", () => {
    const state = battle({
      mana: 0,
      maxMana: 3,
      talentEffects: talents("mana", "mana-arcane-wish", "mana-arcane-mending"),
    });
    const ended = endPlayerTurn(state);
    expect(ended.kind).toBe("standard");
    if (ended.kind === "haste") throw new Error("Expected an enemy phase");
    const loaded = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(ended.enemyTurnStartState)));
    const resumed = advanceToPlayerTurn({ ...loaded, rng: () => 0.99 });
    expect(resumed.mana).toBe(4);
    expect(resumed.flags.darkRecoveryMana).toBe(0);
    expect(advanceToPlayerTurn(resumed).mana).toBe(3);
  });
});
