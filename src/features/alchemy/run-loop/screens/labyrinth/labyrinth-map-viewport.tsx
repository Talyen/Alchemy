import { useGameTranslation } from "@/components/use-game-translation";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { usePlasmaInteraction } from "@/features/alchemy/shared/ui/use-plasma-source";
import { layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";
import { labyrinthFloorVisualStates } from "@/lib/content-systems/labyrinth/map-state";
import { getLabyrinthNodePlasmaPair } from "./labyrinth-plasma";

interface Props {
  map: LabyrinthMap;
  heroArt: string;
  nodes: LabyrinthNode[];
  onSelect: (id: string) => void;
}

export function LabyrinthMapViewport({ map, heroArt, nodes, onSelect }: Props) {
  const i18n = useGameTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const visuals = useMemo(() => labyrinthFloorVisualStates(map), [map]);
  const emphasizedId = hoveredNodeId ?? focusedNodeId;
  const emphasizedNode = useMemo(() => {
    if (!emphasizedId) return null;
    const candidate = nodesById.get(emphasizedId) ?? null;
    const visual = emphasizedId ? visuals.get(emphasizedId) : undefined;
    return candidate && visual && visual !== "undiscovered" ? candidate : null;
  }, [nodesById, emphasizedId, visuals]);
  const emphasizedPlasmaPair = useMemo(
    () => (emphasizedNode ? getLabyrinthNodePlasmaPair(emphasizedNode) : null),
    [emphasizedNode],
  );
  usePlasmaInteraction(emphasizedPlasmaPair, Boolean(emphasizedNode));

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const style = getComputedStyle(element);
      const width = Number.parseFloat(style.width) || element.clientWidth;
      const height = Number.parseFloat(style.height) || element.clientHeight;
      const next = { width, height };
      setSize((previous) => (previous.width === next.width && previous.height === next.height ? previous : next));
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const stage = element.closest('[data-testid="vr-stage"]');
    const styleObserver = new MutationObserver(update);
    if (stage) styleObserver.observe(stage, { attributes: true, attributeFilter: ["style"] });
    update();
    return () => {
      observer.disconnect();
      styleObserver.disconnect();
    };
  }, []);

  const layout = useMemo(() => layoutFloorNodes(nodes, size.width, size.height), [nodes, size.width, size.height]);
  const handleHover = useCallback((nodeId: string | null) => setHoveredNodeId(nodeId), []);
  const handleFocus = useCallback((nodeId: string | null) => setFocusedNodeId(nodeId), []);

  useEffect(() => {
    const clearFocusEmphasis = () => setFocusedNodeId(null);
    window.addEventListener("blur", clearFocusEmphasis);
    document.addEventListener("pointerdown", clearFocusEmphasis, true);
    document.addEventListener("wheel", clearFocusEmphasis, { capture: true, passive: true });
    return () => {
      window.removeEventListener("blur", clearFocusEmphasis);
      document.removeEventListener("pointerdown", clearFocusEmphasis, true);
      document.removeEventListener("wheel", clearFocusEmphasis, true);
    };
  }, []);

  return (
    <section
      aria-label={i18n.text("ui.labyrinth-map-viewport.1", "Labyrinth map")}
      aria-description={i18n.text("ui.labyrinth-map-viewport.msg1", "Floor {{value0}}", {
        value0: i18n.displayText(map.currentFloor),
      })}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div ref={viewportRef} data-testid="labyrinth-viewport" className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {size.width > 0 && size.height > 0 ? (
            <>
              {nodes.map((node) => {
                const point = layout.positions.get(node.id);
                if (!point) return null;
                return (
                  <LabyrinthNodeSeal
                    key={node.id}
                    node={node}
                    visual={visuals.get(node.id) ?? "undiscovered"}
                    current={node.id === map.currentNodeId}
                    heroArt={heroArt}
                    emphasized={hoveredNodeId === node.id || focusedNodeId === node.id}
                    x={point.x}
                    y={point.y}
                    width={layout.metrics.width}
                    height={layout.metrics.height}
                    onSelect={onSelect}
                    onHover={handleHover}
                    onFocus={handleFocus}
                  />
                );
              })}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
