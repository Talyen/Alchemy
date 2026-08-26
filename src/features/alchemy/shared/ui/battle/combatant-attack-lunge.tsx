// Portrait-only attacker lunge. Lives on its own transform node so hit shake can nest inside.
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

import { ATTACK_LUNGE_DURATION_MS } from "@/lib/game-constants";

export type CombatantAttackAim = 1 | -1;

export function CombatantAttackLunge({
  attackToken = 0,
  aim,
  children,
}: {
  attackToken?: number;
  aim: CombatantAttackAim;
  children: ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const prevTokenRef = useRef(attackToken);

  useEffect(() => {
    const prev = prevTokenRef.current;
    prevTokenRef.current = attackToken;
    if (attackToken <= prev) return;
    const node = nodeRef.current;
    if (!node) return;
    node.classList.remove("animate-attack-lunge");
    void node.offsetWidth;
    node.classList.add("animate-attack-lunge");
  }, [attackToken]);

  return (
    <div
      ref={nodeRef}
      className="relative"
      data-testid="combatant-attack-lunge"
      style={
        {
          "--attack-aim": aim,
          "--attack-lunge-ms": `${ATTACK_LUNGE_DURATION_MS}ms`,
        } as CSSProperties
      }
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        event.currentTarget.classList.remove("animate-attack-lunge");
      }}
    >
      {children}
    </div>
  );
}
