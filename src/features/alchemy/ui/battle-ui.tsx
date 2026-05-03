import type { CSSProperties, ReactNode } from "react";
import { Coins, Gem, House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { battleCardBack, keywordDefinitions } from "@/lib/game-data";
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

function CombatTextRail({ entries, side }: { entries: FloatingCombatText[]; side: "player" | "enemy" }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-[18%] z-30 flex w-44 flex-col gap-2",
        side === "player" ? "left-full ml-7 items-start text-left" : "right-full mr-7 items-end text-right",
      )}
    >
      {entries.map((entry) => (
        <CombatTextBubble key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function CombatTextBubble({ entry }: { entry: FloatingCombatText }) {
  const Icon = getCombatTextIcon(entry);
  const colorClass = getCombatTextColorClass(entry);

  return (
    <div
      className={cn(
        "combat-text-float inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-xl font-semibold backdrop-blur-[2px]",
        colorClass,
      )}
      style={{ "--combat-text-lane": String(entry.lane) } as CSSProperties}
    >
      <Icon className={cn("h-5 w-5", colorClass)} />
      <span>{entry.signedAmountText}</span>
    </div>
  );
}

function StatusIcon({ chip }: { chip: StatusChip }) {
  const definition = keywordDefinitions[chip.id];
  const Icon = keywordIcons[chip.id];

  return (
    <div className="group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${definition.label} ${chip.value}`}
      >
        <Icon className={cn("h-[18px] w-[18px]", definition.colorClass)} />
      </button>
      <div className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", definition.colorClass)} />
            <p className="text-sm font-semibold text-foreground">{definition.label}</p>
          </div>
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
}) {
  return (
    <div className={cn("relative flex flex-col items-center gap-3", isDead && "animate-death")}>
      <CombatTextRail entries={combatTexts} side={side} />

      <div
        ref={surfaceRef}
        className={cn("tilt-surface", cardSurfaceClass, battleCardWidthClass)}
        data-tilt-strength="15"
        onMouseEnter={() => onHoverShimmer(shimmerId)}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <div className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]", shimmerActive ? "card-shimmer-active" : "")}> 
          <div key={shimmerActive ? shimmerToken : undefined} className={cn("card-shimmer-sweep", shimmerActive ? "opacity-100" : "opacity-0")} />
        </div>
        <img src={art} alt={title} className="block h-auto w-full rounded-[30px]" loading="eager" />
      </div>

      <div className={cn("surface-muted rounded-[24px] px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.38)]", battleCardWidthClass)}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className={cn("text-xs font-medium text-muted-foreground", isDead && "opacity-30")}>
            {health}/{maxHealth}
          </p>
        </div>
        <Progress value={(health / maxHealth) * 100} className={cn("mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")} />

        <div className="mt-2.5 flex min-h-7 items-center gap-1">
          {statuses.length > 0 ? statuses.map((status) => <StatusIcon key={`${title}-${status.id}`} chip={status} />) : null}
        </div>
      </div>
    </div>
  );
}

export function PilePanel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={cn("tilt-surface", cardSurfaceClass, pileCardWidthClass)}
        data-tilt-strength="12"
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <img src={battleCardBack} alt={`${label} card back`} className="block h-auto w-full rounded-[30px]" loading="lazy" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{count}</p>
      </div>
    </div>
  );
}

export function ManaPanel({ mana, maxMana, gold }: { mana: number; maxMana: number; gold: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: maxMana }).map((_, index) => (
          <Gem
            key={`mana-${index}`}
            className={cn("h-[22px] w-[22px] transition-opacity duration-200", index < mana ? "text-[#2c4f88]" : "text-[#2c4f88]/20")}
            strokeWidth={2.2}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm font-medium text-yellow-300">
        <Coins className="h-4 w-4" />
        <span>{gold}</span>
      </div>
    </div>
  );
}

export function PlaceholderScreen({
  title,
  children,
  onMainMenu,
  onReturnToBattle,
  showReturnToBattle,
}: {
  title: string;
  children: ReactNode;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  showReturnToBattle: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-3xl rounded-[28px] px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" />
            Main Menu
          </Button>
          {showReturnToBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" />
              Return to Battle
            </Button>
          ) : null}
        </div>

        <div className="mt-8 text-center">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
