import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { HOMESTEAD_FEEDBACK } from "@/lib/game-constants/ui-motion";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";
import { TooltipBody, TooltipSeparator } from "../../../shared/ui/tooltips/tooltip-panel";
import type { FadePhase } from "../../../shared/ui/use-fade";
import { renderTextWithMaterials } from "./helpers";
import type { HomesteadNodeModel } from "./node-model";

export function HomesteadTooltipBody({
  node,
  inventory,
  saving,
  phase,
  reducedMotion,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  saving: boolean;
  phase: FadePhase;
  reducedMotion: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setHeight(content.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);
  const materials = MATERIAL_IDS.filter((material) => (node.cost?.[material] ?? 0) > 0);
  const costLabel = materials.map((material) => `${node.cost![material]} ${materialLabels[material]}`).join(", ");
  return (
    <motion.div
      initial={false}
      animate={{ height: height ?? "auto" }}
      transition={{
        duration: reducedMotion || phase === "idle" ? 0 : HOMESTEAD_FEEDBACK.resizeMs / 1000,
        ease: "easeOut",
      }}
      className="overflow-hidden"
      data-homestead-phase={phase}
    >
      <div
        ref={contentRef}
        className="flow-root"
        style={{
          opacity: phase === "exit" ? 0 : 1,
          transition: reducedMotion ? "none" : `opacity ${HOMESTEAD_FEEDBACK.contentFadeMs}ms ease-out`,
        }}
      >
        {node.discovered ? (
          <>
            {node.level > 0 && (
              <TooltipBody className="mt-2 space-y-1">
                {[...node.bonuses, ...node.production].map((line, index) => (
                  <p key={index} className="min-h-6 leading-6">
                    {renderTextWithMaterials(line)}
                  </p>
                ))}
              </TooltipBody>
            )}
            {node.cost && (
              <>
                {node.level > 0 && <TooltipSeparator className="my-3" />}
                <div
                  role="group"
                  className={cn(
                    "flex min-h-6 items-center justify-between gap-4 text-sm leading-6",
                    node.level === 0 && "mt-3",
                  )}
                  aria-label={`${node.action} cost: ${costLabel}`}
                >
                  <span className="text-muted-foreground">{node.action}</span>
                  <span className="inline-flex items-center gap-3" aria-hidden="true">
                    {materials.map((material) => (
                      <span
                        key={material}
                        className={cn(
                          "inline-flex items-center gap-1.5 tabular-nums",
                          !saving && inventory[material] < node.cost![material] && "text-destructive",
                        )}
                      >
                        <HomesteadResourceArtwork resource={material} alt="" />
                        <span>{node.cost![material]}</span>
                      </span>
                    ))}
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <TooltipBody className="mt-2">Discover this Companion during a Run.</TooltipBody>
        )}
      </div>
    </motion.div>
  );
}
