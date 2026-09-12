import { afterCampaignCharacterResolved } from "@/features/alchemy/shared/run-flow/campaign-start";
import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import { discoverCardIds, readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import {
  readActiveRun,
  readHasActiveBattle,
  readHasActiveRun,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setPendingCharacterId,
  setRunDeck,
  setStarterDraftChoices,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { logError } from "@/lib/error-logger";
import { DEFAULT_BATTLE_ENEMY_TYPE, DRAFT_ROUNDS } from "@/lib/game-constants";
import { getDifficultyModifiers, isDifficultyUnlocked, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { cloneDraftCard, createNewRunInitialization } from "./new-run-initialization";
import { createRunResumeNavigation } from "./run-resume-navigation";

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  const { initializeRunForDifficulty, initializeLabyrinthRun, initializeWildwoodRun, initializeStarterDraftRun } =
    createNewRunInitialization(deps);
  const { resumeRun, beginContentSystem } = createRunResumeNavigation(deps);

  const noviceCampaignDeps = () => ({
    completedDifficulties: readProfileStore().completedDifficulties,
    initializeRunForDifficulty,
    getDifficultyModifiers,
    onStartBattle: deps.onStartBattle,

    navigateToBattle: () =>
      deps.navigateTo(ROUTE_SCREENS.BATTLE, () =>
        dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, null)),
      ),
  });

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
    if (readHasActiveRun()) {
      resumeRun();
      return;
    }
    const systemType = readRunSession().pendingContentSystemType;

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

  function handleStarterDraftPick(cardId: string) {
    dispatchRunSessionCommand((draft) => {
      const choices = draft.session.starterDraftChoices;
      if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.WILDWOOD || !choices?.length) return;
      if (draft.run.activeRun.runDeck.length >= DRAFT_ROUNDS) return;
      const picked = choices.find((choice) => choice.id === cardId);
      if (!picked) return;
      const nextDeck = [...draft.run.activeRun.runDeck, cloneDraftCard(picked)];
      setRunDeck(draft, nextDeck);
      discoverCardIds(draft, [picked.id]);
      setStarterDraftChoices(
        draft,
        nextDeck.length >= DRAFT_ROUNDS
          ? []
          : createStarterDraftChoices(nextDeck, createDraftRunRandomSource(draft, "rewards")),
      );
    });
  }

  function handleStandardDraftComplete() {
    const systemType =
      (readHasActiveRun() ? readActiveRun().contentSystemType : null) ?? readRunSession().pendingContentSystemType;

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
    if (run.characterId !== "wildcard" || run.runDeck.length < DRAFT_ROUNDS) return;

    dispatchRunSessionCommand((draft) => {
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
    const session = readRunSession();
    if (
      readHasActiveRun() &&
      !(
        readActiveRun().characterId === "wildcard" &&
        session.activity.kind === "difficulty-select" &&
        !readHasActiveBattle()
      )
    ) {
      resumeRun();
      return;
    }
    const pendingCharacterId = readRunSession().pendingCharacterId;
    const activeCharacterId = readHasActiveRun() ? readActiveRun().characterId : null;
    const selectedId = pendingCharacterId ?? activeCharacterId;
    if (!selectedId) {
      logError("[content-system-navigation] handleDifficultySelect: no pending character", "other");
      deps.navigateTo(ROUTE_SCREENS.MENU);
      return;
    }
    const completed = readProfileStore().completedDifficulties[selectedId] ?? [];
    if (!isDifficultyUnlocked(difficultyId, completed)) return;
    const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, difficultyId);
    if (!freshDeck || freshDeck.length === 0) return;
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
    resumeRun,
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
