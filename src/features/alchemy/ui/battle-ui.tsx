// Reusable battle widgets for actor panels, combat text, particles, piles, companions, and mana.
// Depends on motion, canvas particle helpers, game-data keyword metadata, and shared UI styling.
// Used by BattleScreen and alchemy component barrels; combat decisions stay in controllers/lib.
import { createElement, type CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Coins, Gem } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Progress } from "@/components/ui/progress";
import { keywordDefinitions, pileDiscardArt, pileDrawArt, type KeywordId } from "@/lib/game-data";
import type { CompanionDefinition } from "@/lib/game-data";
import { animateParticles, createParticles, createStatusParticles } from "@/lib/animation/particle-burst";
import { cn } from "@/lib/utils";

import {
  battleCardWidthClass,
  cardSurfaceClass,
  keywordIcons,
  pileCardWidthClass,
  popupClassName,
  staticCardTransform,
} from "../config";
import type { BestiaryEntry } from "@/lib/game-data";
import type { FloatingCombatText, StatusChip } from "../types";
import { clearTiltFromEvent, getCombatTextColorClass, getCombatTextIcon, setTiltFromEvent } from "../utils";
import { KeywordTag } from "./keyword-tag";
import { DescriptionLines, renderColoredKeywords } from "./card-ui";
import { EnemyTooltip } from "./enemy-tooltip";
import { ShimmerOverlay } from "./shared-ui";

// Returns a token that changes briefly after a value update so numeric combat UI
// can replay a small settle animation without storing old battle state globally.
function useChangeToken(value: number | string) {
  const previousValueRef = useRef(value);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    setToken((current) => current + 1);
  }, [value]);

  return token;
}

