import { useGameTranslation } from "@/components/use-game-translation";

import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { HOMESTEAD_FEEDBACK } from "@/lib/game-constants";
import { keywordDefinitions } from "@/lib/game-data";
import { MATERIAL_IDS, materialLabels, type MaterialId, type MaterialInventory } from "@/lib/homestead/types";
import { goldTextColor, HomesteadResourceArtwork, matTextColor } from "../../../shared/ui/material-icons";
import { TooltipBody, TooltipSeparator } from "../../../shared/ui/tooltips/tooltip-panel";
import { renderTextWithMaterials } from "./helpers";
import { HomesteadBonusIcon } from "./bonus-icons";
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
  const i18n = useGameTranslation();
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
  const hasBenefits = node.bonuses.length > 0 || node.production.length > 0;
  const previewClass = node.level === 0 ? "opacity-80 saturate-[0.6]" : undefined;
  const costLabel = materials
    .map((material) => `${node.cost![material]} ${i18n.displayText(materialLabels[material])}`)
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
            {hasBenefits && (
              <TooltipBody className="mt-2 space-y-1">
                {[...node.bonuses, ...node.production].map((line, index) => (
                  <p key={index} className="flex min-h-6 items-start gap-2 leading-6">
                    <HomesteadBonusIcon node={node} line={line} production={index >= node.bonuses.length} />
                    <span className="min-w-0">
                      {i18n.read(() =>
                        renderTextWithMaterials(line, {
                          renderResource: (text, resource, key) => (
                            <span
                              key={key}
                              className={cn(
                                resource === "gold" ? goldTextColor : matTextColor[resource as MaterialId],
                                "font-semibold",
                                previewClass,
                              )}
                            >
                              {text}
                            </span>
                          ),
                          renderKeyword: (text, keyword, key) => (
                            <span
                              key={key}
                              className={cn(keywordDefinitions[keyword].colorClass, "font-semibold", previewClass)}
                            >
                              {text}
                            </span>
                          ),
                          renderPlain: (text, key) => (
                            <span key={key} className={previewClass}>
                              {text
                                .split(/(\d+(?:\.\d+)?%?)/)
                                .map((part, index) =>
                                  /^\d/.test(part) ? (
                                    <TooltipValue key={index} value={part} animate={animate} />
                                  ) : (
                                    <Fragment key={index}>{part}</Fragment>
                                  ),
                                )}
                            </span>
                          ),
                        }),
                      )}
                    </span>
                  </p>
                ))}
              </TooltipBody>
            )}
            {node.cost && (
              <>
                {hasBenefits && <TooltipSeparator className="my-3" />}
                <div
                  role="group"
                  className={cn(
                    "flex min-h-6 items-center justify-between gap-4 text-sm leading-6",
                    !hasBenefits && "mt-3",
                  )}
                  aria-label={i18n.text("ui.node-tooltip-body.1", "{{value0}} cost: {{value1}}", {
                    value0: i18n.displayText(node.action),
                    value1: i18n.displayText(costLabel),
                  })}
                >
                  <span className={cn("text-muted-foreground", node.action !== "Bond" && "text-base")}>
                    {i18n.displayText(node.action)}
                  </span>
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
            {i18n.text("ui.node-tooltip-body.2", "Discover this Companion during a Run.")}
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
