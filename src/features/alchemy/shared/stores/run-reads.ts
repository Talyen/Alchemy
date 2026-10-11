import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { isActiveRunActivity, readActivityData, runActivityScreen } from "@/lib/active-run-session";
import {
  battleSnapshot,
  defaultBattleState,
  getBattleCompanionDamageModifiers,
  getBattleOutcome,
  type BattleSnapshot,
} from "@/lib/battle";
import type { ContentSystemId, EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { CharacterId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import { getRunPhase, type RunPhase, type Screen } from "@/lib/routing";
import { readGameplayState, type GameplayState } from "./gameplay-state-reads";
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
}

const emptyBattle = deepFreeze(battleSnapshot(defaultBattleState()));
export function selectBattle(state: Pick<GameplayState, "session">): BattleReadView {
  const activity = state.session.activity;
  return activity.kind === "battle"
    ? { hasActiveBattle: true, ...activity.data }
    : { hasActiveBattle: false, battleState: emptyBattle };
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

export function readRunPhase(gameSession: GameSession): RunPhase {
  const state = readGameplayState(gameSession);
  return getRunPhase(state.run.navigation.screen, state.session.activity.kind === "battle");
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

type RunSessionRunSlice = ActiveRunReadView & { talentXP: TalentXP; unlockedTalents: UnlockedTalents; gold: number };
type RunSessionTransientSlice = RunSessionReadView;
export interface RunSessionBattleSlice {
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
export function pickRunSessionBattleSlice(battle: {
  hasActiveBattle: boolean;
  battleState: BattleSnapshot;
}): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
  };
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

export function selectCardInspectionData(state: GameplayState) {
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
      getBattleOutcome(battle) === null,
    hand: battle.hand,
    drawPile: battle.deck,
    discardPile: battle.discard,
    talentEffects: battle.talentEffects,
    companionDamageBonus: companionModifiers.damageBonus,
    companionBleedDamageBonus: companionModifiers.bleedDamageBonus,
    companionDamageMultiplier: companionModifiers.damageMultiplier,
  };
}

export function readCardInspectionData(gameSession: GameSession) {
  return selectCardInspectionData(readGameplayState(gameSession));
}
