import { type ReactNode, useLayoutEffect, useRef } from "react";

import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import type { ActiveCcKeyword } from "@/features/alchemy/shared/utils";
import { startCombatantStatusEffectLoop } from "@/lib/animation/combatant-status-effect-loop";
import { cn } from "@/lib/cn";

interface CombatantStatusEffectPresentationProps {
  keyword: ActiveCcKeyword | null;
  children: ReactNode;
  className?: string;
  defeated?: boolean;
}

export function CombatantStatusEffectPresentation({
  keyword,
  children,
  className,
  defeated = false,
}: CombatantStatusEffectPresentationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wobbleRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPreference();
  const activeKeyword = defeated ? null : keyword;

  useLayoutEffect(() => {
    const wobbleNode = wobbleRef.current;
    if (!activeKeyword) {
      if (!defeated && wobbleNode) wobbleNode.style.transform = "";
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const stop = startCombatantStatusEffectLoop({
      canvas,
      kind: activeKeyword,
      onFrame: ({ wobbleDegrees }) => {
        const node = wobbleRef.current;
        if (!node) return;
        node.style.transform = wobbleDegrees !== 0 ? `rotate(${wobbleDegrees}deg)` : "";
      },
    });

    // The next live effect owns resets; defeat retains the last rendered pose.
    return stop;
  }, [activeKeyword, defeated, reducedMotion]);

  return (
    <div
      className={cn("relative rounded-shell-hero", className)}
      data-testid={activeKeyword ? "combatant-status-effect" : undefined}
    >
      <div ref={wobbleRef} className="relative h-full w-full">
        {children}
        {activeKeyword ? (
          <div
            className="pointer-events-none absolute inset-px z-20 overflow-hidden rounded-[calc(var(--radius-shell-hero)-1px)]"
            data-testid="combatant-status-effect-clip"
            aria-hidden
          >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
