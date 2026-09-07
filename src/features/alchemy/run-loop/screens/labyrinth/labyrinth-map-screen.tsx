import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { ScreenShell, ScreenHeaderRow } from "../../../shared/ui/shared-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    () =>
      labyrinthMap ? labyrinthMap.floors.filter((floor) => floor.depth > 0).sort((a, b) => a.depth - b.depth) : [],
    [labyrinthMap],
  );
  const [viewedFloor, setViewedFloor] = useState(labyrinthMap?.currentFloor ?? 1);
  const currentFloor = labyrinthMap?.currentFloor ?? 1;
  const previousFloor = useRef(currentFloor);
  const scrollPositions = useRef(new Map<number, number>());
  const readScrollPosition = useCallback(() => scrollPositions.current.get(viewedFloor), [viewedFloor]);
  const saveScrollPosition = useCallback(
    (position: number) => {
      scrollPositions.current.set(viewedFloor, position);
    },
    [viewedFloor],
  );
  const playableDepths = useMemo(() => new Set(playableFloors.map((floor) => floor.depth)), [playableFloors]);
  useEffect(() => {
    const advanced = currentFloor > previousFloor.current;
    previousFloor.current = currentFloor;
    if (advanced || (labyrinthMap !== null && !playableDepths.has(viewedFloor))) {
      scrollPositions.current.delete(currentFloor);
      onNodeDeselect();
      setViewedFloor(currentFloor);
    }
  }, [currentFloor, viewedFloor, labyrinthMap, playableDepths, onNodeDeselect]);

  useEffect(() => {
    if (!selectedNodeId || !labyrinthMap) return;
    const node = labyrinthMap.nodes[selectedNodeId];
    if (!node || node.floor !== viewedFloor || labyrinthNodeVisualState(labyrinthMap, node.id) !== "reachable")
      onNodeDeselect();
  }, [selectedNodeId, viewedFloor, labyrinthMap, onNodeDeselect]);

  const nodes = labyrinthMap ? floorNodes(labyrinthMap, viewedFloor) : [];
  const selectedNode =
    nodes.find(
      (node) =>
        node.id === selectedNodeId && labyrinthMap && labyrinthNodeVisualState(labyrinthMap, node.id) === "reachable",
    ) ?? null;
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
          <ScreenHeaderRow
            title="Labyrinth"
            trailing={
              playableFloors.length > 0 ? (
                <Select
                  value={String(viewedFloor)}
                  onValueChange={(value) => {
                    onNodeDeselect();
                    setViewedFloor(Number(value));
                  }}
                >
                  <SelectTrigger aria-label="Floor" className="w-auto shrink-0 gap-2 px-3 py-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {playableFloors.map((floor) => (
                      <SelectItem key={floor.id} value={String(floor.depth)}>
                        Floor {floor.depth}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null
            }
          />
        </div>
        <div className="relative flex min-h-0 flex-1">
          <FadeSlot swapKey={viewedFloor} className="labyrinth-floor-swap flex min-h-0 min-w-0 flex-1">
            {labyrinthMap ? (
              <LabyrinthMapViewport
                key={viewedFloor}
                map={labyrinthMap}
                nodes={nodes}
                selectedNodeId={selectedNode?.id ?? null}
                onEnter={onNodeEnter}
                onSelect={onNodeSelect}
                onDeselect={onNodeDeselect}
                readScrollPosition={readScrollPosition}
                saveScrollPosition={saveScrollPosition}
              />
            ) : null}
          </FadeSlot>
        </div>
      </ScreenShell>
    </div>
  );
}
