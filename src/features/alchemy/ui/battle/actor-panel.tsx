// Battle actor panels for hero/enemy art, health, statuses, and death effects.
// Depends on canvas particles, game-data keyword metadata, and shared card styling.
// Used by BattleScreen through the battle UI barrel.
import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { Skull } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { ShineBorder } from "@/components/ui/shine-border";
import { animateParticles, createParticles } from "@/lib/animation/particle-burst";
import { keywordDefinitions, type BestiaryEntry, type EnemyAttackEffect, type KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  battleCardWidthClass,
  cardSurfaceClass,
  keywordIcons,
  popupClassName,
  staticCardTransform,
} from "../../config";
import type { FloatingCombatText, StatusChip } from "../../types";
import { clearTiltFromEvent, setTiltFromEvent } from "../../utils";
import { DescriptionLines, renderColoredKeywords } from "../card-ui";
import { EnemyTooltip } from "../enemy-tooltip";
import { KeywordTag } from "../keyword-tag";
import { ShimmerOverlay } from "../shared-ui";
import { useChangeToken } from "./use-change-token";

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
      <div
        className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100")}
      >
        <div className="flex items-center justify-between gap-3">
          <KeywordTag keywordId={kw} />
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
            {chip.value}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{renderColoredKeywords(definition.description)}</p>
      </div>
    </div>
  );
}

function DeathsDoorStatusIcon() {
  return (
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-950/70 text-red-200 ring-1 ring-red-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Death's Door"
      >
        <Skull className="h-[18px] w-[18px]" />
      </button>
      <div
        className={cn(
          popupClassName,
          "w-72 hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-red-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200">
            <Skull className="h-3.5 w-3.5" /> Death's Door
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 italic text-muted-foreground">
          Because I could not stop for Death,
          <br />
          He kindly stopped for me
        </p>
      </div>
    </div>
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

    const cw = w * 2;
    const ch = h * 2;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    let cancelled = false;
    let stop: (() => void) | null = null;

    img.onload = () => {
      if (cancelled) return;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      const particles = createParticles(ctx, cw, ch);
      ctx.clearRect(0, 0, cw, ch);
      stop = animateParticles(ctx, particles, cw, ch, 2400, () => {});
    };

    img.onerror = () => {
      // If the image fails to load, do nothing -- the CSS fade handles the death animation.
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
      className="absolute z-10 w-[200%] h-[200%] -left-[50%] -top-[50%]"
      style={{ pointerEvents: "none" }}
    />
  );
}

// Renders one battle actor card with health/status chrome and optional enemy tooltip.
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
  currentEnemyAttackEffects,
  deathsDoorActive = false,
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
  currentEnemyAttackEffects?: EnemyAttackEffect[];
  deathsDoorActive?: boolean;
}) {
  const healthToken = useChangeToken(health);

  return (
    <div className={cn("group/enemy-panel relative flex flex-col items-center gap-3", shaking && "animate-shake")}>
      {currentEnemy ? (
        <div className="opacity-0 group-hover/enemy-panel:opacity-100">
          <EnemyTooltip entry={currentEnemy} attackEffects={currentEnemyAttackEffects} />
        </div>
      ) : descriptionLines ? (
        <div
          className={cn(
            popupClassName,
            "hover-popup-panel pointer-events-auto opacity-0 group-hover/enemy-panel:opacity-100",
          )}
        >
          <p className="text-sm text-foreground">{title}</p>
          <DescriptionLines lines={descriptionLines} idPrefix={`enemy-${title}`} />
        </div>
      ) : null}
      <div
        ref={surfaceRef}
        data-testid={`battle-${side}-art-panel`}
        className={cn(
          "tilt-surface",
          cardSurfaceClass,
          cardWidthClass ?? battleCardWidthClass,
          isDead && "overflow-visible animate-frame-fade surface-transparent",
        )}
        onMouseEnter={() => onHoverShimmer(shimmerId)}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} />
        {deathsDoorActive ? (
          <ShineBorder
            borderWidth={3}
            duration={4}
            shineColor={["#450a0a", "#dc2626", "#7f1d1d", "#111827"]}
            className="rounded-[30px]"
          />
        ) : null}
        <img
          src={art}
          alt={title}
          className={cn("block w-full rounded-[30px] aspect-[3/4] object-cover", isDead && "opacity-0")}
          loading="eager"
        />
        {isDead && <ParticleBurst imageUrl={art} />}
      </div>

      <div
        className={cn(
          "surface-muted rounded-[24px] px-4 py-3 relative",
          cardWidthClass ?? battleCardWidthClass,
          deathsDoorActive && "shadow-[0_0_30px_rgba(127,29,29,0.45)]",
          isDead && "animate-frame-fade surface-transparent",
        )}
      >
        {deathsDoorActive ? (
          <ShineBorder
            borderWidth={2}
            duration={4}
            shineColor={["#450a0a", "#ef4444", "#991b1b", "#1f0505"]}
            className="rounded-[24px]"
          />
        ) : null}
        <div className={isDead ? "opacity-0 transition-opacity duration-700" : ""}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-base leading-6 font-bold text-foreground">{title}</p>
            <p key={healthToken} className={cn("hp-number-pop text-xs font-medium text-muted-foreground")}>
              {health}/{maxHealth}
            </p>
          </div>
          <Progress
            value={(health / maxHealth) * 100}
            className={cn("mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")}
          />

          <div className="mt-2.5 flex min-h-7 items-center gap-1">
            {deathsDoorActive ? <DeathsDoorStatusIcon /> : null}
            {statuses.length > 0
              ? statuses.map((status) => <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />)
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}
