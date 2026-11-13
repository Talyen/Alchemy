import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import { sampleAndApplyDestinationOffer } from "@/features/alchemy/shared/stores/commands/destination-offer-command";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  initializeBattle,
  setLabyrinthMap,
  setPendingCharacterId,
  setRunProgressActivity,
  setStarterDraftChoices,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { startRunInDraft } from "./run-start-command";

// Card hover clears universally on navigation (see run-flow-engine), so run
// starts only commit state here and play committed side effects afterwards.
function commitRunStart(
  mutate: (draft: RunTransaction) => void,
  afterCommit: (() => void) | undefined,
  gameSession: GameSession,
): void {
  dispatchRunSessionCommand(
    (...args: Parameters<typeof mutate>) => acceptCommand(mutate(...args)),
    {
      afterCommit: () => {
        sessionFeedback(gameSession).playUISound("newRun");
        afterCommit?.();
      },
    },
    gameSession,
  );
}

export function createNewRunInitialization(deps: ContentSystemNavigationDeps, gameSession: GameSession) {
  function prepareCampaign(draft: RunTransaction, characterId: CharacterId, difficultyId: DifficultyId) {
    startRunInDraft(
      draft,
      { characterId, contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, difficultyId },
      { discoverDeck: true },
    );
    setStarterDraftChoices(draft, null);
    sampleAndApplyDestinationOffer(draft);
  }

  function startCampaignRun(characterId: CharacterId, difficultyId: DifficultyId, novice = false) {
    dispatchRunSessionCommand(
      (draft) => {
        prepareCampaign(draft, characterId, difficultyId);
        if (draft.run.activeRun.runDeck.length === 0) throw new Error("Campaign requires a starting deck");
        setPendingCharacterId(draft, null);
        const battle = initializeBattle(draft, {
          kind: "battle",
          options: novice ? { enemyId: "skeleton" } : {},
        });
        if (!battle) throw new Error("Campaign opening battle could not be initialized");
        return acceptCommand(battle);
      },
      {
        afterCommit: (outcome) => {
          // Schedule the display first: an opening Companion outcome can supersede it.
          deps.navigateTo(ROUTE_SCREENS.BATTLE);
          sessionFeedback(gameSession).playUISound("newRun");
          deps.presentBattleStart(outcome);
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
        startRunInDraft(draft, { characterId, contentSystemType: CONTENT_SYSTEMS.LABYRINTH }, { discoverDeck: true });
        setLabyrinthMap(
          draft,
          generateLabyrinthMap(
            createDraftRunRandomSource(draft, "world"),
            snapshotTransactionValue(draft.run.activeRun.runDeck),
          ),
        );
        setStarterDraftChoices(draft, null);
        setRunProgressActivity(draft, "labyrinth-map");
      },
      () => deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP),
      gameSession,
    );
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    commitRunStart(
      (draft) => {
        startRunInDraft(draft, { characterId, contentSystemType: CONTENT_SYSTEMS.WILDWOOD, draftedDeck: [] });
        setStarterDraftChoices(draft, null);
        setWildwoodDraft(
          draft,
          createInitialWildwoodDraftState(characterId, createDraftRunRandomSource(draft, "world")),
        );
        setPendingCharacterId(draft, characterId);
        setRunProgressActivity(draft, "draft-deck");
      },
      () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
      gameSession,
    );
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    commitRunStart(
      (draft) => {
        startRunInDraft(draft, { characterId: "wildcard", contentSystemType, draftedDeck: [] });
        setPendingCharacterId(draft, "wildcard");
        setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
        setRunProgressActivity(draft, "draft-deck");
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
