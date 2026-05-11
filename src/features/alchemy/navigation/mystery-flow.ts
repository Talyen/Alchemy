// Mystery event effect dispatcher used by run navigation.
// Depends on game data pools, reward utilities, audio feedback, and mystery event types.
import { cardLibrary, trinketLibrary, type BattleCard, type KeywordId } from "@/lib/game-data";
import { playGoldGain, playGoldSpend } from "@/lib/audio";
import { MIXED_POTION_CARD_ID, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { appendUnique, pickRandom } from "@/lib/utils";
import { emptyInventory, type MaterialId, type MaterialInventory } from "@/lib/homestead/types";
import type { Dispatch, SetStateAction } from "react";

import type { MysteryEffect } from "../mystery-events";
import { sampleItems } from "../utils";

type MysteryEffectContext = {
  runMaxHealth: number;
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setRunGold: Dispatch<SetStateAction<number>>;
  setRunPlayerHealth: Dispatch<SetStateAction<number>>;
  setRunTrinkets: Dispatch<SetStateAction<string[]>>;
  setDiscoveredCardIds: Dispatch<SetStateAction<string[]>>;
  setDiscoveredTrinketIds: Dispatch<SetStateAction<string[]>>;
  setMysteryCardChoices: Dispatch<SetStateAction<BattleCard[] | null>>;
  awardMysteryXP: (keyword: KeywordId, amount: number) => void;
  onAddMaterials: (materials: MaterialInventory) => void;
};

// Applies a single mystery effect and returns true only when follow-up UI should pause the event.
export function applyMysteryEffect(effect: MysteryEffect, context: MysteryEffectContext): boolean {
  switch (effect.kind) {
    case "addCard": return addSpecificMysteryCard(effect.cardId, context);
    case "addRandomCard": return addRandomMysteryCard(context);
    case "chooseCard": return offerMysteryCardChoices(context);
    case "healHP": return healFromMystery(effect.amount, effect.chance, context);
    case "damageHP": return damageFromMystery(effect.amount, context);
    case "gainGold": return gainMysteryGold(effect.amount, context);
    case "loseGold": return loseMysteryGold(effect.amount, context);
    case "gainMaxMana": return false;
    case "gainXP": context.awardMysteryXP(effect.keyword, effect.amount); return false;
    case "removeCard": return removeMysteryCard(effect.mode, context);
    case "gainTrinket": return gainMysteryTrinket(effect.trinketId, context);
    case "gainRandomTrinket": return gainRandomMysteryTrinket(context);
    case "gainMaterial": return gainMysteryMaterial(effect.material, effect.amount, context);
    case "none": return false;
  }
}

// The mixed potion is a generated shop result, so mystery random card rewards exclude it.
export function getMysteryCardPool() {
  return cardLibrary.filter((c) => c.id !== MIXED_POTION_CARD_ID);
}

// Shared card reward mutation keeps discovery tracking aligned with deck changes.
export function addCardToRun(card: BattleCard, context: Pick<MysteryEffectContext, "setRunDeck" | "setDiscoveredCardIds">): void {
  context.setRunDeck((p) => [...p, card]);
  context.setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
}

function addSpecificMysteryCard(cardId: string, context: MysteryEffectContext) {
  const card = cardLibrary.find((c) => c.id === cardId);
  if (card) addCardToRun(card, context);
  return false;
}

function addRandomMysteryCard(context: MysteryEffectContext) {
  const card = pickRandom(getMysteryCardPool());
  if (card) addCardToRun(card, context);
  return false;
}

function offerMysteryCardChoices(context: MysteryEffectContext) {
  context.setMysteryCardChoices(sampleItems(getMysteryCardPool(), MYSTERY_CARD_CHOICES));
  return true;
}

function healFromMystery(amount: number, chance: number | undefined, context: MysteryEffectContext) {
  if (chance !== undefined && Math.random() >= chance) return false;
  context.setRunPlayerHealth((p) => Math.min(context.runMaxHealth, p + amount));
  return false;
}

function damageFromMystery(amount: number, context: MysteryEffectContext) {
  context.setRunPlayerHealth((p) => Math.max(0, p - amount));
  return false;
}

function gainMysteryGold(amount: number, context: MysteryEffectContext) {
  if (amount > 0) playGoldGain();
  context.setRunGold((p) => p + amount);
  return false;
}

function loseMysteryGold(amount: number, context: MysteryEffectContext) {
  if (amount > 0) playGoldSpend();
  context.setRunGold((p) => Math.max(0, p - amount));
  return false;
}

function removeMysteryCard(mode: "random" | "choose", context: MysteryEffectContext) {
  // Choice-based removal is handled by the screen picker; this helper only mutates immediately.
  if (mode !== "random") return false;
  context.setRunDeck((p) => {
    if (p.length === 0) return p;
    const idx = Math.floor(Math.random() * p.length);
    return p.filter((_, i) => i !== idx);
  });
  return false;
}

function gainMysteryTrinket(trinketId: string, context: MysteryEffectContext) {
  context.setRunTrinkets((p) => [...p, trinketId]);
  context.setDiscoveredTrinketIds((cur) => appendUnique(cur, trinketId));
  return false;
}

function gainRandomMysteryTrinket(context: MysteryEffectContext) {
  const randomTrinket = sampleItems(trinketLibrary, 1)[0];
  if (randomTrinket) gainMysteryTrinket(randomTrinket.id, context);
  return false;
}

function gainMysteryMaterial(material: MaterialId, amount: number, context: MysteryEffectContext) {
  const matInv = emptyInventory();
  matInv[material] = amount;
  context.onAddMaterials(matInv);
  return false;
}
