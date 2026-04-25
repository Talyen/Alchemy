import { type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { keywordDefinitions } from '@/shared/content/keywords';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';
import { talentAtlasEdges, talentAtlasNodes, talentAtlasSize, type TalentAtlasNode } from '@/features/talents/talentAtlas';

const TOTAL_TALENT_POINTS = 8;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.45;

type DragState = {
  pointerId: number;
  startPanX: number;
  startPanY: number;
  startX: number;
  startY: number;
};

function withAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

export function TalentsScreen() {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [pan, setPan] = useState({ x: -750, y: -520 });
  const [zoom, setZoom] = useState(0.88);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const availablePoints = Math.max(TOTAL_TALENT_POINTS - selectedNodeIds.length, 0);
  const keywordLegend = useMemo(() => Object.values(keywordDefinitions), []);
  const nodeMap = useMemo(() => new Map(talentAtlasNodes.map((node) => [node.id, node])), []);

  const toggleNode = (nodeId: string) => {
    setSelectedNodeIds((current) => {
      if (current.includes(nodeId)) {
        return current.filter((entry) => entry !== nodeId);
      }

      if (current.length >= TOTAL_TALENT_POINTS) {
        return current;
      }

      return [...current, nodeId];
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startPanX: pan.x,
      startPanY: pan.y,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPan({
      x: dragState.startPanX + (event.clientX - dragState.startX),
      y: dragState.startPanY + (event.clientY - dragState.startY),
    });
  };

  const stopDragging = () => {
    setDragState(null);
  };

  const handleZoom = (delta: number, originX: number, originY: number) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));

    if (nextZoom === zoom) {
      return;
    }

    setPan((current) => ({
      x: originX - ((originX - current.x) / zoom) * nextZoom,
      y: originY - ((originY - current.y) / zoom) * nextZoom,
    }));
    setZoom(nextZoom);
  };

  const getNodeColorStops = (node: TalentAtlasNode) => {
    const [primaryKeyword, secondaryKeyword] = node.keywords;
    const primaryColor = keywordDefinitions[primaryKeyword].color;

    if (!secondaryKeyword) {
      return {
        background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 32%), linear-gradient(180deg, ${withAlpha(primaryColor, '5e')} 0%, rgba(17, 13, 17, 0.96) 100%)`,
        borderColor: withAlpha(primaryColor, '80'),
        glowColor: withAlpha(primaryColor, '30'),
        primaryColor,
      };
    }

    const secondaryColor = keywordDefinitions[secondaryKeyword].color;

    return {
      background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 32%), linear-gradient(135deg, ${withAlpha(primaryColor, '5c')} 0%, ${withAlpha(primaryColor, '3a')} 48%, ${withAlpha(secondaryColor, '3a')} 52%, ${withAlpha(secondaryColor, '5c')} 100%)`,
      borderColor: withAlpha(primaryColor, '80'),
      glowColor: withAlpha(secondaryColor, '34'),
      primaryColor,
    };
  };

  return (
    <div className="h-full px-6 py-8" data-testid="screen-talents">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
          <Card className="p-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Available Talent Points</p>
              <p className="text-4xl font-black">{availablePoints}</p>
            </div>
          </Card>

          <div className="space-y-2 text-center">
            <AnimatedScreenTitle ta="center">Talents</AnimatedScreenTitle>
            <p className="mx-auto max-w-[760px] text-sm text-muted-foreground">
              The talent tree is now one large atlas. Drag to pan, scroll to zoom, hover nodes for details, and click to allocate points into keyword clusters across the web.
            </p>
          </div>

          <div className="flex items-start justify-end">
            <Button onClick={() => setSelectedNodeIds([])} variant="outline">
              Reset All Talents
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="relative min-h-[620px] overflow-hidden border-white/10 bg-[radial-gradient(circle_at_15%_15%,rgba(207,168,86,0.14),transparent_24%),radial-gradient(circle_at_85%_25%,rgba(77,124,214,0.12),transparent_24%),linear-gradient(180deg,rgba(19,16,19,0.98)_0%,rgba(10,9,12,0.98)_100%)] p-0">
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              onWheel={(event) => {
                event.preventDefault();

                const rect = viewportRef.current?.getBoundingClientRect();

                if (!rect) {
                  return;
                }

                const originX = event.clientX - rect.left;
                const originY = event.clientY - rect.top;

                handleZoom(event.deltaY < 0 ? 0.08 : -0.08, originX, originY);
              }}
              ref={viewportRef}
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:120px_120px] opacity-30" />
              <div
                className="absolute left-0 top-0"
                style={{
                  height: talentAtlasSize.height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  width: talentAtlasSize.width,
                }}
              >
                <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${talentAtlasSize.width} ${talentAtlasSize.height}`}>
                  <defs>
                    {talentAtlasEdges.map(([from, to]) => {
                      const fromNode = nodeMap.get(from);
                      const toNode = nodeMap.get(to);

                      if (!fromNode || !toNode) {
                        return null;
                      }

                      return (
                        <linearGradient id={`edge-${from}-${to}`} key={`edge-gradient-${from}-${to}`} x1={fromNode.x} x2={toNode.x} y1={fromNode.y} y2={toNode.y} gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor={keywordDefinitions[fromNode.keywords[0]].color} />
                          <stop offset="100%" stopColor={keywordDefinitions[toNode.keywords[0]].color} />
                        </linearGradient>
                      );
                    })}
                  </defs>

                  {talentAtlasEdges.map(([from, to]) => {
                    const fromNode = nodeMap.get(from);
                    const toNode = nodeMap.get(to);

                    if (!fromNode || !toNode) {
                      return null;
                    }

                    return (
                      <path
                        d={`M ${fromNode.x} ${fromNode.y} C ${(fromNode.x + toNode.x) / 2} ${fromNode.y}, ${(fromNode.x + toNode.x) / 2} ${toNode.y}, ${toNode.x} ${toNode.y}`}
                        fill="none"
                        key={`edge-${from}-${to}`}
                        stroke={`url(#edge-${from}-${to})`}
                        strokeLinecap="round"
                        strokeOpacity="0.78"
                        strokeWidth="10"
                      />
                    );
                  })}
                </svg>

                {talentAtlasNodes.map((node) => {
                  const allocated = selectedNodeIds.includes(node.id);
                  const locked = !allocated && availablePoints === 0;
                  const nodeColors = getNodeColorStops(node);
                  const Icon = node.icon;

                  return (
                    <HoverCard key={node.id} openDelay={70} closeDelay={120}>
                      <HoverCardTrigger asChild>
                        <button
                          className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 bg-transparent"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleNode(node.id);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          style={{ left: node.x, top: node.y }}
                          type="button"
                        >
                          <span
                            className="flex h-[76px] w-[76px] items-center justify-center rounded-full border text-foreground transition-transform duration-150 group-hover:scale-[1.04]"
                            style={{
                              background: nodeColors.background,
                              borderColor: nodeColors.borderColor,
                              boxShadow: allocated
                                ? `0 0 0 4px ${withAlpha(nodeColors.primaryColor, '28')}, 0 0 28px ${nodeColors.glowColor}`
                                : `0 0 18px ${withAlpha(nodeColors.primaryColor, '20')}`,
                              opacity: locked ? 0.52 : 1,
                            }}
                          >
                            <Icon size={28} stroke={2.1} style={{ color: '#f6ead8' }} />
                          </span>
                          <span className="max-w-[136px] text-center text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(246,238,224,0.82)]">
                            {node.title}
                          </span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-[280px]">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-base font-bold">{node.title}</p>
                            <div className="flex flex-wrap gap-2">
                              {node.keywords.filter(Boolean).map((keywordId) => {
                                const keyword = keywordDefinitions[keywordId!];

                                return (
                                  <span
                                    className="rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em]"
                                    key={`${node.id}-${keyword.id}`}
                                    style={{ borderColor: withAlpha(keyword.color, '55'), color: keyword.color }}
                                  >
                                    {keyword.label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{node.description}</p>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: allocated ? nodeColors.primaryColor : 'rgba(236,229,215,0.72)' }}>
                            {allocated ? 'Allocated' : locked ? 'No points available' : 'Click to allocate'}
                          </p>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
              </div>
            </div>

            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-panel backdrop-blur-sm">
              <span>Zoom {Math.round(zoom * 100)}%</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/70" />
              <span>Drag to pan</span>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Keyword Legend</p>
              <p className="text-sm text-muted-foreground">Nodes inherit color directly from their keywords. Dual-keyword nodes split the palette to show hybrid paths.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {keywordLegend.map((keyword) => (
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-card/40 px-3 py-2" key={keyword.id}>
                  <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: keyword.color }} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold" style={{ color: keyword.color }}>
                      {keyword.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{keyword.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}