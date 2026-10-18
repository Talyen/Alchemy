import { memo } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "zustand";
import type { BattlePresentationStore } from "../battle-presentation-store";

import type { CardGhost, GhostStyle } from "../../../shared/types";
import { BattleSceneArtwork } from "../../../shared/ui/battle-scene-artwork";
import { Surface } from "../../../shared/ui/surface";
import { cardArtFrameClass, cardArtImageClass } from "../../../shared/config/layout";

const CardGhostOverlay = memo(function CardGhostOverlay({ ghost, onDone }: { ghost: CardGhost; onDone: () => void }) {
  return (
    <div
      data-variant={ghost.variant}
      aria-hidden="true"
      className="card-ghost-overlay pointer-events-none absolute z-[80]"
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
    >
      <Surface className={cn(cardArtFrameClass, "battle-scene-piece aspect-[3/4] h-full w-full")}>
        <BattleSceneArtwork className="h-full w-full">
          <img src={ghost.art} alt="" decoding="async" className={cn("block h-full w-full", cardArtImageClass)} />
        </BattleSceneArtwork>
      </Surface>
    </div>
  );
});

export function CardGhostLayer({ presentation }: { presentation: BattlePresentationStore }) {
  const cardGhosts = useStore(presentation, (s) => s.cardGhosts);
  const removeCardGhost = useStore(presentation, (s) => s.removeCardGhost);
  return (
    <>
      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => removeCardGhost(ghost.id)} />
      ))}
    </>
  );
}
