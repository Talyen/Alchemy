// Content-system Play routing: begin/resume, character select, draft, and difficulty.
import { logError } from "@/lib/error-logger";
import { DEFAULT_BATTLE_ENEMY_TYPE, DRAFT_ROUNDS } from "@/lib/game-constants";
import {
  setPendingCharacterId,
  setPendingContentSystemType,
  setStarterDraftChoices,
  setDestinationOfferState,
  setRewardState,
  createDraftRunRandomSource,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import {
  readActiveRun,
  readHasActiveRun,
  readParkedRuns,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  hydrateModeRunInDraft,
  parkAndDeactivateForegroundRunInDraft,
} from "@/features/alchemy/shared/stores/run-park-restore";
import { afterCampaignCharacterResolved } from "@/features/alchemy/shared/run-flow/campaign-start";
import { restoreOrCreateDestinationRewardState } from "@/features/alchemy/shared/run-flow/destination-flow";
import {
  createStarterDraftChoices,
  wildcardStarterResumeTarget,
} from "@/features/alchemy/shared/run-flow/starter-draft";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { createContentSystemRunInit } from "./content-system-run-init";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { getDifficultyModifiers, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  const { initializeRunForDifficulty, initializeLabyrinthRun, initializeWildwoodRun, initializeStarterDraftRun } =
    createContentSystemRunInit(deps);

  const noviceCampaignDeps = () => ({
    completedDifficulties: deps.completedDifficulties,
    initializeRunForDifficulty,
    getDifficultyModifiers,
    onStartBattle: deps.onStartBattle,
    // Mirror handleDifficultySelect: the started run supersedes any pending character.
    navigateToBattle: () =>
      deps.navigateTo(ROUTE_SCREENS.BATTLE, () =>
        dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, null)),
      ),
  });

  function resumeActiveContentSystem(systemId: ContentSystemId) {
    const run = readActiveRun();
    const starterResume = wildcardStarterResumeTarget({
      characterId: run.characterId,
      contentSystemType: run.contentSystemType,
      selectedDifficulty: run.selectedDifficulty,
      runDeckLength: run.runDeck.length,
      starterDraftChoices: readRunSession().starterDraftChoices,
    });
    if (starterResume === "draft-deck") {
      deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK);
      return;
    }
    if (starterResume === "difficulty-select") {
      deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT);
      return;
    }
    if (systemId === CONTENT_SYSTEMS.LABYRINTH) {
      deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP);
    } else if (systemId === CONTENT_SYSTEMS.CAMPAIGN) {
      deps.navigateTo(ROUTE_SCREENS.DESTINATION, () => {
        dispatchRunSessionCommand((draft) => {
          const active = draft.run.activeRun;
          setRewardState(draft, (prev) =>
            restoreOrCreateDestinationRewardState(prev, {
              availableDestinations: deps.getAvailableDestinations({
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
        });
      });
    } else if (systemId === CONTENT_SYSTEMS.WILDWOOD) {
      deps.onResumeWildwood();
    }
  }

  function beginContentSystem(systemId: ContentSystemId) {
    if (deps.hasActiveRun && deps.run.contentSystemType === systemId) {
      if (deps.hasActiveBattle) {
        deps.returnToBattle();
        return;
      }
      resumeActiveContentSystem(systemId);
      return;
    }
    const parked = readParkedRuns()[systemId];
    if (parked) {
      dispatchRunSessionCommand((draft) => {
        hydrateModeRunInDraft(draft, systemId);
      });
      resumeActiveContentSystem(systemId);
      return;
    }
    dispatchRunSessionCommand((draft) => {
      if (draft.session.hasActiveRun && draft.run.activeRun.contentSystemType !== systemId) {
        parkAndDeactivateForegroundRunInDraft(draft);
        setPendingCharacterId(draft, null);
      }
      setPendingContentSystemType(draft, systemId);
    });
    deps.navigateTo(ROUTE_SCREENS.CHARACTER_SELECT);
  }

  function beginCampaign() {
    beginContentSystem(CONTENT_SYSTEMS.CAMPAIGN);
  }

  function beginLabyrinth() {
    beginContentSystem(CONTENT_SYSTEMS.LABYRINTH);
  }

  function beginWildwood() {
    beginContentSystem(CONTENT_SYSTEMS.WILDWOOD);
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = deps.pendingContentSystemType;

    if (systemType === CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }

    if (selectedId === "wildcard") {
      if (systemType !== CONTENT_SYSTEMS.CAMPAIGN && systemType !== CONTENT_SYSTEMS.LABYRINTH) {
        logError(`[content-system-navigation] handleCharacterSelect: unhandled content system ${systemType}`, "other");
        deps.navigateTo(ROUTE_SCREENS.MENU);
        return;
      }
      initializeStarterDraftRun(systemType);
      return;
    }

    if (systemType === CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun(selectedId);
      return;
    }
    if (systemType !== CONTENT_SYSTEMS.CAMPAIGN) {
      logError(`[content-system-navigation] handleCharacterSelect: unhandled content system ${systemType}`, "other");
      deps.navigateTo(ROUTE_SCREENS.MENU);
      return;
    }

    afterCampaignCharacterResolved(selectedId, noviceCampaignDeps(), () => {
      dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, selectedId));
      deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT);
    });
  }

  function handleStarterDraftPick(card: BattleCard) {
    dispatchRunSessionCommand((draft) => {
      const choices = draft.session.starterDraftChoices;
      if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.WILDWOOD || !choices?.length) return;
      if (draft.run.activeRun.runDeck.length >= DRAFT_ROUNDS) return;
      if (!choices.some((choice) => choice.id === card.id)) return;
      const nextDeck = [...draft.run.activeRun.runDeck, card];
      setRunDeck(draft, nextDeck);
      discoverCardIds(draft, [card.id]);
      setStarterDraftChoices(
        draft,
        nextDeck.length >= DRAFT_ROUNDS
          ? []
          : createStarterDraftChoices(nextDeck, createDraftRunRandomSource(draft, "rewards")),
      );
    });
  }

  function handleStandardDraftComplete(draftedCards: BattleCard[]) {
    const systemType = deps.pendingContentSystemType;

    if (systemType === CONTENT_SYSTEMS.WILDWOOD) {
      logError("[content-system-navigation] handleStandardDraftComplete: unexpected Wildwood draft", "other");
      return;
    }

    if (systemType !== CONTENT_SYSTEMS.CAMPAIGN && systemType !== CONTENT_SYSTEMS.LABYRINTH) {
      logError(
        `[content-system-navigation] handleStandardDraftComplete: unhandled content system ${systemType}`,
        "other",
      );
      deps.navigateTo(ROUTE_SCREENS.MENU);
      return;
    }

    const run = readActiveRun();
    const completedDeck =
      run.characterId === "wildcard" && run.runDeck.length >= DRAFT_ROUNDS ? run.runDeck : draftedCards;
    if (completedDeck.length < DRAFT_ROUNDS) return;

    dispatchRunSessionCommand((draft) => {
      const active = draft.run.activeRun;
      if (active.characterId !== "wildcard" || active.runDeck.length < DRAFT_ROUNDS) {
        setRunDeck(draft, completedDeck);
        discoverCardIds(
          draft,
          completedDeck.map((card) => card.id),
        );
      }
      setStarterDraftChoices(draft, null);
    });

    if (systemType === CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun("wildcard");
      return;
    }

    afterCampaignCharacterResolved("wildcard", noviceCampaignDeps(), () =>
      deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT),
    );
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    const selectedId = readRunSession().pendingCharacterId ?? readActiveRun().characterId;
    if (!selectedId) {
      logError("[content-system-navigation] handleDifficultySelect: no pending character", "other");
      deps.navigateTo(ROUTE_SCREENS.MENU);
      return;
    }
    const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, difficultyId);
    const modifiers = getDifficultyModifiers(selectedId, difficultyId);
    deps.onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
    deps.navigateTo(ROUTE_SCREENS.BATTLE, () =>
      dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, null)),
    );
  }

  function handleBackFromDifficultySelect() {
    if (readHasActiveRun() && readActiveRun().characterId === "wildcard") {
      deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK);
      return;
    }
    deps.navigateTo(ROUTE_SCREENS.CHARACTER_SELECT);
  }

  return {
    beginCampaign,
    beginLabyrinth,
    beginWildwood,
    handleCharacterSelect,
    handleStarterDraftPick,
    handleStandardDraftComplete,
    handleDifficultySelect,
    handleBackFromDifficultySelect,
    initializeRunForDifficulty,
  };
}
