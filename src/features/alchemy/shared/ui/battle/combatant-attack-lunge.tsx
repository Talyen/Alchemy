// Combatant attacker lunge and cast motion. Lives on its own transform node so hit shake can nest inside.
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

import { ATTACK_LUNGE_DURATION_MS, CAST_BRACE_DURATION_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

export type CombatantAttackAim = 1 | -1;

const ANIMATION_CLASSES = ["animate-attack-lunge", "animate-cast-brace"] as const;

function removeCombatantAnimations(node: HTMLElement) {
  node.classList.remove(...ANIMATION_CLASSES);
}

export function CombatantAttackLunge({
  attackToken = 0,
  castToken = 0,
  aim,
  className,
  children,
}: {
  attackToken?: number;
  castToken?: number;
  aim: CombatantAttackAim;
  className?: string;
  children: ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const prevAttackTokenRef = useRef(attackToken);
  const prevCastTokenRef = useRef(castToken);

  useEffect(() => {
    const prev = prevAttackTokenRef.current;
    prevAttackTokenRef.current = attackToken;
    if (attackToken <= prev) return;
    const node = nodeRef.current;
    if (!node) return;
    removeCombatantAnimations(node);
    void node.offsetWidth;
    node.classList.add("animate-attack-lunge");
  }, [attackToken]);

  useEffect(() => {
    const prev = prevCastTokenRef.current;
    prevCastTokenRef.current = castToken;
    if (castToken <= prev) return;
    const node = nodeRef.current;
    if (!node) return;
    removeCombatantAnimations(node);
    void node.offsetWidth;
    node.classList.add("animate-cast-brace");
  }, [castToken]);

  return (
    <div
      ref={nodeRef}
      className={cn(
        "relative origin-bottom transform-gpu will-change-transform [backface-visibility:hidden]",
        className,
      )}
      data-testid="combatant-attack-lunge"
      style={
        {
          "--attack-aim": aim,
          "--attack-lunge-ms": `${ATTACK_LUNGE_DURATION_MS}ms`,
          "--cast-brace-ms": `${CAST_BRACE_DURATION_MS}ms`,
        } as CSSProperties
      }
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        removeCombatantAnimations(event.currentTarget);
      }}
    >
      {children}
    </div>
  );
}
