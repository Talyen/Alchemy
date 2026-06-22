import {
  cardLibrary,
  companionLibrary,
  enemyBestiary,
  trinketLibrary,
  keywordDefinitions,
  harmfulPlayerStatusIds,
  PLAYER_STATUS_DISPLAY_ORDER,
  ENEMY_STATUS_DISPLAY_ORDER,
  getOfferableCardPool,
  getVisibleKeywordIds,
  gearArtByDefinitionId,
} from "@/lib/game-data";
import {
  gearBaseItems,
  gearDefinitionList,
  gearDefinitions,
  gearAffixCatalog,
  GEAR_AFFIX_IDS,
  GEAR_EFFECT_KEYS,
  GEAR_RARITIES,
} from "@/lib/gear";
import { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "@/lib/battle";
import { GEAR_AFFIX_COUNT, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import {
  COMBAT_ENCOUNTER_TRAIT_IDS,
  REWARD_ENCOUNTER_TRAIT_IDS,
  ENCOUNTER_TRAITS,
} from "../content-systems/encounter-traits";
import { flattenEffects, validateCardDescriptionParity, validateEnemyTraitDescriptionParity } from "./card-parity";
import {
  CardContentSchema,
  EnemyContentSchema,
  CompanionContentSchema,
  TrinketContentSchema,
  GearDefinitionContentSchema,
  GearAffixContentSchema,
  EncounterTraitContentSchema,
  enemyTypes,
  enemyStatusIds,
} from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, validateArt } from "./utils";
import type { createCollector } from "./utils";

const encounterTraitIdList: readonly string[] = [...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS];
const combatEncounterTraitIdSet = new Set<string>(COMBAT_ENCOUNTER_TRAIT_IDS);
const rewardEncounterTraitIdSet = new Set<string>(REWARD_ENCOUNTER_TRAIT_IDS);
const gearAffixIdSet = new Set<string>(GEAR_AFFIX_IDS);

export function validateCards(collector: ReturnType<typeof createCollector>): void {
  addDuplicateIssues(
    cardLibrary.map((card) => card.id),
    "cards",
    "card id",
    collector.error,
  );
  addDuplicateIssues(
    cardLibrary.map((card) => card.title),
    "cards",
    "card title",
    collector.error,
  );

  const companionIds = new Set(Object.keys(companionLibrary));
  const offerableIds = new Set(getOfferableCardPool().map((card) => card.id));
  for (const card of cardLibrary) {
    collectSchemaIssues(CardContentSchema, card, "cards", card.id, collector.error);
    validateArt("cards", card.id, card.art, collector.error, collector.warning);
    for (const issue of validateCardDescriptionParity(card)) collector.issues.push(issue);
    for (const effect of flattenEffects(card.effects)) {
      if (effect.kind === "summon-companion" && !companionIds.has(effect.companionId)) {
        collector.error("cards", card.id, `References unknown companion: ${effect.companionId}`);
      }
    }
    if (card.id === MIXED_POTION_CARD_ID && offerableIds.has(card.id)) {
      collector.error("rewards", card.id, "Mixed Potion must not be offerable in normal card rewards");
    }
    if (card.id !== MIXED_POTION_CARD_ID && !offerableIds.has(card.id)) {
      collector.error("rewards", card.id, "Library card is missing from offerable card pool");
    }
    if (card.cost >= 5) {
      collector.warning("balance", card.id, `Card cost ${card.cost} is unusually high`);
    }
    if (card.effects.length === 0 && card.id !== MIXED_POTION_CARD_ID) {
      collector.warning("balance", card.id, "Card has no authored effects");
    }
  }
}

export function validateEnemies(collector: ReturnType<typeof createCollector>): void {
  addDuplicateIssues(
    enemyBestiary.map((enemy) => enemy.id),
    "enemies",
    "enemy id",
    collector.error,
  );
  addDuplicateIssues(
    enemyBestiary.map((enemy) => enemy.title),
    "enemies",
    "enemy title",
    collector.error,
  );

  for (const enemyType of enemyTypes) {
    if (!enemyBestiary.some((enemy) => enemy.enemyType === enemyType)) {
      collector.error("enemies", enemyType, `Enemy pool is missing type: ${enemyType}`);
    }
  }

  for (const enemy of enemyBestiary) {
    collectSchemaIssues(EnemyContentSchema, enemy, "enemies", enemy.id, collector.error);
    validateArt("enemies", enemy.id, enemy.art, collector.error, collector.warning);
    if (enemy.attackEffects.some((effect) => effect.amount <= 0)) {
      collector.warning("balance", enemy.id, "Enemy has a zero or negative attack value");
    }
    if (
      enemy.attackEffects.some(
        (effect) => effect.kind === "player-status" && (effect.status === "stun" || effect.status === "freeze"),
      )
    ) {
      collector.error("enemies", enemy.id, "Enemy Stun and Freeze attacks must be damage effects");
    }
    for (const issue of validateEnemyTraitDescriptionParity(enemy)) collector.issues.push(issue);
  }

  const bestiaryTraitIds = enemyBestiary.flatMap((enemy) => enemy.traits.map((trait) => trait.id));
  for (const traitId of collectUncoveredEnemyTraitIds(bestiaryTraitIds)) {
    collector.error("enemies", traitId, "Enemy trait has no turn-start handler or passive-only entry");
  }
  for (const modifierKind of collectUncoveredDifficultyModifierKinds()) {
    collector.error(
      "encounter-traits",
      modifierKind,
      "Difficulty modifier has no turn-start handler or passive-only entry",
    );
  }
}

export function validateCompanions(collector: ReturnType<typeof createCollector>): void {
  addDuplicateIssues(Object.keys(companionLibrary), "companions", "companion id", collector.error);
  for (const [id, companion] of Object.entries(companionLibrary)) {
    collectSchemaIssues(CompanionContentSchema, companion, "companions", id, collector.error);
    if (companion.id !== id) {
      collector.error("companions", id, `Companion record key does not match id ${companion.id}`);
    }
    validateArt("companions", id, companion.art, collector.error, collector.warning);
  }
}

export function validateTrinkets(collector: ReturnType<typeof createCollector>): void {
  addDuplicateIssues(
    trinketLibrary.map((trinket) => trinket.id),
    "trinkets",
    "trinket id",
    collector.error,
  );
  addDuplicateIssues(
    trinketLibrary.map((trinket) => trinket.title),
    "trinkets",
    "trinket title",
    collector.error,
  );
  for (const trinket of trinketLibrary) {
    collectSchemaIssues(TrinketContentSchema, trinket, "trinkets", trinket.id, collector.error);
    validateArt("trinkets", trinket.id, trinket.art, collector.error, collector.warning);
  }
}

export function validateKeywordsAndStatuses(collector: ReturnType<typeof createCollector>): void {
  const visibleKeywordIds = getVisibleKeywordIds() as string[];
  const knownKeywordIdSet = new Set<string>(Object.keys(keywordDefinitions));
  for (const keyword of visibleKeywordIds) {
    if (!knownKeywordIdSet.has(keyword)) collector.error("keywords", keyword, "Visible keyword is missing metadata");
  }
  for (const [id, definition] of Object.entries(keywordDefinitions)) {
    if (definition.id !== id) {
      collector.error("keywords", id, `Keyword record key does not match id ${definition.id}`);
    }
    if (!definition.label || !definition.description || !definition.colorClass || !definition.borderClass) {
      collector.error("keywords", id, "Keyword metadata has an empty display field");
    }
  }
  for (const status of harmfulPlayerStatusIds) {
    if (!enemyStatusIds.includes(status as (typeof enemyStatusIds)[number])) {
      collector.error("statuses", status, "Harmful player status is not a known harmful status id");
    }
  }
  if (new Set(PLAYER_STATUS_DISPLAY_ORDER).size !== PLAYER_STATUS_DISPLAY_ORDER.length) {
    collector.error("statuses", "player-display-order", "Player status display order contains duplicates");
  }
  if (new Set(ENEMY_STATUS_DISPLAY_ORDER).size !== ENEMY_STATUS_DISPLAY_ORDER.length) {
    collector.error("statuses", "enemy-display-order", "Enemy status display order contains duplicates");
  }
}

export function validateEncounterTraits(collector: ReturnType<typeof createCollector>): void {
  const traitIds = Object.keys(ENCOUNTER_TRAITS);
  const encounterTraitDefinitions = ENCOUNTER_TRAITS as Record<string, unknown>;
  addDuplicateIssues(encounterTraitIdList, "encounter-traits", "encounter trait id", collector.error);
  for (const id of encounterTraitIdList) {
    if (!encounterTraitDefinitions[id]) {
      collector.error("encounter-traits", id, "Encounter trait id is missing a definition");
    }
  }
  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    collectSchemaIssues(EncounterTraitContentSchema, trait, "encounter-traits", id, collector.error);
    if (trait.id !== id) {
      collector.error("encounter-traits", id, `Encounter trait record key does not match id ${trait.id}`);
    }
    if (trait.enemyTrait.id !== id) {
      collector.error("encounter-traits", id, "Encounter trait enemyTrait id does not match definition id");
    }
    if (trait.category === "combat" && !combatEncounterTraitIdSet.has(trait.id)) {
      collector.error("encounter-traits", id, "Combat encounter trait is missing from combat id list");
    }
    if (trait.category === "reward" && !rewardEncounterTraitIdSet.has(trait.id)) {
      collector.error("rewards", id, "Reward encounter trait is missing from reward id list");
    }
    if (trait.category === "reward" && trait.modes.length === 0) {
      collector.error("rewards", id, "Reward encounter trait has no compatible modes");
    }
  }
  for (const id of traitIds) {
    if (!encounterTraitIdList.includes(id)) {
      collector.error("encounter-traits", id, "Encounter trait definition is missing from id lists");
    }
  }
}

