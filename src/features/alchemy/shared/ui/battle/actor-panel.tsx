import { type ReactNode, type Ref } from "react";

import { Progress } from "@/components/ui/progress";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  battleCardWidthClass,
  battleEnemyCardWidthClass,
  cardArtImageClass,
  cardHoverScaleClass,
  cardSurfaceClass,
  getEnemyKeywordShineColors,
  landscapeArtImageClass,
  sectionTitleClass,
} from "../../config";
import type { CombatImpactCue, StatusChip } from "../../types";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { Surface } from "../surface";
import { useHoverVisible } from "../use-hover-visible";
import { usePlasmaInteraction } from "../use-plasma-source";
import { PortraitImpactVfx } from "./portrait-hurt-vfx";
import { useImpactPulse } from "./use-hurt-pulse";
import { SliceDeath } from "./slice-death";
import { DeathsDoorStatusIcon, StatusIcon } from "./status-icons";
import { useChangeToken } from "./use-change-token";

import {
  ActorTooltip,
  ArtDeathDoorBorder,
  ArtHoverKeywordBorder,
  ArtTurnActiveBorder,
  StatsDeathDoorBorder,
} from "./actor-panel-helpers";
import { CombatantStatusEffectPresentation } from "./combatant-status-effect-presentation";
import { CombatantAttackLunge } from "./combatant-attack-lunge";
import type { ActiveCcKeyword } from "../../utils/cc-presentation";

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
  impactCue?: CombatImpactCue | null;
  turnActive?: boolean;
  turnUrgentHide?: boolean;
  turnShineColors?: readonly string[];
  artCorner?: ReactNode;
  ccKeyword?: ActiveCcKeyword | null;
  attackToken?: number;
  castToken?: number;
  plasmaColorPair?: PlasmaColorPair | null;
  children?: ReactNode;
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
  surfaceRef,
  isDead = false,
  shaking = false,
  cardWidthClass,
  descriptionLines,
  currentEnemy,
  currentEnemyAttackEffects,
  activeLabyrinthModifiers = [],
  deathsDoorActive = false,
  isBoss = false,
  impactCue = null,
  turnActive = false,
  turnUrgentHide = false,
  turnShineColors,
  artCorner,
  ccKeyword = null,
  attackToken = 0,
  castToken = 0,
  plasmaColorPair = null,
  children,
}: ArtPanelProps) {
  const healthToken = useChangeToken(health);
  const healthPercent = maxHealth > 0 ? (health / maxHealth) * ACTOR_PANEL_CONFIG.fullHealthPercent : 0;
  const { triggerRef: artWrapperRef, visible: tooltipVisible, ...tooltipHandlers } = useHoverVisible();
  usePlasmaInteraction(plasmaColorPair, tooltipVisible);

  const resolvedCardWidthClass =
    cardWidthClass ?? (side === "enemy" ? battleEnemyCardWidthClass : battleCardWidthClass);
  const artWrapClass = cn("relative overflow-visible", isBoss && side === "player" && "origin-bottom scale-[1.3]");
  const hoverShineColors =
    side === "enemy" && currentEnemy ? getEnemyKeywordShineColors(currentEnemy, currentEnemyAttackEffects) : undefined;

  return (
    <div className={cn("relative flex flex-col items-center gap-3", shaking && "animate-shake")}>
      <CombatantAttackLunge
        attackToken={attackToken}
        castToken={castToken}
        aim={side === "player" ? 1 : -1}
        className="relative flex flex-col items-center gap-3"
      >
        <div className={artWrapClass}>
          <div
            ref={artWrapperRef}
            className="group/art-wrapper relative"
            onMouseEnter={tooltipHandlers.onMouseEnter}
            onMouseLeave={tooltipHandlers.onMouseLeave}
          >
            <ActorTooltip
              title={title}
              descriptionLines={descriptionLines}
              currentEnemy={currentEnemy}
              currentEnemyAttackEffects={currentEnemyAttackEffects}
              activeLabyrinthModifiers={activeLabyrinthModifiers}
              triggerRef={artWrapperRef}
              visible={tooltipVisible}
            />
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
              cardWidthClass={resolvedCardWidthClass}
              deathsDoorActive={deathsDoorActive}
              impactCue={impactCue}
              turnActive={turnActive}
              turnUrgentHide={turnUrgentHide}
              ccKeyword={ccKeyword}
              hoverShineActive={side === "enemy" && tooltipVisible}
              {...(hoverShineColors === undefined ? {} : { hoverShineColors })}
              {...(turnShineColors === undefined ? {} : { turnShineColors })}
            />
            {children ? (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible">
                {children}
              </div>
            ) : null}
          </div>
          {artCorner}
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
          cardWidthClass={resolvedCardWidthClass}
          deathsDoorActive={deathsDoorActive}
        />
      </CombatantAttackLunge>
    </div>
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
  impactCue = null,
  turnActive = false,
  turnUrgentHide = false,
  turnShineColors,
  hoverShineActive = false,
  hoverShineColors,
  ccKeyword = null,
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
  impactCue?: CombatImpactCue | null;
  turnActive?: boolean;
  turnUrgentHide?: boolean;
  turnShineColors?: readonly string[];
  hoverShineActive?: boolean;
  hoverShineColors?: readonly string[];
  ccKeyword?: ActiveCcKeyword | null;
}) {
  const { pulse, sparksOverflow } = useImpactPulse(impactCue);

  return (
    <CombatantStatusEffectPresentation keyword={isDead ? null : ccKeyword}>
      <Surface
        surfaceRef={surfaceRef}
        testId={`battle-${side}-art-panel`}
        clipContents={false}
        className={cn(
          "relative",
          cardSurfaceClass,
          !isDead && cardHoverScaleClass,
          cardWidthClass ?? battleCardWidthClass,
          "border",
          isDead ? "border-transparent" : "border-border/80",
          sparksOverflow && "overflow-visible",
          isDead && "overflow-visible !bg-transparent",
        )}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded="rounded-shell-hero"
        onMouseEnter={() => onHoverShimmer(shimmerId)}
      >
        <ArtTurnActiveBorder
          side={side}
          active={turnActive && !isDead}
          urgentHide={turnUrgentHide}
          {...(turnShineColors === undefined ? {} : { shineColor: turnShineColors })}
        />
        {deathsDoorActive ? <ArtDeathDoorBorder /> : null}
        <ArtHoverKeywordBorder
          active={hoverShineActive && !isDead}
          {...(hoverShineColors === undefined ? {} : { shineColor: hoverShineColors })}
        />
        {isDead ? (
          <SliceDeath
            imageUrl={art}
            alt={title}
            imageClassName={side === "enemy" ? landscapeArtImageClass : cardArtImageClass}
          />
        ) : (
          <img
            src={art}
            alt={title}
            className={cn("block w-full", side === "enemy" ? landscapeArtImageClass : cardArtImageClass)}
            loading="eager"
          />
        )}
        <PortraitImpactVfx pulse={pulse} showHealthFlash={!isDead && pulse?.healthLost === true} />
      </Surface>
    </CombatantStatusEffectPresentation>
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
        "relative rounded-shell-inner px-5 py-3.5 surface-muted",
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
          className={cn("mt-1.5 h-3 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")}
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
      <p className={cn("font-sans", sectionTitleClass)}>{title}</p>
      <p
        key={healthToken}
        data-testid={`${side}-health`}
        className={cn("text-lg font-semibold text-amber-100/75", healthToken > 0 && "hp-number-pop")}
      >
        {health}/{maxHealth}
      </p>
    </div>
  );
}

function ActorStatusRow({
  title,
  statuses,
  deathsDoorActive,
  side,
}: Pick<ArtPanelProps, "title" | "statuses" | "side"> & { deathsDoorActive: boolean | undefined }) {
  return (
    <div className="mt-2.5 flex min-h-9 items-center gap-1" data-testid={`${side}-statuses`}>
      {deathsDoorActive ? <DeathsDoorStatusIcon /> : null}
      {statuses.map((status) => (
        <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />
      ))}
    </div>
  );
}
