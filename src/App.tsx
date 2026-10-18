import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { battlePresentation } from "@/app/battle-presentation";
import { defaultGameSession } from "@/app/application-session";
import { SaveWriteNotice } from "@/app/save-write-notice";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  AppBackgroundParticles,
  AppScreenChromeProvider,
  GameMenuOverlay,
  syncStartupSplash,
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
  useActiveRunCharacterId,
  useActiveRunBoons,
  useActiveRunScreenValue,
  useBondedCompanions,
  useHomesteadEffects,
  useHasActiveBattle,
  useRunPhase,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/use-run-reads";
import { useAppSettings } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { CardInspectionOverlay } from "@/features/alchemy/shared/ui/inspection/card-inspection-overlay";
import { BattleBoardBackground } from "@/features/alchemy/shared/ui/battle-board-background";
import {
  useBattleSceneAppearance,
  battleSceneCssVariables,
} from "@/features/alchemy/shared/ui/use-battle-scene-appearance";
import { boardArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { useActiveBoardId } from "@/features/alchemy/shared/stores/use-profile-store";
import { KeywordPlasmaBackground } from "@/features/alchemy/shared/ui/keyword-plasma-background";
import { setModalRoot } from "@/features/alchemy/shared/ui/modal-root";
import { setTooltipRoot } from "@/features/alchemy/shared/ui/tooltips/tooltip-root";
import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { getRunPhase, type Screen } from "@/lib/routing";
import { useSteamRichPresence } from "@/features/alchemy/shell/use-steam-rich-presence";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type SyntheticEvent } from "react";

const OPTIONS_PREVIEW_PLASMA_PAIR = { primary: "#fbbf24", secondary: "#78350f" };

type GameMenuState = ReturnType<typeof useGameMenuState>;

function AppKeywordPlasmaBackground({ renderedScreen, intensity }: { renderedScreen: Screen; intensity: number }) {
  useGameTranslation();
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
  run: AlchemyRunCommands;
  renderedScreen: Screen;
  pagePhase: "enter" | "exit";
  tooltipBlocked: boolean;
  gameMenu: GameMenuState;
}) {
  const i18n = useGameTranslation();
  const { screen: controllerScreen } = run;
  const runPhase = useRunPhase(controllerScreen);
  const nav = useReturnToRunNavigation({ run, renderedScreen });

  useAlchemyAutosaveFromStores();

  const dev = useDevShortcuts(run);

  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const homesteadBondedCompanions = useBondedCompanions();
  const cardDescriptionContext = useMemo(
    () => ({
      companionDamageModifiers: {
        damageBonus: homesteadEffects.companionDamage + talentEffects.companionDamage,
        damageMultiplier: 1,
      },
      companionBondLevels: homesteadBondedCompanions,
    }),
    [homesteadBondedCompanions, homesteadEffects, talentEffects],
  );

  const showBattleCluster = renderedScreen === "battle";
  const activeBoardId = useActiveBoardId();
  const sceneAppearance = useBattleSceneAppearance(
    showBattleCluster && activeBoardId ? boardArt[activeBoardId]?.thumbnail : undefined,
  );
  const { isAutoplayEnabled, toggleAutoplayEnabled, boonInspectOpen, toggleBoonInspect, closeBoonInspect } =
    run.routeCommands.battle;
  const runBoons = useActiveRunBoons();
  const hasInspectBoons = hasInspectableBoons(runBoons);
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(renderedScreen, { initialRevealOnly: true });
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

  // Dialogs restore their own focus; closing inspection is not a screen transition.
  useScreenFocus(renderedScreen, screenInteractive);

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
          {i18n.displayText(
            i18n.read(() =>
              renderAlchemyScreenRoute({
                screen: renderedScreen,
                cardInspection: { canOpen: inspection.canOpen, onOpen: openCardInspection },
                routeCommands: run.routeCommands,
                onOpenBoards: nav.openBoardsFromOptions,
                onClearSaveData: dev.clearSaveData,
                onUnlockAllDevMode: dev.unlockAllDevMode,
                gameMenuOpen: gameMenu.gameMenuOpen,
                onOpenGameMenu: gameMenu.openGameMenu,
                onBack: nav.screenBackHandler,
              }),
            ),
          )}
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
        style={{
          ...stageStyle,
          ...battleSceneCssVariables(sceneAppearance),
        }}
      >
        {showBattleCluster ? <BattleBoardBackground boardId={activeBoardId} /> : null}
        <AppBackgroundParticles
          renderedScreen={renderedScreen}
          backgroundParticlesIntensity={backgroundParticlesIntensity}
        />
        <AppKeywordPlasmaBackground renderedScreen={renderedScreen} intensity={backgroundGlowIntensity} />
        {i18n.displayText(content)}
        {showBattleCluster ? (
          <BattleCluster
            endTurn={{
              presentation: run.routeCommands.battle.presentation,
              screen: controllerScreen,
              buttonRef: run.routeCommands.battle.refs.endTurnButtonRef,
              onEndTurn: run.routeCommands.battle.handleEndTurn,
              isCardPlayInProgress: run.routeCommands.battle.isCardPlayInProgress,
              subscribePlayback: run.routeCommands.battle.subscribePlayback,
              isProgressSavePending: run.routeCommands.battle.isProgressSavePending,
              subscribeProgressSave: run.routeCommands.battle.subscribeProgressSave,
            }}
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
          onSelect={openCardInspection}
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
  const i18n = useGameTranslation();
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
  const run = useAlchemyRunController(defaultGameSession, battlePresentation);
  const characterId = useActiveRunCharacterId();
  const hasActiveBattle = useHasActiveBattle();
  useSteamRichPresence(run.screen, getRunPhase(run.screen, hasActiveBattle), characterId);

  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(run.screen);

  return (
    <ErrorBoundary label={i18n.displayText(screen)}>
      <SaveWriteNotice onRetry={run.retryProgressSave} />
      <div
        aria-busy={run.progressSave.kind !== "idle"}
        className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background"
      >
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
  useGameTranslation();
  const displayPreferences = useDeviceDisplayPreferences();
  const displayLayout = useVirtualResolution(false, displayPreferences);
  const { contentScale } = displayLayout;
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--content-scale", String(contentScale));
    return () => {
      document.documentElement.style.removeProperty("--content-scale");
    };
  }, [contentScale]);
  const bootstrapResult = useAlchemyBootstrap(defaultGameSession);

  const { ready: initialLoadReady, progress: startupProgress } = useInitialLoadReady({
    bootstrapReady: bootstrapResult != null,
  });

  useEffect(() => {
    syncStartupSplash(startupProgress, bootstrapResult !== null && initialLoadReady);
  }, [bootstrapResult, initialLoadReady, startupProgress]);

  if (!bootstrapResult || !initialLoadReady) {
    return null;
  }

  return (
    <>
      {bootstrapResult.importedDemoProgress ? <DemoImportNotice /> : null}
      <AppInner displayLayout={displayLayout} />
    </>
  );
}

function DemoImportNotice() {
  const i18n = useGameTranslation();
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-background p-4 text-foreground"
    >
      <GameMessage
        id="ui.App.s1"
        defaultValue="Your earned demo progress has been imported. Start a new adventure in the full game.<part0/>"
        parts={{
          part0: (
            <Button variant="ghost" className="ml-4" onClick={() => setVisible(false)}>
              {i18n.text("ui.App.2", "Dismiss")}
            </Button>
          ),
        }}
      />
    </div>
  );
}