export function CombatTextRail({ entries, side }: { entries: FloatingCombatText[]; side: "player" | "enemy" }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={cn("pointer-events-none relative z-30 h-24 w-full", side === "player" ? "flex justify-end" : "flex justify-start")}>
      <AnimatePresence>
        {entries.map((entry) => (
          <CombatTextBubble key={entry.id} entry={entry} side={side} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function CombatTextBubble({ entry, side }: { entry: FloatingCombatText; side: "player" | "enemy" }) {
  const icon = getCombatTextIcon(entry);
  const colorClass = getCombatTextColorClass(entry);

  // Lane spacing and the 1.6s travel duration match the combat-text lifetime in hooks;
  // merged multi-hit text can float together without overlapping newer entries.
  return (
    <motion.div
      className={cn("absolute whitespace-nowrap inline-flex items-center gap-2 text-[32px] font-semibold", colorClass, side === "player" ? "left-0" : "right-0")}
      style={{
        top: `${entry.lane * 56}px`,
        fontFamily: "Inter, sans-serif",
      } as Record<string, string>}
      initial={{ y: 0, opacity: 1, filter: "blur(0px)", scale: 1 }}
      animate={{
        y: -120,
        opacity: [1, 1, 0],
        filter: ["blur(0px)", "blur(0px)", "blur(4px)"],
        scale: [1, 1, 1.3],
        transition: {
          y: { duration: 1.6, ease: "easeOut" },
          opacity: { duration: 1.6, times: [0, 0.4, 1], ease: "easeOut" },
          filter: { duration: 1.6, times: [0, 0.4, 1], ease: "easeOut" },
          scale: { duration: 1.6, times: [0, 0.5, 1], ease: "easeOut" },
        },
      }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      {createElement(icon, { className: "h-[30px] w-[30px]" })}
      <span>{entry.signedAmountText}</span>
    </motion.div>
  );
}

function StatusIcon({ chip }: { chip: StatusChip }) {
  const kw = chip.id as KeywordId;
  const definition = keywordDefinitions[kw];
  const Icon = keywordIcons[kw];

  return (
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${definition.label} ${chip.value}`}
      >
        <Icon className={cn("h-[18px] w-[18px]", definition.colorClass)} />
      </button>
      <div className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100")}>
        <div className="flex items-center justify-between gap-3">
          <KeywordTag keywordId={kw} />
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">{chip.value}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{renderColoredKeywords(definition.description)}</p>
      </div>
    </div>
  );
}

function StatusParticleBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    // Measure after layout so the synthetic particle burst exactly overlays the status
    // panel during death fade, including responsive card widths.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const particles = createStatusParticles(w, h);
    const stop = animateParticles(ctx, particles, w, h, 1000, () => {});
    return () => { stop(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 w-full h-full rounded-[24px]"
      style={{ pointerEvents: "none" }}
    />
  );
}

function ParticleBurst({ imageUrl }: { imageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    // The actor image is sampled into canvas particles, then the canvas is cleared before
    // animation so CSS frame fade and particle breakup read as one death effect.
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    let cancelled = false;
    let stop: (() => void) | null = null;

    img.onload = () => {
      if (cancelled) return;
      ctx.drawImage(img, 0, 0, w, h);
      const particles = createParticles(ctx, w, h);
      ctx.clearRect(0, 0, w, h);
      stop = animateParticles(ctx, particles, w, h, 1000, () => {});
    };

    img.onerror = () => {
      // If the image fails to load, do nothing — the CSS fade handles the death animation
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      if (stop) stop();
    };
  }, [imageUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 w-full h-full rounded-[30px]"
      style={{ pointerEvents: "none" }}
    />
  );
}

export function ArtPanel({
  side,
  title,
  art,
  health,
  maxHealth,
  statuses,
  shimmerId,
  shimmerActive,
  shimmerToken,
  onHoverShimmer,
  combatTexts: _combatTexts,
  surfaceRef,
  isDead = false,
  shaking = false,
  cardWidthClass,
  descriptionLines,
  currentEnemy,
}: {
  side: "player" | "enemy";
  title: string;
  art: string;
  health: number;
  maxHealth: number;
  statuses: StatusChip[];
  shimmerId: string;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  onHoverShimmer: (cardId: string) => void;
  combatTexts: FloatingCombatText[];
  surfaceRef?: (node: HTMLDivElement | null) => void;
  isDead?: boolean;
  shaking?: boolean;
  cardWidthClass: string | undefined;
  descriptionLines?: string[];
  currentEnemy?: BestiaryEntry;
}) {
  const healthToken = useChangeToken(health);

  return (
    <div className={cn("group/enemy-panel relative flex flex-col items-center gap-3", shaking && "animate-shake")}>
      {currentEnemy ? (
        <div className="opacity-0 group-hover/enemy-panel:opacity-100">
          <EnemyTooltip entry={currentEnemy} />
        </div>
      ) : descriptionLines ? (
        <div className={cn(popupClassName, "hover-popup-panel pointer-events-auto opacity-0 group-hover/enemy-panel:opacity-100")}>
          <p className="text-sm text-foreground">{title}</p>
          <DescriptionLines lines={descriptionLines} idPrefix={`enemy-${title}`} />
        </div>
      ) : null}
      <div
        ref={surfaceRef}
        data-testid={`battle-${side}-art-panel`}
        className={cn("tilt-surface", cardSurfaceClass, cardWidthClass ?? battleCardWidthClass, isDead && "overflow-visible animate-frame-fade surface-transparent")}
        data-tilt-strength="15"
        onMouseEnter={() => onHoverShimmer(shimmerId)}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} />
        <img src={art} alt={title} className={cn("block w-full rounded-[30px] aspect-[3/4]", isDead && "opacity-0")} loading="eager" />
        {isDead && <ParticleBurst imageUrl={art} />}
      </div>

      <div className={cn("surface-muted rounded-[24px] px-4 py-3 relative", cardWidthClass ?? battleCardWidthClass, isDead && "animate-frame-fade surface-transparent")}>
        <div className={isDead ? "opacity-0" : ""}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">{title}</p>
            <p key={healthToken} className={cn("hp-number-pop text-xs font-medium text-muted-foreground")}>
              {health}/{maxHealth}
            </p>
          </div>
          <Progress value={(health / maxHealth) * 100} className={cn("mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")} />

          <div className="mt-2.5 flex min-h-7 items-center gap-1">
            {statuses.length > 0 ? statuses.map((status) => <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />) : null}
          </div>
        </div>
        {isDead && <StatusParticleBurst />}
      </div>
    </div>
  );
}

function getCompanionDescriptionLines(companion: CompanionDefinition): string[] {
  const attack = companion.turnStartEffects.find((effect) => effect.kind === "damage");
  if (!attack) return ["Acts at the start of each turn"];

  const displayAmount = attack.damageType === "bleed" ? attack.amount * 2 : attack.amount;
  const displayType = attack.damageType.charAt(0).toUpperCase() + attack.damageType.slice(1);
  return [`Attacks for ${displayAmount} ${displayType} each turn`];
}

export function CompanionPanel({ companion, compact = false, shaking = false }: { companion: CompanionDefinition; compact?: boolean; shaking?: boolean }) {
  return (
    <div className="companion-enter group/companion relative" data-testid="active-companion" aria-label={`Active companion: ${companion.title}`}>
      <div
        className={cn("tilt-surface", cardSurfaceClass, compact ? "w-[clamp(78px,17cqh,120px)]" : "w-[clamp(96px,11cqh,150px)]", shaking && "animate-shake")}
        data-tilt-strength="10"
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <img src={companion.art} alt={companion.title} className="block w-full rounded-[30px] aspect-[3/4]" loading="eager" />
      </div>
      <div className={cn(popupClassName, "hover-popup-panel pointer-events-auto opacity-0 group-hover/companion:opacity-100")}>
        <p className="text-sm text-foreground">{companion.title}</p>
        <DescriptionLines lines={getCompanionDescriptionLines(companion)} idPrefix={`companion-${companion.id}`} />
      </div>
    </div>
  );
}

export function PilePanel({ label, count, type, compact = false }: { label: string; count: number; type: "draw" | "discard"; compact?: boolean }) {
  const art = type === "draw" ? pileDrawArt : pileDiscardArt;
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`${type}-pile`} data-count={count}>
        <span className="font-semibold uppercase tracking-wider">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
    );
  }
  return (
    <div
      className={cn("tilt-surface", cardSurfaceClass, pileCardWidthClass, "bg-transparent")}
      data-testid={`${type}-pile`}
      data-count={count}
      data-tilt-strength="12"
      onMouseMove={setTiltFromEvent}
      onMouseLeave={clearTiltFromEvent}
      style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
    >
      <img src={art} alt={`${label} pile`} className="block w-full rounded-[30px] aspect-[3/4]" loading="lazy" />
    </div>
  );
}

export function ManaPanel({ mana, maxMana, gold }: { mana: number; maxMana: number; gold: number }) {
  // Show temporary mana overflow by rendering up to current mana, not just max mana;
  // otherwise mana-grant cards could appear to do nothing above the cap.
  const displayCount = Math.max(mana, maxMana);
  const manaToken = useChangeToken(`${mana}-${maxMana}`);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="mana-panel" data-mana={mana}>
      <div className="flex items-center gap-1 text-sm font-medium text-yellow-300">
        <Coins className="h-4 w-4" />
        <span>{gold}</span>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: displayCount }).map((_, index) => {
          const isFilled = index < mana;
          const isOverflow = index >= maxMana;
          return (
            <Gem
              key={`mana-${index}-${manaToken}-${isFilled}`}
              className={cn(
                "h-[22px] w-[22px] transition-opacity duration-200",
                isFilled && "mana-gem-active",
                isFilled && isOverflow && "text-sky-300 drop-shadow-[0_0_3px_rgba(125,211,252,0.6)]",
                isFilled && !isOverflow && "text-[#2c4f88]",
                !isFilled && "text-[#2c4f88]/20",
              )}
              strokeWidth={2.2}
            />
          );
        })}
      </div>
    </div>
  );
}
