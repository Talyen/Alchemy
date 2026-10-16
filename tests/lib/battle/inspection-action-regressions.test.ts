import { describe, expect, it, vi } from "vitest";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, companionLibrary, type BattleCard } from "@/lib/game-data";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { regressionBattle, type BattleStatePatch } from "../../fixtures/battle";

function secondary(id: string, type: "burn" | "poison") {
  return getCorruptionMutationGroups(cardById[id]!)
    .find((group) => group.kind === "secondary")!
    .mutations.find(({ card }) => card.effects.some((e) => e.kind === "damage" && e.damageType === type))!.card;
}
function inspect(card: BattleCard, patch: BattleStatePatch) {
  const rng = vi.fn(() => 0.99);
  const state = regressionBattle({
    hand: [card],
    mana: 3,
    maxMana: 3,
    playerHealth: 10,
    playerMaxHealth: 20,
    enemyHealth: 20,
    enemyMaxHealth: 20,
    ...patch,
    rng,
  });
  const original = JSON.stringify(state);
  const preview = getBattleDamageInspectionCard(card, state);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify(state)).toBe(original);
  const played = playBattleCardResolved(state, card.id, 0);
  expect(played.state.cardsPlayedThisTurn).toBe(state.cardsPlayedThisTurn + 1);
  return { preview, played };
}

describe("inspection includes nested action outcomes", () => {
  it("Burning Wish can defeat the enemy before the corrupted card's Poison hit", () => {
    const { preview, played } = inspect(secondary("wish", "poison"), {
      enemyHealth: 1,
      talentEffects: { burnOnWish: 1 },
    });
    expect(played.combatTexts.some((t) => t.kind === "damage" && t.target === "enemy" && t.stat === "poison")).toBe(
      false,
    );
    expect(preview.effects[1]).toMatchObject({ kind: "damage", amount: 0 });
  });
  it("Starfall Freezes the enemy before the corrupted card's Burn hit", () => {
    const { preview, played } = inspect(secondary("wish", "burn"), {
      enemyHealth: 8,
      gearEffects: { freezeOnWish: 4, frozenEnemyDamageBonusPercent: 100 },
    });
    const burn = played.combatTexts.find((t) => t.target === "enemy" && t.kind === "damage" && t.stat === "burn");
    expect(played.state.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(burn).toMatchObject({ amount: 2 });
    expect(preview.effects[1]).toMatchObject({ kind: "damage", amount: 2 });
  });
  it.each(["lizard-scout", "wolf"] as const)(
    "a commanded %s defeats the enemy before corrupted Porcupine Quill hits",
    (id) => {
      const { preview, played } = inspect(secondary("porcupine-quill", "burn"), {
        enemyHealth: 1,
        activeCompanion: companionLibrary[id],
      });
      expect(played.combatTexts.some((t) => t.kind === "damage" && t.target === "enemy" && t.stat === "burn")).toBe(
        false,
      );
      expect(preview.effects[2]).toMatchObject({ kind: "damage", amount: 0 });
    },
  );
  it("Emberwake can defeat the enemy during Exorcism's self damage", () => {
    const { preview, played } = inspect(cardById.exorcism!, {
      enemyHealth: 1,
      playerHealth: 1,
      playerStatuses: { burn: 1 },
      gearEffects: { burnOnDeathsDoorEntry: 2 },
    });
    expect(played.state.deathsDoorActive).toBe(true);
    expect(played.combatTexts.some((t) => t.kind === "damage" && t.target === "enemy" && t.stat === "holy")).toBe(
      false,
    );
    expect(preview.effects[2]).toMatchObject({ kind: "damage", amount: 0 });
  });
  it("Predator's Focus grants Leech to its corrupted follow-up hit", () => {
    const { preview, played } = inspect(secondary("predators-focus", "burn"), {});
    expect(played.combatTexts.some((t) => t.target === "player" && t.kind === "heal")).toBe(true);
    expect(preview.effects[2]).toMatchObject({ kind: "damage", lifesteal: true });
  });
});
