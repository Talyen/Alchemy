import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";

import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import { compareHexPositions } from "@/lib/content-systems/labyrinth/hex-grid";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";
import { LabyrinthNodeInspector } from "./labyrinth-node-inspector";

interface Props {
  map: LabyrinthMap;
  nodes: LabyrinthNode[];
  selectedNodeId: string | null;
  onEnter: () => void;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  readScrollPosition: () => number | undefined;
  saveScrollPosition: (position: number) => void;
}

export function LabyrinthMapViewport({
  map,
  nodes,
  selectedNodeId,
  onEnter,
  onSelect,
  onDeselect,
  readScrollPosition,
  saveScrollPosition,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeSizeRef = useRef<HTMLDivElement>(null);
  const initializedScroll = useRef(false);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, nodeWidth: 0 });
  const selectedNode = nodes.find(
    (node) => node.id === selectedNodeId && labyrinthNodeVisualState(map, node.id) === "reachable",
  );

  useLayoutEffect(() => {
    const element = scrollRef.current;
    const nodeSize = nodeSizeRef.current;
    if (!element || !nodeSize) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight, nodeWidth: nodeSize.offsetWidth });
    });
    observer.observe(element);
    observer.observe(nodeSize);
    return () => observer.disconnect();
  }, []);

  const layout = layoutFloorNodes(nodes, size.width, size.nodeWidth);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !size.width || !size.nodeWidth || initializedScroll.current) return;
    initializedScroll.current = true;
    const first = nodes
      .filter((node) => labyrinthNodeVisualState(map, node.id) === "reachable")
      .sort((a, b) => compareHexPositions(a.gridPosition, b.gridPosition))[0];
    const point = first ? layout.positions.get(first.id) : null;
    scroll.scrollTop = readScrollPosition() ?? (point ? Math.max(0, point.y - layout.metrics.height / 2 - 16) : 0);
  }, [layout, map, nodes, readScrollPosition, size]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const inspector = inspectorRef.current;
    const trigger = viewport?.querySelector<HTMLElement>('[data-labyrinth-node][aria-pressed="true"]');
    if (!viewport || !inspector || !trigger || !selectedNodeId) return;
    let cancelled = false;
    let needsFocus = true;
    inspector.style.visibility = "hidden";
    const update = () => {
      const chamber = trigger.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      if (
        chamber.bottom <= bounds.top ||
        chamber.top >= bounds.bottom ||
        chamber.right <= bounds.left ||
        chamber.left >= bounds.right
      ) {
        inspector.style.visibility = "hidden";
        onDeselect();
        return;
      }
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
    const cleanup = autoUpdate(trigger, inspector, update, { animationFrame: true });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [selectedNodeId, size, onDeselect]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (inspectorRef.current?.contains(target) || target.closest("button[data-labyrinth-node]")) return;
      onDeselect();
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [selectedNodeId, onDeselect]);

  return (
    <section aria-label="Labyrinth map" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={viewportRef} data-testid="labyrinth-viewport" className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={nodeSizeRef}
          aria-hidden
          className="pointer-events-none invisible absolute h-0 w-[calc(12.5*var(--content-rem,1rem))]"
        />
        <div
          ref={scrollRef}
          data-testid="labyrinth-scroll"
          className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain"
          onScroll={(event) => saveScrollPosition(event.currentTarget.scrollTop)}
        >
          <div className="relative w-full" style={{ height: layout.height }}>
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
          </div>
        </div>
        {selectedNode ? (
          <div
            ref={inspectorRef}
            tabIndex={-1}
            className="absolute z-40 flex max-h-[calc(100%-16px)] w-[calc(21.25*var(--content-rem,1rem))] max-w-[calc(100%-16px)] flex-col outline-none"
          >
            <LabyrinthNodeInspector key={selectedNode.id} node={selectedNode} onEnter={onEnter} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
