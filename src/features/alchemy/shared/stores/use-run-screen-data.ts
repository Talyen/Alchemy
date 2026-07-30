// Screen-scoped React read hooks. Each hook subscribes only to the stores and
// fields required by its screen, and its return type describes exactly that data.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Screen } from "@/lib/routing";
import { useRunSessionCommitStore } from "./run-session-transaction";
import type { RunDataScreen, RunScreenDataByScreen } from "./run-screen-data";
import type { AlchemistState, RewardState, ShopState } from "@/lib/active-run-session";
import type { MysteryEvent } from "@/lib/mystery";

type ScreenData<S extends RunDataScreen> = RunScreenDataByScreen[S];

function useHealthFields(): ScreenData<"campfire"> {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      runPlayerHealth: snapshot.domain.activeRun.runPlayerHealth,
      runMaxHealth: snapshot.domain.activeRun.runMaxHealth,
    })),
  );
}

function useRunGoldAndDeck(): Pick<ScreenData<"shop">, "runGold" | "runDeck"> {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      runGold: snapshot.domain.activeRun.runGold,
      runDeck: snapshot.domain.activeRun.runDeck,
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
  const shopState = useRunSessionCommitStore((state) => state.snapshot.transient.shopState);
  return useMemo(() => ({ ...run, shopState }), [run, shopState]);
}

export function useAlchemistScreenData(): ScreenData<"alchemist"> {
  const run = useRunGoldAndDeck();
  const alchemistState = useRunSessionCommitStore((state) => state.snapshot.transient.alchemistState);
  return useMemo(() => ({ ...run, alchemistState }), [run, alchemistState]);
}

export function useTrinketShopScreenData(): ScreenData<"trinket-shop"> {
  const runGold = useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.runGold);
  const trinketShopState = useRunSessionCommitStore((state) => state.snapshot.transient.trinketShopState);
  return useMemo(() => ({ runGold, trinketShopState }), [runGold, trinketShopState]);
}

export function useEquipmentShopScreenData(): ScreenData<"equipment-shop"> {
  const runGold = useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.runGold);
  const equipmentShopState = useRunSessionCommitStore((state) => state.snapshot.transient.equipmentShopState);
  return useMemo(() => ({ runGold, equipmentShopState }), [runGold, equipmentShopState]);
}

export function useLabyrinthMapScreenData(): ScreenData<"labyrinth-map"> {
  const labyrinthMap = useRunSessionCommitStore((state) => state.snapshot.transient.labyrinthMap);
  return useMemo(() => ({ labyrinthMap }), [labyrinthMap]);
}

function useRewardState(): RewardState {
  return useRunSessionCommitStore((state) => state.snapshot.transient.rewardState);
}

export function useRewardsScreenData(): ScreenData<"rewards"> {
  const rewardState = useRewardState();
  return useMemo(() => ({ rewardState }), [rewardState]);
}

export function useDestinationScreenData(): ScreenData<"destination"> {
  const rewardState = useRewardState();
  return useMemo(() => ({ rewardState }), [rewardState]);
}

export function useMysteryScreenData(): ScreenData<"mystery"> {
  const runDeck = useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.runDeck);
  const mystery = useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      mysteryEvent: snapshot.transient.mysteryEvent,
      mysteryCardChoices: snapshot.transient.mysteryCardChoices,
    })),
  );
  return useMemo(() => ({ ...mystery, runDeck }), [mystery, runDeck]);
}

export function useCorruptionScreenData(): ScreenData<"corruption"> {
  const runDeck = useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.runDeck);
  const corruptionResult = useRunSessionCommitStore((state) => state.snapshot.transient.corruptionResult);
  return useMemo(() => ({ runDeck, corruptionResult }), [runDeck, corruptionResult]);
}

function useRunEndFields(): ScreenData<"game-over"> {
  const { runEndMaterials, runEndTalentXP } = useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      runEndMaterials: snapshot.transient.runEndMaterials,
      runEndTalentXP: snapshot.transient.runEndTalentXP,
    })),
  );
  const talentXP = useRunSessionCommitStore((state) => state.snapshot.runProfile.talentXP);
  return useMemo(() => ({ runEndMaterials, runEndTalentXP, talentXP }), [runEndMaterials, runEndTalentXP, talentXP]);
}

export function useGameOverScreenData(): ScreenData<"game-over"> {
  return useRunEndFields();
}

export function useRunVictoryScreenData(): ScreenData<"run-victory"> {
  return useRunEndFields();
}

export function useWildwoodRemovalScreenData(): ScreenData<"wildwood-removal"> {
  const runDeck = useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.runDeck);
  return useMemo(() => ({ runDeck }), [runDeck]);
}

/**
 * Small cross-screen projection used only by the asset preloader. It remains
 * screen-aware, but does not pretend to contain every route's display fields.
 */
export interface ScreenAssetPreloadData {
  rewardState: RewardState | null;
  shopState: ShopState | null;
  alchemistState: AlchemistState | null;
  mysteryEvent: MysteryEvent | null;
}

export function useScreenAssetPreloadData(screen: Screen): ScreenAssetPreloadData {
  const rewardState = useRunSessionCommitStore((state) =>
    screen === "rewards" ? state.snapshot.transient.rewardState : null,
  );
  const shopState = useRunSessionCommitStore((state) =>
    screen === "shop" ? state.snapshot.transient.shopState : null,
  );
  const alchemistState = useRunSessionCommitStore((state) =>
    screen === "alchemist" ? state.snapshot.transient.alchemistState : null,
  );
  const mysteryEvent = useRunSessionCommitStore((state) =>
    screen === "mystery" ? state.snapshot.transient.mysteryEvent : null,
  );
  return useMemo(
    () => ({ rewardState, shopState, alchemistState, mysteryEvent }),
    [rewardState, shopState, alchemistState, mysteryEvent],
  );
}
