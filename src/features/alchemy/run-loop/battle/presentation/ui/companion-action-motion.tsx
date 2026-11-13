import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { ATTACK_LUNGE_DURATION_MS, CAST_BRACE_DURATION_MS } from "@/lib/game-constants";
import type { CompanionPlaybackCue } from "../../companion-presentation";

const classes = ["animate-attack-lunge", "animate-cast-brace", "companion-action-highlight"];

/** Each resolved action restarts only the companion's own frame, including on summon. */
export function CompanionActionMotion({ cue, children }: { cue: CompanionPlaybackCue | null; children: ReactNode }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPreference();
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    // Consecutive identical actions can reuse a completed CSSAnimation object.
    // Cancel that instance before rebuilding the class so each beat has a fresh timeline.
    for (const animation of node.getAnimations?.() ?? []) animation.cancel();
    node.classList.remove(...classes);
    if (cue) {
      void node.offsetWidth;
      node.classList.add(
        reduced ? "companion-action-highlight" : cue.kind === "attack" ? "animate-attack-lunge" : "animate-cast-brace",
      );
    }
    return () => node.classList.remove(...classes);
  }, [cue, reduced]);
  return (
    <div
      ref={nodeRef}
      className="relative origin-bottom rounded-shell-hero"
      data-testid="companion-action-motion"
      data-companion-action={cue?.kind}
      data-companion-action-sequence={cue?.sequence}
      style={
        {
          "--attack-aim": 1,
          "--attack-lunge-ms": `${ATTACK_LUNGE_DURATION_MS}ms`,
          "--cast-brace-ms": `${CAST_BRACE_DURATION_MS}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
