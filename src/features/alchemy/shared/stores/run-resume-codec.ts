import {
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateMysteryVisit,
  hydrateShopState,
  hydrateTrinketShopState,
  runActivityScreen,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializeMysteryVisit,
  serializeShopState,
  serializeTrinketShopState,
  transitionRunActivity,
  type ActiveRunData,
  type InterruptedFlow,
  type LabyrinthPendingNodeId,
  type PersistedAlchemistState,
  type PersistedBattleTransition,
  type PersistedEquipmentShopState,
  type PersistedMysteryVisit,
  type PersistedShopState,
  type PersistedTrinketShopState,
  type RewardState,
  type RunActivity,
} from "@/lib/active-run-session";
import { battleSnapshot, isPlayerDefeated } from "@/lib/battle";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { CorruptionResult } from "@/lib/corruption";
import type { BattleCard } from "@/lib/game-data";
import { type Screen } from "@/lib/routing";
import { decodeInterruptedFlow, encodeInterruptedFlow, inferActiveRunScreen } from "./encode-interrupted-flow";
import type { RunSession } from "./run-reads";
import { ACTIVE_RUN_PROGRESS_KEYS, createInitialActiveRunFields, type ActiveRunProgressFields } from "./run-state-init";

export interface DecodedRunResumeSession {
  labyrinthMap: LabyrinthMap | null;
  labyrinthPendingNode: LabyrinthPendingNodeId | null;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  activity: RunActivity;
}

export interface DecodedRunResumeSnapshot {
  progress: ActiveRunProgressFields;
  screen: Screen;
  pendingBattleTransition: PersistedBattleTransition | null;
  session: DecodedRunResumeSession;
}

interface PersistedShops {
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
}

const EMPTY_PERSISTED_SHOPS: PersistedShops = Object.freeze({
  shopState: null,
  alchemistState: null,
  trinketShopState: null,
  equipmentShopState: null,
});

export function encodePersistedShops(session: RunSession["session"]): PersistedShops {
  const activity = session.activity;
  if (activity.kind === "shop") return { ...EMPTY_PERSISTED_SHOPS, shopState: serializeShopState(activity.data) };
  if (activity.kind === "alchemist")
    return { ...EMPTY_PERSISTED_SHOPS, alchemistState: serializeAlchemistState(activity.data) };
  if (activity.kind === "trinket-shop")
    return { ...EMPTY_PERSISTED_SHOPS, trinketShopState: serializeTrinketShopState(activity.data) };
  if (activity.kind === "equipment-shop")
    return { ...EMPTY_PERSISTED_SHOPS, equipmentShopState: serializeEquipmentShopState(activity.data) };
  return EMPTY_PERSISTED_SHOPS;
}

function pickActiveRunProgress(run: RunSession["run"]): ActiveRunProgressFields {
  const progress = {} as ActiveRunProgressFields;
  for (const key of ACTIVE_RUN_PROGRESS_KEYS) {
    progress[key] = run[key] as never;
  }
  return progress;
}

interface EncodeResumeFields {
  currentScreen: Screen | null;
  interruptedFlow: InterruptedFlow;
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
  mysteryVisit: PersistedMysteryVisit | null;
  corruptionResult: CorruptionResult | null;
}

function synthesizeLegacyEnemyTurnTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  if (activeRun.activeCombat?.battleState.turnPhase === "enemy") {
    return { kind: "legacy-enemy-turn" };
  }
  return null;
}

function resolvePendingBattleTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  const pending = activeRun.activeCombat?.pendingBattleTransition ?? null;
  if (pending) return pending;
  return synthesizeLegacyEnemyTurnTransition(activeRun);
}

function encodeActivityFields(
  session: RunSession["session"],
  screen: Screen | null | undefined,
): Omit<EncodeResumeFields, "currentScreen"> {
  const shops = encodePersistedShops(session);
  return {
    interruptedFlow: encodeInterruptedFlow(session, screen),
    shopState: shops.shopState,
    alchemistState: shops.alchemistState,
    trinketShopState: shops.trinketShopState,
    equipmentShopState: shops.equipmentShopState,
    mysteryVisit: session.activity.kind === "mystery" ? serializeMysteryVisit(session.activity.data) : null,
    corruptionResult: session.activity.kind === "corruption" ? session.activity.data : null,
  };
}

