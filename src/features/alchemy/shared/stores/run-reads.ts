import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { isActiveRunActivity, readActivityData, runActivityScreen } from "@/lib/active-run-session";
import {
  battleSnapshot,
  defaultBattleState,
  getBattleCompanionDamageModifiers,
  isPlayerDefeated,
  type BattleSnapshot,
} from "@/lib/battle";
import type { ContentSystemId, EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type {
  BattleCard,
  CharacterId,
  DifficultyId,
  TalentEffectManifest,
  TalentXP,
  UnlockedTalents,
} from "@/lib/game-data";
import { computeTalentEffects } from "@/lib/game-data";
import { getRunPhase, type RunPhase, type Screen } from "@/lib/routing";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { readGameplayState, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import type { RunSessionFields } from "./run-domain-types";
import type { PermanentProgressFields } from "./run-state-init";
import { pickActiveRunView, type ActiveRunReadView } from "./run-state-init";
import { deepFreeze, deepFreezeInDev } from "./store-utils";

export type ShopSessionStateKey = "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState";

// Single source mapping the shop pricing context's state keys to their run
// activity visits, so the two vocabularies cannot drift apart.
const SHOP_VISIT_BY_STATE_KEY = {
  shopState: "shop",
  alchemistState: "alchemist",
  trinketShopState: "trinket-shop",
  equipmentShopState: "equipment-shop",
} as const satisfies Record<ShopSessionStateKey, "shop" | "alchemist" | "trinket-shop" | "equipment-shop">;

export type { ActiveRunReadView } from "./run-state-init";
export type RunProfileReadView = Readonly<PermanentProgressFields>;
export type RunSessionReadView = Readonly<RunSessionFields> & { readonly hasActiveRun: boolean };
export interface BattleReadView {
  readonly hasActiveBattle: boolean;
  readonly battleState: BattleSnapshot;
  readonly battleStartState: BattleSnapshot | null;
}

const emptyBattle = deepFreeze(battleSnapshot(defaultBattleState()));
function selectBattle(state: Pick<GameplayState, "session">): BattleReadView {
  const activity = state.session.activity;
  return activity.kind === "battle"
    ? { hasActiveBattle: true, ...activity.data }
    : { hasActiveBattle: false, battleState: emptyBattle, battleStartState: null };
}

function useShallowRunSelector<T>(selector: (state: GameplayState) => T): T {
  return useGameplayStateStore(useShallow(selector));
}
export function readActiveRun(gameSession: GameSession): ActiveRunReadView {
  return deepFreezeInDev(pickActiveRunView(readGameplayState(gameSession).run));
}
export function readRunProfile(gameSession: GameSession): RunProfileReadView {
  return deepFreezeInDev({ ...readGameplayState(gameSession).runProfile });
}
export function readRunSession(gameSession: GameSession): RunSessionReadView {
  const session = readGameplayState(gameSession).session;
  return deepFreezeInDev({ ...session, hasActiveRun: isActiveRunActivity(session.activity) });
}
export function readShopFirstPurchaseUsed(shop: ShopSessionStateKey, gameSession: GameSession): boolean {
  return readActivityData(readGameplayState(gameSession).session.activity, SHOP_VISIT_BY_STATE_KEY[shop])
    .firstPurchaseUsed;
}
export function readBattle(gameSession: GameSession): BattleReadView {
  return deepFreezeInDev(selectBattle(readGameplayState(gameSession)));
}
export function readRunRevision(gameSession: GameSession): number {
  return readGameplayState(gameSession).revision;
}
export function readRunInitialized(gameSession: GameSession): boolean {
  return readGameplayState(gameSession).run.initialized;
}
export function readHasActiveRun(gameSession: GameSession): boolean {
  return isActiveRunActivity(readGameplayState(gameSession).session.activity);
}
export function readHasActiveBattle(gameSession: GameSession): boolean {
  return readGameplayState(gameSession).session.activity.kind === "battle";
}
export function readActiveRunScreen(gameSession: GameSession): Screen {
  return readGameplayState(gameSession).run.navigation.screen;
}
export function readRunResumeScreen(gameSession: GameSession): Screen | null {
  const state = readGameplayState(gameSession);
  return isActiveRunActivity(state.session.activity) ? runActivityScreen(state.session.activity) : null;
}
export function useRunResumeScreen(): Screen | null {
  return useGameplayStateStore((state) =>
    isActiveRunActivity(state.session.activity) ? runActivityScreen(state.session.activity) : null,
  );
}
export function readRunPhase(gameSession: GameSession): RunPhase {
  const state = readGameplayState(gameSession);
  return getRunPhase(state.run.navigation.screen, state.session.activity.kind === "battle");
}

export function useTalentEffects(): TalentEffectManifest {
  const unlockedTalents = useGameplayStateStore(useShallow((state) => state.runProfile.unlockedTalents));
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}
export function useActiveRunScreenValue(): Screen {
  return useGameplayStateStore((state) => state.run.navigation.screen);
}
export function selectAutosaveAllowed(
  state: {
    battle: { hasActiveBattle: boolean; battleState: { enemyHealth: number } };
  },
  screen: Screen,
): boolean {
  const phase = getRunPhase(screen, state.battle.hasActiveBattle);
  if (phase === "runEnd") return false;
  if (phase === "battle" && state.battle.battleState.enemyHealth <= 0) return false;

  return true;
}

export function useAutosaveAllowed(screen: Screen): boolean {
  return useGameplayStateStore((state) => selectAutosaveAllowed({ battle: selectBattle(state) }, screen));
}
export function useHasActiveBattle(): boolean {
  return useGameplayStateStore((state) => state.session.activity.kind === "battle");
}
export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => isActiveRunActivity(state.session.activity));
}
export function useForegroundResumeKind(): "battle" | "run" | null {
  return useGameplayStateStore((state) => {
    if (!isActiveRunActivity(state.session.activity)) return null;
    return state.session.activity.kind === "battle" ? "battle" : "run";
  });
}

