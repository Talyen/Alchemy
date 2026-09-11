import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { CombatTextRail } from "@/features/alchemy/shared/ui/battle/combat-text";
import type { BattleRefs, CardRect } from "@/features/alchemy/shared/types";
import { defaultMeasureElementRect } from "../controller-utils";
import { useBattlePresentationStore } from "../battle-presentation-store";

export function CombatTextLayer({ refs }: { refs: BattleRefs }) {
  return (
    <>
      <CombatTextTarget target="player" anchorRef={refs.playerPanelRef} sceneRef={refs.battleSceneRef} />
      <CombatTextTarget target="enemy" anchorRef={refs.enemyPanelRef} sceneRef={refs.battleSceneRef} />
    </>
  );
}

function CombatTextTarget({
  target,
  anchorRef,
  sceneRef,
}: {
  target: "player" | "enemy";
  anchorRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<HTMLDivElement | null>;
}) {
  const allBursts = useBattlePresentationStore((state) => state.floatingCombatBursts);
  const bursts = useMemo(() => allBursts.filter((burst) => burst.target === target), [allBursts, target]);
  const layerRef = useRef<HTMLDivElement>(null);
  const active = bursts.length > 0;

  useLayoutEffect(() => {
    if (!active) return;
    const anchor = anchorRef.current;
    const scene = sceneRef.current;
    const layer = layerRef.current;
    if (!anchor || !scene || !layer) return;
    let previous: CardRect | null = null;
    let frame: number;
    // ResizeObserver cannot follow ancestor transforms (lunge, shake, Companion shifts).
    // Update only the overlay geometry, without rerendering or restarting its bursts.
    const measure = () => {
      const next = defaultMeasureElementRect(anchor, scene);
      if (
        next &&
        (!previous ||
          next.x !== previous.x ||
          next.y !== previous.y ||
          next.width !== previous.width ||
          next.height !== previous.height)
      ) {
        layer.style.left = `${next.x}px`;
        layer.style.top = `${next.y}px`;
        layer.style.width = `${next.width}px`;
        layer.style.height = `${next.height}px`;
        previous = next;
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [anchorRef, sceneRef, active]);

  if (!active) return null;
  // Portraits establish their own transform stacking contexts. Text must sit above card flights in the scene.
  return (
    <div ref={layerRef} data-testid="combat-text-layer" className="pointer-events-none absolute z-[100]">
      <CombatTextRail bursts={bursts} />
    </div>
  );
}
