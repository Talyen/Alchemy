// App-level display values for screen routes (character art, layout mode).
import { createContext, useContext, type ReactNode } from "react";
import { characterArt, characters } from "@/lib/game-data";
import { hasUnspentTalents } from "@/app/talent-affordability";
import { hasAffordableHomesteadUpgrade } from "@/app/homestead-affordability";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import type { Screen } from "@/lib/routing";
import type { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";

export type AppScreenChrome = {
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  hasUnspentTalents: boolean;
  hasAffordableHomestead: boolean;
  returnToRunScreen: Screen | null;
};

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

  const materialInventory = useHomesteadStore((s) => s.materialInventory);
  const constructedBuildings = useHomesteadStore((s) => s.constructedBuildings);
  const plantedFarms = useHomesteadStore((s) => s.plantedFarms);
  const completedResearch = useHomesteadStore((s) => s.completedResearch);
  const bondedCompanions = useHomesteadStore((s) => s.bondedCompanions);
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
