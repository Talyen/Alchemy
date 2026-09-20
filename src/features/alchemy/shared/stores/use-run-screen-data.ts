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

function selectGoldBase(state: GameplayState) {
  return { gold: state.runProfile.gold };
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

// Shared shape for every visit-backed screen hook: select the screen slice,
// then retain the outgoing screen's data while its successor fades in.
// Each exported hook below passes static arguments, so hook order is stable.
function useVisitScreenData<S extends RunDataScreen>(
  screen: S,
  selector: (state: GameplayState) => ScreenData<S>,
): ScreenData<S> {
  const data = useGameplayStateStore(useShallow(selector));
  return useActivityScreenData(screen, data);
}

export function useShopScreenData(): ScreenData<"shop"> {
  return useVisitScreenData("shop", (state) => ({
    ...selectShopCardBase(state),
    shopState: readActivityData(state.session.activity, "shop"),
  }));
}

export function useAlchemistScreenData(): ScreenData<"alchemist"> {
  return useVisitScreenData("alchemist", (state) => ({
    ...selectShopCardBase(state),
    alchemistState: readActivityData(state.session.activity, "alchemist"),
  }));
}

export function useTrinketShopScreenData(): ScreenData<"trinket-shop"> {
  return useVisitScreenData("trinket-shop", (state) => ({
    ...selectGoldBase(state),
    trinketShopState: readActivityData(state.session.activity, "trinket-shop"),
  }));
}

export function useEquipmentShopScreenData(): ScreenData<"equipment-shop"> {
  return useVisitScreenData("equipment-shop", (state) => ({
    ...selectGoldBase(state),
    equipmentShopState: readActivityData(state.session.activity, "equipment-shop"),
  }));
}

export function useCampfireScreenData(): ScreenData<"campfire"> {
  return useVisitScreenData("campfire", (state) => ({
    modifiers: activeLabyrinthBenefits(
      state.run.activeRun.contentSystemType,
      state.session.activeLabyrinthRewardModifiers,
    ),
    runPlayerHealth: state.run.activeRun.runPlayerHealth,
    runMaxHealth: state.run.activeRun.runMaxHealth,
  }));
}

export function useLabyrinthMapScreenData(): ScreenData<"labyrinth-map"> {
  return useVisitScreenData("labyrinth-map", (state) => ({
    labyrinthMap: state.session.labyrinthMap,
    selectedLabyrinthNodeId: state.session.selectedLabyrinthNodeId,
  }));
}

export function useRewardsScreenData(): ScreenData<"rewards"> {
  return useVisitScreenData("rewards", (state) => ({
    rewardState: state.session.rewardFlow.state,
    rewardClaimInFlight: state.session.rewardFlow.claim.kind === "reward",
  }));
}

export function useDestinationScreenData(): ScreenData<"destination"> {
  return useVisitScreenData("destination", (state) => ({ rewardState: state.session.rewardFlow.state }));
}

export function useMysteryScreenData(): ScreenData<"mystery"> {
  return useVisitScreenData("mystery", (state) => {
    const visit = readActivityData(state.session.activity, "mystery");
    return {
      mysteryEvent: visit.mysteryEvent,
      mysteryCardChoices: visit.mysteryCardChoices,
      mysteryGrantedTrinketIds: visit.mysteryGrantedTrinketIds,
      mysteryGrantedGearInstances: visit.mysteryGrantedGearInstances,
      mysteryChosenCardId: visit.mysteryChosenCardId,
      mysteryChosenChoice: visit.mysteryChosenChoice,
      // runTalentXP accrues during this run; talentXP is the permanent profile
      // total. Screens sum both for display (see mystery-reward-summary).
      runTalentXP: state.run.activeRun.runTalentXP,
      talentXP: state.runProfile.talentXP,
    };
  });
}

export function useCorruptionScreenData(): ScreenData<"corruption"> {
  return useVisitScreenData("corruption", (state) => ({
    runDeck: state.run.activeRun.runDeck,
    corruptionResult: readActivityData(state.session.activity, "corruption"),
  }));
}

export function useRunEndScreenData(): ScreenData<"game-over"> {
  // Deliberately keyed on navigation.screen, not session.activity like every
  // hook above: run end clears the activity to inactive (there are no
  // game-over/run-victory activity kinds), so activity-keyed retention would
  // never activate. Do not "unify" this with useVisitScreenData.
  const active = useGameplayStateStore(
    (state) => state.run.navigation.screen === "game-over" || state.run.navigation.screen === "run-victory",
  );
  const data = useGameplayStateStore(
    useShallow((state) => ({
      characterId: state.run.activeRun.characterId,
      runEndMaterials: state.session.runEndMaterials,
      runEndCurrencies: state.session.runEndCurrencies,
      runEndTalentXP: state.session.runEndTalentXP,
      runEndItems: state.session.runEndItems,
      runRecap: state.session.runRecap,
      runEndLabyrinthFloor: state.session.runEndLabyrinthFloor,
      talentXP: state.runProfile.talentXP,
    })),
  );
  return useRetainedScreenData(active, data);
}

export function useWildwoodRemovalScreenData(): ScreenData<"wildwood-removal"> {
  return useVisitScreenData("wildwood-removal", (state) => ({ runDeck: state.run.activeRun.runDeck }));
}
