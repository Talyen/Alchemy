// Hover tooltip for a labyrinth map node, including modifier breakdown.

import type { RefObject } from "react";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  EncounterTraitId,
  LabyrinthNodeType,
} from "@/lib/content-systems/types";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS, NODE_TYPE_TOOLTIPS } from "@/lib/content-systems/labyrinth/data";
import { cn } from "@/lib/utils";

import { renderColoredKeywords } from "../../../shared/ui/card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSection } from "../../../shared/ui/tooltip-panel";
import { PortaledTooltip } from "../../../shared/ui/portaled-tooltip";
import { getPlasmaColorPairFromColors, LABYRINTH_NODE_META, tooltipBodyClass } from "@/features/alchemy/shared/config";

interface Props {
  type: LabyrinthNodeType;
  modifiers: EncounterCombatTraitId[];
  rewardModifiers: EncounterRewardTraitId[];
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}

function ModifierTooltipCard({ modifier, variant }: { modifier: EncounterTraitId; variant: "enemy" | "reward" }) {
  const definition = ENCOUNTER_TRAITS[modifier];
  return (
    <div
      className={cn(
        "rounded-lg bg-white/[0.03] px-3.5 py-2.5",
        variant === "enemy" ? "border border-red-500/40" : "border border-emerald-500/40",
      )}
    >
      <p className="text-xs font-bold text-amber-100 uppercase">{definition.label}</p>
      <p className={cn(tooltipBodyClass, "mt-0.5")}>{renderColoredKeywords(definition.description)}</p>
    </div>
  );
}

export function LabyrinthNodeTooltip({ type, modifiers, rewardModifiers, triggerRef, visible }: Props) {
  const enemyModifiers = modifiers;
  const hasModifiers = enemyModifiers.length > 0 || rewardModifiers.length > 0;

  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      maxWidthFraction={0.4}
      className="rounded-shell-tooltip"
      plasmaColorPair={getPlasmaColorPairFromColors(LABYRINTH_NODE_META[type].shineColors)}
    >
      <TooltipHeader>{NODE_TYPE_LABELS[type]}</TooltipHeader>
      <TooltipBody>
        <p>{renderColoredKeywords(NODE_TYPE_TOOLTIPS[type])}</p>
      </TooltipBody>
      {hasModifiers ? (
        <TooltipSection label="Modifiers">
          <div className="mt-1 grid gap-2">
            {enemyModifiers.map((modifier) => (
              <ModifierTooltipCard key={modifier} modifier={modifier} variant="enemy" />
            ))}
            {rewardModifiers.map((modifier) => (
              <ModifierTooltipCard key={modifier} modifier={modifier} variant="reward" />
            ))}
          </div>
        </TooltipSection>
      ) : null}
    </PortaledTooltip>
  );
}
