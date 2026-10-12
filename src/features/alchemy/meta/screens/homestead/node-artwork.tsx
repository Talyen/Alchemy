import { Check, LockKeyhole, Star } from "lucide-react";
import { type Ref } from "react";
import { TOOLTIP_FADE_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass } from "../../../shared/config";
import { Surface } from "../../../shared/ui/surface";
import { useHoverVisible } from "../../../shared/ui/use-hover-visible";
import { PortaledTooltip } from "../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "../../../shared/ui/tooltips/tooltip-panel";
import { renderTextWithMaterials } from "./helpers";
import { type HomesteadNodeModel } from "./node-model";

function HomesteadArtwork({ node }: { node: HomesteadNodeModel }) {
  return (
    <img
      src={node.art}
      alt={node.title}
      draggable={false}
      className={cn(
        "block h-auto w-full",
        !node.discovered ? "opacity-45 grayscale" : node.level === 0 && "opacity-60 grayscale",
      )}
    />
  );
}

export function HomesteadNodeArtwork({
  node,
  onInspect,
  buttonRef,
  showStatus = false,
}: {
  node: HomesteadNodeModel;
  onInspect?: (() => void) | undefined;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  showStatus?: boolean;
}) {
  const complete = node.level >= node.maxLevel;
  const { wrapperRef, visible, showPopup, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible(
    { holdMs: TOOLTIP_FADE_MS, focusWithinGuard: true },
  );
  return (
    <div
      ref={wrapperRef}
      className="group relative w-full"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <Surface
        as="button"
        buttonRef={buttonRef}
        onClick={onInspect}
        ariaLabel={
          onInspect
            ? `View ${node.title}${node.affordable ? `, ${node.action.toLowerCase()} available` : ""}`
            : `Inspect ${node.title} benefits`
        }
        className={cn(
          "card-art-frame card-interactive-no-glow block w-full rounded-shell-hero border border-border/80 bg-black shadow-md focus-visible:outline-none",
          cardInteractiveGlowClass,
        )}
        overlay={
          showStatus && (complete || !node.discovered) ? (
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
        <HomesteadArtwork node={node} />
      </Surface>
      {showPopup && (
        <PortaledTooltip triggerRef={wrapperRef} visible={visible}>
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
              {node.level === 0 && !node.companion && (
                <TooltipSubheader className="mt-1 mb-0">On build</TooltipSubheader>
              )}
              <TooltipBody className="mt-2 space-y-1">
                <ArtworkBenefits
                  title={node.companion ? "Abilities" : node.level === 0 ? "On build" : "Bonuses"}
                  lines={node.bonuses}
                />
                <ArtworkBenefits
                  title={node.level === 0 ? "Production on build" : "Production"}
                  lines={node.production}
                />
              </TooltipBody>
            </>
          ) : (
            <TooltipBody>Discover this Companion during a Run.</TooltipBody>
          )}
        </PortaledTooltip>
      )}
    </div>
  );
}

function ArtworkBenefits({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-1">
      {lines.map((line, index) => (
        <p key={index} className="min-h-6 leading-6">
          {renderTextWithMaterials(line)}
        </p>
      ))}
    </section>
  );
}
