// Screen-aware asset preloading for edge-case images not covered by upfront decode.
// Depends on game-data assets, image preload helpers, and run-session capability reads.
// All main art is decoded during the startup loading screen — this is a safety net
// for images that are dynamically constructed or added after initial load.
import { useEffect } from "react";
import { pileDiscardArt, pileDrawArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { preloadImages } from "@/lib/image-preload";
import type { Screen } from "@/features/alchemy/shared/types";
import { gearDefinitions } from "@/lib/gear";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-model";
import { useScreenAssetPreloadData } from "@/features/alchemy/shared/stores/use-run-screen-data";

interface ScreenAssetPreloadOptions {
  heroArt: string;
  screen: Screen;
}

// Preloads only assets for the current or imminent screen so card/enemy art does not
// pop in, without forcing the entire collection into memory on startup.
export function useScreenAssetPreloadEffects({ heroArt, screen }: ScreenAssetPreloadOptions) {
  const data = useScreenAssetPreloadData(screen);
  const { battle } = useRunSessionBattleContext(screen);

  useEffect(() => {
    const priorityImages = [heroArt];
    if (screen === "battle") {
      priorityImages.push(
        battle.battleState.currentEnemy.art,
        pileDrawArt,
        pileDiscardArt,
        ...battle.battleState.hand.map((card) => card.art),
      );
    }
    if (data.rewardState) {
      const rewardChoices =
        data.rewardState.rewardType === "gear"
          ? data.rewardState.choices.map((choice) => ({
              art: gearDefinitions[choice.definitionId]?.art ?? "",
            }))
          : data.rewardState.choices.map((choice) => ({ art: choice.art }));
      priorityImages.push(...rewardChoices.map((choice) => choice.art));
    }
    if (data.shopState) {
      priorityImages.push(...data.shopState.cards.map((card) => card.art));
    }
    if (data.alchemistState) {
      priorityImages.push(...data.alchemistState.potions.map((card) => card.art));
    }
    if (data.mysteryEvent?.art) {
      priorityImages.push(data.mysteryEvent.art);
    }
    preloadImages(priorityImages);
  }, [heroArt, screen, data, battle]);
}