function encodeActiveRunFromSession(source: RunSession, resume: EncodeResumeFields): ActiveRunData {
  const { run, session, battle } = source;
  const progress = pickActiveRunProgress(run);
  const isLabyrinth = progress.contentSystemType === "labyrinth";
  const activeCombat =
    battle.hasActiveBattle && battle.battleState.enemyHealth > 0 && !isPlayerDefeated(battle.battleState)
      ? {
          battleState: battleSnapshot(battle.battleState),
          pendingBattleTransition: battle.pendingBattleTransition ?? null,
          activeLabyrinthModifiers: isLabyrinth ? session.activeLabyrinthModifiers : [],
          activeLabyrinthRewardModifiers: isLabyrinth ? session.activeLabyrinthRewardModifiers : [],
        }
      : null;

  return {
    ...progress,
    destinationRoundsSinceOffered: { ...progress.destinationRoundsSinceOffered },
    rng: { seed: progress.rng.seed, counters: { ...progress.rng.counters } },
    labyrinthMap: isLabyrinth ? session.labyrinthMap : null,
    labyrinthPendingNode: isLabyrinth ? session.activeLabyrinthPendingNode : null,
    activeLabyrinthModifiers: isLabyrinth ? [...session.activeLabyrinthModifiers] : [],
    activeLabyrinthRewardModifiers: isLabyrinth ? [...session.activeLabyrinthRewardModifiers] : [],
    wildwoodDraft: progress.contentSystemType === "wildwood" ? session.wildwoodDraft : null,
    starterDraftChoices: progress.contentSystemType === "wildwood" ? null : session.starterDraftChoices,
    activeCombat,
    currentScreen: resume.currentScreen,
    interruptedFlow: resume.interruptedFlow,
    shopState: resume.shopState,
    alchemistState: resume.alchemistState,
    trinketShopState: resume.trinketShopState,
    equipmentShopState: resume.equipmentShopState,
    mysteryVisit: resume.mysteryVisit,
    corruptionResult: resume.corruptionResult,
  };
}

export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const currentScreen = runActivityScreen(source.session.activity) ?? screen ?? source.screen;
  const snapshot = encodeActiveRunFromSession(source, {
    currentScreen,
    ...encodeActivityFields(source.session, currentScreen),
  });
  return source.session.activity.kind === "idle" || source.session.activity.kind === "inactive"
    ? { ...snapshot, currentScreen: inferActiveRunScreen(snapshot) }
    : snapshot;
}

function preferTopLevelModifiers<T>(
  topLevel: readonly T[] | null | undefined,
  combat: readonly T[] | null | undefined,
): T[] {
  if (topLevel && topLevel.length > 0) return [...topLevel];
  return combat ? [...combat] : [];
}

export function decodeRunResumeSnapshot(activeRun: ActiveRunData): DecodedRunResumeSnapshot {
  let screen = inferActiveRunScreen(activeRun);
  let rewardState: RewardState | null = null;
  let companionRewardCards: BattleCard[] | null = null;

  if (activeRun.interruptedFlow.kind !== "none") {
    const claim = decodeInterruptedFlow({ ...activeRun, currentScreen: screen });
    rewardState = claim.rewardState;
    companionRewardCards = claim.companionRewardCards;
    screen = inferActiveRunScreen({ ...activeRun, currentScreen: claim.screen ?? screen });
  }

  const activity = decodeRunActivity(activeRun, screen);

  return {
    progress: createInitialActiveRunFields(activeRun),
    screen,
    pendingBattleTransition: resolvePendingBattleTransition(activeRun),
    session: {
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      activeLabyrinthModifiers: preferTopLevelModifiers(
        activeRun.activeLabyrinthModifiers,
        activeRun.activeCombat?.activeLabyrinthModifiers,
      ),
      activeLabyrinthRewardModifiers: preferTopLevelModifiers(
        activeRun.activeLabyrinthRewardModifiers,
        activeRun.activeCombat?.activeLabyrinthRewardModifiers,
      ),
      wildwoodDraft: activeRun.wildwoodDraft,
      starterDraftChoices: activeRun.starterDraftChoices,
      rewardState,
      companionRewardCards,
      activity,
    },
  };
}

function decodeRunActivity(activeRun: ActiveRunData, screen: Screen): RunActivity {
  if (screen === "shop" && activeRun.shopState) return { kind: screen, data: hydrateShopState(activeRun.shopState) };
  if (screen === "alchemist" && activeRun.alchemistState)
    return { kind: screen, data: hydrateAlchemistState(activeRun.alchemistState) };
  if (screen === "trinket-shop" && activeRun.trinketShopState)
    return { kind: screen, data: hydrateTrinketShopState(activeRun.trinketShopState) };
  if (screen === "equipment-shop" && activeRun.equipmentShopState)
    return { kind: screen, data: hydrateEquipmentShopState(activeRun.equipmentShopState) };
  if (screen === "mystery")
    return {
      kind: screen,
      data: hydrateMysteryVisit(activeRun.mysteryVisit, {
        modifiers: activeLabyrinthBenefits(activeRun.contentSystemType, activeRun.activeLabyrinthRewardModifiers ?? []),
        maxHealth: activeRun.runMaxHealth,
      }),
    };
  if (screen === "corruption") return { kind: screen, data: activeRun.corruptionResult };
  return transitionRunActivity({ kind: "idle" }, screen);
}
