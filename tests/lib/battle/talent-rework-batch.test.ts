import { describe, expect, it } from "vitest";
import { companionLibrary, computeTalentEffects } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { checkHealthThresholds } from "@/lib/battle/status-player";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { patchBattleState } from "../../fixtures/battle";

describe("Talent rework batch", () => {
  it("Desperate Guard grants Block only on the first surviving half-Health crossing", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      talentEffects: computeTalentEffects({ health: ["health-threshold-block"] }),
    });

    const first = checkHealthThresholds(20, 19, state, []);
    const second = checkHealthThresholds(21, 19, { ...first, playerHealth: 21 }, []);

    expect(first.playerStatuses.block).toBe(6);
    expect(second.playerStatuses.block).toBe(6);
    expect(first.flags.desperateGuardUsed).toBe(true);
  });

  it.each([
    ["burn", "mana-manaburn"],
    ["freeze", "mana-arcane-frost"],
  ] as const)("%s scaling uses current Mana", (damageType, talentId) => {
    const state = patchBattleState({
      mana: 2,
      maxMana: 10,
      talentEffects: computeTalentEffects({ mana: [talentId] }),
    });
    const effect = { kind: "damage" as const, damageType, amount: 10 };

    expect(computeCardDamageToEnemy(state, effect).modifiedDamage).toBe(11);
  });

  it("Familiar Bond rolls once for each positive Companion damage packet", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      mana: 0,
      maxMana: 4,
      rng: () => 0.05,
      talentEffects: computeTalentEffects({ mana: ["mana-familiar-bond"] }),
    });

    expect(processCompanionTurnStart(state, []).mana).toBe(1);
  });
});
