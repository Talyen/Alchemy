import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";

import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";
import { LabyrinthNodeInspector } from "./labyrinth-node-inspector";

interface Props {
  map: LabyrinthMap;
  nodes: LabyrinthNode[];
  selectedNodeId: string | null;
  canEnter: boolean;
  onEnter: () => void;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

export function LabyrinthMapViewport({ map, nodes, selectedNodeId, canEnter, onEnter, onSelect, onDeselect }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const selectedNode = nodes.find((node) => node.id === selectedNodeId && !node.cleared);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const inspector = inspectorRef.current;
    const trigger = viewport?.querySelector<HTMLElement>('[data-labyrinth-node][aria-pressed="true"]');
    if (!viewport || !inspector || !trigger || !selectedNodeId) return;
    let cancelled = false;
    let needsFocus = true;
    inspector.style.visibility = "hidden";
    const update = () => {
      void computePosition(trigger, inspector, {
        placement: "right",
        middleware: [
          offset(8),
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

  const layout = layoutFloorNodes(nodes, size.width, size.height);

  return (
    <section aria-label="Labyrinth map" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={viewportRef} data-testid="labyrinth-viewport" className="relative min-h-0 flex-1 overflow-hidden">
        {nodes.map((node) => {
          const point = layout.positions.get(node.id);
          if (!point) return null;
          return (
            <LabyrinthNodeSeal
              key={node.id}
              node={node}
              map={map}
              selected={selectedNodeId === node.id}
              x={point.x}
              y={point.y}
              width={layout.metrics.width}
              height={layout.metrics.height}
              onSelect={onSelect}
            />
          );
        })}
        {selectedNode ? (
          <div
            ref={inspectorRef}
            tabIndex={-1}
            className="absolute z-40 flex max-h-[calc(100%-16px)] w-[calc(27.5*var(--content-rem,1rem))] max-w-[calc(100%-16px)] flex-col outline-none"
          >
            <LabyrinthNodeInspector key={selectedNode.id} node={selectedNode} canEnter={canEnter} onEnter={onEnter} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
