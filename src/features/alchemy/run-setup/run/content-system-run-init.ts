import { playGoldGain } from "@/lib/audio";
import {
  setPendingCharacterId,
  setWildwoodDraft,
  setStarterDraftChoices,
  setDestinationOfferState,
  setRewardState,
  setLabyrinthMap,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createInitialDestinationResult,
  restoreOrCreateDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { createStarterDraftChoices } from "./starter-draft";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { applyRunStartToDraft, createDraftRunStartSnapshot } from "./run-start-command";
import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";

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

export function restoreResumedCampaignDestinations(
  draft: GameplayDraft,
  getAvailableDestinations: ContentSystemNavigationDeps["getAvailableDestinations"],
): void {
  const active = draft.run.activeRun;
  setRewardState(draft, (prev) =>
    restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: getAvailableDestinations({
        currentHealth: active.runPlayerHealth,
        currentGold: draft.runProfile.gold,
        destinationIndexInAct: active.destinationIndexInAct,
        maxHealth: active.runMaxHealth,
      }),
      offerState: {
        lastOfferedDestinations: active.lastOfferedDestinations,
        roundsSinceOffered: active.destinationRoundsSinceOffered,
      },
      bossEnemyId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
      rng: createDraftRunRandomSource(draft, "destinations"),
      onSampled: (result) => setDestinationOfferState(draft, result.offerState),
    }),
  );
}

export function createContentSystemRunInit(deps: ContentSystemNavigationDeps) {
  function createStartSnapshot(
    draft: GameplayDraft,
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
    draftedDeck?: BattleCard[],
  ) {
    const resolvedDraft =
      draftedDeck ??
      (characterId === "wildcard"
        ? [...draft.run.activeRun.runDeck.map((c) => ({ ...c, effects: [...(c.effects ?? [])] }))]
        : undefined);
    return createDraftRunStartSnapshot(draft, {
      characterId,
      contentSystemType,
      ...(difficultyId === undefined ? {} : { difficultyId }),
      ...(resolvedDraft === undefined ? {} : { draftedDeck: resolvedDraft }),
    });
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    let shouldPlayGold = false;
    const result = dispatchRunSessionCommand(
      (draft) => {
        const isFreshStart =
          !draft.session.hasActiveRun || draft.run.activeRun.contentSystemType !== CONTENT_SYSTEMS.CAMPAIGN;
        const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.CAMPAIGN, difficultyId);
        shouldPlayGold = isFreshStart && startSnapshot.startGoldGrant > 0;
        applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true });
        setStarterDraftChoices(draft, null);
        sampleAndApplyInitialCampaignDestinations(draft, deps.getAvailableDestinations, startSnapshot.runMaxHealth);
        return { freshDeck: startSnapshot.freshDeck, totalStartGold: draft.runProfile.gold };
      },
      {
        afterCommit: () => {
          if (shouldPlayGold) playGoldGain();
          deps.clearCardHover();
        },
      },
    );
    return result;
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    let shouldPlayGold = false;
    dispatchRunSessionCommand(
      (draft) => {
        const isFreshStart =
          !draft.session.hasActiveRun || draft.run.activeRun.contentSystemType !== CONTENT_SYSTEMS.LABYRINTH;
        const snapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.LABYRINTH);
        shouldPlayGold = isFreshStart && snapshot.startGoldGrant > 0;
        applyRunStartToDraft(draft, snapshot, { discoverDeck: true });
        setLabyrinthMap(draft, generateLabyrinthMap(createDraftRunRandomSource(draft, "world")));
        setStarterDraftChoices(draft, null);
      },
      {
        afterCommit: () => {
          if (shouldPlayGold) playGoldGain();
          deps.clearCardHover();
          deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP);
        },
      },
    );
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    let shouldPlayGold = false;
    dispatchRunSessionCommand(
      (draft) => {
        const isFreshStart =
          !draft.session.hasActiveRun || draft.run.activeRun.contentSystemType !== CONTENT_SYSTEMS.WILDWOOD;
        const startSnapshot = createStartSnapshot(draft, characterId, CONTENT_SYSTEMS.WILDWOOD, null, []);
        shouldPlayGold = isFreshStart && startSnapshot.startGoldGrant > 0;
        applyRunStartToDraft(draft, startSnapshot);
        setStarterDraftChoices(draft, null);
        setWildwoodDraft(
          draft,
          createInitialWildwoodDraftState(characterId, createDraftRunRandomSource(draft, "world")),
        );
        setPendingCharacterId(draft, characterId);
      },
      {
        afterCommit: () => {
          if (shouldPlayGold) playGoldGain();
          deps.clearCardHover();
          deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK);
        },
      },
    );
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    let shouldPlayGold = false;
    dispatchRunSessionCommand(
      (draft) => {
        const isFreshStart = !draft.session.hasActiveRun || draft.run.activeRun.contentSystemType !== contentSystemType;
        const startSnapshot = createStartSnapshot(draft, "wildcard", contentSystemType, null, []);
        shouldPlayGold = isFreshStart && startSnapshot.startGoldGrant > 0;
        applyRunStartToDraft(draft, startSnapshot);
        setPendingCharacterId(draft, "wildcard");
        setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
      },
      {
        afterCommit: () => {
          if (shouldPlayGold) playGoldGain();
          deps.clearCardHover();
          deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK);
        },
      },
    );
  }

  return {
    initializeRunForDifficulty,
    initializeLabyrinthRun,
    initializeWildwoodRun,
    initializeStarterDraftRun,
  };
}
