import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { discoverCardIds, readProfileStore } from "@/features/alchemy/shared/stores/session/profile-store";
import {
  readActiveRun,
  readActiveRunScreen,
  readHasActiveBattle,
  readHasActiveRun,
  readRunSession,
} from "@/features/alchemy/shared/stores/session/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  setPendingCharacterId,
  setRunDeck,
  setRunProgressActivity,
  setStarterDraftChoices,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { logError } from "@/lib/error-logger";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import {
  cloneBattleCard,
  isCharacterUnlocked,
  isDifficultyUnlocked,
  isGameModeUnlocked,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";
import {
  IS_DEMO,
  isEditionCharacterAvailable,
  isEditionDifficultyAvailable,
  isEditionModeAvailable,
} from "@/lib/game-edition";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { createNewRunInitialization } from "./new-run-initialization";
import { createRunResumeNavigation } from "./run-resume-navigation";
import { isDifficultySelectContinuation } from "./run-start-command";

function unexpectedContentSystem(
  handler: string,
  systemType: ContentSystemId,
  deps: ContentSystemNavigationDeps,
): void {
  logError(`[content-system-navigation] ${handler}: unhandled content system ${systemType}`, "other");
  deps.navigateTo(ROUTE_SCREENS.MENU);
}

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps, gameSession: GameSession) {
  const {
    startCampaignRun,
    initializeRunForDifficulty,
    initializeLabyrinthRun,
    initializeWildwoodRun,
    initializeStarterDraftRun,
  } = createNewRunInitialization(deps, gameSession);
  const { resumeRun, beginContentSystem } = createRunResumeNavigation(deps, gameSession);

  function resolveNoviceCampaign(characterId: CharacterId, onDifficultySelect: () => void): void {
    const completed = IS_DEMO ? [] : (readProfileStore(gameSession).completedDifficulties[characterId] ?? []);
    if (completed.includes(DEFAULT_CAMPAIGN_DIFFICULTY_ID)) onDifficultySelect();
    else startCampaignRun(characterId, DEFAULT_CAMPAIGN_DIFFICULTY_ID, true);
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    if (readHasActiveRun(gameSession)) {
      resumeRun();
      return;
    }
    const systemType = readRunSession(gameSession).pendingContentSystemType;
    const finishedRunCharacters = readProfileStore(gameSession).finishedRunCharacters;
    if (
      !isEditionCharacterAvailable(selectedId) ||
      !isEditionModeAvailable(systemType) ||
      !isCharacterUnlocked(selectedId, finishedRunCharacters) ||
      !isGameModeUnlocked(systemType, finishedRunCharacters)
    )
      return;

    if (systemType === CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }

    if (selectedId === "wildcard") {
      if (systemType !== CONTENT_SYSTEMS.CAMPAIGN && systemType !== CONTENT_SYSTEMS.LABYRINTH) {
        unexpectedContentSystem("handleCharacterSelect", systemType, deps);
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
      unexpectedContentSystem("handleCharacterSelect", systemType, deps);
      return;
    }

    resolveNoviceCampaign(selectedId, () => {
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setPendingCharacterId(draft, selectedId)),
        undefined,
        gameSession,
      );
      deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT);
    });
  }

  function handleStarterDraftPick(cardId: string) {
    // Validate outside the command for debuggability; the guards inside are
    // the atomic safety net in case state changed between read and commit.
    if (!readHasActiveRun(gameSession)) {
      logError("[content-system-navigation] handleStarterDraftPick: no active run", "other");
      return;
    }
    const session = readRunSession(gameSession);
    const run = readActiveRun(gameSession);
    const offered = session.starterDraftChoices ?? [];
    if (run.contentSystemType === CONTENT_SYSTEMS.WILDWOOD || offered.length === 0) {
      logError("[content-system-navigation] handleStarterDraftPick: no starter draft offer", "other");
      return;
    }
    if (run.runDeck.length >= DRAFT_ROUNDS) {
      logError("[content-system-navigation] handleStarterDraftPick: draft already complete", "other");
      return;
    }
    if (!offered.some((choice: BattleCard) => choice.id === cardId)) {
      logError(`[content-system-navigation] handleStarterDraftPick: card not offered ${cardId}`, "other");
      return;
    }
    const picked = dispatchRunSessionCommand(
      (draft) => {
        const choices = draft.session.starterDraftChoices;
        if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.WILDWOOD || !choices?.length)
          return rejectCommand("Starter draft choice is unavailable", false);
        if (draft.run.activeRun.runDeck.length >= DRAFT_ROUNDS)
          return rejectCommand("Starter draft choice is unavailable", false);
        const picked = choices.find((choice) => choice.id === cardId);
        if (!picked) return rejectCommand("Starter draft choice is unavailable", false);
        const nextDeck = [...draft.run.activeRun.runDeck, cloneBattleCard(snapshotTransactionValue(picked))];
        setRunDeck(draft, nextDeck);
        discoverCardIds(draft, [picked.id]);
        setStarterDraftChoices(
          draft,
          nextDeck.length >= DRAFT_ROUNDS
            ? []
            : createStarterDraftChoices(
                snapshotTransactionValue(nextDeck),
                createDraftRunRandomSource(draft, "rewards"),
              ),
        );
        return acceptCommand(true);
      },
      undefined,
      gameSession,
    );
    if (picked) sessionFeedback(gameSession).playUISound("draftSelect");
  }

  function handleStandardDraftComplete() {
    const systemType =
      (readHasActiveRun(gameSession) ? readActiveRun(gameSession).contentSystemType : null) ??
      readRunSession(gameSession).pendingContentSystemType;

    if (systemType === CONTENT_SYSTEMS.WILDWOOD) {
      logError("[content-system-navigation] handleStandardDraftComplete: unexpected Wildwood draft", "other");
      return;
    }

    if (systemType !== CONTENT_SYSTEMS.CAMPAIGN && systemType !== CONTENT_SYSTEMS.LABYRINTH) {
      unexpectedContentSystem("handleStandardDraftComplete", systemType, deps);
      return;
    }

    if (!readHasActiveRun(gameSession)) {
      logError("[content-system-navigation] handleStandardDraftComplete: no active run", "other");
      return;
    }
    const run = readActiveRun(gameSession);
    const session = readRunSession(gameSession);
    if (
      run.characterId !== "wildcard" ||
      run.runDeck.length !== DRAFT_ROUNDS ||
      session.starterDraftChoices?.length !== 0 ||
      session.activity.kind !== "draft-deck" ||
      readActiveRunScreen(gameSession) !== ROUTE_SCREENS.DRAFT_DECK ||
      readHasActiveBattle(gameSession)
    )
      return;

    sessionFeedback(gameSession).playUISound("draftComplete");
    if (systemType === CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun("wildcard");
      return;
    }

    resolveNoviceCampaign("wildcard", () => {
      dispatchRunSessionCommand(
        (draft) => {
          setStarterDraftChoices(draft, null);
          setRunProgressActivity(draft, "difficulty-select");
          return acceptCommand();
        },
        undefined,
        gameSession,
      );
      deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT);
    });
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    const session = readRunSession(gameSession);
    const hasActiveRun = readHasActiveRun(gameSession);
    const activeCharacterId = hasActiveRun ? readActiveRun(gameSession).characterId : null;
    if (
      hasActiveRun &&
      !isDifficultySelectContinuation({
        characterId: activeCharacterId,
        activityKind: session.activity.kind,
        hasActiveBattle: readHasActiveBattle(gameSession),
      })
    ) {
      resumeRun();
      return;
    }
    const pendingCharacterId = readRunSession(gameSession).pendingCharacterId;
    const selectedId = pendingCharacterId ?? activeCharacterId;
    if (!selectedId) {
      logError("[content-system-navigation] handleDifficultySelect: no pending character", "other");
      deps.navigateTo(ROUTE_SCREENS.MENU);
      return;
    }
    const completed = readProfileStore(gameSession).completedDifficulties[selectedId] ?? [];
    if (
      !isEditionDifficultyAvailable(difficultyId) ||
      !isEditionCharacterAvailable(selectedId) ||
      !isCharacterUnlocked(selectedId, readProfileStore(gameSession).finishedRunCharacters) ||
      !isDifficultyUnlocked(difficultyId, completed)
    )
      return;
    startCampaignRun(selectedId, difficultyId);
  }

  function handleBackFromDifficultySelect() {
    if (readHasActiveRun(gameSession)) {
      if (
        !isDifficultySelectContinuation({
          characterId: readActiveRun(gameSession).characterId,
          activityKind: readRunSession(gameSession).activity.kind,
          hasActiveBattle: readHasActiveBattle(gameSession),
        })
      ) {
        resumeRun();
        return;
      }
      dispatchRunSessionCommand(
        (draft) => {
          // The completed draft is still confirmable when returning from difficulty selection.
          setStarterDraftChoices(draft, []);
          setRunProgressActivity(draft, "draft-deck");
          return acceptCommand();
        },
        undefined,
        gameSession,
      );
      deps.navigateTo(ROUTE_SCREENS.DRAFT_DECK);
      return;
    }
    deps.navigateTo(ROUTE_SCREENS.CHARACTER_SELECT);
  }

  return {
    resumeRun,
    beginCampaign: () => beginContentSystem(CONTENT_SYSTEMS.CAMPAIGN),
    beginLabyrinth: () => beginContentSystem(CONTENT_SYSTEMS.LABYRINTH),
    beginWildwood: () => beginContentSystem(CONTENT_SYSTEMS.WILDWOOD),
    handleCharacterSelect,
    handleStarterDraftPick,
    handleStandardDraftComplete,
    handleDifficultySelect,
    handleBackFromDifficultySelect,
    initializeRunForDifficulty,
  };
}
