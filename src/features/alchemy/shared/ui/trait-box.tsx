import { createElement } from "react";
import { extractKeywordIds } from "@/lib/keyword-text";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { cn } from "@/lib/utils";
import { getEncounterTraitPresentation } from "../config/encounter-trait-presentation";
import { getEnemyTraitIcon } from "../config/enemy-trait-icons";
import { keywordDefinitions, type EnemyTrait } from "../config/game-data-catalog";
import { renderColoredKeywords } from "./card-description-ui";
import { ShineText } from "./shine-text";

export function TraitBox({ trait }: { trait: EnemyTrait }) {
  const keywords = extractKeywordIds(trait.description);
  const encounter = getEncounterTraitPresentation(trait.id);
  const thematic = encounter?.keywords ?? [];
  const primary = thematic[0] ?? keywords[0];
  const Icon = encounter?.Icon ?? getEnemyTraitIcon(trait);
  return (
    <div
      data-trait={trait.id}
      className="flex min-w-0 items-start gap-3 rounded-shell-compact border border-white/10 bg-white/[0.03] p-3"
    >
      {createElement(Icon, {
        "aria-hidden": true,
        className: cn("mt-0.5 size-8 shrink-0", primary ? keywordDefinitions[primary].colorClass : "text-stone-400"),
      })}
      <div className="min-w-0">
        <h3 className="text-lg font-semibold">
          <ShineText
            colors={getKeywordTextShineColors(keywords.length > 0 ? keywords : thematic)}
            fallbackClassName="text-stone-200"
          >
            {trait.title}
          </ShineText>
        </h3>
        <p className="mt-1 text-base leading-relaxed whitespace-pre-line text-stone-300">
          {renderColoredKeywords(trait.description)}
        </p>
      </div>
    </div>
  );
}
