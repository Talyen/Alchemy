// Selective run/session fields for screens — each screen subscribes only to the
// fields it uses so unrelated state changes do not cause re-renders.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Screen } from "@/lib/routing";
import { useRunDomainStore, type RunDomainStore } from "./run-domain-store";
import { useRunProfileStore, type RunProfileStore } from "./run-profile-store";
import { useRunTransientStore, type RunTransientStore } from "./run-transient-store";
import { useRunBattleDomainStore, type RunBattleDomainStore } from "./run-battle-domain-store";
import type { RunScreenData } from "./run-screen-data";

export type { RunScreenData } from "./run-screen-data";

type ScreenField = keyof RunScreenData;

const SCREEN_FIELDS: Record<Screen, ScreenField[]> = {
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

type FieldGetters<State> = Partial<{ [K in ScreenField]: (state: State) => RunScreenData[K] }>;

const DOMAIN_FIELDS: FieldGetters<RunDomainStore> = {
  runPlayerHealth: (state) => state.activeRun.runPlayerHealth,
  runMaxHealth: (state) => state.activeRun.runMaxHealth,
  runGold: (state) => state.activeRun.runGold,
  runDeck: (state) => state.activeRun.runDeck,
  selectedDifficulty: (state) => state.activeRun.selectedDifficulty,
  runTalentXP: (state) => state.activeRun.runTalentXP,
};

const PROFILE_FIELDS: FieldGetters<RunProfileStore> = {
  talentXP: (profile) => profile.talentXP,
  unlockedTalents: (profile) => profile.unlockedTalents,
};

const TRANSIENT_FIELDS: FieldGetters<RunTransientStore> = {
  runEndTalentXP: (session) => session.runEndTalentXP,
  hasActiveRun: (session) => session.hasActiveRun,
  rewardState: (session) => session.rewardState,
  labyrinthMap: (session) => session.labyrinthMap,
  mysteryEvent: (session) => session.mysteryEvent,
  mysteryCardChoices: (session) => session.mysteryCardChoices,
  corruptionResult: (session) => session.corruptionResult,
  shopState: (session) => session.shopState,
  alchemistState: (session) => session.alchemistState,
  trinketShopState: (session) => session.trinketShopState,
  equipmentShopState: (session) => session.equipmentShopState,
  runEndMaterials: (session) => session.runEndMaterials,
  pendingCharacterId: (session) => session.pendingCharacterId,
};

const BATTLE_FIELDS: FieldGetters<RunBattleDomainStore> = {
  hasActiveBattle: (battle) => battle.hasActiveBattle,
  battleState: (battle) => battle.battleState,
};

function pickScreenFields<State>(
  state: State,
  fields: readonly ScreenField[],
  getters: FieldGetters<State>,
): Partial<RunScreenData> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const read = getters[field] as ((source: State) => unknown) | undefined;
    if (read) data[field] = read(state);
  }
  return data;
}

export function useRunScreenData(screen: Screen): RunScreenData {
  const fields = SCREEN_FIELDS[screen] ?? [];
  const run = useRunDomainStore(useShallow((state) => pickScreenFields(state, fields, DOMAIN_FIELDS)));
  const profile = useRunProfileStore(useShallow((state) => pickScreenFields(state, fields, PROFILE_FIELDS)));
  const session = useRunTransientStore(useShallow((state) => pickScreenFields(state, fields, TRANSIENT_FIELDS)));
  const battle = useRunBattleDomainStore(useShallow((state) => pickScreenFields(state, fields, BATTLE_FIELDS)));
  return useMemo(
    () => ({ ...run, ...profile, ...session, ...battle }) as RunScreenData,
    [run, profile, session, battle],
  );
}
