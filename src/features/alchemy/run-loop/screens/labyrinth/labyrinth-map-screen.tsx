import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { ScreenShell, ScreenHeaderRow } from "../../../shared/ui/shared-ui";
import { cn } from "@/lib/utils";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { floorNodes, labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";

import { LabyrinthNodeInspector } from "./labyrinth-node-inspector";
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

  const contentRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const update = () => {
      const contentScale = Number(getComputedStyle(element).getPropertyValue("--content-scale")) || 1;
      setWide(element.clientWidth >= 760 * contentScale);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const stage = element.closest('[data-testid="vr-stage"]');
    const styleObserver = new MutationObserver(update);
    if (stage) styleObserver.observe(stage, { attributes: true, attributeFilter: ["style"] });
    return () => {
      observer.disconnect();
      styleObserver.disconnect();
    };
  }, []);

  const nodes = labyrinthMap ? floorNodes(labyrinthMap, viewedFloor) : [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId && !node.cleared) ?? null;
  const selectedCanEnter =
    selectedNode && labyrinthMap ? labyrinthNodeVisualState(labyrinthMap, selectedNode.id) === "reachable" : false;
  const inspectorNodeId = selectedNode?.id ?? null;
  const sheetOpen = !wide && selectedNode !== null;

  useLayoutEffect(() => {
    if (!sheetOpen) return;
    const previousFocus = document.activeElement;
    inspectorRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [sheetOpen]);

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
        <div ref={contentRef} className="relative flex min-h-0 flex-1 gap-5">
          <FadeSlot swapKey={viewedFloor} className="flex min-h-0 min-w-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1" inert={sheetOpen}>
              {labyrinthMap ? (
                <LabyrinthMapViewport
                  key={viewedFloor}
                  map={labyrinthMap}
                  nodes={nodes}
                  selectedNodeId={selectedNodeId}
                  onSelect={onNodeSelect}
                  onDeselect={onNodeDeselect}
                />
              ) : null}
            </div>
          </FadeSlot>
          {sheetOpen ? (
            <button
              type="button"
              className="absolute inset-0 z-40 bg-black/40"
              aria-label="Dismiss chamber details"
              onClick={onNodeDeselect}
              tabIndex={-1}
            />
          ) : null}
          {wide || selectedNode ? (
            <div
              ref={inspectorRef}
              className={cn(
                "flex min-h-0 flex-col",
                wide
                  ? "w-[calc(21.25*var(--content-rem,1rem))] shrink-0"
                  : "absolute inset-x-0 bottom-0 z-50 max-h-[90%]",
              )}
            >
              {selectedNode ? (
                <LabyrinthNodeInspector
                  key={selectedNode.id}
                  node={selectedNode}
                  canEnter={selectedCanEnter}
                  onEnter={onNodeEnter}
                  onClose={onNodeDeselect}
                />
              ) : wide ? (
                <div className="flex h-full items-center justify-center rounded-shell-hero border border-white/5 px-5 text-center text-sm text-amber-100/50">
                  Select a chamber to inspect it
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </ScreenShell>
    </div>
  );
}
