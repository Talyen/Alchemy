import { useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { layoutFloorNodes } from "./labyrinth-map-layout";
import { LabyrinthNodeSeal } from "./labyrinth-node-seal";

interface Props {
  map: LabyrinthMap;
  nodes: LabyrinthNode[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

export function LabyrinthMapViewport({ map, nodes, selectedNodeId, onSelect, onDeselect }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const previousView = useRef({ width: 0, height: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const previous = previousView.current;
    const centerX = previous.width ? (element.scrollLeft + previous.width / 2) / (previous.width * previous.zoom) : 0.5;
    const centerY = previous.height
      ? (element.scrollTop + previous.height / 2) / (previous.height * previous.zoom)
      : 0.5;
    element.scrollLeft = centerX * size.width * zoom - size.width / 2;
    element.scrollTop = centerY * size.height * zoom - size.height / 2;
    previousView.current = { ...size, zoom };
  }, [size, zoom]);

  const layout = layoutFloorNodes(nodes, size.width, size.height);

  return (
    <section aria-label="Labyrinth map" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div
        ref={viewportRef}
        data-testid="labyrinth-viewport"
        data-zoom={zoom}
        className={cn(
          "relative min-h-0 flex-1 overflow-auto overscroll-contain",
          zoom > 1 && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (zoom === 1 || event.pointerType !== "mouse" || event.button !== 0) return;
          const element = event.currentTarget;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: element.scrollLeft,
            top: element.scrollTop,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const element = event.currentTarget;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.moved && Math.hypot(dx, dy) < 4) return;
          start.moved = true;
          suppressClick.current = true;
          element.setPointerCapture(event.pointerId);
          const scale = element.getBoundingClientRect().width / element.clientWidth;
          element.scrollLeft = start.left - dx / scale;
          element.scrollTop = start.top - dy / scale;
        }}
        onPointerUp={(event) => {
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          suppressClick.current = false;
        }}
        onPointerLeave={() => {
          if (!drag.current?.moved) drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }}
      >
        <div style={{ width: size.width * zoom, height: size.height * zoom }}>
          <div
            className="relative origin-top-left"
            style={{ width: size.width, height: size.height, transform: `scale(${zoom})` }}
            onClick={onDeselect}
          >
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
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2" role="group" aria-label="Map view">
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          disabled={zoom <= 1}
          onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setZoom(1)}>
          <Scan className="mr-2 h-4 w-4" /> Fit floor
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          disabled={zoom >= 2.5}
          onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
