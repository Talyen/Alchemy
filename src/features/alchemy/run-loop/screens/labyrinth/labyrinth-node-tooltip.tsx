import { useGameTranslation } from "@/components/use-game-translation";
import { EnemyTraits } from "@/features/alchemy/shared/ui/enemy-traits";
import { TraitBox } from "@/features/alchemy/shared/ui/trait-box";
import { TooltipBody, TooltipHeader } from "@/features/alchemy/shared/ui/tooltips/tooltip-panel";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import type { LabyrinthNode } from "@/lib/content-systems/types";

export function LabyrinthNodeTooltip({ node }: { node: LabyrinthNode }) {
  const i18n = useGameTranslation();
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  return (
    <>
      <TooltipHeader>{i18n.displayText(enemy?.title ?? NODE_TYPE_LABELS[node.type])}</TooltipHeader>
      {enemy?.traits.length || node.modifiers.length || node.rewardModifiers.length ? (
        <TooltipBody className="space-y-3">
          <EnemyTraits entry={enemy ?? { traits: [] }} modifiers={node.modifiers} variant="tooltip" />
          {node.rewardModifiers.map((id) => (
            <TraitBox key={id} trait={ENCOUNTER_TRAITS[id].enemyTrait} variant="tooltip" />
          ))}
        </TooltipBody>
      ) : null}
    </>
  );
}
