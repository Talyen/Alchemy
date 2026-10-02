import {
  keywordDefinitions,
  harmfulPlayerStatusIds,
  PLAYER_STATUS_DISPLAY_ORDER,
  ENEMY_STATUS_DISPLAY_ORDER,
  talentPool,
  getTalentTreeKeywordIds,
} from "@/lib/game-data";
import { ENEMY_STATUS_IDS_LIST } from "@/lib/validation";
import {
  COMBAT_ENCOUNTER_TRAIT_IDS,
  REWARD_ENCOUNTER_TRAIT_IDS,
  ENCOUNTER_TRAITS,
} from "../content-systems/encounter-traits";
import { EncounterTraitContentSchema } from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, type Collector } from "./utils";

export { validateTrinkets } from "./validators-cards";

const encounterTraitIdList: readonly string[] = [...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS];
const combatEncounterTraitIdSet = new Set<string>(COMBAT_ENCOUNTER_TRAIT_IDS);
const rewardEncounterTraitIdSet = new Set<string>(REWARD_ENCOUNTER_TRAIT_IDS);

export function validateTalents(collector: Collector): void {
  addDuplicateIssues(
    talentPool.map((talent) => talent.id),
    "talents",
    "talent id",
    collector.error,
  );

  const knownKeywords = new Set(Object.keys(keywordDefinitions));

  const treeKeywords = new Set(getTalentTreeKeywordIds());
  const countByKeyword = new Map<string, number>();
  for (const talent of talentPool) {
    if (!knownKeywords.has(talent.keywordId)) {
      collector.error("talents", talent.id, `References unknown keyword: ${talent.keywordId}`);
      continue;
    }
    countByKeyword.set(talent.keywordId, (countByKeyword.get(talent.keywordId) ?? 0) + 1);
  }
  for (const keyword of treeKeywords) {
    const count = countByKeyword.get(keyword) ?? 0;
    if (count < 1) {
      collector.error("talents", keyword, `Talent pool has no entries for tree keyword "${keyword}"`);
    }
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

function validateSingleEncounterTrait(
  trait: { id: string; enemyTrait: { id: string }; category: string; modes: readonly unknown[] },
  id: string,
  collector: Collector,
): void {
  collectSchemaIssues(EncounterTraitContentSchema, trait, "encounter-traits", id, collector.error);
  if (trait.id !== id)
    collector.error("encounter-traits", id, `Encounter trait record key does not match id ${trait.id}`);
  if (trait.enemyTrait.id !== id)
    collector.error("encounter-traits", id, "Encounter trait enemyTrait id does not match definition id");
  const idSet = trait.category === "combat" ? combatEncounterTraitIdSet : rewardEncounterTraitIdSet;
  if ((trait.category === "combat" || trait.category === "reward") && !idSet.has(trait.id))
    collector.error(
      "encounter-traits",
      id,
      `${trait.category === "combat" ? "Combat" : "Reward"} encounter trait is missing from ${trait.category} id list`,
    );
  if (trait.category === "reward" && trait.modes.length === 0)
    collector.error("encounter-traits", id, "Reward encounter trait has no compatible modes");
}

export function validateEncounterTraits(collector: Collector): void {
  const definitionIds = new Set(Object.keys(ENCOUNTER_TRAITS));
  const listedIds = new Set(encounterTraitIdList);
  addDuplicateIssues(encounterTraitIdList, "encounter-traits", "encounter trait id", collector.error);
  for (const id of listedIds) {
    if (!definitionIds.has(id)) collector.error("encounter-traits", id, "Encounter trait id is missing a definition");
  }
  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    validateSingleEncounterTrait(trait, id, collector);
    if (!listedIds.has(id))
      collector.error("encounter-traits", id, "Encounter trait definition is missing from id lists");
  }
}
