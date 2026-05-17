// Battle presentation screen for actors, hand fan, piles, ghosts, wish choices, and menu entry.
// Driven by useBattleController; focused child modules own the layout slices.
import { useMemo, type MouseEvent, type MutableRefObject } from "react";
import type { BattleCard } from "@/lib/game-data";
import { CardGhostOverlay } from "../components";
import { BattleActors } from "./battle-screen/actors";
import { BattleBottomBar } from "./battle-screen/controls";
import { WishOverlay } from "./battle-screen/wish-overlay";
import type {
  BattleActionsProps,
  BattleFeedbackProps,
  BattleHoverProps,
  BattleRefsProps,
  BattleScreenState,
} from "./battle-screen/types";
import { useBattleStore } from "../stores/battle-store";
import { useScreenStore } from "../stores/screen-store";
import type { StatusChip } from "../types";

type BattleScreenProps = {
  heroArt: string;
  playerName: string;
  isMobileLandscape: boolean;
  aspectMode: "standard" | "narrow" | "ultrawide";
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard) => void;
  onRemoveCardGhost: (id: string) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
};

export function BattleScreen(props: BattleScreenProps) {
  const {
    heroArt,
    playerName,
    isMobileLandscape,
    aspectMode,
    handCardRefs,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    onCardClick,
    onOpenMenu,
    onWishChoice,
    onRemoveCardGhost,
    onSkipCombatDevMode,
    onEndTurn,
  } = props;

  const battleState = useBattleStore((s) => s.battleState);
  const cardGhosts = useBattleStore((s) => s.cardGhosts);
  const floatingCombatTexts = useBattleStore((s) => s.floatingCombatTexts);
  const enemyShaking = useBattleStore((s) => s.enemyShaking);
  const playerShaking = useBattleStore((s) => s.playerShaking);
  const companionShaking = useBattleStore((s) => s.companionShaking);
  const shimmerState = useBattleStore((s) => s.shimmerState);
  const hoveredCardId = useScreenStore((s) => s.hoveredCardId);
  const activeLabyrinthModifiers = useScreenStore((s) => s.activeLabyrinthModifiers);

  const playerStatusChips = useMemo<StatusChip[]>(() => {
    if (!battleState.playerStatuses) return [];
    return (Object.keys(battleState.playerStatuses) as Array<keyof typeof battleState.playerStatuses>)
      .filter((key) => battleState.playerStatuses[key] > 0)
      .map((key) => ({ id: key, value: battleState.playerStatuses[key] }));
  }, [battleState.playerStatuses]);

  const enemyStatusChips = useMemo<StatusChip[]>(() => {
    if (!battleState.enemyStatuses) return [];
    return (Object.keys(battleState.enemyStatuses) as Array<keyof typeof battleState.enemyStatuses>)
      .filter((key) => battleState.enemyStatuses[key] > 0)
      .map((key) => ({ id: key, value: battleState.enemyStatuses[key] }));
  }, [battleState.enemyStatuses]);

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
  };

  const { battleSceneRef: sceneRef } = refs;
  const { onRemoveCardGhost: removeGhost } = actions;
  const requiredView = { ...view, isMobileLandscape, aspectMode };

  return (
    <div
      ref={sceneRef}
      data-testid="battle-scene"
      className="relative h-full w-full overflow-hidden [container-type:size]"
    >
      <BattleActors view={requiredView} hover={hover} feedback={feedback} refs={refs} />

      <BattleBottomBar view={requiredView} hover={hover} refs={refs} actions={actions} />

      {battleState.wishOptions ? (
        <WishOverlay battleState={battleState} hover={hover} actions={actions} isMobileLandscape={isMobileLandscape} />
      ) : null}

      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => removeGhost(ghost.id)} />
      ))}
    </div>
  );
}
