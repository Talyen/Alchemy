// Dispatches and applies mystery event consequences to the run state.
// Depends on game libraries, audio triggers, utility helpers, and mystery types.
// Consumed by the run navigation flow and the useMysteryFlow React hook.
import {
  cardLibrary,
  getOfferableCardPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { playGoldGain, playGoldSpend } from "@/lib/audio";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { appendCardToRunWithDiscovery, appendTrinketToRunWithDiscovery } from "../run/deck-mutations";
import type { MaterialId, MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { Dispatch, SetStateAction } from "react";

import type { MysteryEffect } from "@/lib/mystery";
import { sampleItems } from "../../shared/utils";

export type MysteryEffectResult = {
  /**
   * When non-null, indicates that a sub-picker dialog (e.g., choosing a card)
   * was opened, which pauses the evaluation of subsequent effects in the list.
   */
  followUp: "choose-card" | null;
};

type MysteryEffectContext = {
  runDeck?: BattleCard[];
  runMaxHealth: number;
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setRunGold: Dispatch<SetStateAction<number>>;
  setRunPlayerHealth: Dispatch<SetStateAction<number>>;
  setRunTrinkets: Dispatch<SetStateAction<string[]>>;
  setMysteryCardChoices: Dispatch<SetStateAction<BattleCard[] | null>>;
  awardMysteryXP: (keyword: KeywordId, amount: number) => void;
  onAddMaterials: (materials: MaterialInventory) => void;
  onAwardGold: (amount: number) => void;
};

// Applies a single mystery consequence effect to the run state.
// Returns a result indicating if the navigation flow must pause for follow-up choice UI.
const mysteryApplyHandlers: {
  [K in MysteryEffect["kind"]]: (
    effect: Extract<MysteryEffect, { kind: K }>,
    context: MysteryEffectContext,
  ) => MysteryEffectResult;
} = {
  addCard: (effect, context) => addSpecificMysteryCard(effect.cardId, context),
  chooseCard: (_effect, context) => offerMysteryCardChoices(context),
  healHealth: (effect, context) => healFromMystery(effect.amount, effect.chance, context),
  damageHealth: (effect, context) => damageFromMystery(effect.amount, context),
  gainGold: (effect, context) => gainMysteryGold(effect.amount, context),
  loseGold: (effect, context) => loseMysteryGold(effect.amount, context),
  gainXP: (effect, context) => {
    context.awardMysteryXP(effect.keyword, effect.amount);
    return { followUp: null };
  },
  removeCard: (effect, context) => removeMysteryCard(effect.mode, context),
  gainTrinket: (effect, context) => gainMysteryTrinket(effect.trinketId, context),
  gainRandomTrinket: (_effect, context) => gainRandomMysteryTrinket(context),
  gainMaterial: (effect, context) => gainMysteryMaterial(effect.material, effect.amount, context),
  none: () => ({ followUp: null }),
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

// Shared card reward mutation keeps discovery tracking aligned with deck changes.
// Note: We use a simpler subset of context keys since we only mutate runDeck.
function addCardToRun(card: BattleCard, context: Pick<MysteryEffectContext, "setRunDeck">): void {
  appendCardToRunWithDiscovery(card, context.setRunDeck);
}

function addSpecificMysteryCard(cardId: string, context: MysteryEffectContext) {
  const card = cardLibrary.find((c) => c.id === cardId);
  if (card) addCardToRun(card, context);
  return { followUp: null };
}

function offerMysteryCardChoices(context: MysteryEffectContext): MysteryEffectResult {
  context.setMysteryCardChoices(selectRewardCards(context.runDeck, getOfferableCardPool(), MYSTERY_CARD_CHOICES));
  return { followUp: "choose-card" };
}

function healFromMystery(amount: number, chance: number | undefined, context: MysteryEffectContext) {
  if (chance !== undefined && Math.random() >= chance) return { followUp: null };
  context.setRunPlayerHealth((p) => Math.min(context.runMaxHealth, p + amount));
  return { followUp: null };
}

function damageFromMystery(amount: number, context: MysteryEffectContext) {
  context.setRunPlayerHealth((p) => Math.max(0, p - amount));
  return { followUp: null };
}

function gainMysteryGold(amount: number, context: MysteryEffectContext) {
  if (amount > 0) playGoldGain();
  context.onAwardGold(amount);
  return { followUp: null };
}

function loseMysteryGold(amount: number, context: MysteryEffectContext) {
  if (amount > 0) playGoldSpend();
  context.setRunGold((p) => Math.max(0, p - amount));
  return { followUp: null };
}

function removeMysteryCard(mode: "random" | "choose", context: MysteryEffectContext) {
  // Choice-based removal is handled by the screen picker; this helper only mutates immediately.
  if (mode !== "random") return { followUp: null };
  context.setRunDeck((p) => {
    if (p.length === 0) return p;
    const idx = Math.floor(Math.random() * p.length);
    return p.filter((_, i) => i !== idx);
  });
  return { followUp: null };
}

function gainMysteryTrinket(trinketId: string, context: MysteryEffectContext) {
  appendTrinketToRunWithDiscovery(trinketId, context.setRunTrinkets);
  return { followUp: null };
}

function gainRandomMysteryTrinket(context: MysteryEffectContext) {
  const randomTrinket = sampleItems(trinketLibrary, 1)[0];
  if (randomTrinket) gainMysteryTrinket(randomTrinket.id, context);
  return { followUp: null };
}

function gainMysteryMaterial(material: MaterialId, amount: number, context: MysteryEffectContext) {
  const matInv = emptyInventory();
  matInv[material] = amount;
  context.onAddMaterials(matInv);
  return { followUp: null };
}
