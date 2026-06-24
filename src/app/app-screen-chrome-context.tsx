// App-level display values for screen routes (character art, layout mode).
import { createContext, useContext, type ReactNode } from "react";
import { characterArt, characters } from "@/lib/game-data";
import { hasUnspentTalents } from "@/app/talent-affordability";
import { hasAffordableHomesteadUpgrade } from "@/app/homestead-affordability";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { Screen } from "@/lib/routing";
import type { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";

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

  const materialInventory = useRunDomainStore((s) => s.progress.materialInventory);
  const constructedBuildings = useRunDomainStore((s) => s.progress.constructedBuildings);
  const plantedFarms = useRunDomainStore((s) => s.progress.plantedFarms);
  const completedResearch = useRunDomainStore((s) => s.progress.completedResearch);
  const bondedCompanions = useRunDomainStore((s) => s.progress.bondedCompanions);
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
