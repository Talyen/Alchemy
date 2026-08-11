// Screen-scoped React read hooks. Each hook subscribes only to the stores and
// fields required by its screen, and its return type describes exactly that data.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore } from "./gameplay-state-store";
import type { RunDataScreen, RunScreenDataByScreen } from "./run-screen-data";
import type { RewardState } from "@/lib/active-run-session";

type ScreenData<S extends RunDataScreen> = RunScreenDataByScreen[S];

function useHealthFields(): ScreenData<"campfire"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runPlayerHealth: state.run.activeRun.runPlayerHealth,
      runMaxHealth: state.run.activeRun.runMaxHealth,
    })),
  );
}

function useRunGoldAndDeck(): Pick<ScreenData<"shop">, "runGold" | "runDeck"> {
  return useGameplayStateStore(
    useShallow((state) => ({
      runGold: state.run.activeRun.runGold,
      runDeck: state.run.activeRun.runDeck,
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
  const run = useRunGoldAndDeck();
  const shopState = useGameplayStateStore((state) => state.session.shopState);
  return useMemo(() => ({ ...run, shopState }), [run, shopState]);
}

export function useAlchemistScreenData(): ScreenData<"alchemist"> {
  const run = useRunGoldAndDeck();
  const alchemistState = useGameplayStateStore((state) => state.session.alchemistState);
  return useMemo(() => ({ ...run, alchemistState }), [run, alchemistState]);
}

export function useTrinketShopScreenData(): ScreenData<"trinket-shop"> {
  const runGold = useGameplayStateStore((state) => state.run.activeRun.runGold);
  const trinketShopState = useGameplayStateStore((state) => state.session.trinketShopState);
  return useMemo(() => ({ runGold, trinketShopState }), [runGold, trinketShopState]);
}

export function useEquipmentShopScreenData(): ScreenData<"equipment-shop"> {
  const runGold = useGameplayStateStore((state) => state.run.activeRun.runGold);
  const equipmentShopState = useGameplayStateStore((state) => state.session.equipmentShopState);
  return useMemo(() => ({ runGold, equipmentShopState }), [runGold, equipmentShopState]);
}

export function useLabyrinthMapScreenData(): ScreenData<"labyrinth-map"> {
  const labyrinthMap = useGameplayStateStore((state) => state.session.labyrinthMap);
  return useMemo(() => ({ labyrinthMap }), [labyrinthMap]);
}

function useRewardState(): RewardState {
  return useGameplayStateStore((state) => state.session.rewardState);
}

export function useRewardsScreenData(): ScreenData<"rewards"> {
  const rewardState = useRewardState();
  const rewardClaimInFlight = useGameplayStateStore((state) => state.session.rewardClaimInFlight);
  return useMemo(() => ({ rewardState, rewardClaimInFlight }), [rewardState, rewardClaimInFlight]);
}

export function useDestinationScreenData(): ScreenData<"destination"> {
  const rewardState = useRewardState();
  return useMemo(() => ({ rewardState }), [rewardState]);
}

export function useMysteryScreenData(): ScreenData<"mystery"> {
  const runDeck = useGameplayStateStore((state) => state.run.activeRun.runDeck);
  const mystery = useGameplayStateStore(
    useShallow((state) => ({
      mysteryEvent: state.session.mysteryEvent,
      mysteryCardChoices: state.session.mysteryCardChoices,
    })),
  );
  return useMemo(() => ({ ...mystery, runDeck }), [mystery, runDeck]);
}

export function useCorruptionScreenData(): ScreenData<"corruption"> {
  const runDeck = useGameplayStateStore((state) => state.run.activeRun.runDeck);
  const corruptionResult = useGameplayStateStore((state) => state.session.corruptionResult);
  return useMemo(() => ({ runDeck, corruptionResult }), [runDeck, corruptionResult]);
}

function useRunEndFields(): ScreenData<"game-over"> {
  const { runEndMaterials, runEndTalentXP } = useGameplayStateStore(
    useShallow((state) => ({
      runEndMaterials: state.session.runEndMaterials,
      runEndTalentXP: state.session.runEndTalentXP,
    })),
  );
  const talentXP = useGameplayStateStore((state) => state.runProfile.talentXP);
  return useMemo(() => ({ runEndMaterials, runEndTalentXP, talentXP }), [runEndMaterials, runEndTalentXP, talentXP]);
}

export function useGameOverScreenData(): ScreenData<"game-over"> {
  return useRunEndFields();
}

export function useRunVictoryScreenData(): ScreenData<"run-victory"> {
  return useRunEndFields();
}

export function useWildwoodRemovalScreenData(): ScreenData<"wildwood-removal"> {
  const runDeck = useGameplayStateStore((state) => state.run.activeRun.runDeck);
  return useMemo(() => ({ runDeck }), [runDeck]);
}
