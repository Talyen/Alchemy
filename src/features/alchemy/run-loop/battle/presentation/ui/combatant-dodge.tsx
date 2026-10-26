import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from "react";

import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { COMBAT_DODGE_DURATION_MS } from "@/lib/game-constants";

const REST = "translate(0, 0) rotateY(0deg) rotate(0deg) scale(1)";

export function CombatantDodge({
  token,
  side,
  isDead,
  children,
}: {
  token: number;
  side: "player" | "enemy";
  isDead: boolean;
  children: ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const previousToken = useRef(token);
  const reducedMotion = useReducedMotionPreference();

  useLayoutEffect(() => {
    const previous = previousToken.current;
    previousToken.current = token;
    const node = nodeRef.current;
    if (!node || reducedMotion || isDead || token <= previous) return;

    const animation = node.animate(
      [
        { transform: REST, offset: 0, easing: "cubic-bezier(.28, 0, .22, 1)" },
        {
          transform:
            "translate(calc(var(--dodge-direction) * 8px * var(--content-scale, 1)), calc(12px * var(--content-scale, 1))) rotateY(calc(var(--dodge-direction) * 6deg)) rotate(calc(var(--dodge-direction) * 3deg)) scale(.985)",
          offset: 0.42,
          easing: "cubic-bezier(.42, 0, .3, 1)",
        },
        { transform: REST, offset: 1 },
      ],
      { duration: COMBAT_DODGE_DURATION_MS, easing: "linear" },
    );
    return () => animation.cancel();
  }, [token, reducedMotion, isDead]);

  return (
    <div
      className="[perspective:calc(650px*var(--content-scale,1))]"
      style={{ "--dodge-direction": side === "enemy" ? 1 : -1 } as CSSProperties}
    >
      <div ref={nodeRef} className="[transform-origin:50%_90%]" data-testid="combatant-dodge">
        {children}
      </div>
    </div>
  );
}
