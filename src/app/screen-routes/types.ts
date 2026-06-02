import type { RenderAlchemyScreenProps } from "@/app/render-screen-props";
import type { RunScreenData } from "@/features/alchemy/stores/use-run-screen-data";
import type { AppStoreActions, HomesteadStoreActions } from "@/features/alchemy/stores/store-actions";
import type { AspectRatioOption, CollectionTab, DisplayMode, UiScale } from "@/features/alchemy/types";

export type ScreenRouteContext = RenderAlchemyScreenProps & {
  runScreenData: RunScreenData;
  appValues: {
    selectedAspectRatio: AspectRatioOption;
    displayMode: DisplayMode;
    uiScale: UiScale;
    brightness: number;
    masterVol: number;
    musicVol: number;
    sfxVol: number;
    muteInBackground: boolean;
    autoEndTurn: boolean;
    discoveredCardIds: string[];
    completedDifficulties: Record<string, import("@/lib/game-data").DifficultyId[]>;
    collectionTab: CollectionTab;
    collectionPages: Record<CollectionTab, number>;
    encounteredEnemyIds: string[];
    discoveredTrinketIds: string[];
    showClearSaveConfirm: boolean;
  };
  appActions: AppStoreActions;
  homesteadValues: {
    materialInventory: import("@/lib/homestead/types").MaterialInventory;
    constructedBuildings: Record<string, number>;
    plantedFarms: Record<string, number>;
    completedResearch: Record<string, number>;
    bondedCompanions: Record<string, number>;
  };
  homesteadActions: HomesteadStoreActions;
};
