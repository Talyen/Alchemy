import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { detonateEnemyStatuses, projectEnemyDotDamage } from "@/lib/battle/dot-resolve";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { cardById, companionLibrary, trinketById } from "@/lib/game-data";
import { getGearAffixTooltipEntries } from "@/lib/gear";
import { regressionBattle } from "../../fixtures/battle";

describe("triggered damage contracts", () => {
  it.each([
    {
      cardId: "bash",
      statuses: { stun: 49, poison: 1 },
      talents: { poisonDamageBonusVsPoisoned: 1 },
      trinket: { thunderstoneDamageOnStun: 6 },
      health: 89,
    },
    {
      cardId: "frostbolt",
      statuses: { freeze: 49 },
      talents: { freezeDamageBonusVsFrozen: 1 },
      trinket: { frozenHeartDamage: 6 },
      health: 90,
    },
  ])(
    "$cardId's control damage receives the matching vulnerability bonus",
    ({ cardId, statuses, talents, trinket, health }) => {
      const card = cardById[cardId]!;
      const state = regressionBattle({
        hand: [card],
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: statuses,
        talentEffects: talents,
        trinketEffects: trinket,
      });
      expect(playBattleCardResolved(state, card.id, 0).state.enemyHealth).toBe(health);
    },
  );

  it("Sundering Charm removes Armor before Icy Heart and derived Stun mitigation", () => {
    const card = cardById.frostbolt!;
    const state = regressionBattle({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { freeze: 49 },
      enemyMitigation: { armor: 8 },
      trinketEffects: { frozenHeartDamage: 6, sunderingArmorPiercing: 2 },
    });
    const frozen = playBattleCardResolved(state, card.id, 0).state;
    expect(frozen.enemyHealth).toBe(96);
    expect(frozen.enemyMitigation.armor).toBe(4);

    const stunned = resolveFollowUpHit(
      regressionBattle({ enemyMitigation: { armor: 2 }, trinketEffects: { sunderingArmorPiercing: 2 } }),
      { source: "talent-derived", damageType: "stun", amount: 2 },
      [],
    );
    expect(stunned.enemyHealth).toBe(28);
    expect(stunned.enemyMitigation.armor).toBe(0);

    const protectedEnemy = regressionBattle({
      enemyMitigation: { armor: 2, block: 10 },
      trinketEffects: { sunderingArmorPiercing: 2 },
    });
    const blocked = resolveFollowUpHit(protectedEnemy, { source: "talent-fixed", damageType: "stun", amount: 2 }, []);
    expect(blocked.enemyHealth).toBe(protectedEnemy.enemyHealth);
    expect(blocked.enemyMitigation).toMatchObject({ armor: 0, block: 8 });
    const roundedAway = resolveFollowUpHit(
      protectedEnemy,
      { source: "talent-derived", damageType: "stun", amount: 0.25 },
      [],
    );
    expect(roundedAway.enemyMitigation).toEqual(protectedEnemy.enemyMitigation);
  });

  it("Bleeding Out scales natural and projected Bleed ticks without increasing stacks", () => {
    const state = regressionBattle({
      playerHealth: 5,
      playerMaxHealth: 30,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 8 },
      talentEffects: { bleedDesperateMultiplier: 1.25 },
      gearEffects: { bleedDecaysByHalf: 1 },
    });
    const ticked = tickEnemyStatuses(state, []);
    expect(ticked.enemyHealth).toBe(90);
    expect(ticked.enemyStatuses.bleed).toBe(4);
    expect(projectEnemyDotDamage(state, "bleed", "remaining-ticks")).toBe(19);
    expect(detonateEnemyStatuses(state, ["bleed"], [], "remaining-ticks").enemyHealth).toBe(81);
    expect(projectEnemyDotDamage({ ...state, playerHealth: 15 }, "bleed", "remaining-ticks")).toBe(15);
    const sharedBurn = {
      ...state,
      enemyStatuses: { ...state.enemyStatuses, burn: 8, bleed: 0 },
      gearEffects: { ...state.gearEffects, sharedBurnBleedBonuses: 1 },
    };
    expect(tickEnemyStatuses(sharedBurn, []).enemyHealth).toBe(90);
    expect(projectEnemyDotDamage(sharedBurn, "burn", "remaining-ticks")).toBe(19);
  });

  it("Meteorite describes the card hit it doubles, while Companion Burn preserves it", () => {
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      activeCompanion: companionLibrary.phoenix,
      trinketEffects: { firstBurnDoubled: true },
    });
    const companion = processCompanionTurnStart(state, []);
    expect(companion.enemyHealth).toBe(99);
    expect(companion.flags.firstBurnTrinketDoubledUsed).toBe(false);
    const card = cardById.fireball!;
    const played = playBattleCardResolved({ ...companion, hand: [card] }, card.id, 0).state;
    expect(played.enemyHealth).toBe(95);
    expect(trinketById.meteorite!.descriptionLines.join(" ")).toContain("Burn card hit");
  });

  it("Consume Gear describes its Companion-summon exception", () => {
    const card = cardById["wolf-companion"]!;
    const state = regressionBattle({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: 4 },
      gearEffects: { armorOnConsume: 2, poisonTickOnConsume: 1 },
    });
    const summoned = playBattleCardResolved(state, card.id, 0).state;
    expect(summoned.exhausted).toContainEqual(card);
    expect(summoned.playerStatuses.armor).toBe(0);
    expect(summoned.enemyHealth).toBe(100);
    const entries = getGearAffixTooltipEntries([
      { id: "armor-on-consume", value: 2 },
      { id: "poison-tick-on-consume", value: 1 },
    ]);
    for (const entry of entries) expect(entry.text).toContain("except Companion summons");
  });
});
