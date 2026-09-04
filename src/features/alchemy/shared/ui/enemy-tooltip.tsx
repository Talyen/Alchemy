import type { RefObject } from "react";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";

import { formatEnemyAttackLines } from "../utils";
import { getPlasmaColorPairForEnemy } from "../config";
import { DescriptionLines } from "./card-description-ui";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipHeader, TooltipSection, TooltipSeparator } from "./tooltip-panel";

function EnemyTooltipModifiers({ modifiers }: { modifiers: EncounterCombatTraitId[] }) {
  if (modifiers.length === 0) return null;
  return (
    <>
      <TooltipSeparator />
      <TooltipSection label="Special Modifiers">
        <TooltipBody>
          {modifiers.map((modifier) => {
            const def = ENCOUNTER_TRAITS[modifier];
            return def ? (
              <p key={modifier}>
                <span className="font-semibold text-amber-100">{def.label}:</span> {def.description}
              </p>
            ) : null;
          })}
        </TooltipBody>
      </TooltipSection>
    </>
  );
}

export function EnemyTooltip({
  entry,
  discovered = true,
  attackEffects,
  labyrinthModifiers = [],
  triggerRef,
  visible,
}: {
  entry: BestiaryEntry;
  discovered?: boolean;
  attackEffects?: EnemyAttackEffect[] | undefined;
  labyrinthModifiers?: EncounterCombatTraitId[];
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  const attackLines = visible ? formatEnemyAttackLines(attackEffects ?? entry.attackEffects) : [];
  const traitLines = visible
    ? entry.traits
        .filter((trait) => !labyrinthModifiers.includes(trait.id as EncounterCombatTraitId))
        .flatMap((trait) => trait.description.split("\n"))
    : [];

  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      className="rounded-shell-tooltip"
      plasmaColorPair={getPlasmaColorPairForEnemy(entry, attackEffects)}
    >
      <TooltipHeader>{discovered ? entry.title : "Undiscovered"}</TooltipHeader>
      {discovered ? (
        <DescriptionLines lines={[...attackLines, ...traitLines]} idPrefix={`enemy-${entry.id}`} />
      ) : (
        <TooltipBody>
          <p>Undiscovered</p>
        </TooltipBody>
      )}
      <EnemyTooltipModifiers modifiers={labyrinthModifiers} />
    </PortaledTooltip>
  );
}
