import { describe, expect, it } from "vitest";
import { cardById, companionLibrary } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

const { attack, battle, play } = uniqueGearBattle;

describe("reworked Gear triggers", () => {
  it("Emberforged gains Forge when a Mana Crystal loss ignites an enemy", () => {
    const initial = battle({
      mana: 5,
      maxMana: 5,
      talentEffects: { burnDamageOnManaCrystalLoss: 5 },
      gearEffects: { forgeOnBurnVsUnburned: 2 },
    });
    const crystalLoss = attack("physical", { cost: 0, effects: [{ kind: "lose-max-mana", amount: 1 }] });
    const ignited = play(initial, crystalLoss);
    const stillBurning = play(ignited, crystalLoss);

    expect(ignited.playerStatuses.forge).toBe(2);
    expect(ignited.enemyStatuses.burn).toBeGreaterThan(0);
    expect(stillBurning.playerStatuses.forge).toBe(2);
  });

  it("Red Harvest detonates Bleed on a damaging Physical Critical Hit", () => {
    const initial = battle({
      enemyStatuses: { bleed: 8 },
      gearEffects: { physicalCritDetonatesBleed: 1 },
      flags: { nextHitCrit: true },
    });
    const critical = play(initial, attack("physical"));
    const ordinary = play({ ...initial, flags: { ...initial.flags, nextHitCrit: false } }, attack("physical"));
    const blocked = play(
      { ...initial, enemyMitigation: { ...initial.enemyMitigation, block: 100 } },
      attack("physical"),
    );

    expect(critical.enemyStatuses.bleed).toBe(0);
    expect(ordinary.enemyStatuses.bleed).toBe(8);
    expect(blocked.enemyStatuses.bleed).toBe(8);
    expect(critical.enemyHealth).toBeLessThan(ordinary.enemyHealth);
  });

  it("Golden Verdict steals Gold only when Holy damage completes a Stun", () => {
    const initial = battle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 120 },
      gearEffects: { holyStunBuildupGold: 1 },
    });
    const holy = play(initial, attack("holy"));
    const stun = play(initial, attack("stun"));

    expect(holy.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(holy.gold).toBe(initial.gold + 1);
    expect(stun.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(stun.gold).toBe(initial.gold);
  });

  it("Huntsmaster’s Call draws an existing Companion card after an Archery Critical Hit", () => {
    const companionCard = cardById["wolf-companion"]!;
    const secondCompanion = cardById["bear-companion"]!;
    const initial = battle({
      deck: [companionCard, secondCompanion],
      gearEffects: { archeryCritDrawsCompanion: 1 },
      flags: { nextHitCrit: true },
    });
    const arrow = attack("physical", { tags: ["archery"] });
    const critical = play(initial, arrow);
    const ordinary = play({ ...initial, flags: { ...initial.flags, nextHitCrit: false } }, arrow);

    expect(critical.hand).toHaveLength(1);
    expect(critical.deck).toHaveLength(1);
    const secondArrow = { ...arrow, uid: 2 };
    const repeated = playBattleCardResolved(
      {
        ...critical,
        hand: [...critical.hand, secondArrow],
        flags: { ...critical.flags, nextHitCrit: true },
      },
      secondArrow.id,
      1,
    ).state;
    expect(repeated.hand.map((card) => card.id).sort()).toEqual([companionCard.id, secondCompanion.id].sort());
    expect(repeated.deck).toHaveLength(0);
    expect(ordinary.hand).toHaveLength(0);
    expect(ordinary.deck).toHaveLength(2);
  });

  it("Threefold Grace rolls on each damaging elemental hit and Burn tick", () => {
    const initial = battle({ mana: 0, gearEffects: { elementalDamageManaChance: 10 }, rng: () => 0.08 });
    const twoHits = attack("burn", {
      cost: 0,
      effects: [
        { kind: "damage", damageType: "burn", amount: 10 },
        { kind: "damage", damageType: "holy", amount: 10 },
      ],
    });
    const doubled = play(initial, twoHits);
    expect(doubled.enemyHealth).toBeLessThan(initial.enemyHealth);
    expect(doubled.mana).toBe(2);
    expect(play(initial, attack("physical", { cost: 0 })).mana).toBe(0);
    expect(play({ ...initial, rng: () => 0.99 }, twoHits).mana).toBe(0);
    expect(play({ ...initial, appliesFightPacing: true, turn: 20 }, attack("burn", { cost: 0 })).mana).toBe(1);

    const ticked = tickEnemyStatuses({ ...initial, enemyStatuses: { ...initial.enemyStatuses, burn: 5 } }, []);
    expect(ticked.mana).toBe(1);
    const companion = processCompanionTurnStart({ ...initial, activeCompanion: companionLibrary["frost-whelp"] }, []);
    expect(companion.mana).toBe(1);
  });
});
