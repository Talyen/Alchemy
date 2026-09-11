import { logError } from "@/lib/error-logger";
import { DEFAULT_BATTLE_ENEMY_TYPE, DRAFT_ROUNDS } from "@/lib/game-constants";
import { playGoldGain } from "@/lib/audio";
import {
  setPendingCharacterId,
  setPendingContentSystemType,
  setStarterDraftChoices,
  createDraftRunRandomSource,
  setRunDeck,
  setDestinationOfferState,
  setRewardState,
  setLabyrinthMap,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { discoverCardIds, readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import {
  readActiveRun,
  readHasActiveRun,
  readHasActiveBattle,
  readParkedRuns,
  readRunRecency,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { hydrateModeRunInDraft, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { mostRecentResumableMode } from "@/features/alchemy/shared/stores/parked-runs";
import { parkAndDeactivateForegroundRunInDraft } from "@/features/alchemy/shared/stores/run-park-restore";
import {
  createInitialDestinationResult,
  restoreOrCreateDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { applyRunStartToDraft, createDraftRunStartSnapshot } from "./run-start-command";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { afterCampaignCharacterResolved } from "@/features/alchemy/shared/run-flow/campaign-start";
import { createStarterDraftChoices } from "@/features/alchemy/shared/run-flow/starter-draft";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import {
  getDifficultyModifiers,
  isDifficultyUnlocked,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";

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

function restoreResumedCampaignDestinations(
  draft: GameplayDraft,
  getAvailableDestinations: ContentSystemNavigationDeps["getAvailableDestinations"],
): void {
  const active = draft.run.activeRun;
  const reward = draft.session.rewardFlow.state;
  if (
    reward.destinations.length > 0 &&
    (!reward.destinations.includes(DESTINATIONS.BOSS_COMBAT) || reward.selectedBossId)
  )
    return;
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

function cloneDraftCard(card: BattleCard): BattleCard {
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

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
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

  function resumeRun(requestedMode?: ContentSystemId) {
    const hasLive = readHasActiveRun();
    const liveMode = hasLive ? readActiveRun().contentSystemType : null;
    const parked = readParkedRuns();
    const mode = requestedMode ?? mostRecentResumableMode(readRunRecency(), liveMode, parked, hasLive);
    if (!mode || (liveMode !== mode && !parked[mode])) return;
    dispatchRunSessionCommand((draft) => {
      if (liveMode !== mode) hydrateModeRunInDraft(draft, mode);
      setPendingContentSystemType(draft, mode);
      setPendingCharacterId(draft, null);
    });
    const screen = snapshotRun().currentScreen;
    if (!screen) return;
    deps.clearCardHover();
    if (screen === ROUTE_SCREENS.DESTINATION && mode === CONTENT_SYSTEMS.CAMPAIGN) {
      deps.navigateTo(screen, () => {
        dispatchRunSessionCommand((draft) => {
          restoreResumedCampaignDestinations(draft, deps.getAvailableDestinations);
        });
      });
    } else if (screen === ROUTE_SCREENS.BATTLE && mode === CONTENT_SYSTEMS.WILDWOOD && !readHasActiveBattle()) {
      deps.onResumeWildwood();
    } else {
      deps.navigateTo(screen);
    }
  }

  function beginContentSystem(systemId: ContentSystemId) {
    const hasActiveRun = readHasActiveRun();
    const runType = hasActiveRun ? readActiveRun().contentSystemType : null;
    if (hasActiveRun && runType === systemId) {
      resumeRun(systemId);
      return;
    }
    const parked = readParkedRuns()[systemId];
    if (parked) {
      resumeRun(systemId);
      return;
    }
    dispatchRunSessionCommand((draft) => {
      if (draft.session.activity.kind !== "inactive" && draft.run.activeRun.contentSystemType !== systemId) {
        parkAndDeactivateForegroundRunInDraft(draft);
      }
      setPendingCharacterId(draft, null);
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
