// Battle actor panels for hero/enemy art, health, status rows, and death effects.
// Depends on actor subcomponents, enemy tooltips, and shared card styling.
// Used by BattleScreen through the battle UI barrel.
import type { Ref } from "react";

import { Progress } from "@/components/ui/progress";
import { ShineBorder } from "@/components/ui/shine-border";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { battleCardWidthClass, cardArtImageClass, cardSurfaceClass, SHINE_PALETTES } from "../../config";
import type { StatusChip } from "../../types";
import { DescriptionLines } from "../card-description-ui";
import { EnemyTooltip } from "../enemy-tooltip";
import { TooltipPanel, TooltipHeader } from "../tooltip-panel";
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

type ArtPanelProps = {
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
  activeLabyrinthModifiers?: LabyrinthModifierKind[];
  deathsDoorActive?: boolean;
  isBoss?: boolean;
  statsCardWidthClass?: string | undefined;
  hurtFlashToken?: number;
};

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
        {isBoss ? (
          <div className="scale-[1.3] origin-bottom">
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
        ) : (
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
        )}
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
        cardWidthClass={isBoss ? (statsCardWidthClass ?? cardWidthClass) : cardWidthClass}
        deathsDoorActive={deathsDoorActive}
      />
    </div>
  );
}

function ActorTooltip({
  side,
  title,
  descriptionLines,
  currentEnemy,
  currentEnemyAttackEffects,
  activeLabyrinthModifiers,
}: {
  side: "player" | "enemy";
  title: string;
  descriptionLines: string[] | undefined;
  currentEnemy: BestiaryEntry | undefined;
  currentEnemyAttackEffects: EnemyAttackEffect[] | undefined;
  activeLabyrinthModifiers?: LabyrinthModifierKind[] | undefined;
}) {
  if (currentEnemy) {
    return (
      <EnemyTooltip
        entry={currentEnemy}
        attackEffects={currentEnemyAttackEffects}
        labyrinthModifiers={activeLabyrinthModifiers ?? []}
        align={side === "enemy" ? "left" : "right"}
        className="opacity-0 transition-opacity duration-150 group-hover/art-wrapper:opacity-100"
      />
    );
  }

  if (!descriptionLines) return null;
  return (
    <TooltipPanel className="opacity-0 transition-opacity duration-150 group-hover/art-wrapper:opacity-100">
      <TooltipHeader>{title}</TooltipHeader>
      <DescriptionLines lines={descriptionLines} idPrefix={`enemy-${title}`} />
    </TooltipPanel>
  );
}

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
        isDead && "overflow-visible animate-frame-fade !bg-transparent",
      )}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      shimmerRounded="rounded-[30px]"
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
        "surface-muted rounded-shell-inner px-4 py-3 relative",
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
        <ActorStatusRow title={title} statuses={statuses} deathsDoorActive={deathsDoorActive} />
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
}: Pick<ArtPanelProps, "title" | "statuses"> & { deathsDoorActive: boolean | undefined }) {
  return (
    <div className="mt-2.5 flex min-h-7 items-center gap-1">
      {deathsDoorActive ? <DeathsDoorStatusIcon /> : null}
      {statuses.map((status) => (
        <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />
      ))}
    </div>
  );
}

function ArtDeathDoorBorder() {
  return (
    <ShineBorder
      borderWidth={ACTOR_PANEL_CONFIG.deathDoorArtBorderWidth}
      duration={ACTOR_PANEL_CONFIG.deathDoorShineDurationSeconds}
      shineColor={[...SHINE_PALETTES.deathsDoorArt]}
      className="rounded-shell-hero"
    />
  );
}

function StatsDeathDoorBorder() {
  return (
    <ShineBorder
      borderWidth={ACTOR_PANEL_CONFIG.deathDoorStatsBorderWidth}
      duration={ACTOR_PANEL_CONFIG.deathDoorShineDurationSeconds}
      shineColor={[...SHINE_PALETTES.deathsDoorStats]}
      className="rounded-shell-inner"
    />
  );
}
