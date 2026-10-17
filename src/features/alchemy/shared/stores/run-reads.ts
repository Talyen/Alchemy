import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { isActiveRunActivity, runActivityScreen } from "@/lib/active-run-session";
import {
  battleSnapshot,
  defaultBattleState,
  getBattleCompanionDamageModifiers,
  getBattleOutcome,
  type BattleSnapshot,
} from "@/lib/battle";
import { getRunPhase, type RunPhase, type Screen } from "@/lib/routing";
import { readGameplayState, type GameplayState } from "./gameplay-state-reads";
import type { RunSessionFields } from "./run-domain-types";
import type { PermanentProgressFields } from "./run-state-init";
import { pickActiveRunView, type ActiveRunReadView } from "./run-state-init";
import { deepFreeze } from "./store-utils";

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
  return pickActiveRunView(readGameplayState(gameSession).run);
}
export function readRunProfile(gameSession: GameSession): RunProfileReadView {
  return readGameplayState(gameSession).runProfile;
}
export function readRunSession(gameSession: GameSession): RunSessionReadView {
  const session = readGameplayState(gameSession).session;
  return { ...session, hasActiveRun: isActiveRunActivity(session.activity) };
}
export function readBattle(gameSession: GameSession): BattleReadView {
  return selectBattle(readGameplayState(gameSession));
}
export function readRunRevision(gameSession: GameSession): number {
  return readGameplayState(gameSession).revision;
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
    battle: { hasActiveBattle: boolean; battleState: Pick<BattleSnapshot, "enemyHealth" | "wishOptions"> };
  },
  screen: Screen,
): boolean {
  const phase = getRunPhase(screen, state.battle.hasActiveBattle);
  if (phase === "runEnd") return false;
  if (phase === "battle" && state.battle.battleState.enemyHealth <= 0 && !state.battle.battleState.wishOptions)
    return false;

  return true;
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
    battleState: battle,
    hand: battle.hand,
    drawPile: battle.deck,
    discardPile: battle.discard,
    talentEffects: battle.talentEffects,
    companionDamageBonus: companionModifiers.damageBonus,
    companionDamageMultiplier: companionModifiers.damageMultiplier,
  };
}

export function readCardInspectionData(gameSession: GameSession) {
  return selectCardInspectionData(readGameplayState(gameSession));
}
