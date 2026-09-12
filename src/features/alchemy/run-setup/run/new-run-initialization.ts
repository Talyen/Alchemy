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
import { type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
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
    bossEnemyId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
    rng: createDraftRunRandomSource(draft, "destinations"),
  });
  setDestinationOfferState(draft, initialDestinations.offerState);
  setRewardState(draft, initialDestinations.rewardState);
}

export function cloneDraftCard(card: BattleCard): BattleCard {
  return { ...card, effects: card.effects ? [...card.effects] : card.effects };
}

function createStartSnapshot(
  draft: GameplayDraft,
  characterId: CharacterId,
  contentSystemType: ContentSystemId,
  difficultyId?: DifficultyId | null,
  draftedDeck?: BattleCard[],
): RunStartSnapshot {
  const resolvedDraft =
    draftedDeck ?? (characterId === "wildcard" ? draft.run.activeRun.runDeck.map(cloneDraftCard) : undefined);
  return createDraftRunStartSnapshot(draft, {
    characterId,
    contentSystemType,
    ...(difficultyId === undefined ? {} : { difficultyId }),
    ...(resolvedDraft === undefined ? {} : { draftedDeck: resolvedDraft }),
  });
}

function startRunSession<T>(
  deps: ContentSystemNavigationDeps,
  draftMutator: (draft: GameplayDraft) => { result: T; playGold: boolean; onNavigate?: () => void },
): T {
  let playGold = false;
  let onNavigate: (() => void) | undefined;
  let result!: T;
  dispatchRunSessionCommand(
    (draft) => {
      const outcome = draftMutator(draft);
      playGold = outcome.playGold;
      onNavigate = outcome.onNavigate;
      result = outcome.result;
    },
    {
      afterCommit: () => {
        if (playGold) playGoldGain();
        deps.clearCardHover();
        onNavigate?.();
      },
    },
  );
  return result;
}

export function createNewRunInitialization(deps: ContentSystemNavigationDeps) {
  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    return startRunSession(deps, (draft) => {
      const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.CAMPAIGN, difficultyId);
      const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true });
      setStarterDraftChoices(draft, null);
      sampleAndApplyInitialCampaignDestinations(draft, deps.getAvailableDestinations, startSnapshot.runMaxHealth);
      return {
        result: { freshDeck: startSnapshot.freshDeck, totalStartGold: draft.runProfile.gold },
        playGold: startGoldGranted > 0,
      };
    });
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    startRunSession(deps, (draft) => {
      const snapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.LABYRINTH);
      const { startGoldGranted } = applyRunStartToDraft(draft, snapshot, { discoverDeck: true });
      setLabyrinthMap(draft, generateLabyrinthMap(createDraftRunRandomSource(draft, "world")));
      setStarterDraftChoices(draft, null);
      return {
        result: undefined,
        playGold: startGoldGranted > 0,
        onNavigate: () => deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP),
      };
    });
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    startRunSession(deps, (draft) => {
      const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.WILDWOOD, null, []);
      const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot);
      setStarterDraftChoices(draft, null);
      setWildwoodDraft(draft, createInitialWildwoodDraftState(characterId, createDraftRunRandomSource(draft, "world")));
      setPendingCharacterId(draft, characterId);
      return {
        result: undefined,
        playGold: startGoldGranted > 0,
        onNavigate: () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
      };
    });
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    startRunSession(deps, (draft) => {
      const startSnapshot = createStartSnapshot(draft, "wildcard", contentSystemType, null, []);
      const { startGoldGranted } = applyRunStartToDraft(draft, startSnapshot);
      setPendingCharacterId(draft, "wildcard");
      setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
      return {
        result: undefined,
        playGold: startGoldGranted > 0,
        onNavigate: () => deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK),
      };
    });
  }

  return { initializeRunForDifficulty, initializeLabyrinthRun, initializeWildwoodRun, initializeStarterDraftRun };
}
