import { playGoldGain } from "@/lib/audio";
import {
  setPendingCharacterId,
  setWildwoodDraft,
  setStarterDraftChoices,
  setDestinationOfferState,
  setRewardState,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createInitialDestinationResult,
  restoreOrCreateDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { applyRunStartToDraft, createConfiguredRunStartSnapshot } from "./run-start-command";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
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
  function isFreshSystemStart(contentSystemType: ContentSystemId): boolean {
    return !readHasActiveRun() || readActiveRun().contentSystemType !== contentSystemType;
  }

  function createStartSnapshot(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
    draftedDeck?: BattleCard[],
  ) {
    const resolvedDraft = draftedDeck ?? (characterId === "wildcard" ? readActiveRun().runDeck : undefined);
    return createConfiguredRunStartSnapshot({
      characterId,
      contentSystemType,
      talentStartGold: deps.talents.talentEffects.startGold,
      talentXP: deps.talents.talentXP,
      ...(difficultyId === undefined ? {} : { difficultyId }),
      ...(resolvedDraft === undefined ? {} : { draftedDeck: resolvedDraft }),
    });
  }

  function runInitCommit<T>(
    contentSystemType: ContentSystemId,
    startGoldGrant: number,
    command: (draft: GameplayDraft) => T,
    navigateToScreen?: Screen,
  ): T {
    const playStartGold = isFreshSystemStart(contentSystemType);
    return dispatchRunSessionCommand(command, {
      afterCommit: () => {
        if (playStartGold && startGoldGrant > 0) playGoldGain();
        deps.clearCardHover();
        if (navigateToScreen) {
          deps.navigateTo(navigateToScreen);
        }
      },
    });
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const startSnapshot = createStartSnapshot(characterId, CONTENT_SYSTEMS.CAMPAIGN, difficultyId);
    return runInitCommit(CONTENT_SYSTEMS.CAMPAIGN, startSnapshot.startGoldGrant, (draft) => {
      applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true });
      setStarterDraftChoices(draft, null);
      sampleAndApplyInitialCampaignDestinations(draft, deps.getAvailableDestinations, startSnapshot.runMaxHealth);
      return { freshDeck: startSnapshot.freshDeck, totalStartGold: draft.runProfile.gold };
    });
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    const snapshot = createStartSnapshot(characterId, CONTENT_SYSTEMS.LABYRINTH);
    runInitCommit(
      CONTENT_SYSTEMS.LABYRINTH,
      snapshot.startGoldGrant,
      (draft) => {
        applyRunStartToDraft(draft, snapshot, { discoverDeck: true });
        setStarterDraftChoices(draft, null);
      },
      ROUTE_SCREENS.LABYRINTH_MAP,
    );
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    const startSnapshot = createStartSnapshot(characterId, CONTENT_SYSTEMS.WILDWOOD, null, []);
    runInitCommit(
      CONTENT_SYSTEMS.WILDWOOD,
      startSnapshot.startGoldGrant,
      (draft) => {
        applyRunStartToDraft(draft, startSnapshot);
        setStarterDraftChoices(draft, null);
        setWildwoodDraft(
          draft,
          createInitialWildwoodDraftState(characterId, createDraftRunRandomSource(draft, "world")),
        );
        setPendingCharacterId(draft, characterId);
      },
      ROUTE_SCREENS.DRAFT_DECK,
    );
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    const startSnapshot = createStartSnapshot("wildcard", contentSystemType, null, []);
    runInitCommit(
      contentSystemType,
      startSnapshot.startGoldGrant,
      (draft) => {
        applyRunStartToDraft(draft, startSnapshot);
        setPendingCharacterId(draft, "wildcard");
        setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
      },
      ROUTE_SCREENS.DRAFT_DECK,
    );
  }

  return {
    initializeRunForDifficulty,
    initializeLabyrinthRun,
    initializeWildwoodRun,
    initializeStarterDraftRun,
  };
}
