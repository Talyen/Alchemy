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
import { gearDefinitions } from "@/lib/gear";
import { useDevShortcuts } from "@/app/use-dev-shortcuts";
import { useVirtualResolution } from "@/features/alchemy/shared/hooks";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { useHomesteadAdapter } from "@/features/alchemy/shared/stores/run-session-facade";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { ErrorBoundary } from "@/components/error-boundary";
import type { SaveLoadState } from "@/features/alchemy/shared/storage";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useAppSettings } from "@/features/alchemy/shared/stores/store-actions";
import { useActiveRunScreenValue, useBondedCompanions } from "@/features/alchemy/shared/stores/run-session-facade";

const appStore = useAppStore;

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
  run: ReturnType<typeof useAlchemyRunController>;
}) {
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
  const isArmoryLocked = useIsArmoryLocked();
  const { screen: controllerScreen, commitPendingTransition } = run;
  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(
    controllerScreen,
    commitPendingTransition,
  );

  const gameMenu = useGameMenuState();
  useAppKeyboardShortcuts({
    renderedScreen,
    gameMenuOpen: gameMenu.gameMenuOpen,
    setMenuAnchorRect: gameMenu.setMenuAnchorRect,
    setGameMenuOpen: gameMenu.setGameMenuOpen,
  });
  const nav = useReturnToRunNavigation({ run, renderedScreen });

  const heroArt = characterArt[run.characterId];

  useScreenAssetPreloadEffects({
    heroArt,
    screen: run.screen,
    battleEnemyArt: run.battleState.currentEnemy.art,
    battleHand: run.battleState.hand,
    rewardChoices:
      run.rewardState.rewardType === "gear"
        ? run.rewardState.choices.map((choice) => ({
            art: gearDefinitions[choice.definitionId]?.art ?? "",
          }))
        : run.rewardState.choices.map((choice) => ({ art: choice.art })),
    shopCards: run.shopCards,
    alchemistPotions: run.alchemistPotions,
    mysteryEvent: run.mysteryEvent,
  });

  const isAutosaveAllowed = (): boolean => {
    if (run.runPhase === "runEnd") return false;
    if (run.runPhase === "battle" && run.battleState.enemyHealth <= 0) return false;
    if (run.screen === "rewards" && run.contentSystemType !== "wildwood" && run.rewardState.choices.length === 0)
      return false;
    return true;
  };
  const autosaveEnabled = isAutosaveAllowed();

  useAlchemyAutosaveFromStores(autosaveEnabled, nav.returnToRunScreen);

  const dev = useDevShortcuts(run);

  const homesteadEffects = useHomesteadAdapter();
  const homesteadBondedCompanions = useBondedCompanions();

  const isBossBattle = renderedScreen === "battle" && run.battleState.currentEnemy.enemyType === "boss";
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
          run={run}
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
        data-run-phase={run.runPhase}
        data-stage-pixel-ratio={stagePixelRatio}
        className={cn(
          "absolute left-0 top-0 overflow-hidden bg-background [container-type:size]",
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
    const prev = appStore.getState().completedDifficulties;
    const current = prev[characterId];
    if (current.includes(difficultyId)) return;
    appStore.getState().setCompletedDifficulties({ ...prev, [characterId]: [...current, difficultyId] });
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
