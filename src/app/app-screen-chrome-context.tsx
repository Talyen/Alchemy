// App-level display values for screen routes (character art, layout mode).
import { createContext, useContext, type ReactNode } from "react";
import {
  cardLibrary,
  characterArt,
  characters,
  type CompanionId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { hasUnspentTalents } from "@/app/talent-affordability";
import { buildings, visibleFarmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { canAfford } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadProgressSlice } from "@/features/alchemy/shared/stores/run-session-facade";
import type { Screen } from "@/lib/routing";
import type { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";

function hasAffordableHomesteadUpgrade(input: {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<string, number>;
  plantedFarms: Record<string, number>;
  completedResearch: Record<string, number>;
  bondedCompanions: Record<string, number>;
  discoveredCardIds: string[];
}): boolean {
  const {
    materialInventory,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    discoveredCardIds,
  } = input;

  const affordableBuilding = buildings.some((b) => {
    const currentLevel = constructedBuildings[b.id] ?? 0;
    if (currentLevel >= b.tiers.length) return false;
    const tier = b.tiers[currentLevel];
    if (!tier) return false;
    return canAfford(materialInventory, tier.cost);
  });

  const affordableFarm = visibleFarmPlots.some((f) => {
    const currentLevel = plantedFarms[f.id] ?? 0;
    if (currentLevel >= f.tiers.length) return false;
    const tier = f.tiers[currentLevel];
    if (!tier) return false;
    return canAfford(materialInventory, tier.cost);
  });

  const affordableResearch = researchUpgrades.some((r) => {
    const currentLevel = completedResearch[r.id] ?? 0;
    if (currentLevel >= r.tiers.length) return false;
    const tier = r.tiers[currentLevel];
    if (!tier) return false;
    return canAfford(materialInventory, tier.cost);
  });

  const affordableBond = cardLibrary.some((c) => {
    const effect = c.effects.find(
      (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
    );
    if (!effect) return false;
    if (!discoveredCardIds.includes(c.id)) return false;
    const currentLevel = bondedCompanions[effect.companionId] ?? 0;
    if (currentLevel >= COMPANION_MAX_TIER) return false;
    const bondTier = COMPANION_BOND_TIERS[currentLevel];
    if (!bondTier) return false;
    return canAfford(materialInventory, bondTier);
  });

  return affordableBuilding || affordableFarm || affordableResearch || affordableBond;
}

export interface AppScreenChrome {
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  hasUnspentTalents: boolean;
  hasAffordableHomestead: boolean;
  returnToRunScreen: Screen | null;
}

const AppScreenChromeContext = createContext<AppScreenChrome | null>(null);

export function AppScreenChromeProvider({
  run,
  aspectMode,
  stagePixelRatio,
  returnToRunScreen,
  children,
}: {
  run: ReturnType<typeof useAlchemyRunController>;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  returnToRunScreen: Screen | null;
  children: ReactNode;
}) {
  const heroArt = characterArt[run.characterId];
  const playerName = characters[run.characterId].name;
  const hasUnspentTalentsBadge = hasUnspentTalents(run.talentXP, run.unlockedTalents);

  const { materialInventory, constructedBuildings, plantedFarms, completedResearch, bondedCompanions } =
    useHomesteadProgressSlice();
  const discoveredCardIds = useAppStore((s) => s.discoveredCardIds);
  const hasAffordableHomestead = hasAffordableHomesteadUpgrade({
    materialInventory,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    discoveredCardIds,
  });

  const value: AppScreenChrome = {
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    hasUnspentTalents: hasUnspentTalentsBadge,
    hasAffordableHomestead,
    returnToRunScreen,
  };

  return <AppScreenChromeContext.Provider value={value}>{children}</AppScreenChromeContext.Provider>;
}

export function useAppScreenChrome(): AppScreenChrome {
  const value = useContext(AppScreenChromeContext);
  if (!value) {
    throw new Error("useAppScreenChrome must be used within AppScreenChromeProvider");
  }
  return value;
}
