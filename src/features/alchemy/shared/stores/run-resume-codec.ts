import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateMysteryVisit,
  hydrateShopState,
  hydrateTrinketShopState,
  runActivityScreen,
  serializeMysteryVisit,
  serializeTrinketShopState,
  type ActiveRunData,
  type LabyrinthPendingNodeId,
  type PersistedBattleTransition,
  type RewardState,
  type RunActivity,
} from "@/lib/active-run-session";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { battleSnapshot } from "@/lib/battle";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard } from "@/lib/game-data";
import { type Screen } from "@/lib/routing";
import { decodeInterruptedFlow, encodeInterruptedFlow, inferActiveRunScreen } from "./encode-interrupted-flow";
import type { RunSessionFields } from "./run-domain-types";
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
  const { run, session } = source;
  const activity = session.activity;
  const currentScreen = runActivityScreen(activity) ?? screen ?? null;
  const progress = pickActiveRunProgress(run);
  const isLabyrinth = progress.contentSystemType === "labyrinth";
  // An active terminal snapshot still needs outcome settlement after restore.
  const activeCombat =
    activity.kind === "battle"
      ? {
          battleState: battleSnapshot(activity.data.battleState),
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
    shopState: activity.kind === "shop" ? { ...activity.data } : null,
    alchemistState: activity.kind === "alchemist" ? { ...activity.data } : null,
    trinketShopState: activity.kind === "trinket-shop" ? serializeTrinketShopState(activity.data) : null,
    equipmentShopState: activity.kind === "equipment-shop" ? { ...activity.data } : null,
    mysteryVisit: activity.kind === "mystery" ? serializeMysteryVisit(activity.data) : null,
    corruptionResult: activity.kind === "corruption" ? activity.data : null,
    campfireState: activity.kind === "campfire" ? activity.data : null,
    transmutationState: activity.kind === "transmutation" ? activity.data : null,
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

export function decodeRunResumeSnapshot(
  activeRun: ActiveRunData,
  generateSeed?: () => number,
): DecodedRunResumeSnapshot {
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
    progress: createInitialActiveRunFields(activeRun, "knight", generateSeed),
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

// Screen-to-activity inference is confined to decoding the existing save format.
function decodeRunActivity(activeRun: ActiveRunData, screen: Screen): RunActivity {
  switch (screen) {
    case "shop":
      return { kind: screen, data: activeRun.shopState ? hydrateShopState(activeRun.shopState) : emptyShopState() };
    case "alchemist":
      return {
        kind: screen,
        data: activeRun.alchemistState ? hydrateAlchemistState(activeRun.alchemistState) : emptyAlchemistState(),
      };
    case "trinket-shop":
      return {
        kind: screen,
        data: activeRun.trinketShopState
          ? hydrateTrinketShopState(activeRun.trinketShopState)
          : emptyTrinketShopState(),
      };
    case "equipment-shop":
      return {
        kind: screen,
        data: activeRun.equipmentShopState
          ? hydrateEquipmentShopState(activeRun.equipmentShopState)
          : emptyEquipmentShopState(),
      };
    case "mystery":
      return { kind: screen, data: hydrateMysteryVisit(activeRun.mysteryVisit) };
    case "campfire":
      return { kind: screen, data: activeRun.campfireState ?? emptyAlchemyVisit() };
    case "transmutation":
      return { kind: screen, data: activeRun.transmutationState ?? emptyAlchemyVisit() };
    case "corruption":
      return { kind: screen, data: activeRun.corruptionResult };
    case "battle":
      return activeRun.activeCombat
        ? { kind: "battle", data: { battleState: activeRun.activeCombat.battleState, battleStartState: null } }
        : { kind: "idle" };
    case "rewards":
    case "destination":
    case "labyrinth-map":
    case "wildwood-removal":
    case "draft-deck":
    case "difficulty-select":
      return { kind: screen };
    case "menu":
    case "game-mode-select":
    case "character-select":
    case "options":
    case "collection":
    case "talents":
    case "homestead":
    case "armory":
    case "game-over":
    case "run-victory":
      return { kind: "idle" };
  }
}
