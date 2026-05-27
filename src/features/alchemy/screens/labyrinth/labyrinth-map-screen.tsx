/**
 * Screen rendering the Labyrinth node connection grid and active modifiers tooltip.
 * Depends on: labyrinth/data.ts, modifiers.ts, screen-store.ts, Lucide icons, UI components
 * Depended on by: render-alchemy-screen.tsx
 */
import { type CSSProperties, useState } from "react";

import { HamburgerTrigger, ScreenHeader } from "../../ui/shared-ui";
import { useScreenStore } from "../../stores/screen-store";

import { LabyrinthConnectionLayer } from "./labyrinth-connection-layer";
import { LabyrinthNodeButton, type HoveredLabyrinthNode } from "./labyrinth-node-button";
import { LabyrinthNodeTooltip } from "./labyrinth-node-tooltip";
import { positionStyle } from "./labyrinth-map-layout";

type Props = {
  onNodeClick: (row: number, col: number) => void;
  onOpenMenu: (rect?: DOMRect) => void;
};

export function LabyrinthMapScreen({ onNodeClick, onOpenMenu }: Props) {
  const labyrinthMap = useScreenStore((s) => s.labyrinthMap);
  const [hoveredNode, setHoveredNode] = useState<HoveredLabyrinthNode | null>(null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden px-3 py-4 text-center sm:gap-5 sm:px-5 sm:py-6">
      <ScreenHeader title="Labyrinth" />
      <p className="max-w-xl text-sm text-amber-100/75">Choose your path through the depths</p>

      <section
        aria-label="Labyrinth map"
        className="relative w-full max-w-[920px] rounded-shell-panel border border-stone-500 bg-stone-950 p-4 sm:p-5"
        style={{ "--labyrinth-node-size": "clamp(2.35rem, 4.8vw, 3.45rem)" } as CSSProperties}
      >
        <div className="absolute right-4 top-4 z-30">
          <HamburgerTrigger onClick={onOpenMenu} label="Open labyrinth menu" />
        </div>

        <div className="relative mx-auto aspect-[9/8] w-full max-w-[85.19cqh] p-[clamp(0.6rem,1.4vw,1rem)]">
          <div className="relative h-full w-full">
            <LabyrinthConnectionLayer labyrinthMap={labyrinthMap} />

            {labyrinthMap.grid.map((row, r) =>
              row.map((node, c) =>
                node ? (
                  <LabyrinthNodeButton
                    key={`${r}-${c}`}
                    row={r}
                    col={c}
                    node={node}
                    labyrinthMap={labyrinthMap}
                    onNodeClick={onNodeClick}
                    onHover={setHoveredNode}
                    onLeave={() => setHoveredNode(null)}
                  />
                ) : null,
              ),
            )}

            {hoveredNode ? (
              <div
                key={`${hoveredNode.row}-${hoveredNode.col}`}
                className="pointer-events-none absolute z-[60] flex h-[var(--labyrinth-node-size)] w-[var(--labyrinth-node-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={positionStyle(hoveredNode.row, hoveredNode.col, labyrinthMap.rows, labyrinthMap.cols)}
              >
                <LabyrinthNodeTooltip
                  type={hoveredNode.type}
                  modifiers={hoveredNode.modifiers}
                  rewardModifiers={hoveredNode.rewardModifiers}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
