// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { characterArt, type CharacterId, type DifficultyId } from "@/lib/game-data";
import {
  AppBackgroundParticles,
  AppScreenChromeProvider,
  AppHamburgerTrigger,
  GameMenuOverlay,
  RenderAlchemyScreen,
  StartupLoadingScreen,
  UnsupportedSaveOverlay,
  applySaveDataToStores,
  bootstrapAlchemySaveState,
  useAlchemyAutosaveFromStores,
  useAppAudioEffects,
  useAppDisplayEffects,
  useAppKeyboardShortcuts,
  useGameMenuState,
  useGlobalErrorHandlers,
  useInitialLoadReady,
  useIsArmoryLocked,
  useRenderedScreenTransition,
  useReturnToRunNavigation,
  useScreenAssetPreloadEffects,
  useScreenParticleConfig,
} from "@/app/app-shell";
import { useDevShortcuts } from "@/app/use-dev-shortcuts";
import { useVirtualResolution } from "@/features/alchemy/shared/hooks";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { useHomesteadAdapter } from "@/features/alchemy/shared/stores/run-session-facade";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { ErrorBoundary } from "@/components/error-boundary";
import type { SaveLoadState } from "@/features/alchemy/shared/storage";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useAppSettings } from "@/features/alchemy/shared/stores/store-actions";
import {
  useActiveRunCharacterId,
  useActiveRunScreenValue,
  useBondedCompanions,
  useContentSystemType,
  useRunScreenData,
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-session-facade";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";

const profileStore = useProfileStore;

function AppMainContent({
  saveBlockedByNewerVersion,
  initialLoadReady,
  vrStageRef,
  stagePixelRatio,
  stageStyle,
  aspectMode,
  run,
}: {
  saveBlockedByNewerVersion: boolean;
  initialLoadReady: boolean;
  vrStageRef: React.RefObject<HTMLDivElement | null>;
  stagePixelRatio: number;
  stageStyle: React.CSSProperties;
  aspectMode: "standard" | "narrow" | "ultrawide";
  run: AlchemyRunCommands;
}) {
  const finishedRunCharacters = useProfileStore((s) => s.finishedRunCharacters);
  const isArmoryLocked = useIsArmoryLocked();
  const { screen: controllerScreen, commitPendingTransition } = run;
  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(
    controllerScreen,
    commitPendingTransition,
  );
  const { phase: runPhase } = useRunSessionNavigationSlice(controllerScreen);
  const { battle } = useRunSessionBattleContext(controllerScreen);
  const characterId = useActiveRunCharacterId();

  const gameMenu = useGameMenuState();
  useAppKeyboardShortcuts({
    renderedScreen,
    gameMenuOpen: gameMenu.gameMenuOpen,
    setMenuAnchorRect: gameMenu.setMenuAnchorRect,
    setGameMenuOpen: gameMenu.setGameMenuOpen,
  });
  const nav = useReturnToRunNavigation({ run, renderedScreen });

  const heroArt = characterArt[characterId];
  const contentSystemType = useContentSystemType();
  const rewardsData = useRunScreenData("rewards");

  useScreenAssetPreloadEffects({
    heroArt,
    screen: run.screen,
  });

  const isAutosaveAllowed = (): boolean => {
    if (runPhase === "runEnd") return false;
    if (runPhase === "battle" && battle.battleState.enemyHealth <= 0) return false;
    if (run.screen === "rewards" && contentSystemType !== "wildwood" && rewardsData.rewardState.choices.length === 0)
      return false;
    return true;
  };
  const autosaveEnabled = isAutosaveAllowed();

  useAlchemyAutosaveFromStores(autosaveEnabled, nav.returnToRunScreen);

  const dev = useDevShortcuts(run);

  const homesteadEffects = useHomesteadAdapter();
  const homesteadBondedCompanions = useBondedCompanions();

  const isBossBattle = renderedScreen === "battle" && battle.battleState.currentEnemy.enemyType === "boss";
  const { particleColors, particleAlphaMultiplier } = useScreenParticleConfig(renderedScreen, isBossBattle);

  const pagePhaseClass = pagePhase === "exit" ? "page-exit" : "page-enter";
  const content = saveBlockedByNewerVersion ? (
    <UnsupportedSaveOverlay />
  ) : !initialLoadReady ? (
    <StartupLoadingScreen />
  ) : (
    <div key={renderedScreen} className={cn(pagePhaseClass, "h-full w-full overflow-hidden")}>
      <CardDescriptionProvider
        cardDescriptionContext={{
          flatPhysicalDamage: homesteadEffects.flatPhysicalDamage,
          companionDamage: homesteadEffects.companionDamage,
          companionBondLevels: homesteadBondedCompanions,
          potionPotency: 1 + homesteadEffects.potionPotency,
        }}
      >
        <AppScreenChromeProvider
          aspectMode={aspectMode}
          stagePixelRatio={stagePixelRatio}
          returnToRunScreen={nav.returnToRunScreen}
        >
          <RenderAlchemyScreen
            screen={renderedScreen}
            routeCommands={run.routeCommands}
            battleBindings={run.battleBindings}
            onOpenBattleMenu={gameMenu.openBattleMenu}
            onClearSaveData={dev.clearSaveData}
            onUnlockAllDevMode={dev.unlockAllDevMode}
            onBackFromOptions={nav.backFromOptions}
          />
        </AppScreenChromeProvider>
      </CardDescriptionProvider>
    </div>
  );

  return (
    <>
      <div
        ref={vrStageRef}
        data-testid="vr-stage"
        data-run-phase={runPhase}
        data-stage-pixel-ratio={stagePixelRatio}
        className={cn(
          "[container-type:size] absolute top-0 left-0 overflow-hidden bg-background",
          tooltipBlocked && "tooltips-disabled",
        )}
        style={stageStyle}
      >
        <AppBackgroundParticles
          renderedScreen={renderedScreen}
          particleColors={particleColors}
          particleAlphaMultiplier={particleAlphaMultiplier}
        />
        {content}
        <AppHamburgerTrigger renderedScreen={renderedScreen} onOpenMenu={gameMenu.openBattleMenu} />
      </div>
      <GameMenuOverlay
        saveBlockedByNewerVersion={saveBlockedByNewerVersion}
        gameMenuOpen={gameMenu.gameMenuOpen}
        anchorRect={gameMenu.menuAnchorRect}
        currentScreen={renderedScreen}
        onClose={gameMenu.closeGameMenu}
        nav={nav}
        finishedRunCharacters={finishedRunCharacters}
        isArmoryLocked={isArmoryLocked}
        onEndRun={run.handleEndRun}
      />
    </>
  );
}

function AppInner({ bootstrapResult }: { bootstrapResult: SaveLoadState }) {
  const { data: initialSave, status: saveLoadStatus } = bootstrapResult;

  const settings = useAppSettings();
  const vrStageRef = useRef<HTMLDivElement>(null);
  const initialLoadReady = useInitialLoadReady();
  useAppDisplayEffects({
    displayMode: settings.displayMode,
    uiScale: settings.uiScale,
    brightness: settings.brightness,
    stageRef: vrStageRef,
  });
  useGlobalErrorHandlers();

  function handleMarkDifficultyCompleted(characterId: CharacterId, difficultyId: DifficultyId) {
    const prev = profileStore.getState().completedDifficulties;
    const current = prev[characterId];
    if (current.includes(difficultyId)) return;
    profileStore.getState().setCompletedDifficulties({ ...prev, [characterId]: [...current, difficultyId] });
  }

  const { frameStyle, stageStyle, aspectMode, stagePixelRatio } = useVirtualResolution(
    settings.selectedAspectRatio,
    false,
  );
  const screen = useActiveRunScreenValue();
  useAppAudioEffects({
    masterVol: settings.masterVol,
    musicVol: settings.musicVol,
    sfxVol: settings.sfxVol,
    muteInBackground: settings.muteInBackground,
    screen,
  });

  const run = useAlchemyRunController({
    initialActiveRun: initialSave.activeRun,
    initialTalentXP: initialSave.talentXP,
    initialUnlockedTalents: initialSave.unlockedTalents,
    autoEndTurn: settings.autoEndTurn,
    onMarkDifficultyCompleted: handleMarkDifficultyCompleted,
  });

  const saveBlockedByNewerVersion =
    saveLoadStatus.kind === "unsupported-newer-schema" || saveLoadStatus.kind === "unsupported-newer-content";

  return (
    <ErrorBoundary label={screen}>
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="relative" style={frameStyle}>
          <AppMainContent
            saveBlockedByNewerVersion={saveBlockedByNewerVersion}
            initialLoadReady={initialLoadReady && !saveBlockedByNewerVersion}
            vrStageRef={vrStageRef}
            stagePixelRatio={stagePixelRatio}
            stageStyle={stageStyle}
            aspectMode={aspectMode}
            run={run}
          />
          <div id="tooltip-root" className="pointer-events-none absolute inset-0 z-30" />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  const [bootstrapResult, setBootstrapResult] = useState<SaveLoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void bootstrapAlchemySaveState().then((result) => {
      if (!cancelled) {
        applySaveDataToStores(result.data);
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
