import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Coins, Gem } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { keywordDefinitions, pileDiscardArt, pileDrawArt, type KeywordId } from "@/lib/game-data";
import type { CompanionDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  battleCardWidthClass,
  cardSurfaceClass,
  keywordIcons,
  pileCardWidthClass,
  popupClassName,
  staticCardTransform,
} from "../config";
import type { FloatingCombatText, StatusChip } from "../types";
import { clearTiltFromEvent, getCombatTextColorClass, getCombatTextIcon, setTiltFromEvent } from "../utils";
import { KeywordTag } from "./keyword-tag";
import { DescriptionLines } from "./card-ui";
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
      {entries.map((entry) => (
        <CombatTextBubble key={entry.id} entry={entry} side={side} />
      ))}
    </div>
  );
}

function CombatTextBubble({ entry, side }: { entry: FloatingCombatText; side: "player" | "enemy" }) {
  const Icon = getCombatTextIcon(entry);
  const colorClass = getCombatTextColorClass(entry);

  return (
    <div
      className={cn(
        "combat-text-float absolute whitespace-nowrap inline-flex items-center gap-2 text-3xl font-semibold",
        colorClass,
        side === "player" ? "left-0" : "right-0",
      )}
      style={{ "--combat-text-lane": String(entry.lane) } as CSSProperties}
    >
      <Icon className={cn("h-7 w-7", colorClass)} />
      <span>{entry.signedAmountText}</span>
    </div>
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
          <KeywordTag keywordId={chip.id as import("@/lib/game-data").KeywordId} />
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">{chip.value}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{definition.description}</p>
      </div>
    </div>
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
  combatTexts,
  surfaceRef,
  isDead = false,
  shaking = false,
  cardWidthClass,
  descriptionLines,
}: {
  side: "player" | "enemy";
  title: string;
  art: string;
  health: number;
  maxHealth: number;
  statuses: StatusChip[];
  shimmerId: string;
  shimmerActive: boolean;
  shimmerToken?: number;
  onHoverShimmer: (cardId: string) => void;
  combatTexts: FloatingCombatText[];
  surfaceRef?: (node: HTMLDivElement | null) => void;
  isDead?: boolean;
  shaking?: boolean;
  cardWidthClass?: string;
  descriptionLines?: string[];
}) {
  const healthToken = useChangeToken(health);

  return (
    <div className={cn("group/enemy-panel relative flex flex-col items-center gap-3", isDead && "animate-death", shaking && "animate-shake")}>
      {descriptionLines ? (
        <div className={cn(popupClassName, "hover-popup-panel pointer-events-auto opacity-0 group-hover/enemy-panel:opacity-100")}>
          <p className="text-sm text-foreground">{title}</p>
          <DescriptionLines lines={descriptionLines} idPrefix={`enemy-${title}`} />
        </div>
      ) : null}
      <div
        ref={surfaceRef}
        data-testid={`battle-${side}-art-panel`}
        className={cn("tilt-surface", cardSurfaceClass, cardWidthClass ?? battleCardWidthClass)}
        data-tilt-strength="15"
        onMouseEnter={() => onHoverShimmer(shimmerId)}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} />
        <img src={art} alt={title} className="block w-full rounded-[30px] aspect-[375/524]" loading="eager" />
      </div>

      <div className={cn("surface-muted rounded-[24px] px-4 py-3", cardWidthClass ?? battleCardWidthClass)}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">{title}</p>
          <p key={healthToken} className={cn("hp-number-pop text-xs font-medium text-muted-foreground", isDead && "opacity-30")}>
            {health}/{maxHealth}
          </p>
        </div>
        <Progress value={(health / maxHealth) * 100} className={cn("mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")} />

        <div className="mt-2.5 flex min-h-7 items-center gap-1">
          {statuses.length > 0 ? statuses.map((status) => <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />) : null}
        </div>
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
        <img src={companion.art} alt={companion.title} className="block w-full rounded-[30px] aspect-[375/524]" loading="eager" />
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
    );
  }
  return (
    <div
      className={cn("tilt-surface", cardSurfaceClass, pileCardWidthClass, "bg-transparent")}
      data-tilt-strength="12"
      onMouseMove={setTiltFromEvent}
      onMouseLeave={clearTiltFromEvent}
      style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
    >
      <img src={art} alt={`${label} pile`} className="block w-full rounded-[30px] aspect-[375/524]" loading="lazy" />
    </div>
  );
}

export function ManaPanel({ mana, maxMana, gold }: { mana: number; maxMana: number; gold: number }) {
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
