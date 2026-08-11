// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import {
  AppBackgroundParticles,
  AppScreenChromeProvider,
  AppHamburgerTrigger,
  GameMenuOverlay,
  RenderAlchemyScreen,
  StartupLoadingScreen,
  UnsupportedSaveOverlay,
  useAlchemyAutosaveFromStores,
  useAppAudioEffects,
  useAppDisplayEffects,
  useAppKeyboardShortcuts,
  useDevShortcuts,
  useGameMenuState,
  useGlobalErrorHandlers,
  useInitialLoadReady,
  useIsArmoryLocked,
  useRenderedScreenTransition,
  useReturnToRunNavigation,
  getScreenParticleConfig,
} from "@/app/app-shell";
import { useVirtualResolution } from "@/features/alchemy/shared/hooks";
import { setTooltipRoot } from "@/features/alchemy/shared/ui/tooltip-root";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { clearAlchemySaveData, type SaveLoadState } from "@/features/alchemy/shared/storage";
import { readProfileStore, setCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { useAppSettings } from "@/features/alchemy/shared/stores/store-actions";
import {
  useActiveRunScreenValue,
  useBondedCompanions,
  useHomesteadEffects,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useRewardsScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import {
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-session-model";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

async function wipeUnsupportedSaveAndReload() {
  const cleared = await clearAlchemySaveData();
  if (!cleared) {
    throw new Error("Save data could not be cleared");
  }
  window.location.reload();
}

function AppMainContent({
  saveBlockedByNewerVersion,
  vrStageRef,
  stagePixelRatio,
  stageStyle,
  aspectMode,
  brightness,
  run,
  renderedScreen,
  pagePhase,
  tooltipBlocked,
}: {
  saveBlockedByNewerVersion: boolean;
  vrStageRef: React.RefObject<HTMLDivElement | null>;
  stagePixelRatio: number;
  stageStyle: React.CSSProperties;
  aspectMode: "standard" | "narrow" | "ultrawide";
  brightness: number;
  run: AlchemyRunCommands;
  renderedScreen: Screen;
  pagePhase: "enter" | "exit";
  tooltipBlocked: boolean;
}) {
  const finishedRunCharacters = useFinishedRunCharacters();
  const isArmoryLocked = useIsArmoryLocked();
  const { screen: controllerScreen } = run;
  const { phase: runPhase } = useRunSessionNavigationSlice(controllerScreen);
  const { battle } = useRunSessionBattleContext(controllerScreen);
  const gameMenu = useGameMenuState();
  useAppKeyboardShortcuts({
    renderedScreen,
    gameMenuOpen: gameMenu.gameMenuOpen,
    setMenuAnchorRect: gameMenu.setMenuAnchorRect,
    setGameMenuOpen: gameMenu.setGameMenuOpen,
  });
  const nav = useReturnToRunNavigation({ run, renderedScreen });

  const rewardsData = useRewardsScreenData();

  const isAutosaveAllowed = (): boolean => {
    if (runPhase === "runEnd") return false;
    if (runPhase === "battle" && battle.battleState.enemyHealth <= 0) return false;
    // Mid-claim keeps choices populated; encodeRunResumeSnapshot handles that surface.
    // Block only a true hollow Victory (no claim lock, nothing to pick).
    if (run.screen === "rewards" && !rewardsData.rewardClaimInFlight && rewardsData.rewardState.choices.length === 0) {
      return false;
    }
    return true;
  };
  const autosaveEnabled = isAutosaveAllowed();

  useAlchemyAutosaveFromStores(autosaveEnabled, nav.returnToRunScreen);

  const dev = useDevShortcuts(run);

  const homesteadEffects = useHomesteadEffects();
  const homesteadBondedCompanions = useBondedCompanions();
  const cardDescriptionContext = useMemo(
    () => ({
      flatPhysicalDamage: homesteadEffects.flatPhysicalDamage,
      companionDamage: homesteadEffects.companionDamage,
      companionBondLevels: homesteadBondedCompanions,
      potionPotency: 1 + homesteadEffects.potionPotency,
    }),
    [homesteadBondedCompanions, homesteadEffects],
  );

  const isBossBattle = renderedScreen === "battle" && battle.battleState.currentEnemy.enemyType === "boss";
  const { particleColors, particleAlphaMultiplier } = getScreenParticleConfig(renderedScreen, isBossBattle);

  const [deletingUnsupportedSave, setDeletingUnsupportedSave] = useState(false);
  const handleDeleteUnsupportedSave = useCallback(() => {
    if (deletingUnsupportedSave) return;
    setDeletingUnsupportedSave(true);
    void wipeUnsupportedSaveAndReload().catch(() => {
      setDeletingUnsupportedSave(false);
    });
  }, [deletingUnsupportedSave]);

  const pagePhaseClass = pagePhase === "exit" ? "page-exit" : "page-enter";
  const content = saveBlockedByNewerVersion ? (
    <UnsupportedSaveOverlay onDeleteSaveAndContinue={handleDeleteUnsupportedSave} deleting={deletingUnsupportedSave} />
  ) : (
    <div key={renderedScreen} className={cn(pagePhaseClass, "h-full w-full overflow-hidden")}>
      <CardDescriptionProvider cardDescriptionContext={cardDescriptionContext}>
        <AppScreenChromeProvider
          aspectMode={aspectMode}
          stagePixelRatio={stagePixelRatio}
          returnToRunScreen={nav.returnToRunScreen}
        >
          <RenderAlchemyScreen
            screen={renderedScreen}
            routeCommands={run.routeCommands}
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[90] bg-black"
          style={{ opacity: Math.max(0, 1 - brightness / 100) }}
        />
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
  const { status: saveLoadStatus } = bootstrapResult;

  const settings = useAppSettings();
  const vrStageRef = useRef<HTMLDivElement>(null);
  const { frameStyle, stageStyle, aspectMode, stagePixelRatio } = useVirtualResolution(
    settings.selectedAspectRatio,
    false,
  );
  useAppDisplayEffects({
    displayMode: settings.displayMode,
    brightness: settings.brightness,
    stageRef: vrStageRef,
  });
  useGlobalErrorHandlers();

  function handleMarkDifficultyCompleted(characterId: CharacterId, difficultyId: DifficultyId) {
    const prev = readProfileStore().completedDifficulties;
    const current = prev[characterId];
    if (current.includes(difficultyId)) return;
    dispatchRunSessionCommand((draft) =>
      setCompletedDifficulties(draft, { ...prev, [characterId]: [...current, difficultyId] }),
    );
  }

  const screen = useActiveRunScreenValue();
  useAppAudioEffects({
    masterVol: settings.masterVol,
    musicVol: settings.musicVol,
    sfxVol: settings.sfxVol,
    muteInBackground: settings.muteInBackground,
    screen,
  });

  const run = useAlchemyRunController({
    autoEndTurn: settings.autoEndTurn,
    onMarkDifficultyCompleted: handleMarkDifficultyCompleted,
  });

  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(
    run.screen,
    run.commitPendingTransition,
  );

  const saveBlockedByNewerVersion =
    saveLoadStatus.kind === "unsupported-newer-schema" || saveLoadStatus.kind === "unsupported-newer-content";

  return (
    <ErrorBoundary label={screen}>
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
        <div className="relative" style={frameStyle}>
          <AppMainContent
            saveBlockedByNewerVersion={saveBlockedByNewerVersion}
            vrStageRef={vrStageRef}
            stagePixelRatio={stagePixelRatio}
            stageStyle={stageStyle}
            aspectMode={aspectMode}
            brightness={settings.brightness}
            run={run}
            renderedScreen={renderedScreen}
            pagePhase={pagePhase}
            tooltipBlocked={tooltipBlocked}
          />
          <div
            ref={(el) => setTooltipRoot(el)}
            id="tooltip-root"
            className={cn("pointer-events-none fixed inset-0 z-[130]", tooltipBlocked && "tooltips-disabled")}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  const bootstrapResult = useAlchemyBootstrap();
  // Gate lives here so StartupLoadingScreen stays mounted across bootstrap and
  // keeps a single empty→full animation (outside the VR stage for size parity).
  const initialLoadReady = useInitialLoadReady();

  const saveBlockedByNewerVersion =
    bootstrapResult?.status.kind === "unsupported-newer-schema" ||
    bootstrapResult?.status.kind === "unsupported-newer-content";

  if (!bootstrapResult || (!initialLoadReady && !saveBlockedByNewerVersion)) {
    return <StartupLoadingScreen />;
  }

  return <AppInner bootstrapResult={bootstrapResult} />;
}
