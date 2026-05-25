// Battle presentation screen for actors, hand fan, piles, ghosts, wish choices, and menu entry.
// Driven by useBattleController; focused child modules own the layout slices.
import { useMemo, type MouseEvent, type MutableRefObject } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { CardTransfer } from "../../types";
import { CardGhostOverlay } from "../../components";
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
import { getEnemyStatusChips, getPlayerStatusChips } from "../../utils";
import { BackgroundParticles } from "../../ui/background-particles";

type BattleScreenProps = {
  heroArt: string;
  playerName: string;
  isMobileLandscape: boolean;
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
  onWishChoice: (card: BattleCard) => void;
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
    isMobileLandscape,
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

  const battleState = useBattleStore((s) => s.battleState);
  const isBossBattle = battleState.currentEnemy.enemyType === "boss";
  const particleAlpha = isBossBattle ? 2.5 : 1.7;
  const particleColors = ["rgba(255, 150, 70, X)", "rgba(255, 100, 40, X)"] as const;
  const cardGhosts = useBattleStore((s) => s.cardGhosts);
  const floatingCombatTexts = useBattleStore((s) => s.floatingCombatTexts);
  const enemyShaking = useBattleStore((s) => s.enemyShaking);
  const playerShaking = useBattleStore((s) => s.playerShaking);
  const companionShaking = useBattleStore((s) => s.companionShaking);
  const shimmerState = useBattleStore((s) => s.shimmerState);
  const hoveredCardId = useScreenStore((s) => s.hoveredCardId);
  const activeLabyrinthModifiers = useScreenStore((s) => s.activeLabyrinthModifiers);

  const playerStatusChips = useMemo(() => getPlayerStatusChips(battleState), [battleState]);
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
    battleState: battleState as BattleScreenState,
    heroArt,
    playerName,
    isMobileLandscape,
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
    isDevMode:
      import.meta.env.DEV ||
      (typeof localStorage !== "undefined" && localStorage.getItem("alchemy-dev-mode") === "true"),
  };

  const { battleSceneRef: sceneRef } = refs;
  const { onRemoveCardGhost: removeGhost } = actions;
  const requiredView = { ...view, isMobileLandscape, aspectMode };

  return (
    <PageLayout>
      <div className="alchemy-shell relative flex w-full max-w-[100rem] flex-1 flex-col rounded-[28px] border border-border/80 p-7 pb-1">
        <div className="absolute inset-0 overflow-hidden rounded-[28px] pointer-events-none">
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

            {battleState.wishOptions ? (
              <WishOverlay battleState={battleState} actions={actions} isMobileLandscape={isMobileLandscape} />
            ) : null}

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
