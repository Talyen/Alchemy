import {
  keywordDefinitions,
  harmfulPlayerStatusIds,
  PLAYER_STATUS_DISPLAY_ORDER,
  ENEMY_STATUS_DISPLAY_ORDER,
  talentPool,
} from "@/lib/game-data";
import { ENEMY_STATUS_IDS_LIST } from "@/lib/validation";
import { ENCOUNTER_TRAITS } from "../content-systems/encounter-traits";
import { EncounterTraitContentSchema } from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, type Collector } from "./utils";

export { validateTrinkets } from "./validators-cards";

export function validateTalents(collector: Collector): void {
  addDuplicateIssues(
    talentPool.map((talent) => talent.id),
    "talents",
    "talent id",
    collector.error,
  );

  const knownKeywords = new Set(Object.keys(keywordDefinitions));

  for (const talent of talentPool) {
    if (!knownKeywords.has(talent.keywordId))
      collector.error("talents", talent.id, `References unknown keyword: ${talent.keywordId}`);
  }
}

function checkDuplicateDisplayOrder(collector: Collector): void {
  if (new Set(PLAYER_STATUS_DISPLAY_ORDER).size !== PLAYER_STATUS_DISPLAY_ORDER.length)
    collector.error("statuses", "player-display-order", "Player status display order contains duplicates");
  if (new Set(ENEMY_STATUS_DISPLAY_ORDER).size !== ENEMY_STATUS_DISPLAY_ORDER.length)
    collector.error("statuses", "enemy-display-order", "Enemy status display order contains duplicates");
}

export function validateKeywordsAndStatuses(collector: Collector): void {
  for (const [id, definition] of Object.entries(keywordDefinitions)) {
    if (definition.id !== id) collector.error("keywords", id, `Keyword record key does not match id ${definition.id}`);
    if (!definition.label || !definition.description || !definition.colorClass || !definition.borderClass)
      collector.error("keywords", id, "Keyword metadata has an empty display field");
  }
  // Harmful player statuses are shared combat effects, so each one must also
  // exist as an enemy status id.
  for (const status of harmfulPlayerStatusIds) {
    if (!ENEMY_STATUS_IDS_LIST.includes(status))
      collector.error("statuses", status, "Harmful player status is not a known harmful status id");
  }
  checkDuplicateDisplayOrder(collector);
}

export function validateEncounterTraits(collector: Collector): void {
  // ID lists derive from this catalog; schema validation owns shape and modes.
  // These cross-field checks protect the identity used to attach battle traits.
  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    collectSchemaIssues(EncounterTraitContentSchema, trait, "encounter-traits", id, collector.error);
    if (trait.id !== id)
      collector.error("encounter-traits", id, `Encounter trait record key does not match id ${trait.id}`);
    if (trait.enemyTrait.id !== id)
      collector.error("encounter-traits", id, "Encounter trait enemyTrait id does not match definition id");
  }
}