export function validateGear(collector: ReturnType<typeof createCollector>): void {
  const baseItems = Object.values(gearBaseItems);
  addDuplicateIssues(
    baseItems.map((item) => item.id),
    "gear",
    "gear base item id",
    collector.error,
  );
  addDuplicateIssues(
    gearDefinitionList.map((definition) => definition.id),
    "gear",
    "gear definition id",
    collector.error,
  );

  const affixIds = Object.keys(gearAffixCatalog);
  if (GEAR_AFFIX_IDS.length !== new Set(GEAR_AFFIX_IDS).size) {
    collector.error("gear", "GEAR_AFFIX_IDS", "Gear affix id list contains duplicates");
  }
  if (GEAR_EFFECT_KEYS.length !== new Set(GEAR_EFFECT_KEYS).size) {
    collector.error("gear", "GEAR_EFFECT_KEYS", "Gear effect key list contains duplicates");
  }
  for (const id of GEAR_AFFIX_IDS) {
    if (!(gearAffixCatalog as Record<string, unknown>)[id]) {
      collector.error("gear", id, "Affix id is missing from gearAffixCatalog");
    }
  }
  for (const id of affixIds) {
    if (!gearAffixIdSet.has(id)) {
      collector.error("gear", id, "Affix catalog entry is missing from GEAR_AFFIX_IDS");
    }
  }

  for (const baseItem of baseItems) {
    if (baseItem.id === "") {
      collector.error("gear", "base-item", "Gear base item has an empty id");
    }
    for (const rarity of GEAR_RARITIES) {
      if (!baseItem.availableRarities.includes(rarity)) {
        collector.error("gear", baseItem.id, `Base item does not declare ${rarity} rarity`);
      }
    }
    for (const rarity of baseItem.availableRarities) {
      const definitionId = `${baseItem.id}-${rarity}`;
      if (!gearDefinitions[definitionId]) {
        collector.error("gear", definitionId, "Missing generated gear definition for base item rarity");
      }
    }
  }

  for (const definition of gearDefinitionList) {
    collectSchemaIssues(GearDefinitionContentSchema, definition, "gear", definition.id, collector.error);
    validateArt("gear", definition.id, definition.art, collector.error, collector.warning);
    if (!gearArtByDefinitionId[definition.id]) {
      collector.error("art", definition.id, "Missing generated gear art mapping");
    }
    const minAffixes = definition.rarity ? GEAR_AFFIX_COUNT[definition.rarity].min : 0;
    const eligibleAffixes = Object.values(gearAffixCatalog).filter((affix) =>
      definition.affinityKeywords.some(
        (keyword) => keyword === affix.keywordId || keyword === affix.secondaryKeywordId,
      ),
    );
    if (definition.rarity && eligibleAffixes.length < minAffixes) {
      collector.error(
        "gear",
        definition.id,
        `Eligible affix pool ${eligibleAffixes.length} is smaller than minimum ${minAffixes}`,
      );
    }
  }

  const usedEffectKeys = new Set<string>();
  for (const affix of Object.values(gearAffixCatalog)) {
    collectSchemaIssues(GearAffixContentSchema, affix, "gear", affix.id, collector.error);
    usedEffectKeys.add(affix.effectKey);
    for (const rarity of GEAR_RARITIES) {
      const roll = affix.roll[rarity];
      if (roll.min > roll.max) {
        collector.warning("balance", affix.id, `${rarity} roll min is greater than max`);
      }
    }
  }
  for (const key of GEAR_EFFECT_KEYS) {
    if (!usedEffectKeys.has(key)) {
      collector.error("gear", key, "Gear effect key is not referenced by any affix");
    }
  }
}
