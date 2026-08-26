// Side inspector for the selected labyrinth hex: art, traits, and Enter CTA.
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import { LABYRINTH_NODE_META, tooltipBodyClass } from "@/features/alchemy/shared/config";
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
  node: LabyrinthNode | null;
  onEnter: () => void;
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

export function LabyrinthNodeInspector({ node, onEnter }: Props) {
  if (!node) {
    return (
      <aside
        aria-label="Chamber details"
        className="flex h-full min-h-0 w-full flex-col justify-center rounded-xl border border-white/10 bg-black/30 px-5 py-6 text-center"
      >
        <p className="text-sm text-amber-100/70">Choose a reachable chamber</p>
      </aside>
    );
  }

  const meta = LABYRINTH_NODE_META[node.type];
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const title = enemy?.title ?? NODE_TYPE_LABELS[node.type];
  const art = enemy?.art ?? meta.art;
  const enemyModifiers: EncounterCombatTraitId[] = node.modifiers;
  const rewardModifiers: EncounterRewardTraitId[] = node.rewardModifiers;

  return (
    <aside
      aria-label="Chamber details"
      className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-4"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/15">
        <img src={art} alt="" className="h-full w-full object-cover" />
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
      <Button size="lg" variant="primary" className={cn(BUTTON_WIDTH_ACTION, "mt-auto w-full")} onClick={onEnter}>
        {meta.actionLabel}
      </Button>
    </aside>
  );
}
