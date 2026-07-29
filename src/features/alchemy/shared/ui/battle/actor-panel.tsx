// Battle actor panels for hero/enemy art, health, status rows, and death effects.
// Depends on actor subcomponents, enemy tooltips, and shared card styling.
// Used by BattleScreen through the battle UI barrel.
import type { Ref } from "react";

import { Progress } from "@/components/ui/progress";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { battleCardWidthClass, cardArtImageClass, cardSurfaceClass } from "../../config";
import type { StatusChip } from "../../types";
import { TiltSurface } from "../tilt-surface";
import { PortraitHurtVfx } from "./portrait-hurt-vfx";
import { useHurtPulse } from "./use-hurt-pulse";
import { ParticleBurst } from "./particle-burst";
import { DeathsDoorStatusIcon, StatusIcon } from "./status-icons";
import { useChangeToken } from "./use-change-token";

const ACTOR_PANEL_CONFIG = {
  fullHealthPercent: 100,
  deathDoorShineDurationSeconds: 4,
  deathDoorArtBorderWidth: 3,
  deathDoorStatsBorderWidth: 2,
} as const;

interface ArtPanelProps {
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
  surfaceRef?: Ref<HTMLDivElement>;
  isDead?: boolean;
  shaking?: boolean;
  cardWidthClass?: string;
  descriptionLines?: string[];
  currentEnemy?: BestiaryEntry;
  currentEnemyAttackEffects?: EnemyAttackEffect[];
  activeLabyrinthModifiers?: EncounterCombatTraitId[];
  deathsDoorActive?: boolean;
  isBoss?: boolean;
  statsCardWidthClass?: string | undefined;
  hurtFlashToken?: number;
}

function getStatsCardWidth(isBoss: boolean, statsCardWidthClass: string | undefined, defaultClass: string): string {
  if (!isBoss) return defaultClass;
  return statsCardWidthClass ?? defaultClass;
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
  surfaceRef,
  isDead = false,
  shaking = false,
  cardWidthClass = battleCardWidthClass,
  descriptionLines,
  currentEnemy,
  currentEnemyAttackEffects,
  activeLabyrinthModifiers = [],
  deathsDoorActive = false,
  isBoss = false,
  statsCardWidthClass,
  hurtFlashToken = 0,
}: ArtPanelProps) {
  const healthToken = useChangeToken(health);
  const healthPercent = maxHealth > 0 ? (health / maxHealth) * ACTOR_PANEL_CONFIG.fullHealthPercent : 0;

  const artWrapClass = cn(isBoss && "origin-bottom scale-[1.3]");

  return (
    <div className={cn("relative flex flex-col items-center gap-3", shaking && "animate-shake")}>
      <div className="group/art-wrapper relative">
        <ActorTooltip
          side={side}
          title={title}
          descriptionLines={descriptionLines}
          currentEnemy={currentEnemy}
          currentEnemyAttackEffects={currentEnemyAttackEffects}
          activeLabyrinthModifiers={activeLabyrinthModifiers}
        />
        <div className={artWrapClass}>
          <ActorArtFrame
            side={side}
            title={title}
            art={art}
            shimmerId={shimmerId}
            shimmerActive={shimmerActive}
            shimmerToken={shimmerToken}
            onHoverShimmer={onHoverShimmer}
            surfaceRef={surfaceRef}
            isDead={isDead}
            cardWidthClass={cardWidthClass}
            deathsDoorActive={deathsDoorActive}
            hurtFlashToken={hurtFlashToken}
          />
        </div>
      </div>
      <ActorStatsPanel
        side={side}
        title={title}
        health={health}
        maxHealth={maxHealth}
        healthPercent={healthPercent}
        healthToken={healthToken}
        statuses={statuses}
        isDead={isDead}
        cardWidthClass={getStatsCardWidth(isBoss, statsCardWidthClass, cardWidthClass)}
        deathsDoorActive={deathsDoorActive}
      />
    </div>
  );
}

import { ActorTooltip, ArtDeathDoorBorder, StatsDeathDoorBorder } from "./actor-panel-helpers";

