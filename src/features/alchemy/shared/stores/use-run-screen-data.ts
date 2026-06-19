// Selective run/session fields for screens — each screen subscribes only to the
// fields it uses so unrelated state changes do not cause re-renders.
import { useShallow } from "zustand/react/shallow";
import type { Screen } from "@/lib/routing";
import { getRunPhase } from "@/lib/routing";
import { useRunDomainStore } from "./run-domain-store";
import type { RunScreenData } from "./run-screen-data";

export type { RunScreenData } from "./run-screen-data";

const SCREEN_FIELDS: Record<Screen, (keyof RunScreenData)[]> = {
  campfire: ["runPlayerHealth", "runMaxHealth"],
  shop: ["runGold", "runDeck", "shopState"],
  alchemist: ["runGold", "runDeck", "alchemistState"],
  "trinket-shop": ["runGold", "trinketShopState"],
  "equipment-shop": ["runGold", "equipmentShopState"],
  "labyrinth-map": ["labyrinthMap"],
  rewards: ["rewardState"],
  destination: ["rewardState"],
  mystery: ["mysteryEvent", "mysteryCardChoices", "runDeck"],
  corruption: ["runDeck", "corruptionResult"],
  "game-over": ["runEndTalentXP", "talentXP", "runEndMaterials"],
  "run-victory": ["runEndTalentXP", "talentXP", "runEndMaterials"],
  "wildwood-recovery": ["runPlayerHealth", "runMaxHealth"],
  "wildwood-removal": ["runDeck"],
  // Screens that do not use screen data
  options: [],
  menu: [],
  "character-select": [],
  "difficulty-select": [],
  "draft-deck": [],
  battle: [],
  "game-mode-select": [],
  collection: [],
  homestead: [],
  armory: [],
  talents: [],
};

type State = ReturnType<typeof useRunDomainStore.getState>;

const FIELD_GETTERS: { [K in keyof RunScreenData]: (state: State) => RunScreenData[K] } = {
  phase: (state) => getRunPhase(state.navigation.screen, state.battle.hasActiveBattle),
  runPlayerHealth: (state) => state.progress.runPlayerHealth,
  runMaxHealth: (state) => state.progress.runMaxHealth,
  runGold: (state) => state.progress.runGold,
  runDeck: (state) => state.progress.runDeck,
  selectedDifficulty: (state) => state.progress.selectedDifficulty,
  talentXP: (state) => state.progress.talentXP,
  unlockedTalents: (state) => state.progress.unlockedTalents,
  runTalentXP: (state) => state.progress.runTalentXP,
  runEndTalentXP: (state) => state.session.runEndTalentXP,
  hasActiveRun: (state) => state.session.hasActiveRun,
  hasActiveBattle: (state) => state.battle.hasActiveBattle,
  battleState: (state) => state.battle.battleState,
  rewardState: (state) => state.session.rewardState,
  labyrinthMap: (state) => state.session.labyrinthMap,
  mysteryEvent: (state) => state.session.mysteryEvent,
  mysteryCardChoices: (state) => state.session.mysteryCardChoices,
  corruptionResult: (state) => state.session.corruptionResult,
  shopState: (state) => state.session.shopState,
  alchemistState: (state) => state.session.alchemistState,
  trinketShopState: (state) => state.session.trinketShopState,
  equipmentShopState: (state) => state.session.equipmentShopState,
  runEndMaterials: (state) => state.session.runEndMaterials,
  pendingCharacterId: (state) => state.session.pendingCharacterId,
};

export function useRunScreenData(screen: Screen): RunScreenData {
  return useRunDomainStore(
    useShallow((state) => {
      const fields = SCREEN_FIELDS[screen] ?? [];
      const data: Partial<RunScreenData> = {};
      for (const field of fields) {
        (data as Record<string, unknown>)[field] = FIELD_GETTERS[field](state);
      }
      return data as RunScreenData;
    }),
  );
}
