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
    return gainRandomMysteryGear(context, true);
  }
  appendBoonToRunWithDiscovery(context.draft, trinketId);
  setMysteryGrantedTrinketIds(context.draft, (previous) => [...previous, trinketId]);
  return { followUp: null };
}

function gainRandomMysteryGear(context: MysteryEffectContext, forceAstral = false) {
  const baseItem = pickRandom(gearBaseItemList, context.rng);
  if (!baseItem) return { followUp: null };
  return gainMysteryGeneratedGear(baseItem.id, context, forceAstral);
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
    case "addCard": {
      const card = cardById[effect.cardId];
      if (card) appendCardToRunWithDiscovery(context.draft, card);
      else if (import.meta.env.DEV)
        console.warn(`[Mystery] addCard "${effect.cardId}" matched no card; granting nothing`);
      return { followUp: null };
    }
    case "chooseCard":
      return offerMysteryCardChoices(effect, context);
    case "healHealth": {
      const maxHealth = context.draft.run.activeRun.runMaxHealth;
      if (effect.chance !== undefined && context.rng() >= effect.chance) return { followUp: null };
      setRunPlayerHealth(context.draft, (health) => Math.min(maxHealth, health + effect.amount));
      return { followUp: null };
    }
    case "damageHealth":
      setRunPlayerHealth(context.draft, (health) => Math.max(0, health - effect.amount));
      return { followUp: null };
    case "gainGold":
      addGold(context.draft, effect.amount);
      return { followUp: null, ...(effect.amount > 0 ? { goldSound: "gain" } : {}) };
    case "loseGold":
      deductGold(context.draft, effect.amount);
      return { followUp: null, ...(effect.amount > 0 ? { goldSound: "spend" } : {}) };
    case "gainXP":
      awardMysteryXP(context.draft, effect.keyword, effect.amount);
      return { followUp: null };
    case "removeCard":
      setRunDeck(context.draft, (deck) => {
        if (deck.length === 0) return deck;
        const index = rngInt(context.rng, deck.length);
        return deck.filter((_, i) => i !== index);
      });
      return { followUp: null };
    case "gainTrinket":
      appendBoonToRunWithDiscovery(context.draft, effect.trinketId);
      return { followUp: null };
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
