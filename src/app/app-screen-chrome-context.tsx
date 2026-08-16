// App-level display values for screen routes (character art, layout mode).
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  cardLibrary,
  characterArt,
  characters,
  type CharacterId,
  type CompanionId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import {
  countImplementedTalents,
  getTalentKeywordProgress,
  getTalentTreeKeywordIds,
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";
import { buildings, visibleFarmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { canAfford } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { useProfileDiscoverySlice } from "@/features/alchemy/shared/stores/profile-store";
import {
  useActiveRunCharacterId,
  useHomesteadProgressSlice,
  useTalentProgressSlice,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import type { Screen } from "@/lib/routing";

function hasUnspentTalents(talentXP: TalentXP, unlockedTalents: UnlockedTalents): boolean {
  return getTalentTreeKeywordIds().some((kwId) => {
    const xp = talentXP[kwId] ?? 0;
    return getTalentKeywordProgress(xp, (unlockedTalents[kwId] ?? []).length, countImplementedTalents(kwId)).hasUnspent;
  });
}

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
  characterId: CharacterId;
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
  aspectMode,
  stagePixelRatio,
  returnToRunScreen,
  children,
}: {
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  returnToRunScreen: Screen | null;
  children: ReactNode;
}) {
  const characterId = useActiveRunCharacterId();
  const { talentXP, unlockedTalents } = useTalentProgressSlice();
  const heroArt = characterArt[characterId];
  const playerName = characters[characterId].name;
  const hasUnspentTalentsBadge = useMemo(
    () => hasUnspentTalents(talentXP, unlockedTalents),
    [talentXP, unlockedTalents],
  );

  const { materialInventory, constructedBuildings, plantedFarms, completedResearch, bondedCompanions } =
    useHomesteadProgressSlice();
  const { discoveredCardIds } = useProfileDiscoverySlice();
  const hasAffordableHomestead = useMemo(
    () =>
      hasAffordableHomesteadUpgrade({
        materialInventory,
        constructedBuildings,
        plantedFarms,
        completedResearch,
        bondedCompanions,
        discoveredCardIds,
      }),
    [bondedCompanions, completedResearch, constructedBuildings, discoveredCardIds, materialInventory, plantedFarms],
  );

  const value = useMemo<AppScreenChrome>(
    () => ({
      characterId,
      heroArt,
      playerName,
      aspectMode,
      stagePixelRatio,
      hasUnspentTalents: hasUnspentTalentsBadge,
      hasAffordableHomestead,
      returnToRunScreen,
    }),
    [
      aspectMode,
      characterId,
      hasAffordableHomestead,
      hasUnspentTalentsBadge,
      heroArt,
      playerName,
      returnToRunScreen,
      stagePixelRatio,
    ],
  );

  return <AppScreenChromeContext.Provider value={value}>{children}</AppScreenChromeContext.Provider>;
}

export function useAppScreenChrome(): AppScreenChrome {
  const value = useContext(AppScreenChromeContext);
  if (!value) {
    throw new Error("useAppScreenChrome must be used within AppScreenChromeProvider");
  }
  return value;
}
