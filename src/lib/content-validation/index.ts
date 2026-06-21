import { z } from "zod";
import {
  allGameArt,
  BattleCardEffectSchema,
  cardLibrary,
  companionLibrary,
  DAMAGE_TYPES,
  ENEMY_STATUS_DISPLAY_ORDER,
  enemyBestiary,
  gearArtByDefinitionId,
  getOfferableCardPool,
  getVisibleKeywordIds,
  harmfulPlayerStatusIds,
  keywordDefinitions,
  mysteryEventArt,
  placeholderCard,
  placeholderEnemy,
  placeholderMystery,
  PLAYER_STATUS_DISPLAY_ORDER,
  trinketLibrary,
  type KeywordId,
} from "@/lib/game-data";
import {
  GEAR_AFFIX_IDS,
  GEAR_EFFECT_KEYS,
  gearAffixCatalog,
  gearBaseItems,
  gearDefinitionList,
  gearDefinitions,
  GEAR_RARITIES,
  GEAR_SLOTS,
} from "@/lib/gear";
import { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "@/lib/battle";
import { GEAR_AFFIX_COUNT, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import {
  COMBAT_ENCOUNTER_TRAIT_IDS,
  ENCOUNTER_TRAITS,
  REWARD_ENCOUNTER_TRAIT_IDS,
} from "../content-systems/encounter-traits";
import { flattenEffects, validateCardDescriptionParity, validateEnemyTraitDescriptionParity } from "./card-parity";
import type {
  ContentValidationArea,
  ContentValidationIssue,
  ContentValidationResult,
  ContentValidationSeverity,
} from "./types";

export type { ContentValidationArea } from "./types";

const keywordIds = Object.keys(keywordDefinitions) as [KeywordId, ...KeywordId[]];
const playerStatusIds = [
  "block",
  "armor",
  "forge",
  "haste",
  "phoenixFeather",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
] as const;
const enemyStatusIds = ["burn", "poison", "bleed", "freeze", "stun"] as const;
const enemyTypes = ["normal", "elite", "boss"] as const;
const encounterTraitIdList: readonly string[] = [...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS];
const combatEncounterTraitIdSet = new Set<string>(COMBAT_ENCOUNTER_TRAIT_IDS);
const rewardEncounterTraitIdSet = new Set<string>(REWARD_ENCOUNTER_TRAIT_IDS);
const gearAffixIdSet = new Set<string>(GEAR_AFFIX_IDS);
const knownArt = new Set([...allGameArt, ...Object.values(mysteryEventArt), ...Object.values(gearArtByDefinitionId)]);
const placeholderArt = new Set([placeholderCard, placeholderEnemy, placeholderMystery]);

const NonEmptyStringSchema = z.string().min(1);
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeIntegerSchema = z.number().int().nonnegative();
const KeywordIdSchema = z.enum(keywordIds);
const PlayerStatusIdSchema = z.enum(playerStatusIds);
const DamageTypeSchema = z.enum(DAMAGE_TYPES as [string, ...string[]]);

const CardContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  descriptionLines: z.array(NonEmptyStringSchema).min(1),
  art: NonEmptyStringSchema,
  cost: NonNegativeIntegerSchema,
  consume: z.boolean().optional(),
  tags: z.array(KeywordIdSchema).optional(),
  effects: z.array(BattleCardEffectSchema),
});

const EnemyAttackEffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("damage"),
    damageType: DamageTypeSchema,
    amount: PositiveIntegerSchema,
    lifesteal: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("player-status"),
    status: PlayerStatusIdSchema,
    amount: PositiveIntegerSchema,
  }),
]);

const EnemyContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  subtitle: NonEmptyStringSchema,
  descriptionLines: z.array(z.string()),
  art: NonEmptyStringSchema,
  enemyType: z.enum(enemyTypes),
  traits: z.array(
    z.object({
      id: NonEmptyStringSchema,
      title: NonEmptyStringSchema,
      description: NonEmptyStringSchema,
    }),
  ),
  attackEffects: z.array(EnemyAttackEffectSchema).min(1),
});

const CompanionContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  art: NonEmptyStringSchema,
  turnStartEffects: z.array(BattleCardEffectSchema).length(1),
});

const TrinketContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  descriptionLines: z.array(NonEmptyStringSchema).min(1),
  art: NonEmptyStringSchema,
});

