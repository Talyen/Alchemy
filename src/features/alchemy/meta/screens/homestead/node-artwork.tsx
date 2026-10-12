import { Check, LockKeyhole, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { cardInteractiveGlowClass } from "../../../shared/config";
import { Surface } from "../../../shared/ui/surface";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";
import { PortaledHoverPanel } from "../../../shared/ui/tooltips/portaled-hover-panel";
import { TooltipBody, TooltipHeader } from "../../../shared/ui/tooltips/tooltip-panel";
import { renderTextWithMaterials } from "./helpers";
import { type HomesteadNodeModel } from "./node-model";

export function HomesteadNodeArtwork({
  node,
  inventory,
  open,
  pinned,
  saving,
  awaitingProgress,
  error,
  onOpen,
  onPin,
  onClose,
  onPurchase,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  open: boolean;
  pinned: boolean;
  saving: boolean;
  awaitingProgress: boolean;
  error: string | null;
  onOpen: () => void;
  onPin: () => void;
  onClose: () => void;
  onPurchase: () => void;
}) {
  const complete = node.level >= node.maxLevel;
  const materials = MATERIAL_IDS.filter((material) => (node.cost?.[material] ?? 0) > 0);
  const costLabel = materials.map((material) => `${node.cost![material]} ${materialLabels[material]}`).join(", ");
  return (
    <PortaledHoverPanel
      open={open}
      pinned={pinned}
      label={node.title}
      onOpen={onOpen}
      onPin={onPin}
      onClose={onClose}
      trigger={(triggerProps) => (
        <Surface
          {...triggerProps}
          as="button"
          ariaLabel={`View ${node.title}${node.affordable ? `, ${node.action.toLowerCase()} available` : ""}`}
          className={cn(
            "card-art-frame card-interactive-no-glow block w-full rounded-shell-hero border border-border/80 bg-black shadow-md focus-visible:outline-none",
            cardInteractiveGlowClass,
          )}
          overlay={
            complete || !node.discovered ? (
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
      )}
    >
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
          {node.level > 0 && (
            <TooltipBody className="mt-2 space-y-1">
              {[...node.bonuses, ...node.production].map((line, index) => (
                <p key={index} className="min-h-6 leading-6">
                  {renderTextWithMaterials(line)}
                </p>
              ))}
            </TooltipBody>
          )}
          {node.cost && (
            <Button
              variant="primary"
              className="mt-3 h-11 w-full gap-4 px-3 text-sm disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              onClick={onPurchase}
              disabled={saving || awaitingProgress || !node.affordable}
              aria-label={saving ? `Saving ${node.title}` : `${node.action} ${node.title} for ${costLabel}`}
              aria-describedby={!node.affordable && !saving ? `${node.id}-materials-needed` : undefined}
            >
              <span aria-live="polite">{saving ? "Saving…" : node.action}</span>
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
            </Button>
          )}
          {!node.affordable && node.cost && !saving && (
            <p id={`${node.id}-materials-needed`} className="mt-2 text-sm text-muted-foreground">
              More materials needed
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      ) : (
        <TooltipBody className="mt-2">Discover this Companion during a Run.</TooltipBody>
      )}
    </PortaledHoverPanel>
  );
}
