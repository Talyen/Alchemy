import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import { sampleAndApplyDestinationOffer } from "@/features/alchemy/shared/stores/destination-offer-command";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  initializeBattle,
  setLabyrinthMap,
  setPendingCharacterId,
  setRunProgressActivity,
  setStarterDraftChoices,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { cloneBattleCard, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { applyRunStartToDraft, createDraftRunStartSnapshot } from "./run-start-command";

interface StartSnapshotOptions {
  difficultyId?: DifficultyId | null;
  draftedDeck?: BattleCard[];
}

function createStartSnapshot(
  draft: RunTransaction,
  characterId: CharacterId,
  contentSystemType: ContentSystemId,
  options: StartSnapshotOptions = {},
): RunStartSnapshot {
  const resolvedDraft =
    options.draftedDeck ??
    (characterId === "wildcard"
      ? snapshotTransactionValue(draft.run.activeRun.runDeck).map(cloneBattleCard)
      : undefined);
  return createDraftRunStartSnapshot(draft, {
    characterId,
    contentSystemType,
    difficultyId: options.difficultyId,
    draftedDeck: resolvedDraft,
  });
}

interface RunStartOutcome {
  playGoldSound: boolean;
}

function afterRunStartCommitted(outcome: RunStartOutcome, gameSession: GameSession): void {
  sessionFeedback(gameSession).playUISound("newRun");
  if (outcome.playGoldSound) sessionFeedback(gameSession).playGoldGain();
}

// Card hover clears universally on navigation (see run-flow-engine), so run
// starts only commit state here and play committed side effects afterwards.
function commitRunStart(
  mutate: (draft: RunTransaction) => RunStartOutcome,
  afterCommit: (() => void) | undefined,
  gameSession: GameSession,
): void {
  dispatchRunSessionCommand(
    (...args: Parameters<typeof mutate>) => acceptCommand(mutate(...args)),
    {
      afterCommit: (outcome) => {
        afterRunStartCommitted(outcome, gameSession);
        afterCommit?.();
      },
    },
    gameSession,
  );
}

export function createNewRunInitialization(deps: ContentSystemNavigationDeps, gameSession: GameSession) {
  function prepareCampaign(draft: RunTransaction, characterId: CharacterId, difficultyId: DifficultyId) {
    const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.CAMPAIGN, { difficultyId });
    const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true });
    setStarterDraftChoices(draft, null);
    sampleAndApplyDestinationOffer(draft);
    return { playGoldSound: startGoldGranted > 0 };
  }

  function startCampaignRun(characterId: CharacterId, difficultyId: DifficultyId, novice = false) {
    dispatchRunSessionCommand(
      (draft) => {
        const outcome = prepareCampaign(draft, characterId, difficultyId);
        if (draft.run.activeRun.runDeck.length === 0) throw new Error("Campaign requires a starting deck");
        setPendingCharacterId(draft, null);
        const battle = initializeBattle(draft, {
          kind: "battle",
          options: novice ? { enemyId: "skeleton" } : {},
        });
        if (!battle) throw new Error("Campaign opening battle could not be initialized");
        return acceptCommand({ ...outcome, battle });
      },
      {
        afterCommit: (outcome) => {
          // Schedule the display first: an opening Companion outcome can supersede it.
          deps.navigateTo(ROUTE_SCREENS.BATTLE);
          afterRunStartCommitted(outcome, gameSession);
          deps.presentBattleStart(outcome.battle);
        },
      },
      gameSession,
    );
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    commitRunStart((draft) => prepareCampaign(draft, characterId, difficultyId), undefined, gameSession);
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    commitRunStart(
      (draft) => {
        const snapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.LABYRINTH);
        const { startGoldGranted } = applyRunStartToDraft(draft, snapshot, { discoverDeck: true });
        setLabyrinthMap(draft, generateLabyrinthMap(createDraftRunRandomSource(draft, "world")));
        setStarterDraftChoices(draft, null);
        setRunProgressActivity(draft, "labyrinth-map");
        return { playGoldSound: startGoldGranted > 0 };
      },
      () => deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP),
      gameSession,
    );
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    commitRunStart(
      (draft) => {
        const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.WILDWOOD, { draftedDeck: [] });
        const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot);
        setStarterDraftChoices(draft, null);
        setWildwoodDraft(
          draft,
          createInitialWildwoodDraftState(characterId, createDraftRunRandomSource(draft, "world")),
        );
        setPendingCharacterId(draft, characterId);
        setRunProgressActivity(draft, "draft-deck");
        return { playGoldSound: startGoldGranted > 0 };
      },
      () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
      gameSession,
    );
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    commitRunStart(
      (draft) => {
        const startSnapshot = createStartSnapshot(draft, "wildcard", contentSystemType, { draftedDeck: [] });
        const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot);
        setPendingCharacterId(draft, "wildcard");
        setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
        setRunProgressActivity(draft, "draft-deck");
        return { playGoldSound: startGoldGranted > 0 };
      },
      () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
      gameSession,
    );
  }

  return {
    startCampaignRun,
    initializeRunForDifficulty,
    initializeLabyrinthRun,
    initializeWildwoodRun,
    initializeStarterDraftRun,
  };
}
