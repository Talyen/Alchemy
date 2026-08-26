// Content-system run start snapshots: campaign, labyrinth, wildwood, and Wildcard starter draft.
import { playGoldGain } from "@/lib/audio";
import {
  setPendingCharacterId,
  setWildwoodDraft,
  setStarterDraftChoices,
  setDestinationOfferState,
  setRewardState,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readHasActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { applyRunStartToDraft, createConfiguredRunStartSnapshot } from "./run-start-command";
import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";

export function createContentSystemRunInit(deps: ContentSystemNavigationDeps) {
  // Gold jingle plays only when this start is a fresh start for the system, matching grantStartGold.
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

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const startSnapshot = createStartSnapshot(characterId, CONTENT_SYSTEMS.CAMPAIGN, difficultyId);
    const playStartGold = isFreshSystemStart(CONTENT_SYSTEMS.CAMPAIGN);
    return dispatchRunSessionCommand(
      (draft) => {
        applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true });
        setStarterDraftChoices(draft, null);
        const run = draft.run.activeRun;
        const initialDestinations = createInitialDestinationResult({
          availableDestinations: deps.getAvailableDestinations({
            currentHealth: startSnapshot.runMaxHealth,
            currentGold: draft.runProfile.gold,
            destinationIndexInAct: 0,
            maxHealth: startSnapshot.runMaxHealth,
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
        return { freshDeck: startSnapshot.freshDeck, totalStartGold: draft.runProfile.gold };
      },
      {
        afterCommit: () => {
          if (playStartGold && startSnapshot.startGoldGrant > 0) playGoldGain();
          deps.clearCardHover();
        },
      },
    );
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    const snapshot = createStartSnapshot(characterId, CONTENT_SYSTEMS.LABYRINTH);
    const playStartGold = isFreshSystemStart(CONTENT_SYSTEMS.LABYRINTH);
    dispatchRunSessionCommand(
      (draft) => {
        applyRunStartToDraft(draft, snapshot, { discoverDeck: true });
        setStarterDraftChoices(draft, null);
      },
      {
        afterCommit: () => {
          if (playStartGold && snapshot.startGoldGrant > 0) playGoldGain();
          deps.clearCardHover();
          deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP);
        },
      },
    );
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    const startSnapshot = createStartSnapshot(characterId, CONTENT_SYSTEMS.WILDWOOD, null, []);
    const playStartGold = isFreshSystemStart(CONTENT_SYSTEMS.WILDWOOD);
    dispatchRunSessionCommand(
      (draft) => {
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
          if (playStartGold && startSnapshot.startGoldGrant > 0) playGoldGain();
          deps.clearCardHover();
          deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK);
        },
      },
    );
  }

  function initializeStarterDraftRun(contentSystemType: ContentSystemId) {
    const startSnapshot = createStartSnapshot("wildcard", contentSystemType, null, []);
    dispatchRunSessionCommand(
      (draft) => {
        applyRunStartToDraft(draft, startSnapshot);
        setPendingCharacterId(draft, "wildcard");
        setStarterDraftChoices(draft, createStarterDraftChoices([], createDraftRunRandomSource(draft, "rewards")));
      },
      {
        afterCommit: () => {
          if (startSnapshot.startGoldGrant > 0) playGoldGain();
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
