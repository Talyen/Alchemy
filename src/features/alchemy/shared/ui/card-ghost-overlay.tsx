import { cn } from "@/lib/utils";

import type { CardGhost, GhostStyle } from "../types";

export function CardGhostOverlay({ ghost, onDone }: { ghost: CardGhost; onDone: () => void }) {
  return (
    <img
      src={ghost.art}
      alt=""
      data-variant={ghost.variant}
      className={cn("card-ghost-overlay pointer-events-none absolute z-[80] rounded-shell-hero bg-black object-cover")}
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
