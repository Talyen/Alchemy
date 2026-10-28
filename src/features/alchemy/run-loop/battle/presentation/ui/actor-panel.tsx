import { GameMessage } from "@/components/localization";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { useGameTranslation } from "@/components/use-game-translation";
import type { EnemyDescriptionContext } from "@/lib/battle";
import { type CSSProperties, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";

import { COMBAT_IMPACT_NORMAL_HEALTH_RATIO, COMBAT_IMPACT_HEAVY_HEALTH_RATIO } from "@/lib/game-constants";
import { Progress } from "@/components/ui/progress";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { bossIdleClips, type BossIdleClip, type BestiaryEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  battleActorSizingStyle,
  battleAnimatedEnemyCardWidthClass,
  battleCardWidthClass,
  battleEnemyCardWidthClass,
  battlePortraitHeightClass,
  cardArtImageClass,
  cardSurfaceClass,
  landscapeArtImageClass,
  sectionTitleClass,
} from "../../../../shared/config/index";
import type { CombatImpactCue, StatusChip } from "../../../../shared/types";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { Surface } from "../../../../shared/ui/surface";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";
import { usePlasmaInteraction } from "../../../../shared/ui/use-plasma-source";
import { PortraitImpactVfx } from "./portrait-hurt-vfx";
import { useImpactPulse } from "./use-hurt-pulse";
import { SliceDeath } from "./slice-death";
import { DeathsDoorStatusIcon, StatusIcon } from "./status-icons";
import { useChangeToken } from "../../../../shared/ui/use-change-token";

import { ActorTooltip, ArtDeathDoorBorder, ArtTurnActiveBorder, StatsDeathDoorBorder } from "./actor-panel-helpers";
import { CombatantStatusEffectPresentation } from "./combatant-status-effect-presentation";
import { CombatantAttackLunge } from "./combatant-attack-lunge";
import { CombatantDodge } from "./combatant-dodge";
import { BossIdleArt } from "./boss-idle-art";
import type { ActiveCcKeyword } from "@/lib/battle";

interface ArtPanelProps {
  side: "player" | "enemy";
  artOverlay?: ReactNode;
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
  cardWidthClass?: string;
  descriptionLines?: string[];
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  currentEnemy?: BestiaryEntry;
  onInspect?: ((trigger: HTMLElement) => void) | undefined;
  inspectionOpen?: boolean;
  activeLabyrinthModifiers?: EncounterCombatTraitId[];
  deathsDoorActive?: boolean;
  deathsDoorGraceTurnsRemaining?: number | null;
  isBoss?: boolean;
  impactCue?: CombatImpactCue | null;
  turnActive?: boolean;
  turnUrgentHide?: boolean;
  turnShineColors?: readonly string[];
  artCorner?: ReactNode;
  ccKeyword?: ActiveCcKeyword | null;
  attackToken?: number;
  castToken?: number;
  dodgeToken?: number;
  plasmaColorPair?: PlasmaColorPair | null;
}

export function ArtPanel(props: ArtPanelProps) {
  const {
    side,
    title,
    health,
    currentEnemy,
    isBoss = false,
    cardWidthClass,
    descriptionLines,
    enemyDescriptionContext,
    activeLabyrinthModifiers = [],
    onInspect,
    inspectionOpen = false,
    isDead = false,
    artCorner,
    attackToken = 0,
    castToken = 0,
    dodgeToken = 0,
    plasmaColorPair = null,
  } = props;
  useGameTranslation();
  const reducedMotion = useReducedMotionPreference();
  const idleClips =
    !reducedMotion && side === "enemy" && isBoss && currentEnemy ? bossIdleClips[currentEnemy.id] : undefined;
  const healthToken = useChangeToken(health);
  const {
    triggerRef: artWrapperRef,
    visible: tooltipVisible,
    ...tooltipHandlers
  } = useHoverVisible({ suspended: inspectionOpen });
  usePlasmaInteraction(plasmaColorPair, tooltipVisible);

  const resolvedCardWidthClass =
    cardWidthClass ??
    (idleClips?.length
      ? battleAnimatedEnemyCardWidthClass
      : side === "enemy"
        ? battleEnemyCardWidthClass
        : battleCardWidthClass);
  const artWrapClass = cn("relative overflow-visible", isBoss && side === "player" && "origin-bottom scale-[1.3]");

  return (
    <div
      className="relative flex flex-col items-center gap-3"
      style={battleActorSizingStyle as CSSProperties}
      data-battle-enemy-format={side === "enemy" ? (idleClips?.length ? "animated" : "static") : undefined}
    >
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
            onMouseMove={tooltipHandlers.onMouseMove}
            onFocusCapture={tooltipHandlers.onFocusCapture}
            onBlurCapture={tooltipHandlers.onBlurCapture}
          >
            <ActorTooltip
              title={title}
              descriptionLines={descriptionLines}
              currentEnemy={currentEnemy}
              enemyDescriptionContext={enemyDescriptionContext}
              activeLabyrinthModifiers={activeLabyrinthModifiers}
              triggerRef={artWrapperRef}
              visible={tooltipVisible}
            />
            <CombatantDodge token={dodgeToken} side={side} isDead={isDead}>
              <ActorArtFrame
                {...props}
                idleClips={idleClips}
                mirrorArt={
                  side === "enemy" && (currentEnemy?.id === "stone-titan" || currentEnemy?.id === "earth-elemental")
                }
                onInspect={
                  onInspect
                    ? (trigger) => {
                        tooltipHandlers.dismiss();
                        onInspect(trigger);
                      }
                    : undefined
                }
                cardWidthClass={resolvedCardWidthClass}
              />
            </CombatantDodge>
          </div>
          {artCorner}
        </div>
        <ActorStatsPanel {...props} healthToken={healthToken} cardWidthClass={resolvedCardWidthClass} />
      </CombatantAttackLunge>
    </div>
  );
}

function ActorArtFrame({
  side,
  artOverlay,
  title,
  art,
  idleClips,
  mirrorArt,
  shimmerId,
  shimmerActive,
  shimmerToken,
  onHoverShimmer,
  surfaceRef,
  onInspect,
  isDead = false,
  cardWidthClass = battleCardWidthClass,
  deathsDoorActive = false,
  impactCue = null,
  maxHealth,
  turnActive = false,
  turnUrgentHide = false,
  turnShineColors,
  ccKeyword = null,
}: ArtPanelProps & { idleClips?: readonly BossIdleClip[] | undefined; mirrorArt: boolean }) {
  const i18n = useGameTranslation();
  const imageClassName = cn(
    idleClips?.length
      ? "aspect-video rounded-shell-hero object-contain"
      : side === "enemy"
        ? landscapeArtImageClass
        : cardArtImageClass,
    battlePortraitHeightClass,
    mirrorArt && "-scale-x-100",
  );
  const { pulse, sparksOverflow } = useImpactPulse(impactCue);
  const recoilRef = useRef<HTMLDivElement>(null);
  const lastRecoilSequence = useRef(0);
  useLayoutEffect(() => {
    const node = recoilRef.current;
    if (!node) return;
    if (!pulse || isDead) {
      node.classList.remove("portrait-recoil-active");
      if (pulse) lastRecoilSequence.current = pulse.sequence;
      return;
    }
    // Maximum Health and death state can change while the same impact is still visible.
    if (pulse.sequence <= lastRecoilSequence.current) return;
    lastRecoilSequence.current = pulse.sequence;
    if (!pulse.recoil) return;
    const ratio = maxHealth > 0 ? pulse.amount / maxHealth : 0;
    node.dataset.impactStrength =
      !pulse.healthLost || pulse.periodic || ratio < COMBAT_IMPACT_NORMAL_HEALTH_RATIO
        ? "light"
        : ratio < COMBAT_IMPACT_HEAVY_HEALTH_RATIO
          ? "normal"
          : "heavy";
    const animations = typeof node.getAnimations === "function" ? node.getAnimations() : [];
    const recoilAnim = animations.find(
      (anim) =>
        (typeof CSSAnimation !== "undefined" &&
          anim instanceof CSSAnimation &&
          anim.animationName === "portraitRecoil") ||
        ("animationName" in anim && anim.animationName === "portraitRecoil"),
    );
    if (recoilAnim) {
      recoilAnim.currentTime = 0;
      recoilAnim.play();
    } else {
      node.classList.remove("portrait-recoil-active");
      node.classList.add("portrait-recoil-active");
    }
  }, [pulse, isDead, maxHealth]);

  return (
    <div
      ref={recoilRef}
      className="portrait-recoil"
      style={{ "--recoil-direction": side === "enemy" ? 1 : -1 } as CSSProperties}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.classList.remove("portrait-recoil-active");
      }}
    >
      <CombatantStatusEffectPresentation keyword={isDead ? null : ccKeyword}>
        <Surface
          surfaceRef={surfaceRef}
          onClick={onInspect && !isDead ? (event) => onInspect(event.currentTarget) : undefined}
          ariaLabel={i18n.text("ui.actor-panel.1", "Inspect {{value0}}", { value0: title })}
          testId={`battle-${side}-art-panel`}
          clipContents={false}
          className={cn(
            "combatant-art relative",
            cardSurfaceClass,
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
            shineColor={turnShineColors}
          />
          {deathsDoorActive ? <ArtDeathDoorBorder /> : null}
          {idleClips?.length ? (
            <BossIdleArt
              key={idleClips[0]?.variants[0]?.src ?? art}
              clips={idleClips}
              art={art}
              title={title}
              isDead={isDead}
              imageClassName={imageClassName}
            />
          ) : isDead ? (
            <SliceDeath imageUrl={art} alt={title} imageClassName={imageClassName} />
          ) : (
            <img
              src={art}
              alt={title}
              className={cn("block w-full", imageClassName)}
              loading="eager"
              decoding="async"
            />
          )}
          {artOverlay}
          <PortraitImpactVfx pulse={pulse} showHealthFlash={!isDead && pulse?.healthLost === true} />
        </Surface>
      </CombatantStatusEffectPresentation>
    </div>
  );
}

function ActorStatsPanel(props: ArtPanelProps & { healthToken: number }) {
  const title = props.title;
  const { health, maxHealth, isDead = false, cardWidthClass = battleCardWidthClass, deathsDoorActive = false } = props;
  const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  const i18n = useGameTranslation();
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
      <div className={cn("relative", isDead && "opacity-0 transition-opacity duration-700")}>
        <ActorHealthHeader {...props} />
        <Progress
          aria-label={i18n.text("ui.actor-panel.2", "{{value0}} health", { value0: title })}
          value={healthPercent}
          className={cn("mt-1.5 h-3 bg-background/80 [&>div]:bg-destructive", isDead && "[&>div]:bg-destructive/30")}
        />
        <ActorStatusRow {...props} />
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
  useGameTranslation();
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className={cn("font-sans", sectionTitleClass)}>{title}</p>
      <p
        key={healthToken}
        data-testid={`${side}-health`}
        className={cn("text-lg font-semibold text-gold-pale/75", healthToken > 0 && "hp-number-pop")}
      >
        <GameMessage
          id="ui.actor-panel.s1"
          defaultValue="<part0/>/<part1/>"
          parts={{ part0: health, part1: maxHealth }}
        />
      </p>
    </div>
  );
}

function ActorStatusRow({
  title,
  statuses,
  deathsDoorActive = false,
  deathsDoorGraceTurnsRemaining = null,
  side,
}: Pick<ArtPanelProps, "deathsDoorGraceTurnsRemaining" | "title" | "statuses" | "side" | "deathsDoorActive">) {
  useGameTranslation();
  return (
    <div
      className="mt-2.5 flex min-h-9 items-center gap-1"
      data-testid={`${side}-statuses`}
      data-combat-status-target={side}
    >
      {deathsDoorActive ? <DeathsDoorStatusIcon remainingTurns={deathsDoorGraceTurnsRemaining} /> : null}
      {statuses.map((status) => (
        <StatusIcon key={`${title}-${status.id}-${status.value}`} chip={status} />
      ))}
    </div>
  );
}
