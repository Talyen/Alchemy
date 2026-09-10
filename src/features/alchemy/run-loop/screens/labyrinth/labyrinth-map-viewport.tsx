import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { usePlasmaInteraction } from "@/features/alchemy/shared/ui/use-plasma-source";
import { layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";
import { LabyrinthNodeInspector } from "./labyrinth-node-inspector";
import { isNodeDiscovered } from "@/lib/content-systems/labyrinth/map-state";
import { getLabyrinthNodePlasmaPair } from "./labyrinth-plasma";

interface Props {
  map: LabyrinthMap;
  nodes: LabyrinthNode[];
  selectedNodeId: string | null;
  onEnter: () => void;
  onDescend: () => void;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

export function LabyrinthMapViewport({ map, nodes, selectedNodeId, onEnter, onDescend, onSelect, onDeselect }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, scale: 1 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const emphasizedNode = nodes.find(
    (node) => node.id === (hoveredNodeId ?? focusedNodeId) && isNodeDiscovered(map, node.id),
  );
  usePlasmaInteraction(
    emphasizedNode && emphasizedNode.id !== selectedNodeId ? getLabyrinthNodePlasmaPair(emphasizedNode) : null,
    Boolean(emphasizedNode),
  );

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const style = getComputedStyle(element);
      const width = Number.parseFloat(style.width) || element.clientWidth;
      const height = Number.parseFloat(style.height) || element.clientHeight;
      const scale = width > 0 ? element.getBoundingClientRect().width / width : 1;
      setSize({ width, height, scale: scale > 0 ? scale : 1 });
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

  const layout = layoutFloorNodes(nodes, size.width, size.height);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const inspector = inspectorRef.current;
    const trigger = viewport?.querySelector<HTMLElement>('[data-labyrinth-node] button[aria-pressed="true"]');
    if (!viewport || !inspector || !trigger || !selectedNodeId) return;
    let cancelled = false;
    let needsFocus = true;
    inspector.style.visibility = "hidden";
    const update = () => {
      void computePosition(trigger, inspector, {
        placement: "right",
        middleware: [
          offset(10 / size.scale),
          flip({ boundary: viewport, padding: 8, fallbackPlacements: ["left", "top", "bottom"] }),
          shift({ boundary: viewport, padding: 8, crossAxis: true }),
        ],
      }).then(({ x, y }) => {
        if (cancelled) return;
        inspector.style.left = `${x}px`;
        inspector.style.top = `${y}px`;
        inspector.style.visibility = "visible";
        if (needsFocus) {
          needsFocus = false;
          inspector.focus({ preventScroll: true });
        }
      });
    };
    const cleanup = autoUpdate(trigger, inspector, update);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [selectedNodeId, size]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (inspectorRef.current?.contains(target) || target.closest("[data-labyrinth-node]")) return;
      onDeselect();
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [selectedNodeId, onDeselect]);

  return (
    <section
      aria-label="Labyrinth map"
      aria-description={`Floor ${map.currentFloor}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div ref={viewportRef} data-testid="labyrinth-viewport" className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {size.width > 0 && size.height > 0 ? (
            <>
              {nodes.map((node) => {
                const point = layout.positions.get(node.id)!;
                return (
                  <LabyrinthNodeSeal
                    key={node.id}
                    node={node}
                    map={map}
                    selected={selectedNodeId === node.id}
                    emphasized={selectedNodeId === node.id || hoveredNodeId === node.id || focusedNodeId === node.id}
                    x={point.x}
                    y={point.y}
                    width={layout.metrics.width}
                    height={layout.metrics.height}
                    onSelect={onSelect}
                    onHover={setHoveredNodeId}
                    onFocus={setFocusedNodeId}
                  />
                );
              })}
            </>
          ) : null}
        </div>
        {selectedNode ? (
          <div
            ref={inspectorRef}
            tabIndex={-1}
            className="absolute z-40 flex flex-col outline-none"
            style={{
              width: `clamp(${320 / size.scale}px,calc(26*var(--content-rem,1rem)),${420 / size.scale}px)`,
              maxWidth: Math.max(0, size.width - 16 / size.scale),
              maxHeight: Math.max(0, size.height - 16 / size.scale),
            }}
          >
            <LabyrinthNodeInspector
              key={selectedNode.id}
              node={selectedNode}
              map={map}
              onEnter={onEnter}
              onDescend={onDescend}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
