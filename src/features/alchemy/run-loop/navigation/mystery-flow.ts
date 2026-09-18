import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { resolveLootWeights } from "@/lib/loot";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { cardById, getCardKeywords, selectRewardCards, type BattleCard, type KeywordId } from "@/lib/game-data";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import {
  appendCardToRunWithDiscovery,
  appendBoonToRunWithDiscovery,
  grantGearToRunWithRecord,
} from "../../shared/stores/deck-mutations";
import type { MaterialId } from "@/lib/homestead/types";
import { computeMysteryMaterialReward } from "@/lib/homestead/material-rewards";
import {
  generateGearInstanceForBaseItem,
  generateLootGearChoices,
  getGearLootAvailability,
  getOwnedUniqueDefinitionIds,
} from "@/lib/gear";
import { pickMysteryTrinketGrantId, type MysteryEffect } from "@/lib/mystery";
import { awardsRunMaterialsFor } from "../run/run-materials";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { pickRandom, rngInt } from "@/lib/rng";
import {
  addGold,
  awardMaterialsDuringRun,
  awardMysteryXP,
  deductGold,
  setMysteryCardChoices,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setRunDeck,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

export interface MysteryEffectResult {
  followUp: "choose-card" | null;
  goldSound?: "gain" | "spend";
  materialAward?: { material: MaterialId; amount: number };
}

export interface MysteryEffectContext {
  draft: GameplayDraft;
  rng: () => number;
}

function addSpecificMysteryCard(cardId: string, context: MysteryEffectContext) {
  const card = cardById[cardId];
  if (!card) {
    if (import.meta.env.DEV) console.warn(`[Mystery] addCard "${cardId}" matched no card; granting nothing`);
    return { followUp: null };
  }
  appendCardToRunWithDiscovery(context.draft, card);
  return { followUp: null };
}

function getMysteryCardChoicePool(tag?: KeywordId): BattleCard[] {
  const pool = getOfferableCardPool();
  if (!tag) return pool;
  const tagged = pool.filter((card) => getCardKeywords(card).includes(tag));
  if (tagged.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(`[Mystery] chooseCard tag "${tag}" matched no offerable cards; using full pool`);
    }
    return pool;
  }
  return tagged;
}

function offerMysteryCardChoices(
  effect: Extract<MysteryEffect, { kind: "chooseCard" }>,
  context: MysteryEffectContext,
): MysteryEffectResult {
  setMysteryCardChoices(
    context.draft,
    selectRewardCards(
      context.draft.run.activeRun.runDeck,
      getMysteryCardChoicePool(effect.tag),
      MYSTERY_CARD_CHOICES,
      [],
      context.rng,
    ),
  );
  return { followUp: "choose-card" };
}

function healFromMystery(amount: number, chance: number | undefined, maxHealth: number, context: MysteryEffectContext) {
  if (chance !== undefined && context.rng() >= chance) return { followUp: null };
  setRunPlayerHealth(context.draft, (p) => Math.min(maxHealth, p + amount));
  return { followUp: null };
}

function damageFromMystery(amount: number, context: MysteryEffectContext) {
  setRunPlayerHealth(context.draft, (p) => Math.max(0, p - amount));
  return { followUp: null };
}

function gainMysteryGold(amount: number, context: MysteryEffectContext) {
  addGold(context.draft, amount);
  if (amount > 0) return { followUp: null, goldSound: "gain" as const };
  return { followUp: null };
}

function loseMysteryGold(amount: number, context: MysteryEffectContext) {
  deductGold(context.draft, amount);
  if (amount > 0) return { followUp: null, goldSound: "spend" as const };
  return { followUp: null };
}

function removeMysteryCard(context: MysteryEffectContext) {
  setRunDeck(context.draft, (p) => {
    if (p.length === 0) return p;
    const idx = rngInt(context.rng, p.length);
    return p.filter((_, i) => i !== idx);
  });
  return { followUp: null };
}

function gainMysteryTrinket(trinketId: string, context: MysteryEffectContext) {
  appendBoonToRunWithDiscovery(context.draft, trinketId);
  return { followUp: null };
}

