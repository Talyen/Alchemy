import { describe, expect, it } from "vitest";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tryPoisonStunProc } from "@/lib/battle/follow-up-hit-resolution";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { buildWishOptions, applyWishEffect } from "@/lib/battle/wish";
import { computeTalentEffects, type BattleCardEffect } from "@/lib/game-data";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { makeEffect, makeTestCard, patchBattleState, dealDamage } from "../../fixtures/battle";

function playCard(state: ReturnType<typeof patchBattleState>, card: ReturnType<typeof makeTestCard>) {
  return playBattleCardResolved({ ...state, hand: [card] }, card.id, 0).state;
}

describe("Poison, Stun, and Wish Talent reworks", () => {
  it("computes the new Talent effects and preserves wording-only mechanics", () => {
    const effects = computeTalentEffects({
      poison: ["poison-physical-bonus", "poison-strip-armor", "poison-stun-chance", "poison-first-free"],
      stun: ["stun-damage-1"],
      wish: ["wish-trinket", "wish-extra-choice", "wish-draw", "wish-powerful", "wish-mana", "wish-gold"],
    });

    expect(effects.poisonDamageBonusVsPoisoned).toBe(1);
    expect(effects.poisonStripArmorByDamage).toBe(true);
    expect(effects.poisonStunChance).toBe(10);
    expect(effects.poisonCardPlayTwiceChance).toBe(10);
    expect(effects.stunCardPlayTwiceChance).toBe(10);
    expect(effects.wishCardPlayTwiceChance).toBe(10);
    expect(effects.wishDrawChance).toBe(10);
    expect(effects.manaOnWish).toBe(1);
    expect(effects.declinedWishCardChance).toBe(10);
    expect(effects.wishTrinketChoice).toBe(true);
    expect(effects.wishCardsUpgraded).toBe(true);
  });

  it("adds Corrosive damage to player and Companion packets against Poisoned enemies", () => {
    const state = patchBattleState({
      enemyStatuses: { poison: 2 },
      talentEffects: computeTalentEffects({ poison: ["poison-physical-bonus"] }),
      rng: () => 0.99,
    });
    const effect = makeEffect("physical", 5) as Extract<BattleCardEffect, { kind: "damage" }>;

    expect(computeCardDamageToEnemy(state, effect).modifiedDamage).toBe(6);
    expect(
      computeCardDamageToEnemy(state, effect, undefined, {
        origin: "companion",
        manaAtStart: state.mana,
        enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
      }).modifiedDamage,
    ).toBe(6);
    expect(
      computeCardDamageToEnemy({ ...state, enemyMitigation: { ...state.enemyMitigation, block: 6 } }, effect)
        .modifiedDamage,
    ).toBe(0);
  });

  it("applies Corrosive and Shatter to resource-based attack damage", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 3, block: 3, armor: 3 },
      enemyStatuses: { poison: 1 },
      enemyCC: { freezeSkipTurns: 1 },
      talentEffects: { poisonDamageBonusVsPoisoned: 1, freezeDamageBonusVsFrozen: 1 },
      rng: () => 0.99,
    });
    expect(
      computeCardDamageToEnemy(state, { kind: "damage", damageType: "holy", amount: 0, equalToForge: true })
        .modifiedDamage,
    ).toBe(5);
    expect(
      computeCardDamageToEnemy(state, { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true })
        .modifiedDamage,
    ).toBe(5);
  });

  it("makes Caustic remove resolved Poison damage from Armor on hits, ticks, and detonations", () => {
    const talentEffects = computeTalentEffects({ poison: ["poison-strip-armor"] });
    const direct = applyDamageStatuses(
      patchBattleState({ enemyMitigation: { armor: 10 }, talentEffects }),
      makeEffect("poison", 4) as Extract<BattleCardEffect, { kind: "damage" }>,
      4,
      [],
    );
    expect(direct.enemyMitigation.armor).toBe(6);

    const ticked = tickEnemyStatuses(
      patchBattleState({
        enemyStatuses: { poison: 4 },
        enemyMitigation: { armor: 10 },
        talentEffects,
        rng: () => 0.99,
      }),
      [],
    );
    expect(ticked.enemyMitigation.armor).toBe(5);

    const detonated = detonateEnemyStatuses(
      patchBattleState({
        enemyStatuses: { poison: 4 },
        enemyMitigation: { armor: 10 },
        talentEffects,
      }),
      ["poison"],
      [],
    );
    expect(detonated.enemyMitigation.armor).toBe(5);

    expect(
      applyDamageStatuses(
        patchBattleState({ enemyMitigation: { armor: 2 }, talentEffects }),
        makeEffect("poison", 0) as Extract<BattleCardEffect, { kind: "damage" }>,
        0,
        [],
      ).enemyMitigation.armor,
    ).toBe(2);
  });

  it("lets Paralytic Venom Stun from direct Poison, ticks, and detonations", () => {
    const talentEffects = { ...computeTalentEffects({ poison: ["poison-stun-chance"] }), poisonStunChance: 100 };
    const poisonCard = makeTestCard({ effects: [makeEffect("poison", 4)] });
    const direct = dealDamage(
      patchBattleState({ enemyHealth: 100, enemyMaxHealth: 100, talentEffects, rng: () => 0.99 }),
      poisonCard,
    );
    expect(direct.enemyStatuses.stun).toBe(4);

    const ticked = tickEnemyStatuses(
      patchBattleState({ enemyStatuses: { poison: 4 }, talentEffects, rng: () => 0.99 }),
      [],
    );
    expect(ticked.enemyStatuses.stun).toBe(4);

    const detonated = detonateEnemyStatuses(
      patchBattleState({ enemyStatuses: { poison: 4 }, talentEffects, rng: () => 0.99 }),
      ["poison"],
      [],
      "next-tick",
      tryPoisonStunProc,
    );
    expect(detonated.enemyStatuses.stun).toBe(4);
  });

  it.each([
    ["poison", "poisonCardPlayTwiceChance", "poison-first-free"],
    ["stun", "stunCardPlayTwiceChance", "stun-damage-1"],
  ] as const)("repeats %s cards once without a second payment", (_keyword, field, talentId) => {
    const card = makeTestCard({ effects: [makeEffect(_keyword, 4)] });
    const state = patchBattleState({
      mana: 10,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { ...computeTalentEffects({ [_keyword]: [talentId] }), [field]: 100 },
      rng: () => 0.99,
    });
    const next = playCard(state, card);

    expect(next.mana).toBe(9);
    expect(next.discard).toHaveLength(1);
    expect(next.enemyStatuses[_keyword]).toBe(8);
  });

  it("repeats the whole Wish card and caps mixed repeat chances at one extra play", () => {
    const wishCard = makeTestCard({
      effects: [
        { kind: "wish", amount: 1 },
        { kind: "gain-gold", amount: 2 },
      ],
    });
    const repeatedWish = playCard(
      patchBattleState({
        mana: 10,
        talentEffects: { wishCardPlayTwiceChance: 100 },
        rng: () => 0.99,
      }),
      wishCard,
    );
    expect(repeatedWish.mana).toBe(9);
    expect(repeatedWish.gold).toBe(4);
    expect(repeatedWish.wishOptions).toHaveLength(3);
    expect(repeatedWish.wishQueue).toHaveLength(1);

    const mixed = playCard(
      patchBattleState({
        mana: 10,
        talentEffects: {
          poisonCardPlayTwiceChance: 100,
          stunCardPlayTwiceChance: 100,
          wishCardPlayTwiceChance: 100,
        },
        rng: () => 0.99,
      }),
      makeTestCard({ tags: ["poison", "stun", "wish"], effects: [{ kind: "gain-gold", amount: 1 }] }),
    );
    expect(mixed.gold).toBe(2);
    expect(mixed.mana).toBe(9);
  });

  it("makes Insight roll per Wish and leaves Gear draws independent", () => {
    const drawn = makeTestCard({ id: "drawn" });
    const failed = applyWishEffect(
      patchBattleState({ deck: [drawn], talentEffects: { wishDrawChance: 10 }, rng: () => 0.99 }),
      makeTestCard({ id: "wish" }),
      1,
      [],
    );
    expect(failed.hand).toHaveLength(0);

    const succeeded = applyWishEffect(
      patchBattleState({ deck: [drawn], talentEffects: { wishDrawChance: 100 }, rng: () => 0.99 }),
      makeTestCard({ id: "wish" }),
      1,
      [],
    );
    expect(succeeded.hand.map((card) => card.id)).toEqual(["drawn"]);
  });

  it("keeps Powerful Wish upgrades active while the reworked Wish effects use new fields", () => {
    const state = patchBattleState({
      talentEffects: computeTalentEffects({ wish: ["wish-powerful"] }),
      rng: () => 0.99,
    });
    const options = buildWishOptions(state, makeTestCard({ id: "wish" }));
    expect(options.every((card) => card.descriptionLines.length > 0)).toBe(true);
  });

  it("retains deprecated Talent effects and pending Wish Mana in persisted battles", () => {
    const saved = JSON.parse(
      JSON.stringify(
        patchBattleState({
          flags: { pendingWishMana: 2 },
          talentEffects: {
            poisonPhysicalBonus: 2,
            poisonStripArmor: true,
            poisonCardPhysicalVsPoisoned: 1,
            wishExtraChoices: 1,
            wishDrawsCard: true,
            blockPerDeclinedWishCard: 1,
            manaNextTurnOnWish: 1,
          },
        }),
      ),
    );
    const restored = PersistedBattleStateSchema.parse(saved);

    expect(restored.flags.pendingWishMana).toBe(2);
    expect(restored.talentEffects.poisonPhysicalBonus).toBe(2);
    expect(restored.talentEffects.poisonStripArmor).toBe(true);
    expect(restored.talentEffects.poisonCardPhysicalVsPoisoned).toBe(1);
    expect(restored.talentEffects.wishExtraChoices).toBe(1);
    expect(restored.talentEffects.wishDrawsCard).toBe(true);
    expect(restored.talentEffects.blockPerDeclinedWishCard).toBe(1);
    expect(restored.talentEffects.manaNextTurnOnWish).toBe(1);
  });
});
