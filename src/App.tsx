// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { characterArt, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { useAppAudioEffects } from "@/app/use-app-audio-effects";
import { useAppDisplayEffects } from "@/app/use-app-display-effects";
import { useScreenAssetPreloadEffects } from "@/app/use-app-preload-effects";
import { gearDefinitions } from "@/lib/gear";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { useGlobalErrorHandlers } from "@/app/use-global-error-handlers";
import { useInitialLoadReady } from "@/app/use-initial-load-ready";
import { useRenderedScreenTransition } from "@/app/use-rendered-screen-transition";
import { resolveReturnToRunLabel, shouldShowReturnToRun } from "@/app/return-to-run-navigation";
import { useGameMenuState } from "@/app/use-game-menu-state";
import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import { useReturnToRunNavigation } from "@/app/use-return-to-run-navigation";
import { useScreenParticleConfig } from "@/app/use-screen-particles";
import { useDevShortcuts } from "@/features/alchemy/shared/utils/dev-mode";
import { RenderAlchemyScreen } from "@/app/render-alchemy-screen";
import { AppScreenChromeProvider } from "@/app/app-screen-chrome-context";
import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { UnsupportedSaveVersionScreen } from "@/app/unsupported-save-version-screen";
import { useVirtualResolution } from "@/features/alchemy/shared/hooks";
import { GameMenu, HamburgerTrigger } from "@/features/alchemy/shared/ui/shared-ui";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { CardDescriptionProvider } from "@/features/alchemy/shared/context/card-description-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { BackgroundParticles } from "@/features/alchemy/shared/ui/background-particles";
import { platform } from "@/lib/platform";
import { bootstrapAlchemySaveState } from "@/features/alchemy/shared/storage/bootstrap-save-state";
import type { SaveLoadState } from "@/features/alchemy/shared/storage";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useAppSettings } from "@/features/alchemy/shared/stores/store-actions";
import { isRunLoopScreen } from "@/lib/routing";
import { useActiveRunScreenValue } from "@/features/alchemy/shared/stores/run-session-facade";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { flattenGearInventories } from "@/lib/gear";
import { applySaveDataToStores } from "@/features/alchemy/shared/storage/bootstrap-save-state";

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
  const isArmoryLocked = useGearStore((s) => flattenGearInventories(s.inventories).length === 0);
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
    if (run.screen === "rewards" && run.contentSystemType !== "wildwood" && run.rewardState.choices.length === 0) return false;
    return true;
  };
  const autosaveEnabled = isAutosaveAllowed();

  useAlchemyAutosaveFromStores(autosaveEnabled, nav.returnToRunScreen);

  const dev = useDevShortcuts(run);

  const homesteadEffects = useHomesteadStore((s) => s.effects);
  const homesteadBondedCompanions = useHomesteadStore((s) => s.bondedCompanions);

  const isBossBattle = renderedScreen === "battle" && run.battleState.currentEnemy.enemyType === "boss";
  const { particleColors, particleAlphaMultiplier } = useScreenParticleConfig(renderedScreen, isBossBattle);

  const pagePhaseClass = pagePhase === "exit" ? "page-exit" : "page-enter";
  const content = saveBlockedByNewerVersion
    ? <UnsupportedSaveVersionScreen canQuit={platform.canQuit} onQuit={platform.quit} />
    : !initialLoadReady
      ? <StartupLoadingScreen />
      : <div key={renderedScreen} className={cn(pagePhaseClass, "h-full w-full overflow-hidden")}>
          <CardDescriptionProvider cardDescriptionContext={{
            flatPhysicalDamage: homesteadEffects.flatPhysicalDamage,
            companionDamage: homesteadEffects.companionDamage,
            companionBondLevels: homesteadBondedCompanions,
            potionPotency: 1 + homesteadEffects.potionPotency,
          }}>
            <AppScreenChromeProvider run={run} aspectMode={aspectMode} stagePixelRatio={stagePixelRatio} returnToRunScreen={nav.returnToRunScreen}>
              <RenderAlchemyScreen screen={renderedScreen} run={run} battleBindings={run.battleBindings}
                onOpenBattleMenu={gameMenu.openBattleMenu} onClearSaveData={dev.clearSaveData}
                onUnlockAllDevMode={dev.unlockAllDevMode} onBackFromOptions={nav.backFromOptions}
              />
            </AppScreenChromeProvider>
          </CardDescriptionProvider>
        </div>;

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
        {renderedScreen !== "battle" && (
          <BackgroundParticles
            variant="embers"
            {...(particleColors ? { colors: particleColors } : {})}
            {...(particleAlphaMultiplier ? { alphaMultiplier: particleAlphaMultiplier } : {})}
          />
        )}
        {content}
        {isRunLoopScreen(renderedScreen) && renderedScreen !== "battle" && renderedScreen !== "labyrinth-map" ? (
          <div className="pointer-events-none absolute inset-0 z-50 flex justify-center">
            <div className="pointer-events-none relative w-full max-w-6xl">
              <div className="pointer-events-auto absolute right-4 top-4">
                <HamburgerTrigger onClick={gameMenu.openBattleMenu} label={`Open ${renderedScreen} menu`} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <GameMenu
        isOpen={saveBlockedByNewerVersion ? false : gameMenu.gameMenuOpen}
        anchorRect={gameMenu.menuAnchorRect}
        currentScreen={renderedScreen}
        onClose={gameMenu.closeGameMenu}
        onMainMenu={nav.handleMainMenu}
        onCollection={() => nav.navigateToMeta("collection")}
        onTalents={() => nav.navigateToMeta("talents")}
        onHomestead={() => nav.navigateToMeta("homestead")}
        onArmory={() => nav.navigateToMeta("armory")}
        onOptions={() => nav.navigateToMeta("options")}
        isTalentsLocked={!finishedRunCharacters.includes("knight")}
        isHomesteadLocked={!finishedRunCharacters.includes("knight")}
        isArmoryLocked={isArmoryLocked}
        {...(nav.returnToRunTarget && shouldShowReturnToRun(nav.returnToRunTarget, renderedScreen)
          ? {
              onReturnToRun: nav.returnToRun,
              returnToRunLabel: resolveReturnToRunLabel(nav.returnToRunTarget),
            }
          : {})}
        {...(isRunLoopScreen(renderedScreen) && run.activeRunData ? { onEndRun: run.handleEndRun } : {})}
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

  const homesteadEffects = useHomesteadStore((s) => s.effects);

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
    homesteadEffects,
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
