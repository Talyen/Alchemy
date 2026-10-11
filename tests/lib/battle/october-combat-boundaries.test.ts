import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { patchBattleState } from "../../fixtures/battle";

describe("current combat boundaries", () => {
  it("Sniff Out receives Archery damage bonuses and Trophy Shot's kill reward", () => {
    const card = cardById["sniff-out"]!;
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 4,
      enemyMaxHealth: 40,
      rng: () => 0.99,
      gearEffects: { flatArrowDamage: 2 },
      talentEffects: computeTalentEffects({ archery: ["archery-hail", "archery-trophy-shot"] }),
      flags: { archeryCardsPlayedThisTurn: 1 },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(0);
    expect(result.gold - state.gold).toBe(2);
    expect(result.flags.nextArcheryCardFree).toBe(true);
  });

  it.each(["burn", "bleed"] as const)("%s ticks apply resistance before elemental Armor", (status) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { [status]: 10, armor: 5 },
      talentEffects: { armorMitigatesBurn: true, armorMitigatesBleed: true },
      gearEffects: { resistBurn: 50, resistBleed: 50 },
    });
    const next = tickPlayerStatuses(state, []);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.armor).toBe(5);
  });

  it.each(["burn", "bleed"] as const)("typed %s self-damage applies resistance before elemental Armor", (status) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { armor: 5 },
      talentEffects: { armorMitigatesBurn: true, armorMitigatesBleed: true },
      gearEffects: { resistBurn: 50, resistBleed: 50 },
    });
    const next = dealSelfDamage(state, 10, status, []);
    expect(next.healthLost).toBe(0);
    expect(next.state.playerStatuses.armor).toBe(5);
  });
});
