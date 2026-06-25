import { ShineBorder } from "@/components/ui/shine-border";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import { SHINE_PALETTES } from "../../config";
import { DescriptionLines } from "../card-description-ui";
import { EnemyTooltip } from "../enemy-tooltip";
import { TooltipHeader, TooltipPanel } from "../tooltip-panel";

const ACTOR_PANEL_CONFIG = {
  deathDoorShineDurationSeconds: 4,
  deathDoorArtBorderWidth: 3,
  deathDoorStatsBorderWidth: 2,
} as const;

export function ActorTooltip({
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

export function ArtDeathDoorBorder() {
  return (
    <ShineBorder
      borderWidth={ACTOR_PANEL_CONFIG.deathDoorArtBorderWidth}
      duration={ACTOR_PANEL_CONFIG.deathDoorShineDurationSeconds}
      shineColor={[...SHINE_PALETTES.deathsDoorArt]}
      className="rounded-shell-hero"
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
