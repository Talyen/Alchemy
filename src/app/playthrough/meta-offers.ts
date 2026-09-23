import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  constructBuilding,
  plantFarm,
  completeResearch,
  bondCompanion,
  unlockTalent,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { mutateGearWithFlush, salvageGearWithFlush } from "@/features/alchemy/meta/screens/armory/armory-commands";
import { flushSaveAfterGearMutation } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  talentPool,
  canUnlockTalent,
  isProgressionFeatureUnlocked,
  isCharacterUnlocked,
  isGameModeUnlocked,
  cardLibrary,
} from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { canUpgradeTierItem } from "@/lib/homestead/upgrades";
import {
  gearDefinitions,
  equipGear,
  type GearInstance,
  flattenGearInventories,
  GEAR_SLOTS,
  isGearCompatibleWithLoadoutSlot,
  CRAFTING_CURRENCY_LIST,
  canApplyCraftingCurrency,
} from "@/lib/gear";
import type { createSeededRng } from "@/lib/rng";
import type { CareerConfig } from "./types";
import type { createPlaythroughController } from "./controller";
import type { OfferChoice } from "./choice-catalog";
import { scoreStrategyKeyword } from "./archetype-policy";

interface MetaOfferContext {
  config: CareerConfig;
  flow: ReturnType<typeof createPlaythroughController>["flow"];
  offer: OfferChoice;
  crafted: Set<string>;
  craftingRandom: ReturnType<typeof createSeededRng>;
}

export function offerMetaChoices({ config, flow, offer, crafted, craftingRandom }: MetaOfferContext): void {
  const profile = readRunProfile();
  const keywordAffinity = (keyword: Parameters<typeof scoreStrategyKeyword>[2]) =>
    scoreStrategyKeyword(config.policy, config.hero, keyword, readActiveRun().runDeck);
  const finished = readProfileStore().finishedRunCharacters;
  if (!isCharacterUnlocked(config.hero, finished) || !isGameModeUnlocked(config.mode, finished))
    throw new Error(
      "Unsupported configuration: hero or mode is locked; use an explicitly labeled fixture or earn the unlock",
    );
  if (isProgressionFeatureUnlocked("homestead", finished)) {
    const discoveredCardIds = new Set(readProfileStore().discoveredCardIds);
    for (const item of buildings)
      if (canUpgradeTierItem(item, profile.constructedBuildings[item.id], profile.materialInventory))
        offer("building", item.id, 4, () => createRunSessionCommand(constructBuilding)(item.id));
    for (const item of farmPlots)
      if (canUpgradeTierItem(item, profile.plantedFarms[item.id], profile.materialInventory))
        offer("farm", item.id, 3, () => createRunSessionCommand(plantFarm)(item.id));
    for (const item of researchUpgrades)
      if (canUpgradeTierItem(item, profile.completedResearch[item.id], profile.materialInventory))
        offer("research", item.id, 3, () => createRunSessionCommand(completeResearch)(item.id));
    for (const item of companionTierItems)
      if (
        canUpgradeTierItem(item, profile.bondedCompanions[item.id], profile.materialInventory) &&
        cardLibrary.some(
          (card) =>
            discoveredCardIds.has(card.id) &&
            card.effects.some((effect) => effect.kind === "summon-companion" && effect.companionId === item.id),
        )
      )
        offer("bond", item.id, 3, () => createRunSessionCommand(bondCompanion)(item.id));
  }
  if (isProgressionFeatureUnlocked("talents", finished)) {
    for (const talent of talentPool)
      if (canUnlockTalent(talent.keywordId, talent.id, profile.talentXP, profile.unlockedTalents).ok)
        offer("talent", talent.id, 3 + keywordAffinity(talent.keywordId), () =>
          createRunSessionCommand(unlockTalent)(talent.keywordId, talent.id),
        );
  }
  const gear = readGearState();
  const inventory = flattenGearInventories(gear.inventories);
  const loadout = gear.loadouts[config.hero];
  const gearScore = (item: GearInstance) => 1 + item.affixes.reduce((sum, affix) => sum + Math.max(0, affix.value), 0);
  const loadoutScore = (value: typeof loadout) =>
    Object.values(value).reduce(
      (sum, id) =>
        sum +
        (inventory.find((item) => item.instanceId === id)
          ? gearScore(inventory.find((item) => item.instanceId === id)!)
          : 0),
      0,
    );
  for (const item of inventory) {
    const definition = gearDefinitions[item.definitionId];
    if (!definition) continue;
    for (const slot of GEAR_SLOTS) {
      if (
        !Object.values(loadout).includes(item.instanceId) &&
        isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory) &&
        loadoutScore(equipGear(gear.loadouts, config.hero, slot, item, inventory)[config.hero]) > loadoutScore(loadout)
      )
        offer("equip", `${slot}:${item.instanceId}`, 2, () =>
          mutateGearWithFlush(
            () => flushSaveAfterGearMutation(null),
            (state) => state.equip(config.hero, slot, item),
          ),
        );
    }
    for (const currency of CRAFTING_CURRENCY_LIST)
      if (
        !crafted.has(item.instanceId) &&
        gear.craftingCurrencies[currency.id] > 0 &&
        canApplyCraftingCurrency(currency.id, item)
      )
        offer("craft", `${currency.id}:${item.instanceId}`, 1, () => {
          crafted.add(item.instanceId);
          return mutateGearWithFlush(
            () => flushSaveAfterGearMutation(null),
            (state) => state.applyCurrency(currency.id, item.instanceId, { rng: craftingRandom }),
          );
        });
  }
  for (const item of gear.inventories[config.hero]) {
    if (
      !Object.values(gear.loadouts).some((slots) => Object.values(slots).includes(item.instanceId)) &&
      inventory.some((other) => other.definitionId === item.definitionId && gearScore(other) > gearScore(item))
    )
      offer("salvage", item.instanceId, 1, () =>
        salvageGearWithFlush(() => flushSaveAfterGearMutation(null), item.instanceId),
      );
  }
  if (!gear.equippedTrinkets[config.hero])
    for (const id of gear.ownedTrinketIds)
      offer("equip-trinket", id, 2, () =>
        mutateGearWithFlush(
          () => flushSaveAfterGearMutation(null),
          (state) => state.equipTrinket(config.hero, id),
        ),
      );
  offer("start", config.mode, 0, () => {
    crafted.clear();
    flow.goToScreen("game-mode-select");
    if (config.mode === "campaign") flow.beginCampaign();
    else if (config.mode === "labyrinth") flow.beginLabyrinth();
    else flow.beginWildwood();
    flow.handleCharacterSelect(config.hero);
  });
}
