import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { HOMESTEAD_FEEDBACK } from "@/lib/game-constants/ui-motion";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";
import { TooltipBody, TooltipSeparator } from "../../../shared/ui/tooltips/tooltip-panel";
import { renderTextWithMaterials } from "./helpers";
import type { HomesteadNodeModel } from "./node-model";

export function HomesteadTooltipBody({
  node,
  inventory,
  saving,
  animate,
  reducedMotion,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  saving: boolean;
  animate: boolean;
  reducedMotion: boolean;
}) {
  useGameTranslation();
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
  const costLabel = materials
    .map((material) => `${node.cost![material]} ${displayText(materialLabels[material])}`)
    .join(", ");
  return (
    <motion.div
      initial={false}
      animate={{ height: height ?? "auto" }}
      transition={{
        duration: reducedMotion || !animate ? 0 : HOMESTEAD_FEEDBACK.resizeMs / 1000,
        ease: "easeOut",
      }}
      className="overflow-hidden"
      data-homestead-transition={animate ? "active" : "idle"}
    >
      <div ref={contentRef} className="flow-root">
        {node.discovered ? (
          <>
            {node.level > 0 && (
              <TooltipBody className="mt-2 space-y-1">
                {[...node.bonuses, ...node.production].map((line, index) => (
                  <p key={index} className="min-h-6 leading-6">
                    {renderTextWithMaterials(line, {
                      renderPlain: (text, key) => (
                        <Fragment key={key}>
                          {text
                            .split(/(\d+(?:\.\d+)?%?)/)
                            .map((part, index) =>
                              /^\d/.test(part) ? (
                                <TooltipValue key={index} value={part} animate={animate} />
                              ) : (
                                <Fragment key={index}>{displayText(part)}</Fragment>
                              ),
                            )}
                        </Fragment>
                      ),
                    })}
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
                  aria-label={gameText("ui.node-tooltip-body.1", "{{value0}} cost: {{value1}}", {
                    value0: displayText(node.action),
                    value1: displayText(costLabel),
                  })}
                >
                  <span className="text-muted-foreground">{displayText(node.action)}</span>
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
                        <TooltipValue value={String(node.cost![material])} animate={animate} />
                      </span>
                    ))}
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <TooltipBody className="mt-2">
            {gameText("ui.node-tooltip-body.2", "Discover this Companion during a Run.")}
          </TooltipBody>
        )}
      </div>
    </motion.div>
  );
}

function TooltipValue({ value, animate }: { value: string; animate: boolean }) {
  useGameTranslation();
  const [previous, setPrevious] = useState(value);
  const [changed, setChanged] = useState(false);
  if (previous !== value) {
    setPrevious(value);
    setChanged(animate);
  }
  if (!animate && changed) setChanged(false);
  return (
    <span
      key={value}
      className={cn("inline-block tabular-nums", animate && changed && "homestead-value-update")}
      style={{ "--homestead-value-duration": `${HOMESTEAD_FEEDBACK.valueMs}ms` } as CSSProperties}
    >
      {value}
    </span>
  );
}
