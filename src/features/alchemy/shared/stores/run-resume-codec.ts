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
  type LabyrinthPendingNodeId,
  type PersistedBattleTransition,
  type RewardState,
  type RunActivity,
} from "@/lib/active-run-session";
import { battleSnapshot } from "@/lib/battle";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard } from "@/lib/game-data";
import { type Screen } from "@/lib/routing";
import { decodeInterruptedFlow, encodeInterruptedFlow, inferActiveRunScreen } from "./encode-interrupted-flow";
import type { RunSession } from "./run-reads";
import type { RunSessionFields } from "./run-domain-types";
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

function pickActiveRunProgress(run: RunSession["run"]): ActiveRunProgressFields {
  const progress = {} as ActiveRunProgressFields;
  // Single container cast for union-key mechanics: every key comes from
  // ACTIVE_RUN_PROGRESS_KEYS, whose exhaustiveness over
  // ActiveRunProgressFields is compile-guarded (see the key guards in
  // run-domain-store-test), so each read really is its field's type.
  const writable = progress as Record<(typeof ACTIVE_RUN_PROGRESS_KEYS)[number], unknown>;
  for (const key of ACTIVE_RUN_PROGRESS_KEYS) {
    writable[key] = run[key];
  }
  return progress;
}

// Session persistence contract (see encodeRunResumeSnapshot below): the
// transient fields never reach a snapshot, and the gated ones persist only for
// matching content systems. persistence-commit-filter derives its
// dirty-tracking skip sets from these, so the two cannot drift apart.
export const TRANSIENT_SESSION_KEYS = [
  "selectedLabyrinthNodeId",
  "pendingCharacterId",
  "pendingContentSystemType",
  "runEndLabyrinthFloor",
  "runEndMaterials",
  "runEndCurrencies",
  "runEndTalentXP",
  "runEndItems",
  "runRecap",
] as const satisfies ReadonlyArray<keyof RunSessionFields>;

export const LABYRINTH_GATED_SESSION_KEYS = [
  "labyrinthMap",
  "activeLabyrinthModifiers",
  "activeLabyrinthRewardModifiers",
  "activeLabyrinthPendingNode",
] as const satisfies ReadonlyArray<keyof RunSessionFields>;

export const WILDWOOD_GATED_SESSION_KEY = "wildwoodDraft" as const satisfies keyof RunSessionFields;
export const NON_WILDWOOD_GATED_SESSION_KEY = "starterDraftChoices" as const satisfies keyof RunSessionFields;

export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const { run, session, battle } = source;
  const activity = session.activity;
  const currentScreen = runActivityScreen(activity) ?? screen ?? source.screen;
  const progress = pickActiveRunProgress(run);
  const isLabyrinth = progress.contentSystemType === "labyrinth";
  // An active terminal snapshot still needs outcome settlement after restore.
  const activeCombat = battle.hasActiveBattle
    ? {
        battleState: battleSnapshot(battle.battleState),
        pendingBattleTransition: null,
        activeLabyrinthModifiers: isLabyrinth ? session.activeLabyrinthModifiers : [],
        activeLabyrinthRewardModifiers: isLabyrinth ? session.activeLabyrinthRewardModifiers : [],
      }
    : null;

  const snapshot: ActiveRunData = {
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
    currentScreen,
    interruptedFlow: encodeInterruptedFlow(session, currentScreen),
    shopState: activity.kind === "shop" ? serializeShopState(activity.data) : null,
    alchemistState: activity.kind === "alchemist" ? serializeAlchemistState(activity.data) : null,
    trinketShopState: activity.kind === "trinket-shop" ? serializeTrinketShopState(activity.data) : null,
    equipmentShopState: activity.kind === "equipment-shop" ? serializeEquipmentShopState(activity.data) : null,
    mysteryVisit: activity.kind === "mystery" ? serializeMysteryVisit(activity.data) : null,
    corruptionResult: activity.kind === "corruption" ? activity.data : null,
  };
  return activity.kind === "idle" || activity.kind === "inactive"
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
    pendingBattleTransition: activeRun.activeCombat?.pendingBattleTransition ?? null,
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
  if (screen === "shop" && activeRun.shopState) return { kind: "shop", data: hydrateShopState(activeRun.shopState) };
  if (screen === "alchemist" && activeRun.alchemistState)
    return { kind: "alchemist", data: hydrateAlchemistState(activeRun.alchemistState) };
  if (screen === "trinket-shop" && activeRun.trinketShopState)
    return { kind: "trinket-shop", data: hydrateTrinketShopState(activeRun.trinketShopState) };
  if (screen === "equipment-shop" && activeRun.equipmentShopState)
    return { kind: "equipment-shop", data: hydrateEquipmentShopState(activeRun.equipmentShopState) };
  if (screen === "mystery")
    return {
      kind: screen,
      data: hydrateMysteryVisit(activeRun.mysteryVisit),
    };
  if (screen === "corruption") return { kind: screen, data: activeRun.corruptionResult };
  return transitionRunActivity({ kind: "idle" }, screen);
}
