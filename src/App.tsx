// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
// Everything visible flows through here, but domain rules stay in feature/lib controllers.
import { useEffect, useRef, useState } from "react";

import {
  allGameArt,
  cardLibrary,
  characterArt,
  characters,
  enemyBestiary,
  keywordDefinitions,
  trinketLibrary,
  type CharacterId,
  type CompanionId,
  type DifficultyId,
  type KeywordId,
} from "@/lib/game-data";
import { getTalentKeywordProgress } from "@/lib/talents";
import { preloadAllSounds } from "@/lib/audio";

import { useAppAudioEffects } from "@/app/use-app-audio-effects";
import { useAppDisplayEffects } from "@/app/use-app-display-effects";
import { useScreenAssetPreloadEffects } from "@/app/use-app-preload-effects";
import { useAlchemyAutosave } from "@/app/use-app-save-state";
import { useInitialLoadReady } from "@/app/use-initial-load-ready";
import { renderAlchemyScreen } from "@/app/render-alchemy-screen";
import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { UnsupportedSaveVersionScreen } from "@/app/unsupported-save-version-screen";
import { useMobileDetection, useVirtualResolution } from "@/features/alchemy/hooks";
import type { Screen } from "@/features/alchemy/types";
import { GameMenu } from "@/features/alchemy/ui/shared-ui";
import { useAlchemyRunController } from "@/features/alchemy/use-alchemy-run-controller";
import { useHomesteadStore, COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/features/alchemy/stores/homestead-store";
import { HomesteadProvider } from "@/features/alchemy/homestead-context";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { canAfford } from "@/lib/homestead/inventory";
import { PAGE_EXIT_MS } from "@/lib/game-constants";
import { ErrorBoundary } from "@/components/error-boundary";
import { BackgroundParticles } from "@/features/alchemy/ui/background-particles";
import {
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/features/alchemy/storage/metadata";
import { platform } from "@/lib/platform";
import { loadAlchemySaveState } from "@/features/alchemy/storage";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";

const SCREEN_PARTICLE_COLORS: Partial<Record<Screen, readonly string[]>> = {
  battle: ["rgba(255, 150, 70, X)", "rgba(255, 100, 40, X)"],
  campfire: ["rgba(255, 180, 60, X)", "rgba(240, 120, 40, X)"],
  corruption: ["rgba(255, 90, 70, X)", "rgba(230, 60, 50, X)"],
  "run-victory": ["rgba(245, 196, 93, X)", "rgba(255, 220, 120, X)"],
};
const SCREEN_PARTICLE_ALPHA: Partial<Record<Screen, number>> = {
  battle: 1.7,
  corruption: 2.0,
};

const BOSS_ALPHA_MULTIPLIER = 2.5;

export default function App() {
  // ============ Bootstrap: load save data once, initialize stores ============
  const [bootstrapResult] = useState(() => {
    const result = loadAlchemySaveState();
    useAppStore.getState().initialize(result.data);
    useHomesteadStore.getState().initialize({
      materialInventory: result.data.materialInventory,
      constructedBuildings: result.data.constructedBuildings,
      plantedFarms: result.data.plantedFarms,
      completedResearch: result.data.completedResearch,
      bondedCompanions: result.data.bondedCompanions,
    });
    return result;
  });
  const { data: initialSave, status: saveLoadStatus } = bootstrapResult;

  // ============ Store subscriptions ============
  const selectedResolution = useAppStore((s) => s.selectedResolution);
  const displayMode = useAppStore((s) => s.displayMode);
  const uiScale = useAppStore((s) => s.uiScale);
  const brightness = useAppStore((s) => s.brightness);
  const musicVol = useAppStore((s) => s.musicVol);
  const sfxVol = useAppStore((s) => s.sfxVol);
  const masterVol = useAppStore((s) => s.masterVol);
  const muteInBackground = useAppStore((s) => s.muteInBackground);
  const autoEndTurn = useAppStore((s) => s.autoEndTurn);
  const discoveredCardIds = useAppStore((s) => s.discoveredCardIds);
  const collectionTab = useAppStore((s) => s.collectionTab);
  const collectionPages = useAppStore((s) => s.collectionPages);
  const encounteredEnemyIds = useAppStore((s) => s.encounteredEnemyIds);
  const discoveredTrinketIds = useAppStore((s) => s.discoveredTrinketIds);
  const completedDifficulties = useAppStore((s) => s.completedDifficulties);
  const showClearSaveConfirm = useAppStore((s) => s.showClearSaveConfirm);
  const pendingCharacterId = useScreenStore((s) => s.pendingCharacterId);

  // Store-backed setters (wrapped for Dispatch<SetStateAction> compatibility)
  function setDiscoveredCardIds(v: string[] | ((prev: string[]) => string[])) {
    useAppStore.getState().setDiscoveredCardIds(typeof v === "function" ? v(useAppStore.getState().discoveredCardIds) : v);
  }
  function setEncounteredEnemyIds(v: string[] | ((prev: string[]) => string[])) {
    useAppStore.getState().setEncounteredEnemyIds(typeof v === "function" ? v(useAppStore.getState().encounteredEnemyIds) : v);
  }
  function setDiscoveredTrinketIds(v: string[] | ((prev: string[]) => string[])) {
    useAppStore.getState().setDiscoveredTrinketIds(typeof v === "function" ? v(useAppStore.getState().discoveredTrinketIds) : v);
  }
  const clearSavedAppState = useAppStore((s) => s.clearSavedAppState);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [renderedScreen, setRenderedScreen] = useState<Screen>("menu");
  const [pagePhase, setPagePhase] = useState<"enter" | "exit">("enter");
  const [tooltipBlocked, setTooltipBlocked] = useState(true);
  // tooltipBlocked starts true, so the first effect only needs to clear it
  const pendingScreenRef = useRef(renderedScreen);
  const vrStageRef = useRef<HTMLDivElement>(null);
  const initialLoadReady = useInitialLoadReady({ imageUrls: allGameArt });
  useAppDisplayEffects({ displayMode, uiScale, brightness, stageRef: vrStageRef });
  useEffect(() => {
    preloadAllSounds();
  }, []);

  const gameMenuOpenRef = useRef(gameMenuOpen);
  const renderedScreenRef = useRef(renderedScreen);
  // Refs let the global Escape listener read current screen/menu state without re-registering
  // a document-level handler on every route or menu toggle.
  useEffect(() => {
    gameMenuOpenRef.current = gameMenuOpen;
  }, [gameMenuOpen]);
  useEffect(() => {
    renderedScreenRef.current = renderedScreen;
  }, [renderedScreen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && renderedScreenRef.current !== "menu") {
        if (!gameMenuOpenRef.current) setMenuAnchorRect(null);
        setGameMenuOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { isMobileLandscape, isPortraitMobile } = useMobileDetection();
  const { frameStyle, stageStyle, aspectMode } = useVirtualResolution(selectedResolution, false, isMobileLandscape);
  const homesteadMaterialInventory = useHomesteadStore((s) => s.materialInventory);
  const homesteadConstructedBuildings = useHomesteadStore((s) => s.constructedBuildings);
  const homesteadPlantedFarms = useHomesteadStore((s) => s.plantedFarms);
  const homesteadCompletedResearch = useHomesteadStore((s) => s.completedResearch);
  const homesteadBondedCompanions = useHomesteadStore((s) => s.bondedCompanions);
  const homesteadEffects = useHomesteadStore((s) => s.effects);
  function handleMarkDifficultyCompleted(characterId: CharacterId, difficultyId: DifficultyId) {
    const prev = useAppStore.getState().completedDifficulties;
    const current = prev[characterId] ?? [];
    if (current.includes(difficultyId)) return;
    useAppStore.getState().setCompletedDifficulties({ ...prev, [characterId]: [...current, difficultyId] });
  }

  const run = useAlchemyRunController({
    discoveredCardIds,
    setDiscoveredCardIds,
    setEncounteredEnemyIds,
    setDiscoveredTrinketIds,
    initialTalentXP: initialSave.talentXP,
    initialUnlockedTalents: initialSave.unlockedTalents,
    initialActiveRun: initialSave.activeRun,
    autoEndTurn,
    onAddMaterials: (materials) => useHomesteadStore.getState().addMaterials(materials),
    homesteadEffects,
    onMarkDifficultyCompleted: handleMarkDifficultyCompleted,
    completedDifficulties,
  });
  const { screen: controllerScreen, commitPendingTransition } = run;
  useAppAudioEffects({ masterVol, musicVol, sfxVol, muteInBackground, screen: run.screen });
  const heroArt = characterArt[run.characterId] ?? characterArt.knight;
  const playerName = characters[run.characterId]?.name ?? "Knight";

  useEffect(() => {
    if (controllerScreen === renderedScreen) return;
    // renderedScreen intentionally lags the controller screen so exit animation can finish
    // before the next screen mounts and starts its enter animation.
    pendingScreenRef.current = controllerScreen;
    setPagePhase("exit"); // eslint-disable-line react-hooks/set-state-in-effect
    const timeout = window.setTimeout(() => {
      commitPendingTransition();
      setRenderedScreen(pendingScreenRef.current);
      setPagePhase("enter");
    }, PAGE_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [controllerScreen, renderedScreen, commitPendingTransition]);

  // On every renderedScreen change (including initial mount), block hover tooltips for 800ms
  // to prevent jarring popups during page-enter animation when the mouse is over a trigger.
  useEffect(() => {
    setTooltipBlocked(true); // eslint-disable-line react-hooks/set-state-in-effect
    const timer = window.setTimeout(() => setTooltipBlocked(false), 400);
    return () => window.clearTimeout(timer);
  }, [renderedScreen]);

  useScreenAssetPreloadEffects({
    heroArt,
    screen: run.screen,
    battleEnemyArt: run.battleState.currentEnemy.art,
    battleHand: run.battleState.hand,
    rewardChoices: run.rewardChoices,
    shopCards: run.shopCards,
    alchemistPotions: run.alchemistPotions,
    mysteryEvent: run.mysteryEvent,
  });

  useAlchemyAutosave({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    selectedResolution: useAppStore.getState().selectedResolution,
    displayMode: useAppStore.getState().displayMode,
    uiScale: useAppStore.getState().uiScale,
    discoveredCardIds: useAppStore.getState().discoveredCardIds,
    encounteredEnemyIds: useAppStore.getState().encounteredEnemyIds,
    discoveredTrinketIds: useAppStore.getState().discoveredTrinketIds,
    talentXP: run.talentXP,
    unlockedTalents: run.unlockedTalents,
    musicVolume: useAppStore.getState().musicVol,
    sfxVolume: useAppStore.getState().sfxVol,
    masterVolume: useAppStore.getState().masterVol,
    muteInBackground: useAppStore.getState().muteInBackground,
    autoEndTurn: useAppStore.getState().autoEndTurn,
    brightness: useAppStore.getState().brightness,
    activeRun: run.activeRunData,
    materialInventory: useHomesteadStore.getState().materialInventory,
    constructedBuildings: useHomesteadStore.getState().constructedBuildings,
    plantedFarms: useHomesteadStore.getState().plantedFarms,
    completedResearch: useHomesteadStore.getState().completedResearch,
    bondedCompanions: useHomesteadStore.getState().bondedCompanions,
    completedDifficulties: useAppStore.getState().completedDifficulties,
  });

  function clearSaveData() {
    clearSavedAppState();
    run.resetRunState();
    run.clearPermanentData();
    useHomesteadStore.getState().reset();
  }

  function unlockAllDevMode() {
    setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    setDiscoveredTrinketIds(trinketLibrary.map((trinket) => trinket.id));
    run.unlockAllTalents();
    useHomesteadStore.getState().setMaterials({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
  }

  const hasUnspentTalents = Object.keys(keywordDefinitions).some((kw) => {
    const kwId = kw as KeywordId;
    const xp = run.talentXP[kwId] ?? 0;
    return getTalentKeywordProgress(xp, (run.unlockedTalents[kwId] ?? []).length).hasUnspent;
  });

  const hasAffordableHomestead = (() => {
    const materialInventory = homesteadMaterialInventory;
    const constructedBuildings = homesteadConstructedBuildings;
    const plantedFarms = homesteadPlantedFarms;
    const completedResearch = homesteadCompletedResearch;
    const bondedCompanions = homesteadBondedCompanions;
    const affordableBuilding = buildings.some((b) => {
      const currentLevel = constructedBuildings[b.id] ?? 0;
      if (currentLevel >= b.tiers.length) return false;
      return canAfford(materialInventory, b.tiers[currentLevel].cost);
    });
    const affordableFarm = farmPlots.some((f) => {
      const currentLevel = plantedFarms[f.id] ?? 0;
      if (currentLevel >= f.tiers.length) return false;
      return canAfford(materialInventory, f.tiers[currentLevel].cost);
    });
    const affordableResearch = researchUpgrades.some((r) => {
      const currentLevel = completedResearch[r.id] ?? 0;
      if (currentLevel >= r.tiers.length) return false;
      return canAfford(materialInventory, r.tiers[currentLevel].cost);
    });
    const affordableBond = cardLibrary.some((c) => {
      const effect = c.effects.find(
        (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
      );
      if (!effect) return false;
      if (!discoveredCardIds.includes(c.id)) return false;
      const currentLevel = bondedCompanions[effect.companionId] ?? 0;
      if (currentLevel >= COMPANION_MAX_TIER) return false;
      return canAfford(materialInventory, COMPANION_BOND_TIERS[currentLevel]);
    });
    return affordableBuilding || affordableFarm || affordableResearch || affordableBond;
  })();

  function openBattleMenu(rect?: DOMRect) {
    setMenuAnchorRect(rect ?? null);
    setGameMenuOpen(true);
  }

  const particleColors = SCREEN_PARTICLE_COLORS[renderedScreen];
  const isBossBattle = renderedScreen === "battle" && run.battleState.currentEnemy.enemyType === "boss";
  const particleAlphaMultiplier = isBossBattle ? BOSS_ALPHA_MULTIPLIER : SCREEN_PARTICLE_ALPHA[renderedScreen];
  const content =
    saveLoadStatus.kind === "unsupported-newer-schema" ? (
      <UnsupportedSaveVersionScreen canQuit={platform.canQuit} onQuit={platform.quit} />
    ) : !initialLoadReady ? (
      <StartupLoadingScreen />
    ) : (
      <div
        key={renderedScreen}
        className={`${pagePhase === "exit" ? "page-exit" : "page-enter"} h-full w-full overflow-hidden`}
      >
        <HomesteadProvider
          cardDescriptionContext={{
            flatPhysicalDamage: homesteadEffects.flatPhysicalDamage,
            companionDamage: homesteadEffects.companionDamage,
            companionBondLevels: homesteadBondedCompanions,
            potionPotency: 1 + homesteadEffects.potionPotency,
          }}
        >
          {renderAlchemyScreen({
            screen: renderedScreen,
            actions: {
              goToScreen: run.goToScreen,
              navigateTo: run.goToScreen,
              beginCampaign: run.beginCampaign,
              beginLabyrinth: run.beginLabyrinth,
              beginWildwood: run.beginWildwood,
              handleCharacterSelect: run.handleCharacterSelect,
              handleDifficultySelect: run.handleDifficultySelect,
              handleBackFromDifficultySelect: run.handleBackFromDifficultySelect,
              handleWildwoodBossSelect: run.handleWildwoodBossSelect,
              handleCardClick: run.handleCardClick,
              handleWishChoice: run.handleWishChoice,
              handleEndTurn: run.handleEndTurn,
              handleEndRun: run.handleEndRun,
              skipCombatDevMode: run.skipCombatDevMode,
              removeCardGhost: run.removeCardGhost,
              finishRewards: run.finishRewards,
              handleDestinationChoice: run.handleDestinationChoice,
              handleCampfireContinue: run.handleCampfireContinue,
              handleShopContinue: run.handleShopContinue,
              handleShopBuyCard: run.handleShopBuyCard,
              handleShopRemoveCard: run.handleShopRemoveCard,
              handleShopRefresh: run.handleShopRefresh,
              handleAlchemistContinue: run.handleAlchemistContinue,
              handleAlchemistBuyCard: run.handleAlchemistBuyCard,
              handleAlchemistRefresh: run.handleAlchemistRefresh,
              handleAlchemistMixPotions: run.handleAlchemistMixPotions,
              handleMysteryChoice: run.handleMysteryChoice,
              handleMysteryChooseCard: run.handleMysteryChooseCard,
              handleMysteryRemoveCard: run.handleMysteryRemoveCard,
              handleMysteryContinue: run.handleMysteryContinue,
              handleCorruptCard: run.handleCorruptCard,
              handleCorruptionContinue: run.handleCorruptionContinue,
              handleCorruptionLeave: run.handleCorruptionLeave,
              handleActComplete: run.handleActComplete,
              handleLabyrinthNodeEnter: run.handleLabyrinthNodeEnter,
              handleLabyrinthEndRun: run.handleLabyrinthEndRun,
              resetRunState: run.resetRunState,
              returnToBattle: run.returnToBattle,
              unlockTalent: run.unlockTalent,
              resetUnlockedTalents: run.resetUnlockedTalents,
            },
            handCardRefs: run.handCardRefs,
            battleSceneRef: run.battleSceneRef,
            playerPanelRef: run.playerPanelRef,
            enemyPanelRef: run.enemyPanelRef,
            heroArt,
            playerName,
            isMobileLandscape,
            aspectMode,
            hasUnspentTalents,
            hasAffordableHomestead,
            collectionTab,
            collectionPages,
            encounteredEnemyIds,
            discoveredTrinketIds,
            showClearSaveConfirm,
            pendingCharacterId,
            onOpenBattleMenu: openBattleMenu,
            onClearSaveData: clearSaveData,
            onUnlockAllDevMode: unlockAllDevMode,
          })}
        </HomesteadProvider>
      </div>
    );

  return (
    <ErrorBoundary>
      {isPortraitMobile ? (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-center">
          <div>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Rotate Your Device</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Alchemy is designed for landscape orientation. Please rotate your device horizontally to play.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`flex h-screen w-screen items-center justify-center overflow-hidden bg-background ${isMobileLandscape ? "mobile-landscape p-0" : "p-4"}`}
        >
          <div className="relative" style={frameStyle}>
            <div
              ref={vrStageRef}
              className={`absolute left-0 top-0 overflow-hidden bg-background ${tooltipBlocked ? "tooltips-disabled" : ""}`}
              style={stageStyle}
            >
              <BackgroundParticles
                variant="embers"
                {...(particleColors ? { colors: particleColors } : {})}
                {...(particleAlphaMultiplier ? { alphaMultiplier: particleAlphaMultiplier } : {})}
              />
              {content}
            </div>
            <GameMenu
              isOpen={saveLoadStatus.kind === "unsupported-newer-schema" ? false : gameMenuOpen}
              anchorRect={menuAnchorRect}
              anchorPlacement={renderedScreen === "labyrinth-map" ? "down-right" : "up-left"}
              onClose={() => {
                setGameMenuOpen(false);
                setMenuAnchorRect(null);
              }}
              onMainMenu={() => run.goToScreen("menu")}
              onCollection={() => run.goToScreen("collection")}
              onTalents={() => run.goToScreen("talents")}
              onHomestead={() => run.goToScreen("homestead")}
              onOptions={() => run.goToScreen("options")}
              {...(renderedScreen === "battle" ? { onEndRun: run.handleEndRun } : {})}
              {...(renderedScreen === "labyrinth-map" ? { onEndRun: run.handleLabyrinthEndRun } : {})}
            />
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
