import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import type { RunDataScreen, RunScreenDataByScreen } from "./run-screen-data";

type ScreenData<S extends RunDataScreen> = RunScreenDataByScreen[S];

function selectGold(state: GameplayState) {
  return state.runProfile.gold;
}

function selectShopCardBase(state: GameplayState) {
  return {
    gold: state.runProfile.gold,
    runDeck: state.run.activeRun.runDeck,
  };
}

function createShopDataHook<S extends RunDataScreen>(
  selector: (state: GameplayState) => ScreenData<S>,
): () => ScreenData<S> {
  return () => useGameplayStateStore(useShallow(selector));
}

export function useCampfireScreenData(): ScreenData<"campfire"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runPlayerHealth: state.run.activeRun.runPlayerHealth,
      runMaxHealth: state.run.activeRun.runMaxHealth,
    })),
  );
}

export const useShopScreenData = createShopDataHook<"shop">((state) => ({
  ...selectShopCardBase(state),
  shopState: state.session.shopState,
}));

export const useAlchemistScreenData = createShopDataHook<"alchemist">((state) => ({
  ...selectShopCardBase(state),
  alchemistState: state.session.alchemistState,
}));

export const useTrinketShopScreenData = createShopDataHook<"trinket-shop">((state) => ({
  gold: selectGold(state),
  trinketShopState: state.session.trinketShopState,
}));

export const useEquipmentShopScreenData = createShopDataHook<"equipment-shop">((state) => ({
  gold: selectGold(state),
  equipmentShopState: state.session.equipmentShopState,
}));

export function useLabyrinthMapScreenData(): ScreenData<"labyrinth-map"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      labyrinthMap: state.session.labyrinthMap,
      selectedLabyrinthNodeId: state.session.selectedLabyrinthNodeId,
    })),
  );
}

export function useRewardsScreenData(): ScreenData<"rewards"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      rewardState: state.session.rewardState,
      rewardClaimInFlight: state.session.rewardClaimInFlight,
    })),
  );
}

export function useDestinationScreenData(): ScreenData<"destination"> {
  return useGameplayStateStore(useShallow((state) => ({ rewardState: state.session.rewardState })));
}

export function useMysteryScreenData(): ScreenData<"mystery"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runDeck: state.run.activeRun.runDeck,
      mysteryEvent: state.session.mysteryEvent,
      mysteryCardChoices: state.session.mysteryCardChoices,
      mysteryGrantedTrinketIds: state.session.mysteryGrantedTrinketIds,
      mysteryGrantedGearInstances: state.session.mysteryGrantedGearInstances,
      mysteryChosenCardId: state.session.mysteryChosenCardId,
      mysteryChosenChoice: state.session.mysteryChosenChoice,
      mysteryPendingRemoval: state.session.mysteryPendingRemoval,
      runTalentXP: state.run.activeRun.runTalentXP,
      talentXP: state.runProfile.talentXP,
    })),
  );
}

export function useCorruptionScreenData(): ScreenData<"corruption"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runDeck: state.run.activeRun.runDeck,
      corruptionResult: state.session.corruptionResult,
    })),
  );
}

export function useRunEndScreenData(): ScreenData<"game-over"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      characterId: state.run.activeRun.characterId,
      runEndMaterials: state.session.runEndMaterials,
      runEndTalentXP: state.session.runEndTalentXP,
      runEndItems: state.session.runEndItems,
      runEndLabyrinthFloor: state.session.runEndLabyrinthFloor,
      talentXP: state.runProfile.talentXP,
    })),
  );
}

export function useWildwoodRemovalScreenData(): ScreenData<"wildwood-removal"> {
  return useGameplayStateStore(useShallow((state) => ({ runDeck: state.run.activeRun.runDeck })));
}
