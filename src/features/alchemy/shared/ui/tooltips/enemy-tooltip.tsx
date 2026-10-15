import { useGameTranslation } from "@/components/use-game-translation";

import type { EnemyDescriptionContext } from "@/lib/battle";
import type { RefObject } from "react";
import type { BestiaryEntry } from "@/lib/game-data";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getPlasmaColorPairForEnemy } from "../../config";
import { EnemyTraits } from "../enemy-traits";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";

export function EnemyTooltip({
  enemyDescriptionContext,
  entry,
  discovered = true,
  labyrinthModifiers = [],
  triggerRef,
  visible,
}: {
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  entry: BestiaryEntry;
  discovered?: boolean;
  labyrinthModifiers?: EncounterCombatTraitId[];
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  const i18n = useGameTranslation();
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      width="w-fit max-w-128"
      className="rounded-shell-tooltip"
      plasmaColorPair={discovered ? getPlasmaColorPairForEnemy(entry) : null}
    >
      <TooltipHeader>
        {i18n.displayText(discovered ? entry.title : i18n.text("ui.enemy-tooltip.d1", "Undiscovered"))}
      </TooltipHeader>
      {discovered ? (
        <EnemyTraits
          enemyDescriptionContext={enemyDescriptionContext}
          entry={entry}
          modifiers={labyrinthModifiers}
          variant="compact"
        />
      ) : (
        <TooltipBody>
          <p>{i18n.text("ui.enemy-tooltip.1", "Undiscovered")}</p>
        </TooltipBody>
      )}
    </PortaledTooltip>
  );
}