function gainRandomMysteryTrinket(
  effect: Extract<MysteryEffect, { kind: "gainRandomTrinket" }>,
  context: MysteryEffectContext,
) {
  const run = context.draft.run.activeRun;
  const owned = new Set(combineTrinketEffectIds(run.runBoons, context.draft.gear.equippedTrinkets[run.characterId]));
  const trinketId = pickMysteryTrinketGrantId({ fromIds: effect.fromIds, owned, rng: context.rng });
  if (!trinketId) {
    // Every candidate is owned: fall back to guaranteed-Astral gear, matching
    // the pre-resolution fallback in resolve-trinkets.ts for named grants.
    const baseItem = pickRandom(gearBaseItemList, context.rng);
    if (!baseItem) return { followUp: null };
    return gainMysteryGeneratedGear(baseItem.id, context, true);
  }
  gainMysteryTrinket(trinketId, context);
  setMysteryGrantedTrinketIds(context.draft, (previous) => [...previous, trinketId]);
  return { followUp: null };
}

function gainRandomMysteryGear(context: MysteryEffectContext) {
  const baseItem = pickRandom(gearBaseItemList, context.rng);
  if (!baseItem) return { followUp: null };
  return gainMysteryGeneratedGear(baseItem.id, context);
}

function gainMysteryGeneratedGear(baseItemId: string, context: MysteryEffectContext, forceAstral = false) {
  const ownedUniqueIds = getOwnedUniqueDefinitionIds(context.draft.gear.inventories);
  const instance = forceAstral
    ? generateGearInstanceForBaseItem(baseItemId, context.rng, "astral")
    : generateLootGearChoices(
        1,
        context.rng,
        resolveLootWeights({
          source: "mystery",
          progress: resolveDraftLootProgress(context.draft),
          astralChanceBonus: context.draft.runProfile.effects.gearAstralChanceBonus,
          available: getGearLootAvailability(ownedUniqueIds, [baseItemId]),
        }),
        ownedUniqueIds,
        [baseItemId],
      )[0];
  if (!instance) {
    // The base item has no definition for the rolled rarity; granting nothing
    // rather than a mistiered item. Loud in DEV so content errors surface.
    if (import.meta.env.DEV)
      console.warn(`[Mystery] gainGeneratedGear "${baseItemId}" matched no gear definition; granting nothing`);
    return { followUp: null };
  }
  grantGearToRunWithRecord(context.draft, instance);
  setMysteryGrantedGearInstances(context.draft, (previous) => [...previous, instance]);
  return { followUp: null };
}

function gainMysteryMaterial(material: MaterialId, amount: number, context: MysteryEffectContext) {
  // Wildwood runs its own economy: never award homestead materials there. Still
  // report a zero award so navigation records the amount actually granted.
  if (!awardsRunMaterialsFor(context.draft.run.activeRun.contentSystemType))
    return { followUp: null, materialAward: { material, amount: 0 } };
  const awarded = computeMysteryMaterialReward({
    material,
    amount,
    effects: context.draft.runProfile.effects,
  });
  awardMaterialsDuringRun(context.draft, awarded);
  return { followUp: null, materialAward: { material, amount: awarded[material] } };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled mystery effect kind: ${String(value)}`);
}

export function applyMysteryEffect(effect: MysteryEffect, context: MysteryEffectContext): MysteryEffectResult {
  switch (effect.kind) {
    case "addCard":
      return addSpecificMysteryCard(effect.cardId, context);
    case "chooseCard":
      return offerMysteryCardChoices(effect, context);
    case "healHealth":
      return healFromMystery(effect.amount, effect.chance, context.draft.run.activeRun.runMaxHealth, context);
    case "damageHealth":
      return damageFromMystery(effect.amount, context);
    case "gainGold":
      return gainMysteryGold(effect.amount, context);
    case "loseGold":
      return loseMysteryGold(effect.amount, context);
    case "gainXP":
      awardMysteryXP(context.draft, effect.keyword, effect.amount);
      return { followUp: null };
    case "removeCard":
      return removeMysteryCard(context);
    case "gainTrinket":
      return gainMysteryTrinket(effect.trinketId, context);
    case "gainRandomTrinket":
      return gainRandomMysteryTrinket(effect, context);
    case "gainRandomGear":
      return gainRandomMysteryGear(context);
    case "gainGeneratedGear":
      return gainMysteryGeneratedGear(effect.baseItemId, context, effect.astral === true);
    case "gainMaterial":
      return gainMysteryMaterial(effect.material, effect.amount, context);
    default:
      return assertNever(effect);
  }
}
