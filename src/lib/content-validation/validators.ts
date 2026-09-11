import type { ZodType } from "zod";
import { findEnemyAbilityCard } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import {
  cardLibrary,
  companionLibrary,
  enemyBestiary,
  trinketLibrary,
  keywordDefinitions,
  harmfulPlayerStatusIds,
  PLAYER_STATUS_DISPLAY_ORDER,
  ENEMY_STATUS_DISPLAY_ORDER,
  talentPool,
  getTalentTreeKeywordIds,
  type BattleCard,
} from "@/lib/game-data";
import { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "@/lib/battle";
import {
  COMBAT_ENCOUNTER_TRAIT_IDS,
  REWARD_ENCOUNTER_TRAIT_IDS,
  ENCOUNTER_TRAITS,
} from "../content-systems/encounter-traits";
import {
  flattenEffects,
  validateCardDescriptionParity,
  validateEnemyTraitDescriptionParity,
  validateTrinketDescriptionParity,
} from "./card-parity";
import {
  CardContentSchema,
  EnemyContentSchema,
  CompanionContentSchema,
  TrinketContentSchema,
  EncounterTraitContentSchema,
  enemyTypes,
  enemyStatusIds,
} from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, validateArt } from "./utils";
import type { createCollector } from "./utils";
import type { ContentValidationArea } from "./types";

type Collector = ReturnType<typeof createCollector>;

interface LibraryBasicsOptions<T extends { id: string }> {
  area: ContentValidationArea;
  items: readonly T[];
  schema: ZodType;
  titleOf?: (item: T) => string;
  artOf?: (item: T) => string;
  idLabel: string;
}

// Shared duplicate + schema + art triplet for library validators. Bespoke
// checks (offer pools, ability coverage, parity, affix pools) stay inline.
function validateLibraryBasics<T extends { id: string }>(
  collector: Collector,
  { area, items, schema, titleOf, artOf, idLabel }: LibraryBasicsOptions<T>,
): void {
  addDuplicateIssues(
    items.map((item) => item.id),
    area,
    idLabel,
    collector.error,
  );
  if (titleOf) {
    addDuplicateIssues(
      items.map((item) => titleOf(item)),
      area,
      "title",
      collector.error,
    );
  }
  for (const item of items) {
    collectSchemaIssues(schema, item, area, item.id, collector.error);
    if (artOf) validateArt(area, item.id, artOf(item), collector.error, collector.warning);
  }
}

const encounterTraitIdList: readonly string[] = [...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS];
const combatEncounterTraitIdSet = new Set<string>(COMBAT_ENCOUNTER_TRAIT_IDS);
const rewardEncounterTraitIdSet = new Set<string>(REWARD_ENCOUNTER_TRAIT_IDS);

function validateCardOffers(card: BattleCard, offerableIds: Set<string>, collector: Collector): void {
  if (card.excludeFromOfferPool && offerableIds.has(card.id))
    collector.error("rewards", card.id, "Card is excluded from offer pool but was found in offerable card pool");
  if (!card.excludeFromOfferPool && !offerableIds.has(card.id))
    collector.error("rewards", card.id, "Library card is missing from offerable card pool");
}

export function validateCards(collector: Collector): void {
  validateLibraryBasics(collector, {
    area: "cards",
    items: cardLibrary,
    schema: CardContentSchema,
    titleOf: (card) => card.title,
    artOf: (card) => card.art,
    idLabel: "card id",
  });

  const companionIds = new Set(Object.keys(companionLibrary));
  const offerableIds = new Set(getOfferableCardPool().map((card) => card.id));
  for (const card of cardLibrary) {
    for (const issue of validateCardDescriptionParity(card)) collector.issues.push(issue);
    for (const effect of flattenEffects(card.effects)) {
      if (effect.kind === "summon-companion" && !companionIds.has(effect.companionId)) {
        collector.error("cards", card.id, `References unknown companion: ${effect.companionId}`);
      }
    }
    validateCardOffers(card, offerableIds, collector);
    if (card.cost >= 5) collector.warning("balance", card.id, `Card cost ${card.cost} is unusually high`);
    if (card.effects.length === 0 && !card.excludeFromOfferPool)
      collector.warning("balance", card.id, "Card has no authored effects");
  }
}

export function validateEnemies(collector: Collector): void {
  validateLibraryBasics(collector, {
    area: "enemies",
    items: enemyBestiary,
    schema: EnemyContentSchema,
    titleOf: (enemy) => enemy.title,
    artOf: (enemy) => enemy.art,
    idLabel: "enemy id",
  });

  for (const enemyType of enemyTypes) {
    if (!enemyBestiary.some((enemy) => enemy.enemyType === enemyType)) {
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
  for (const modifierKind of collectUncoveredDifficultyModifierKinds()) {
    collector.error(
      "encounter-traits",
      modifierKind,
      "Difficulty modifier has no turn-start handler or passive-only entry",
    );
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

export function validateTrinkets(collector: Collector): void {
  validateLibraryBasics(collector, {
    area: "trinkets",
    items: trinketLibrary,
    schema: TrinketContentSchema,
    titleOf: (trinket) => trinket.title,
    artOf: (trinket) => trinket.art,
    idLabel: "trinket id",
  });
  for (const trinket of trinketLibrary) {
    for (const issue of validateTrinketDescriptionParity(trinket)) {
      collector.error(issue.area, issue.id, issue.message);
    }
  }
}

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
    if (!enemyStatusIds.includes(status))
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
  if (trait.category === "combat" && !combatEncounterTraitIdSet.has(trait.id))
    collector.error("encounter-traits", id, "Combat encounter trait is missing from combat id list");
  if (trait.category === "reward" && !rewardEncounterTraitIdSet.has(trait.id))
    collector.error("encounter-traits", id, "Reward encounter trait is missing from reward id list");
  if (trait.category === "reward" && trait.modes.length === 0)
    collector.error("encounter-traits", id, "Reward encounter trait has no compatible modes");
}

export function validateEncounterTraits(collector: Collector): void {
  const traitIds = Object.keys(ENCOUNTER_TRAITS);
  const definitions = ENCOUNTER_TRAITS as Record<string, unknown>;
  addDuplicateIssues(encounterTraitIdList, "encounter-traits", "encounter trait id", collector.error);
  for (const id of encounterTraitIdList) {
    if (!definitions[id]) collector.error("encounter-traits", id, "Encounter trait id is missing a definition");
  }
  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    validateSingleEncounterTrait(trait, id, collector);
  }
  for (const id of traitIds) {
    if (!encounterTraitIdList.includes(id))
      collector.error("encounter-traits", id, "Encounter trait definition is missing from id lists");
  }
}

export { validateGear } from "./validators-gear";
