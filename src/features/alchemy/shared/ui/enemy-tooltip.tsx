// Structured hover popup for enemy data in battle and bestiary collection.
// Depends on enemy formatting utilities and the shared portaled tooltip panel.
// Used by ArtPanel (battle) and CompendiumTile (collection) to show attacks and traits.
import type { RefObject } from "react";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";

import { formatEnemyAttackLines } from "../utils";
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
  const separatelyDisplayedTraitIds = visible ? new Set<string>(labyrinthModifiers) : null;
  const traitLines =
    visible && separatelyDisplayedTraitIds
      ? entry.traits
          .filter((trait) => !separatelyDisplayedTraitIds.has(trait.id))
          .flatMap((trait) => trait.description.split("\n"))
      : [];

  return (
    <PortaledTooltip triggerRef={triggerRef} visible={visible} width="w-72" className="rounded-shell-tooltip">
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
