// Screen-aware asset preloading for edge-case images not covered by upfront decode.
// Depends on game-data assets, image preload helpers.
// All main art is decoded during the startup loading screen — this is a safety net
// for images that are dynamically constructed or added after initial load.
import { useEffect } from "react";

import { pileDiscardArt, pileDrawArt } from "@/lib/game-data";
import { preloadImages } from "@/lib/image-preload";
import type { Screen } from "@/features/alchemy/shared/types";

interface ScreenAssetPreloadOptions {
  heroArt: string;
  screen: Screen;
  battleEnemyArt: string;
  battleHand: Array<{ art: string }>;
  rewardChoices: Array<{ art: string }>;
  shopCards: Array<{ art: string }>;
  alchemistPotions: Array<{ art: string }>;
  mysteryEvent: { art?: string } | null;
}

// Preloads only assets for the current or imminent screen so card/enemy art does not
// pop in, without forcing the entire collection into memory on startup.
export function useScreenAssetPreloadEffects({
  heroArt,
  screen,
  battleEnemyArt,
  battleHand,
  rewardChoices,
  shopCards,
  alchemistPotions,
  mysteryEvent,
}: ScreenAssetPreloadOptions) {
  useEffect(() => {
    const priorityImages = [heroArt];
    if (screen === "battle") {
      priorityImages.push(battleEnemyArt, pileDrawArt, pileDiscardArt, ...battleHand.map((card) => card.art));
    }
    if (screen === "rewards") priorityImages.push(...rewardChoices.map((card) => card.art));
    if (screen === "shop") priorityImages.push(...shopCards.map((card) => card.art));
    if (screen === "alchemist") priorityImages.push(...alchemistPotions.map((card) => card.art));
    if (screen === "mystery" && mysteryEvent?.art) priorityImages.push(mysteryEvent.art);
    preloadImages(priorityImages);
  }, [heroArt, screen, battleEnemyArt, battleHand, rewardChoices, shopCards, alchemistPotions, mysteryEvent]);
}
