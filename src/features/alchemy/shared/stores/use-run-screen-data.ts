// Screen-scoped React read hooks. Each hook subscribes only to the stores and
// fields required by its screen, and its return type describes exactly that data.
import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore } from "./gameplay-state-store";
import type { RunDataScreen, RunScreenDataByScreen } from "./run-screen-data";

type ScreenData<S extends RunDataScreen> = RunScreenDataByScreen[S];

function useHealthFields(): ScreenData<"campfire"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runPlayerHealth: state.run.activeRun.runPlayerHealth,
      runMaxHealth: state.run.activeRun.runMaxHealth,
    })),
  );
}

export function useCampfireScreenData(): ScreenData<"campfire"> {
  return useHealthFields();
}

export function useWildwoodRecoveryScreenData(): ScreenData<"wildwood-recovery"> {
  return useHealthFields();
}

export function useShopScreenData(): ScreenData<"shop"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runGold: state.run.activeRun.runGold,
      runDeck: state.run.activeRun.runDeck,
      shopState: state.session.shopState,
    })),
  );
}

export function useAlchemistScreenData(): ScreenData<"alchemist"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runGold: state.run.activeRun.runGold,
      runDeck: state.run.activeRun.runDeck,
      alchemistState: state.session.alchemistState,
    })),
  );
}

export function useTrinketShopScreenData(): ScreenData<"trinket-shop"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runGold: state.run.activeRun.runGold,
      trinketShopState: state.session.trinketShopState,
    })),
  );
}

export function useEquipmentShopScreenData(): ScreenData<"equipment-shop"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runGold: state.run.activeRun.runGold,
      equipmentShopState: state.session.equipmentShopState,
    })),
  );
}

export function useLabyrinthMapScreenData(): ScreenData<"labyrinth-map"> {
  return useGameplayStateStore(useShallow((state) => ({ labyrinthMap: state.session.labyrinthMap })));
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

function useRunEndFields(): ScreenData<"game-over"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runEndMaterials: state.session.runEndMaterials,
      runEndTalentXP: state.session.runEndTalentXP,
      talentXP: state.runProfile.talentXP,
    })),
  );
}

export function useGameOverScreenData(): ScreenData<"game-over"> {
  return useRunEndFields();
}

export function useRunVictoryScreenData(): ScreenData<"run-victory"> {
  return useRunEndFields();
}

export function useWildwoodRemovalScreenData(): ScreenData<"wildwood-removal"> {
  return useGameplayStateStore(useShallow((state) => ({ runDeck: state.run.activeRun.runDeck })));
}
