import {
  isLootEligible,
  resolveLootWeights,
  rollLootGroup,
  type LootAvailability,
  type LootProgress,
  type LootSource,
} from "@/lib/loot";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  getCardKeywords,
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
} from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import { pickRandom, sampleItems } from "@/lib/rng";
import {
  gearBaseItemList,
  generateGearRewardChoicesForRarity,
  generateLootGearChoices,
  getGearLootAvailability,
  getRewardLootAvailability,
} from "@/lib/gear";
import type { BoonRewardState, CardRewardState, GearRewardState, TrinketRewardState } from "@/lib/active-run-session";

export type RewardOffer =
  | Pick<CardRewardState, "rewardType" | "choices">
  | Pick<BoonRewardState, "rewardType" | "choices">
  | Pick<TrinketRewardState, "rewardType" | "choices">
  | Pick<GearRewardState, "rewardType" | "choices">;

export interface RewardOfferInput {
  source: LootSource;
  lootProgress: LootProgress;
  rng: () => number;
  runDeck?: BattleCard[];
  gearAstralChanceBonus?: number;
  ownedTrinketIds?: readonly string[];
  excludedBoonIds?: readonly string[];
  ownedUniqueIds?: ReadonlySet<string>;
  rewardModifiers?: readonly EncounterRewardTraitId[];
}

export function getRandomPotionCard(rng: () => number): BattleCard | null {
  const potion = pickRandom(getStandardPotionPool(), rng);
  if (!potion) {
    // The pool is statically populated; a data error skips the grant instead of
    // aborting the reward claim mid-command.
    if (import.meta.env.DEV)
      console.warn("[reward-offers] getRandomPotionCard: no potion cards in getStandardPotionPool()");
    return null;
  }
  return potion;
}

export function getCompanionCardChoices(
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = ["companion"],
): BattleCard[] {
  const theme = modifiers.includes("fletched")
    ? "archery"
    : modifiers.includes("wishkeeper")
      ? "wish"
      : modifiers.includes("kindred-spoils")
        ? "nature"
        : "companion";
  const companions =
    theme === "companion"
      ? getOfferableCardPool().filter((c) => c.effects?.some((e) => e.kind === "summon-companion"))
      : getOfferableCardPool().filter((card) => getCardKeywords(card).includes(theme));
  return sampleItems(companions, LABYRINTH_REWARD_CONFIG.companionCardChoices, rng);
}

function hoardBaseIds(modifier: EncounterRewardTraitId): string[] | null {
  if (modifier === "arms-hoard")
    return gearBaseItemList
      .filter((base) => base.compatibleSlots.includes("main-hand") || base.compatibleSlots.includes("off-hand"))
      .map((base) => base.id);
  if (modifier === "armor-hoard")
    return gearBaseItemList.filter((base) => base.compatibleSlots.includes("body")).map((base) => base.id);
  if (modifier === "ring-hoard")
    return gearBaseItemList.filter((base) => base.id.endsWith("-ring")).map((base) => base.id);
  if (modifier === "amulet-hoard")
    return gearBaseItemList.filter((base) => base.id.endsWith("-amulet")).map((base) => base.id);
  return null;
}

function createHoardRewardState({
  rewardModifiers,
  lootProgress,
  source,
  rng,
  ownedUniqueIds,
  trinkets,
  availability,
  gearAstralChanceBonus,
}: {
  rewardModifiers: readonly EncounterRewardTraitId[];
  lootProgress: LootProgress;
  source: LootSource;
  rng: () => number;
  ownedUniqueIds: ReadonlySet<string>;
  trinkets: typeof trinketLibrary;
  availability: LootAvailability;
  gearAstralChanceBonus: number;
}): RewardOffer | null {
  for (const modifier of rewardModifiers) {
    const baseIds = hoardBaseIds(modifier);
    if (baseIds) {
      const gearAvailable = getGearLootAvailability(ownedUniqueIds, baseIds);
      if (baseIds.length === 0 || (!gearAvailable.basic && !gearAvailable.astral)) return null;
      const weights = resolveLootWeights({
        source,
        progress: lootProgress,
        astralChanceBonus: gearAstralChanceBonus,
        available: { ...gearAvailable, card: false, boon: false, trinket: false, unique: false },
      });
      const choices = generateLootGearChoices(REWARD_CARD_CHOICES, rng, weights, ownedUniqueIds, baseIds, true);
      return choices.length > 0 ? { rewardType: "gear", choices } : null;
    }
    if (modifier === "astral-hoard" || modifier === "unique-hoard") {
      const rarity = modifier === "astral-hoard" ? "astral" : "unique";
      if (!isLootEligible(rarity, lootProgress.depth) || availability[rarity] === false) return null;
      const choices = generateGearRewardChoicesForRarity(REWARD_CARD_CHOICES, rarity, rng, ownedUniqueIds);
      return choices.length > 0 ? { rewardType: "gear", choices } : null;
    }
    if (modifier === "trinket-hoard") {
      if (!isLootEligible("trinket", lootProgress.depth) || trinkets.length === 0) return null;
      return {
        rewardType: "trinket",
        choices: sampleItems(trinkets, REWARD_CARD_CHOICES, rng),
      };
    }
  }
  return null;
}

export function createRewardOffer({
  source,
  lootProgress,
  rng,
  runDeck = [],
  gearAstralChanceBonus = 0,
  ownedTrinketIds = [],
  excludedBoonIds = [],
  ownedUniqueIds = new Set(),
  rewardModifiers = [],
}: RewardOfferInput): RewardOffer {
  const cards = getOfferableCardPool();
  // "boon" and "trinket" rewards draw from the same trinketLibrary with
  // different exclusion sets: boons exclude currently-active effects (so a
  // reward never duplicates what is already equipped), trinkets exclude the
  // permanent collection. The split is load-bearing for persistence, which
  // serializes each reward type on its own branch.
  const boons = trinketLibrary.filter((entry) => !excludedBoonIds.includes(entry.id));
  const trinkets = trinketLibrary.filter((entry) => !ownedTrinketIds.includes(entry.id));
  const availability = getRewardLootAvailability(ownedUniqueIds, {
    cards: cards.length > 0,
    boons: boons.length > 0,
    trinkets: trinkets.length > 0,
  });
  const weights = resolveLootWeights({
    source,
    progress: lootProgress,
    astralChanceBonus: gearAstralChanceBonus,
    available: availability,
  });
  const hoard = createHoardRewardState({
    rewardModifiers,
    lootProgress,
    source,
    rng,
    ownedUniqueIds,
    trinkets,
    availability,
    gearAstralChanceBonus,
  });
  if (hoard) return hoard;
  const category = rollLootGroup(weights, rng);
  switch (category) {
    case "gear":
      return {
        rewardType: "gear",
        choices: generateLootGearChoices(REWARD_CARD_CHOICES, rng, weights, ownedUniqueIds),
      };
    case "trinket":
      return {
        rewardType: "trinket",
        choices: sampleItems(trinkets, REWARD_CARD_CHOICES, rng),
      };
    case "boon":
      return { rewardType: "boon", choices: sampleItems(boons, REWARD_CARD_CHOICES, rng) };
    case "card":
      return { rewardType: "card", choices: selectRewardCards(runDeck, cards, REWARD_CARD_CHOICES, [], rng) };
  }
}
