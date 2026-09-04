import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { TitledScreenShell } from "../../../shared/ui/shared-ui";
import { cn } from "@/lib/utils";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { floorNodes, labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";

import { inspectorPlacement, clampInspectorTop, layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeInspector } from "./labyrinth-node-inspector";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";
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
  const playableDepths = useMemo(() => new Set(playableFloors.map((floor) => floor.depth)), [playableFloors]);
  useEffect(() => {
    if (currentFloor > viewedFloor || (labyrinthMap !== null && !playableDepths.has(viewedFloor))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync viewed floor to current floor when advancing
      setViewedFloor(currentFloor);
    }
  }, [currentFloor, viewedFloor, labyrinthMap, playableDepths]);

  useEffect(() => {
    if (!selectedNodeId || !labyrinthMap) return;
    const node = labyrinthMap.nodes[selectedNodeId];
    if (!node || node.floor !== viewedFloor) onNodeDeselect();
  }, [selectedNodeId, viewedFloor, labyrinthMap, onNodeDeselect]);

  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(0);
  useLayoutEffect(() => {
    const element = mapCanvasRef.current;
    if (!element) return;
    const updateWidth = () => {
      const next = element.clientWidth;
      setMapWidth((prev) => (prev === next ? prev : next));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const nodes = labyrinthMap ? floorNodes(labyrinthMap, viewedFloor) : [];
  const layout = mapWidth > 0 ? layoutFloorNodes(nodes, mapWidth) : null;
  const selectedNode =
    selectedNodeId && labyrinthMap && layout?.positions.has(selectedNodeId)
      ? (labyrinthMap.nodes[selectedNodeId] ?? null)
      : null;
  const selectedPoint = selectedNode ? layout?.positions.get(selectedNode.id) : undefined;
  const selectedCanEnter =
    selectedNode && labyrinthMap ? labyrinthNodeVisualState(labyrinthMap, selectedNode.id) === "reachable" : false;
  const inspectorNodeId = selectedNode?.id ?? null;
  const inspector =
    selectedNode && selectedPoint && layout
      ? inspectorPlacement(selectedPoint.x, selectedPoint.y, layout.metrics.width, mapWidth)
      : null;

  const [inspectorPanel, setInspectorPanel] = useState<HTMLElement | null>(null);
  const [inspectorHeight, setInspectorHeight] = useState(0);
  useEffect(() => {
    if (!inspectorPanel) return;
    const updateHeight = () => setInspectorHeight(inspectorPanel.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(inspectorPanel);
    return () => observer.disconnect();
  }, [inspectorPanel]);
  const inspectorTop =
    inspector && layout ? clampInspectorTop(inspector.top, inspectorHeight, layout.height) : inspector?.top;

  usePlasmaBaseline(selectedNode ? getLabyrinthNodePlasmaPair(selectedNode) : null);

  useEffect(() => {
    if (!inspectorNodeId) return;
    return pushEscapeHandler({
      id: "labyrinth-inspector",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => {
        const menu = document.querySelector("[data-testid=game-menu]");
        if (menu instanceof HTMLElement && !menu.closest(".pointer-events-none")) return false;
        onNodeDeselect();
        return true;
      },
    });
  }, [inspectorNodeId, onNodeDeselect]);

  return (
    <TitledScreenShell
      title="Labyrinth"
      eyebrow={`Floor ${viewedFloor}`}
      maxWidthClass="max-w-7xl"
      headerActions={
        playableFloors.length > 1 ? (
          <div className="flex items-center gap-1">
            {playableFloors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => {
                  if (floor.depth === viewedFloor) return;
                  onNodeDeselect();
                  setViewedFloor(floor.depth);
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-sm font-semibold",
                  viewedFloor === floor.depth
                    ? "bg-amber-400/20 text-amber-100"
                    : "text-amber-100/60 hover:text-amber-100",
                )}
              >
                Floor {floor.depth}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <section aria-label="Labyrinth map" className="relative min-w-0">
          <div
            ref={mapCanvasRef}
            className="relative w-full"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- canvas is keyboard-operable entry point for selected chamber with Enter/Space
            tabIndex={0}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && selectedCanEnter) {
                event.preventDefault();
                onNodeEnter();
              }
            }}
          >
            {labyrinthMap && layout ? (
              <FadeSlot swapKey={viewedFloor} className="relative w-full">
                <div
                  className="relative mx-auto transition-[height] duration-300 ease-out"
                  style={{ width: "100%", height: layout.height }}
                  onClick={onNodeDeselect}
                >
                  {nodes.map((node) => {
                    const point = layout.positions.get(node.id);
                    if (!point) return null;
                    return (
                      <LabyrinthNodeSeal
                        key={node.id}
                        node={node}
                        map={labyrinthMap}
                        selected={selectedNodeId === node.id}
                        x={point.x}
                        y={point.y}
                        width={layout.metrics.width}
                        height={layout.metrics.height}
                        onSelect={onNodeSelect}
                      />
                    );
                  })}
                  {selectedNode && inspector && inspectorTop !== undefined ? (
                    <LabyrinthNodeInspector
                      key={selectedNode.id}
                      node={selectedNode}
                      canEnter={selectedCanEnter}
                      onEnter={onNodeEnter}
                      left={inspector.left}
                      top={inspectorTop}
                      side={inspector.side}
                      width={inspector.width}
                      panelRef={setInspectorPanel}
                    />
                  ) : null}
                </div>
              </FadeSlot>
            ) : null}
          </div>
        </section>
      </div>
    </TitledScreenShell>
  );
}
