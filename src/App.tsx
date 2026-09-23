import { DriftingLights } from "@/features/alchemy/shared/ui/drifting-lights";
import type { BackgroundLightsSettings } from "@/lib/screen-effect-settings";
import { ScreenEffect } from "@/features/alchemy/shared/ui/screen-effect";
import {
  AppBackgroundParticles,
  AppScreenChromeProvider,
  GameMenuOverlay,
  StartupLoadingScreen,
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
} from "@/app/app-shell";
import { useScreenFocus } from "@/app/use-screen-focus";
import { BattleCluster } from "@/app/battle-cluster";
import { renderAlchemyScreenRoute } from "@/app/screen-routes";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";
import { useCardInspection } from "@/app/use-card-inspection";
import { ErrorBoundary } from "@/components/error-boundary";
import { hasInspectableBoons } from "@/features/alchemy/run-loop/screens/battle-screen/unique-run-boons";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { useVirtualResolution } from "@/features/alchemy/shared/ui/use-virtual-resolution";
import { useDeviceDisplayPreferences } from "@/features/alchemy/shared/stores/device-display-store";
import {
  useActiveRunBoons,
  useActiveRunScreenValue,
  useAutosaveAllowed,
  useBondedCompanions,
  useRunSessionNavigationSlice,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import { useAppSettings, useSelectedAspectRatio } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { CardInspectionOverlay } from "@/features/alchemy/shared/ui/inspection/card-inspection-overlay";
import { KeywordPlasmaBackground } from "@/features/alchemy/shared/ui/keyword-plasma-background";
import { setModalRoot } from "@/features/alchemy/shared/ui/modal-root";
import { setTooltipRoot } from "@/features/alchemy/shared/ui/tooltips/tooltip-root";
import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { Screen } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { useCallback, useLayoutEffect, useMemo, useRef, type SyntheticEvent } from "react";

const OPTIONS_PREVIEW_PLASMA_PAIR = { primary: "#fbbf24", secondary: "#78350f" };

type GameMenuState = ReturnType<typeof useGameMenuState>;

function AppKeywordPlasmaBackground({ renderedScreen, intensity }: { renderedScreen: Screen; intensity: number }) {
  const plasmaColorPair = useUiStore(
    (state) => state.plasmaInteraction?.colorPair ?? state.plasmaBaseline?.colorPair ?? null,
  );
  const effectivePlasmaColorPair =
    plasmaColorPair ?? (renderedScreen === "options" ? OPTIONS_PREVIEW_PLASMA_PAIR : null);

  return <KeywordPlasmaBackground colorPair={effectivePlasmaColorPair} intensity={intensity} />;
}

function AppMainContent({
  vrStageRef,
  stagePixelRatio,
  stageStyle,
  aspectMode,
  brightness,
  backgroundParticlesIntensity,
  backgroundGlowIntensity,
  backgroundLights,
  run,
  renderedScreen,
  pagePhase,
  tooltipBlocked,
  gameMenu,
}: {
  vrStageRef: React.RefObject<HTMLDivElement | null>;
  stagePixelRatio: number;
  stageStyle: React.CSSProperties;
  aspectMode: "standard" | "narrow" | "ultrawide";
  brightness: number;
  backgroundParticlesIntensity: number;
  backgroundGlowIntensity: number;
  backgroundLights: BackgroundLightsSettings;
  run: AlchemyRunCommands;
  renderedScreen: Screen;
  pagePhase: "enter" | "exit";
  tooltipBlocked: boolean;
  gameMenu: GameMenuState;
}) {
  const showBackgroundLights = backgroundLights.enabled && backgroundLights.strength > 0;
  const { screen: controllerScreen } = run;
  const { phase: runPhase } = useRunSessionNavigationSlice(controllerScreen);
  const autosaveEnabled = useAutosaveAllowed(controllerScreen);
  const nav = useReturnToRunNavigation({ run, renderedScreen });

  useAlchemyAutosaveFromStores(autosaveEnabled);

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

  const showBattleCluster = renderedScreen === "battle";
  const { isAutoplayEnabled, toggleAutoplayEnabled, boonInspectOpen, toggleBoonInspect, closeBoonInspect } =
    run.routeCommands.battle;
  const runBoons = useActiveRunBoons();
  const hasInspectBoons = hasInspectableBoons(runBoons);
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(renderedScreen);
  const pagePhaseClass = pagePhase === "exit" ? "page-exit" : "page-enter";
  const screenInteractive =
    !run.navigationPending && controllerScreen === renderedScreen && pagePhase !== "exit" && !artworkPending;
  useAppKeyboardShortcuts({
    renderedScreen,
    screenInteractive,
    gameMenuOpen: gameMenu.gameMenuOpen,
    onBack: nav.screenBackHandler,
    toggleGameMenu: gameMenu.toggleGameMenu,
  });
  const { closeGameMenu } = gameMenu;
  const closeInspectionPeers = useCallback(() => {
    closeGameMenu();
    closeBoonInspect();
  }, [closeGameMenu, closeBoonInspect]);
  const {
    returnFocusRef: inspectionReturnFocusRef,
    onOpen: openCardInspection,
    ...inspection
  } = useCardInspection({
    screen: renderedScreen,
    screenInteractive,
    returnToRunScreen: nav.returnToRunScreen,
    isCardPlayInProgress: run.routeCommands.battle.isCardPlayInProgress,
    gameMenuOpen: gameMenu.gameMenuOpen,
    boonInspectOpen,
    closeOtherOverlays: closeInspectionPeers,
  });
  const onOpenDeck = useCallback(() => openCardInspection("deck"), [openCardInspection]);
  const deckInspection = useMemo(
    () =>
      inspection.visible
        ? {
            count: inspection.count,
            disabled: !inspection.canOpen,
            onOpen: onOpenDeck,
          }
        : undefined,
    [inspection.visible, inspection.count, inspection.canOpen, onOpenDeck],
  );

  useScreenFocus(renderedScreen, screenInteractive && !inspection.open);

  function blockOutgoingScreenInteraction(event: SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
  const content = (
    <div
      ref={artworkRef}
      data-screen-content={renderedScreen}
      data-artwork-pending={artworkPending}
      key={renderedScreen}
      inert={!screenInteractive || inspection.open}
      onClickCapture={!screenInteractive ? blockOutgoingScreenInteraction : undefined}
      onKeyDownCapture={!screenInteractive ? blockOutgoingScreenInteraction : undefined}
      className={cn(pagePhaseClass, "relative z-10 h-full w-full overflow-hidden")}
    >
      <CardDescriptionProvider cardDescriptionContext={cardDescriptionContext}>
        <AppScreenChromeProvider
          aspectMode={aspectMode}
          stagePixelRatio={stagePixelRatio}
          returnToRunScreen={nav.returnToRunScreen}
          openGameMenu={gameMenu.openGameMenu}
          isMenuOpen={gameMenu.gameMenuOpen}
          onBack={nav.screenBackHandler}
          deckInspection={deckInspection}
        >
          {renderAlchemyScreenRoute({
            screen: renderedScreen,
            cardInspection: { canOpen: inspection.canOpen, onOpen: openCardInspection },
            routeCommands: run.routeCommands,
            onClearSaveData: dev.clearSaveData,
            onUnlockAllDevMode: dev.unlockAllDevMode,
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
      {showBackgroundLights ? (
        <DriftingLights strength={backgroundLights.strength} motion={backgroundLights.motion} />
      ) : null}
      <div
        ref={vrStageRef}
        data-testid="vr-stage"
        data-run-phase={runPhase}
        data-stage-pixel-ratio={stagePixelRatio}
        className={cn(
          "[container-type:size] absolute top-0 left-0 overflow-hidden",
          !showBackgroundLights && "bg-background",
          tooltipBlocked && "tooltips-disabled",
        )}
        style={stageStyle}
      >
        <AppBackgroundParticles
          renderedScreen={renderedScreen}
          backgroundParticlesIntensity={backgroundParticlesIntensity}
        />
        <AppKeywordPlasmaBackground renderedScreen={renderedScreen} intensity={backgroundGlowIntensity} />
        {content}
        {showBattleCluster ? (
          <BattleCluster
            inert={inspection.open || !screenInteractive}
            deckInspection={deckInspection}
            isAutoplayEnabled={isAutoplayEnabled}
            toggleAutoplayEnabled={toggleAutoplayEnabled}
            hasInspectBoons={hasInspectBoons}
            boonInspectOpen={boonInspectOpen}
            toggleBoonInspect={toggleBoonInspect}
            gameMenuOpen={gameMenu.gameMenuOpen}
            onOpenGameMenu={gameMenu.openGameMenu}
            onSkipCombat={run.routeCommands.battle.skipCombatDevMode}
          />
        ) : null}
        <CardInspectionOverlay
          open={inspection.open}
          selected={inspection.selected}
          collections={inspection.collections}
          descriptionContext={inspection.battleDescriptionContext ?? cardDescriptionContext}
          onClose={inspection.close}
          returnFocusRef={inspectionReturnFocusRef}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[90] bg-black"
          style={{ opacity: Math.max(0, 1 - brightness / 100) }}
        />
      </div>
      <GameMenuOverlay
        gameMenuOpen={gameMenu.gameMenuOpen}
        anchorRect={gameMenu.menuAnchorRect}
        currentScreen={renderedScreen}
        onClose={gameMenu.closeGameMenu}
        nav={nav}
        onEndRun={run.handleEndRun}
      />
    </>
  );
}

function AppInner({ displayLayout }: { displayLayout: ReturnType<typeof useVirtualResolution> }) {
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

  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(run.screen);

  return (
    <ErrorBoundary label={screen}>
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
        <div className="relative" style={frameStyle}>
          <div ref={setModalRoot} className="contents" />
          <AppMainContent
            vrStageRef={vrStageRef}
            stagePixelRatio={stagePixelRatio}
            stageStyle={stageStyle}
            aspectMode={aspectMode}
            brightness={settings.brightness}
            backgroundParticlesIntensity={settings.backgroundParticlesIntensity}
            backgroundGlowIntensity={settings.backgroundGlowIntensity}
            backgroundLights={settings.backgroundLights}
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
        <ScreenEffect settings={settings.screenEffects} />
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  const selectedAspectRatio = useSelectedAspectRatio();
  const displayPreferences = useDeviceDisplayPreferences();
  const displayLayout = useVirtualResolution(selectedAspectRatio, false, displayPreferences);
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

  if (!bootstrapResult || !initialLoadReady) {
    return <StartupLoadingScreen progress={startupProgress} />;
  }

  return <AppInner displayLayout={displayLayout} />;
}
