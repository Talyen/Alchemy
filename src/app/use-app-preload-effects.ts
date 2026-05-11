// Root-level startup and screen-aware asset preloading.
// Depends on game-data assets, image preload helpers, and audio preload.
import { useEffect } from "react";

import {
  alchemistShopBg,
  campfire,
  characterArt,
  eliteEnemyBg,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  pileDiscardArt,
  pileDrawArt,
  menuLogo,
} from "@/lib/game-data";
import { preloadAllSounds } from "@/lib/audio";
import { preloadImages, preloadImagesWhenIdle } from "@/lib/image-preload";
import type { Screen } from "@/features/alchemy/types";

type ScreenAssetPreloadOptions = {
  heroArt: string;
  screen: Screen;
  battleEnemyArt: string;
  battleHand: Array<{ art: string }>;
  rewardChoices: Array<{ art: string }>;
  shopCards: Array<{ art: string }>;
  alchemistPotions: Array<{ art: string }>;
  mysteryEvent: { art?: string } | null;
};

// Warms core sounds and shell artwork after first mount without blocking startup.
export function useStartupPreloadEffects() {
  useEffect(() => {
    preloadAllSounds();
    preloadImagesWhenIdle([
      menuLogo,
      ...Object.values(characterArt),
      pileDrawArt,
      pileDiscardArt,
      normalEnemyBg,
      eliteEnemyBg,
      merchantShopBg,
      alchemistShopBg,
      mysteryBg,
      campfire,
    ]);
  }, []);
}

// Preloads only assets for the current or imminent screen so card/enemy art does not
// pop in, without forcing the entire collection into memory on startup.
export function useScreenAssetPreloadEffects({ heroArt, screen, battleEnemyArt, battleHand, rewardChoices, shopCards, alchemistPotions, mysteryEvent }: ScreenAssetPreloadOptions) {
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
