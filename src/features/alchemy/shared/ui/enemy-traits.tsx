import { createElement } from "react";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { extractKeywordIds } from "@/lib/keyword-text";
import type { BestiaryEntry, EnemyTrait } from "../config/game-data-catalog";
import { getEnemyTraitIcon } from "../config/enemy-trait-icons";
import { DescriptionLines } from "./card-description-ui";
import { ShineText } from "./shine-text";
import { TooltipSubheader } from "./tooltip-panel";

function EnemyTraitSection({ trait, modifier = false }: { trait: EnemyTrait; modifier?: boolean }) {
  const Icon = getEnemyTraitIcon(trait, modifier);
  const colors = getKeywordTextShineColors(extractKeywordIds(trait.description));
  return (
    <div data-enemy-trait={trait.id}>
      <TooltipSubheader className="flex items-center gap-2">
        {createElement(Icon, { className: "h-4 w-4 shrink-0", "aria-hidden": true })}
        <ShineText colors={colors}>{trait.title}</ShineText>
      </TooltipSubheader>
      <DescriptionLines lines={trait.description.split("\n")} idPrefix={`enemy-trait-${trait.id}`} />
    </div>
  );
}

export function EnemyTraits({
  entry,
  modifiers = [],
}: {
  entry: Pick<BestiaryEntry, "traits">;
  modifiers?: readonly EncounterCombatTraitId[];
}) {
  const modifierIds = new Set<string>(modifiers);
  return (
    <div className="flex flex-col gap-3">
      {entry.traits
        .filter((trait) => !modifierIds.has(trait.id))
        .map((trait) => (
          <EnemyTraitSection key={trait.id} trait={trait} />
        ))}
      {modifiers.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3">
          <TooltipSubheader>Special Modifiers</TooltipSubheader>
          {[...new Set(modifiers)].map((id) => (
            <EnemyTraitSection key={id} trait={ENCOUNTER_TRAITS[id].enemyTrait} modifier />
          ))}
        </div>
      ) : null}
    </div>
  );
}
