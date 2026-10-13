import { useEffect, useState, type CSSProperties } from "react";
import { HOMESTEAD_FEEDBACK } from "@/lib/game-constants/ui-motion";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { HomesteadTooltipBody } from "./node-tooltip-body";
import { Check, LockKeyhole, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { cardInteractiveGlowClass } from "../../../shared/config";
import { Surface } from "../../../shared/ui/surface";
import { PortaledTooltip } from "../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipHeader } from "../../../shared/ui/tooltips/tooltip-panel";
import { useHoverVisible } from "../../../shared/ui/use-hover-visible";
import { type HomesteadNodeModel } from "./node-model";

export function HomesteadNodeArtwork({
  node,
  inventory,
  tooltipPlacement,
  saving,
  completion,
  awaitingProgress,
  onPurchase,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  tooltipPlacement: "above" | "below";
  saving: boolean;
  completion: { sequence: number; fromLevel: number } | null;
  awaitingProgress: boolean;
  onPurchase: () => void;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  const reducedMotion = useReducedMotionPreference();
  const [seenSequence, setSeenSequence] = useState(completion?.sequence ?? 0);
  const [feedback, setFeedback] = useState<typeof completion>(null);
  const [animateTooltip, setAnimateTooltip] = useState(false);
  if ((completion?.sequence ?? 0) !== seenSequence) {
    setSeenSequence(completion?.sequence ?? 0);
    setFeedback(completion);
    setAnimateTooltip(Boolean(completion) && visible);
  }
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), HOMESTEAD_FEEDBACK.feedbackMs);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const transition = feedback !== null && animateTooltip && !reducedMotion;
  const firstPurchase = feedback?.fromLevel === 0;
  const feedbackStyle = {
    "--homestead-reveal-duration": `${HOMESTEAD_FEEDBACK.revealMs}ms`,
    "--homestead-star-duration": `${HOMESTEAD_FEEDBACK.starMs}ms`,
    "--homestead-glow-duration": `${HOMESTEAD_FEEDBACK.glowMs}ms`,
  } as CSSProperties;
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
        onMouseLeave={() => {
          setAnimateTooltip(false);
          onMouseLeave();
        }}
        onFocus={onFocusCapture}
        onBlur={() => {
          setAnimateTooltip(false);
          onBlurCapture();
        }}
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
        style={feedbackStyle}
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
          ) : feedback ? (
            <>
              {!firstPurchase && !reducedMotion && (
                <span
                  key={feedback.sequence}
                  aria-hidden="true"
                  className="homestead-upgrade-glow pointer-events-none absolute inset-0 rounded-[inherit]"
                />
              )}
            </>
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
            firstPurchase && !reducedMotion && "homestead-art-reveal",
            !node.discovered ? "opacity-45 grayscale" : node.level === 0 && "opacity-60 grayscale",
          )}
        />
        {firstPurchase && !reducedMotion && (
          <div
            key={feedback.sequence}
            aria-hidden="true"
            className="homestead-art-before pointer-events-none absolute inset-0"
          >
            <img src={node.art} alt="" draggable={false} className="block h-auto w-full opacity-60 grayscale" />
          </div>
        )}
      </Surface>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} placement={tooltipPlacement} allowFlip={false}>
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
                  key={index === node.level - 1 ? `${index}-${feedback?.sequence ?? 0}` : index}
                  aria-hidden="true"
                  style={feedbackStyle}
                  className={cn(
                    "h-3.5 w-3.5",
                    feedback && animateTooltip && !reducedMotion && index === node.level - 1 && "homestead-earned-star",
                    index < node.level ? "fill-gold-light text-gold-light" : "text-muted-foreground/40",
                  )}
                />
              ))}
            </span>
          )}
        </TooltipHeader>
        <HomesteadTooltipBody
          node={node}
          inventory={inventory}
          saving={saving}
          animate={transition}
          reducedMotion={reducedMotion}
        />
      </PortaledTooltip>
    </>
  );
}
