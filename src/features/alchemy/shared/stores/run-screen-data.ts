import { readActivityData } from "@/lib/active-run-session";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import type { BattleCard } from "@/lib/game-data";
import type { GameplayState } from "./gameplay-state-store";

// Preserve the card-domain contract rather than exposing the save schema type.
function selectRunDeck(state: GameplayState): BattleCard[] {
  return state.run.activeRun.runDeck;
}

function selectRunEndData(state: GameplayState) {
  return {
    characterId: state.run.activeRun.characterId,
    runEndMaterials: state.session.runEndMaterials,
    runEndCurrencies: state.session.runEndCurrencies,
    runEndTalentXP: state.session.runEndTalentXP,
    runEndItems: state.session.runEndItems,
    runRecap: state.session.runRecap,
    runEndLabyrinthFloor: state.session.runEndLabyrinthFloor,
    talentXP: state.runProfile.talentXP,
  };
}

// Each selector owns its route's exact data contract; types derive from these
// projections so adding or changing a field cannot drift from the runtime data.
export const RUN_SCREEN_SELECTORS = {
  shop: (state: GameplayState) => ({
    gold: state.runProfile.gold,
    runDeck: selectRunDeck(state),
    shopState: readActivityData(state.session.activity, "shop"),
  }),
  alchemist: (state: GameplayState) => ({
    gold: state.runProfile.gold,
    runDeck: selectRunDeck(state),
    alchemistState: readActivityData(state.session.activity, "alchemist"),
  }),
  "trinket-shop": (state: GameplayState) => ({
    gold: state.runProfile.gold,
    trinketShopState: readActivityData(state.session.activity, "trinket-shop"),
  }),
  "equipment-shop": (state: GameplayState) => ({
    gold: state.runProfile.gold,
    equipmentShopState: readActivityData(state.session.activity, "equipment-shop"),
  }),
  campfire: (state: GameplayState) => ({
    modifiers: activeLabyrinthBenefits(
      state.run.activeRun.contentSystemType,
      state.session.activeLabyrinthRewardModifiers,
    ),
    runPlayerHealth: state.run.activeRun.runPlayerHealth,
    runMaxHealth: state.run.activeRun.runMaxHealth,
  }),
  "labyrinth-map": (state: GameplayState) => ({
    labyrinthMap: state.session.labyrinthMap,
    selectedLabyrinthNodeId: state.session.selectedLabyrinthNodeId,
  }),
  rewards: (state: GameplayState) => ({
    rewardState: state.session.rewardFlow.state,
    rewardClaimInFlight: state.session.rewardFlow.claim.kind === "reward",
  }),
  destination: (state: GameplayState) => ({ rewardState: state.session.rewardFlow.state }),
  mystery: (state: GameplayState) => {
    const visit = readActivityData(state.session.activity, "mystery");
    return {
      mysteryEvent: visit.mysteryEvent,
      mysteryCardChoices: visit.mysteryCardChoices,
      mysteryGrantedTrinketIds: visit.mysteryGrantedTrinketIds,
      mysteryGrantedGearInstances: visit.mysteryGrantedGearInstances,
      mysteryChosenCardId: visit.mysteryChosenCardId,
      mysteryChosenChoice: visit.mysteryChosenChoice,
      // Screens sum the current run's XP and the permanent profile total.
      runTalentXP: state.run.activeRun.runTalentXP,
      talentXP: state.runProfile.talentXP,
    };
  },
  corruption: (state: GameplayState) => ({
    runDeck: selectRunDeck(state),
    corruptionResult: readActivityData(state.session.activity, "corruption"),
  }),
  "game-over": selectRunEndData,
  "run-victory": selectRunEndData,
  "wildwood-removal": (state: GameplayState) => ({ runDeck: selectRunDeck(state) }),
};

export type RunDataScreen = keyof typeof RUN_SCREEN_SELECTORS;
export type RunScreenDataByScreen = {
  [S in RunDataScreen]: ReturnType<(typeof RUN_SCREEN_SELECTORS)[S]>;
};
