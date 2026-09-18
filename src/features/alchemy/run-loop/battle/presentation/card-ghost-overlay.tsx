import { memo } from "react";
import { cn } from "@/lib/utils";
import { useBattlePresentationStore } from "../battle-presentation-store";

import type { CardGhost, GhostStyle } from "../../../shared/types";

const CardGhostOverlay = memo(function CardGhostOverlay({ ghost, onDone }: { ghost: CardGhost; onDone: () => void }) {
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
});

export function CardGhostLayer() {
  const cardGhosts = useBattlePresentationStore((s) => s.cardGhosts);
  const removeCardGhost = useBattlePresentationStore((s) => s.removeCardGhost);
  return (
    <>
      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => removeCardGhost(ghost.id)} />
      ))}
    </>
  );
}
