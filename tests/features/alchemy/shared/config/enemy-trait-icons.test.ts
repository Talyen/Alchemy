import { describe, expect, it } from "vitest";
import { getEncounterTraitPresentation } from "@/features/alchemy/shared/config/encounter-trait-presentation";
import { getEnemyTraitIcon } from "@/features/alchemy/shared/config/enemy-trait-icons";
import { ENCOUNTER_TRAITS, eligibleEncounterTraitIds } from "@/lib/content-systems/encounter-traits";
import { areLabyrinthTraitsCompatible, isLabyrinthTraitEligible } from "@/lib/content-systems/labyrinth/modifiers";
import { enemyBestiary, type EnemyTrait } from "@/lib/game-data";

function expectDistinctIcons(enemy: string, traits: readonly EnemyTrait[]) {
  const icons = traits.map((trait) => getEncounterTraitPresentation(trait.id)?.Icon ?? getEnemyTraitIcon(trait));
  expect(new Set(icons).size, `${enemy}: ${traits.map((trait) => trait.title).join(", ")}`).toBe(traits.length);
}

describe("enemy trait icons", () => {
  it("distinguishes every native trait on each bestiary enemy", () => {
    for (const enemy of enemyBestiary) expectDistinctIcons(enemy.title, enemy.traits);
  });

  it("distinguishes native traits and every permitted encounter modifier combination", () => {
    for (const enemy of enemyBestiary) {
      const nodeType = enemy.enemyType === "normal" ? "combat" : enemy.enemyType;
      const pool = eligibleEncounterTraitIds("labyrinth", "combat").filter(
        (id) =>
          isLabyrinthTraitEligible(id, nodeType) &&
          enemy.traits.every((trait) => areLabyrinthTraitsCompatible(id, trait.id)),
      );
      for (const [index, id] of pool.entries()) {
        const traits = [...enemy.traits, ENCOUNTER_TRAITS[id].enemyTrait];
        expectDistinctIcons(enemy.title, traits);
        if (nodeType === "combat") continue;
        for (const other of pool.slice(index + 1)) {
          if (areLabyrinthTraitsCompatible(id, other))
            expectDistinctIcons(enemy.title, [...traits, ENCOUNTER_TRAITS[other].enemyTrait]);
        }
      }
      if (enemy.enemyType !== "boss") continue;
      for (const id of eligibleEncounterTraitIds("wildwood", "combat"))
        expectDistinctIcons(enemy.title, [...enemy.traits, ENCOUNTER_TRAITS[id].enemyTrait]);
    }
  });
});
