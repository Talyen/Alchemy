import { getEncounterEnemyTrait, type EnemyDescriptionContext } from "@/lib/battle";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { cn } from "@/lib/utils";
import type { BestiaryEntry } from "../config/game-data-catalog";
import { selectEnemyTraits } from "../config/enemy-trait-selection";
import { TraitBox, type TraitBoxVariant } from "./trait-box";

export function EnemyTraits({
  entry,
  enemyDescriptionContext,
  modifiers = [],
  layout = "stacked",
  variant = "default",
}: {
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  entry: Pick<BestiaryEntry, "traits">;
  modifiers?: readonly EncounterCombatTraitId[];
  layout?: "stacked" | "inspection";
  variant?: TraitBoxVariant;
}) {
  const traits = new Map(selectEnemyTraits(entry, modifiers).map((trait) => [trait.id, trait]));
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
            <TraitBox
              trait={enemyDescriptionContext ? getEncounterEnemyTrait(trait, enemyDescriptionContext) : trait}
              variant={variant}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
