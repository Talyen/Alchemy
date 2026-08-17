/**
 * Screen rendering the Labyrinth node connection grid and active modifiers tooltip.
 * Depends on: labyrinth/data.ts, modifiers.ts, run-session reads, Lucide icons, UI components
 * Depended on by: render-alchemy-screen.tsx
 */
import { type CSSProperties, useCallback, useRef, useState } from "react";

import { ScreenDescription, TitledScreenShell } from "../../../shared/ui/shared-ui";
import { settingsPanelShellClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import type { LabyrinthMap } from "@/lib/content-systems/types";

import { LabyrinthConnectionLayer } from "./labyrinth-connection-layer";
import { LabyrinthNodeButton, type HoveredLabyrinthNode } from "./labyrinth-node-button";
import { LabyrinthNodeTooltip } from "./labyrinth-node-tooltip";
import { positionStyle } from "./labyrinth-map-layout";

interface Props {
  labyrinthMap: LabyrinthMap | null;
  onNodeClick: (row: number, col: number) => void;
  onOpenMenu: (rect?: DOMRect) => void;
}

export function LabyrinthMapScreen({ labyrinthMap, onNodeClick, onOpenMenu }: Props) {
  const [hoveredNode, setHoveredNode] = useState<HoveredLabyrinthNode | null>(null);
  const tooltipAnchorRef = useRef<HTMLDivElement>(null);
  const handleNodeLeave = useCallback(() => setHoveredNode(null), []);

  return (
    <TitledScreenShell
      title="Labyrinth"
      onOpenMenu={onOpenMenu}
      menuLabel="Open labyrinth menu"
      maxWidthClass="max-w-7xl"
    >
      <div className="mt-4 flex min-h-0 flex-col items-center gap-4 text-center sm:gap-5">
        <ScreenDescription className="max-w-xl shrink-0 text-amber-100/75">
          Choose your path through the depths
        </ScreenDescription>

        <section
          aria-label="Labyrinth map"
          className={cn(
            settingsPanelShellClass,
            "relative flex min-h-0 w-full max-w-[1104px] shrink items-center justify-center",
          )}
          style={{ "--labyrinth-node-size": "clamp(2.7rem, 5.5vw, 4rem)" } as CSSProperties}
        >
          {/* 90cqh (not 100): header/subtitle + denser padding leave ~887px; 100cqh board is ~939px and clips. */}
          <div className="relative mx-auto aspect-[9/8] w-full max-w-[min(100%,90cqh)] p-[clamp(0.72rem,1.68vw,1.2rem)]">
            {labyrinthMap ? (
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
                        onLeave={handleNodeLeave}
                      />
                    ) : null,
                  ),
                )}

                {hoveredNode ? (
                  <div
                    key={`${hoveredNode.row}-${hoveredNode.col}`}
                    ref={tooltipAnchorRef}
                    className="pointer-events-none absolute z-[60] flex h-[var(--labyrinth-node-size)] w-[var(--labyrinth-node-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    style={positionStyle(hoveredNode.row, hoveredNode.col, labyrinthMap.rows, labyrinthMap.cols)}
                  >
                    <LabyrinthNodeTooltip
                      type={hoveredNode.type}
                      modifiers={hoveredNode.modifiers}
                      rewardModifiers={hoveredNode.rewardModifiers}
                      triggerRef={tooltipAnchorRef}
                      visible
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </TitledScreenShell>
  );
}
