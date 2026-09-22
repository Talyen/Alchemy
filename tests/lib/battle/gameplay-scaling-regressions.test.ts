import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { buildWishOptions } from "@/lib/battle/wish";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processArcheryEchoes } from "@/lib/battle/unique-card-effects";
import { tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("gameplay scaling regressions", () => {
  it("Powerful Wish improves Blood Offering without increasing its Health cost", () => {
    const offers = buildWishOptions(
      patchBattleState({
        talentEffects: { wishCardsUpgraded: true, wishExtraChoices: 200 },
        rng: () => 0.99,
      }),
      undefined,
    );
    const offering = offers.find((card) => card.id === "blood-offering");
    expect(offering?.effects).toEqual([
      { kind: "lose-health", amount: 1 },
      { kind: "draw-cards", amount: 3 },
    ]);
    expect(offers.find((card) => card.id === "exorcism")?.effects[0]).toEqual(cardById.exorcism!.effects[0]);
    expect(offers.find((card) => card.id === "cauterize")?.effects).toEqual(cardById.cauterize!.effects);
  });

  it("Aetherward protects typed self-damage while Health costs still apply", () => {
    const state = patchBattleState({
      playerHealth: 40,
      playerMaxHealth: 40,
      mana: 2,
      gearEffects: { damageReductionPerMana: 2 },
    });
    expect(dealSelfDamage(state, 6, "burn", []).healthLost).toBe(2);
    expect(dealSelfDamage(state, 6, "health", []).healthLost).toBe(6);
  });

  it("Returning Gale carries Follow-through into its half-damage echo", () => {
    const arrow = makeTestCard({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const state = patchBattleState({
      hand: [arrow],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { archerySecondCardDamage: 1 },
      flags: { archeryCardsPlayedThisTurn: 1 },
      gearEffects: { archeryEchoNextTurn: 1 },
      rng: () => 0.99,
    });
    const played = playBattleCardResolved(state, arrow.id, 0).state;
    expect(played.enemyHealth).toBe(95);
    expect(processArcheryEchoes(played, []).enemyHealth).toBe(92);
  });

  it.each(["burn", "poison", "bleed"] as const)("Aetherward reduces %s ticks using unspent Mana", (status) => {
    const state = patchBattleState({
      playerHealth: 40,
      playerMaxHealth: 40,
      mana: 2,
      playerStatuses: { [status]: 10 },
      gearEffects: { damageReductionPerMana: 2 },
    });
    expect(tickPlayerStatuses(state, []).playerHealth).toBe(34);
    expect(tickPlayerStatuses({ ...state, mana: 0 }, []).playerHealth).toBe(30);
  });

  it.each(["burn", "poison", "bleed"] as const)("Frigid increases %s ticks and detonations while Frozen", (status) => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { [status]: 10 },
      enemyCC: { freezeSkipTurns: 1 },
      gearEffects: { frozenEnemyDamageBonusPercent: 100 },
      rng: () => 0.99,
    });
    expect(tickEnemyStatuses(state, []).enemyHealth).toBe(80);
    expect(detonateEnemyStatuses(state, [status], []).enemyHealth).toBe(80);
  });

  it.each(["burning-blade", "shield-bash"])("enemy %s respects the difficulty damage multiplier", (id) => {
    const state = patchBattleState({
      playerHealth: 100,
      playerMaxHealth: 100,
      roomScalingMultiplier: 1.07,
      enemyMitigation: { forge: 9, block: 18 },
      rng: () => 0.99,
    });
    const normal = applyEnemyAbility(state, cardById[id]!, []);
    const harder = applyEnemyAbility(
      {
        ...state,
        difficultyModifiers: [{ kind: "enemy-damage-multiplier", amount: 2 }],
      },
      cardById[id]!,
      [],
    );
    // Shield Bash's separate Forge bonus retains its existing treatment.
    const forgeBonus = id === "shield-bash" ? state.enemyMitigation.forge : 0;
    expect(100 - harder.playerHealth - forgeBonus).toBe(2 * (100 - normal.playerHealth - forgeBonus));
  });
});
