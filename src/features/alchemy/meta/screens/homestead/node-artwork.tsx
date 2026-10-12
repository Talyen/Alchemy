import { Check, LockKeyhole, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { cardInteractiveGlowClass } from "../../../shared/config";
import { Surface } from "../../../shared/ui/surface";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";
import { PortaledTooltip } from "../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../shared/ui/tooltips/tooltip-panel";
import { useHoverVisible } from "../../../shared/ui/use-hover-visible";
import { renderTextWithMaterials } from "./helpers";
import { type HomesteadNodeModel } from "./node-model";

export function HomesteadNodeArtwork({
  node,
  inventory,
  saving,
  awaitingProgress,
  onPurchase,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  saving: boolean;
  awaitingProgress: boolean;
  onPurchase: () => void;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  const complete = node.level >= node.maxLevel;
  const canPurchase = node.affordable && !saving && !awaitingProgress;
  const materials = MATERIAL_IDS.filter((material) => (node.cost?.[material] ?? 0) > 0);
  const costLabel = materials.map((material) => `${node.cost![material]} ${materialLabels[material]}`).join(", ");
  return (
    <>
      <Surface
        as="button"
        buttonRef={triggerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocusCapture}
        onBlur={onBlurCapture}
        onClick={() => {
          if (canPurchase) onPurchase();
        }}
        ariaLabel={
          saving
            ? `Saving ${node.title}`
            : node.cost
              ? `${node.action} ${node.title} for ${costLabel}`
              : `View ${node.title}`
        }
        ariaDisabled={!canPurchase}
        className={cn(
          "card-art-frame card-interactive-no-glow block w-full rounded-shell-hero border border-border/80 bg-black shadow-md focus-visible:outline-none",
          cardInteractiveGlowClass,
          canPurchase ? "homestead-node-affordable" : "cursor-default",
        )}
        overlay={
          saving ? (
            <span
              role="status"
              className="pointer-events-none absolute inset-x-0 bottom-3 z-20 text-center text-sm text-foreground"
            >
              <span className="rounded-full bg-black/80 px-3 py-1">Saving…</span>
            </span>
          ) : complete || !node.discovered ? (
            <span className="pointer-events-none absolute right-3 bottom-3 z-20 drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
              {complete ? (
                <Check className="h-5 w-5 text-foreground/80" aria-label={node.companion ? "Max bond" : "Complete"} />
              ) : (
                <LockKeyhole className="h-5 w-5 text-foreground/80" aria-label="Undiscovered" />
              )}
            </span>
          ) : null
        }
      >
        <img
          src={node.art}
          alt={node.title}
          draggable={false}
          className={cn(
            "block h-auto w-full",
            !node.discovered ? "opacity-45 grayscale" : node.level === 0 && "opacity-60 grayscale",
          )}
        />
      </Surface>
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        <TooltipHeader className="mb-0 flex items-center justify-between gap-3">
          <span>{node.title}</span>
          {node.discovered && (
            <span
              role="img"
              aria-label={`${node.companion ? "Bond" : "Level"} ${node.level} of ${node.maxLevel}`}
              className="inline-flex shrink-0 items-center gap-0.5"
            >
              {Array.from({ length: node.maxLevel }, (_, index) => (
                <Star
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5",
                    index < node.level ? "fill-gold-light text-gold-light" : "text-muted-foreground/40",
                  )}
                />
              ))}
            </span>
          )}
        </TooltipHeader>
        {node.discovered ? (
          <>
            <TooltipBody className={cn("mt-2 space-y-1", node.level === 0 && "opacity-60 grayscale")}>
              {node.level === 0 && <span className="sr-only">First-tier bonuses, inactive until purchased</span>}
              {[...node.bonuses, ...node.production].map((line, index) => (
                <p key={index} className="min-h-6 leading-6">
                  {renderTextWithMaterials(line)}
                </p>
              ))}
            </TooltipBody>
            {node.cost && (
              <div
                role="group"
                className="mt-3 flex min-h-6 items-center justify-between gap-4 text-sm leading-6"
                aria-label={`${node.action} cost: ${costLabel}`}
              >
                <span className="text-muted-foreground">{node.action}</span>
                <span className="inline-flex items-center gap-3" aria-hidden="true">
                  {materials.map((material) => (
                    <span
                      key={material}
                      className={cn(
                        "inline-flex items-center gap-1.5 tabular-nums",
                        !saving && inventory[material] < node.cost![material] && "text-destructive",
                      )}
                    >
                      <HomesteadResourceArtwork resource={material} alt="" />
                      <span>{node.cost![material]}</span>
                    </span>
                  ))}
                </span>
              </div>
            )}
            {!node.affordable && node.cost && !saving && (
              <p className="mt-2 text-sm text-muted-foreground">More materials needed</p>
            )}
          </>
        ) : (
          <TooltipBody className="mt-2">Discover this Companion during a Run.</TooltipBody>
        )}
      </PortaledTooltip>
    </>
  );
}
