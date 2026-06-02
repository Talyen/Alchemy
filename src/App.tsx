// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
import { useEffect, useRef, useState } from "react";
import { cn, wrapStoreSetter } from "@/lib/utils";

import {
  allGameArt,
  cardLibrary,
  characterArt,
  characters,
  enemyBestiary,
  trinketLibrary,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";
import { hasUnspentTalents } from "@/app/talent-affordability";
import { hasAffordableHomesteadUpgrade } from "@/app/homestead-affordability";
import { buildControllerActions } from "@/app/build-controller-actions";
import { BOSS_PARTICLE_ALPHA_MULTIPLIER, SCREEN_PARTICLE_ALPHA, SCREEN_PARTICLE_COLORS } from "@/app/screen-particles";
import { useAppAudioEffects } from "@/app/use-app-audio-effects";
import { useAppDisplayEffects } from "@/app/use-app-display-effects";
import { useScreenAssetPreloadEffects } from "@/app/use-app-preload-effects";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { useGlobalErrorHandlers } from "@/app/use-global-error-handlers";
import { useInitialLoadReady } from "@/app/use-initial-load-ready";
import { useRenderedScreenTransition } from "@/app/use-rendered-screen-transition";
import { RenderAlchemyScreen } from "@/app/render-alchemy-screen";
import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { UnsupportedSaveVersionScreen } from "@/app/unsupported-save-version-screen";
import { useVirtualResolution } from "@/features/alchemy/hooks";
import { GameMenu } from "@/features/alchemy/ui/shared-ui";
import { useAlchemyRunController } from "@/features/alchemy/use-alchemy-run-controller";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { HomesteadProvider } from "@/features/alchemy/homestead-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { BackgroundParticles } from "@/features/alchemy/ui/background-particles";
import { platform } from "@/lib/platform";
import { loadAlchemySaveState, type SaveLoadState } from "@/features/alchemy/storage";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { clearAllPersistentGameData } from "@/features/alchemy/stores/reset";
import { isAlchemyDevBuild } from "@/features/alchemy/utils";

const appStore = useAppStore;
const homesteadStore = useHomesteadStore;

function AppInner({ bootstrapResult }: { bootstrapResult: SaveLoadState }) {
  const { data: initialSave, status: saveLoadStatus } = bootstrapResult;

  const selectedAspectRatio = useAppStore((s) => s.selectedAspectRatio);
  const displayMode = useAppStore((s) => s.displayMode);
  const uiScale = useAppStore((s) => s.uiScale);
  const brightness = useAppStore((s) => s.brightness);
  const musicVol = useAppStore((s) => s.musicVol);
  const sfxVol = useAppStore((s) => s.sfxVol);
  const masterVol = useAppStore((s) => s.masterVol);
  const muteInBackground = useAppStore((s) => s.muteInBackground);
  const autoEndTurn = useAppStore((s) => s.autoEndTurn);
  const discoveredCardIds = useAppStore((s) => s.discoveredCardIds);
  const pendingCharacterId = useRunSessionStore((s) => s.pendingCharacterId);

  const setDiscoveredCardIds = wrapStoreSetter(
    () => appStore.getState().discoveredCardIds,
    appStore.getState().setDiscoveredCardIds,
  );
  const setEncounteredEnemyIds = wrapStoreSetter(
    () => appStore.getState().encounteredEnemyIds,
    appStore.getState().setEncounteredEnemyIds,
  );
  const setDiscoveredTrinketIds = wrapStoreSetter(
    () => appStore.getState().discoveredTrinketIds,
    appStore.getState().setDiscoveredTrinketIds,
  );
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const vrStageRef = useRef<HTMLDivElement>(null);
  const initialLoadReady = useInitialLoadReady({ imageUrls: allGameArt });
  useAppDisplayEffects({ displayMode, uiScale, brightness, stageRef: vrStageRef });
  useGlobalErrorHandlers();
  const gameMenuOpenRef = useRef(gameMenuOpen);
  const renderedScreenRef = useRef<ReturnType<typeof useRenderedScreenTransition>["renderedScreen"]>("menu");

  const homesteadMaterialInventory = useHomesteadStore((s) => s.materialInventory);
  const homesteadConstructedBuildings = useHomesteadStore((s) => s.constructedBuildings);
  const homesteadPlantedFarms = useHomesteadStore((s) => s.plantedFarms);
  const homesteadCompletedResearch = useHomesteadStore((s) => s.completedResearch);
  const homesteadBondedCompanions = useHomesteadStore((s) => s.bondedCompanions);
  const homesteadEffects = useHomesteadStore((s) => s.effects);

  function handleMarkDifficultyCompleted(characterId: CharacterId, difficultyId: DifficultyId) {
    const prev = appStore.getState().completedDifficulties;
    const current = prev[characterId] ?? [];
    if (current.includes(difficultyId)) return;
    appStore.getState().setCompletedDifficulties({ ...prev, [characterId]: [...current, difficultyId] });
  }

  const run = useAlchemyRunController({
    discoveredCardIds,
    setDiscoveredCardIds,
    setEncounteredEnemyIds,
    initialTalentXP: initialSave.talentXP,
    initialUnlockedTalents: initialSave.unlockedTalents,
    initialActiveRun: initialSave.activeRun,
    autoEndTurn,
    homesteadEffects,
    onMarkDifficultyCompleted: handleMarkDifficultyCompleted,
  });
  const { screen: controllerScreen, commitPendingTransition } = run;
  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(
    controllerScreen,
    commitPendingTransition,
  );

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

  useEffect(() => {
    platform.steam.init();
  }, []);

  const { frameStyle, stageStyle, aspectMode, stagePixelRatio } = useVirtualResolution(selectedAspectRatio, false);
  useAppAudioEffects({ masterVol, musicVol, sfxVol, muteInBackground, screen: run.screen });
  const heroArt = characterArt[run.characterId] ?? characterArt.knight;
  const playerName = characters[run.characterId]?.name ?? "Knight";

  useScreenAssetPreloadEffects({
    heroArt,
    screen: run.screen,
    battleEnemyArt: run.battleState.currentEnemy.art,
    battleHand: run.battleState.hand,
    rewardChoices: run.rewardState.choices,
    shopCards: run.shopCards,
    alchemistPotions: run.alchemistPotions,
    mysteryEvent: run.mysteryEvent,
  });

  const autosaveEnabled =
    run.screen !== "rewards" &&
    run.rewardState.choices.length === 0 &&
    !(run.screen === "battle" && run.battleState.enemyHealth <= 0);
  useAlchemyAutosaveFromStores(
    {
      talentXP: run.talentXP,
      unlockedTalents: run.unlockedTalents,
      activeRun: run.activeRunData,
    },
    autosaveEnabled,
  );

  function clearSaveData() {
    clearAllPersistentGameData();
    run.resetRunState();
  }

  function unlockAllDevMode() {
    if (!isAlchemyDevBuild()) return;
    setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    setDiscoveredTrinketIds(trinketLibrary.map((trinket) => trinket.id));
    run.unlockAllTalents();
    homesteadStore.getState().setMaterials({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
  }

  const hasUnspentTalentsBadge = hasUnspentTalents(run.talentXP, run.unlockedTalents);
  const hasAffordableHomestead = hasAffordableHomesteadUpgrade({
    materialInventory: homesteadMaterialInventory,
    constructedBuildings: homesteadConstructedBuildings,
    plantedFarms: homesteadPlantedFarms,
    completedResearch: homesteadCompletedResearch,
    bondedCompanions: homesteadBondedCompanions,
    discoveredCardIds,
  });

  function openBattleMenu(rect?: DOMRect) {
    setMenuAnchorRect(rect ?? null);
    setGameMenuOpen(true);
  }

  const particleColors = SCREEN_PARTICLE_COLORS[renderedScreen];
  const isBossBattle = renderedScreen === "battle" && run.battleState.currentEnemy.enemyType === "boss";
  const particleAlphaMultiplier = isBossBattle ? BOSS_PARTICLE_ALPHA_MULTIPLIER : SCREEN_PARTICLE_ALPHA[renderedScreen];
  const saveBlockedByNewerVersion =
    saveLoadStatus.kind === "unsupported-newer-schema" || saveLoadStatus.kind === "unsupported-newer-content";
  const content = saveBlockedByNewerVersion ? (
    <UnsupportedSaveVersionScreen canQuit={platform.canQuit} onQuit={platform.quit} />
  ) : !initialLoadReady ? (
    <StartupLoadingScreen />
  ) : (
    <div
      key={renderedScreen}
      className={cn(pagePhase === "exit" ? "page-exit" : "page-enter", "h-full w-full overflow-hidden")}
    >
      <HomesteadProvider
        cardDescriptionContext={{
          flatPhysicalDamage: homesteadEffects.flatPhysicalDamage,
          companionDamage: homesteadEffects.companionDamage,
          companionBondLevels: homesteadBondedCompanions,
          potionPotency: 1 + homesteadEffects.potionPotency,
        }}
      >
        <RenderAlchemyScreen
          screen={renderedScreen}
          actions={buildControllerActions(run)}
          handCardRefs={run.handCardRefs}
          drawPileRef={run.drawPileRef}
          discardPileRef={run.discardPileRef}
          battleSceneRef={run.battleSceneRef}
          playerPanelRef={run.playerPanelRef}
          enemyPanelRef={run.enemyPanelRef}
          heroArt={heroArt}
          playerName={playerName}
          aspectMode={aspectMode}
          stagePixelRatio={stagePixelRatio}
          cardTransfers={run.cardTransfers}
          hiddenHandCardKeys={run.hiddenHandCardKeys}
          cardTransferInProgress={run.cardTransferInProgress}
          playableHandCardKeys={run.playableHandCardKeys}
          battleScreenData={run.battleScreenData}
          hasUnspentTalents={hasUnspentTalentsBadge}
          hasAffordableHomestead={hasAffordableHomestead}
          pendingCharacterId={pendingCharacterId}
          onOpenBattleMenu={openBattleMenu}
          onClearSaveData={clearSaveData}
          onUnlockAllDevMode={unlockAllDevMode}
        />
      </HomesteadProvider>
    </div>
  );

  return (
    <ErrorBoundary label={renderedScreen}>
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="relative" style={frameStyle}>
          <div
            ref={vrStageRef}
            data-testid="vr-stage"
            data-stage-pixel-ratio={stagePixelRatio}
            className={cn(
              "absolute left-0 top-0 overflow-hidden bg-background [container-type:size]",
              tooltipBlocked && "tooltips-disabled",
            )}
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
            isOpen={saveBlockedByNewerVersion ? false : gameMenuOpen}
            anchorRect={menuAnchorRect}
            anchorPlacement="down-right"
            currentScreen={renderedScreen}
            onClose={() => {
              setGameMenuOpen(false);
              setMenuAnchorRect(null);
            }}
            onMainMenu={() => run.goToScreen("menu")}
            onCollection={() => run.goToScreen("collection")}
            onTalents={() => run.goToScreen("talents")}
            onHomestead={() => run.goToScreen("homestead")}
            onOptions={() => run.goToScreen("options")}
            {...(run.hasActiveBattle ? { onReturnToBattle: run.returnToBattle } : {})}
            {...(renderedScreen === "battle" ? { onEndRun: run.handleEndRun } : {})}
            {...(renderedScreen === "labyrinth-map" ? { onEndRun: run.handleLabyrinthEndRun } : {})}
          />
          <div id="tooltip-root" className="absolute inset-0 pointer-events-none z-30" />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  const [bootstrapResult, setBootstrapResult] = useState<SaveLoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAlchemySaveState().then((result) => {
      if (!cancelled) {
        useAppStore.getState().initialize(result.data);
        useHomesteadStore.getState().initialize({
          materialInventory: result.data.materialInventory,
          constructedBuildings: result.data.constructedBuildings,
          plantedFarms: result.data.plantedFarms,
          completedResearch: result.data.completedResearch,
          bondedCompanions: result.data.bondedCompanions,
        });
        setBootstrapResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bootstrapResult) {
    return <StartupLoadingScreen />;
  }

  return <AppInner bootstrapResult={bootstrapResult} />;
}
