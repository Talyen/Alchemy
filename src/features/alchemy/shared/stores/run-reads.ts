import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type {
  BattleCard,
  CharacterId,
  DifficultyId,
  TalentEffectManifest,
  TalentXP,
  UnlockedTalents,
} from "@/lib/game-data";
import { computeTalentEffects } from "@/lib/game-data";
import type { ContentSystemId, EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getRunPhase, type RunPhase, type Screen, type Destination } from "@/lib/routing";
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { PermanentProgressFields } from "./run-state-init";
import { pickActiveRunView, type ActiveRunReadView } from "./run-state-init";
import { readGameplayState, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import { mostRecentResumableMode } from "./parked-runs";
import type { ActiveRunData, ParkedRunsMap } from "@/lib/active-run-session";
import type { RunDomainBattleState, RunSessionFields } from "./run-domain-types";
import { deepFreezeInDev } from "./store-utils";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";

export interface ContentNavigationRunPort {
  contentSystemType: ContentSystemId;
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
}
export interface ContentNavigationTalentPort {
  talentXP: TalentXP;
  talentEffects: Pick<TalentEffectManifest, "startGold">;
}

function selectContentNavigationFields(state: GameplayState): ContentNavigationRunPort {
  const r = state.run.activeRun;
  return {
    contentSystemType: r.contentSystemType,
    lastOfferedDestinations: r.lastOfferedDestinations,
    destinationRoundsSinceOffered: r.destinationRoundsSinceOffered,
  };
}

export type { ActiveRunReadView } from "./run-state-init";
export type RunProfileReadView = Readonly<PermanentProgressFields>;
export type RunSessionReadView = Readonly<RunSessionFields>;
export type BattleReadView = Readonly<RunDomainBattleState>;
export type { DisplayOverrides } from "./run-domain-types";

function useShallowRunSelector<T>(selector: (state: GameplayState) => T): T {
  return useGameplayStateStore(useShallow(selector));
}
export function readActiveRun(): ActiveRunReadView {
  return deepFreezeInDev(pickActiveRunView(readGameplayState().run));
}
export function readRunProfile(): RunProfileReadView {
  return deepFreezeInDev({ ...readGameplayState().runProfile });
}
export function readRunSession(): RunSessionReadView {
  return deepFreezeInDev({ ...readGameplayState().session });
}
export function readShopFirstPurchaseUsed(
  shop: "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState",
): boolean {
  return readGameplayState().session[shop].firstPurchaseUsed;
}
export function readBattle(): BattleReadView {
  return deepFreezeInDev({ ...readGameplayState().battle });
}
export function readRunInitialized(): boolean {
  return readGameplayState().run.initialized;
}
export function readHasActiveRun(): boolean {
  return readGameplayState().session.hasActiveRun;
}
export function readHasActiveBattle(): boolean {
  return readGameplayState().battle.hasActiveBattle;
}
function cloneParkedRun(run: ActiveRunData): ActiveRunData {
  const combat = (run as unknown as { activeCombat?: { battleState?: Record<string, unknown> } }).activeCombat;
  if (typeof combat?.battleState?.rng !== "function") return structuredClone(run);
  const { rng: _ignored, ...battleStateRest } = combat.battleState;
  void _ignored;
  return structuredClone({
    ...(run as unknown as Record<string, unknown>),
    activeCombat: { ...combat, battleState: battleStateRest },
  } as unknown as ActiveRunData);
}
export function readParkedRuns(): ParkedRunsMap {
  const parkedRuns = readGameplayState().run.parkedRuns;
  const snapshot: ParkedRunsMap = {};
  for (const [mode, rawRun] of Object.entries(parkedRuns)) {
    const run = rawRun as ParkedRunsMap[ContentSystemId];
    if (!run) continue;
    snapshot[mode as ContentSystemId] = cloneParkedRun(run);
  }
  return snapshot;
}
export function readRunRecency(): ContentSystemId[] {
  return [...readGameplayState().run.runRecency];
}
export function readActiveRunScreen(): Screen {
  return readGameplayState().run.navigation.screen;
}
export function readRunPhase(): RunPhase {
  const state = readGameplayState();
  return getRunPhase(state.run.navigation.screen, state.battle.hasActiveBattle);
}

export function useTalentEffects(): TalentEffectManifest {
  const unlockedTalents = useGameplayStateStore(useShallow((state) => state.runProfile.unlockedTalents));
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}
export function useContentNavigationRunPort(): ContentNavigationRunPort {
  return useShallowRunSelector(selectContentNavigationFields);
}
export function useContentNavigationTalentPort(
  talentEffects: TalentEffectManifest,
  talentXP: TalentXP,
): ContentNavigationTalentPort {
  return useMemo(
    () => ({ talentXP, talentEffects: { startGold: talentEffects.startGold } }),
    [talentEffects, talentXP],
  );
}
export function useActiveRunScreenValue(): Screen {
  return useGameplayStateStore((state) => state.run.navigation.screen);
}
export function selectAutosaveAllowed(
  state: {
    battle: { hasActiveBattle: boolean; battleState: { enemyHealth: number } };
    session: { rewardClaimInFlight: boolean; rewardState: { choices: unknown[] } };
  },
  screen: Screen,
): boolean {
  const phase = getRunPhase(screen, state.battle.hasActiveBattle);
  if (phase === "runEnd") return false;
  if (phase === "battle" && state.battle.battleState.enemyHealth <= 0) return false;

  return true;
}

export function useAutosaveAllowed(screen: Screen): boolean {
  return useGameplayStateStore((state) => selectAutosaveAllowed(state, screen));
}
export function useBattleLifetimeFields() {
  return useShallowRunSelector((state) => ({
    hasActiveBattle: state.battle.hasActiveBattle,
    pendingBattleTransition: state.battle.pendingBattleTransition,
    pendingTransitionResumeRequired: state.battle.pendingTransitionResumeRequired,
  }));
}
export function useHasActiveBattle(): boolean {
  return useGameplayStateStore((state) => state.battle.hasActiveBattle);
}
export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => state.session.hasActiveRun);
}
export function useForegroundResumeKind(): "battle" | "run" | null {
  return useGameplayStateStore((state) => {
    const liveMode = state.session.hasActiveRun ? state.run.activeRun.contentSystemType : null;
    const mode = mostRecentResumableMode(
      state.run.runRecency,
      liveMode,
      state.run.parkedRuns,
      state.session.hasActiveRun,
    );
    if (!mode) return null;
    if (state.session.hasActiveRun && liveMode === mode) return state.battle.hasActiveBattle ? "battle" : "run";
    return state.run.parkedRuns[mode]?.activeCombat ? "battle" : "run";
  });
}
export function useResumableGameModes(): Record<ContentSystemId, boolean> {
  return useShallowRunSelector((state) => {
    const live = state.session.hasActiveRun ? state.run.activeRun.contentSystemType : null;
    return {
      campaign: live === "campaign" || Boolean(state.run.parkedRuns.campaign),
      labyrinth: live === "labyrinth" || Boolean(state.run.parkedRuns.labyrinth),
      wildwood: live === "wildwood" || Boolean(state.run.parkedRuns.wildwood),
    };
  });
}
export function useDisplayOverrides() {
  return useGameplayStateStore(useShallow((state) => state.battle.displayOverrides));
}
export function useBondedCompanions() {
  return useGameplayStateStore(useShallow((state) => state.runProfile.bondedCompanions));
}
export function useContentSystemType(): ContentSystemId {
  return useGameplayStateStore((state) => state.run.activeRun.contentSystemType);
}
export function useHomesteadProgressSlice() {
  return useShallowRunSelector((state) => ({
    gold: state.runProfile.gold,
    materialInventory: state.runProfile.materialInventory,
    constructedBuildings: state.runProfile.constructedBuildings,
    plantedFarms: state.runProfile.plantedFarms,
    completedResearch: state.runProfile.completedResearch,
    bondedCompanions: state.runProfile.bondedCompanions,
  }));
}
export function useHomesteadEffects() {
  return useGameplayStateStore(useShallow((state) => state.runProfile.effects));
}
export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useShallowRunSelector((state) => ({
    talentXP: state.runProfile.talentXP,
    unlockedTalents: state.runProfile.unlockedTalents,
  }));
}
export function useDifficultySelectSlice(): { characterId: CharacterId; selectedDifficulty: DifficultyId | null } {
  return useShallowRunSelector((state) => ({
    characterId: state.session.pendingCharacterId ?? state.run.activeRun.characterId,
    selectedDifficulty: state.run.activeRun.selectedDifficulty,
  }));
}
export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
} {
  return useShallowRunSelector((state) => ({
    contentSystemType: state.run.activeRun.contentSystemType,
    runDeck: state.run.activeRun.runDeck,
    wildwoodDraft: state.session.wildwoodDraft,
    starterDraftChoices: state.session.starterDraftChoices,
  }));
}
export function useActiveRunCharacterId(): CharacterId {
  return useGameplayStateStore((state) => state.run.activeRun.characterId);
}
export function useActiveRunBoons(): string[] {
  return useGameplayStateStore(useShallow((state) => state.run.activeRun.runBoons));
}

