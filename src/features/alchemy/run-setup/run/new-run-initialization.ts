import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setDestinationOfferState,
  setLabyrinthMap,
  setPendingCharacterId,
  setRewardState,
  setStarterDraftChoices,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { playGoldGain } from "@/lib/audio";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { cloneBattleCard, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { applyRunStartToDraft, createDraftRunStartSnapshot } from "./run-start-command";

function sampleAndApplyInitialCampaignDestinations(
  draft: GameplayDraft,
  getAvailableDestinations: ContentSystemNavigationDeps["getAvailableDestinations"],
  maxHealth: number,
): void {
  const run = draft.run.activeRun;
  const initialDestinations = createInitialDestinationResult({
    availableDestinations: getAvailableDestinations({
      currentHealth: maxHealth,
      currentGold: draft.runProfile.gold,
      destinationIndexInAct: 0,
      maxHealth,
    }),
    offerState: {
      lastOfferedDestinations: run.lastOfferedDestinations,
      roundsSinceOffered: run.destinationRoundsSinceOffered,
    },
    rollBossEnemyId: () => rollFreshBossId(createDraftRunRandomSource(draft, "world")),
    rng: createDraftRunRandomSource(draft, "destinations"),
  });
  setDestinationOfferState(draft, initialDestinations.offerState);
  setRewardState(draft, initialDestinations.rewardState);
}

interface StartSnapshotOptions {
  difficultyId?: DifficultyId | null;
  draftedDeck?: BattleCard[];
}

function createStartSnapshot(
  draft: GameplayDraft,
  characterId: CharacterId,
  contentSystemType: ContentSystemId,
  options: StartSnapshotOptions = {},
): RunStartSnapshot {
  const resolvedDraft =
    options.draftedDeck ?? (characterId === "wildcard" ? draft.run.activeRun.runDeck.map(cloneBattleCard) : undefined);
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

function afterRunStartCommitted(outcome: RunStartOutcome): void {
  if (outcome.playGoldSound) playGoldGain();
}

// Card hover clears universally on navigation (see run-flow-engine), so run
// starts only commit state here and play committed side effects afterwards.
function commitRunStart(mutate: (draft: GameplayDraft) => RunStartOutcome, afterCommit?: () => void): void {
  dispatchRunSessionCommand(mutate, {
    afterCommit: (outcome) => {
      afterRunStartCommitted(outcome);
      afterCommit?.();
    },
  });
}

export function createNewRunInitialization(deps: ContentSystemNavigationDeps) {
  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const outcome = dispatchRunSessionCommand(
      (draft) => {
        const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.CAMPAIGN, { difficultyId });
        const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true });
        setStarterDraftChoices(draft, null);
        sampleAndApplyInitialCampaignDestinations(draft, deps.getAvailableDestinations, startSnapshot.runMaxHealth);
        return {
          freshDeck: startSnapshot.freshDeck,
          totalStartGold: draft.runProfile.gold,
          playGoldSound: startGoldGranted > 0,
        };
      },
      { afterCommit: (outcome) => afterRunStartCommitted(outcome) },
    );
    return { freshDeck: outcome.freshDeck, totalStartGold: outcome.totalStartGold };
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    commitRunStart(
      (draft) => {
        const snapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.LABYRINTH);
        const { startGoldGranted } = applyRunStartToDraft(draft, snapshot, { discoverDeck: true });
        setLabyrinthMap(draft, generateLabyrinthMap(createDraftRunRandomSource(draft, "world")));
        setStarterDraftChoices(draft, null);
        return { playGoldSound: startGoldGranted > 0 };
      },
      () => deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP),
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
        return { playGoldSound: startGoldGranted > 0 };
      },
      () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
    );
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    commitRunStart(
      (draft) => {
        const startSnapshot = createStartSnapshot(draft, "wildcard", contentSystemType, { draftedDeck: [] });
        const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot);
        setPendingCharacterId(draft, "wildcard");
        setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
        return { playGoldSound: startGoldGranted > 0 };
      },
      () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
    );
  }

  return { initializeRunForDifficulty, initializeLabyrinthRun, initializeWildwoodRun, initializeStarterDraftRun };
}