const GearDefinitionContentSchema = z.object({
  id: NonEmptyStringSchema,
  baseItemId: NonEmptyStringSchema,
  rarity: z.enum(GEAR_RARITIES).nullable(),
  title: NonEmptyStringSchema,
  descriptionLines: z.array(z.string()),
  art: NonEmptyStringSchema,
  compatibleSlots: z.array(z.enum(GEAR_SLOTS)).min(1),
  requiresTwoHands: z.boolean(),
  affinityKeywords: z.array(KeywordIdSchema).min(1),
  salvageValue: z.record(z.string(), NonNegativeIntegerSchema),
  rangedWeapon: z.boolean().optional(),
  quiver: z.boolean().optional(),
});

const GearAffixContentSchema = z.object({
  id: z.enum(GEAR_AFFIX_IDS),
  aspect: z.enum(["offensive", "defensive"]),
  keywordId: KeywordIdSchema,
  secondaryKeywordId: KeywordIdSchema.optional(),
  descriptionTemplate: NonEmptyStringSchema,
  effectKey: z.enum(GEAR_EFFECT_KEYS),
  roll: z.record(z.enum(GEAR_RARITIES), z.object({ min: PositiveIntegerSchema, max: PositiveIntegerSchema })),
});

const EncounterTraitContentSchema = z.object({
  id: z.enum([...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS]),
  category: z.enum(["combat", "reward"]),
  label: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  modes: z.array(z.enum(["labyrinth", "wildwood"])).min(1),
  enemyTrait: z.object({
    id: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
  }),
});

function createIssue(
  severity: ContentValidationSeverity,
  area: ContentValidationArea,
  id: string,
  message: string,
): ContentValidationIssue {
  return { severity, area, id, message };
}

function createCollector() {
  const issues: ContentValidationIssue[] = [];
  return {
    issues,
    error: (area: ContentValidationArea, id: string, message: string) => {
      issues.push(createIssue("error", area, id, message));
    },
    warning: (area: ContentValidationArea, id: string, message: string) => {
      issues.push(createIssue("warning", area, id, message));
    },
  };
}

function formatZodIssue(issue: { path: readonly (string | number | symbol)[]; message: string }): string {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

function collectSchemaIssues<T>(
  schema: z.ZodType<T>,
  value: unknown,
  area: ContentValidationArea,
  id: string,
  add: (area: ContentValidationArea, id: string, message: string) => void,
): void {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      add(area, id, formatZodIssue(issue));
    }
  }
}

function addDuplicateIssues(
  values: readonly string[],
  area: ContentValidationArea,
  label: string,
  add: (area: ContentValidationArea, id: string, message: string) => void,
): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  for (const value of duplicates) {
    add(area, value, `Duplicate ${label}: ${value}`);
  }
}

function validateArt(
  area: ContentValidationArea,
  id: string,
  art: string,
  addError: (area: ContentValidationArea, id: string, message: string) => void,
  addWarning: (area: ContentValidationArea, id: string, message: string) => void,
): void {
  if (!art) {
    addError(area, id, "Missing art reference");
    return;
  }
  if (!knownArt.has(art)) {
    addError("art", id, "Art reference is not in the known optimized asset registries");
  }
  if (placeholderArt.has(art)) {
    addWarning("art", id, "Uses placeholder art");
  }
}

function validateCards(collector: ReturnType<typeof createCollector>): void {
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

function validateEnemies(collector: ReturnType<typeof createCollector>): void {
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

function validateCompanions(collector: ReturnType<typeof createCollector>): void {
  addDuplicateIssues(Object.keys(companionLibrary), "companions", "companion id", collector.error);
  for (const [id, companion] of Object.entries(companionLibrary)) {
    collectSchemaIssues(CompanionContentSchema, companion, "companions", id, collector.error);
    if (companion.id !== id) {
      collector.error("companions", id, `Companion record key does not match id ${companion.id}`);
    }
    validateArt("companions", id, companion.art, collector.error, collector.warning);
  }
}

function validateTrinkets(collector: ReturnType<typeof createCollector>): void {
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

function validateKeywordsAndStatuses(collector: ReturnType<typeof createCollector>): void {
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

function validateEncounterTraits(collector: ReturnType<typeof createCollector>): void {
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

function validateGear(collector: ReturnType<typeof createCollector>): void {
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

function sortIssues(issues: ContentValidationIssue[]): ContentValidationIssue[] {
  return [...issues].sort(
    (a, b) =>
      a.severity.localeCompare(b.severity) ||
      a.area.localeCompare(b.area) ||
      a.id.localeCompare(b.id) ||
      a.message.localeCompare(b.message),
  );
}

export function runContentValidation(): ContentValidationResult {
  const collector = createCollector();
  validateCards(collector);
  validateEnemies(collector);
  validateCompanions(collector);
  validateTrinkets(collector);
  validateKeywordsAndStatuses(collector);
  validateEncounterTraits(collector);
  validateGear(collector);

  const issues = sortIssues(collector.issues);
  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}
