import { FlaskConical, Gift, Leaf, Pickaxe, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LABYRINTH_NODE_META, keywordIcons } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId, keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { extractKeywordIds } from "@/features/alchemy/shared/config/keywords";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { ShineText } from "@/features/alchemy/shared/ui/shine-text";
import { renderColoredKeywords } from "@/features/alchemy/shared/ui/card-description-ui";
import { cn } from "@/lib/utils";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { canDescendFromLabyrinthNode, canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import { LABYRINTH_COMBAT_TRAIT_KEYWORDS, LABYRINTH_REWARD_TRAIT_KEYWORDS } from "./labyrinth-plasma";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  EncounterTraitId,
  LabyrinthMap,
  LabyrinthNode,
} from "@/lib/content-systems/types";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  onEnter: () => void;
  onDescend: () => void;
}

const TRAIT_ICONS: Partial<Record<EncounterTraitId, typeof Gift>> = {
  alchemist: FlaskConical,
  scavenger: Pickaxe,
  herbalist: Leaf,
};

function Trait({ id }: { id: EncounterTraitId }) {
  const definition = ENCOUNTER_TRAITS[id];
  const keywords = extractKeywordIds(definition.description);
  const thematic =
    definition.category === "combat"
      ? LABYRINTH_COMBAT_TRAIT_KEYWORDS[id as EncounterCombatTraitId]
      : LABYRINTH_REWARD_TRAIT_KEYWORDS[id as EncounterRewardTraitId];
  const primary = thematic?.[0] ?? keywords[0];
  const Icon = TRAIT_ICONS[id] ?? (primary ? keywordIcons[primary] : definition.category === "combat" ? Swords : Gift);
  return (
    <div className="flex items-start gap-3 rounded-shell-compact border border-white/10 bg-white/[0.03] p-3">
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-8 shrink-0", primary ? keywordDefinitions[primary].colorClass : "text-stone-400")}
      />
      <div className="min-w-0">
        <h3 className="text-lg font-semibold">
          <ShineText
            colors={getKeywordTextShineColors(keywords.length > 0 ? keywords : (thematic ?? []))}
            fallbackClassName="text-stone-200"
          >
            {definition.label}
          </ShineText>
        </h3>
        <p className="mt-1 text-base leading-relaxed whitespace-pre-line text-stone-300">
          {renderColoredKeywords(definition.description)}
        </p>
      </div>
    </div>
  );
}

export function LabyrinthNodeInspector({ node, map, onEnter, onDescend }: Props) {
  const meta = LABYRINTH_NODE_META[node.type];
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const category = NODE_TYPE_LABELS[node.type];
  const title = enemy?.title ?? category;
  const enterable = canEnterLabyrinthNode(map, node.id);
  const descend = canDescendFromLabyrinthNode(map, node.id);
  const remaining = Object.values(map.nodes).filter((room) => room.floor === map.currentFloor && !room.cleared).length;

  return (
    <aside
      aria-label="Chamber details"
      className="labyrinth-inspector-in flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-shell-panel border border-stone-500/50 bg-stone-950 shadow-xl motion-reduce:animate-none"
    >
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
        <div className="relative overflow-hidden rounded-shell-compact bg-black" data-testid="chamber-art">
          <img src={enemy?.art ?? meta.art} alt="" className="block h-auto w-full" draggable={false} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-12">
            {category !== title ? (
              <p className="text-lg font-semibold tracking-widest text-stone-200 uppercase">{category}</p>
            ) : null}
            <h2 className="text-3xl font-semibold text-stone-100">{title}</h2>
          </div>
        </div>
        {map.currentNodeId === node.id ? <p className="mt-3 text-sm text-amber-200/80">You are here</p> : null}
        {node.modifiers.length > 0 ? (
          <div className="mt-5 space-y-4">
            {node.modifiers.map((id) => (
              <Trait key={id} id={id} />
            ))}
          </div>
        ) : null}
        {node.rewardModifiers.length > 0 ? (
          <div className="mt-4 space-y-4">
            {node.rewardModifiers.map((id) => (
              <Trait key={id} id={id} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 p-4">
        {descend ? (
          <>
            {remaining > 0 ? (
              <p className="mb-3 text-sm text-stone-400">
                Leave {remaining} unexplored {remaining === 1 ? "chamber" : "chambers"} behind.
              </p>
            ) : null}
            <Button size="lg" variant="primary" className="w-full" onClick={onDescend}>
              Descend
            </Button>
          </>
        ) : enterable ? (
          <Button size="lg" variant="primary" className="w-full" onClick={onEnter}>
            {meta.actionLabel}
          </Button>
        ) : (
          <p className="text-sm text-stone-400">
            {node.cleared ? "Completed" : "Explore an adjacent chamber to enter."}
          </p>
        )}
      </div>
    </aside>
  );
}
