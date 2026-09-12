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
} from "@/app/app-shell";
import { BattleAutoplayToggle } from "@/app/battle-autoplay-toggle";
import { BattleGoldCounter, BattleSkipCombatButton } from "@/app/battle-toolbar-extras";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { renderAlchemyScreenRoute } from "@/app/screen-routes";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";
import { useCardInspection } from "@/app/use-card-inspection";
import { ErrorBoundary } from "@/components/error-boundary";
import { BattleBoonInspectButton } from "@/features/alchemy/run-loop/screens/battle-screen/boon-inspect";
import { hasInspectableBoons } from "@/features/alchemy/run-loop/screens/battle-screen/unique-run-boons";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { useVirtualResolution } from "@/features/alchemy/shared/ui/use-virtual-resolution";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { useDeviceDisplayStore } from "@/features/alchemy/shared/stores/device-display-store";
import { useIsArmoryLocked } from "@/features/alchemy/shared/stores/gear-store";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import {
  useActiveRunBoons,
  useActiveRunScreenValue,
  useAutosaveAllowed,
  useBondedCompanions,
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import { useAppSettings } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { CardInspectionOverlay } from "@/features/alchemy/shared/ui/inspection/card-inspection-overlay";
import { DeckInspectButton } from "@/features/alchemy/shared/ui/deck-inspect-button";
import { KeywordPlasmaBackground } from "@/features/alchemy/shared/ui/keyword-plasma-background";
import { setModalRoot } from "@/features/alchemy/shared/ui/modal-root";
import { HamburgerTrigger } from "@/features/alchemy/shared/ui/navigation";
import { setTooltipRoot } from "@/features/alchemy/shared/ui/tooltips/tooltip-root";
import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { Screen } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";

const OPTIONS_PREVIEW_PLASMA_PAIR = { primary: "#fbbf24", secondary: "#78350f" };

type GameMenuState = ReturnType<typeof useGameMenuState>;

async function wipeUnsupportedSaveAndReload() {
  const cleared = await clearAlchemySaveData({ keepWritesDisabled: true });
  if (!cleared) {
    throw new Error("Save data could not be cleared");
  }
  window.location.reload();
}

function BattleCluster({
  inert,
  deckInspection,
  isAutoplayEnabled,
  toggleAutoplayEnabled,
  hasInspectBoons,
  boonInspectOpen,
  toggleBoonInspect,
  gameMenuOpen,
  onOpenGameMenu,
  onSkipCombat,
}: {
  inert: boolean;
  deckInspection: { count: number; disabled: boolean; onOpen: () => void } | undefined;
  isAutoplayEnabled: boolean;
  toggleAutoplayEnabled: () => void;
  hasInspectBoons: boolean;
  boonInspectOpen: boolean;
  toggleBoonInspect: () => void;
  gameMenuOpen: boolean;
  onOpenGameMenu: (rect?: DOMRect) => void;
  onSkipCombat: () => void;
}) {
  const { battle } = useRunSessionBattleContext("battle");
  return (
    <div inert={inert} className="absolute top-4 right-4 z-[80] flex items-center gap-2">
      <BattleGoldCounter gold={battle.battleState.gold} />
      {deckInspection ? <DeckInspectButton {...deckInspection} /> : null}
      <BattleAutoplayToggle enabled={isAutoplayEnabled} onToggle={toggleAutoplayEnabled} />
      {hasInspectBoons ? <BattleBoonInspectButton open={boonInspectOpen} onToggle={toggleBoonInspect} /> : null}
      {isAlchemyDevBuild() ? (
        <BattleSkipCombatButton
          onSkip={onSkipCombat}
          disabled={gameMenuOpen || boonInspectOpen || Boolean(battle.battleState.wishOptions)}
        />
      ) : null}
      <HamburgerTrigger onClick={onOpenGameMenu} label="Open game menu" active={gameMenuOpen} />
    </div>
  );
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
    screenInteractive: screenInteractive && !saveBlockedByNewerVersion,
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

  function blockOutgoingScreenInteraction(event: SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
  const content = saveBlockedByNewerVersion ? (
    <UnsupportedSaveOverlay onDeleteSaveAndContinue={handleDeleteUnsupportedSave} deleting={deletingUnsupportedSave} />
  ) : (
    <div
      ref={artworkRef}
      data-artwork-pending={artworkPending}
      key={renderedScreen}
      inert={!screenInteractive || inspection.open}
      onClickCapture={!screenInteractive ? blockOutgoingScreenInteraction : undefined}
      onKeyDownCapture={!screenInteractive ? blockOutgoingScreenInteraction : undefined}
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
          backgroundParticlesIntensity={backgroundParticlesIntensity}
        />
        <KeywordPlasmaBackground colorPair={effectivePlasmaColorPair} intensity={backgroundGlowIntensity} />
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
  saveBlockedByNewerVersion,
  displayLayout,
}: {
  saveBlockedByNewerVersion: boolean;
  displayLayout: ReturnType<typeof useVirtualResolution>;
}) {
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

  return <AppInner saveBlockedByNewerVersion={saveBlockedByNewerVersion} displayLayout={displayLayout} />;
}
