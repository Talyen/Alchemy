import type { DeckInspectButtonProps } from "@/features/alchemy/shared/ui/deck-inspect-button";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { characterArt, characters, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { hasUnspentTalentPoint } from "@/lib/game-data";
import { hasAffordableHomesteadUpgrade } from "@/lib/homestead/affordability";
import { useProfileDiscoverySlice } from "@/features/alchemy/shared/stores/react/use-profile-store";
import {
  useActiveRunCharacterId,
  useHomesteadProgressSlice,
  useTalentProgressSlice,
} from "@/features/alchemy/shared/stores/react/use-run-reads";
import type { Screen } from "@/lib/routing";

export interface AppScreenChrome {
  characterId: CharacterId;
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  returnToRunScreen: Screen | null;
  openGameMenu?: ((rect?: DOMRect) => void) | undefined;
  isMenuOpen?: boolean | undefined;
  onBack?: (() => void) | undefined;
  deckInspection?: DeckInspectButtonProps | undefined;
}

const AppScreenChromeContext = createContext<AppScreenChrome | null>(null);

export function AppScreenChromeProvider({
  aspectMode,
  stagePixelRatio,
  returnToRunScreen,
  openGameMenu,
  isMenuOpen,
  onBack,
  deckInspection,
  children,
}: {
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  returnToRunScreen: Screen | null;
  openGameMenu?: ((rect?: DOMRect) => void) | undefined;
  isMenuOpen?: boolean | undefined;
  onBack?: (() => void) | undefined;
  deckInspection?: DeckInspectButtonProps | undefined;
  children: ReactNode;
}) {
  const characterId = useActiveRunCharacterId();
  const heroArt = characterArt[characterId];
  const playerName = characters[characterId].name;

  const value = useMemo<AppScreenChrome>(
    () => ({
      characterId,
      heroArt,
      playerName,
      aspectMode,
      stagePixelRatio,
      returnToRunScreen,
      openGameMenu,
      isMenuOpen,
      onBack,
      deckInspection,
    }),
    [
      aspectMode,
      characterId,
      heroArt,
      isMenuOpen,
      onBack,
      deckInspection,
      openGameMenu,
      playerName,
      returnToRunScreen,
      stagePixelRatio,
    ],
  );

  return <AppScreenChromeContext.Provider value={value}>{children}</AppScreenChromeContext.Provider>;
}

/**
 * Menu-only badge derivation (unspent talents / affordable homestead dots).
 * Kept out of AppScreenChromeProvider so every other screen doesn't subscribe
 * to talent, homestead, and discovery slices on each render.
 */
export function useMenuBadges(): { hasUnspentTalents: boolean; hasAffordableHomestead: boolean } {
  const { talentXP, unlockedTalents } = useTalentProgressSlice();
  const hasUnspentTalentsBadge = useMemo(
    () => hasUnspentTalentPoint(talentXP, unlockedTalents),
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

  return { hasUnspentTalents: hasUnspentTalentsBadge, hasAffordableHomestead };
}

export function useAppScreenChrome(): AppScreenChrome {
  const value = useContext(AppScreenChromeContext);
  if (!value) {
    throw new Error("useAppScreenChrome must be used within AppScreenChromeProvider");
  }
  return value;
}

export function useOptionalAppScreenChrome(): AppScreenChrome | null {
  return useContext(AppScreenChromeContext);
}
