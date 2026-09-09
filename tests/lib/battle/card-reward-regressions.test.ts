import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, companionLibrary } from "@/lib/game-data";
import { dealDamage, incomingPhysical, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("card reward interactions", () => {
  it("Whistle makes an automatically summoned Companion act immediately", () => {
    const summon = makeTestCard({ effects: [{ kind: "summon-companion", companionId: "mana-moth" }] });
    const result = applyEnemyAbility(
      incomingPhysical({
        deck: [summon],
        mana: 3,
        maxMana: 3,
        gearEffects: { dodgeDrawAndPlay: 1 },
        talentEffects: { companionActsOnCard: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(result.activeCompanion).toEqual(companionLibrary["mana-moth"]);
    expect(result.mana).toBe(4);
  });

  it("Photosynthesis heals for an automatically played Nature card", () => {
    const nature = makeTestCard({ effects: [{ kind: "damage", damageType: "nature", amount: 2 }] });
    const result = applyEnemyAbility(
      incomingPhysical({
        deck: [nature],
        playerHealth: 50,
        gearEffects: { dodgeDrawAndPlay: 1 },
        talentEffects: { healOnNatureCard: 1 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(result.enemyHealth).toBe(98);
    expect(result.playerHealth).toBe(51);
  });

  it("Mortar and Pestle deals Poison for an automatically used Potion", () => {
    const result = applyEnemyAbility(
      incomingPhysical({
        deck: [cardById["health-potion"]!],
        gearEffects: { dodgeDrawAndPlay: 1 },
        trinketEffects: { mortarPestlePoisonOnPotionUse: 1 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyStatuses.poison).toBe(1);
    expect(result.exhausted.map((card) => card.id)).toEqual(["health-potion"]);
  });

  it("Blessed Leech receives Sanguine once without spending Deep Siphon", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: () => 0.99,
      talentEffects: { holyLifestealPercent: 10, cardLeechBonusPercent: 25 },
      gearEffects: { leechHealBonusPercent: 50 },
    });
    const result = dealDamage(state, makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 20 }] }));
    expect(result.playerHealth).toBe(13);
  });

  it.each(["unique", "encounter"] as const)(
    "preserves Divine Favor when %s already makes the Holy card free",
    (source) => {
      const card = makeTestCard({
        cost: 1,
        consume: true,
        effects: [{ kind: "damage", damageType: "holy", amount: 2 }],
      });
      const state = patchBattleState({
        hand: [card],
        mana: 0,
        flags: { nextHolyCardFree: true },
        gearEffects: { firstElementalCardsFree: source === "unique" ? 1 : 0 },
        encounterBenefits: source === "encounter" ? ["fleeting"] : [],
      });
      const result = playBattleCardResolved(state, card.id, 0).state;
      expect(result.exhausted).toHaveLength(1);
      expect(result.flags.nextHolyCardFree).toBe(true);
      const second = { ...card, uid: result.nextCardUid };
      const next = playBattleCardResolved({ ...result, hand: [second], encounterBenefits: [] }, second.id, 0).state;
      expect(next.exhausted).toHaveLength(2);
      expect(next.flags.nextHolyCardFree).toBe(false);
    },
  );
});
