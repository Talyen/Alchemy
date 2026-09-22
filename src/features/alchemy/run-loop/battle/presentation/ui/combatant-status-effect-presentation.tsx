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
    <div className={cn("relative rounded-shell-hero", className)} data-testid="combatant-status-effect">
      <div ref={wobbleRef} className="relative h-full w-full">
        {children}
        <div
          className="pointer-events-none absolute inset-px z-20 overflow-hidden rounded-[calc(var(--radius-shell-hero)-1px)]"
          data-testid="combatant-status-effect-clip"
          aria-hidden
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </div>
  );
}
