import {
  afterCampaignCharacterResolved,
  type NoviceCampaignStartDeps,
} from "@/features/alchemy/shared/run-flow/campaign-start";
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
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { logError } from "@/lib/error-logger";
import { DEFAULT_BATTLE_ENEMY_TYPE, DRAFT_ROUNDS } from "@/lib/game-constants";
import {
  cloneBattleCard,
  getDifficultyModifiers,
  isDifficultyUnlocked,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { createNewRunInitialization } from "./new-run-initialization";
import { createRunResumeNavigation } from "./run-resume-navigation";
import { isDifficultySelectContinuation } from "./run-start-command";

function buildNoviceCampaignDeps(
  deps: ContentSystemNavigationDeps,
  initializeRunForDifficulty: NoviceCampaignStartDeps["initializeRunForDifficulty"],
): NoviceCampaignStartDeps {
  return {
    completedDifficulties: readProfileStore().completedDifficulties,
    initializeRunForDifficulty,
    getDifficultyModifiers,
    onStartBattle: deps.onStartBattle,
    navigateToBattle: () =>
      deps.navigateTo(ROUTE_SCREENS.BATTLE, () =>
        dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, null)),
      ),
  };
}

function unexpectedContentSystem(
  handler: string,
  systemType: ContentSystemId,
  deps: ContentSystemNavigationDeps,
): void {
  logError(`[content-system-navigation] ${handler}: unhandled content system ${systemType}`, "other");
  deps.navigateTo(ROUTE_SCREENS.MENU);
}

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  const { initializeRunForDifficulty, initializeLabyrinthRun, initializeWildwoodRun, initializeStarterDraftRun } =
    createNewRunInitialization(deps);
  const { resumeRun, beginContentSystem } = createRunResumeNavigation(deps);

  function resolveNoviceCampaign(characterId: CharacterId, onDifficultySelect: () => void): void {
    afterCampaignCharacterResolved(
      characterId,
      buildNoviceCampaignDeps(deps, initializeRunForDifficulty),
      onDifficultySelect,
    );
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
      dispatchRunSessionCommand((draft) => setPendingCharacterId(draft, selectedId));
      deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT);
    });
  }

  function handleStarterDraftPick(cardId: string) {
    // Validate outside the command for debuggability; the guards inside are
    // the atomic safety net in case state changed between read and commit.
    if (!readHasActiveRun()) {
      logError("[content-system-navigation] handleStarterDraftPick: no active run", "other");
      return;
    }
    const session = readRunSession();
    const run = readActiveRun();
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
    dispatchRunSessionCommand((draft) => {
      const choices = draft.session.starterDraftChoices;
      if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.WILDWOOD || !choices?.length) return;
      if (draft.run.activeRun.runDeck.length >= DRAFT_ROUNDS) return;
      const picked = choices.find((choice) => choice.id === cardId);
      if (!picked) return;
      const nextDeck = [...draft.run.activeRun.runDeck, cloneBattleCard(picked)];
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
      unexpectedContentSystem("handleStandardDraftComplete", systemType, deps);
      return;
    }

    if (!readHasActiveRun()) {
      logError("[content-system-navigation] handleStandardDraftComplete: no active run", "other");
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

    resolveNoviceCampaign("wildcard", () => deps.navigateTo(ROUTE_SCREENS.DIFFICULTY_SELECT));
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    const session = readRunSession();
    const hasActiveRun = readHasActiveRun();
    const activeCharacterId = hasActiveRun ? readActiveRun().characterId : null;
    if (
      hasActiveRun &&
      !isDifficultySelectContinuation({
        characterId: activeCharacterId,
        activityKind: session.activity.kind,
        hasActiveBattle: readHasActiveBattle(),
      })
    ) {
      resumeRun();
      return;
    }
    const pendingCharacterId = readRunSession().pendingCharacterId;
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
