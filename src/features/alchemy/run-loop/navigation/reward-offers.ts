import type { BoonRewardState, CardRewardState, GearRewardState, TrinketRewardState } from "@/lib/active-run-session";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import {
  getCardKeywords,
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
} from "@/lib/game-data";
import {
  gearBaseItemList,
  generateGearRewardChoicesForRarity,
  generateLootGearChoices,
  getGearLootAvailability,
  getRewardLootAvailability,
} from "@/lib/gear";
import { isLootEligible, resolveLootWeights, rollLootGroup, type LootProgress, type LootSource } from "@/lib/loot";
import { pickRandom, sampleItems } from "@/lib/rng";

export type RewardOffer =
  | Pick<CardRewardState, "rewardType" | "choices">
  | Pick<BoonRewardState, "rewardType" | "choices">
  | Pick<TrinketRewardState, "rewardType" | "choices">
  | Pick<GearRewardState, "rewardType" | "choices">;

export interface RewardOfferInput {
  source: LootSource;
  lootProgress: LootProgress;
  rng: () => number;
  createInstanceId?: (() => string) | undefined;
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

const HOARD_FILTERS: Partial<Record<EncounterRewardTraitId, (base: (typeof gearBaseItemList)[number]) => boolean>> = {
  "arms-hoard": (base) => base.compatibleSlots.includes("main-hand") || base.compatibleSlots.includes("off-hand"),
  "armor-hoard": (base) => base.compatibleSlots.includes("body"),
  "ring-hoard": (base) => base.id.endsWith("-ring"),
  "amulet-hoard": (base) => base.id.endsWith("-amulet"),
};

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
  createInstanceId,
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
  const weightsFor = (available: typeof availability) =>
    resolveLootWeights({ source, progress: lootProgress, astralChanceBonus: gearAstralChanceBonus, available });
  for (const modifier of rewardModifiers) {
    const hoardFilter = HOARD_FILTERS[modifier];
    if (hoardFilter) {
      const baseIds = gearBaseItemList.filter(hoardFilter).map((base) => base.id);
      const gearAvailable = getGearLootAvailability(ownedUniqueIds, baseIds);
      if (baseIds.length === 0 || (!gearAvailable.basic && !gearAvailable.astral)) break;
      const weights = weightsFor({ ...gearAvailable, card: false, boon: false, trinket: false, unique: false });
      const choices = generateLootGearChoices(
        REWARD_CARD_CHOICES,
        rng,
        weights,
        ownedUniqueIds,
        baseIds,
        true,
        createInstanceId,
      );
      if (choices.length > 0) return { rewardType: "gear", choices };
      break;
    }
    if (modifier === "astral-hoard" || modifier === "unique-hoard") {
      const rarity = modifier === "astral-hoard" ? "astral" : "unique";
      if (!isLootEligible(rarity, lootProgress.depth) || availability[rarity] === false) break;
      const choices = generateGearRewardChoicesForRarity(
        REWARD_CARD_CHOICES,
        rarity,
        rng,
        ownedUniqueIds,
        undefined,
        false,
        createInstanceId,
      );
      if (choices.length > 0) return { rewardType: "gear", choices };
      break;
    }
    if (modifier === "trinket-hoard") {
      if (!isLootEligible("trinket", lootProgress.depth) || trinkets.length === 0) break;
      return {
        rewardType: "trinket",
        choices: sampleItems(trinkets, REWARD_CARD_CHOICES, rng),
      };
    }
  }
  const weights = weightsFor(availability);
  const category = rollLootGroup(weights, rng);
  switch (category) {
    case "gear":
      return {
        rewardType: "gear",
        choices: generateLootGearChoices(
          REWARD_CARD_CHOICES,
          rng,
          weights,
          ownedUniqueIds,
          undefined,
          false,
          createInstanceId,
        ),
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
