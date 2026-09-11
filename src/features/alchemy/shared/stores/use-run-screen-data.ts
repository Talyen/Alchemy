import { readActivityData } from "@/lib/active-run-session";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import type { RunDataScreen, RunScreenDataByScreen } from "./run-screen-data";

type ScreenData<S extends RunDataScreen> = RunScreenDataByScreen[S];

function selectShopCardBase(state: GameplayState) {
  return {
    gold: state.runProfile.gold,
    runDeck: state.run.activeRun.runDeck,
  };
}

function useRetainedScreenData<T>(active: boolean, data: T): T {
  const [shown, setShown] = useState(data);
  // Retain each outgoing screen's own data while its committed successor fades in.
  if (active && shown !== data) setShown(data);
  return active ? data : shown;
}

function useActivityScreenData<S extends RunDataScreen>(screen: S, data: ScreenData<S>): ScreenData<S> {
  const active = useGameplayStateStore((state) => state.session.activity.kind === screen);
  return useRetainedScreenData(active, data);
}

function createShopDataHook<S extends RunDataScreen>(
  screen: S,
  selector: (state: GameplayState) => ScreenData<S>,
): () => ScreenData<S> {
  return function useScreenData() {
    return useActivityScreenData(screen, useGameplayStateStore(useShallow(selector)));
  };
}

export function useCampfireScreenData(): ScreenData<"campfire"> {
  const data = useGameplayStateStore(
    useShallow((state) => ({
      modifiers: activeLabyrinthBenefits(
        state.run.activeRun.contentSystemType,
        state.session.activeLabyrinthRewardModifiers,
      ),
      runPlayerHealth: state.run.activeRun.runPlayerHealth,
      runMaxHealth: state.run.activeRun.runMaxHealth,
    })),
  );
  return useActivityScreenData("campfire", data);
}

export const useShopScreenData = createShopDataHook<"shop">("shop", (state) => ({
  ...selectShopCardBase(state),
  shopState: readActivityData(state.session.activity, "shop"),
}));

export const useAlchemistScreenData = createShopDataHook<"alchemist">("alchemist", (state) => ({
  ...selectShopCardBase(state),
  alchemistState: readActivityData(state.session.activity, "alchemist"),
}));

export const useTrinketShopScreenData = createShopDataHook<"trinket-shop">("trinket-shop", (state) => ({
  gold: state.runProfile.gold,
  trinketShopState: readActivityData(state.session.activity, "trinket-shop"),
}));

export const useEquipmentShopScreenData = createShopDataHook<"equipment-shop">("equipment-shop", (state) => ({
  gold: state.runProfile.gold,
  equipmentShopState: readActivityData(state.session.activity, "equipment-shop"),
}));

export function useLabyrinthMapScreenData(): ScreenData<"labyrinth-map"> {
  const data = useGameplayStateStore(
    useShallow((state) => ({
      labyrinthMap: state.session.labyrinthMap,
      selectedLabyrinthNodeId: state.session.selectedLabyrinthNodeId,
    })),
  );
  return useActivityScreenData("labyrinth-map", data);
}

export function useRewardsScreenData(): ScreenData<"rewards"> {
  const data = useGameplayStateStore(
    useShallow((state) => ({
      rewardState: state.session.rewardFlow.state,
      rewardClaimInFlight: state.session.rewardFlow.claim.kind === "reward",
    })),
  );
  return useActivityScreenData("rewards", data);
}

export function useDestinationScreenData(): ScreenData<"destination"> {
  const data = useGameplayStateStore(useShallow((state) => ({ rewardState: state.session.rewardFlow.state })));
  return useActivityScreenData("destination", data);
}

export function useMysteryScreenData(): ScreenData<"mystery"> {
  const data = useGameplayStateStore(
    useShallow((state) => ({
      runDeck: state.run.activeRun.runDeck,
      mysteryEvent: readActivityData(state.session.activity, "mystery").mysteryEvent,
      mysteryCardChoices: readActivityData(state.session.activity, "mystery").mysteryCardChoices,
      mysteryGrantedTrinketIds: readActivityData(state.session.activity, "mystery").mysteryGrantedTrinketIds,
      mysteryGrantedGearInstances: readActivityData(state.session.activity, "mystery").mysteryGrantedGearInstances,
      mysteryChosenCardId: readActivityData(state.session.activity, "mystery").mysteryChosenCardId,
      mysteryChosenChoice: readActivityData(state.session.activity, "mystery").mysteryChosenChoice,
      mysteryPendingRemoval: readActivityData(state.session.activity, "mystery").mysteryPendingRemoval,
      runTalentXP: state.run.activeRun.runTalentXP,
      talentXP: state.runProfile.talentXP,
    })),
  );
  return useActivityScreenData("mystery", data);
}

export function useCorruptionScreenData(): ScreenData<"corruption"> {
  const data = useGameplayStateStore(
    useShallow((state) => ({
      runDeck: state.run.activeRun.runDeck,
      corruptionResult: readActivityData(state.session.activity, "corruption"),
    })),
  );
  return useActivityScreenData("corruption", data);
}

export function useRunEndScreenData(): ScreenData<"game-over"> {
  const active = useGameplayStateStore(
    (state) => state.run.navigation.screen === "game-over" || state.run.navigation.screen === "run-victory",
  );
  const data = useGameplayStateStore(
    useShallow((state) => ({
      characterId: state.run.activeRun.characterId,
      runEndMaterials: state.session.runEndMaterials,
      runEndTalentXP: state.session.runEndTalentXP,
      runEndItems: state.session.runEndItems,
      runEndLabyrinthFloor: state.session.runEndLabyrinthFloor,
      talentXP: state.runProfile.talentXP,
    })),
  );
  return useRetainedScreenData(active, data);
}

export function useWildwoodRemovalScreenData(): ScreenData<"wildwood-removal"> {
  const data = useGameplayStateStore(useShallow((state) => ({ runDeck: state.run.activeRun.runDeck })));
  return useActivityScreenData("wildwood-removal", data);
}
