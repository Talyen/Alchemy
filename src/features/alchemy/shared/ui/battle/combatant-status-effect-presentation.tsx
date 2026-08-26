// Continuous stun/freeze overlay for combatant portraits and hand cards (Trinket parity).
import { type ReactNode, useLayoutEffect, useRef } from "react";

import type { ActiveCcKeyword } from "@/features/alchemy/shared/utils";
import { startCombatantStatusEffectLoop } from "@/lib/animation/combatant-status-effect-loop";
import { cn } from "@/lib/utils";

interface CombatantStatusEffectPresentationProps {
  keyword: ActiveCcKeyword | null;
  children: ReactNode;
  className?: string;
}

export function CombatantStatusEffectPresentation({
  keyword,
  children,
  className,
}: CombatantStatusEffectPresentationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wobbleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wobbleNode = wobbleRef.current;
    if (!keyword) {
      if (wobbleNode) wobbleNode.style.transform = "";
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const stop = startCombatantStatusEffectLoop({
      canvas,
      kind: keyword,
      onFrame: ({ wobbleDegrees }) => {
        const node = wobbleRef.current;
        if (!node) return;
        node.style.transform = wobbleDegrees !== 0 ? `rotate(${wobbleDegrees}deg)` : "";
      },
    });

    return () => {
      stop();
      if (wobbleNode) wobbleNode.style.transform = "";
    };
  }, [keyword]);

  if (!keyword) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)} data-testid="combatant-status-effect">
      <div ref={wobbleRef} className="relative h-full w-full">
        {children}
      </div>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-20 h-full w-full rounded-[inherit]"
        aria-hidden
      />
    </div>
  );
}
