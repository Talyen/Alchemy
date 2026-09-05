import type { RefObject } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { SHINE_PALETTES } from "../../config";
import { DescriptionLines } from "../card-description-ui";
import { EnemyTooltip } from "../enemy-tooltip";
import { TooltipHeader } from "../tooltip-panel";
import { PortaledTooltip } from "../portaled-tooltip";

const ACTOR_PANEL_CONFIG = {
  deathDoorShineDurationSeconds: 4,
  deathDoorArtBorderWidth: 3,
  deathDoorStatsBorderWidth: 2,
  turnActiveShineDurationSeconds: 4,
  turnActiveArtBorderWidth: 3,
} as const;

export function ActorTooltip({
  title,
  descriptionLines,
  currentEnemy,
  currentEnemyAttackEffects,
  activeLabyrinthModifiers,
  triggerRef,
  visible,
}: {
  title: string;
  descriptionLines: string[] | undefined;
  currentEnemy: BestiaryEntry | undefined;
  currentEnemyAttackEffects: EnemyAttackEffect[] | undefined;
  activeLabyrinthModifiers?: EncounterCombatTraitId[] | undefined;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  if (currentEnemy) {
    return (
      <EnemyTooltip
        entry={currentEnemy}
        attackEffects={currentEnemyAttackEffects}
        labyrinthModifiers={activeLabyrinthModifiers ?? []}
        triggerRef={triggerRef}
        visible={visible}
      />
    );
  }

  if (!descriptionLines) return null;
  return (
    <PortaledTooltip triggerRef={triggerRef} visible={visible}>
      <TooltipHeader>{title}</TooltipHeader>
      <DescriptionLines lines={descriptionLines} idPrefix={`enemy-${title}`} />
    </PortaledTooltip>
  );
}

export function ArtTurnActiveBorder({
  side,
  active,
  urgentHide = false,
  shineColor,
  testId,
}: {
  side: "player" | "enemy";
  active: boolean;
  urgentHide?: boolean;
  shineColor?: readonly string[];
  testId?: string;
}) {
  const palette = shineColor ?? SHINE_PALETTES.turnEnemy;
  const resolvedTestId = testId ?? (side === "player" ? "turn-badge-player" : "turn-badge-enemy");
  return (
    <ShineBorder
      data-testid={resolvedTestId}
      data-active={active ? "true" : "false"}
      borderWidth={ACTOR_PANEL_CONFIG.turnActiveArtBorderWidth}
      duration={ACTOR_PANEL_CONFIG.turnActiveShineDurationSeconds}
      shineColor={[...palette]}
      className={cn(
        "z-[5] rounded-shell-hero transition-opacity",
        urgentHide ? "duration-150" : "duration-500",
        active ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

export function ArtHoverKeywordBorder({ active, shineColor }: { active: boolean; shineColor?: readonly string[] }) {
  if (!active || !shineColor || shineColor.length === 0) return null;

  return (
    <ShineBorder
      data-testid="keyword-shine-enemy"
      borderWidth={2}
      shineColor={[...shineColor]}
      className="z-20 rounded-shell-hero"
    />
  );
}

export function ArtDeathDoorBorder() {
  return (
    <ShineBorder
      borderWidth={ACTOR_PANEL_CONFIG.deathDoorArtBorderWidth}
      duration={ACTOR_PANEL_CONFIG.deathDoorShineDurationSeconds}
      shineColor={[...SHINE_PALETTES.deathsDoorArt]}
      className="z-10 rounded-shell-hero"
    />
  );
}

export function StatsDeathDoorBorder() {
  return (
    <ShineBorder
      borderWidth={ACTOR_PANEL_CONFIG.deathDoorStatsBorderWidth}
      duration={ACTOR_PANEL_CONFIG.deathDoorShineDurationSeconds}
      shineColor={[...SHINE_PALETTES.deathsDoorStats]}
      className="rounded-shell-inner"
    />
  );
}
