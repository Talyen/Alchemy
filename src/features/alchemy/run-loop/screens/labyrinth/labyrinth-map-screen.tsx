import { useEffect, useMemo, useRef, useState } from "react";

import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { ScreenShell, ScreenHeaderRow } from "../../../shared/ui/shared-ui";
import { cn } from "@/lib/utils";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { floorNodes, labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";

import { LabyrinthMapViewport } from "./labyrinth-map-viewport";
import { getLabyrinthNodePlasmaPair } from "./labyrinth-plasma";
import { usePlasmaBaseline } from "@/features/alchemy/shared/ui/use-plasma-source";

interface Props {
  labyrinthMap: LabyrinthMap | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDeselect: () => void;
  onNodeEnter: () => void;
}

export function LabyrinthMapScreen({ labyrinthMap, selectedNodeId, onNodeSelect, onNodeDeselect, onNodeEnter }: Props) {
  const playableFloors = useMemo(
    () => (labyrinthMap ? labyrinthMap.floors.filter((floor) => floor.depth > 0) : []),
    [labyrinthMap],
  );
  const [viewedFloor, setViewedFloor] = useState(labyrinthMap?.currentFloor ?? 1);
  const currentFloor = labyrinthMap?.currentFloor ?? 1;
  const previousFloor = useRef(currentFloor);
  const playableDepths = useMemo(() => new Set(playableFloors.map((floor) => floor.depth)), [playableFloors]);
  useEffect(() => {
    const advanced = currentFloor > previousFloor.current;
    previousFloor.current = currentFloor;
    if (advanced || (labyrinthMap !== null && !playableDepths.has(viewedFloor))) {
      setViewedFloor(currentFloor);
    }
  }, [currentFloor, viewedFloor, labyrinthMap, playableDepths]);

  useEffect(() => {
    if (!selectedNodeId || !labyrinthMap) return;
    const node = labyrinthMap.nodes[selectedNodeId];
    if (!node || node.floor !== viewedFloor) onNodeDeselect();
  }, [selectedNodeId, viewedFloor, labyrinthMap, onNodeDeselect]);

  const nodes = labyrinthMap ? floorNodes(labyrinthMap, viewedFloor) : [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId && !node.cleared) ?? null;
  const selectedCanEnter =
    selectedNode && labyrinthMap ? labyrinthNodeVisualState(labyrinthMap, selectedNode.id) === "reachable" : false;
  const inspectorNodeId = selectedNode?.id ?? null;
  usePlasmaBaseline(selectedNode ? getLabyrinthNodePlasmaPair(selectedNode) : null);

  useEffect(() => {
    if (!inspectorNodeId) return;
    return pushEscapeHandler({
      id: "labyrinth-inspector",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => {
        const menu = document.querySelector("[data-testid=game-menu]");
        if (menu instanceof HTMLElement && !menu.closest(".pointer-events-none")) return false;
        document
          .querySelector<HTMLButtonElement>('[data-labyrinth-node][aria-pressed="true"]')
          ?.focus({ preventScroll: true });
        onNodeDeselect();
        return true;
      },
    });
  }, [inspectorNodeId, onNodeDeselect]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ScreenShell className="h-full min-h-0 gap-4" minHeightClass="min-h-0" maxWidthClass="max-w-7xl">
        <div className="shrink-0">
          <ScreenHeaderRow title="Labyrinth" eyebrow={`Floor ${viewedFloor}`} />
        </div>
        {playableFloors.length > 1 ? (
          <div className="flex shrink-0 gap-2 overflow-x-auto" role="group" aria-label="Floors">
            {playableFloors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                aria-pressed={viewedFloor === floor.depth}
                onClick={() => {
                  if (floor.depth === viewedFloor) return;
                  onNodeDeselect();
                  setViewedFloor(floor.depth);
                }}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-sm font-semibold",
                  viewedFloor === floor.depth
                    ? "bg-amber-400/20 text-amber-100"
                    : "text-amber-100/60 hover:text-amber-100",
                )}
              >
                Floor {floor.depth}
              </button>
            ))}
          </div>
        ) : null}
        <div className="relative flex min-h-0 flex-1">
          <FadeSlot swapKey={viewedFloor} className="flex min-h-0 min-w-0 flex-1">
            {labyrinthMap ? (
              <LabyrinthMapViewport
                key={viewedFloor}
                map={labyrinthMap}
                nodes={nodes}
                selectedNodeId={selectedNode?.id ?? null}
                canEnter={selectedCanEnter}
                onEnter={onNodeEnter}
                onSelect={onNodeSelect}
                onDeselect={onNodeDeselect}
              />
            ) : null}
          </FadeSlot>
        </div>
      </ScreenShell>
    </div>
  );
}
