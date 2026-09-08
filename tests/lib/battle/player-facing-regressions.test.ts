import { describe, expect, it } from "vitest";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { getEnemyDamageMultiplier } from "@/lib/battle/status-helpers";
import { buildWishOptions } from "@/lib/battle/wish";
import { computeCardPayment } from "@/lib/battle/card-cost-rules";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { companionLibrary } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";

const library = getOfferableCardPool();

function libraryCard(id: string) {
  const card = library.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`Missing card ${id}`);
  return card;
}

describe("player-facing combat regressions", () => {
  it.each([0, 1])("Wellspring checks the %s Mana left before Mana Moth acts on Dodge", (mana) => {
    const state = patchBattleState({
      rng: () => 0.01,
      mana,
      activeCompanion: companionLibrary["mana-moth"],
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
      talentEffects: { wellspringKeepMana: 1, companionAttacksOnDodge: true },
    });
    const result = endPlayerTurn(state).state;
    expect(result.playerDodgeCount).toBe(1);
    expect(result.mana).toBe(state.maxMana + mana);
  });

  it.each(["stun", "freeze"] as const)("keeps %s vulnerability talents against resistant enemies", (status) => {
    const state = patchBattleState({
      rng: () => 0.99,
      currentEnemy: { traits: [{ id: "burn-resistance", title: "Resistant", description: "" }] },
      enemyCC: { stunSkipTurns: status === "stun" ? 1 : 0, freezeSkipTurns: status === "freeze" ? 1 : 0 },
      talentEffects: { stunDoubleDamage: true, freezeDoubleDamage: true },
    });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(1);
    const result = dealDamage(state, makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 6 }] }));
    expect(result.enemyHealth).toBe(state.enemyHealth - 6);
  });

  it.each([{ equalToBlock: true }, { equalToArmor: true }, { equalToGoldPercent: 50 }])(
    "adds Opening to resource-based attacks: %j",
    (scaling) => {
      const state = patchBattleState({
        rng: () => 0.99,
        playerStatuses: { block: 6, armor: 6 },
        gold: 12,
        flags: { nextHitPhysicalBonus: 4 },
      });
      const result = dealDamage(
        state,
        makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0, ...scaling }] }),
      );
      expect(result.enemyHealth).toBe(state.enemyHealth - 10);
      expect(result.flags.nextHitPhysicalBonus).toBe(0);
    },
  );

  it("upgrades both turns of Ray of Frost from Powerful Wish without mutating the library", () => {
    const original = libraryCard("ray-of-frost");
    const state = patchBattleState({ talentEffects: { wishCardsUpgraded: true, wishExtraChoices: library.length } });
    const upgraded = buildWishOptions(state, makeTestCard({ id: "wish-source" })).find(
      (card) => card.id === original.id,
    );
    expect(upgraded?.descriptionLines).toEqual([
      "Deal 2 Freeze damage",
      "Deal 4 Freeze damage at the start of your next turn",
    ]);
    expect(upgraded?.effects).toEqual([
      { kind: "damage", damageType: "freeze", amount: 2 },
      { kind: "repeat-over-turns", remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 4 }] },
    ]);
    expect(original.effects[0]).toMatchObject({ amount: 1 });
    expect(original.effects[1]).toMatchObject({ effects: [{ amount: 3 }] });
  });

  it("allows Astral Arrow to use Winter's Block payment for its Freeze damage pool", () => {
    const state = patchBattleState({
      mana: 0,
      playerStatuses: { block: 100 },
      gearEffects: { blockPaysFreezeMana: 1 },
    });
    expect(computeCardPayment(state, libraryCard("astral-arrow"))).toMatchObject({ affordable: true });
  });

  it("keeps ordinary companion Forge rules without Bonded and leaves hero Burn unchanged", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      activeCompanion: companionLibrary.wolf,
      playerStatuses: { forge: 4 },
    });
    const companion = processCompanionTurnStart(state, []);
    expect(companion.enemyHealth).toBe(state.enemyHealth - 1);
    expect(companion.playerStatuses.forge).toBe(4);
    const hero = dealDamage(
      { ...state, gearEffects: { ...state.gearEffects, companionBenefitsFromForge: 1 } },
      libraryCard("fireball"),
    );
    const ordinaryHero = dealDamage(state, libraryCard("fireball"));
    expect(hero.enemyHealth).toBe(ordinaryHero.enemyHealth);
    expect(hero.playerStatuses.forge).toBe(4);
  });

  it.each([0.01, 0.99])("Bonded spends no Forge on dodged or fully blocked attacks (%s)", (roll) => {
    const state = patchBattleState({
      rng: () => roll,
      activeCompanion: companionLibrary.wolf,
      playerStatuses: { forge: 4 },
      enemyMitigation: { block: 100 },
      gearEffects: { companionBenefitsFromForge: 1 },
    });
    const result = processCompanionTurnStart(state, []);
    expect(result.enemyHealth).toBe(state.enemyHealth);
    expect(result.playerStatuses.forge).toBe(4);
  });

  it.each(["bear", "wolf", "phoenix"] as const)("Bonded adds Forge exactly once to %s", (id) => {
    const state = patchBattleState({
      rng: () => 0.99,
      activeCompanion: companionLibrary[id],
      playerStatuses: { forge: 4 },
      gearEffects: { companionBenefitsFromForge: 1 },
    });
    const result = processCompanionTurnStart(state, []);
    expect(result.enemyHealth).toBe(state.enemyHealth - 5);
    expect(result.playerStatuses.forge).toBe(3);
  });
});
