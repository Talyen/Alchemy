import { text as gameText, displayText } from "@/lib/localization/runtime";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { EnemyTraits } from "@/features/alchemy/shared/ui/enemy-traits";
import { TraitBox } from "@/features/alchemy/shared/ui/trait-box";
import { Button } from "@/components/ui/button";
import { LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { canDescendFromLabyrinthNode, canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  onEnter: () => void;
  onDescend: () => void;
}

export function LabyrinthNodeInspector({ node, map, onEnter, onDescend }: Props) {
  useGameTranslation();
  const meta = LABYRINTH_NODE_META[node.type];
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const category = NODE_TYPE_LABELS[node.type];
  const title = enemy?.title ?? category;
  const enterable = canEnterLabyrinthNode(map, node.id);
  const descend = canDescendFromLabyrinthNode(map, node.id);
  const remaining = Object.values(map.nodes).filter((room) => room.floor === map.currentFloor && !room.cleared).length;

  return (
    <aside
      aria-label={gameText("ui.labyrinth-node-inspector.1", "Chamber details")}
      className="labyrinth-inspector-in flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-shell-panel border border-stone-500/50 bg-stone-950 shadow-xl motion-reduce:animate-none"
    >
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
        <div className="relative overflow-hidden rounded-shell-compact bg-black" data-testid="chamber-art">
          <img src={enemy?.art ?? meta.art} alt="" decoding="async" className="block h-auto w-full" draggable={false} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-12">
            {node.type === "entrance" || category !== title ? (
              <p className="text-base font-semibold tracking-widest text-stone-200 uppercase">
                {displayText(
                  node.type === "entrance"
                    ? gameText("ui.labyrinth-node-inspector.d1", "Floor {{value0}}", {
                        value0: displayText(node.floor),
                      })
                    : category,
                )}
              </p>
            ) : null}
            <h2 className="text-3xl font-semibold text-stone-100">{displayText(title)}</h2>
          </div>
        </div>
        {enemy || node.modifiers.length > 0 ? (
          <div className="mt-5 space-y-4">
            <EnemyTraits entry={enemy ?? { traits: [] }} modifiers={node.modifiers} />
          </div>
        ) : null}
        {node.rewardModifiers.length > 0 ? (
          <div className="mt-4 space-y-4">
            {node.rewardModifiers.map((id) => (
              <TraitBox key={id} trait={ENCOUNTER_TRAITS[id].enemyTrait} />
            ))}
          </div>
        ) : null}
      </div>
      {descend || enterable ? (
        <div className="shrink-0 p-4">
          {descend ? (
            <>
              {remaining > 0 ? (
                <p className="mb-3 text-sm text-stone-400">
                  <GameMessage
                    id="ui.labyrinth-node-inspector.s1"
                    defaultValue="Leave <part0/> unexplored <part1/> behind."
                    parts={{
                      part0: displayText(remaining),
                      part1: displayText(
                        remaining === 1
                          ? gameText("ui.labyrinth-node-inspector.d2", "chamber")
                          : gameText("ui.labyrinth-node-inspector.d3", "chambers"),
                      ),
                    }}
                  />
                </p>
              ) : null}
              <Button size="lg" variant="primary" className="w-full" onClick={onDescend}>
                {gameText("ui.labyrinth-node-inspector.5", "Descend")}
              </Button>
            </>
          ) : (
            <Button size="lg" variant="primary" className="w-full" onClick={onEnter}>
              {displayText(meta.actionLabel)}
            </Button>
          )}
        </div>
      ) : null}
    </aside>
  );
}
