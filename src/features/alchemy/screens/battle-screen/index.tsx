// Battle presentation screen for actors, hand fan, piles, ghosts, wish choices, and menu entry.
// Driven by useBattleController; focused child modules own the layout slices.
import { useMemo, type MouseEvent, type MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BattleCard } from "@/lib/game-data";
import type { CardTransfer } from "../../types";
import { CardGhostOverlay } from "../../ui/card-ghost-overlay";
import { CardTransferOverlay } from "./card-transfer-overlay";
import { BattleActors } from "./actors";
import { BattleBottomBar } from "./controls";
import { HamburgerTrigger, PageLayout, ScreenHeader } from "../../ui/shared-ui";
import { WishOverlay } from "./wish-overlay";
import type {
  BattleActionsProps,
  BattleFeedbackProps,
  BattleHoverProps,
  BattleRefsProps,
  BattleScreenState,
} from "./types";
import { useBattleStore } from "../../stores/battle-store";
import { useScreenStore } from "../../stores/screen-store";
import { BATTLE_PARTICLE_ALPHA_BOSS, BATTLE_PARTICLE_ALPHA_NORMAL } from "@/lib/game-constants";
import { getEnemyStatusChips, getPlayerStatusChips, isAlchemyDevBuild } from "../../utils";
import { BackgroundParticles } from "../../ui/background-particles";

type BattleScreenProps = {
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: MutableRefObject<HTMLDivElement | null>;
  discardPileRef: MutableRefObject<HTMLDivElement | null>;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard | null) => void;
  onRemoveCardGhost: (id: string) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
};

export function BattleScreen(props: BattleScreenProps) {
  const {
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    onCardClick,
    onOpenMenu,
    onWishChoice,
    onRemoveCardGhost,
    onSkipCombatDevMode,
    onEndTurn,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
  } = props;

  const {
    battleState,
    displayOverrides,
    cardGhosts,
    floatingCombatTexts,
    enemyShaking,
    playerShaking,
    companionShaking,
    playerHurtFlashToken,
    enemyHurtFlashToken,
  } = useBattleStore(
    useShallow((s) => ({
      battleState: s.battleState,
      displayOverrides: s.displayOverrides,
      cardGhosts: s.cardGhosts,
      floatingCombatTexts: s.floatingCombatTexts,
      enemyShaking: s.enemyShaking,
      playerShaking: s.playerShaking,
      companionShaking: s.companionShaking,
      playerHurtFlashToken: s.playerHurtFlashToken,
      enemyHurtFlashToken: s.enemyHurtFlashToken,
    })),
  );

  const { shimmerState, hoveredCardId, activeLabyrinthModifiers } = useScreenStore(
    useShallow((s) => ({
      shimmerState: s.shimmerState,
      hoveredCardId: s.hoveredCardId,
      activeLabyrinthModifiers: s.activeLabyrinthModifiers,
    })),
  );

  const displayState = useMemo(() => ({ ...battleState, ...displayOverrides }), [battleState, displayOverrides]);

  const isBossBattle = battleState.currentEnemy.enemyType === "boss";
  const particleAlpha = isBossBattle ? BATTLE_PARTICLE_ALPHA_BOSS : BATTLE_PARTICLE_ALPHA_NORMAL;
  const particleColors = ["rgba(255, 150, 70, X)", "rgba(255, 100, 40, X)"] as const;

  const playerStatusChips = useMemo(() => getPlayerStatusChips(displayState), [displayState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);

  const playerCombatTexts = useMemo(
    () => floatingCombatTexts.filter((t) => t.target === "player"),
    [floatingCombatTexts],
  );
  const enemyCombatTexts = useMemo(
    () => floatingCombatTexts.filter((t) => t.target === "enemy"),
    [floatingCombatTexts],
  );

  const view = {
    battleState: displayState as BattleScreenState,
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
  };

  const hover: BattleHoverProps = {
    hoveredCardId,
    shimmerState,
  };

  const feedback: BattleFeedbackProps = {
    playerStatusChips,
    enemyStatusChips,
    playerCombatTexts,
    enemyCombatTexts,
    cardGhosts,
    playerShaking,
    enemyShaking,
    companionShaking,
    playerHurtFlashToken,
    enemyHurtFlashToken,
    activeLabyrinthModifiers,
  };

  const refs: BattleRefsProps = {
    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
  };

  const actions: BattleActionsProps = {
    onCardClick,
    onOpenMenu,
    onWishChoice,
    onRemoveCardGhost,
    onSkipCombatDevMode,
    onEndTurn,
    hiddenHandCardKeys,
    cardTransferInProgress,
    isDevMode: isAlchemyDevBuild(),
  };

  const { battleSceneRef: sceneRef } = refs;
  const { onRemoveCardGhost: removeGhost } = actions;
  const requiredView = { ...view, aspectMode };

  return (
    <PageLayout>
      <div className="alchemy-shell relative flex w-full max-w-[100rem] flex-1 flex-col rounded-shell-screen border border-border/80 p-7 pb-1">
        <div className="absolute inset-0 overflow-hidden rounded-shell-screen pointer-events-none">
          <BackgroundParticles variant="embers" colors={particleColors} alphaMultiplier={particleAlpha} />
        </div>

        <div className="relative z-10 flex flex-1 flex-col">
          <div className="relative flex w-full shrink-0 items-center justify-center">
            <ScreenHeader title="Battle" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30">
              <HamburgerTrigger onClick={actions.onOpenMenu} label="Open battle menu" />
            </div>
          </div>

          <div ref={sceneRef} data-testid="battle-scene" className="relative mt-2 flex-1 [container-type:size]">
            <BattleActors view={requiredView} hover={hover} feedback={feedback} refs={refs} />

            <BattleBottomBar view={requiredView} refs={refs} actions={actions} />

            {battleState.wishOptions ? <WishOverlay battleState={displayState} actions={actions} /> : null}

            {cardGhosts.map((ghost) => (
              <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => removeGhost(ghost.id)} />
            ))}

            {cardTransfers.map((transfer) => (
              <CardTransferOverlay key={transfer.id} transfer={transfer} />
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
