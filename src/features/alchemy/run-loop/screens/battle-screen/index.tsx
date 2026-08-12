// Battle presentation screen for actors, hand fan, piles, ghosts, wish choices, and menu entry.
// Driven by useBattleController; focused child modules own the layout slices.
import { useMemo, type MouseEvent } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { CardTransfer } from "../../../shared/types";
import { CardGhostOverlay } from "../../../shared/ui/card-ghost-overlay";
import { CardTransferOverlay } from "./card-transfer-overlay";
import { BattleActors } from "./actors";
import { BattleBottomBar } from "./controls";
import { HamburgerTrigger, PageLayout } from "../../../shared/ui/shared-ui";
import { WishOverlay } from "./wish-overlay";
import type { BattleActionsProps, BattleFeedbackProps, BattleRefsProps, BattleScreenData } from "./types";
import { getEnemyStatusChips, getPlayerStatusChips } from "../../../shared/utils";
import { isAlchemyDevBuild } from "../../../shared/utils/dev-mode";
import { BackgroundParticles } from "../../../shared/ui/background-particles";
import { getScreenParticleConfig } from "@/app/screen-particle-config";
import { useBattlePresentationStore } from "../../battle/battle-presentation-store";

function CardGhostLayer() {
  const cardGhosts = useBattlePresentationStore((s) => s.cardGhosts);
  const removeCardGhost = useBattlePresentationStore((s) => s.removeCardGhost);
  return (
    <>
      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => removeCardGhost(ghost.id)} />
      ))}
    </>
  );
}

interface BattleScreenProps {
  battleScreenData: BattleScreenData;
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  refs: BattleRefsProps;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard | null) => void;
  playableHandCardKeys: Set<string>;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
}

export function BattleScreen(props: BattleScreenProps) {
  const {
    battleScreenData,
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    refs,
    onCardClick,
    onOpenMenu,
    onWishChoice,
    onSkipCombatDevMode,
    onEndTurn,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    playableHandCardKeys,
  } = props;

  const { battleState, displayOverrides, revealedCardKeys, activeLabyrinthModifiers } = battleScreenData;

  const displayState = useMemo(() => ({ ...battleState, ...displayOverrides }), [battleState, displayOverrides]);

  const isBossBattle = battleState.currentEnemy.enemyType === "boss";
  const { particleColors, particleAlphaMultiplier } = getScreenParticleConfig("battle", isBossBattle);
  const particleAlpha = particleAlphaMultiplier ?? 1;

  const playerStatusChips = useMemo(() => getPlayerStatusChips(displayState), [displayState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);

  const view = useMemo(
    () => ({
      battleState: displayState,
      heroArt,
      playerName,
      aspectMode,
      stagePixelRatio,
    }),
    [displayState, heroArt, playerName, aspectMode, stagePixelRatio],
  );

  const feedback: BattleFeedbackProps = useMemo(
    () => ({
      playerStatusChips,
      enemyStatusChips,
      activeLabyrinthModifiers,
    }),
    [playerStatusChips, enemyStatusChips, activeLabyrinthModifiers],
  );

  const isDev = isAlchemyDevBuild();
  const actions: BattleActionsProps = useMemo(
    () => ({
      onCardClick,
      onOpenMenu,
      onWishChoice,
      onSkipCombatDevMode,
      onEndTurn,
      hiddenHandCardKeys,
      cardTransferInProgress,
      playableHandCardKeys,
      revealedCardKeys,
      isDevMode: isDev,
    }),
    [
      onCardClick,
      onOpenMenu,
      onWishChoice,
      onSkipCombatDevMode,
      onEndTurn,
      hiddenHandCardKeys,
      cardTransferInProgress,
      playableHandCardKeys,
      revealedCardKeys,
      isDev,
    ],
  );

  const { battleSceneRef: sceneRef } = refs;

  return (
    <PageLayout>
      <div className="alchemy-shell relative flex w-full max-w-[100rem] flex-1 flex-col rounded-shell-screen border border-border/80 p-7 pb-1">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-shell-screen">
          <BackgroundParticles
            variant="embers"
            {...(particleColors ? { colors: particleColors } : {})}
            alphaMultiplier={particleAlpha}
          />
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="absolute top-0 right-0 z-30">
            <HamburgerTrigger onClick={actions.onOpenMenu} label="Open battle menu" />
          </div>

          <div
            ref={sceneRef}
            data-testid="battle-scene"
            className="[container-type:size] absolute inset-0 overflow-hidden"
          >
            <BattleActors view={view} feedback={feedback} refs={refs} />

            <BattleBottomBar view={view} refs={refs} actions={actions} />

            {battleState.wishOptions ? (
              <WishOverlay
                key={battleState.wishOptions.map((card) => card.id).join("-")}
                battleState={displayState}
                actions={actions}
              />
            ) : null}

            <CardGhostLayer />

            {cardTransfers.map((transfer) => (
              <CardTransferOverlay key={transfer.id} transfer={transfer} />
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
