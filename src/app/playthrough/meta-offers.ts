import { mutateGearWithFlush, salvageGearWithFlush } from "@/features/alchemy/meta/screens/armory/armory-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { purchaseTalent } from "@/features/alchemy/shared/stores/navigation-commands";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { flushSaveAfterGearMutation } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  createRunSessionCommand,
  rejectCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  bondCompanion,
  completeResearch,
  constructBuilding,
  plantFarm,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  canUnlockTalent,
  cardLibrary,
  isCharacterUnlocked,
  isGameModeUnlocked,
  isProgressionFeatureUnlocked,
  talentPool,
} from "@/lib/game-data";
import {
  canApplyCraftingCurrency,
  CRAFTING_CURRENCY_LIST,
  equipGear,
  flattenGearInventories,
  GEAR_SLOTS,
  gearDefinitions,
  isGearCompatibleWithLoadoutSlot,
  type GearInstance,
} from "@/lib/gear";
import { companionTierItems } from "@/lib/homestead/companions";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { canUpgradeTierItem } from "@/lib/homestead/upgrades";
import type { createSeededRng } from "@/lib/rng";
import { scoreStrategyKeyword } from "./archetype-policy";
import type { OfferChoice } from "./choice-catalog";
import type { createPlaythroughController } from "./controller";
import type { CareerConfig } from "./types";

interface MetaOfferContext {
  config: CareerConfig;
  flow: ReturnType<typeof createPlaythroughController>["flow"];
  offer: OfferChoice;
  crafted: Set<string>;
  craftingRandom: ReturnType<typeof createSeededRng>;
}

export function offerMetaChoices(
  { config, flow, offer, crafted, craftingRandom }: MetaOfferContext,
  gameSession: GameSession,
): void {
  const profile = readRunProfile(gameSession);
  const keywordAffinity = (keyword: Parameters<typeof scoreStrategyKeyword>[2]) =>
    scoreStrategyKeyword(config.policy, config.hero, keyword, readActiveRun(gameSession).runDeck);
  const finished = readProfileStore(gameSession).finishedRunCharacters;
  if (!isCharacterUnlocked(config.hero, finished) || !isGameModeUnlocked(config.mode, finished))
    throw new Error(
      "Unsupported configuration: hero or mode is locked; use an explicitly labeled fixture or earn the unlock",
    );
  if (isProgressionFeatureUnlocked("homestead", finished)) {
    const discoveredCardIds = new Set(readProfileStore(gameSession).discoveredCardIds);
    for (const item of buildings)
      if (canUpgradeTierItem(item, profile.constructedBuildings[item.id], profile.materialInventory))
        offer("building", item.id, 4, () =>
          createRunSessionCommand(
            (...args: Parameters<typeof constructBuilding>) => {
              const ok = constructBuilding(...args);
              return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
            },
            undefined,
            gameSession,
          )(item.id),
        );
    for (const item of farmPlots)
      if (canUpgradeTierItem(item, profile.plantedFarms[item.id], profile.materialInventory))
        offer("farm", item.id, 3, () =>
          createRunSessionCommand(
            (...args: Parameters<typeof plantFarm>) => {
              const ok = plantFarm(...args);
              return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
            },
            undefined,
            gameSession,
          )(item.id),
        );
    for (const item of researchUpgrades)
      if (canUpgradeTierItem(item, profile.completedResearch[item.id], profile.materialInventory))
        offer("research", item.id, 3, () =>
          createRunSessionCommand(
            (...args: Parameters<typeof completeResearch>) => {
              const ok = completeResearch(...args);
              return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
            },
            undefined,
            gameSession,
          )(item.id),
        );
    for (const item of companionTierItems)
      if (
        canUpgradeTierItem(item, profile.bondedCompanions[item.id], profile.materialInventory) &&
        cardLibrary.some(
          (card) =>
            discoveredCardIds.has(card.id) &&
            card.effects.some((effect) => effect.kind === "summon-companion" && effect.companionId === item.id),
        )
      )
        offer("bond", item.id, 3, () =>
          createRunSessionCommand(
            (...args: Parameters<typeof bondCompanion>) => {
              const ok = bondCompanion(...args);
              return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
            },
            undefined,
            gameSession,
          )(item.id),
        );
  }
  if (isProgressionFeatureUnlocked("talents", finished)) {
    for (const talent of talentPool)
      if (canUnlockTalent(talent.keywordId, talent.id, profile.talentXP, profile.unlockedTalents).ok)
        offer("talent", talent.id, 3 + keywordAffinity(talent.keywordId), () =>
          purchaseTalent(talent.keywordId, talent.id, gameSession),
        );
  }
  const gear = readGearState(gameSession);
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
            () => flushSaveAfterGearMutation(null, gameSession),
            (state) => state.equip(config.hero, slot, item),
            gameSession,
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
            () => flushSaveAfterGearMutation(null, gameSession),
            (state) => state.applyCurrency(currency.id, item.instanceId, { rng: craftingRandom }),
            gameSession,
          );
        });
  }
  for (const item of gear.inventories[config.hero]) {
    if (
      !Object.values(gear.loadouts).some((slots) => Object.values(slots).includes(item.instanceId)) &&
      inventory.some((other) => other.definitionId === item.definitionId && gearScore(other) > gearScore(item))
    )
      offer("salvage", item.instanceId, 1, () =>
        salvageGearWithFlush(() => flushSaveAfterGearMutation(null, gameSession), item.instanceId, gameSession),
      );
  }
  if (!gear.equippedTrinkets[config.hero])
    for (const id of gear.ownedTrinketIds)
      offer("equip-trinket", id, 2, () =>
        mutateGearWithFlush(
          () => flushSaveAfterGearMutation(null, gameSession),
          (state) => state.equipTrinket(config.hero, id),
          gameSession,
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
