// Content-system entry: campaign, labyrinth, wildwood, character select, and run start.
import { logError } from "@/lib/error-logger";
import { playGoldGain } from "@/lib/audio";
import { getDifficultyModifiers, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { DEFAULT_BATTLE_ENEMY_TYPE } from "@/lib/game-constants";
import type { ContentSystemId } from "@/lib/content-systems/types";
import {
  setPendingCharacterId,
  setPendingContentSystemType,
  setWildwoodDraft,
  setDestinationOfferState,
  setRewardState,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { afterCampaignCharacterResolved } from "@/features/alchemy/shared/run-flow/campaign-start";
import {
  createInitialDestinationResult,
  restoreOrCreateDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { CONSTANTS } from "../../shared/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { applyRunStartToDraft, createConfiguredRunStartSnapshot } from "./run-start-command";

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  function createStartSnapshot(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
    draftedDeck?: BattleCard[],
  ) {
    const resolvedDraft =
      draftedDeck ??
      (characterId === "wildcard" && deps.draftedDeckRef.current ? deps.draftedDeckRef.current : undefined);
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
    const startSnapshot = createStartSnapshot(characterId, CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN, difficultyId);
    return dispatchRunSessionCommand(
      (draft) => {
        applyRunStartToDraft(draft, startSnapshot, { discoverDeck: true, resetEncounteredEnemies: true });
        const run = draft.run.activeRun;
        const initialDestinations = createInitialDestinationResult({
          availableDestinations: deps.getAvailableDestinations({
            currentHealth: startSnapshot.runMaxHealth,
            currentGold: startSnapshot.runGold,
            destinationIndexInAct: 0,
            maxHealth: startSnapshot.runMaxHealth,
          }),
          offerState: {
            lastOfferedDestinations: run.lastOfferedDestinations,
            roundsSinceOffered: run.destinationRoundsSinceOffered,
          },
          bossEnemyId: getBossEnemy([], createDraftRunRandomSource(draft, "world")).id,
          rng: createDraftRunRandomSource(draft, "destinations"),
        });
        setDestinationOfferState(draft, initialDestinations.offerState);
        setRewardState(draft, initialDestinations.rewardState);
        return { freshDeck: startSnapshot.freshDeck, totalStartGold: startSnapshot.runGold };
      },
      {
        afterCommit: () => {
          if (startSnapshot.runGold > 0) playGoldGain();
          deps.clearCardHover();
        },
      },
    );
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    const snapshot = createStartSnapshot(characterId, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
    dispatchRunSessionCommand((draft) => applyRunStartToDraft(draft, snapshot, { discoverDeck: true }), {
      afterCommit: () => {
        if (snapshot.runGold > 0) playGoldGain();
        deps.clearCardHover();
        deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      },
    });
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    const startSnapshot = createStartSnapshot(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD, null, []);
    dispatchRunSessionCommand(
      (draft) => {
        applyRunStartToDraft(draft, startSnapshot);
        setWildwoodDraft(
          draft,
          createInitialWildwoodDraftState(characterId, createDraftRunRandomSource(draft, "world")),
        );
        setPendingCharacterId(draft, characterId);
      },
      {
        afterCommit: () => {
          deps.clearCardHover();
          deps.navigateTo(CONSTANTS.SCREENS.DRAFT_DECK);
        },
      },
    );
  }

  const noviceCampaignDeps = () => ({
    completedDifficulties: deps.completedDifficulties,
    initializeRunForDifficulty,
    getDifficultyModifiers,
    onStartBattle: deps.onStartBattle,
    navigateToBattle: () => deps.navigateTo(CONSTANTS.SCREENS.BATTLE),
  });

  function beginContentSystem(systemId: ContentSystemId) {
    if (deps.hasActiveBattle && deps.run.contentSystemType === systemId) {
      deps.returnToBattle();
      return;
    }
    if (deps.hasActiveRun && deps.run.contentSystemType === systemId) {
      if (systemId === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
        deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
        deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
          dispatchRunSessionCommand((draft) => {
            const run = draft.run.activeRun;
            setRewardState(draft, (prev) =>
              restoreOrCreateDestinationRewardState(prev, {
                availableDestinations: deps.getAvailableDestinations(),
                offerState: {
                  lastOfferedDestinations: run.lastOfferedDestinations,
                  roundsSinceOffered: run.destinationRoundsSinceOffered,
                },
                bossEnemyId: getBossEnemy([], createDraftRunRandomSource(draft, "world")).id,
                rng: createDraftRunRandomSource(draft, "destinations"),
                onSampled: (result) => setDestinationOfferState(draft, result.offerState),
              }),
            );
          });
        });
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
        deps.onResumeWildwood();
      }
      return;
    }
    dispatchRunSessionCommand((draft) => setPendingContentSystemType(draft, systemId));
    deps.navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function beginCampaign() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
  }

  function beginLabyrinth() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
  }

  function beginWildwood() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = deps.pendingContentSystemType;

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }

    if (selectedId === "wildcard") {
      dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, selectedId));
      deps.draftedDeckRef.current = null;
      deps.navigateTo(CONSTANTS.SCREENS.DRAFT_DECK);
      return;
    }

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun(selectedId);
      return;
    }
    if (systemType !== CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
      logError(`[content-system-navigation] handleCharacterSelect: unhandled content system ${systemType}`, "other");
      deps.navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }

    afterCampaignCharacterResolved(selectedId, noviceCampaignDeps(), () => {
      dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, selectedId));
      deps.navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT);
    });
  }

  function handleStandardDraftComplete(draftedCards: BattleCard[]) {
    const systemType = deps.pendingContentSystemType;

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      logError("[content-system-navigation] handleStandardDraftComplete: unexpected Wildwood draft", "other");
      return;
    }

    if (systemType !== CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN && systemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      logError(
        `[content-system-navigation] handleStandardDraftComplete: unhandled content system ${systemType}`,
        "other",
      );
      deps.navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }

    deps.draftedDeckRef.current = draftedCards;
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun("wildcard");
      return;
    }

    afterCampaignCharacterResolved("wildcard", noviceCampaignDeps(), () =>
      deps.navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT),
    );
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    const pendingCharacterId = readRunSession().pendingCharacterId;
    if (!pendingCharacterId) {
      logError("[content-system-navigation] handleDifficultySelect: no pending character", "other");
      deps.navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }
    const selectedId = pendingCharacterId;
    const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, difficultyId);
    const modifiers = getDifficultyModifiers(selectedId, difficultyId);
    deps.onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
    deps.navigateTo(CONSTANTS.SCREENS.BATTLE, () =>
      dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, null)),
    );
  }

  function handleBackFromDifficultySelect() {
    deps.navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  return {
    beginCampaign,
    beginLabyrinth,
    beginWildwood,
    handleCharacterSelect,
    handleStandardDraftComplete,
    handleDifficultySelect,
    handleBackFromDifficultySelect,
    initializeRunForDifficulty,
  };
}
