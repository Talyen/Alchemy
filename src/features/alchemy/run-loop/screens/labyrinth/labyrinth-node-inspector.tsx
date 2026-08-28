import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION, LABYRINTH_NODE_META, tooltipBodyClass } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { renderColoredKeywords } from "@/features/alchemy/shared/ui/card-description-ui";
import { cn } from "@/lib/utils";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS, NODE_TYPE_TOOLTIPS } from "@/lib/content-systems/labyrinth/data";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  EncounterTraitId,
  LabyrinthNode,
} from "@/lib/content-systems/types";

interface Props {
  node: LabyrinthNode;
  canEnter: boolean;
  onEnter: () => void;
  left: number;
  top: number;
  side: "left" | "right";
  width: number;
}

function ModifierCard({ modifier, variant }: { modifier: EncounterTraitId; variant: "enemy" | "reward" }) {
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

export function LabyrinthNodeInspector({ node, canEnter, onEnter, left, top, side, width }: Props) {
  const meta = LABYRINTH_NODE_META[node.type];
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const title = enemy?.title ?? NODE_TYPE_LABELS[node.type];
  const art = enemy?.art ?? meta.art;
  const enemyModifiers: EncounterCombatTraitId[] = node.modifiers;
  const rewardModifiers: EncounterRewardTraitId[] = node.rewardModifiers;

  return (
    <aside
      aria-label="Chamber details"
      data-side={side}
      className="labyrinth-inspector-in absolute z-30 flex max-h-[min(100%,32rem)] -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      style={{ left, top, width }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/15">
        <img src={art} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <p className="text-xs font-bold tracking-wide text-amber-100/80 uppercase">{NODE_TYPE_LABELS[node.type]}</p>
          <p className="text-lg font-semibold text-amber-50">{title}</p>
        </div>
      </div>
      <p className={cn(tooltipBodyClass, "text-left text-amber-100/80")}>
        {renderColoredKeywords(NODE_TYPE_TOOLTIPS[node.type])}
      </p>
      {enemyModifiers.length > 0 || rewardModifiers.length > 0 ? (
        <div className="grid gap-2">
          {enemyModifiers.map((modifier) => (
            <ModifierCard key={modifier} modifier={modifier} variant="enemy" />
          ))}
          {rewardModifiers.map((modifier) => (
            <ModifierCard key={modifier} modifier={modifier} variant="reward" />
          ))}
        </div>
      ) : null}
      {canEnter ? (
        <Button size="lg" variant="primary" className={cn(BUTTON_WIDTH_ACTION, "mt-auto w-full")} onClick={onEnter}>
          {meta.actionLabel}
        </Button>
      ) : null}
    </aside>
  );
}