type RunSessionRunSlice = ActiveRunReadView & { talentXP: TalentXP; unlockedTalents: UnlockedTalents; gold: number };
type RunSessionTransientSlice = RunSessionFields;
interface RunSessionBattleSlice {
  hasActiveBattle: boolean;
  battleState: BattleState;
  pendingBattleTransition: PersistedBattleTransition | null;
  pendingTransitionResumeRequired: boolean;
}
export interface RunSession {
  screen: Screen;
  phase: RunPhase;
  run: RunSessionRunSlice;
  session: RunSessionTransientSlice;
  battle: RunSessionBattleSlice;
}
export interface RunSessionBattleContext {
  phase: RunPhase;
  battle: RunSessionBattleSlice;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
}
export interface RunSessionNavigationSlice {
  phase: RunPhase;
  hasActiveBattle: boolean;
  hasActiveRun: boolean;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
}
function pickRunSessionBattleSlice(battle: {
  hasActiveBattle: boolean;
  battleState: BattleState;
  pendingBattleTransition: PersistedBattleTransition | null;
  pendingTransitionResumeRequired: boolean;
}): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    pendingBattleTransition: battle.pendingBattleTransition,
    pendingTransitionResumeRequired: battle.pendingTransitionResumeRequired,
  };
}
function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useShallowRunSelector((state) => pickRunSessionBattleSlice(state.battle));
}
export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useGameplayStateStore(useShallow((state) => state.session.activeLabyrinthModifiers));
  const committedScreen = useGameplayStateStore((state) => state.run.navigation.screen);
  const resolvedScreen = screen ?? committedScreen;
  return useMemo(
    () => ({ phase: getRunPhase(resolvedScreen, battle.hasActiveBattle), battle, activeLabyrinthModifiers }),
    [resolvedScreen, battle, activeLabyrinthModifiers],
  );
}
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const session = useShallowRunSelector((state) => ({
    screen: state.run.navigation.screen,
    hasActiveBattle: state.battle.hasActiveBattle,
    hasActiveRun: state.session.hasActiveRun,
    pendingCharacterId: state.session.pendingCharacterId,
    pendingContentSystemType: state.session.pendingContentSystemType,
  }));
  const resolvedScreen = screen ?? session.screen;
  return useMemo(
    () => ({
      phase: getRunPhase(resolvedScreen, session.hasActiveBattle),
      hasActiveBattle: session.hasActiveBattle,
      hasActiveRun: session.hasActiveRun,
      pendingCharacterId: session.pendingCharacterId,
      pendingContentSystemType: session.pendingContentSystemType,
    }),
    [resolvedScreen, session],
  );
}
export function getRunSessionFromState(state: GameplayState, screen?: Screen): RunSession {
  const resolvedScreen = screen ?? state.run.navigation.screen;
  const battle = pickRunSessionBattleSlice(state.battle);
  const { talentXP, unlockedTalents } = state.runProfile;
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: { ...pickActiveRunView(state.run), talentXP, unlockedTalents, gold: state.runProfile.gold },
    session: { ...state.session },
    battle,
  };
}
export function getRunSession(screen?: Screen): RunSession {
  return getRunSessionFromState(readGameplayState(), screen);
}
