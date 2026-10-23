import { useGameTranslation } from "@/components/use-game-translation";

import { createElement } from "react";
import { extractKeywordIds } from "@/lib/keyword-text";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { cn } from "@/lib/utils";
import { getEncounterTraitPresentation } from "../config/encounter-trait-presentation";
import { getEnemyTraitIcon } from "../config/enemy-trait-icons";
import { keywordDefinitions, type EnemyTrait } from "../config/game-data-catalog";
import { tooltipBodyLineClass, tooltipHeaderClass } from "../config/typography";
import { renderColoredKeywords } from "./cards/card-description-ui";
import { ShineText } from "./shine-text";

export type TraitBoxVariant = "default" | "tooltip";

export function TraitBox({ trait, variant = "default" }: { trait: EnemyTrait; variant?: TraitBoxVariant }) {
  const i18n = useGameTranslation();
  const tooltip = variant === "tooltip";
  const keywords = extractKeywordIds(trait.description);
  const encounter = getEncounterTraitPresentation(trait.id);
  const thematic = encounter?.keywords ?? [];
  const primary = thematic[0] ?? keywords[0];
  const Icon = encounter?.Icon ?? getEnemyTraitIcon(trait);
  const colorClass = encounter?.colorClass ?? (primary ? keywordDefinitions[primary].colorClass : "text-stone-400");
  return (
    <div
      data-trait={trait.id}
      data-trait-variant={variant}
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3"
    >
      {i18n.displayText(
        createElement(Icon, {
          "aria-hidden": true,
          className: cn("text-lg", colorClass),
        }),
      )}
      <h3 className={tooltip ? tooltipHeaderClass : "text-lg font-semibold"}>
        <ShineText
          colors={encounter?.textShineColors ?? getKeywordTextShineColors(keywords.length > 0 ? keywords : thematic)}
          fallbackClassName="text-stone-200"
        >
          {i18n.displayText(trait.title)}
        </ShineText>
      </h3>
      <p
        className={cn(
          "col-start-2 mt-1 whitespace-pre-line",
          tooltip ? tooltipBodyLineClass : "text-base leading-relaxed text-stone-300",
        )}
      >
        {i18n.displayText(i18n.read(() => renderColoredKeywords(trait.description)))}
      </p>
    </div>
  );
}
