/**
 * Labyrinth hex-floor map with a desktop side inspector.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ScreenDescription, TitledScreenShell } from "../../../shared/ui/shared-ui";
import { settingsPanelShellClass } from "@/features/alchemy/shared/config";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { floorNodes } from "@/lib/content-systems/labyrinth/map-state";

import { layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeInspector } from "./labyrinth-node-inspector";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";

interface Props {
  labyrinthMap: LabyrinthMap | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDeselect: () => void;
  onNodeEnter: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}

export function LabyrinthMapScreen({
  labyrinthMap,
  selectedNodeId,
  onNodeSelect,
  onNodeDeselect,
  onNodeEnter,
  onOpenMenu,
}: Props) {
  const playableFloors = useMemo(
    () => (labyrinthMap ? labyrinthMap.floors.filter((floor) => floor.depth > 0) : []),
    [labyrinthMap],
  );
  const [viewedFloor, setViewedFloor] = useState(labyrinthMap?.currentFloor ?? 1);

  useEffect(() => {
    if (!labyrinthMap) return;
    const depths = new Set(labyrinthMap.floors.filter((floor) => floor.depth > 0).map((floor) => floor.depth));
    setViewedFloor((current) => {
      if (labyrinthMap.currentFloor > current) return labyrinthMap.currentFloor;
      if (!depths.has(current)) return labyrinthMap.currentFloor;
      return current;
    });
  }, [labyrinthMap]);

  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(0);
  useLayoutEffect(() => {
    const element = mapCanvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setMapWidth(element.clientWidth));
    observer.observe(element);
    setMapWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const nodes = labyrinthMap ? floorNodes(labyrinthMap, viewedFloor) : [];
  const layout = mapWidth > 0 ? layoutFloorNodes(nodes, mapWidth) : null;
  const selectedNode = selectedNodeId && labyrinthMap ? (labyrinthMap.nodes[selectedNodeId] ?? null) : null;

  return (
    <TitledScreenShell
      title="Labyrinth"
      onOpenMenu={onOpenMenu}
      menuLabel="Open labyrinth menu"
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
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <ScreenDescription className="max-w-xl shrink-0 text-amber-100/75">
          Choose your path through the depths
        </ScreenDescription>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <section
            aria-label="Labyrinth map"
            className={cn(settingsPanelShellClass, "relative min-h-0 min-w-0 flex-1")}
          >
            <div className="relative h-full w-full overflow-hidden p-4">
              <div
                ref={mapCanvasRef}
                className="relative h-full w-full"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onNodeDeselect();
                    return;
                  }
                  if ((event.key === "Enter" || event.key === " ") && selectedNodeId) {
                    event.preventDefault();
                    onNodeEnter();
                  }
                }}
              >
                {labyrinthMap && layout ? (
                  <div
                    className="relative mx-auto"
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
                          onDeselect={onNodeDeselect}
                          onEnter={onNodeEnter}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="min-h-0 shrink-0" style={{ width: LABYRINTH_MAP_UI.inspectorWidthPx }}>
            <LabyrinthNodeInspector node={selectedNode} onEnter={onNodeEnter} />
          </div>
        </div>
      </div>
    </TitledScreenShell>
  );
}
