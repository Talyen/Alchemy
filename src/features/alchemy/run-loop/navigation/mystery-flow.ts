import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/commands/loot-progress";
import type { RunTransaction } from "@/features/alchemy/shared/stores/commands/run-session-command";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  addGold,
  awardMaterialsDuringRun,
  awardMysteryXP,
  createDraftInstanceIdSource,
  setMysteryCardChoices,
  setMysteryGrantedGearInstances,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import {
  cardById,
  cardHasKeyword,
  getOfferableCardPool,
  selectRewardCards,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import {
  generateGearInstanceForBaseItem,
  generateLootGearChoices,
  getGearLootAvailability,
  getOwnedUniqueDefinitionIds,
} from "@/lib/gear";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { computeMysteryMaterialReward } from "@/lib/homestead/material-rewards";
import type { MaterialId } from "@/lib/homestead/types";
import { resolveLootWeights } from "@/lib/loot";
import type { MysteryEffect } from "@/lib/mystery";
import { pickRandom } from "@/lib/rng";
import {
  appendBoonToRunWithDiscovery,
  appendCardToRunWithDiscovery,
  grantGearToRunWithRecord,
} from "../../shared/stores/commands/deck-mutations";

export interface MysteryEffectResult {
  followUp: "choose-card" | null;
  goldSound?: "gain";
  goldAward?: number;
  materialAward?: { material: MaterialId; amount: number };
}

export interface MysteryEffectContext {
  draft: RunTransaction;
  rng: () => number;
}

function getMysteryCardChoicePool(tag?: KeywordId): BattleCard[] {
  const pool = getOfferableCardPool();
  if (!tag) return pool;
  const tagged = pool.filter((card) => cardHasKeyword(card, tag));
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
      snapshotTransactionValue(context.draft.run.activeRun.runDeck),
      getMysteryCardChoicePool(effect.tag),
      MYSTERY_CARD_CHOICES,
      [],
      context.rng,
    ),
  );
  return { followUp: "choose-card" };
}

function gainRandomMysteryGear(context: MysteryEffectContext, forceAstral = false) {
  const baseItem = pickRandom(gearBaseItemList, context.rng);
  if (!baseItem) return { followUp: null };
  return gainMysteryGeneratedGear(baseItem.id, context, forceAstral);
}

function gainMysteryGeneratedGear(baseItemId: string, context: MysteryEffectContext, forceAstral = false) {
  const ownedUniqueIds = getOwnedUniqueDefinitionIds(snapshotTransactionValue(context.draft.gear.inventories));
  const instance = forceAstral
    ? generateGearInstanceForBaseItem(baseItemId, context.rng, "astral", createDraftInstanceIdSource(context.draft))
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
        false,
        createDraftInstanceIdSource(context.draft),
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
      const card = Object.hasOwn(cardById, effect.cardId) ? cardById[effect.cardId] : undefined;
      if (card) appendCardToRunWithDiscovery(context.draft, card);
      else if (import.meta.env.DEV)
        console.warn(`[Mystery] addCard "${effect.cardId}" matched no card; granting nothing`);
      return { followUp: null };
    }
    case "chooseCard":
      return offerMysteryCardChoices(effect, context);
    case "healHealth": {
      const maxHealth = context.draft.run.activeRun.runMaxHealth;
      const healingBonus = effect.amount > 0 ? context.draft.runProfile.effects.homesteadHealing : 0;
      setRunPlayerHealth(context.draft, (health) => Math.min(maxHealth, health + effect.amount + healingBonus));
      return { followUp: null };
    }
    case "gainGold": {
      const before = context.draft.runProfile.gold;
      addGold(context.draft, effect.amount, context.draft.runProfile.effects.goldFindBonus);
      const goldAward = context.draft.runProfile.gold - before;
      return { followUp: null, goldAward, ...(goldAward > 0 ? { goldSound: "gain" } : {}) };
    }
    case "gainXP":
      awardMysteryXP(context.draft, effect.keyword, effect.amount);
      return { followUp: null };
    case "gainTrinket":
      appendBoonToRunWithDiscovery(context.draft, effect.trinketId);
      return { followUp: null };
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
