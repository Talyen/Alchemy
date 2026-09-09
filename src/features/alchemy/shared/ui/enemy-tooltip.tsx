import type { RefObject } from "react";
import type { BestiaryEntry } from "@/lib/game-data";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getPlasmaColorPairForEnemy } from "../config";
import { EnemyTraits } from "./enemy-traits";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";

export function EnemyTooltip({
  entry,
  discovered = true,
  labyrinthModifiers = [],
  triggerRef,
  visible,
}: {
  entry: BestiaryEntry;
  discovered?: boolean;
  labyrinthModifiers?: EncounterCombatTraitId[];
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      className="rounded-shell-tooltip"
      plasmaColorPair={discovered ? getPlasmaColorPairForEnemy(entry) : null}
    >
      <TooltipHeader>{discovered ? entry.title : "Undiscovered"}</TooltipHeader>
      {discovered ? (
        <EnemyTraits entry={entry} modifiers={labyrinthModifiers} />
      ) : (
        <TooltipBody>
          <p>Undiscovered</p>
        </TooltipBody>
      )}
    </PortaledTooltip>
  );
}
