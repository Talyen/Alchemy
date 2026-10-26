import { useGameTranslation } from "@/components/use-game-translation";

import { playUISound } from "@/lib/audio";
import { useEffect, useMemo } from "react";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { ScreenShell, ScreenHeaderRow } from "../../../shared/ui/layout-components";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import {
  canDescendFromLabyrinthNode,
  canEnterLabyrinthNode,
  canInspectLabyrinthNode,
  floorNodes,
} from "@/lib/content-systems/labyrinth/map-state";
import { LabyrinthMapViewport } from "./labyrinth-map-viewport";
import { usePlasmaBaseline } from "@/features/alchemy/shared/ui/use-plasma-source";

interface Props {
  labyrinthMap: LabyrinthMap | null;
  heroArt: string;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDeselect: () => void;
  onNodeEnter: () => void;
  onDescend: () => void;
}

export function LabyrinthMapScreen({
  labyrinthMap,
  heroArt,
  selectedNodeId,
  onNodeSelect,
  onNodeDeselect,
  onNodeEnter,
  onDescend,
}: Props) {
  const i18n = useGameTranslation();
  const selectedNode =
    labyrinthMap && selectedNodeId && canInspectLabyrinthNode(labyrinthMap, selectedNodeId)
      ? (labyrinthMap.nodes[selectedNodeId] ?? null)
      : null;
  usePlasmaBaseline(null);
  const nodes = useMemo(
    () => (labyrinthMap ? floorNodes(labyrinthMap, labyrinthMap.currentFloor) : []),
    [labyrinthMap],
  );

  useEffect(() => {
    if (selectedNodeId && !selectedNode) onNodeDeselect();
  }, [selectedNodeId, selectedNode, onNodeDeselect]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ScreenShell className="h-full min-h-0 gap-4" maxWidthClass="max-w-none">
        <div className="shrink-0">
          <ScreenHeaderRow title={i18n.text("ui.labyrinth-map-screen.1", "Labyrinth")} />
        </div>
        <FadeSlot
          swapKey={labyrinthMap?.currentFloor ?? 1}
          className="labyrinth-floor-swap flex min-h-0 min-w-0 flex-1"
        >
          {labyrinthMap ? (
            <LabyrinthMapViewport
              key={labyrinthMap.currentFloor}
              map={labyrinthMap}
              heroArt={heroArt}
              nodes={nodes}
              onSelect={(id) => {
                const descend = canDescendFromLabyrinthNode(labyrinthMap, id);
                if (!descend && !canEnterLabyrinthNode(labyrinthMap, id)) return;
                // Selection writes synchronously, so entry resolves the clicked room in this same activation.
                onNodeSelect(id);
                if (descend) onDescend();
                else onNodeEnter();
                playUISound("mapNode");
              }}
            />
          ) : null}
        </FadeSlot>
      </ScreenShell>
    </div>
  );
}
