import { isActiveRunActivity, readActivityData, runActivityScreen, type RunActivity } from "@/lib/active-run-session";
import { isPlayerDefeated, getBattleCompanionDamageModifiers, type BattleSnapshot } from "@/lib/battle";
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
import { getRunPhase, type Destination, type RunPhase, type Screen } from "@/lib/routing";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { readGameplayState, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import type { RunDomainBattleState, RunSessionFields } from "./run-domain-types";
import type { PermanentProgressFields } from "./run-state-init";
import { pickActiveRunView, type ActiveRunReadView } from "./run-state-init";
import { deepFreezeInDev } from "./store-utils";

export interface ContentNavigationRunPort {
  contentSystemType: ContentSystemId;
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
}
export interface ContentNavigationTalentPort {
  talentXP: TalentXP;
  talentEffects: Pick<TalentEffectManifest, "startGold">;
}

export type ShopSessionStateKey = "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState";

// Single source mapping the shop pricing context's state keys to their run
// activity visits, so the two vocabularies cannot drift apart.
const SHOP_VISIT_BY_STATE_KEY = {
  shopState: "shop",
  alchemistState: "alchemist",
  trinketShopState: "trinket-shop",
  equipmentShopState: "equipment-shop",
} as const satisfies Record<ShopSessionStateKey, "shop" | "alchemist" | "trinket-shop" | "equipment-shop">;

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
export type RunSessionReadView = Readonly<RunSessionFields> & { readonly hasActiveRun: boolean };
export type BattleReadView = Readonly<RunDomainBattleState>;

export function hasActiveRunActivity(activity: RunActivity): boolean {
  return isActiveRunActivity(activity);
}

export function runPhaseFor(screen: Screen, hasActiveBattle: boolean): RunPhase {
  return getRunPhase(screen, hasActiveBattle);
}

function useRunPhase(screen: Screen | undefined, committedScreen: Screen, hasActiveBattle: boolean): RunPhase {
  const resolvedScreen = screen ?? committedScreen;
  return useMemo(() => runPhaseFor(resolvedScreen, hasActiveBattle), [resolvedScreen, hasActiveBattle]);
}

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
  const session = readGameplayState().session;
  return deepFreezeInDev({ ...session, hasActiveRun: hasActiveRunActivity(session.activity) });
}
export function readShopFirstPurchaseUsed(shop: ShopSessionStateKey): boolean {
  return readActivityData(readGameplayState().session.activity, SHOP_VISIT_BY_STATE_KEY[shop]).firstPurchaseUsed;
}
export function readBattle(): BattleReadView {
  return deepFreezeInDev({ ...readGameplayState().battle });
}
export function readRunRevision(): number {
  return readGameplayState().revision;
}
export function readRunInitialized(): boolean {
  return readGameplayState().run.initialized;
}
export function readHasActiveRun(): boolean {
  return hasActiveRunActivity(readGameplayState().session.activity);
}
export function readHasActiveBattle(): boolean {
  return readGameplayState().battle.hasActiveBattle;
}
export function readActiveRunScreen(): Screen {
  return readGameplayState().run.navigation.screen;
}
export function readRunResumeScreen(): Screen | null {
  const state = readGameplayState();
  return hasActiveRunActivity(state.session.activity) ? runActivityScreen(state.session.activity) : null;
}
export function useRunResumeScreen(): Screen | null {
  return useGameplayStateStore((state) =>
    hasActiveRunActivity(state.session.activity) ? runActivityScreen(state.session.activity) : null,
  );
}
export function readRunPhase(): RunPhase {
  const state = readGameplayState();
  return runPhaseFor(state.run.navigation.screen, state.battle.hasActiveBattle);
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
  },
  screen: Screen,
): boolean {
  const phase = runPhaseFor(screen, state.battle.hasActiveBattle);
  if (phase === "runEnd") return false;
  if (phase === "battle" && state.battle.battleState.enemyHealth <= 0) return false;

  return true;
}

export function useAutosaveAllowed(screen: Screen): boolean {
  return useGameplayStateStore((state) => selectAutosaveAllowed(state, screen));
}
export function useHasActiveBattle(): boolean {
  return useGameplayStateStore((state) => state.battle.hasActiveBattle);
}
export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => hasActiveRunActivity(state.session.activity));
}
export function useForegroundResumeKind(): "battle" | "run" | null {
  return useGameplayStateStore((state) => {
    if (!hasActiveRunActivity(state.session.activity)) return null;
    return state.battle.hasActiveBattle ? "battle" : "run";
  });
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
  return useShallowRunSelector((state) => pickRunSessionBattleSlice(state.battle));
}
export function useBattleClusterState(): { gold: number; hasWishOptions: boolean } {
  return useGameplayStateStore(
    useShallow((state) => ({
      gold: state.battle.battleState.gold,
      hasWishOptions: Boolean(state.battle.battleState.wishOptions),
    })),
  );
}

export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useGameplayStateStore(useShallow((state) => state.session.activeLabyrinthModifiers));
  const committedScreen = useGameplayStateStore((state) => state.run.navigation.screen);
  const phase = useRunPhase(screen, committedScreen, battle.hasActiveBattle);
  return useMemo(() => ({ phase, battle, activeLabyrinthModifiers }), [phase, battle, activeLabyrinthModifiers]);
}
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const session = useShallowRunSelector((state) => ({
    screen: state.run.navigation.screen,
    hasActiveBattle: state.battle.hasActiveBattle,
    hasActiveRun: hasActiveRunActivity(state.session.activity),
    pendingCharacterId: state.session.pendingCharacterId,
    pendingContentSystemType: state.session.pendingContentSystemType,
  }));
  const phase = useRunPhase(screen, session.screen, session.hasActiveBattle);
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
  const battle = pickRunSessionBattleSlice(state.battle);
  const { talentXP, unlockedTalents } = state.runProfile;
  return {
    screen: resolvedScreen,
    phase: runPhaseFor(resolvedScreen, battle.hasActiveBattle),
    run: { ...pickActiveRunView(state.run), talentXP, unlockedTalents, gold: state.runProfile.gold },
    session: { ...state.session, hasActiveRun: hasActiveRunActivity(state.session.activity) },
    battle,
  };
}
export function getRunSession(screen?: Screen): RunSession {
  return getRunSessionFromState(readGameplayState(), screen);
}

function selectCardInspectionData(state: GameplayState) {
  const isRecap = state.run.navigation.screen === "game-over" || state.run.navigation.screen === "run-victory";
  const run = state.run.activeRun;
  const battle = state.battle.battleState;
  const companionModifiers = getBattleCompanionDamageModifiers(battle);
  return {
    runDeck: isRecap && state.session.runRecap ? state.session.runRecap.deck : run.runDeck,
    runSeed: run.rng.seed,
    characterId: run.characterId,
    mode: run.contentSystemType,
    hasActiveRun: hasActiveRunActivity(state.session.activity),
    hasActiveBattle: state.battle.hasActiveBattle,
    battleReady:
      state.battle.hasActiveBattle &&
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

export function readCardInspectionData() {
  return selectCardInspectionData(readGameplayState());
}
