import {
  createEmptyRewardState,
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateMysteryVisit,
  hydrateShopState,
  hydrateTrinketShopState,
  restorePendingRewardBundle,
  serializePendingReward,
  serializeMysteryVisit,
  serializeTrinketShopState,
  type ActiveRunData,
  type RunActivity,
  type PersistedRunActivity,
  type RewardState,
} from "@/lib/active-run-session";
import { battleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import type { RunSessionFields } from "./run-domain-types";
import type { RunSession } from "./run-reads";
import { ACTIVE_RUN_PROGRESS_KEYS, createInitialActiveRunFields, type ActiveRunProgressFields } from "./run-state-init";

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

function encodeActivity(session: RunSession["session"]): PersistedRunActivity {
  const activity = session.activity;
  switch (activity.kind) {
    case "inactive":
    case "idle":
      throw new Error("An active run must establish a resumable activity before saving");
    case "battle": {
      const state = battleSnapshot(activity.data.battleState);
      delete state.battleMetrics;
      return { kind: "battle", data: { battleState: state } };
    }
    case "rewards": {
      const { choices: _choices, ...defaults } = createEmptyRewardState();
      return {
        kind: "rewards",
        data: serializePendingReward(session.rewardFlow.state, session.rewardFlow.companionCards) ?? {
          ...defaults,
          rewardType: "card",
          choiceIds: [],
          companionChoiceIds: [],
        },
      };
    }
    case "destination": {
      const state = session.rewardFlow.state;
      return {
        kind: "destination",
        data: {
          destinations: [...state.destinations],
          selectedBossId: state.selectedBossId,
          lastVictoryEnemyType: state.lastVictoryEnemyType,
          lastVictoryContentSystem: state.lastVictoryContentSystem,
        },
      };
    }
    case "mystery": {
      const data = serializeMysteryVisit(activity.data);
      if (!data) throw new Error("Mystery activity requires its resolved visit");
      return { kind: "mystery", data };
    }
    case "trinket-shop":
      return { kind: "trinket-shop", data: serializeTrinketShopState(activity.data) };
    case "draft-deck":
    case "difficulty-select":
    case "labyrinth-map":
    case "wildwood-removal":
      return { kind: activity.kind };
    case "campfire":
    case "transmutation":
    case "shop":
    case "alchemist":
    case "equipment-shop":
    case "corruption":
      return activity;
    default:
      throw new Error("Unknown run activity");
  }
}
export function encodeRunResumeSnapshot(source: RunSession): ActiveRunData {
  const { run, session } = source;
  const progress = pickActiveRunProgress(run);
  const labyrinth = progress.contentSystemType === "labyrinth";
  return {
    ...progress,
    destinationRoundsSinceOffered: { ...progress.destinationRoundsSinceOffered },
    rng: { seed: progress.rng.seed, counters: { ...progress.rng.counters } },
    labyrinthMap: labyrinth ? session.labyrinthMap : null,
    labyrinthPendingNode: labyrinth ? session.activeLabyrinthPendingNode : null,
    activeLabyrinthModifiers: labyrinth ? [...session.activeLabyrinthModifiers] : [],
    activeLabyrinthRewardModifiers: labyrinth ? [...session.activeLabyrinthRewardModifiers] : [],
    wildwoodDraft: progress.contentSystemType === "wildwood" ? session.wildwoodDraft : null,
    starterDraftChoices: progress.contentSystemType === "wildwood" ? null : session.starterDraftChoices,
    activity: encodeActivity(session),
  };
}
export function decodeRunResumeSnapshot(activeRun: ActiveRunData, generateSeed?: () => number) {
  const saved = activeRun.activity;
  let activity: RunActivity;
  let rewardState: RewardState | null = null;
  let companionRewardCards: BattleCard[] | null = null;
  switch (saved.kind) {
    case "shop":
      activity = { kind: saved.kind, data: hydrateShopState(saved.data) };
      break;
    case "alchemist":
      activity = { kind: saved.kind, data: hydrateAlchemistState(saved.data) };
      break;
    case "trinket-shop":
      activity = { kind: saved.kind, data: hydrateTrinketShopState(saved.data) };
      break;
    case "equipment-shop":
      activity = { kind: saved.kind, data: hydrateEquipmentShopState(saved.data) };
      break;
    case "mystery":
      activity = { kind: saved.kind, data: hydrateMysteryVisit(saved.data) };
      break;
    case "rewards": {
      const restored = restorePendingRewardBundle(saved.data);
      rewardState = restored.rewardState ?? createEmptyRewardState();
      companionRewardCards = restored.companionRewardCards;
      activity = { kind: "rewards" };
      break;
    }
    case "destination":
      rewardState = { ...createEmptyRewardState(), ...saved.data };
      activity = { kind: "destination" };
      break;
    case "battle":
    case "campfire":
    case "corruption":
    case "transmutation":
    case "draft-deck":
    case "difficulty-select":
    case "labyrinth-map":
    case "wildwood-removal":
      activity = saved;
      break;
    default:
      throw new Error("Unknown saved activity");
  }
  return {
    progress: createInitialActiveRunFields(activeRun, "knight", generateSeed),
    screen: saved.kind as Screen,
    session: {
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      activeLabyrinthModifiers: activeRun.activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: activeRun.activeLabyrinthRewardModifiers,
      wildwoodDraft: activeRun.wildwoodDraft,
      starterDraftChoices: activeRun.starterDraftChoices,
      rewardState,
      companionRewardCards,
      activity,
    },
  };
}
export type DecodedRunResumeSession = ReturnType<typeof decodeRunResumeSnapshot>["session"];
