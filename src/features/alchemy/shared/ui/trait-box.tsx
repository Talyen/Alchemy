import { createElement } from "react";
import { extractKeywordIds } from "@/lib/keyword-text";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { cn } from "@/lib/utils";
import { getEncounterTraitPresentation } from "../config/encounter-trait-presentation";
import { getEnemyTraitIcon } from "../config/enemy-trait-icons";
import { keywordDefinitions, type EnemyTrait } from "../config/game-data-catalog";
import { renderColoredKeywords } from "./cards/card-description-ui";
import { ShineText } from "./shine-text";

export type TraitBoxVariant = "default" | "compact";

export function TraitBox({ trait, variant = "default" }: { trait: EnemyTrait; variant?: TraitBoxVariant }) {
  const compact = variant === "compact";
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
      className={cn("flex min-w-0 items-center", compact ? "gap-[calc(0.5*var(--content-rem,1rem))]" : "gap-3")}
    >
      {createElement(Icon, {
        "aria-hidden": true,
        className: cn("shrink-0", compact ? "size-[calc(1.5*var(--content-rem,1rem))]" : "size-9", colorClass),
      })}
      <div className="min-w-0">
        <h3
          className={cn(
            "font-semibold",
            compact
              ? "text-[length:calc(0.875*var(--content-rem,1rem))] leading-[var(--text-lg--line-height)]"
              : "text-lg",
          )}
        >
          <ShineText
            colors={encounter?.textShineColors ?? getKeywordTextShineColors(keywords.length > 0 ? keywords : thematic)}
            fallbackClassName="text-stone-200"
          >
            {trait.title}
          </ShineText>
        </h3>
        <p
          className={cn(
            "leading-relaxed whitespace-pre-line text-stone-300",
            compact
              ? "mt-[calc(0.1875*var(--content-rem,1rem))] text-[length:calc(0.75*var(--content-rem,1rem))]"
              : "mt-1 text-base",
          )}
        >
          {renderColoredKeywords(trait.description)}
        </p>
      </div>
    </div>
  );
}
