import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { addPlayerStatus } from "@/lib/battle/types";
import { repeatUniqueCardDamage } from "@/lib/battle/unique-card-effects";
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
      battle({ gearEffects: { forgeReadiesPhysicalRepeat: 1, forgeOnBurnVsUnburned: 2 } }),
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
    // Distillation requires a Potion from the explicit list and Consume.
    const result = play(
      battle({ mana: 2, gearEffects: { lastManaElementalRepeat: 1 }, talentEffects: { potionPotency: 2 } }),
      attack("burn", { id: "acid-potion", consume: true }),
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
