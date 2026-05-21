// Absolute card ghost overlay for draw, discard, activate, and play-travel animations.
// Depends on captured card rect animation data and CSS keyframe classes.
// Used by BattleScreen animation overlays.
import { cn } from "@/lib/utils";

import type { CardGhost, GhostStyle } from "../types";

export function CardGhostOverlay({ ghost, onDone }: { ghost: CardGhost; onDone: () => void }) {
  // Ghosts use viewport rects captured before hand/battle state changes. CSS variables carry
  // travel distance, rotation, and scale into keyframes so React does not animate layout.
  return (
    <img
      src={ghost.art}
      alt=""
      aria-hidden="true"
      className={cn(
        "card-ghost-overlay pointer-events-none absolute z-[80] rounded-[30px] bg-black object-cover",
        ghost.variant === "draw-in" ? "card-ghost-draw-in" : null,
        ghost.variant === "discard-out" ? "card-ghost-discard-out" : null,
        ghost.variant === "activate" ? "card-ghost-activate" : null,
        ghost.variant === "play-travel" ? "card-ghost-play-travel" : null,
      )}
      onAnimationEnd={onDone}
      style={
        {
          left: ghost.rect.x,
          top: ghost.rect.y,
          width: ghost.rect.width,
          height: ghost.rect.height,
          animationDelay: `${ghost.delay}ms`,
          "--ghost-rotation": `${ghost.rotation}deg`,
          "--ghost-travel-x": ghost.travel ? `${ghost.travel.x}px` : undefined,
          "--ghost-travel-y": ghost.travel ? `${ghost.travel.y}px` : undefined,
          "--ghost-scale": ghost.travel ? `${ghost.travel.scale}` : undefined,
        } as GhostStyle
      }
    />
  );
}
