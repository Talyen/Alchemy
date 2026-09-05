import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import { useDeviceDisplayStore } from "@/features/alchemy/shared/stores/device-display-store";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Screen } from "@/lib/routing";
import {
  AppBackgroundParticles,
  AppScreenChromeProvider,
  GameMenuOverlay,
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
  useRenderedScreenTransition,
  useReturnToRunNavigation,
  getScreenParticleConfig,
} from "@/app/app-shell";
import { renderAlchemyScreenRoute } from "@/app/screen-routes";
import { useIsArmoryLocked } from "@/features/alchemy/shared/stores/gear-store";
import { useVirtualResolution } from "@/features/alchemy/shared/hooks";
import { setTooltipRoot } from "@/features/alchemy/shared/ui/tooltip-root";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { HamburgerTrigger } from "@/features/alchemy/shared/ui/navigation";
import { BattleAutoplayToggle } from "@/features/alchemy/run-loop/screens/battle-screen/autoplay-toggle";
import { BattleBoonInspectButton } from "@/features/alchemy/run-loop/screens/battle-screen/boon-inspect";
import { uniqueRunBoons } from "@/features/alchemy/run-loop/screens/battle-screen/unique-run-boons";
import { ErrorBoundary } from "@/components/error-boundary";
import { clearAlchemySaveData, type SaveLoadState } from "@/features/alchemy/shared/storage";
import { useAppSettings } from "@/features/alchemy/shared/stores/store-actions";
import {
  useActiveRunScreenValue,
  useActiveRunBoons,
  useAutosaveAllowed,
  useBondedCompanions,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-reads";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";
import { KeywordPlasmaBackground } from "@/features/alchemy/shared/ui/keyword-plasma-background";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

const OPTIONS_PREVIEW_PLASMA_PAIR = { primary: "#fbbf24", secondary: "#78350f" };

type GameMenuState = ReturnType<typeof useGameMenuState>;

async function wipeUnsupportedSaveAndReload() {
  const cleared = await clearAlchemySaveData({ keepWritesDisabled: true });
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
  backgroundParticlesIntensity,
  backgroundGlowIntensity,
  run,
  renderedScreen,
  pagePhase,
  tooltipBlocked,
  gameMenu,
}: {
  saveBlockedByNewerVersion: boolean;
  vrStageRef: React.RefObject<HTMLDivElement | null>;
  stagePixelRatio: number;
  stageStyle: React.CSSProperties;
  aspectMode: "standard" | "narrow" | "ultrawide";
  brightness: number;
  backgroundParticlesIntensity: number;
  backgroundGlowIntensity: number;
  run: AlchemyRunCommands;
  renderedScreen: Screen;
  pagePhase: "enter" | "exit";
  tooltipBlocked: boolean;
  gameMenu: GameMenuState;
}) {
  const finishedRunCharacters = useFinishedRunCharacters();
  const isArmoryLocked = useIsArmoryLocked();
  const { screen: controllerScreen } = run;
  const { phase: runPhase } = useRunSessionNavigationSlice(controllerScreen);
  const autosaveEnabled = useAutosaveAllowed(controllerScreen);
  const nav = useReturnToRunNavigation({ run, renderedScreen });
  useAppKeyboardShortcuts({
    renderedScreen,
    gameMenuOpen: gameMenu.gameMenuOpen,
    onBack: nav.screenBackHandler,
    setMenuAnchorRect: gameMenu.setMenuAnchorRect,
    setGameMenuOpen: gameMenu.setGameMenuOpen,
  });

  useAlchemyAutosaveFromStores(autosaveEnabled, nav.returnToRunScreen);

  const dev = useDevShortcuts(run);

  const homesteadEffects = run.homesteadEffects;
  const talentEffects = useTalentEffects();
  const homesteadBondedCompanions = useBondedCompanions();
  const cardDescriptionContext = useMemo(
    () => ({
      flatPhysicalDamage: homesteadEffects.flatPhysicalDamage + talentEffects.flatPhysicalDamage,
      companionDamage: homesteadEffects.companionDamage + talentEffects.companionDamage,
      companionBondLevels: homesteadBondedCompanions,
      potionPotency: talentEffects.potionPotency + homesteadEffects.potionPotency,
    }),
    [homesteadBondedCompanions, homesteadEffects, talentEffects],
  );

  const { particleColors, particleAlphaMultiplier } = getScreenParticleConfig(renderedScreen, false);
  const plasmaColorPair = useUiStore(
    (state) => state.plasmaInteraction?.colorPair ?? state.plasmaBaseline?.colorPair ?? null,
  );
  const effectivePlasmaColorPair =
    plasmaColorPair ?? (renderedScreen === "options" ? OPTIONS_PREVIEW_PLASMA_PAIR : null);

  const [deletingUnsupportedSave, setDeletingUnsupportedSave] = useState(false);
  const handleDeleteUnsupportedSave = useCallback(() => {
    if (deletingUnsupportedSave) return;
    setDeletingUnsupportedSave(true);
    void wipeUnsupportedSaveAndReload().catch(() => {
      setDeletingUnsupportedSave(false);
    });
  }, [deletingUnsupportedSave]);

  const showBattleCluster = renderedScreen === "battle" && !saveBlockedByNewerVersion;
  const { isAutoplayEnabled, toggleAutoplayEnabled, boonInspectOpen, toggleBoonInspect } = run.routeCommands.battle;
  const runBoons = useActiveRunBoons();
  const hasInspectBoons = uniqueRunBoons(runBoons).length > 0;
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(renderedScreen);
  const pagePhaseClass = pagePhase === "exit" ? "page-exit" : "page-enter";
  const content = saveBlockedByNewerVersion ? (
    <UnsupportedSaveOverlay onDeleteSaveAndContinue={handleDeleteUnsupportedSave} deleting={deletingUnsupportedSave} />
  ) : (
    <div
      ref={artworkRef}
      data-artwork-pending={artworkPending}
      key={renderedScreen}
      className={cn(pagePhaseClass, "h-full w-full overflow-hidden")}
    >
      <CardDescriptionProvider cardDescriptionContext={cardDescriptionContext}>
        <AppScreenChromeProvider
          aspectMode={aspectMode}
          stagePixelRatio={stagePixelRatio}
          returnToRunScreen={nav.returnToRunScreen}
          openGameMenu={gameMenu.openGameMenu}
          isMenuOpen={gameMenu.gameMenuOpen}
          onBack={nav.screenBackHandler}
        >
          {renderAlchemyScreenRoute({
            screen: renderedScreen,
            routeCommands: run.routeCommands,
            onClearSaveData: dev.clearSaveData,
            onUnlockAllDevMode: dev.unlockAllDevMode,
            onBackFromOptions: nav.backFromOptions,
            gameMenuOpen: gameMenu.gameMenuOpen,
            onOpenGameMenu: gameMenu.openGameMenu,
            onBack: nav.screenBackHandler,
          })}
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
          backgroundParticlesIntensity={backgroundParticlesIntensity}
        />
        <KeywordPlasmaBackground colorPair={effectivePlasmaColorPair} intensity={backgroundGlowIntensity} />
        {content}
        {showBattleCluster ? (
          <div className="absolute top-4 right-4 z-[80] flex items-center gap-2">
            <BattleAutoplayToggle enabled={isAutoplayEnabled} onToggle={toggleAutoplayEnabled} />
            {hasInspectBoons ? <BattleBoonInspectButton open={boonInspectOpen} onToggle={toggleBoonInspect} /> : null}
            <HamburgerTrigger onClick={gameMenu.openGameMenu} label="Open game menu" active={gameMenu.gameMenuOpen} />
          </div>
        ) : null}
        <div
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

function AppInner({
  bootstrapResult,
  displayLayout,
}: {
  bootstrapResult: SaveLoadState;
  displayLayout: ReturnType<typeof useVirtualResolution>;
}) {
  const { status: saveLoadStatus } = bootstrapResult;

  const settings = useAppSettings();
  const vrStageRef = useRef<HTMLDivElement>(null);
  const { frameStyle, stageStyle, tooltipStyle, aspectMode, stagePixelRatio } = displayLayout;
  useAppDisplayEffects({
    displayMode: settings.displayMode,
    brightness: settings.brightness,
    stageRef: vrStageRef,
  });
  useGlobalErrorHandlers();

  const screen = useActiveRunScreenValue();
  useAppAudioEffects({
    masterVolume: settings.masterVolume,
    musicVolume: settings.musicVolume,
    sfxVolume: settings.sfxVolume,
    muteInBackground: settings.muteInBackground,
    screen,
  });

  const gameMenu = useGameMenuState();
  const run = useAlchemyRunController();

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
            backgroundParticlesIntensity={settings.backgroundParticlesIntensity}
            backgroundGlowIntensity={settings.backgroundGlowIntensity}
            run={run}
            renderedScreen={renderedScreen}
            pagePhase={pagePhase}
            tooltipBlocked={tooltipBlocked}
            gameMenu={gameMenu}
          />
          <div
            ref={(el) => setTooltipRoot(el)}
            id="tooltip-root"
            style={tooltipStyle}
            className={cn("pointer-events-none fixed inset-0 z-[130]", tooltipBlocked && "tooltips-disabled")}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  const settings = useAppSettings();
  const displayPreferences = useDeviceDisplayStore();
  const displayLayout = useVirtualResolution(settings.selectedAspectRatio, false, displayPreferences);
  const { contentScale } = displayLayout;
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--content-scale", String(contentScale));
    return () => {
      document.documentElement.style.removeProperty("--content-scale");
    };
  }, [contentScale]);
  const bootstrapResult = useAlchemyBootstrap();

  const { ready: initialLoadReady, progress: startupProgress } = useInitialLoadReady({
    bootstrapReady: bootstrapResult != null,
  });

  const saveBlockedByNewerVersion =
    bootstrapResult?.status.kind === "unsupported-newer-schema" ||
    bootstrapResult?.status.kind === "unsupported-newer-content";

  if (!bootstrapResult || (!initialLoadReady && !saveBlockedByNewerVersion)) {
    return <StartupLoadingScreen progress={startupProgress} />;
  }

  return <AppInner bootstrapResult={bootstrapResult} displayLayout={displayLayout} />;
}
