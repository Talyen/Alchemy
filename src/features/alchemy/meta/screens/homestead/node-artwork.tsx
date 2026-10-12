import { ArrowUp, Check, LockKeyhole } from "lucide-react";
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
  showAvailability = false,
}: {
  node: HomesteadNodeModel;
  onInspect?: (() => void) | undefined;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  showAvailability?: boolean;
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
          showAvailability && (node.affordable || complete || !node.discovered) ? (
            <span className="pointer-events-none absolute right-3 bottom-3 z-20 drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
              {node.affordable ? (
                <ArrowUp className="h-6 w-6 text-gold-pale" aria-label={`${node.action} available`} />
              ) : complete ? (
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
        <PortaledTooltip triggerRef={wrapperRef} visible={visible} placement="side-end">
          <TooltipHeader>{node.title}</TooltipHeader>
          {node.discovered ? (
            <>
              <TooltipSubheader className="mt-1">
                {node.companion ? "Bond" : "Level"} {node.level}/{node.maxLevel}
              </TooltipSubheader>
              <ArtworkBenefits
                title={node.companion ? "Abilities" : node.level === 0 ? "On build" : "Bonuses"}
                lines={node.bonuses}
              />
              <ArtworkBenefits
                title={node.level === 0 ? "Production on build" : "Production"}
                lines={node.production}
              />
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
    <section aria-label={title} className="mt-3">
      <TooltipSubheader className="mt-0">{title}</TooltipSubheader>
      <TooltipBody className="space-y-1">
        {lines.map((line, index) => (
          <p key={index}>{renderTextWithMaterials(line)}</p>
        ))}
      </TooltipBody>
    </section>
  );
}
