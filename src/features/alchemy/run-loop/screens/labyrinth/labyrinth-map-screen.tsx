import { useEffect } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { ScreenShell, ScreenHeaderRow } from "../../../shared/ui/layout-components";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { canInspectLabyrinthNode, floorNodes } from "@/lib/content-systems/labyrinth/map-state";
import { LabyrinthMapViewport } from "./labyrinth-map-viewport";
import { getLabyrinthNodePlasmaPair } from "./labyrinth-plasma";
import { usePlasmaBaseline } from "@/features/alchemy/shared/ui/use-plasma-source";

interface Props {
  labyrinthMap: LabyrinthMap | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDeselect: () => void;
  onNodeEnter: () => void;
  onDescend: () => void;
}

export function LabyrinthMapScreen({
  labyrinthMap,
  selectedNodeId,
  onNodeSelect,
  onNodeDeselect,
  onNodeEnter,
  onDescend,
}: Props) {
  const selectedNode =
    labyrinthMap && selectedNodeId && canInspectLabyrinthNode(labyrinthMap, selectedNodeId)
      ? (labyrinthMap.nodes[selectedNodeId] ?? null)
      : null;
  usePlasmaBaseline(selectedNode ? getLabyrinthNodePlasmaPair(selectedNode) : null);

  useEffect(() => {
    if (selectedNodeId && !selectedNode) onNodeDeselect();
  }, [selectedNodeId, selectedNode, onNodeDeselect]);

  useEffect(() => {
    if (!selectedNode) return;
    return pushEscapeHandler({
      id: "labyrinth-inspector",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => {
        const menu = document.querySelector("[data-testid=game-menu]");
        if (menu instanceof HTMLElement && !menu.closest(".pointer-events-none")) return false;
        document
          .querySelector<HTMLButtonElement>('[data-labyrinth-node] button[aria-pressed="true"]')
          ?.focus({ preventScroll: true });
        onNodeDeselect();
        return true;
      },
    });
  }, [selectedNode, onNodeDeselect]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ScreenShell className="h-full min-h-0 gap-4" minHeightClass="min-h-0" maxWidthClass="max-w-none">
        <div className="shrink-0">
          <ScreenHeaderRow title="Labyrinth" />
        </div>
        <FadeSlot
          swapKey={labyrinthMap?.currentFloor ?? 1}
          className="labyrinth-floor-swap flex min-h-0 min-w-0 flex-1"
        >
          {labyrinthMap ? (
            <LabyrinthMapViewport
              key={labyrinthMap.currentFloor}
              map={labyrinthMap}
              nodes={floorNodes(labyrinthMap, labyrinthMap.currentFloor)}
              selectedNodeId={selectedNode?.id ?? null}
              onSelect={onNodeSelect}
              onDeselect={onNodeDeselect}
              onEnter={onNodeEnter}
              onDescend={onDescend}
            />
          ) : null}
        </FadeSlot>
      </ScreenShell>
    </div>
  );
}
