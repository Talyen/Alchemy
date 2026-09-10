import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { cn } from "@/lib/utils";
import type { BestiaryEntry } from "../config/game-data-catalog";
import { TraitBox } from "./trait-box";

export function EnemyTraits({
  entry,
  modifiers = [],
  layout = "stacked",
}: {
  entry: Pick<BestiaryEntry, "traits">;
  modifiers?: readonly EncounterCombatTraitId[];
  layout?: "stacked" | "inspection";
}) {
  const modifierIds = new Set<string>(modifiers);
  const traits = new Map(
    [
      ...entry.traits.filter((trait) => !modifierIds.has(trait.id)),
      ...modifiers.map((id) => ENCOUNTER_TRAITS[id].enemyTrait),
    ].map((trait) => [trait.id, trait]),
  );
  return (
    <div className={cn(layout === "inspection" && "@container")}>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          layout === "inspection" && traits.size > 1 && "@min-[40rem]:grid-cols-2",
        )}
      >
        {[...traits.values()].map((trait) => (
          <div key={trait.id} data-enemy-trait={trait.id} className="grid min-w-0">
            <TraitBox trait={trait} />
          </div>
        ))}
      </div>
    </div>
  );
}
