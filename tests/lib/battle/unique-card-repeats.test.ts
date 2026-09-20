import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { addPlayerStatus } from "@/lib/battle/types";
import { repeatUniqueCardDamage } from "@/lib/battle/unique-card-effects";
import { companionLibrary } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("Unique Gear unique card repeats", () => {
  const { battle, attack, play } = uniqueGearBattle;

  it("Everkeen repeats damage without repeating utility or preparing itself again", () => {
    const card = attack("physical", {
      effects: [
        { kind: "damage", damageType: "physical", amount: 10 },
        { kind: "damage", damageType: "burn", amount: 10 },
        { kind: "restore-mana", amount: 1 },
      ],
    });
    const charged = addPlayerStatus(
      battle({ gearEffects: { forgeReadiesPhysicalRepeat: 1, forgeOnBurnDealt: 2 } }),
      "forge",
      4,
    );
    const result = play(charged, card);
    expect(result.mana).toBe(9);
    expect(result.enemyHealth).toBeLessThan(960);
    expect(result.uniqueGear.everkeenReady).toBe(true);
    const second = play(result, attack("physical"));
    expect(second.uniqueGear.everkeenReady).toBe(false);
    expect(second.enemyHealth).toBeLessThan(result.enemyHealth - 20);
  });

  it("Huntsmaster repeats Companion damage but not Mana restoration, once per turn", () => {
    const companion = {
      ...companionLibrary.wolf!,
      turnStartEffects: [
        { kind: "damage" as const, damageType: "nature" as const, amount: 7 },
        { kind: "restore-mana" as const, amount: 5 },
      ],
    };
    const state = battle({ gearEffects: { firstArcheryCompanionAttack: 1 }, activeCompanion: companion });
    const card = attack("physical", { tags: ["archery"] });
    const result = play(state, card);
    expect(result.enemyHealth).toBe(983);
    expect(result.mana).toBe(8);
    expect(play(result, card).enemyHealth).toBe(973);
  });

  it("Returning Gale repeats actual damage effects next turn without repeating utility or echoing forever", () => {
    const card = attack("physical", {
      tags: ["archery"],
      effects: [
        { kind: "damage", damageType: "physical", amount: 10 },
        { kind: "restore-mana", amount: 1 },
      ],
    });
    const state = play(battle({ gearEffects: { archeryEchoNextTurn: 1 } }), card);
    expect(state.uniqueGear.archeryEchoes).toHaveLength(1);
    expect(state.mana).toBe(9);
    const next = advanceToPlayerTurn(state);
    expect(next.enemyHealth).toBe(985);
    expect(next.uniqueGear.archeryEchoes).toHaveLength(0);
    expect(next.mana).toBe(10);
    expect(advanceToPlayerTurn(next).enemyHealth).toBe(985);
  });

  it("Final Spark requires spending the last Mana and only repeats damage once per turn", () => {
    const card = attack("burn");
    const state = play(battle({ mana: 2, gearEffects: { lastManaElementalRepeat: 1 } }), card);
    expect(state.enemyHealth).toBe(980);
    expect(state.uniqueGear.finalSparkUsed).toBe(true);
    expect(play({ ...state, mana: 2 }, card).enemyHealth).toBe(970);
    const free = play(battle({ mana: 0, gearEffects: { lastManaElementalRepeat: 1 } }), attack("burn", { cost: 0 }));
    expect(free.enemyHealth).toBe(990);
    expect(free.uniqueGear.finalSparkUsed).toBe(false);
  });

  it("damage repeats do not apply Potion potency twice", () => {
    // The card id is what flags Distillation/potency eligibility (explicit
    // Potion list, not a name rule), so this synthetic attack borrows a real
    // Potion id to exercise the potency path.
    const result = play(
      battle({ mana: 2, gearEffects: { lastManaElementalRepeat: 1 }, talentEffects: { potionPotency: 2 } }),
      attack("burn", { id: "acid-potion" }),
    );
    expect(result.enemyHealth).toBe(960);
  });

  it("Forge earned by a damage repeat cannot prepare another Everkeen repeat", () => {
    const result = repeatUniqueCardDamage(
      battle({
        gearEffects: { forgeReadiesPhysicalRepeat: 1 },
        talentEffects: { forgeOnBurnDealt: 2 },
      }),
      attack("burn"),
      [],
    );
    expect(result.playerStatuses.forge).toBe(2);
    expect(result.uniqueGear.everkeenReady).toBe(false);
    expect(result.flags.uniqueRepeatActive).toBe(false);
  });
});
