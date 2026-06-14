// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
import { useEffect, useMemo, useRef, useState } from "react";
import { cn, wrapStoreSetter } from "@/lib/utils";

import {
  allGameArt,
  cardLibrary,
  characterArt,
  characters,
  enemyBestiary,
  boonLibrary,
  type CharacterId,
  type DifficultyId,
  type TalentXP,
  type UnlockedTalents,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { hasUnspentTalents } from "@/app/talent-affordability";
import { hasAffordableHomesteadUpgrade } from "@/app/homestead-affordability";
import { BOSS_PARTICLE_ALPHA_MULTIPLIER, SCREEN_PARTICLE_ALPHA, SCREEN_PARTICLE_COLORS } from "@/app/screen-particles";
import { useAppAudioEffects } from "@/app/use-app-audio-effects";
import { useAppDisplayEffects } from "@/app/use-app-display-effects";
import { useScreenAssetPreloadEffects } from "@/app/use-app-preload-effects";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { useGlobalErrorHandlers } from "@/app/use-global-error-handlers";
import { useInitialLoadReady } from "@/app/use-initial-load-ready";
import { useRenderedScreenTransition } from "@/app/use-rendered-screen-transition";
import {
  resolveReturnToRunLabel,
  resolveReturnToRunTarget,
  shouldClearReturnToRunOnMainMenu,
} from "@/app/return-to-run-navigation";
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
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-facade";
import { isRunLoopScreen, type Destination, type Screen } from "@/lib/routing";
import type { MysteryChoice } from "@/lib/mystery";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";

import { createContext, useContext } from "react";
import { useActiveRunScreenValue } from "@/features/alchemy/shared/stores/run-session-facade";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

const appStore = useAppStore;
const homesteadStore = useHomesteadStore;

const RunControllerContext = createContext<ReturnType<typeof useAlchemyRunController> | null>(null);

export function useRunController() {
  const ctx = useContext(RunControllerContext);
  if (!ctx) throw new Error("useRunController must be used within a RunControllerProvider");
  return ctx;
}

function RunControllerProvider({
  initialActiveRun,
  initialTalentXP,
  initialUnlockedTalents,
  autoEndTurn,
  homesteadEffects,
  onMarkDifficultyCompleted,
  children,
}: {
  initialActiveRun: ActiveRunData | null;
  initialTalentXP: TalentXP;
  initialUnlockedTalents: UnlockedTalents;
  autoEndTurn: boolean;
  homesteadEffects: HomesteadEffectManifest;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  children: React.ReactNode;
}) {
  const run = useAlchemyRunController({
    initialActiveRun,
    initialTalentXP,
    initialUnlockedTalents,
    autoEndTurn,
    homesteadEffects,
    onMarkDifficultyCompleted,
  });

  return <RunControllerContext.Provider value={run}>{children}</RunControllerContext.Provider>;
}

function AppMainContent({
  saveBlockedByNewerVersion,
  initialLoadReady,
  vrStageRef,
  stagePixelRatio,
  stageStyle,
  aspectMode,
  setDiscoveredBoonIds,
}: {
  saveBlockedByNewerVersion: boolean;
  initialLoadReady: boolean;
  vrStageRef: React.RefObject<HTMLDivElement | null>;
  stagePixelRatio: number;
  stageStyle: React.CSSProperties;
  aspectMode: "standard" | "narrow" | "ultrawide";
  setDiscoveredBoonIds: (ids: string[]) => void;
}) {
  const run = useRunController();
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
  const { screen: controllerScreen, commitPendingTransition } = run;
  const { renderedScreen, pagePhase, tooltipBlocked } = useRenderedScreenTransition(
    controllerScreen,
    commitPendingTransition,
  );

  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [returnToRunScreen, setReturnToRunScreen] = useState<Screen | null>(null);
  const gameMenuOpenRef = useRef(gameMenuOpen);
  const renderedScreenRef = useRef(renderedScreen);

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
    run.runPhase !== "runEnd" &&
    (run.screen !== "rewards" || run.contentSystemType === "wildwood") &&
    (run.rewardState.choices.length === 0 || run.contentSystemType === "wildwood") &&
    !(run.runPhase === "battle" && run.battleState.enemyHealth <= 0);

  useAlchemyAutosaveFromStores(autosaveEnabled, returnToRunScreen);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const actions = useMemo(() => {
    return {
      navigation: {
        goToScreen: (screen: Screen) => runRef.current.goToScreen(screen),
      },
      runStart: {
        beginCampaign: () => runRef.current.beginCampaign(),
        beginLabyrinth: () => runRef.current.beginLabyrinth(),
        beginWildwood: () => runRef.current.beginWildwood(),
        handleCharacterSelect: (id: CharacterId) => runRef.current.handleCharacterSelect(id),
        handleDraftComplete: (draftedCards: BattleCard[]) => runRef.current.handleDraftComplete(draftedCards),
        handleDraftPick: (card: BattleCard) => runRef.current.handleDraftPick(card),
        handleDifficultySelect: (id: DifficultyId) => runRef.current.handleDifficultySelect(id),
        handleBackFromDifficultySelect: () => runRef.current.handleBackFromDifficultySelect(),
      },
      battle: {
        handleCardClick: (card: BattleCard, index: number, event: React.MouseEvent<HTMLButtonElement>) =>
          runRef.current.handleCardClick(card, index, event),
        handleWishChoice: (card: BattleCard | null) => runRef.current.handleWishChoice(card),
        handleEndTurn: () => runRef.current.handleEndTurn(),
        handleEndRun: () => runRef.current.handleEndRun(),
        skipCombatDevMode: () => runRef.current.skipCombatDevMode(),
        removeCardGhost: (id: string) => runRef.current.removeCardGhost(id),
        returnToBattle: () => runRef.current.returnToBattle(),
      },
      runFlow: {
        finishRewards: () => runRef.current.finishRewards(),
        selectRewardChoice: (id: string) => runRef.current.selectRewardChoice(id),
        prepareDestinationScreen: () => runRef.current.prepareDestinationScreen(),
        handleDestinationChoice: (dest: Destination) => runRef.current.handleDestinationChoice(dest),
        handleCampfireContinue: () => runRef.current.handleCampfireContinue(),
        handleWildwoodRecoveryComplete: () => runRef.current.handleWildwoodRecoveryComplete(),
        handleWildwoodRemoveCard: (index: number) => runRef.current.handleWildwoodRemoveCard(index),
        handleWildwoodSkipRemoval: () => runRef.current.handleWildwoodSkipRemoval(),
        handleShopContinue: () => runRef.current.handleShopContinue(),
        handleShopBuyCard: (card: BattleCard) => runRef.current.handleShopBuyCard(card),
        handleShopRemoveCard: (index: number) => runRef.current.handleShopRemoveCard(index),
        handleShopRefresh: () => runRef.current.handleShopRefresh(),
        handleAlchemistContinue: () => runRef.current.handleAlchemistContinue(),
        handleAlchemistBuyCard: (card: BattleCard) => runRef.current.handleAlchemistBuyCard(card),
        handleAlchemistRefresh: () => runRef.current.handleAlchemistRefresh(),
        handleAlchemistMixPotions: (a: number, b: number) => runRef.current.handleAlchemistMixPotions(a, b),
        handleMysteryChoice: (choice: MysteryChoice) => runRef.current.handleMysteryChoice(choice),
        handleMysteryChooseCard: (cardId: string) => runRef.current.handleMysteryChooseCard(cardId),
        handleMysteryRemoveCard: (index: number) => runRef.current.handleMysteryRemoveCard(index),
        handleMysteryContinue: () => runRef.current.handleMysteryContinue(),
        handleCorruptCard: (index: number) => runRef.current.handleCorruptCard(index),
        handleCorruptionExit: () => runRef.current.handleCorruptionExit(),
        handleLabyrinthNodeEnter: (row: number, col: number) => runRef.current.handleLabyrinthNodeEnter(row, col),
        handleLabyrinthEndRun: () => runRef.current.handleLabyrinthEndRun(),
        resetRunState: () => runRef.current.resetRunState(),
        continueFromRunEnd: () => runRef.current.continueFromRunEnd(),
      },
      meta: {
        unlockTalent: (keywordId: KeywordId, talentId: string) => runRef.current.unlockTalent(keywordId, talentId),
        resetUnlockedTalents: () => runRef.current.resetUnlockedTalents(),
      },
    };
  }, []);

  function clearSaveData() {
    clearAllPersistentGameData();
    run.resetRunState();
  }

  function unlockAllDevMode() {
    if (!isAlchemyDevBuild()) return;
    appStore.getState().setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    appStore.getState().setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    setDiscoveredBoonIds(boonLibrary.map((boon) => boon.id));
    appStore
      .getState()
      .setFinishedRunCharacters(["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"]);
    run.unlockAllTalents();
    homesteadStore.getState().setMaterials({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
  }

  const hasUnspentTalentsBadge = hasUnspentTalents(run.talentXP, run.unlockedTalents);
  const homesteadMaterialInventory = useHomesteadStore((s) => s.materialInventory);
  const homesteadConstructedBuildings = useHomesteadStore((s) => s.constructedBuildings);
  const homesteadPlantedFarms = useHomesteadStore((s) => s.plantedFarms);
  const homesteadCompletedResearch = useHomesteadStore((s) => s.completedResearch);
  const homesteadBondedCompanions = useHomesteadStore((s) => s.bondedCompanions);
  const homesteadEffects = useHomesteadStore((s) => s.effects);
  const discoveredCardIds = useAppStore((s) => s.discoveredCardIds);

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

  function navigateToMeta(screen: Extract<Screen, "collection" | "talents" | "homestead" | "options" | "armory">) {
    if (isRunLoopScreen(renderedScreen)) setReturnToRunScreen(renderedScreen);
    run.goToScreen(screen);
  }

  const hasActiveBattle = run.hasActiveBattle;
  const returnToRunTarget = resolveReturnToRunTarget(returnToRunScreen, hasActiveBattle);

  function returnToRun() {
    const target = resolveReturnToRunTarget(returnToRunScreen, hasActiveBattle);
    if (!target) return;
    if (target === "battle") run.returnToBattle();
    else run.goToScreen(target);
    setReturnToRunScreen(null);
  }

  const particleColors = SCREEN_PARTICLE_COLORS[renderedScreen];
  const isBossBattle = renderedScreen === "battle" && run.battleState.currentEnemy.enemyType === "boss";
  const particleAlphaMultiplier = isBossBattle ? BOSS_PARTICLE_ALPHA_MULTIPLIER : SCREEN_PARTICLE_ALPHA[renderedScreen];

  const content = saveBlockedByNewerVersion ? (
    <UnsupportedSaveVersionScreen canQuit={platform.canQuit} onQuit={platform.quit} />
  ) : !initialLoadReady ? (
    <StartupLoadingScreen />
  ) : (
    <div
      key={renderedScreen}
      className={cn(pagePhase === "exit" ? "page-exit" : "page-enter", "h-full w-full overflow-hidden")}
    >
      <CardDescriptionProvider
        cardDescriptionContext={{
          flatPhysicalDamage: homesteadEffects.flatPhysicalDamage,
          companionDamage: homesteadEffects.companionDamage,
          companionBondLevels: homesteadBondedCompanions,
          potionPotency: 1 + homesteadEffects.potionPotency,
        }}
      >
        <AppScreenChromeProvider
          value={{
            heroArt,
            playerName,
            aspectMode,
            stagePixelRatio,
            hasUnspentTalents: hasUnspentTalentsBadge,
            hasAffordableHomestead,
            returnToRunScreen,
          }}
        >
          <RenderAlchemyScreen
            screen={renderedScreen}
            actions={actions}
            battleBindings={run.battleBindings}
            onOpenBattleMenu={openBattleMenu}
            onClearSaveData={clearSaveData}
            onUnlockAllDevMode={unlockAllDevMode}
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
        {renderedScreen !== "battle" && (
          <BackgroundParticles
            variant="embers"
            {...(particleColors ? { colors: particleColors } : {})}
            {...(particleAlphaMultiplier ? { alphaMultiplier: particleAlphaMultiplier } : {})}
          />
        )}
        {content}
        {isRunLoopScreen(renderedScreen) && renderedScreen !== "battle" && renderedScreen !== "labyrinth-map" ? (
          <div className="absolute right-4 top-4 z-50">
            <HamburgerTrigger onClick={openBattleMenu} label={`Open ${renderedScreen} menu`} />
          </div>
        ) : null}
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
        onMainMenu={() => {
          if (shouldClearReturnToRunOnMainMenu(hasActiveBattle)) {
            setReturnToRunScreen(null);
          }
          run.goToScreen("menu");
        }}
        onCollection={() => navigateToMeta("collection")}
        onTalents={() => navigateToMeta("talents")}
        onHomestead={() => navigateToMeta("homestead")}
        onArmory={() => navigateToMeta("armory")}
        onOptions={() => navigateToMeta("options")}
        isTalentsLocked={!finishedRunCharacters.includes("knight")}
        isHomesteadLocked={!finishedRunCharacters.includes("knight")}
        {...(returnToRunTarget
          ? {
              onReturnToRun: returnToRun,
              returnToRunLabel: resolveReturnToRunLabel(returnToRunTarget),
            }
          : {})}
        {...(renderedScreen === "battle" ? { onEndRun: run.handleEndRun } : {})}
        {...(renderedScreen === "labyrinth-map" ? { onEndRun: run.handleLabyrinthEndRun } : {})}
      />
    </>
  );
}

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
  const setDiscoveredBoonIds = wrapStoreSetter(
    () => appStore.getState().discoveredBoonIds,
    appStore.getState().setDiscoveredBoonIds,
  );
  const vrStageRef = useRef<HTMLDivElement>(null);
  const initialLoadReady = useInitialLoadReady({ imageUrls: allGameArt });
  useAppDisplayEffects({ displayMode, uiScale, brightness, stageRef: vrStageRef });
  useGlobalErrorHandlers();

  const homesteadEffects = useHomesteadStore((s) => s.effects);

  function handleMarkDifficultyCompleted(characterId: CharacterId, difficultyId: DifficultyId) {
    const prev = appStore.getState().completedDifficulties;
    const current = prev[characterId] ?? [];
    if (current.includes(difficultyId)) return;
    appStore.getState().setCompletedDifficulties({ ...prev, [characterId]: [...current, difficultyId] });
  }

  const { frameStyle, stageStyle, aspectMode, stagePixelRatio } = useVirtualResolution(selectedAspectRatio, false);
  const screen = useActiveRunScreenValue();
  useAppAudioEffects({ masterVol, musicVol, sfxVol, muteInBackground, screen });

  const saveBlockedByNewerVersion =
    saveLoadStatus.kind === "unsupported-newer-schema" || saveLoadStatus.kind === "unsupported-newer-content";

  return (
    <ErrorBoundary label={screen}>
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="relative" style={frameStyle}>
          <RunControllerProvider
            initialActiveRun={initialSave.activeRun}
            initialTalentXP={initialSave.talentXP}
            initialUnlockedTalents={initialSave.unlockedTalents}
            autoEndTurn={autoEndTurn}
            homesteadEffects={homesteadEffects}
            onMarkDifficultyCompleted={handleMarkDifficultyCompleted}
          >
            <AppMainContent
              saveBlockedByNewerVersion={saveBlockedByNewerVersion}
              initialLoadReady={initialLoadReady && !saveBlockedByNewerVersion}
              vrStageRef={vrStageRef}
              stagePixelRatio={stagePixelRatio}
              stageStyle={stageStyle}
              aspectMode={aspectMode}
              setDiscoveredBoonIds={setDiscoveredBoonIds}
            />
          </RunControllerProvider>
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
    bootstrapAlchemySaveState().then((result) => {
      if (!cancelled) {
        useAppStore.getState().initialize(result.data);
        useHomesteadStore.getState().initialize({
          materialInventory: result.data.materialInventory,
          constructedBuildings: result.data.constructedBuildings,
          plantedFarms: result.data.plantedFarms,
          completedResearch: result.data.completedResearch,
          bondedCompanions: result.data.bondedCompanions,
        });
        useGearStore.getState().initialize(result.data.gearInventory, result.data.gearLoadouts);
        restoreRun(result.data.activeRun, result.data.talentXP, result.data.unlockedTalents);
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