function ActorArtFrame({
  side,
  title,
  art,
  shimmerId,
  shimmerActive,
  shimmerToken,
  onHoverShimmer,
  surfaceRef,
  isDead,
  cardWidthClass = battleCardWidthClass,
  deathsDoorActive,
  hurtFlashToken = 0,
}: {
  side: "player" | "enemy";
  title: string;
  art: string;
  shimmerId: string;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  onHoverShimmer: (cardId: string) => void;
  surfaceRef: Ref<HTMLDivElement> | undefined;
  isDead: boolean;
  cardWidthClass?: string;
  deathsDoorActive: boolean;
  hurtFlashToken?: number;
}) {
  const { pulse, sparksOverflow } = useHurtPulse(hurtFlashToken);

  return (
    <TiltSurface
      surfaceRef={surfaceRef}
      testId={`battle-${side}-art-panel`}
      tiltEnabled={!isDead}
      className={cn(
        "relative",
        cardSurfaceClass,
        cardWidthClass ?? battleCardWidthClass,
        sparksOverflow && "overflow-visible",
        isDead && "animate-frame-fade overflow-visible !bg-transparent",
      )}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      shimmerRounded="rounded-shell-hero"
      onMouseEnter={() => onHoverShimmer(shimmerId)}
    >
      {deathsDoorActive ? <ArtDeathDoorBorder /> : null}
      <img
        src={art}
        alt={title}
        className={cn("block w-full", cardArtImageClass, isDead && "opacity-0")}
        loading="eager"
      />
      {!isDead ? <PortraitHurtVfx pulse={pulse} /> : null}
      {isDead && <ParticleBurst imageUrl={art} />}
    </TiltSurface>
  );
}

function ActorStatsPanel({
  side,
  title,
  health,
  maxHealth,
  healthPercent,
  healthToken,
  statuses,
  isDead,
  cardWidthClass = battleCardWidthClass,
  deathsDoorActive,
}: Pick<ArtPanelProps, "side" | "title" | "health" | "maxHealth" | "statuses" | "isDead" | "cardWidthClass"> & {
  deathsDoorActive: boolean | undefined;
  healthPercent: number;
  healthToken: number;
}) {
  return (
    <div
      className={cn(
        "relative rounded-shell-inner px-4 py-3 surface-muted",
        cardWidthClass,
        deathsDoorActive && "shadow-deaths-door-glow",
        isDead && "animate-frame-fade !bg-transparent",
      )}
    >
      {deathsDoorActive ? <StatsDeathDoorBorder /> : null}
      <div className={cn(isDead && "opacity-0 transition-opacity duration-700")}>
        <ActorHealthHeader side={side} title={title} health={health} maxHealth={maxHealth} healthToken={healthToken} />
        <Progress
          value={healthPercent}
          className={cn("mt-1 h-2 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")}
        />
        <ActorStatusRow title={title} statuses={statuses} deathsDoorActive={deathsDoorActive} side={side} />
      </div>
    </div>
  );
}

function ActorHealthHeader({
  side,
  title,
  health,
  maxHealth,
  healthToken,
}: Pick<ArtPanelProps, "side" | "title" | "health" | "maxHealth"> & { healthToken: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="font-sans text-base font-bold text-amber-100/75">{title}</p>
      <p
        key={healthToken}
        data-testid={`${side}-health`}
        className={cn("text-sm font-semibold text-foreground", healthToken > 0 && "hp-number-pop")}
      >
        {health}/{maxHealth}
      </p>
    </div>
  );
}

// Separate component for the status rows to keep code clean and prevent re-rendering.
function ActorStatusRow({
  title,
  statuses,
  deathsDoorActive,
  side,
}: Pick<ArtPanelProps, "title" | "statuses" | "side"> & { deathsDoorActive: boolean | undefined }) {
  return (
    <div className="mt-2.5 flex min-h-7 items-center gap-1" data-testid={`${side}-statuses`}>
      {deathsDoorActive ? <DeathsDoorStatusIcon /> : null}
      {statuses.map((status) => (
        <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />
      ))}
    </div>
  );
}
