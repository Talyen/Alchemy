import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { CombatTextRail } from "@/features/alchemy/run-loop/battle/presentation/ui/combat-text";
import type { BattleRefs, CardRect, CombatTextBurst, ReactionAnnouncement } from "@/features/alchemy/shared/types";
import { getBattleSceneLocalRect, viewportRectToBattleSceneRect, type BattleSceneLocalRect } from "../controller-utils";
import { useStore } from "zustand";
import type { BattlePresentationStore } from "../battle-presentation-store";

export function CombatTextLayer({ refs, presentation }: { refs: BattleRefs; presentation: BattlePresentationStore }) {
  const bursts = useStore(presentation, (state) => state.floatingCombatBursts);
  const reactions = useStore(presentation, (state) => state.reactionAnnouncements);
  const targetBursts = useMemo(() => {
    const targets: Record<CombatTextBurst["target"], CombatTextBurst[]> = { player: [], enemy: [] };
    for (const burst of bursts) targets[burst.target].push(burst);
    return targets;
  }, [bursts]);
  const playerLayerRef = useRef<HTMLDivElement>(null);
  const enemyLayerRef = useRef<HTMLDivElement>(null);
  const playerReactions = reactions.filter((entry) => entry.target === "player");
  const enemyReactions = reactions.filter((entry) => entry.target === "enemy");
  const playerActive = targetBursts.player.length > 0 || playerReactions.length > 0;
  const enemyActive = targetBursts.enemy.length > 0 || enemyReactions.length > 0;
  const { playerPanelRef, enemyPanelRef, battleSceneRef } = refs;

  useLayoutEffect(() => {
    if (!playerActive && !enemyActive) return;
    let previousPlayer: CardRect | null = null;
    let previousEnemy: CardRect | null = null;
    let frame: number | null = null;
    // ResizeObserver cannot follow ancestor transforms (lunge, shake, Companion shifts).
    // Read both portraits against one scene snapshot before writing either overlay,
    // so a layer resize cannot force another layout during the same frame.
    const measure = () => {
      const scene = battleSceneRef.current;
      const sceneRect = scene?.isConnected ? getBattleSceneLocalRect(scene) : null;
      const nextPlayer = playerActive ? measureAnchor(playerPanelRef.current, sceneRect) : null;
      const nextEnemy = enemyActive ? measureAnchor(enemyPanelRef.current, sceneRect) : null;
      previousPlayer = positionLayer(playerLayerRef.current, nextPlayer, previousPlayer);
      previousEnemy = positionLayer(enemyLayerRef.current, nextEnemy, previousEnemy);
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [playerPanelRef, enemyPanelRef, battleSceneRef, playerActive, enemyActive]);

  return (
    <>
      <CombatTextTarget layerRef={playerLayerRef} bursts={targetBursts.player} reactions={playerReactions} />
      <CombatTextTarget layerRef={enemyLayerRef} bursts={targetBursts.enemy} reactions={enemyReactions} />
    </>
  );
}

function measureAnchor(anchor: HTMLDivElement | null, sceneRect: BattleSceneLocalRect | null): CardRect | null {
  if (!anchor?.isConnected || !sceneRect) return null;
  const rect = anchor.getBoundingClientRect();
  return viewportRectToBattleSceneRect(
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    sceneRect,
  );
}

function positionLayer(
  layer: HTMLDivElement | null,
  next: CardRect | null,
  previous: CardRect | null,
): CardRect | null {
  if (!layer) return previous;
  if (!previous) layer.style.visibility = "hidden";
  if (
    !next ||
    next.width <= 0 ||
    next.height <= 0 ||
    !Number.isFinite(next.x) ||
    !Number.isFinite(next.y) ||
    !Number.isFinite(next.width) ||
    !Number.isFinite(next.height)
  )
    return previous;

  if (!previous || next.x !== previous.x || next.y !== previous.y)
    layer.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
  const width = previous && Math.abs(next.width - previous.width) < 1 ? previous.width : next.width;
  const height = previous && Math.abs(next.height - previous.height) < 1 ? previous.height : next.height;
  if (!previous || width !== previous.width) layer.style.width = `${width}px`;
  if (!previous || height !== previous.height) layer.style.height = `${height}px`;
  if (!previous) layer.style.visibility = "visible";
  // Compare later measurements with the applied size so subpixel changes accumulate.
  return { ...next, width, height };
}

function CombatTextTarget({
  layerRef,
  bursts,
  reactions,
}: {
  layerRef: RefObject<HTMLDivElement | null>;
  bursts: CombatTextBurst[];
  reactions: ReactionAnnouncement[];
}) {
  if (bursts.length === 0 && reactions.length === 0) return null;
  // Portraits establish their own transform stacking contexts. Text must sit above card flights in the scene.
  return (
    <div
      ref={layerRef}
      data-testid="combat-text-layer"
      className="pointer-events-none absolute top-0 left-0 z-[100] will-change-transform"
    >
      <CombatTextRail bursts={bursts} reactions={reactions} />
    </div>
  );
}
