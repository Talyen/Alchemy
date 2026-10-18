import { companionLibrary, enemyBestiary, ENEMY_TYPE_VALUES, findEnemyAbilityCard } from "@/lib/game-data";
import { collectUncoveredEnemyTraitIds } from "../content-systems/enemy-trait-coverage";
import { validateEnemyTraitDescriptionParity } from "./card-parity/enemy-trait-parity";
import { CompanionContentSchema, EnemyContentSchema } from "./schemas";
import { validateLibraryBasics, type Collector } from "./utils";

export function validateEnemies(collector: Collector): void {
  validateLibraryBasics(collector, {
    area: "enemies",
    items: enemyBestiary,
    schema: EnemyContentSchema,
    titleOf: (enemy) => enemy.title,
    artOf: (enemy) => enemy.art,
    idLabel: "enemy id",
  });

  const coveredEnemyTypes = new Set(enemyBestiary.map((enemy) => enemy.enemyType));

  for (const enemyType of ENEMY_TYPE_VALUES) {
    if (!coveredEnemyTypes.has(enemyType)) {
      collector.error("enemies", enemyType, `Enemy pool is missing type: ${enemyType}`);
    }
  }

  for (const enemy of enemyBestiary) {
    for (const id of enemy.abilityIds) {
      if (!findEnemyAbilityCard(id)) collector.error("enemies", enemy.id, `Unsupported enemy ability: ${id}`);
    }
    for (const issue of validateEnemyTraitDescriptionParity(enemy)) collector.issues.push(issue);
  }

  const bestiaryTraitIds = enemyBestiary.flatMap((enemy) => enemy.traits.map((trait) => trait.id));
  for (const traitId of collectUncoveredEnemyTraitIds(bestiaryTraitIds)) {
    collector.error("enemies", traitId, "Enemy trait has no runtime handler or reaction coverage");
  }
}

export function validateCompanions(collector: Collector): void {
  validateLibraryBasics(collector, {
    area: "companions",
    items: Object.values(companionLibrary),
    schema: CompanionContentSchema,
    artOf: (companion) => companion.art,
    idLabel: "companion id",
  });
  for (const [id, companion] of Object.entries(companionLibrary)) {
    if (companion.id !== id) {
      collector.error("companions", id, `Companion record key does not match id ${companion.id}`);
    }
  }
}
