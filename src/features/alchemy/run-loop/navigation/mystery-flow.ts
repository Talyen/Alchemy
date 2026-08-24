// Dispatches and applies mystery event consequences to the run state.
// Depends on game libraries, audio triggers, utility helpers, and mystery types.
// Consumed by the run navigation flow and `useMysteryEventNavigation`.
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { cardById, getCardKeywords, selectRewardCards, type BattleCard, type KeywordId } from "@/lib/game-data";
import { MYSTERY_CARD_CHOICES, GEAR_ASTRAL_GUARANTEE_BONUS } from "@/lib/game-constants";
import { appendCardToRunWithDiscovery, appendBoonToRunWithDiscovery } from "../run/deck-mutations";
import type { MaterialId } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";
import { generateGearInstanceForBaseItem } from "@/lib/gear";
import { pickMysteryTrinketGrantId, type MysteryEffect } from "@/lib/mystery";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { pickRandom } from "@/lib/utils";
import { spendRunGold } from "../run-gold";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import {
  addRunGold,
  awardMaterialsDuringRun,
  awardMysteryXP,
  setMysteryCardChoices,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setRunDeck,
  setRunGold,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

export interface MysteryEffectResult {
  /**
   * When non-null, indicates that a sub-picker dialog (e.g., choosing a card)
   * was opened, which pauses the evaluation of subsequent effects in the list.
   */
  followUp: "choose-card" | null;
  goldSound?: "gain" | "spend";
}

export interface MysteryEffectContext {
  draft: GameplayDraft;
  rng: () => number;
}

function addSpecificMysteryCard(cardId: string, context: MysteryEffectContext) {
  const card = cardById[cardId];
  if (card) appendCardToRunWithDiscovery(context.draft, card);
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

function healFromMystery(amount: number, chance: number | undefined, context: MysteryEffectContext) {
  if (chance !== undefined && context.rng() >= chance) return { followUp: null };
  setRunPlayerHealth(context.draft, (p) => Math.min(context.draft.run.activeRun.runMaxHealth, p + amount));
  return { followUp: null };
}

function damageFromMystery(amount: number, context: MysteryEffectContext) {
  setRunPlayerHealth(context.draft, (p) => Math.max(0, p - amount));
  return { followUp: null };
}

function gainMysteryGold(amount: number, context: MysteryEffectContext) {
  addRunGold(context.draft, amount);
  if (amount > 0) return { followUp: null, goldSound: "gain" as const };
  return { followUp: null };
}

function loseMysteryGold(amount: number, context: MysteryEffectContext) {
  spendRunGold(amount, (update) => setRunGold(context.draft, update));
  if (amount > 0) return { followUp: null, goldSound: "spend" as const };
  return { followUp: null };
}

function removeMysteryCard(context: MysteryEffectContext) {
  setRunDeck(context.draft, (p) => {
    if (p.length === 0) return p;
    const idx = Math.floor(context.rng() * p.length);
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
    // Legacy unresolved random-trinket effects only: the grant is persisted immediately, so a
    // random base item is fine (unlike pre-choice badges, which need cross-session stability and
    // therefore derive the fallback deterministically in resolve-trinkets.ts).
    const baseItem = pickRandom(gearBaseItemList, context.rng);
    if (!baseItem) return { followUp: null };
    return gainMysteryGeneratedGear(baseItem.id, context, true);
  }
  gainMysteryTrinket(trinketId, context);
  setMysteryGrantedTrinketIds(context.draft, (previous) => [...previous, trinketId]);
  return { followUp: null };
}

function gainMysteryGeneratedGear(baseItemId: string, context: MysteryEffectContext, forceAstral = false) {
  const instance = generateGearInstanceForBaseItem(
    baseItemId,
    context.rng,
    forceAstral ? GEAR_ASTRAL_GUARANTEE_BONUS : context.draft.runProfile.effects.gearAstralChanceBonus,
  );
  if (!instance) return { followUp: null };
  mutateGearWithRunHealthSync(context.draft, {
    mutate: (gear) => gear.addInstance(instance, context.draft.run.activeRun.characterId),
  });
  setMysteryGrantedGearInstances(context.draft, (previous) => [...previous, instance]);
  return { followUp: null };
}

function gainMysteryMaterial(material: MaterialId, amount: number, context: MysteryEffectContext) {
  const matInv = emptyInventory();
  matInv[material] = amount;
  awardMaterialsDuringRun(context.draft, applyMaterialFindBonus(matInv, context.draft.runProfile.effects));
  return { followUp: null };
}

// Applies a single mystery consequence effect to the run state.
// Returns a result indicating if the navigation flow must pause for follow-up choice UI.
const mysteryApplyHandlers: {
  [K in MysteryEffect["kind"]]: (
    effect: Extract<MysteryEffect, { kind: K }>,
    context: MysteryEffectContext,
  ) => MysteryEffectResult;
} = {
  addCard: (effect, context) => addSpecificMysteryCard(effect.cardId, context),
  chooseCard: (effect, context) => offerMysteryCardChoices(effect, context),
  healHealth: (effect, context) => healFromMystery(effect.amount, effect.chance, context),
  damageHealth: (effect, context) => damageFromMystery(effect.amount, context),
  gainGold: (effect, context) => gainMysteryGold(effect.amount, context),
  loseGold: (effect, context) => loseMysteryGold(effect.amount, context),
  gainXP: (effect, context) => {
    awardMysteryXP(context.draft, effect.keyword, effect.amount);
    return { followUp: null };
  },
  removeCard: (_effect, context) => removeMysteryCard(context),
  gainTrinket: (effect, context) => gainMysteryTrinket(effect.trinketId, context),
  gainRandomTrinket: (effect, context) => gainRandomMysteryTrinket(effect, context),
  gainGeneratedGear: (effect, context) => gainMysteryGeneratedGear(effect.baseItemId, context, effect.astral === true),
  gainMaterial: (effect, context) => gainMysteryMaterial(effect.material, effect.amount, context),
};

function assertNever(value: never): never {
  throw new Error(`Unhandled mystery effect kind: ${String(value)}`);
}

export function applyMysteryEffect(effect: MysteryEffect, context: MysteryEffectContext): MysteryEffectResult {
  const handler = mysteryApplyHandlers[effect.kind];
  if (!handler) {
    return assertNever(effect.kind as never);
  }
  return handler(effect as never, context);
}