export function useBondedCompanions() {
  return useGameplayStateStore(useShallow((state) => state.runProfile.bondedCompanions));
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
type RunSessionTransientSlice = RunSessionReadView;
interface RunSessionBattleSlice {
  hasActiveBattle: boolean;
  battleState: BattleSnapshot;
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
  battleState: BattleSnapshot;
}): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
  };
}
function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useShallowRunSelector((state) => pickRunSessionBattleSlice(selectBattle(state)));
}
export function useBattleClusterState(): { gold: number; hasWishOptions: boolean } {
  return useGameplayStateStore(
    useShallow((state) => ({
      gold: selectBattle(state).battleState.gold,
      hasWishOptions: Boolean(selectBattle(state).battleState.wishOptions),
    })),
  );
}

export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useGameplayStateStore(useShallow((state) => state.session.activeLabyrinthModifiers));
  const committedScreen = useGameplayStateStore((state) => state.run.navigation.screen);
  const phase = getRunPhase(screen ?? committedScreen, battle.hasActiveBattle);
  return useMemo(() => ({ phase, battle, activeLabyrinthModifiers }), [phase, battle, activeLabyrinthModifiers]);
}
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const session = useShallowRunSelector((state) => ({
    screen: state.run.navigation.screen,
    hasActiveBattle: state.session.activity.kind === "battle",
    hasActiveRun: isActiveRunActivity(state.session.activity),
    pendingCharacterId: state.session.pendingCharacterId,
    pendingContentSystemType: state.session.pendingContentSystemType,
  }));
  const phase = getRunPhase(screen ?? session.screen, session.hasActiveBattle);
  return useMemo(
    () => ({
      phase,
      hasActiveBattle: session.hasActiveBattle,
      hasActiveRun: session.hasActiveRun,
      pendingCharacterId: session.pendingCharacterId,
      pendingContentSystemType: session.pendingContentSystemType,
    }),
    [phase, session],
  );
}
export function getRunSessionFromState(state: GameplayState, screen?: Screen): RunSession {
  const resolvedScreen = screen ?? state.run.navigation.screen;
  const battle = pickRunSessionBattleSlice(selectBattle(state));
  const { talentXP, unlockedTalents } = state.runProfile;
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: { ...pickActiveRunView(state.run), talentXP, unlockedTalents, gold: state.runProfile.gold },
    session: { ...state.session, hasActiveRun: isActiveRunActivity(state.session.activity) },
    battle,
  };
}
export function getRunSession(screen: Screen | undefined, gameSession: GameSession): RunSession {
  return getRunSessionFromState(readGameplayState(gameSession), screen);
}

function selectCardInspectionData(state: GameplayState) {
  const isRecap = state.run.navigation.screen === "game-over" || state.run.navigation.screen === "run-victory";
  const run = state.run.activeRun;
  const battle = selectBattle(state).battleState;
  const companionModifiers = getBattleCompanionDamageModifiers(battle);
  return {
    runDeck: isRecap && state.session.runRecap ? state.session.runRecap.deck : run.runDeck,
    runSeed: run.rng.seed,
    characterId: run.characterId,
    mode: run.contentSystemType,
    hasActiveRun: isActiveRunActivity(state.session.activity),
    hasActiveBattle: state.session.activity.kind === "battle",
    battleReady:
      state.session.activity.kind === "battle" &&
      battle.turnPhase === "player" &&
      !battle.wishOptions &&
      battle.enemyHealth > 0 &&
      !isPlayerDefeated(battle),
    hand: battle.hand,
    drawPile: battle.deck,
    discardPile: battle.discard,
    talentEffects: battle.talentEffects,
    companionDamageBonus: companionModifiers.damageBonus,
    companionBleedDamageBonus: companionModifiers.bleedDamageBonus,
    companionDamageMultiplier: companionModifiers.damageMultiplier,
  };
}

export function useCardInspectionData() {
  return useShallowRunSelector(selectCardInspectionData);
}

export function readCardInspectionData(gameSession: GameSession) {
  return selectCardInspectionData(readGameplayState(gameSession));
}
